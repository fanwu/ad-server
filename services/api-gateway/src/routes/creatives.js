const express = require('express');
const logger = require('../utils/logger');
const creativeService = require('../services/creativeService');
const s3Service = require('../services/s3Service');
const {
    upload,
    validateCreateCreative,
    validateUpdateCreative,
    validateListCreatives,
    validateUploadedFile
} = require('../middleware/creativeValidation');

const router = express.Router();

// Upload a creative for a campaign
router.post(
    '/campaigns/:campaignId/creatives',
    upload.single('video'),
    validateUploadedFile,
    validateCreateCreative,
    async (req, res) => {
        try {
            const { campaignId } = req.params;
            const file = req.file;
            const metadata = req.body.metadata || req.body;

            // Check if user owns the campaign
            const ownsCapmaign = await creativeService.userOwnsCampaign(campaignId, req.user.id);
            if (!ownsCapmaign) {
                return res.status(404).json({
                    error: {
                        message: 'Campaign not found or you do not have permission',
                        code: 'CAMPAIGN_NOT_FOUND'
                    }
                });
            }

            // Upload video to S3
            const s3Result = await s3Service.uploadVideo(file, campaignId, {
                uploadedBy: req.user.id,
                creativeName: metadata.name
            });

            // Create creative record in database
            const creativeData = {
                campaign_id: campaignId,
                name: metadata.name,
                video_url: s3Result.url,
                duration: metadata.duration || 30, // Default 30 seconds if not provided
                file_size: file.size,
                width: metadata.width,
                height: metadata.height,
                format: file.originalname.split('.').pop().toLowerCase(),
                status: 'processing'
            };

            const creative = await creativeService.createCreative(creativeData, req.user.id);

            // In production, you would trigger a video processing job here
            // For MVP, we'll just mark it as active after a delay
            setTimeout(async () => {
                try {
                    await creativeService.updateCreativeStatus(creative.id, 'active', req.user.id);
                    logger.info('Creative processing completed', { creativeId: creative.id });
                } catch (err) {
                    logger.error('Failed to update creative status', { error: err.message, creativeId: creative.id });
                }
            }, 5000); // 5 second delay to simulate processing

            logger.info('Creative uploaded successfully', {
                requestId: req.requestId,
                userId: req.user.id,
                campaignId,
                creativeId: creative.id,
                fileName: file.originalname,
                fileSize: file.size
            });

            res.status(201).json({
                message: 'Creative uploaded successfully',
                creative: {
                    ...creative,
                    processing_message: 'Video is being processed and will be ready shortly'
                }
            });
        } catch (error) {
            logger.error('Failed to upload creative', {
                requestId: req.requestId,
                error: error.message,
                userId: req.user?.id,
                campaignId: req.params.campaignId
            });

            res.status(500).json({
                error: {
                    message: 'Failed to upload creative',
                    code: 'CREATIVE_UPLOAD_FAILED'
                }
            });
        }
    }
);

// Get all creatives for a campaign
router.get('/campaigns/:campaignId/creatives', validateListCreatives, async (req, res) => {
    try {
        const { campaignId } = req.params;

        const creatives = await creativeService.getCreativesByCampaign(campaignId, req.user.id);

        logger.info('Creatives retrieved for campaign', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            count: creatives.length
        });

        res.json({
            creatives,
            total: creatives.length,
            campaignId
        });
    } catch (error) {
        logger.error('Failed to retrieve creatives', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.campaignId
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve creatives',
                code: 'CREATIVES_RETRIEVAL_FAILED'
            }
        });
    }
});

// Get a specific creative
router.get('/creatives/:id', async (req, res) => {
    try {
        const creativeId = req.params.id;

        const creative = await creativeService.getCreativeById(creativeId, req.user.id);

        if (!creative) {
            return res.status(404).json({
                error: {
                    message: 'Creative not found',
                    code: 'CREATIVE_NOT_FOUND'
                }
            });
        }

        logger.info('Creative retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            creativeId
        });

        res.json({ creative });
    } catch (error) {
        logger.error('Failed to retrieve creative', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            creativeId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve creative',
                code: 'CREATIVE_RETRIEVAL_FAILED'
            }
        });
    }
});

// Update a creative
router.put('/creatives/:id', validateUpdateCreative, async (req, res) => {
    try {
        const creativeId = req.params.id;

        const creative = await creativeService.updateCreative(creativeId, req.body, req.user.id);

        if (!creative) {
            return res.status(404).json({
                error: {
                    message: 'Creative not found or you do not have permission',
                    code: 'CREATIVE_NOT_FOUND'
                }
            });
        }

        logger.info('Creative updated', {
            requestId: req.requestId,
            userId: req.user.id,
            creativeId,
            updates: Object.keys(req.body)
        });

        res.json({
            message: 'Creative updated successfully',
            creative
        });
    } catch (error) {
        logger.error('Failed to update creative', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            creativeId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to update creative',
                code: 'CREATIVE_UPDATE_FAILED'
            }
        });
    }
});

// Update creative status
router.put('/creatives/:id/status', async (req, res) => {
    try {
        const creativeId = req.params.id;
        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                error: {
                    message: 'Invalid status. Must be either active or inactive',
                    code: 'INVALID_STATUS'
                }
            });
        }

        const creative = await creativeService.updateCreativeStatus(creativeId, status, req.user.id);

        if (!creative) {
            return res.status(404).json({
                error: {
                    message: 'Creative not found or you do not have permission',
                    code: 'CREATIVE_NOT_FOUND'
                }
            });
        }

        logger.info('Creative status updated', {
            requestId: req.requestId,
            userId: req.user.id,
            creativeId,
            newStatus: status
        });

        res.json({
            message: `Creative status updated to ${status}`,
            creative
        });
    } catch (error) {
        logger.error('Failed to update creative status', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            creativeId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to update creative status',
                code: 'STATUS_UPDATE_FAILED'
            }
        });
    }
});

// Delete a creative
router.delete('/creatives/:id', async (req, res) => {
    try {
        const creativeId = req.params.id;

        // Get creative details first (for S3 cleanup)
        const creative = await creativeService.getCreativeById(creativeId, req.user.id);

        if (!creative) {
            return res.status(404).json({
                error: {
                    message: 'Creative not found or you do not have permission',
                    code: 'CREATIVE_NOT_FOUND'
                }
            });
        }

        // Delete from database
        const result = await creativeService.deleteCreative(creativeId, req.user.id);

        if (!result) {
            return res.status(404).json({
                error: {
                    message: 'Failed to delete creative',
                    code: 'DELETE_FAILED'
                }
            });
        }

        // Delete from S3 (best effort - don't fail if S3 delete fails)
        try {
            const key = s3Service.extractKeyFromUrl(creative.video_url);
            await s3Service.deleteVideo(key);
        } catch (s3Error) {
            logger.error('Failed to delete video from S3', {
                error: s3Error.message,
                creativeId,
                videoUrl: creative.video_url
            });
        }

        logger.info('Creative deleted', {
            requestId: req.requestId,
            userId: req.user.id,
            creativeId
        });

        res.json({
            message: 'Creative deleted successfully',
            creativeId
        });
    } catch (error) {
        logger.error('Failed to delete creative', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            creativeId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to delete creative',
                code: 'CREATIVE_DELETION_FAILED'
            }
        });
    }
});

// Get creative statistics
router.get('/creatives/:id/stats', async (req, res) => {
    try {
        const creativeId = req.params.id;

        const stats = await creativeService.getCreativeStats(creativeId, req.user.id);

        if (!stats) {
            return res.status(404).json({
                error: {
                    message: 'Creative not found',
                    code: 'CREATIVE_NOT_FOUND'
                }
            });
        }

        logger.info('Creative stats retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            creativeId
        });

        res.json({ stats });
    } catch (error) {
        logger.error('Failed to retrieve creative stats', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            creativeId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve creative stats',
                code: 'STATS_RETRIEVAL_FAILED'
            }
        });
    }
});

// Generate presigned URL for direct upload (alternative method)
router.post('/campaigns/:campaignId/creatives/upload-url', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { fileName, contentType } = req.body;

        if (!fileName || !contentType) {
            return res.status(400).json({
                error: {
                    message: 'fileName and contentType are required',
                    code: 'MISSING_PARAMETERS'
                }
            });
        }

        // Check if user owns the campaign
        const ownsCampaign = await creativeService.userOwnsCampaign(campaignId, req.user.id);
        if (!ownsCampaign) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found or you do not have permission',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        // Generate presigned URL
        const uploadData = await s3Service.generateUploadUrl(campaignId, fileName, contentType);

        logger.info('Upload URL generated', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            fileName
        });

        res.json({
            message: 'Upload URL generated successfully',
            ...uploadData
        });
    } catch (error) {
        logger.error('Failed to generate upload URL', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.campaignId
        });

        res.status(500).json({
            error: {
                message: 'Failed to generate upload URL',
                code: 'UPLOAD_URL_GENERATION_FAILED'
            }
        });
    }
});

module.exports = router;