const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const redis = require('./redisService');
const logger = require('../utils/logger');

class AuthService {
    constructor() {
        this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    }

    async hashPassword(password) {
        return bcrypt.hash(password, 12);
    }

    async comparePassword(password, hash) {
        return bcrypt.compare(password, hash);
    }

    generateTokens(payload) {
        const accessToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn
        });

        const refreshToken = jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.refreshTokenExpiresIn
        });

        return { accessToken, refreshToken };
    }

    async verifyToken(token) {
        try {
            // Check if token is blacklisted
            const isBlacklisted = await redis.get(`blacklist:${token}`);
            if (isBlacklisted) {
                throw new Error('Token has been revoked');
            }

            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    async blacklistToken(token, expiresIn = 86400) {
        await redis.setex(`blacklist:${token}`, expiresIn, 'true');
    }

    async createUser(userData) {
        const { email, password, name, role = 'advertiser' } = userData;

        // Check if user exists
        const existingUser = await this.pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            throw new Error('User already exists');
        }

        // Hash password and create user
        const hashedPassword = await this.hashPassword(password);
        const result = await this.pool.query(
            `INSERT INTO users (email, password_hash, name, role, status)
             VALUES ($1, $2, $3, $4, 'active')
             RETURNING id, email, name, role, created_at`,
            [email, hashedPassword, name, role]
        );

        return result.rows[0];
    }

    async authenticateUser(email, password) {
        const result = await this.pool.query(
            'SELECT id, email, password_hash, name, role, status FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            throw new Error('Account is not active');
        }

        const isValidPassword = await this.comparePassword(password, user.password_hash);
        if (!isValidPassword) {
            throw new Error('Invalid credentials');
        }

        // Remove password hash from returned user object
        const { password_hash, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }

    async getUserById(userId) {
        const result = await this.pool.query(
            'SELECT id, email, name, role, status, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw new Error('User not found');
        }

        return result.rows[0];
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = new AuthService();