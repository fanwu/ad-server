const express = require('express');
const logger = require('../utils/logger');
const analyticsService = require('../services/analyticsService');

const router = express.Router();

// Get summary analytics (overall user analytics)
router.get('/summary', async (req, res) => {
    try {
        const options = {
            startDate: req.query.start_date,
            endDate: req.query.end_date
        };

        const analytics = await analyticsService.getSummaryAnalytics(req.user.id, options);

        logger.info('Summary analytics retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            dateRange: options
        });

        res.json(analytics);
    } catch (error) {
        logger.error('Failed to retrieve summary analytics', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve summary analytics',
                code: 'ANALYTICS_RETRIEVAL_FAILED'
            }
        });
    }
});

// Get campaign-specific analytics
router.get('/campaigns/:id', async (req, res) => {
    try {
        const campaignId = req.params.id;
        const options = {
            startDate: req.query.start_date,
            endDate: req.query.end_date
        };

        const analytics = await analyticsService.getCampaignAnalytics(campaignId, req.user.id, options);

        if (!analytics) {
            return res.status(404).json({
                error: {
                    message: 'Campaign not found',
                    code: 'CAMPAIGN_NOT_FOUND'
                }
            });
        }

        logger.info('Campaign analytics retrieved', {
            requestId: req.requestId,
            userId: req.user.id,
            campaignId,
            dateRange: options
        });

        res.json(analytics);
    } catch (error) {
        logger.error('Failed to retrieve campaign analytics', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id,
            campaignId: req.params.id
        });

        res.status(500).json({
            error: {
                message: 'Failed to retrieve campaign analytics',
                code: 'ANALYTICS_RETRIEVAL_FAILED'
            }
        });
    }
});

module.exports = router;
