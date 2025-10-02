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

    // Create a multi/pipeline object for batched operations
    multi() {
        if (!this.isConnected) {
            logger.warn('Redis not connected, cannot create multi');
            return null;
        }
        return this.client.multi();
    }

    // Alias for compatibility
    pipeline() {
        return this.multi();
    }

    // Hash operations
    async hSet(key, field, value) {
        if (!this.isConnected) return false;
        try {
            await this.client.hSet(key, field, value);
            return true;
        } catch (error) {
            logger.error('Redis hSet error:', error);
            return false;
        }
    }

    async hmSet(key, obj) {
        if (!this.isConnected) return false;
        try {
            await this.client.hSet(key, obj);
            return true;
        } catch (error) {
            logger.error('Redis hmSet error:', error);
            return false;
        }
    }

    async hGetAll(key) {
        if (!this.isConnected) return null;
        try {
            return await this.client.hGetAll(key);
        } catch (error) {
            logger.error('Redis hGetAll error:', error);
            return null;
        }
    }

    // Set operations
    async sAdd(key, ...members) {
        if (!this.isConnected) return false;
        try {
            await this.client.sAdd(key, members);
            return true;
        } catch (error) {
            logger.error('Redis sAdd error:', error);
            return false;
        }
    }

    async sMembers(key) {
        if (!this.isConnected) return [];
        try {
            return await this.client.sMembers(key);
        } catch (error) {
            logger.error('Redis sMembers error:', error);
            return [];
        }
    }

    async sRandMember(key) {
        if (!this.isConnected) return null;
        try {
            return await this.client.sRandMember(key);
        } catch (error) {
            logger.error('Redis sRandMember error:', error);
            return null;
        }
    }

    // Sorted set operations
    async zAdd(key, score, member) {
        if (!this.isConnected) return false;
        try {
            await this.client.zAdd(key, { score, value: member });
            return true;
        } catch (error) {
            logger.error('Redis zAdd error:', error);
            return false;
        }
    }

    async zRange(key, start, stop) {
        if (!this.isConnected) return [];
        try {
            return await this.client.zRange(key, start, stop);
        } catch (error) {
            logger.error('Redis zRange error:', error);
            return [];
        }
    }

    async zRem(key, member) {
        if (!this.isConnected) return false;
        try {
            await this.client.zRem(key, member);
            return true;
        } catch (error) {
            logger.error('Redis zRem error:', error);
            return false;
        }
    }

    // Expiry
    async expire(key, seconds) {
        if (!this.isConnected) return false;
        try {
            await this.client.expire(key, seconds);
            return true;
        } catch (error) {
            logger.error('Redis expire error:', error);
            return false;
        }
    }

    // Increment
    async incr(key) {
        if (!this.isConnected) return null;
        try {
            return await this.client.incr(key);
        } catch (error) {
            logger.error('Redis incr error:', error);
            return null;
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