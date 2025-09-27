const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const loggingMiddleware = (req, res, next) => {
    // Generate request ID for tracing
    req.requestId = uuidv4();

    // Start timer
    const startTime = Date.now();

    // Log incoming request
    logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
    });

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body) {
        const duration = Date.now() - startTime;

        // Log response
        logger.info('Outgoing response', {
            requestId: req.requestId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            responseSize: JSON.stringify(body).length,
            timestamp: new Date().toISOString()
        });

        // Log errors separately
        if (res.statusCode >= 400) {
            logger.warn('Request resulted in error', {
                requestId: req.requestId,
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                error: body.error || body,
                timestamp: new Date().toISOString()
            });
        }

        return originalJson.call(this, body);
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);

    next();
};

module.exports = loggingMiddleware;