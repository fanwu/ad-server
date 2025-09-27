const express = require('express');
const authService = require('../services/authService');
const { validateRequest, schemas } = require('../middleware/validation');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Register new user
router.post('/register', validateRequest(schemas.register), async (req, res) => {
    try {
        const { email, password, name, role } = req.validatedBody;

        const user = await authService.createUser({ email, password, name, role });
        const tokens = authService.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role
        });

        logger.info('User registered successfully', {
            requestId: req.requestId,
            userId: user.id,
            email: user.email,
            role: user.role
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                createdAt: user.created_at
            },
            tokens
        });
    } catch (error) {
        logger.error('Registration failed', {
            requestId: req.requestId,
            error: error.message,
            email: req.validatedBody?.email
        });

        if (error.message === 'User already exists') {
            return res.status(409).json({
                error: {
                    message: 'A user with this email already exists',
                    code: 'USER_EXISTS'
                }
            });
        }

        res.status(500).json({
            error: {
                message: 'Failed to create user',
                code: 'REGISTRATION_FAILED'
            }
        });
    }
});

// Login user
router.post('/login', validateRequest(schemas.login), async (req, res) => {
    try {
        const { email, password } = req.validatedBody;

        const user = await authService.authenticateUser(email, password);
        const tokens = authService.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role
        });

        logger.info('User logged in successfully', {
            requestId: req.requestId,
            userId: user.id,
            email: user.email
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            tokens
        });
    } catch (error) {
        logger.warn('Login failed', {
            requestId: req.requestId,
            error: error.message,
            email: req.validatedBody?.email
        });

        if (error.message === 'Invalid credentials' || error.message === 'Account is not active') {
            return res.status(401).json({
                error: {
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                }
            });
        }

        res.status(500).json({
            error: {
                message: 'Login failed',
                code: 'LOGIN_FAILED'
            }
        });
    }
});

// Get current user profile (protected route)
router.get('/profile', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            status: req.user.status,
            createdAt: req.user.created_at
        }
    });
});

// Logout (invalidate token)
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Add token to blacklist
        await authService.blacklistToken(req.token);

        logger.info('User logged out', {
            requestId: req.requestId,
            userId: req.user.id
        });

        res.json({
            message: 'Logout successful'
        });
    } catch (error) {
        logger.error('Logout failed', {
            requestId: req.requestId,
            error: error.message,
            userId: req.user?.id
        });

        res.status(500).json({
            error: {
                message: 'Logout failed',
                code: 'LOGOUT_FAILED'
            }
        });
    }
});

// Refresh token
router.post('/refresh', validateRequest(schemas.refreshToken), async (req, res) => {
    try {
        const { refreshToken } = req.validatedBody;

        const decoded = await authService.verifyToken(refreshToken);
        const user = await authService.getUserById(decoded.id);

        const newTokens = authService.generateTokens({
            id: user.id,
            email: user.email,
            role: user.role
        });

        // Blacklist old refresh token
        await authService.blacklistToken(refreshToken);

        logger.info('Token refreshed', {
            requestId: req.requestId,
            userId: user.id
        });

        res.json({
            message: 'Token refreshed successfully',
            tokens: newTokens
        });
    } catch (error) {
        logger.warn('Token refresh failed', {
            requestId: req.requestId,
            error: error.message
        });

        res.status(401).json({
            error: {
                message: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            }
        });
    }
});

module.exports = router;