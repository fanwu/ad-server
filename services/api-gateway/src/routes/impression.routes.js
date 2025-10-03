const express = require('express');
const router = express.Router();
const impressionService = require('../services/impressionService');
const logger = require('../utils/logger');

/**
 * POST /api/v1/track-impression
 * Receives impression data from Go ad server
 */
router.post('/track-impression', async (req, res) => {
  try {
    const {
      ad_id,
      campaign_id,
      creative_id,
      device_id,
      device_type,
      location_country,
      location_region,
      user_agent,
      ip_address,
      session_id
    } = req.body;

    // Validate required fields
    if (!campaign_id || !creative_id) {
      return res.status(400).json({
        error: 'campaign_id and creative_id are required'
      });
    }

    // Queue impression for batch write
    const result = await impressionService.trackImpression(req.body);

    res.status(202).json({
      status: 'queued',
      queue_size: result.queue_size
    });
  } catch (error) {
    logger.error('Failed to track impression:', error);
    res.status(500).json({ error: 'Failed to track impression' });
  }
});

module.exports = router;
