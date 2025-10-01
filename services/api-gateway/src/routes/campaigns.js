const express = require('express');
const logger = require('../utils/logger');
const campaignService = require('../services/campaignService');
const {
    validateCreateCampaign,
    validateUpdateCampaign,
    validateUpdateStatus,
    validateListCampaigns
} = require('../middleware/campaignValidation');
const { validateCampaignId } = require('../middleware/uuidValidation');

const router = express.Router();

// Get all campaigns for the authenticated user
router.get('/', validateListCampaigns, async (req, res) => {
    try {
        const campaigns = await campaignService.getCampaigns(req.user.id, req.query);

        logger.info('Campaigns retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignCount: campaigns.length
        });

        res.json({
            campaigns: campaigns,
            total: campaigns.length,
            page: req.query.page || 1,
            limit: req.query.limit || 20
        });
    } catch (error) {
        logger.error('Failed to retrieve campaigns', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve campaigns',
                code: 'CAMPAIGNS_RETRIEVAL_FAILED'
            }
        });
    }
});

// Get specific campaign by ID
router.get('/:id', validateCampaignId, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaign = await campaignService.getCampaignById(campaignId, req.user.id);

        if (!campaign) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        // Calculate basic metrics
        const metrics = {
            impressions: parseInt(campaign.total_impressions) || 0,
            clicks: parseInt(campaign.total_clicks) || 0,
            ctr: campaign.total_impressions > 0
                ? ((campaign.total_clicks / campaign.total_impressions) * 100).toFixed(2)
                : 0,
            spend: parseFloat(campaign.total_spend) || 0
        };

        logger.info('Campaign retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId
        });

        res.json({
            campaign: {
                ...campaign,
                metrics
            }
        });
    } catch (error) {
        logger.error('Failed to retrieve campaign', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve campaign',
                code: 'CAMPAIGN_RETRIEVAL_FAILED'
            }
        });
    }
});

// Create new campaign
router.post('/', validateCreateCampaign, async (req, res) => {
    try {
        const campaign = await campaignService.createCampaign(req.body, req.user.id);

        logger.info('Campaign created', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId: campaign.id,
            campaignName: campaign.name
        });

        res.status(201).json({
            message: 'Campaign created successfully',
            campaign
        });
    } catch (error) {
        logger.error('Failed to create campaign', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to create campaign',
                code: 'CAMPAIGN_CREATION_FAILED'
            }
        });
    }
});

// Update campaign
router.put('/:id', validateCampaignId, validateUpdateCampaign, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const campaign = await campaignService.updateCampaign(campaignId, req.body, req.user.id);

        if (!campaign) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found or you do not have permission to update it',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        logger.info('Campaign updated', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            updates: Object.keys(req.body)
        });

        res.json({
            message: 'Campaign updated successfully',
            campaign
        });
    } catch (error) {
        logger.error('Failed to update campaign', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to update campaign',
                code: 'CAMPAIGN_UPDATE_FAILED'
            }
        });
    }
});

// Update campaign status
router.put('/:id/status', validateCampaignId, validateUpdateStatus, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const { status } = req.body;

        const campaign = await campaignService.updateCampaignStatus(campaignId, status, req.user.id);

        if (!campaign) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found or you do not have permission to update it',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        logger.info('Campaign status updated', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            newStatus: status
        });

        res.json({
            message: `Campaign status updated to ${status}`,
            campaign
        });
    } catch (error) {
        logger.error('Failed to update campaign status', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to update campaign status',
                code: 'STATUS_UPDATE_FAILED'
            }
        });
    }
});

// Delete campaign
router.delete('/:id', validateCampaignId, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const hardDelete = req.query.hard === 'true';

        const result = await campaignService.deleteCampaign(campaignId, req.user.id, hardDelete);

        if (!result) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found or you do not have permission to delete it',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        logger.info('Campaign deleted', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            hardDelete
        });

        res.json({
            message: hardDelete ? 'Campaign permanently deleted' : 'Campaign marked as completed',
            campaignId
        });
    } catch (error) {
        logger.error('Failed to delete campaign', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to delete campaign',
                code: 'CAMPAIGN_DELETION_FAILED'
            }
        });
    }
});

// Get campaign statistics
router.get('/:id/stats', validateCampaignId, async (req, res) => {
    try {
        const campaignId = req.params.id;
        const stats = await campaignService.getCampaignStats(campaignId, req.user.id);

        if (!stats) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        logger.info('Campaign stats retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId
        });

        res.json({
            stats
        });
    } catch (error) {
        logger.error('Failed to retrieve campaign stats', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve campaign stats',
                code: 'STATS_RETRIEVAL_FAILED'
            }
        });
    }
});

module.exports = router;