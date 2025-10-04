/**
 * Campaign route error handling tests
 * Ensures 5xx responses are returned when the underlying service throws.
 */

const request = require('supertest');
const app = require('../src/app');
const campaignService = require('../src/services/campaignService');

describe('Campaign Routes - Error Handling', () => {
    let testUser;
    let authToken;

    const authHeader = () => ({ 'Authorization': `Bearer ${authToken}` });

    const validCampaignPayload = {
        name: 'Error Path Campaign',
        description: 'Triggering error path',
        budget_total: 1000,
        start_date: '2025-01-01T00:00:00.000Z',
        end_date: '2025-12-31T00:00:00.000Z',
        pricing_model: 'cpm',
        cpm_rate: 5.00
    };

    beforeEach(async () => {
        testUser = await global.testUtils.createTestUser({
            email: `campaign-error-${Date.now()}@example.com`
        });

        authToken = global.testUtils.generateTestToken({
            id: testUser.id,
            email: testUser.email,
            role: testUser.role
        });
    });

    afterEach(async () => {
        if (testUser) {
            await global.testUtils.deleteTestUser(testUser.id);
            testUser = null;
            authToken = null;
        }

        jest.restoreAllMocks();
    });

    it('returns 500 when listing campaigns fails', async () => {
        jest.spyOn(campaignService, 'getCampaigns').mockRejectedValueOnce(new Error('db failure'));

        const response = await request(app)
            .get('/api/v1/campaigns')
            .set(authHeader())
            .expect(500);

        expect(response.body.error.code).toBe('CAMPAIGNS_RETRIEVAL_FAILED');
    });

    it('returns 500 when fetching a campaign fails', async () => {
        jest.spyOn(campaignService, 'getCampaignById').mockRejectedValueOnce(new Error('lookup failed'));

        const response = await request(app)
            .get('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440000')
            .set(authHeader())
            .expect(500);

        expect(response.body.error.code).toBe('CAMPAIGN_RETRIEVAL_FAILED');
    });

    it('returns 500 when campaign creation fails', async () => {
        jest.spyOn(campaignService, 'createCampaign').mockRejectedValueOnce(new Error('insert failed'));

        const response = await request(app)
            .post('/api/v1/campaigns')
            .set(authHeader())
            .send(validCampaignPayload)
            .expect(500);

        expect(response.body.error.code).toBe('CAMPAIGN_CREATION_FAILED');
    });

    it('returns 500 when campaign update fails', async () => {
        jest.spyOn(campaignService, 'updateCampaign').mockRejectedValueOnce(new Error('update failed'));

        const response = await request(app)
            .put('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440001')
            .set(authHeader())
            .send({ name: 'Updated' })
            .expect(500);

        expect(response.body.error.code).toBe('CAMPAIGN_UPDATE_FAILED');
    });

    it('returns 500 when campaign status update fails', async () => {
        jest.spyOn(campaignService, 'updateCampaignStatus').mockRejectedValueOnce(new Error('status update failed'));

        const response = await request(app)
            .put('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440002/status')
            .set(authHeader())
            .send({ status: 'active' })
            .expect(500);

        expect(response.body.error.code).toBe('STATUS_UPDATE_FAILED');
    });

    it('returns 500 when campaign deletion fails', async () => {
        jest.spyOn(campaignService, 'deleteCampaign').mockRejectedValueOnce(new Error('delete failed'));

        const response = await request(app)
            .delete('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440003')
            .set(authHeader())
            .expect(500);

        expect(response.body.error.code).toBe('CAMPAIGN_DELETION_FAILED');
    });

    it('returns 500 when retrieving campaign stats fails', async () => {
        jest.spyOn(campaignService, 'getCampaignStats').mockRejectedValueOnce(new Error('stats failed'));

        const response = await request(app)
            .get('/api/v1/campaigns/550e8400-e29b-41d4-a716-446655440004/stats')
            .set(authHeader())
            .expect(500);

        expect(response.body.error.code).toBe('STATS_RETRIEVAL_FAILED');
    });
});
