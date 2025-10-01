/**
 * Integration tests for campaign endpoints.
 * Focuses on API contract behaviour using the real service implementation.
 */

const request = require('supertest');
const app = require('../src/app');

describe('Campaign Integration Tests', () => {
    let testUser;
    let authToken;

    const buildCampaignPayload = (overrides = {}) => ({
        name: `Integration Campaign ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: 'Integration test campaign',
        budget_total: 5000,
        start_date: '2025-01-01T00:00:00.000Z',
        end_date: '2025-12-31T00:00:00.000Z',
        ...overrides
    });

    const createCampaignViaApi = async (overrides = {}) => {
        const payload = buildCampaignPayload(overrides);
        const response = await request(app)
            .post('/api/v1/campaigns')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201);

        return response.body.campaign;
    };

    beforeEach(async () => {
        const userData = {
            email: `campaign-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            password: 'testpassword123',
            name: 'Campaign Integration User',
            role: 'advertiser'
        };

        const response = await request(app)
            .post('/api/v1/auth/register')
            .send(userData)
            .expect(201);

        testUser = response.body.user;
        authToken = response.body.tokens.accessToken;
    });

    afterEach(async () => {
        if (testUser) {
            await global.testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
            testUser = null;
            authToken = null;
        }
    });

    describe('GET /api/v1/campaigns', () => {
        it('returns campaigns with paging metadata and expected shape', async () => {
            const created = await Promise.all([
                createCampaignViaApi({ name: 'Campaign Alpha' }),
                createCampaignViaApi({ name: 'Campaign Beta' })
            ]);

            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toEqual(expect.objectContaining({
                campaigns: expect.any(Array),
                total: created.length,
                page: 1,
                limit: 20
            }));

            const campaign = response.body.campaigns[0];
            expect(campaign).toEqual(expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                status: expect.any(String),
                budget_total: expect.any(String),
                budget_spent: expect.any(String),
                start_date: expect.any(String),
                end_date: expect.any(String),
                created_by: testUser.id,
                created_at: expect.any(String),
                updated_at: expect.any(String),
                creative_count: expect.any(String),
                total_impressions: expect.any(String)
            }));

            expect(Number(campaign.budget_total)).toBeGreaterThan(0);
        });

        it('rejects unauthorized requests', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .expect(401);

            expect(response.body.error).toEqual(expect.objectContaining({
                message: 'Authorization token required',
                code: 'MISSING_TOKEN'
            }));
        });

        it('rejects invalid tokens', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_TOKEN');
        });

        it('includes request tracking headers', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.headers).toHaveProperty('x-request-id');
            expect(typeof response.headers['x-request-id']).toBe('string');
        });
    });

    describe('GET /api/v1/campaigns/:id', () => {
        it('returns campaign details with metrics for the owner', async () => {
            const campaign = await createCampaignViaApi();

            await global.testPool.query(
                `INSERT INTO campaign_daily_stats (campaign_id, stat_date, impressions, clicks, completions, spend)
                 VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
                [campaign.id, 1000, 125, 800, 432.50]
            );

            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('campaign');
            const { campaign: payload } = response.body;

            expect(payload.id).toBe(campaign.id);
            expect(payload.metrics).toEqual(expect.objectContaining({
                impressions: 1000,
                clicks: 125,
                ctr: expect.any(String),
                spend: expect.any(Number)
            }));
        });

        it('returns 404 for missing campaign', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440999')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('enforces authentication', async () => {
            await request(app)
                .get('/api/v1/campaigns/some-id')
                .expect(401);
        });
    });

    describe('POST /api/v1/campaigns', () => {
        it('creates a campaign when payload is valid', async () => {
            const payload = buildCampaignPayload();

            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send(payload)
                .expect(201);

            expect(response.body.message).toBe('Campaign created successfully');
            expect(response.body.campaign).toEqual(expect.objectContaining({
                id: expect.any(String),
                name: payload.name,
                status: 'draft',
                created_by: testUser.id
            }));
        });

        it('validates required fields', async () => {
            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.error).toEqual(expect.objectContaining({
                message: 'Validation failed'
            }));
        });

        it('requires authentication', async () => {
            await request(app)
                .post('/api/v1/campaigns')
                .send(buildCampaignPayload())
                .expect(401);
        });
    });

    describe('PUT /api/v1/campaigns/:id', () => {
        it('updates campaign fields for the owner', async () => {
            const campaign = await createCampaignViaApi({ name: 'Original Name' });

            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated Name' })
                .expect(200);

            expect(response.body).toEqual(expect.objectContaining({
                message: 'Campaign updated successfully'
            }));
            expect(response.body.campaign.name).toBe('Updated Name');
        });

        it('returns 404 when campaign does not exist for user', async () => {
            const otherUser = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: `campaign-other-${Date.now()}@example.com`,
                    password: 'testpassword123',
                    name: 'Other User'
                })
                .expect(201);

            const foreignCampaign = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${otherUser.body.tokens.accessToken}`)
                .send(buildCampaignPayload())
                .expect(201);

            const response = await request(app)
                .put(`/api/v1/campaigns/${foreignCampaign.body.campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Attempted Update' })
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');

            await global.testPool.query('DELETE FROM users WHERE id = $1', [otherUser.body.user.id]);
        });
    });

    describe('PUT /api/v1/campaigns/:id/status', () => {
        it('updates campaign status with valid value', async () => {
            const campaign = await createCampaignViaApi();

            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'active' })
                .expect(200);

            expect(response.body.message).toBe('Campaign status updated to active');
            expect(response.body.campaign.status).toBe('active');
        });

        it('validates status value', async () => {
            const campaign = await createCampaignViaApi();

            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'archived' })
                .expect(400);

            expect(response.body.error.details[0].message).toContain('Status must be one of');
        });
    });

    describe('DELETE /api/v1/campaigns/:id', () => {
        it('performs a soft delete by default', async () => {
            const campaign = await createCampaignViaApi();

            const response = await request(app)
                .delete(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Campaign marked as completed');
            expect(response.body.campaignId).toBe(campaign.id);
        });

        it('supports hard delete when requested', async () => {
            const campaign = await createCampaignViaApi();

            const response = await request(app)
                .delete(`/api/v1/campaigns/${campaign.id}?hard=true`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Campaign permanently deleted');
            expect(response.body.campaignId).toBe(campaign.id);
        });
    });

    describe('GET /api/v1/campaigns/:id/stats', () => {
        it('returns aggregated statistics for campaign', async () => {
            const campaign = await createCampaignViaApi();

            await global.testPool.query(
                `INSERT INTO campaign_daily_stats (campaign_id, stat_date, impressions, clicks, completions, spend)
                 VALUES ($1, CURRENT_DATE, 2000, 250, 1500, 900.75)`,
                [campaign.id]
            );

            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}/stats`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.stats).toEqual(expect.objectContaining({
                id: campaign.id,
                name: campaign.name,
                total_impressions: '2000',
                total_clicks: '250',
                total_completions: '1500',
                total_spend: '900.75',
                ctr: expect.any(String),
                completion_rate: expect.any(String)
            }));
        });

        it('returns 404 when campaign stats not available', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440998/stats')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });
    });
});
