const { Pool } = require('pg');
const logger = require('../utils/logger');

class AnalyticsService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://adserver:dev_password@localhost:5432/adserver_dev'
        });
    }

    /**
     * Get summary analytics (overall user analytics)
     */
    async getSummaryAnalytics(userId, options = {}) {
        const client = await this.pool.connect();
        try {
            const { startDate, endDate } = options;

            // Build date filter
            let dateFilter = '';
            const params = [userId];
            let paramIndex = 2;

            if (startDate) {
                dateFilter += ` AND cds.date >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }

            if (endDate) {
                dateFilter += ` AND cds.date <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }

            // Get campaign-level metrics
            const campaignQuery = `
                SELECT
                    COUNT(c.id) as total_campaigns,
                    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_campaigns,
                    COUNT(CASE WHEN c.status = 'paused' THEN 1 END) as paused_campaigns,
                    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_campaigns,
                    COALESCE(SUM(c.budget_total), 0) as total_budget,
                    COALESCE(SUM(c.budget_spent), 0) as total_spent
                FROM campaigns c
                WHERE c.created_by = $1
            `;

            const campaignResult = await client.query(campaignQuery, [userId]);
            const campaignMetrics = campaignResult.rows[0];

            // Get stats metrics (with date filter if provided)
            const statsQuery = `
                SELECT
                    COALESCE(SUM(cds.impressions_count), 0) as total_impressions,
                    COALESCE(SUM(cds.clicks_count), 0) as total_clicks,
                    COALESCE(SUM(cds.completions_count), 0) as total_completions
                FROM campaign_daily_stats cds
                JOIN campaigns c ON c.id = cds.campaign_id
                WHERE c.created_by = $1 ${dateFilter}
            `;

            const statsResult = await client.query(statsQuery, params);
            const statsMetrics = statsResult.rows[0];

            // Combine metrics
            const overall = {
                ...campaignMetrics,
                ...statsMetrics
            };

            // Calculate derived metrics
            const ctr = overall.total_impressions > 0
                ? ((overall.total_clicks / overall.total_impressions) * 100).toFixed(2)
                : 0;

            const completionRate = overall.total_impressions > 0
                ? ((overall.total_completions / overall.total_impressions) * 100).toFixed(2)
                : 0;

            const budgetUtilization = overall.total_budget > 0
                ? ((overall.total_spent / overall.total_budget) * 100).toFixed(2)
                : 0;

            // Get impressions over time (daily)
            const timeSeriesQuery = `
                SELECT
                    cds.date as date,
                    COALESCE(SUM(cds.impressions_count), 0) as impressions,
                    COALESCE(SUM(cds.clicks_count), 0) as clicks,
                    COALESCE(SUM(cds.completions_count), 0) as completions,
                    COALESCE(SUM(cds.spend_amount), 0) as spend
                FROM campaign_daily_stats cds
                JOIN campaigns c ON c.id = cds.campaign_id
                WHERE c.created_by = $1 ${dateFilter}
                GROUP BY cds.date
                ORDER BY cds.date ASC
            `;

            const timeSeriesResult = await client.query(timeSeriesQuery, params);

            // Get top performing campaigns
            const topCampaignsQuery = `
                SELECT
                    c.id,
                    c.name,
                    c.status,
                    c.budget_total,
                    c.budget_spent,
                    COALESCE(SUM(cds.impressions_count), 0) as impressions,
                    COALESCE(SUM(cds.clicks_count), 0) as clicks,
                    COALESCE(SUM(cds.spend_amount), 0) as spend,
                    CASE
                        WHEN SUM(cds.impressions_count) > 0
                        THEN ROUND(SUM(cds.clicks_count)::numeric / SUM(cds.impressions_count) * 100, 2)
                        ELSE 0
                    END as ctr
                FROM campaigns c
                LEFT JOIN campaign_daily_stats cds ON cds.campaign_id = c.id ${dateFilter}
                WHERE c.created_by = $1
                GROUP BY c.id, c.name, c.status, c.budget_total, c.budget_spent
                ORDER BY impressions DESC
                LIMIT 10
            `;

            const topCampaignsResult = await client.query(topCampaignsQuery, params);

            return {
                summary: {
                    totalCampaigns: parseInt(overall.total_campaigns) || 0,
                    activeCampaigns: parseInt(overall.active_campaigns) || 0,
                    pausedCampaigns: parseInt(overall.paused_campaigns) || 0,
                    completedCampaigns: parseInt(overall.completed_campaigns) || 0,
                    totalBudget: parseFloat(overall.total_budget) || 0,
                    totalSpent: parseFloat(overall.total_spent) || 0,
                    budgetRemaining: (parseFloat(overall.total_budget) || 0) - (parseFloat(overall.total_spent) || 0),
                    budgetUtilization: parseFloat(budgetUtilization),
                    totalImpressions: parseInt(overall.total_impressions) || 0,
                    totalClicks: parseInt(overall.total_clicks) || 0,
                    totalCompletions: parseInt(overall.total_completions) || 0,
                    ctr: parseFloat(ctr),
                    completionRate: parseFloat(completionRate)
                },
                timeSeries: timeSeriesResult.rows.map(row => ({
                    date: row.date,
                    impressions: parseInt(row.impressions) || 0,
                    clicks: parseInt(row.clicks) || 0,
                    completions: parseInt(row.completions) || 0,
                    spend: parseFloat(row.spend) || 0
                })),
                topCampaigns: topCampaignsResult.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    status: row.status,
                    budgetTotal: parseFloat(row.budget_total) || 0,
                    budgetSpent: parseFloat(row.budget_spent) || 0,
                    impressions: parseInt(row.impressions) || 0,
                    clicks: parseInt(row.clicks) || 0,
                    spend: parseFloat(row.spend) || 0,
                    ctr: parseFloat(row.ctr) || 0
                }))
            };
        } catch (error) {
            logger.error('Error fetching summary analytics', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get campaign-specific analytics with daily breakdown
     */
    async getCampaignAnalytics(campaignId, userId, options = {}) {
        const client = await this.pool.connect();
        try {
            const { startDate, endDate } = options;

            // Verify campaign ownership
            const ownershipQuery = `
                SELECT id FROM campaigns WHERE id = $1 AND created_by = $2
            `;
            const ownershipResult = await client.query(ownershipQuery, [campaignId, userId]);

            if (ownershipResult.rows.length === 0) {
                return null;
            }

            // Build date filter
            let dateFilter = '';
            const params = [campaignId];
            let paramIndex = 2;

            if (startDate) {
                dateFilter += ` AND cds.date >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }

            if (endDate) {
                dateFilter += ` AND cds.date <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }

            // Get daily stats
            const dailyStatsQuery = `
                SELECT
                    cds.date as date,
                    COALESCE(cds.impressions_count, 0) as impressions,
                    COALESCE(cds.clicks_count, 0) as clicks,
                    COALESCE(cds.completions_count, 0) as completions,
                    COALESCE(cds.spend_amount, 0) as spend,
                    CASE
                        WHEN cds.impressions_count > 0
                        THEN ROUND(cds.clicks_count::numeric / cds.impressions_count * 100, 2)
                        ELSE 0
                    END as ctr,
                    CASE
                        WHEN cds.impressions_count > 0
                        THEN ROUND(cds.completions_count::numeric / cds.impressions_count * 100, 2)
                        ELSE 0
                    END as completion_rate
                FROM campaign_daily_stats cds
                WHERE cds.campaign_id = $1 ${dateFilter}
                ORDER BY cds.date ASC
            `;

            const dailyStatsResult = await client.query(dailyStatsQuery, params);

            // Get creative-level breakdown
            const creativeStatsQuery = `
                SELECT
                    cr.id,
                    cr.name,
                    cr.video_url,
                    cr.status,
                    COUNT(i.id) as impressions,
                    COALESCE(SUM(CASE WHEN i.completed THEN 1 ELSE 0 END), 0) as completions
                FROM creatives cr
                LEFT JOIN impressions i ON i.creative_id = cr.id ${dateFilter.replaceAll('cds.date', 'i.served_at::date')}
                WHERE cr.campaign_id = $1
                GROUP BY cr.id, cr.name, cr.video_url, cr.status
                ORDER BY impressions DESC
            `;

            const creativeStatsResult = await client.query(creativeStatsQuery, params);

            return {
                dailyStats: dailyStatsResult.rows.map(row => ({
                    date: row.date,
                    impressions: parseInt(row.impressions) || 0,
                    clicks: parseInt(row.clicks) || 0,
                    completions: parseInt(row.completions) || 0,
                    spend: parseFloat(row.spend) || 0,
                    ctr: parseFloat(row.ctr) || 0,
                    completionRate: parseFloat(row.completion_rate) || 0
                })),
                creativeBreakdown: creativeStatsResult.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    videoUrl: row.video_url,
                    status: row.status,
                    impressions: parseInt(row.impressions) || 0,
                    completions: parseInt(row.completions) || 0,
                    completionRate: parseInt(row.impressions) > 0
                        ? ((parseInt(row.completions) / parseInt(row.impressions)) * 100).toFixed(2)
                        : 0
                }))
            };
        } catch (error) {
            logger.error('Error fetching campaign analytics', { error: error.message, campaignId });
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

module.exports = new AnalyticsService();
