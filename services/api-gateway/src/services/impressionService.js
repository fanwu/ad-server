const { Pool } = require('pg');
const logger = require('../utils/logger');

// Create database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class ImpressionService {
  constructor() {
    this.impressionQueue = [];
    this.batchSize = 100; // Write in batches of 100
    this.flushInterval = 5000; // Flush every 5 seconds
    this.intervalId = null;
  }

  /**
   * Start the batch write service
   */
  start() {
    logger.info('Starting impression batch write service...');

    // Schedule periodic flushes
    this.intervalId = setInterval(() => {
      this.flushQueue().catch(err => {
        logger.error('Periodic flush failed:', err);
      });
    }, this.flushInterval);

    logger.info(`Impression service started (flushing every ${this.flushInterval}ms)`);
  }

  /**
   * Stop the batch write service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;

      // Flush any remaining impressions
      this.flushQueue().catch(err => {
        logger.error('Final flush failed:', err);
      });

      logger.info('Impression service stopped');
    }
  }

  /**
   * Track an impression (add to queue)
   */
  async trackImpression(impressionData) {
    const {
      ad_id,
      campaign_id,
      creative_id,
      device_id,
      device_type,
      location_country,
      location_region,
      user_agent,
      ip_address,
      session_id,
      duration,
      completed
    } = impressionData;

    // Add to queue
    this.impressionQueue.push({
      campaign_id,
      creative_id,
      device_type: device_type || null,
      location_country: location_country || null,
      location_region: location_region || null,
      user_agent: user_agent || null,
      ip_address: ip_address || null,
      session_id: session_id || ad_id, // Use ad_id as session if not provided
      timestamp: new Date()
    });

    logger.debug(`Impression queued: campaign=${campaign_id}, creative=${creative_id}, queue_size=${this.impressionQueue.length}`);

    // If completion data provided, track it
    if (completed && duration) {
      // For MVP, we'll track completions separately later
      // For now, just log it
      logger.debug(`Impression completed: creative=${creative_id}, duration=${duration}`);
    }

    // Flush if batch size reached
    if (this.impressionQueue.length >= this.batchSize) {
      await this.flushQueue();
    }

    return { queued: true, queue_size: this.impressionQueue.length };
  }

  /**
   * Flush the impression queue to PostgreSQL
   */
  async flushQueue() {
    if (this.impressionQueue.length === 0) {
      return;
    }

    const impressions = [...this.impressionQueue];
    this.impressionQueue = [];

    const startTime = Date.now();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Batch insert impressions
      const values = [];
      const params = [];
      let paramIndex = 1;

      for (const imp of impressions) {
        const rowParams = [
          imp.creative_id,
          imp.campaign_id,
          imp.device_type,
          imp.location_country,
          imp.location_region,
          imp.timestamp,
          imp.user_agent,
          imp.ip_address,
          imp.session_id
        ];

        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`);
        params.push(...rowParams);
        paramIndex += 9;
      }

      const query = `
        INSERT INTO impressions (
          creative_id,
          campaign_id,
          device_type,
          location_country,
          location_region,
          served_at,
          user_agent,
          ip_address,
          session_id
        ) VALUES ${values.join(', ')}
      `;

      await client.query(query, params);

      // Update campaign daily stats
      await this.updateDailyStats(client, impressions);

      await client.query('COMMIT');

      const duration = Date.now() - startTime;
      logger.info(`Flushed ${impressions.length} impressions to PostgreSQL in ${duration}ms`);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to flush impressions:', error);

      // Put impressions back in queue for retry
      this.impressionQueue.unshift(...impressions);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update campaign daily stats
   */
  async updateDailyStats(client, impressions) {
    // Group impressions by campaign and date
    const statsByKey = {};

    for (const imp of impressions) {
      const date = imp.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${imp.campaign_id}:${date}`;

      if (!statsByKey[key]) {
        statsByKey[key] = {
          campaign_id: imp.campaign_id,
          date: date,
          impressions_count: 0
        };
      }

      statsByKey[key].impressions_count++;
    }

    // Upsert stats
    for (const stats of Object.values(statsByKey)) {
      await client.query(`
        INSERT INTO campaign_daily_stats (campaign_id, date, impressions_count)
        VALUES ($1, $2, $3)
        ON CONFLICT (campaign_id, date)
        DO UPDATE SET
          impressions_count = campaign_daily_stats.impressions_count + EXCLUDED.impressions_count,
          updated_at = NOW()
      `, [stats.campaign_id, stats.date, stats.impressions_count]);
    }
  }

  /**
   * Get impression statistics
   */
  async getStats(campaignId, startDate, endDate) {
    const client = await pool.connect();

    try {
      const query = `
        SELECT
          DATE(served_at) as date,
          COUNT(*) as impressions_count
        FROM impressions
        WHERE campaign_id = $1
          AND served_at >= $2
          AND served_at <= $3
        GROUP BY DATE(served_at)
        ORDER BY date ASC
      `;

      const result = await client.query(query, [campaignId, startDate, endDate]);
      return result.rows;

    } finally {
      client.release();
    }
  }

  /**
   * Get total impression count for a campaign
   */
  async getTotalImpressions(campaignId) {
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT COUNT(*) as total FROM impressions WHERE campaign_id = $1',
        [campaignId]
      );

      return parseInt(result.rows[0].total, 10);

    } finally {
      client.release();
    }
  }

  /**
   * Close the service
   */
  async close() {
    this.stop();
    await pool.end();
  }
}

module.exports = new ImpressionService();
