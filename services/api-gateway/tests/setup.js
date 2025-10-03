/**
 * Jest Test Setup
 * This file runs before all tests to configure the test environment
 */

const { Pool } = require('pg');
const redis = require('redis');

// Load .env.test file if running locally (not in Docker)
if (!process.env.INSIDE_DOCKER_TEST) {
    require('dotenv').config({ path: require('path').join(__dirname, '../.env.test') });
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
// Use test ports by default (will be overridden by docker-compose or .env.test)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://adserver:dev_password@localhost:5433/adserver_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

// Global test setup
global.testPool = null;
global.testRedis = null;

beforeAll(async () => {
    // Create database connection pool for tests
    global.testPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5, // Smaller pool for tests
    });

    // Create Redis client for tests
    global.testRedis = redis.createClient({
        url: process.env.REDIS_URL,
    });
    await global.testRedis.connect();

    // Initialize the application Redis service for integration tests
    try {
        const redisService = require('../src/services/redisService');
        if (!redisService.isConnected) {
            await redisService.connect();
        }
    } catch (error) {
        console.warn('Redis service initialization failed in tests:', error.message);
    }

    // Ensure test database exists and is clean
    await setupTestDatabase();
});

afterAll(async () => {
    // Clean up test data from database first
    if (global.testPool) {
        try {
            // Simplified cleanup - truncate all tables for faster cleanup
            // Using actual table names from migrations
            await global.testPool.query("TRUNCATE impressions, ad_requests, campaign_daily_stats, creatives, campaigns, users RESTART IDENTITY CASCADE");
        } catch (error) {
            console.warn('Final test cleanup skipped:', error.message);
        }
    }

    // Clean up database connections
    if (global.testPool) {
        await global.testPool.end();
    }

    if (global.testRedis) {
        await global.testRedis.quit();
    }

    // Close the application Redis service
    try {
        const redisService = require('../src/services/redisService');
        if (redisService.isConnected) {
            await redisService.disconnect();
        }
    } catch (error) {
        console.warn('Error closing Redis service:', error.message);
    }

    // Close the auth service pool (only if not already closed)
    try {
        const authService = require('../src/services/authService');
        if (authService.pool && !authService.pool.ended) {
            await authService.close();
        }
    } catch (error) {
        console.warn('Error closing auth service:', error.message);
    }

    // Stop the Redis sync service to clear its interval
    try {
        const redisSyncService = require('../src/services/redis-sync.service');
        redisSyncService.stop();
    } catch (error) {
        console.warn('Error stopping Redis sync service:', error.message);
    }

    // Give a small delay to ensure all connections are properly closed
    await new Promise(resolve => setTimeout(resolve, 200));
});

// Clean up between tests
beforeEach(async () => {
    // Clear Redis cache
    if (global.testRedis) {
        await global.testRedis.flushAll();
    }
});


async function setupTestDatabase() {
    try {
        // Check if tables exist
        const result = await global.testPool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'users'
            );
        `);

        // Only run migrations if tables don't exist
        if (!result.rows[0].exists) {
            const DatabaseMigrator = require('../../../shared/database/migrate');
            const migrator = new DatabaseMigrator(process.env.DATABASE_URL);

            console.log('Running test database migrations...');
            await migrator.migrate();
            console.log('Test database migrations complete');

            await migrator.close();
        }
    } catch (error) {
        console.error('Failed to setup test database:', error);
        throw error;
    }
}


// Test utilities
global.testUtils = {
    // Create a test user
    async createTestUser(userData = {}) {
        const bcrypt = require('bcrypt');
        const defaultData = {
            email: `test-${Date.now()}@example.com`,
            password: 'testpassword123',
            name: 'Test User',
            role: 'advertiser'
        };

        const user = { ...defaultData, ...userData };
        const hashedPassword = await bcrypt.hash(user.password, 12);

        const result = await global.testPool.query(
            `INSERT INTO users (email, password_hash, name, role)
             VALUES ($1, $2, $3, $4)
             RETURNING id, email, name, role, created_at`,
            [user.email, hashedPassword, user.name, user.role]
        );

        return { ...result.rows[0], password: user.password };
    },

    // Clean up test user
    async deleteTestUser(userId) {
        await global.testPool.query('DELETE FROM users WHERE id = $1', [userId]);
    },

    // Generate test JWT token
    generateTestToken(payload = {}) {
        const jwt = require('jsonwebtoken');
        const defaultPayload = {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'advertiser'
        };

        return jwt.sign(
            { ...defaultPayload, ...payload },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
    },

    // Create a test campaign
    async createTestCampaign(userId, campaignData = {}) {
        const defaultData = {
            name: `Test Campaign ${Date.now()}`,
            description: 'Test campaign description',
            budget_total: 1000.00,
            start_date: new Date('2025-01-01'),
            end_date: new Date('2025-12-31'),
            status: 'draft'
        };

        const campaign = { ...defaultData, ...campaignData };

        const result = await global.testPool.query(
            `INSERT INTO campaigns (name, description, budget_total, start_date, end_date, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [campaign.name, campaign.description, campaign.budget_total, campaign.start_date, campaign.end_date, campaign.status, userId]
        );

        return result.rows[0];
    },

    // Create a test creative
    async createTestCreative(campaignId, userId, creativeData = {}) {
        const defaultData = {
            name: `Test Creative ${Date.now()}`,
            video_url: 'http://localhost:4566/test-bucket/test-video.mp4',
            duration: 30,
            file_size: 1000000,
            width: 1920,
            height: 1080,
            format: 'mp4',
            status: 'active'
        };

        const creative = { ...defaultData, ...creativeData };

        const result = await global.testPool.query(
            `INSERT INTO creatives (campaign_id, name, video_url, duration, file_size, width, height, format, status, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [campaignId, creative.name, creative.video_url, creative.duration, creative.file_size,
             creative.width, creative.height, creative.format, creative.status, userId]
        );

        return result.rows[0];
    },

    // Clean up test campaign
    async deleteTestCampaign(campaignId) {
        await global.testPool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
    },

    // Clean up test creative
    async deleteTestCreative(creativeId) {
        await global.testPool.query('DELETE FROM creatives WHERE id = $1', [creativeId]);
    }
};