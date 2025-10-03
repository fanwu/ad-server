const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const authMiddleware = require('./middleware/auth');
const loggingMiddleware = require('./middleware/logging');

// Route imports
const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const creativeRoutes = require('./routes/creatives');
const healthRoutes = require('./routes/health');
const impressionRoutes = require('./routes/impression.routes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    credentials: true
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(loggingMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: {
            message: 'Too many requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Health check (no auth required)
app.use('/health', healthRoutes);

// API routes
app.use('/api/v1/auth', authRoutes);

// Impression tracking (no auth required - called by Go ad server)
app.use('/api/v1', impressionRoutes);

// Protected routes
app.use('/api/v1/campaigns', authMiddleware, campaignRoutes);
app.use('/api/v1', authMiddleware, creativeRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'CTV Ad Server API Gateway',
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            auth: '/api/v1/auth',
            campaigns: '/api/v1/campaigns',
            creatives: '/api/v1/campaigns/:id/creatives'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', {
        requestId: req.requestId,
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
    });

    res.status(error.status || 500).json({
        error: {
            message: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message,
            code: 'INTERNAL_SERVER_ERROR',
            requestId: req.requestId,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
        }
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            message: 'Route not found',
            code: 'ROUTE_NOT_FOUND',
            path: req.originalUrl,
            method: req.method,
            requestId: req.requestId
        }
    });
});

module.exports = app;