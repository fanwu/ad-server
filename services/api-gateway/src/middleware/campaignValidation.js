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
        }),

    pricing_model: Joi.string()
        .valid('cpm', 'cpc', 'cpv', 'flat')
        .optional()
        .default('cpm')
        .messages({
            'any.only': 'Pricing model must be one of: cpm, cpc, cpv, flat'
        }),

    cpm_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(1000)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPM rate must be a positive number',
            'number.min': 'CPM rate must be at least $0.01',
            'number.max': 'CPM rate cannot exceed $1,000'
        }),

    cpc_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPC rate must be a positive number',
            'number.min': 'CPC rate must be at least $0.01',
            'number.max': 'CPC rate cannot exceed $100'
        }),

    cpv_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPV rate must be a positive number',
            'number.min': 'CPV rate must be at least $0.01',
            'number.max': 'CPV rate cannot exceed $100'
        })
}).custom((value, helpers) => {
    // Validate that the appropriate rate is set for the pricing model
    const { pricing_model, cpm_rate, cpc_rate, cpv_rate } = value;

    if (pricing_model === 'cpm' && (!cpm_rate || cpm_rate <= 0)) {
        return helpers.error('custom.cpmRequired');
    }
    if (pricing_model === 'cpc' && (!cpc_rate || cpc_rate <= 0)) {
        return helpers.error('custom.cpcRequired');
    }
    if (pricing_model === 'cpv' && (!cpv_rate || cpv_rate <= 0)) {
        return helpers.error('custom.cpvRequired');
    }

    return value;
}, 'Pricing validation').messages({
    'custom.cpmRequired': 'CPM rate is required when using CPM pricing model',
    'custom.cpcRequired': 'CPC rate is required when using CPC pricing model',
    'custom.cpvRequired': 'CPV rate is required when using CPV pricing model'
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
        }),

    pricing_model: Joi.string()
        .valid('cpm', 'cpc', 'cpv', 'flat')
        .optional()
        .messages({
            'any.only': 'Pricing model must be one of: cpm, cpc, cpv, flat'
        }),

    cpm_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(1000)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPM rate must be a positive number',
            'number.min': 'CPM rate must be at least $0.01',
            'number.max': 'CPM rate cannot exceed $1,000'
        }),

    cpc_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPC rate must be a positive number',
            'number.min': 'CPC rate must be at least $0.01',
            'number.max': 'CPC rate cannot exceed $100'
        }),

    cpv_rate: Joi.number()
        .positive()
        .precision(2)
        .min(0.01)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.positive': 'CPV rate must be a positive number',
            'number.min': 'CPV rate must be at least $0.01',
            'number.max': 'CPV rate cannot exceed $100'
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