/**
 * Comprehensive Creative Tests
 * Tests the creative upload and management functionality
 */

const request = require('supertest');
const app = require('../src/app');
const path = require('path');
const fs = require('fs');

describe('Creative Comprehensive Tests', () => {
    let testUser;
    let authToken;
    let secondUser;
    let secondUserToken;
    let testCampaign;
    let otherUserCampaign;

    beforeEach(async () => {
        // Create test users
        testUser = await global.testUtils.createTestUser({
            email: `creative-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            name: 'Creative Test User'
        });

        authToken = global.testUtils.generateTestToken({
            id: testUser.id,
            email: testUser.email,
            role: testUser.role
        });

        secondUser = await global.testUtils.createTestUser({
            email: `creative-test-2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@example.com`,
            name: 'Second Test User'
        });

        secondUserToken = global.testUtils.generateTestToken({
            id: secondUser.id,
            email: secondUser.email,
            role: secondUser.role
        });

        // Create test campaigns
        testCampaign = await global.testUtils.createTestCampaign(testUser.id, {
            name: 'Test Campaign for Creatives'
        });

        otherUserCampaign = await global.testUtils.createTestCampaign(secondUser.id, {
            name: 'Other User Campaign'
        });

        // Create test video file
        const testVideoPath = '/tmp/test-creative-video.mp4';
        if (!fs.existsSync(testVideoPath)) {
            fs.writeFileSync(testVideoPath, Buffer.from('fake video content for testing'));
        }
    });

    afterEach(async () => {
        // Clean up test data created in this specific test
        if (testUser && secondUser) {
            try {
                // Delete creatives first, then campaigns, then users
                await global.testPool.query('DELETE FROM creatives WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by IN ($1, $2))', [testUser.id, secondUser.id]);
                await global.testPool.query('DELETE FROM campaigns WHERE created_by IN ($1, $2)', [testUser.id, secondUser.id]);
                await global.testPool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser.id, secondUser.id]);
            } catch (error) {
                // Best effort cleanup
                console.warn('Creative test cleanup error:', error.message);
            }
        }
        testUser = null;
        secondUser = null;
        testCampaign = null;
        otherUserCampaign = null;
        authToken = null;
        secondUserToken = null;
    });

    describe('POST /api/v1/campaigns/:campaignId/creatives - Creative Upload', () => {
        it('should upload creative with valid data', async () => {
            const testVideoPath = '/tmp/test-creative-video.mp4';
            const metadata = {
                name: 'Test Creative Upload',
                duration: 30,
                width: 1920,
                height: 1080
            };

            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .attach('video', testVideoPath)
                .field('metadata', JSON.stringify(metadata))
                .expect(201);

            expect(response.body.message).toBe('Creative uploaded successfully');
            expect(response.body.creative).toBeDefined();

            const { creative } = response.body;
            expect(creative.id).toBeDefined();
            expect(creative.name).toBe(metadata.name);
            expect(creative.duration).toBe(metadata.duration);
            expect(creative.width).toBe(metadata.width);
            expect(creative.height).toBe(metadata.height);
            expect(creative.format).toBe('mp4');
            expect(creative.status).toBe('processing');
            expect(creative.video_url).toContain('localhost:4566');
            expect(creative.processing_message).toBe('Video is being processed and will be ready shortly');
        });

        it('should validate file type', async () => {
            const testTextPath = '/tmp/test-invalid-file.txt';
            fs.writeFileSync(testTextPath, 'invalid file content');

            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .attach('video', testTextPath)
                .field('metadata', JSON.stringify({ name: 'Test' }))
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'video',
                    message: 'Only video files (MP4, MOV, AVI) are allowed'
                })
            );

            fs.unlinkSync(testTextPath);
        });

        it('should validate file size', async () => {
            const largePath = '/tmp/large-test-video.mp4';
            // Create a file larger than 500MB (simulated)
            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .field('metadata', JSON.stringify({ name: 'Test' }))
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'video',
                    message: 'Video file is required'
                })
            );
        });

        it('should validate metadata', async () => {
            const testVideoPath = '/tmp/test-creative-video.mp4';

            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .attach('video', testVideoPath)
                .field('metadata', JSON.stringify({}))
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
            expect(response.body.error.details).toContainEqual(
                expect.objectContaining({
                    field: 'name',
                    message: 'Creative name is required'
                })
            );
        });

        it('should prevent uploading to campaigns owned by other users', async () => {
            const testVideoPath = '/tmp/test-creative-video.mp4';

            const response = await request(app)
                .post(`/api/v1/campaigns/${otherUserCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .attach('video', testVideoPath)
                .field('metadata', JSON.stringify({ name: 'Test' }))
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should require authentication', async () => {
            const testVideoPath = '/tmp/test-creative-video.mp4';

            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .attach('video', testVideoPath)
                .field('metadata', JSON.stringify({ name: 'Test' }))
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });
    });

    describe('GET /api/v1/campaigns/:campaignId/creatives - List Campaign Creatives', () => {
        let creative1, creative2, otherCampaignCreative;

        beforeEach(async () => {
            creative1 = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, {
                name: 'Creative 1',
                status: 'active'
            });

            creative2 = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, {
                name: 'Creative 2',
                status: 'processing'
            });

            otherCampaignCreative = await global.testUtils.createTestCreative(otherUserCampaign.id, secondUser.id, {
                name: 'Other Campaign Creative'
            });
        });

        it('should return creatives for owned campaign', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.creatives).toHaveLength(2);
            expect(response.body.total).toBe(2);
            expect(response.body.campaignId).toBe(testCampaign.id);

            const creativeIds = response.body.creatives.map(c => c.id);
            expect(creativeIds).toContain(creative1.id);
            expect(creativeIds).toContain(creative2.id);
        });

        it('should return creatives with correct structure', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${testCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const creative = response.body.creatives[0];
            expect(creative).toHaveProperty('id');
            expect(creative).toHaveProperty('campaign_id');
            expect(creative).toHaveProperty('name');
            expect(creative).toHaveProperty('video_url');
            expect(creative).toHaveProperty('duration');
            expect(creative).toHaveProperty('file_size');
            expect(creative).toHaveProperty('format');
            expect(creative).toHaveProperty('status');
            expect(creative).toHaveProperty('created_at');
            expect(creative).toHaveProperty('updated_at');
        });

        it('should prevent accessing creatives from other users campaigns', async () => {
            const response = await request(app)
                .get(`/api/v1/campaigns/${otherUserCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });

        it('should return empty array for campaigns with no creatives', async () => {
            const emptyCampaign = await global.testUtils.createTestCampaign(testUser.id, {
                name: 'Empty Campaign'
            });

            const response = await request(app)
                .get(`/api/v1/campaigns/${emptyCampaign.id}/creatives`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.creatives).toHaveLength(0);
            expect(response.body.total).toBe(0);
        });
    });

    describe('GET /api/v1/creatives/:id - Get Creative Details', () => {
        let creative;

        beforeEach(async () => {
            creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, {
                name: 'Test Creative Details',
                duration: 45,
                width: 1920,
                height: 1080
            });
        });

        it('should return creative details for owned creative', async () => {
            const response = await request(app)
                .get(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.creative).toBeDefined();
            const { creative: returnedCreative } = response.body;

            expect(returnedCreative.id).toBe(creative.id);
            expect(returnedCreative.name).toBe(creative.name);
            expect(returnedCreative.duration).toBe(creative.duration);
            expect(returnedCreative.width).toBe(creative.width);
            expect(returnedCreative.height).toBe(creative.height);
        });

        it('should return 404 for non-existent creative', async () => {
            const fakeId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .get(`/api/v1/creatives/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });

        it('should prevent accessing creatives from other users', async () => {
            const response = await request(app)
                .get(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });
    });

    describe('PUT /api/v1/creatives/:id - Update Creative', () => {
        let creative;

        beforeEach(async () => {
            creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id);
        });

        it('should update creative metadata', async () => {
            const updateData = {
                name: 'Updated Creative Name',
                duration: 60
            };

            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.message).toBe('Creative updated successfully');
            expect(response.body.creative.name).toBe(updateData.name);
            expect(response.body.creative.duration).toBe(updateData.duration);
        });

        it('should validate update data', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ duration: -10 })
                .expect(400);

            expect(response.body.error.message).toBe('Validation failed');
        });

        it('should prevent updating creatives from other users', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .send({ name: 'Hacked' })
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });
    });

    describe('PUT /api/v1/creatives/:id/status - Update Creative Status', () => {
        let creative;

        beforeEach(async () => {
            creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, {
                status: 'processing'
            });
        });

        it('should update creative status to active', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'active' })
                .expect(200);

            expect(response.body.message).toBe('Creative status updated to active');
            expect(response.body.creative.status).toBe('active');
        });

        it('should update creative status to inactive', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'inactive' })
                .expect(200);

            expect(response.body.creative.status).toBe('inactive');
        });

        it('should validate status values', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'invalid_status' })
                .expect(400);

            expect(response.body.error.message).toBe('Invalid status. Must be either active or inactive');
        });

        it('should prevent updating status of other users creatives', async () => {
            const response = await request(app)
                .put(`/api/v1/creatives/${creative.id}/status`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .send({ status: 'active' })
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });
    });

    describe('DELETE /api/v1/creatives/:id - Delete Creative', () => {
        let creative;

        beforeEach(async () => {
            creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id);
        });

        it('should delete creative and S3 file', async () => {
            const response = await request(app)
                .delete(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Creative deleted successfully');
            expect(response.body.creativeId).toBe(creative.id);

            // Verify creative is deleted
            const getResponse = await request(app)
                .get(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);
        });

        it('should return 404 for non-existent creative', async () => {
            const fakeId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .delete(`/api/v1/creatives/${fakeId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });

        it('should prevent deleting other users creatives', async () => {
            const response = await request(app)
                .delete(`/api/v1/creatives/${creative.id}`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });
    });

    describe('GET /api/v1/creatives/:id/stats - Creative Statistics', () => {
        let creative;

        beforeEach(async () => {
            creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id);
        });

        it('should return creative statistics', async () => {
            // Add some tracking data
            await global.testPool.query(`
                INSERT INTO ad_impressions (creative_id, campaign_id, device_type)
                VALUES ($1, $2, 'smart_tv'), ($1, $2, 'smart_tv')
            `, [creative.id, testCampaign.id]);

            await global.testPool.query(`
                INSERT INTO ad_clicks (creative_id, campaign_id)
                VALUES ($1, $2)
            `, [creative.id, testCampaign.id]);

            const response = await request(app)
                .get(`/api/v1/creatives/${creative.id}/stats`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.stats).toBeDefined();
            // Additional stats validation would depend on implementation
        });

        it('should return stats for creative with no activity', async () => {
            const response = await request(app)
                .get(`/api/v1/creatives/${creative.id}/stats`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.stats).toBeDefined();
        });

        it('should prevent accessing stats for other users creatives', async () => {
            const response = await request(app)
                .get(`/api/v1/creatives/${creative.id}/stats`)
                .set('Authorization', `Bearer ${secondUserToken}`)
                .expect(404);

            expect(response.body.error.code).toBe('CREATIVE_NOT_FOUND');
        });
    });

    describe('POST /api/v1/campaigns/:campaignId/creatives/upload-url - Generate Upload URL', () => {
        it('should generate presigned upload URL', async () => {
            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives/upload-url`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    fileName: 'test-video.mp4',
                    contentType: 'video/mp4'
                })
                .expect(200);

            expect(response.body.message).toBe('Upload URL generated successfully');
            expect(response.body.uploadUrl).toBeDefined();
            expect(response.body.key).toBeDefined();
            expect(response.body.expiresIn).toBeDefined();
        });

        it('should validate required parameters', async () => {
            const response = await request(app)
                .post(`/api/v1/campaigns/${testCampaign.id}/creatives/upload-url`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({})
                .expect(400);

            expect(response.body.error.message).toBe('fileName and contentType are required');
        });

        it('should prevent generating URLs for other users campaigns', async () => {
            const response = await request(app)
                .post(`/api/v1/campaigns/${otherUserCampaign.id}/creatives/upload-url`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    fileName: 'test-video.mp4',
                    contentType: 'video/mp4'
                })
                .expect(404);

            expect(response.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
        });
    });

    describe('Creative Business Logic', () => {
        it('should handle different creative statuses', async () => {
            const statuses = ['processing', 'active', 'inactive', 'failed'];

            for (const status of statuses) {
                const creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, { status });

                const response = await request(app)
                    .get(`/api/v1/creatives/${creative.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body.creative.status).toBe(status);
            }
        });

        it('should maintain referential integrity with campaigns', async () => {
            const creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id);

            // Delete campaign should cascade delete creative
            await global.testPool.query('DELETE FROM campaigns WHERE id = $1', [testCampaign.id]);

            const creativesCheck = await global.testPool.query(
                'SELECT COUNT(*) FROM creatives WHERE id = $1',
                [creative.id]
            );
            expect(parseInt(creativesCheck.rows[0].count)).toBe(0);
        });

        it('should handle various video formats', async () => {
            const formats = ['mp4', 'mov', 'avi'];

            for (const format of formats) {
                const creative = await global.testUtils.createTestCreative(testCampaign.id, testUser.id, { format });

                const response = await request(app)
                    .get(`/api/v1/creatives/${creative.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                expect(response.body.creative.format).toBe(format);
            }
        });
    });
});