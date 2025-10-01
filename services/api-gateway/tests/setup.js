/**
 * Jest Test Setup
 * This file runs before all tests to configure the test environment
 */

const { Pool } = require('pg');
const redis = require('redis');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL || 'postgresql://adserver:dev_password@localhost:5432/adserver_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

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
            // Clean up in reverse dependency order - only test data with specific patterns
            await global.testPool.query("DELETE FROM ad_completions WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%'))");
            await global.testPool.query("DELETE FROM ad_clicks WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%'))");
            await global.testPool.query("DELETE FROM ad_impressions WHERE campaign_id IN (SELECT id FROM campaigns WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%'))");
            await global.testPool.query("DELETE FROM creatives WHERE uploaded_by IN (SELECT id FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%')");
            await global.testPool.query("DELETE FROM campaigns WHERE created_by IN (SELECT id FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%')");
            await global.testPool.query("DELETE FROM users WHERE email LIKE 'test-%@%' OR email LIKE '%test%@%' OR email LIKE 'campaign-test%@%' OR email LIKE 'creative-test%@%'");
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
        // Check if test database tables exist, if not run migrations
        const result = await global.testPool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'users'
            );
        `);

        if (!result.rows[0].exists) {
            console.log('Setting up test database schema...');
            // Run migrations for test database
            await runTestMigrations();
            console.log('Test database schema setup complete');
        } else {
            // Check if campaigns table exists, if not run new migrations
            const campaignsExist = await global.testPool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'campaigns'
                );
            `);

            if (!campaignsExist.rows[0].exists) {
                console.log('Running new migrations for test database...');
                await runCampaignMigrations();
                console.log('Test database migrations complete');
            }
        }
    } catch (error) {
        console.error('Failed to setup test database:', error);
        throw error;
    }
}

async function runTestMigrations() {
    // Create all tables needed for tests
    await global.testPool.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'advertiser' CHECK (role IN ('admin', 'advertiser', 'viewer')),
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    `);

    await runCampaignMigrations();
}

async function runCampaignMigrations() {
    // Create campaigns table
    await global.testPool.query(`
        CREATE TABLE IF NOT EXISTS campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
            budget_total DECIMAL(10, 2) NOT NULL CHECK (budget_total >= 0),
            budget_spent DECIMAL(10, 2) DEFAULT 0 CHECK (budget_spent >= 0),
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT valid_date_range CHECK (end_date > start_date),
            CONSTRAINT budget_within_total CHECK (budget_spent <= budget_total)
        );

        CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(created_by);
        CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
        CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
    `);

    // Create creatives table
    await global.testPool.query(`
        CREATE TABLE IF NOT EXISTS creatives (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            video_url TEXT NOT NULL,
            duration INTEGER CHECK (duration > 0),
            file_size BIGINT CHECK (file_size > 0),
            width INTEGER CHECK (width > 0),
            height INTEGER CHECK (height > 0),
            format VARCHAR(10) NOT NULL,
            status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'active', 'inactive', 'failed')),
            uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_creatives_campaign ON creatives(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_creatives_user ON creatives(uploaded_by);
        CREATE INDEX IF NOT EXISTS idx_creatives_status ON creatives(status);
    `);

    // Create ad tracking tables
    await global.testPool.query(`
        CREATE TABLE IF NOT EXISTS ad_impressions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            device_type VARCHAR(50),
            location_country VARCHAR(3),
            location_region VARCHAR(100),
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            user_agent TEXT,
            ip_address INET,
            session_id VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS ad_clicks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            impression_id UUID REFERENCES ad_impressions(id) ON DELETE SET NULL,
            creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            click_position JSONB
        );

        CREATE TABLE IF NOT EXISTS ad_completions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            impression_id UUID REFERENCES ad_impressions(id) ON DELETE SET NULL,
            creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON ad_impressions(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_impressions_creative ON ad_impressions(creative_id);
        CREATE INDEX IF NOT EXISTS idx_impressions_timestamp ON ad_impressions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_clicks_campaign ON ad_clicks(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_clicks_creative ON ad_clicks(creative_id);
        CREATE INDEX IF NOT EXISTS idx_completions_campaign ON ad_completions(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_completions_creative ON ad_completions(creative_id);
    `);

    // Create campaign daily stats table for aggregated metrics
    await global.testPool.query(`
        CREATE TABLE IF NOT EXISTS campaign_daily_stats (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            stat_date DATE NOT NULL,
            impressions INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            completions INTEGER DEFAULT 0,
            spend DECIMAL(10, 2) DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(campaign_id, stat_date)
        );

        CREATE INDEX IF NOT EXISTS idx_campaign_daily_stats_campaign ON campaign_daily_stats(campaign_id);
        CREATE INDEX IF NOT EXISTS idx_campaign_daily_stats_date ON campaign_daily_stats(stat_date);
    `);
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