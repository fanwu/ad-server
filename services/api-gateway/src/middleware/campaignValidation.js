const Joi = require('joi');

// Schema for creating a new campaign
const createCampaignSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .required()
        .messages({
            'string.min': 'Campaign name must be at least 3 characters long',
            'string.max': 'Campaign name cannot exceed 255 characters',
            'any.required': 'Campaign name is required'
        }),

    description: Joi.string()
        .max(1000)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),

    budget_total: Joi.number()
        .positive()
        .precision(2)
        .min(1)
        .max(1000000000)
        .required()
        .messages({
            'number.positive': 'Budget must be a positive number',
            'number.min': 'Budget must be at least $1',
            'number.max': 'Budget cannot exceed $1,000,000,000',
            'any.required': 'Budget is required'
        }),

    start_date: Joi.date()
        .iso()
        .required()
        .messages({
            'date.format': 'Start date must be in ISO format',
            'any.required': 'Start date is required'
        }),

    end_date: Joi.date()
        .iso()
        .greater(Joi.ref('start_date'))
        .required()
        .messages({
            'date.format': 'End date must be in ISO format',
            'date.greater': 'End date must be after start date',
            'any.required': 'End date is required'
        })
});

// Schema for updating a campaign
const updateCampaignSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Campaign name must be at least 3 characters long',
            'string.max': 'Campaign name cannot exceed 255 characters'
        }),

    description: Joi.string()
        .max(1000)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),

    budget_total: Joi.number()
        .positive()
        .precision(2)
        .min(1)
        .max(1000000000)
        .optional()
        .messages({
            'number.positive': 'Budget must be a positive number',
            'number.min': 'Budget must be at least $1',
            'number.max': 'Budget cannot exceed $1,000,000,000'
        }),

    start_date: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.format': 'Start date must be in ISO format'
        }),

    end_date: Joi.date()
        .iso()
        .optional()
        .when('start_date', {
            is: Joi.exist(),
            then: Joi.date().greater(Joi.ref('start_date')),
            otherwise: Joi.date()
        })
        .messages({
            'date.format': 'End date must be in ISO format',
            'date.greater': 'End date must be after start date'
        })
}).min(1); // At least one field must be provided for update

// Schema for updating campaign status
const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid('draft', 'active', 'paused', 'completed')
        .required()
        .messages({
            'any.only': 'Status must be one of: draft, active, paused, completed',
            'any.required': 'Status is required'
        })
});

// Schema for query parameters when listing campaigns
const listCampaignsSchema = Joi.object({
    status: Joi.string()
        .valid('draft', 'active', 'paused', 'completed')
        .optional()
        .messages({
            'any.only': 'Status filter must be one of: draft, active, paused, completed'
        }),

    start_date: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.format': 'Start date must be in ISO format'
        }),

    end_date: Joi.date()
        .iso()
        .optional()
        .messages({
            'date.format': 'End date must be in ISO format'
        }),

    page: Joi.number()
        .integer()
        .positive()
        .optional()
        .default(1)
        .messages({
            'number.positive': 'Page number must be positive'
        }),

    limit: Joi.number()
        .integer()
        .positive()
        .max(100)
        .optional()
        .default(20)
        .messages({
            'number.positive': 'Limit must be positive',
            'number.max': 'Limit cannot exceed 100'
        })
});

// Validation middleware
const validateCreateCampaign = (req, res, next) => {
    const { error, value } = createCampaignSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            }
        });
    }
    req.body = value;
    next();
};

const validateUpdateCampaign = (req, res, next) => {
    const { error, value } = updateCampaignSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            }
        });
    }
    req.body = value;
    next();
};

const validateUpdateStatus = (req, res, next) => {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            }
        });
    }
    req.body = value;
    next();
};

const validateListCampaigns = (req, res, next) => {
    const { error, value } = listCampaignsSchema.validate(req.query);
    if (error) {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                details: error.details.map(d => ({
                    field: d.path.join('.'),
                    message: d.message
                }))
            }
        });
    }
    req.query = value;
    next();
};

module.exports = {
    validateCreateCampaign,
    validateUpdateCampaign,
    validateUpdateStatus,
    validateListCampaigns
};