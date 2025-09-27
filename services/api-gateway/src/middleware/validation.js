const Joi = require('joi');
const logger = require('../utils/logger');

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            logger.warn('Validation failed:', { errors: validationErrors, body: req.body });

            return res.status(400).json({
                error: {
                    message: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: validationErrors
                }
            });
        }

        req.validatedBody = value;
        next();
    };
};

// Common validation schemas
const schemas = {
    register: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
        password: Joi.string().min(8).max(128).required().messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.max': 'Password cannot exceed 128 characters',
            'any.required': 'Password is required'
        }),
        name: Joi.string().min(2).max(100).required().messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 100 characters',
            'any.required': 'Name is required'
        }),
        role: Joi.string().valid('advertiser', 'admin').default('advertiser')
    }),

    login: Joi.object({
        email: Joi.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
        password: Joi.string().required().messages({
            'any.required': 'Password is required'
        })
    }),

    refreshToken: Joi.object({
        refreshToken: Joi.string().required().messages({
            'any.required': 'Refresh token is required'
        })
    })
};

module.exports = { validateRequest, schemas };