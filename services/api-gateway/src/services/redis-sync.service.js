const { Pool } = require('pg');
const redisClient = require('./redisService');
const logger = require('../utils/logger');

// Create database pool using DATABASE_URL (same as authService)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class RedisSyncService {
  constructor() {
    this.syncInterval = 10000; // 10 seconds
    this.intervalId = null;
  }

  /**
   * Start background sync from PostgreSQL to Redis
   */
  start() {
    logger.info('Starting Redis sync service...');

    // Initial sync
    this.syncAll().catch(err => {
      logger.error('Initial sync failed:', err);
    });

    // Schedule periodic syncs
    this.intervalId = setInterval(() => {
      this.syncAll().catch(err => {
        logger.error('Periodic sync failed:', err);
      });
    }, this.syncInterval);

    logger.info('Redis sync service started (syncing every 10 seconds)');
  }

  /**
   * Stop the sync service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Redis sync service stopped');
    }
  }

  /**
   * Sync all data from PostgreSQL to Redis
   */
  async syncAll() {
    const startTime = Date.now();

    try {
      // Sync campaigns and creatives in parallel
      await Promise.all([
        this.syncCampaigns(),
        this.syncCreatives()
      ]);

      const duration = Date.now() - startTime;
      logger.info(`Redis sync completed in ${duration}ms`);
    } catch (error) {
      logger.error('Redis sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync campaigns from PostgreSQL to Redis
   */
  async syncCampaigns() {
    const client = await pool.connect();

    try {
      // Get all campaigns
      const result = await client.query(`
        SELECT id, name, status, budget_total, budget_spent, start_date, end_date
        FROM campaigns
      `);

      const campaigns = result.rows;
      const pipeline = redisClient.pipeline();

      // Clear existing active campaigns set
      pipeline.del('active_campaigns');

      for (const campaign of campaigns) {
        const campaignKey = `campaign:${campaign.id}`;

        // Store campaign data as hash
        pipeline.hSet(campaignKey, {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          budget_total: campaign.budget_total.toString(),
          budget_spent: campaign.budget_spent.toString(),
          start_date: campaign.start_date.toISOString(),
          end_date: campaign.end_date.toISOString()
        });

        // Set TTL to 1 hour (forces periodic refresh)
        pipeline.expire(campaignKey, 3600);

        // Add active campaigns to sorted set (sorted by remaining budget)
        if (campaign.status === 'active') {
          const remainingBudget = campaign.budget_total - campaign.budget_spent;
          pipeline.zAdd('active_campaigns', { score: remainingBudget, value: campaign.id });
        }
      }

      // Set TTL on active campaigns set
      pipeline.expire('active_campaigns', 3600);

      await pipeline.exec();
      logger.debug(`Synced ${campaigns.length} campaigns to Redis`);
    } finally {
      client.release();
    }
  }

  /**
   * Sync creatives from PostgreSQL to Redis
   */
  async syncCreatives() {
    const client = await pool.connect();

    try {
      // Get all creatives
      const result = await client.query(`
        SELECT id, campaign_id, name, video_url, duration, format, status
        FROM creatives
      `);

      const creatives = result.rows;
      const pipeline = redisClient.pipeline();

      // Group creatives by campaign
      const campaignCreatives = {};

      for (const creative of creatives) {
        const creativeKey = `creative:${creative.id}`;

        // Store creative data as hash
        pipeline.hSet(creativeKey, {
          id: creative.id,
          campaign_id: creative.campaign_id,
          name: creative.name,
          video_url: creative.video_url || '',
          duration: creative.duration.toString(),
          format: creative.format,
          status: creative.status
        });

        // Set TTL to 1 hour
        pipeline.expire(creativeKey, 3600);

        // Track campaign's creatives
        if (!campaignCreatives[creative.campaign_id]) {
          campaignCreatives[creative.campaign_id] = [];
        }
        campaignCreatives[creative.campaign_id].push(creative.id);
      }

      // Store campaign:creatives relationships
      for (const [campaignId, creativeIds] of Object.entries(campaignCreatives)) {
        const setKey = `campaign:${campaignId}:creatives`;

        // Clear existing set
        pipeline.del(setKey);

        // Add all creatives for this campaign
        if (creativeIds.length > 0) {
          pipeline.sAdd(setKey, creativeIds);
          pipeline.expire(setKey, 3600);
        }
      }

      await pipeline.exec();
      logger.debug(`Synced ${creatives.length} creatives to Redis`);
    } finally {
      client.release();
    }
  }

  /**
   * Immediately sync a specific campaign (for critical updates)
   */
  async syncCampaign(campaignId) {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT id, name, status, budget_total, budget_spent, start_date, end_date
        FROM campaigns
        WHERE id = $1
      `, [campaignId]);

      if (result.rows.length === 0) {
        // Campaign deleted or not found - remove from Redis
        await redisClient.del(`campaign:${campaignId}`);
        await redisClient.zRem('active_campaigns', campaignId);
        return;
      }

      const campaign = result.rows[0];
      const campaignKey = `campaign:${campaign.id}`;

      await redisClient.hmSet(campaignKey, {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        budget_total: campaign.budget_total.toString(),
        budget_spent: campaign.budget_spent.toString(),
        start_date: campaign.start_date.toISOString(),
        end_date: campaign.end_date.toISOString()
      });

      await redisClient.expire(campaignKey, 3600);

      // Update active campaigns set
      if (campaign.status === 'active') {
        const remainingBudget = campaign.budget_total - campaign.budget_spent;
        await redisClient.zAdd('active_campaigns', remainingBudget, campaign.id);
      } else {
        await redisClient.zRem('active_campaigns', campaign.id);
      }

      logger.info(`Campaign ${campaignId} synced to Redis`);
    } finally {
      client.release();
    }
  }

  /**
   * Immediately sync a specific creative (for critical updates)
   */
  async syncCreative(creativeId) {
    const client = await pool.connect();

    try {
      const result = await client.query(`
        SELECT id, campaign_id, name, video_url, duration, format, status
        FROM creatives
        WHERE id = $1
      `, [creativeId]);

      if (result.rows.length === 0) {
        // Creative deleted or not found - remove from Redis
        await redisClient.del(`creative:${creativeId}`);
        // Would need campaign_id to remove from set, so do full sync instead
        return;
      }

      const creative = result.rows[0];
      const creativeKey = `creative:${creative.id}`;

      await redisClient.hmSet(creativeKey, {
        id: creative.id,
        campaign_id: creative.campaign_id,
        name: creative.name,
        video_url: creative.video_url || '',
        duration: creative.duration.toString(),
        format: creative.format,
        status: creative.status
      });

      await redisClient.expire(creativeKey, 3600);

      // Add to campaign's creatives set
      const setKey = `campaign:${creative.campaign_id}:creatives`;
      await redisClient.sAdd(setKey, creative.id);
      await redisClient.expire(setKey, 3600);

      logger.info(`Creative ${creativeId} synced to Redis`);
    } finally {
      client.release();
    }
  }
}

module.exports = new RedisSyncService();
