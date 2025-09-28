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

afterEach(async () => {
    // Clean up test data from database
    if (global.testPool) {
        await global.testPool.query("DELETE FROM users WHERE email LIKE 'test-%@%'");
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
            // Run basic user table creation for tests
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
            console.log('Test database schema setup complete');
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
    }
};