/**
 * Integration tests for analytics endpoints.
 * Tests real database aggregation queries and data calculations.
 */

const request = require('supertest');
const app = require('../src/app');

describe('Analytics Integration Tests', () => {
    let testUser;
    let authToken;
    let testCampaign;

    const createTestUser = async () => {
        const userData = {
            email: `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            password: 'testpassword123',
            name: 'Analytics Test User',
            role: 'advertiser'
        };

        const response = await request(app)
            .post('/api/v1/auth/register')
            .send(userData)
            .expect(201);

        return {
            user: response.body.user,
            token: response.body.tokens.accessToken
        };
    };

    const createTestCampaign = async (overrides = {}) => {
        // Extract status to set separately
        const { status, ...safeOverrides } = overrides;
        const payload = {
            name: `Analytics Campaign ${Date.now()}`,
            description: 'Test campaign for analytics',
            budget_total: 10000,
            start_date: '2025-01-01T00:00:00.000Z',
            end_date: '2025-12-31T00:00:00.000Z',
            pricing_model: 'cpm',
            cpm_rate: 5.00,
            ...safeOverrides
        };

        const response = await request(app)
            .post('/api/v1/campaigns')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201);

        const campaign = response.body.campaign;

        // Update status if provided (campaigns start as 'draft')
        if (status && status !== 'draft') {
            await request(app)
                .put(`/api/v1/campaigns/${campaign.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status })
                .expect(200);

            campaign.status = status;
        }

        return campaign;
    };

    const createCampaignStats = async (campaignId, statDate, impressions, clicks = 0, completions = 0, spend = 0) => {
        await global.testPool.query(
            `INSERT INTO campaign_daily_stats
            (campaign_id, date, impressions_count, clicks_count, completions_count, spend_amount)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [campaignId, statDate, impressions, clicks, completions, spend]
        );
    };

    beforeEach(async () => {
        const { user, token } = await createTestUser();
        testUser = user;
        authToken = token;
    });

    afterEach(async () => {
        if (testUser) {
            // Clean up in correct order to respect foreign keys
            await global.testPool.query('DELETE FROM campaign_daily_stats WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by = $1)', [testUser.id]);
            await global.testPool.query('DELETE FROM impressions WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by = $1)', [testUser.id]);
            await global.testPool.query('DELETE FROM creatives WHERE uploaded_by = $1', [testUser.id]);
            await global.testPool.query('DELETE FROM campaigns WHERE created_by = $1', [testUser.id]);
            await global.testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
            testUser = null;
            authToken = null;
            testCampaign = null;
        }
    });

    describe('GET /api/v1/analytics/summary', () => {
        it('returns summary analytics with correct structure', async () => {
            // Create test campaigns with different statuses
            const activeCampaign = await createTestCampaign({ status: 'active', budget_total: 5000 });
            const pausedCampaign = await createTestCampaign({ status: 'paused', budget_total: 3000 });

            // Update budget_spent via database (it's server-managed)
            await global.testPool.query('UPDATE campaigns SET budget_spent = $1 WHERE id = $2', [1000, activeCampaign.id]);
            await global.testPool.query('UPDATE campaigns SET budget_spent = $1 WHERE id = $2', [500, pausedCampaign.id]);

            // Add some stats
            await createCampaignStats(activeCampaign.id, '2025-01-15', 1000, 50, 800, 100);
            await createCampaignStats(activeCampaign.id, '2025-01-16', 1500, 75, 1200, 150);
            await createCampaignStats(pausedCampaign.id, '2025-01-15', 500, 25, 400, 50);

            const response = await request(app)
                .get('/api/v1/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Verify structure
            expect(response.body).toHaveProperty('summary');
            expect(response.body).toHaveProperty('timeSeries');
            expect(response.body).toHaveProperty('topCampaigns');

            // Verify summary metrics
            const { summary } = response.body;
            expect(summary.totalCampaigns).toBe(2);
            expect(summary.activeCampaigns).toBe(1);
            expect(summary.pausedCampaigns).toBe(1);
            expect(summary.totalBudget).toBe(8000);
            expect(summary.totalSpent).toBe(1500);
            expect(summary.budgetRemaining).toBe(6500);
            expect(summary.totalImpressions).toBe(3000);
            expect(summary.totalClicks).toBe(150);
            expect(summary.totalCompletions).toBe(2400);

            // Verify CTR calculation
            expect(summary.ctr).toBe(5.00); // 150/3000 * 100 = 5%

            // Verify completion rate
            expect(summary.completionRate).toBe(80.00); // 2400/3000 * 100 = 80%

            // Verify budget utilization
            expect(summary.budgetUtilization).toBe(18.75); // 1500/8000 * 100 = 18.75%
        });

        it('returns empty data for user with no campaigns', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.summary.totalCampaigns).toBe(0);
            expect(response.body.summary.totalImpressions).toBe(0);
            expect(response.body.timeSeries).toEqual([]);
            expect(response.body.topCampaigns).toEqual([]);
        });

        it('filters analytics by date range', async () => {
            const campaign = await createTestCampaign();

            // Create stats for different dates
            await createCampaignStats(campaign.id, '2025-01-10', 100);
            await createCampaignStats(campaign.id, '2025-01-15', 200);
            await createCampaignStats(campaign.id, '2025-01-20', 300);
            await createCampaignStats(campaign.id, '2025-01-25', 400);

            // Filter for Jan 15-20
            const response = await request(app)
                .get('/api/v1/analytics/summary?start_date=2025-01-15&end_date=2025-01-20')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Should only include stats from Jan 15 and Jan 20
            expect(response.body.summary.totalImpressions).toBe(500);
            expect(response.body.timeSeries).toHaveLength(2);
        });

        it('returns time series data in correct format', async () => {
            const campaign = await createTestCampaign();

            await createCampaignStats(campaign.id, '2025-01-15', 1000, 50, 800, 100);
            await createCampaignStats(campaign.id, '2025-01-16', 1500, 75, 1200, 150);

            const response = await request(app)
                .get('/api/v1/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.timeSeries).toHaveLength(2);
            expect(response.body.timeSeries[0]).toMatchObject({
                date: expect.any(String),
                impressions: expect.any(Number),
                clicks: expect.any(Number),
                completions: expect.any(Number),
                spend: expect.any(Number)
            });
        });

        it('returns top campaigns sorted by impressions', async () => {
            const campaign1 = await createTestCampaign({ name: 'Low Traffic' });
            const campaign2 = await createTestCampaign({ name: 'High Traffic' });
            const campaign3 = await createTestCampaign({ name: 'Medium Traffic' });

            await createCampaignStats(campaign1.id, '2025-01-15', 100);
            await createCampaignStats(campaign2.id, '2025-01-15', 1000);
            await createCampaignStats(campaign3.id, '2025-01-15', 500);

            const response = await request(app)
                .get('/api/v1/analytics/summary')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.topCampaigns).toHaveLength(3);
            expect(response.body.topCampaigns[0].impressions).toBe(1000);
            expect(response.body.topCampaigns[1].impressions).toBe(500);
            expect(response.body.topCampaigns[2].impressions).toBe(100);
        });

        it('rejects unauthorized requests', async () => {
            await request(app)
                .get('/api/v1/analytics/summary')
                .expect(401);
        });
    });

    describe('GET /api/v1/analytics/campaigns/:id', () => {
        beforeEach(async () => {
            testCampaign = await createTestCampaign();
        });

        it('returns campaign-specific analytics with daily breakdown', async () => {
            await createCampaignStats(testCampaign.id, '2025-01-15', 1000, 50, 800, 100);
            await createCampaignStats(testCampaign.id, '2025-01-16', 1500, 75, 1200, 150);

            const response = await request(app)
                .get(`/api/v1/analytics/campaigns/${testCampaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('dailyStats');
            expect(response.body).toHaveProperty('creativeBreakdown');

            expect(response.body.dailyStats).toHaveLength(2);
            expect(response.body.dailyStats[0]).toMatchObject({
                date: expect.any(String),
                impressions: 1000,
                clicks: 50,
                completions: 800,
                spend: 100,
                ctr: 5.00,
                completionRate: 80.00
            });
        });

        it('returns 404 for non-existent campaign', async () => {
            const response = await request(app)
                .get('/api/v1/analytics/campaigns/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('returns 404 for campaign owned by different user', async () => {
            // Create another user and their campaign
            const { user: otherUser, token: otherToken } = await createTestUser();

            const otherCampaign = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${otherToken}`)
                .send({
                    name: 'Other User Campaign',
                    budget_total: 5000,
                    start_date: '2025-01-01T00:00:00.000Z',
                    end_date: '2025-12-31T00:00:00.000Z',
                    pricing_model: 'cpm',
                    cpm_rate: 5.00
                })
                .expect(201);

            // Try to access other user's campaign analytics
            await request(app)
                .get(`/api/v1/analytics/campaigns/${otherCampaign.body.campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            // Cleanup
            await global.testPool.query('DELETE FROM campaigns WHERE created_by = $1', [otherUser.id]);
            await global.testPool.query('DELETE FROM users WHERE id = $1', [otherUser.id]);
        });

        it('filters campaign analytics by date range', async () => {
            await createCampaignStats(testCampaign.id, '2025-01-10', 100);
            await createCampaignStats(testCampaign.id, '2025-01-15', 200);
            await createCampaignStats(testCampaign.id, '2025-01-20', 300);

            const response = await request(app)
                .get(`/api/v1/analytics/campaigns/${testCampaign.id}?start_date=2025-01-15&end_date=2025-01-20`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.dailyStats).toHaveLength(2);
        });

        it('calculates CTR and completion rate correctly', async () => {
            await createCampaignStats(testCampaign.id, '2025-01-15', 2000, 100, 1500, 200);

            const response = await request(app)
                .get(`/api/v1/analytics/campaigns/${testCampaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const stats = response.body.dailyStats[0];
            expect(stats.ctr).toBe(5.00); // 100/2000 * 100
            expect(stats.completionRate).toBe(75.00); // 1500/2000 * 100
        });

        it('returns empty arrays for campaign with no stats', async () => {
            const response = await request(app)
                .get(`/api/v1/analytics/campaigns/${testCampaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.dailyStats).toEqual([]);
            expect(response.body.creativeBreakdown).toEqual([]);
        });

        it('rejects unauthorized requests', async () => {
            await request(app)
                .get(`/api/v1/analytics/campaigns/${testCampaign.id}`)
                .expect(401);
        });
    });
});
