const { Pool } = require('pg');
const logger = require('../utils/logger');

class CreativeService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://adserver:dev_password@localhost:5432/adserver_dev'
        });
    }

    /**
     * Create a new creative
     */
    async createCreative(creativeData, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO creatives (
                    campaign_id, name, video_url, duration,
                    file_size, width, height, format, status, uploaded_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                creativeData.campaign_id,
                creativeData.name,
                creativeData.video_url,
                creativeData.duration,
                creativeData.file_size || null,
                creativeData.width || null,
                creativeData.height || null,
                creativeData.format || 'mp4',
                creativeData.status || 'processing',
                userId
            ];

            const result = await client.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating creative', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all creatives for a campaign
     */
    async getCreativesByCampaign(campaignId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT cr.*
                FROM creatives cr
                INNER JOIN campaigns c ON c.id = cr.campaign_id
                WHERE cr.campaign_id = $1 AND c.created_by = $2
                ORDER BY cr.created_at DESC
            `;

            const result = await client.query(query, [campaignId, userId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching creatives', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get a single creative by ID
     */
    async getCreativeById(creativeId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT cr.*
                FROM creatives cr
                INNER JOIN campaigns c ON c.id = cr.campaign_id
                WHERE cr.id = $1 AND c.created_by = $2
            `;

            const result = await client.query(query, [creativeId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching creative by ID', { error: error.message, creativeId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update a creative
     */
    async updateCreative(creativeId, updates, userId) {
        const client = await this.pool.connect();
        try {
            // First check if user owns the campaign
            const checkQuery = `
                SELECT cr.id
                FROM creatives cr
                INNER JOIN campaigns c ON c.id = cr.campaign_id
                WHERE cr.id = $1 AND c.created_by = $2
            `;
            const checkResult = await client.query(checkQuery, [creativeId, userId]);

            if (checkResult.rows.length === 0) {
                return null;
            }

            // Build dynamic UPDATE query
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['name', 'status', 'video_url', 'duration', 'width', 'height'];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = $${paramIndex}`);
                    values.push(updates[field]);
                    paramIndex++;
                }
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(creativeId);

            const query = `
                UPDATE creatives
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating creative', { error: error.message, creativeId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update creative status
     */
    async updateCreativeStatus(creativeId, status, userId) {
        const client = await this.pool.connect();
        try {
            const validStatuses = ['active', 'inactive', 'processing', 'failed'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const query = `
                UPDATE creatives cr
                SET status = $1, updated_at = NOW()
                FROM campaigns c
                WHERE cr.campaign_id = c.id
                AND cr.id = $2
                AND c.created_by = $3
                RETURNING cr.*
            `;

            const result = await client.query(query, [status, creativeId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating creative status', { error: error.message, creativeId, status });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Delete a creative
     */
    async deleteCreative(creativeId, userId) {
        const client = await this.pool.connect();
        try {
            // Check ownership through campaign
            const query = `
                DELETE FROM creatives cr
                USING campaigns c
                WHERE cr.campaign_id = c.id
                AND cr.id = $1
                AND c.created_by = $2
                RETURNING cr.id, cr.video_url
            `;

            const result = await client.query(query, [creativeId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error deleting creative', { error: error.message, creativeId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get creatives by status
     */
    async getCreativesByStatus(status, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT cr.*, c.name as campaign_name
                FROM creatives cr
                INNER JOIN campaigns c ON c.id = cr.campaign_id
                WHERE cr.status = $1 AND c.created_by = $2
                ORDER BY cr.created_at DESC
            `;

            const result = await client.query(query, [status, userId]);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching creatives by status', { error: error.message, status });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Check if user has access to campaign
     */
    async userOwnsCampaign(campaignId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT id FROM campaigns
                WHERE id = $1 AND created_by = $2
            `;

            const result = await client.query(query, [campaignId, userId]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error checking campaign ownership', { error: error.message, campaignId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get creative statistics
     */
    async getCreativeStats(creativeId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT
                    cr.id,
                    cr.name,
                    cr.status,
                    cr.duration,
                    COUNT(i.id) as impressions_count,
                    SUM(CASE WHEN i.completed THEN 1 ELSE 0 END) as completions_count,
                    SUM(CASE WHEN i.clicked THEN 1 ELSE 0 END) as clicks_count,
                    ROUND(AVG(i.duration_watched), 2) as avg_watch_duration
                FROM creatives cr
                INNER JOIN campaigns c ON c.id = cr.campaign_id
                LEFT JOIN impressions i ON i.creative_id = cr.id
                WHERE cr.id = $1 AND c.created_by = $2
                GROUP BY cr.id, cr.name, cr.status, cr.duration
            `;

            const result = await client.query(query, [creativeId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching creative stats', { error: error.message, creativeId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Close database connection (for cleanup)
     */
    async close() {
        await this.pool.end();
    }
}

module.exports = new CreativeService();