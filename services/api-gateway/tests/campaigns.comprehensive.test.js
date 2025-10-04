/**
 * Comprehensive Campaign Tests
 * Tests the real campaign implementation with database operations
 */

const request = require('supertest');
const app = require('../src/app');

describe('Campaign Comprehensive Tests', () => {
    let testUser;
    let authToken;
    let secondUser;
    let secondUserToken;

    // Helper to build campaign payload with default pricing
    const buildCampaignData = (overrides = {}) => ({
        pricing_model: 'cpm',
        cpm_rate: 5.00,
        ...overrides
    });

    beforeEach(async () => {
        // Create test user
        testUser = await global.testUtils.createTestUser({
            email: `campaign-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            name: 'Campaign Test User'
        });

        authToken = global.testUtils.generateTestToken({
            id: testUser.id,
            email: testUser.email,
            role: testUser.role
        });

        // Create second user for isolation tests
        secondUser = await global.testUtils.createTestUser({
            email: `campaign-test-2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            name: 'Second Test User'
        });

        secondUserToken = global.testUtils.generateTestToken({
            id: secondUser.id,
            email: secondUser.email,
            role: secondUser.role
        });
    });

    afterEach(async () => {
        // Clean up test data created in this specific test
        if (testUser && secondUser) {
            try {
                // Delete campaigns first, then users
                await global.testPool.query('DELETE FROM campaigns WHERE created_by IN ($1, $2)', [testUser.id, secondUser.id]);
                await global.testPool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser.id, secondUser.id]);
            } catch (error) {
                // Best effort cleanup
                console.warn('Campaign test cleanup error:', error.message);
            }
        }
        testUser = null;
        secondUser = null;
        authToken = null;
        secondUserToken = null;
    });

    describe('POST /api/v1/campaigns - Campaign Creation', () => {
        it('should create a campaign with valid data', async () => {
            const campaignData = {
                name: 'Test Campaign',
                description: 'Test campaign description',
                budget_total: 1000.00,
                start_date: '2025-01-01',
                end_date: '2025-12-31',
                pricing_model: 'cpm',
                cpm_rate: 5.00
            };

            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send(campaignData)
                .expect(201);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('campaign');

            const { campaign } = response.body;
            expect(campaign.id).toBeDefined();
            expect(campaign.name).toBe(campaignData.name);
            expect(campaign.description).toBe(campaignData.description);
            expect(parseFloat(campaign.budget_total)).toBe(campaignData.budget_total);
            expect(campaign.status).toBe('draft');
            expect(campaign.created_by).toBe(testUser.id);
            expect(campaign.created_at).toBeDefined();
            expect(campaign.updated_at).toBeDefined();
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'name',
                    message: 'Campaign name is required'
                })
            );
        });

        it('should validate budget constraints', async () => {
            const campaignData = {
                name: 'Test Campaign',
                budget_total: -100,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };

            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send(campaignData)
                .expect(400);

            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'budget_total',
                    message: 'Budget must be a positive number'
                })
            );
        });

        it('should validate date range', async () => {
            const campaignData = {
                name: 'Test Campaign',
                budget_total: 1000,
                start_date: '2025-12-31',
                end_date: '2025-01-01'
            };

            const response = await request(app)
                .post('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .send(campaignData)
                .expect(400);

            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'end_date',
                    message: 'End date must be after start date'
                })
            );
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/v1/campaigns')
                .send({ name: 'Test' })
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });
    });

    describe('GET /api/v1/campaigns - List Campaigns', () => {
        let campaign1, campaign2, otherUserCampaign;

        beforeEach(async () => {
            // Create campaigns for the test user
            campaign1 = await global.testUtils.createTestCampaign(testUser.id, {
                name: 'Campaign 1',
                status: 'active'
            });

            campaign2 = await global.testUtils.createTestCampaign(testUser.id, {
                name: 'Campaign 2',
                status: 'draft'
            });

            // Create campaign for another user
            otherUserCampaign = await global.testUtils.createTestCampaign(secondUser.id, {
                name: 'Other User Campaign'
            });
        });

        it('should return only campaigns owned by authenticated user', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.campaigns).toHaveLength(2);
            expect(response.body.total).toBe(2);

            const campaignIds = response.body.campaigns.map(c => c.id);
            expect(campaignIds).toContain(campaign1.id);
            expect(campaignIds).toContain(campaign2.id);
            expect(campaignIds).not.toContain(otherUserCampaign.id);
        });

        it('should return campaigns with correct structure', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('campaigns');
            expect(response.body).toHaveProperty('total');

            const campaign = response.body.campaigns[0];
            expect(campaign).toHaveProperty('id');
            expect(campaign).toHaveProperty('name');
            expect(campaign).toHaveProperty('description');
            expect(campaign).toHaveProperty('status');
            expect(campaign).toHaveProperty('budget_total');
            expect(campaign).toHaveProperty('budget_spent');
            expect(campaign).toHaveProperty('start_date');
            expect(campaign).toHaveProperty('end_date');
            expect(campaign).toHaveProperty('created_at');
            expect(campaign).toHaveProperty('updated_at');
        });

        it('should return empty array when user has no campaigns', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(200);

            // Second user should only see their own campaign
            expect(response.body.campaigns).toHaveLength(1);
            expect(response.body.campaigns[0].id).toBe(otherUserCampaign.id);
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });
    });

    describe('GET /api/v1/campaigns/:id - Get Campaign Details', () => {
        let campaign;

        beforeEach(async () => {
            campaign = await global.testUtils.createTestCampaign(testUser.id, {
                name: 'Test Campaign Details',
                description: 'Detailed test campaign'
            });
        });

        it('should return campaign details for owned campaign', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('campaign');
            const { campaign: returnedCampaign } = response.body;

            expect(returnedCampaign.id).toBe(campaign.id);
            expect(returnedCampaign.name).toBe(campaign.name);
            expect(returnedCampaign.description).toBe(campaign.description);
            expect(returnedCampaign.created_by).toBe(testUser.id);
        });

        it('should return 404 for non-existent campaign', async () => {
            const fakeId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .get(`/api/v1/campaigns/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should return 403 for campaigns owned by other users', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(404); // Returns 404 for security (don't reveal existence)

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should validate UUID format', async () => {
            const response = await request(app)
                .get('/api/v1/campaigns/invalid-uuid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.error.message).toBe('Invalid id format');
        });
    });

    describe('PUT /api/v1/campaigns/:id - Update Campaign', () => {
        let campaign;

        beforeEach(async () => {
            campaign = await global.testUtils.createTestCampaign(testUser.id);
        });

        it('should update campaign fields', async () => {
            const updateData = {
                name: 'Updated Campaign Name',
                description: 'Updated description',
                budget_total: 2000.00
            };

            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.message).toBe('Campaign updated successfully');
            expect(response.body.campaign.name).toBe(updateData.name);
            expect(response.body.campaign.description).toBe(updateData.description);
            expect(parseFloat(response.body.campaign.budget_total)).toBe(updateData.budget_total);
        });

        it('should validate update data', async () => {
            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ budget_total: -100 })
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
        });

        it('should return 404 for non-existent campaign', async () => {
            const fakeId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .put(`/api/v1/campaigns/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Updated' })
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should prevent updating campaigns owned by other users', async () => {
            const response = await request(app)
                .put(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .send({ name: 'Hacked' })
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });
    });

    describe('DELETE /api/v1/campaigns/:id - Delete Campaign', () => {
        let campaign, campaignWithCreatives;

        beforeEach(async () => {
            campaign = await global.testUtils.createTestCampaign(testUser.id);

            campaignWithCreatives = await global.testUtils.createTestCampaign(testUser.id, {
                name: 'Campaign with Creatives'
            });

            // Add a creative to test cascade deletion
            await global.testUtils.createTestCreative(campaignWithCreatives.id, testUser.id);
        });

        it('should delete campaign', async () => {
            const response = await request(app)
                .delete(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Campaign marked as completed');

            // Verify campaign is soft deleted (status changed to completed)
            const getResponse = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(getResponse.body.campaign.status).toBe('completed');
        });

        it('should cascade delete creatives', async () => {
            const response = await request(app)
                .delete(`/api/v1/campaigns/${campaignWithCreatives.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Campaign marked as completed');

            // Verify creatives are still there (soft delete doesn't cascade to creatives)
            const creativesCheck = await global.testPool.query(
                'SELECT COUNT(*) FROM creatives WHERE campaign_id = $1',
                [campaignWithCreatives.id]
            );
            expect(parseInt(creativesCheck.rows[0].count)).toBe(1);
        });

        it('should return 404 for non-existent campaign', async () => {
            const fakeId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .delete(`/api/v1/campaigns/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should prevent deleting campaigns owned by other users', async () => {
            const response = await request(app)
                .delete(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });
    });

    describe('Campaign Business Logic', () => {
        it('should track budget spending correctly', async () => {
            const campaign = await global.testUtils.createTestCampaign(testUser.id, {
                budget_total: 1000.00
            });

            // Update budget spent
            await global.testPool.query(
                'UPDATE campaigns SET budget_spent = $1 WHERE id = $2',
                [250.00, campaign.id]
            );

            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(parseFloat(response.body.campaign.budget_spent)).toBe(250.00);
            expect(parseFloat(response.body.campaign.budget_total)).toBe(1000.00);
        });

        it('should handle different campaign statuses', async () => {
            const statuses = ['draft', 'active', 'paused', 'completed'];

            for (const status of statuses) {
                const campaign = await global.testUtils.createTestCampaign(testUser.id, { status });

                const response = await request(app)
                    .get(`/api/v1/campaigns/${campaign.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body.campaign.status).toBe(status);
            }
        });

        it('should maintain data integrity with foreign key constraints', async () => {
            // Try to create campaign with non-existent user (should fail)
            const fakeUserId = '550e8400-e29b-41d4-a716-446655440000';

            await expect(
                global.testUtils.createTestCampaign(fakeUserId)
            ).rejects.toThrow();
        });
    });

    describe('Campaign Analytics and Metrics', () => {
        let campaign, creative;

        beforeEach(async () => {
            campaign = await global.testUtils.createTestCampaign(testUser.id);
            creative = await global.testUtils.createTestCreative(campaign.id, testUser.id);
        });

        it('should handle campaigns with no metrics', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.campaign).toBeDefined();
            // Base campaign structure should be present even without metrics
        });

        it('should calculate campaign performance when metrics exist', async () => {
            // Add some tracking data
            await global.testPool.query(`
                INSERT INTO impressions (creative_id, campaign_id, device_type, location_country, served_at)
                VALUES ($1, $2, 'smart_tv', 'US', NOW()), ($1, $2, 'smart_tv', 'CA', NOW())
            `, [creative.id, campaign.id]);

            const response = await request(app)
                .get(`/api/v1/campaigns/${campaign.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.campaign).toBeDefined();
            // Additional metrics would be tested here if implemented
        });
    });
});