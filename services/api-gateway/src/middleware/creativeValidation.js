const Joi = require('joi');
const multer = require('multer');

// Schema for creating a creative (metadata)
const createCreativeSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .required()
        .messages({
            'string.min': 'Creative name must be at least 3 characters long',
            'string.max': 'Creative name cannot exceed 255 characters',
            'any.required': 'Creative name is required'
        }),

    duration: Joi.number()
        .integer()
        .positive()
        .min(1)
        .max(120)
        .optional()
        .messages({
            'number.positive': 'Duration must be positive',
            'number.min': 'Duration must be at least 1 second',
            'number.max': 'Duration cannot exceed 120 seconds'
        }),

    width: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.positive': 'Width must be positive'
        }),

    height: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.positive': 'Height must be positive'
        })
});

// Schema for updating a creative
const updateCreativeSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Creative name must be at least 3 characters long',
            'string.max': 'Creative name cannot exceed 255 characters'
        }),

    status: Joi.string()
        .valid('active', 'inactive')
        .optional()
        .messages({
            'any.only': 'Status must be either active or inactive'
        }),

    duration: Joi.number()
        .integer()
        .positive()
        .min(1)
        .max(120)
        .optional()
        .messages({
            'number.positive': 'Duration must be positive',
            'number.min': 'Duration must be at least 1 second',
            'number.max': 'Duration cannot exceed 120 seconds'
        })
}).min(1);

// Schema for listing creatives
const listCreativesSchema = Joi.object({
    status: Joi.string()
        .valid('active', 'inactive', 'processing', 'failed')
        .optional()
        .messages({
            'any.only': 'Status must be one of: active, inactive, processing, failed'
        }),

    page: Joi.number()
        .integer()
        .positive()
        .optional()
        .default(1),

    limit: Joi.number()
        .integer()
        .positive()
        .max(100)
        .optional()
        .default(20)
});

// Multer configuration for file upload
const storage = multer.memoryStorage(); // Store in memory for S3 upload

const fileFilter = (req, file, cb) => {
    // Accept video files only
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only MP4, MOV, and AVI video files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max file size for MVP
        files: 1 // Only 1 file at a time
    }
});

// Validation middleware functions
const validateCreateCreative = (req, res, next) => {
    // Parse the metadata if it's a string (from form-data)
    if (req.body.metadata && typeof req.body.metadata === 'string') {
        try {
            req.body.metadata = JSON.parse(req.body.metadata);
        } catch (error) {
            return res.status(400).json({
                error: {
                    message: 'Invalid metadata format',
                    details: [{ field: 'metadata', message: 'Must be valid JSON' }]
                }
            });
        }
    }

    const dataToValidate = req.body.metadata || req.body;
    const { error, value } = createCreativeSchema.validate(dataToValidate);

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

    // Store validated data back
    if (req.body.metadata) {
        req.body.metadata = value;
    } else {
        req.body = value;
    }

    next();
};

const validateUpdateCreative = (req, res, next) => {
    const { error, value } = updateCreativeSchema.validate(req.body);
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

const validateListCreatives = (req, res, next) => {
    const { error, value } = listCreativesSchema.validate(req.query);
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

// Custom middleware to validate file after upload
const validateUploadedFile = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            error: {
                message: 'Validation failed',
                details: [{
                    field: 'video',
                    message: 'Video file is required'
                }]
            }
        });
    }

    // Additional file validation
    const file = req.file;
    const errors = [];

    // Check file extension
    const allowedExtensions = ['mp4', 'mov', 'avi'];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        errors.push('Invalid file extension. Only mp4, mov, and avi are allowed.');
    }

    // Check file size (redundant but good to double-check)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
        errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 500MB.`);
    }

    if (errors.length > 0) {
        return res.status(400).json({
            error: {
                message: 'File validation failed',
                details: errors
            }
        });
    }

    next();
};

module.exports = {
    upload,
    validateCreateCreative,
    validateUpdateCreative,
    validateListCreatives,
    validateUploadedFile
};