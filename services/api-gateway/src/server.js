require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const redis = require('./services/redisService');
const authService = require('./services/authService');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        // Connect to Redis
        logger.info('Connecting to Redis...');
        await redis.connect();

        // Test database connection
        logger.info('Testing database connection...');
        await authService.pool.query('SELECT NOW()');
        logger.info('Database connection successful');

        // Start the server
        const server = app.listen(PORT, () => {
            logger.info(`🚀 API Gateway server started`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
                timestamp: new Date().toISOString()
            });

            logger.info('📋 Available endpoints:', {
                health: `http://localhost:${PORT}/health`,
                auth: `http://localhost:${PORT}/api/v1/auth`,
                campaigns: `http://localhost:${PORT}/api/v1/campaigns`,
                docs: `http://localhost:${PORT}/`
            });
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            server.close(async () => {
                logger.info('HTTP server closed');

                try {
                    await redis.disconnect();
                    logger.info('Redis connection closed');

                    await authService.close();
                    logger.info('Database connection closed');

                    logger.info('Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during graceful shutdown:', error);
                    process.exit(1);
                }
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

startServer();