/**
 * UUID Validation Middleware
 * Validates UUID parameters in routes to prevent database errors
 */

const { v4: uuidv4, validate: uuidValidate } = require('uuid');

/**
 * Validates UUID parameter in route
 * @param {string} paramName - Name of the parameter to validate
 * @returns {Function} Express middleware function
 */
const validateUuidParam = (paramName) => {
    return (req, res, next) => {
        const uuid = req.params[paramName];

        if (!uuid) {
            return res.status(400).json({
                error: {
                    message: `${paramName} parameter is required`,
                    code: 'MISSING_PARAMETER',
                    requestId: req.requestId
                }
            });
        }

        if (!uuidValidate(uuid)) {
            return res.status(400).json({
                error: {
                    message: `Invalid ${paramName} format`,
                    code: 'INVALID_UUID_FORMAT',
                    requestId: req.requestId
                }
            });
        }

        next();
    };
};

/**
 * Validates campaign ID parameter
 */
const validateCampaignId = validateUuidParam('id');

/**
 * Validates campaign ID parameter (for routes with campaignId)
 */
const validateCampaignIdParam = validateUuidParam('campaignId');

/**
 * Validates creative ID parameter
 */
const validateCreativeId = validateUuidParam('id');

module.exports = {
    validateUuidParam,
    validateCampaignId,
    validateCampaignIdParam,
    validateCreativeId
};