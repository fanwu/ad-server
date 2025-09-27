const redis = require('redis');
const logger = require('../utils/logger');

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            this.client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            this.client.on('error', (err) => {
                logger.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis Client Connected');
                this.isConnected = true;
            });

            this.client.on('disconnect', () => {
                logger.warn('Redis Client Disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
            logger.info('Redis connection established');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async get(key) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping get operation');
            return null;
        }
        try {
            return await this.client.get(key);
        } catch (error) {
            logger.error('Redis get error:', error);
            return null;
        }
    }

    async set(key, value, ttl = null) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping set operation');
            return false;
        }
        try {
            if (ttl) {
                await this.client.setEx(key, ttl, value);
            } else {
                await this.client.set(key, value);
            }
            return true;
        } catch (error) {
            logger.error('Redis set error:', error);
            return false;
        }
    }

    async setex(key, seconds, value) {
        return this.set(key, value, seconds);
    }

    async del(key) {
        if (!this.isConnected) {
            logger.warn('Redis not connected, skipping delete operation');
            return false;
        }
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Redis delete error:', error);
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.isConnected = false;
            logger.info('Redis connection closed');
        }
    }
}

module.exports = new RedisService();