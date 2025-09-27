const express = require('express');
const redis = require('../services/redisService');
const authService = require('../services/authService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {}
    };

    // Check Redis connection
    try {
        if (redis.isConnected) {
            await redis.set('health_check', 'ok', 10);
            const result = await redis.get('health_check');
            health.checks.redis = {
                status: result === 'ok' ? 'OK' : 'ERROR',
                latency: Date.now() - Date.parse(health.timestamp)
            };
        } else {
            health.checks.redis = { status: 'DISCONNECTED' };
        }
    } catch (error) {
        health.checks.redis = {
            status: 'ERROR',
            error: error.message
        };
    }

    // Check Database connection
    try {
        const startTime = Date.now();
        await authService.pool.query('SELECT 1');
        health.checks.database = {
            status: 'OK',
            latency: Date.now() - startTime
        };
    } catch (error) {
        health.checks.database = {
            status: 'ERROR',
            error: error.message
        };
    }

    // Determine overall status
    const hasErrors = Object.values(health.checks).some(check => check.status === 'ERROR');
    if (hasErrors) {
        health.status = 'ERROR';
        res.status(503);
    }

    res.json(health);
});

module.exports = router;