const { Pool } = require('pg');
const logger = require('../utils/logger');

class CampaignService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://adserver:dev_password@localhost:5432/adserver_dev'
        });
    }

    /**
     * Create a new campaign
     */
    async createCampaign(campaignData, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                INSERT INTO campaigns (
                    name, description, status, budget_total,
                    start_date, end_date, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const values = [
                campaignData.name,
                campaignData.description || null,
                'draft', // All campaigns start as draft
                campaignData.budget_total,
                campaignData.start_date,
                campaignData.end_date,
                userId
            ];

            const result = await client.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating campaign', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get all campaigns for a user
     */
    async getCampaigns(userId, filters = {}) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT
                    c.*,
                    COALESCE(COUNT(DISTINCT cr.id), 0) as creative_count,
                    COALESCE(SUM(cds.impressions), 0) as total_impressions
                FROM campaigns c
                LEFT JOIN creatives cr ON cr.campaign_id = c.id
                LEFT JOIN campaign_daily_stats cds ON cds.campaign_id = c.id
                WHERE c.created_by = $1
            `;

            const values = [userId];
            let paramIndex = 2;

            // Add status filter if provided
            if (filters.status) {
                query += ` AND c.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            // Add date range filter if provided
            if (filters.start_date) {
                query += ` AND c.end_date >= $${paramIndex}`;
                values.push(filters.start_date);
                paramIndex++;
            }

            if (filters.end_date) {
                query += ` AND c.start_date <= $${paramIndex}`;
                values.push(filters.end_date);
                paramIndex++;
            }

            query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

            const result = await client.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error fetching campaigns', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get a single campaign by ID
     */
    async getCampaignById(campaignId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT
                    c.*,
                    COALESCE(COUNT(DISTINCT cr.id), 0) as creative_count,
                    COALESCE(SUM(cds.impressions), 0) as total_impressions,
                    COALESCE(SUM(cds.clicks), 0) as total_clicks,
                    COALESCE(SUM(cds.spend), 0) as total_spend
                FROM campaigns c
                LEFT JOIN creatives cr ON cr.campaign_id = c.id
                LEFT JOIN campaign_daily_stats cds ON cds.campaign_id = c.id
                WHERE c.id = $1 AND c.created_by = $2
                GROUP BY c.id
            `;

            const result = await client.query(query, [campaignId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching campaign by ID', { error: error.message, campaignId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update a campaign
     */
    async updateCampaign(campaignId, updates, userId) {
        const client = await this.pool.connect();
        try {
            // Build dynamic UPDATE query based on provided fields
            const updateFields = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['name', 'description', 'budget_total', 'start_date', 'end_date'];

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

            // Add campaign ID and user ID for WHERE clause
            values.push(campaignId, userId);

            const query = `
                UPDATE campaigns
                SET ${updateFields.join(', ')}, updated_at = NOW()
                WHERE id = $${paramIndex} AND created_by = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating campaign', { error: error.message, campaignId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update campaign status
     */
    async updateCampaignStatus(campaignId, status, userId) {
        const client = await this.pool.connect();
        try {
            const validStatuses = ['draft', 'active', 'paused', 'completed'];
            if (!validStatuses.includes(status)) {
                throw new Error(`Invalid status: ${status}`);
            }

            const query = `
                UPDATE campaigns
                SET status = $1, updated_at = NOW()
                WHERE id = $2 AND created_by = $3
                RETURNING *
            `;

            const result = await client.query(query, [status, campaignId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error updating campaign status', { error: error.message, campaignId, status });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Delete a campaign (soft delete by setting status to 'deleted' or hard delete)
     */
    async deleteCampaign(campaignId, userId, hardDelete = false) {
        const client = await this.pool.connect();
        try {
            let query;
            let values;

            if (hardDelete) {
                // Hard delete - actually remove from database
                query = `
                    DELETE FROM campaigns
                    WHERE id = $1 AND created_by = $2
                    RETURNING id
                `;
                values = [campaignId, userId];
            } else {
                // Soft delete - just update status
                query = `
                    UPDATE campaigns
                    SET status = 'completed', updated_at = NOW()
                    WHERE id = $1 AND created_by = $2
                    RETURNING *
                `;
                values = [campaignId, userId];
            }

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error deleting campaign', { error: error.message, campaignId });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get campaign statistics
     */
    async getCampaignStats(campaignId, userId) {
        const client = await this.pool.connect();
        try {
            const query = `
                SELECT
                    c.id,
                    c.name,
                    c.budget_total,
                    c.budget_spent,
                    COALESCE(SUM(cds.impressions), 0) as total_impressions,
                    COALESCE(SUM(cds.clicks), 0) as total_clicks,
                    COALESCE(SUM(cds.completions), 0) as total_completions,
                    COALESCE(SUM(cds.spend), 0) as total_spend,
                    CASE
                        WHEN SUM(cds.impressions) > 0
                        THEN ROUND(SUM(cds.clicks)::numeric / SUM(cds.impressions) * 100, 2)
                        ELSE 0
                    END as ctr,
                    CASE
                        WHEN SUM(cds.impressions) > 0
                        THEN ROUND(SUM(cds.completions)::numeric / SUM(cds.impressions) * 100, 2)
                        ELSE 0
                    END as completion_rate
                FROM campaigns c
                LEFT JOIN campaign_daily_stats cds ON cds.campaign_id = c.id
                WHERE c.id = $1 AND c.created_by = $2
                GROUP BY c.id, c.name, c.budget_total, c.budget_spent
            `;

            const result = await client.query(query, [campaignId, userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error fetching campaign stats', { error: error.message, campaignId });
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

module.exports = new CampaignService();