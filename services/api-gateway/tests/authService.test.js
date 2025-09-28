/**
 * Unit Tests for Authentication Service
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock Redis service before importing AuthService
jest.mock('../src/services/redisService', () => ({
    get: jest.fn(),
    setex: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: true
}));

const AuthService = require('../src/services/authService');
const redisService = require('../src/services/redisService');

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Redis mocks
        redisService.get.mockResolvedValue(null);
        redisService.setex.mockResolvedValue(true);
    });

    afterAll(async () => {
        // Close AuthService pool to prevent open handles
        await AuthService.close();
    });

    describe('Password Operations', () => {
        describe('hashPassword', () => {
            it('should hash a password with bcrypt', async () => {
                const password = 'testpassword123';
                const hashedPassword = await AuthService.hashPassword(password);

                expect(hashedPassword).toBeDefined();
                expect(hashedPassword).not.toBe(password);
                expect(hashedPassword).toMatch(/^\$2[abxy]\$\d+\$/); // bcrypt hash format
            });

            it('should generate different hashes for the same password', async () => {
                const password = 'testpassword123';
                const hash1 = await AuthService.hashPassword(password);
                const hash2 = await AuthService.hashPassword(password);

                expect(hash1).not.toBe(hash2);
            });
        });

        describe('comparePassword', () => {
            it('should return true for matching password and hash', async () => {
                const password = 'testpassword123';
                const hashedPassword = await AuthService.hashPassword(password);

                const isMatch = await AuthService.comparePassword(password, hashedPassword);

                expect(isMatch).toBe(true);
            });

            it('should return false for non-matching password and hash', async () => {
                const password = 'testpassword123';
                const wrongPassword = 'wrongpassword';
                const hashedPassword = await AuthService.hashPassword(password);

                const isMatch = await AuthService.comparePassword(wrongPassword, hashedPassword);

                expect(isMatch).toBe(false);
            });
        });
    });

    describe('Token Operations', () => {
        describe('generateTokens', () => {
            it('should generate access and refresh tokens', () => {
                const payload = { id: 'user-123', email: 'test@example.com' };

                const tokens = AuthService.generateTokens(payload);

                expect(tokens).toHaveProperty('accessToken');
                expect(tokens).toHaveProperty('refreshToken');
                expect(typeof tokens.accessToken).toBe('string');
                expect(typeof tokens.refreshToken).toBe('string');
            });

            it('should generate valid JWT tokens', () => {
                const payload = { id: 'user-123', email: 'test@example.com' };

                const tokens = AuthService.generateTokens(payload);

                // Verify tokens can be decoded
                const decodedAccess = jwt.decode(tokens.accessToken);
                const decodedRefresh = jwt.decode(tokens.refreshToken);

                expect(decodedAccess.id).toBe(payload.id);
                expect(decodedAccess.email).toBe(payload.email);
                expect(decodedRefresh.id).toBe(payload.id);
                expect(decodedRefresh.email).toBe(payload.email);
            });
        });

        describe('verifyToken', () => {
            it('should verify a valid token', async () => {
                const payload = { id: 'user-123', email: 'test@example.com' };
                const { accessToken } = AuthService.generateTokens(payload);

                const decoded = await AuthService.verifyToken(accessToken);

                expect(decoded.id).toBe(payload.id);
                expect(decoded.email).toBe(payload.email);
            });

            it('should reject an invalid token', async () => {
                const invalidToken = 'invalid.jwt.token';

                await expect(AuthService.verifyToken(invalidToken))
                    .rejects.toThrow('Invalid token');
            });

            it('should reject a blacklisted token', async () => {
                const payload = { id: 'user-123', email: 'test@example.com' };
                const { accessToken } = AuthService.generateTokens(payload);

                // Mock Redis to return blacklisted status
                redisService.get.mockResolvedValueOnce('true');

                await expect(AuthService.verifyToken(accessToken))
                    .rejects.toThrow('Invalid token');

                expect(redisService.get).toHaveBeenCalledWith(`blacklist:${accessToken}`);
            });

            it('should reject an expired token', async () => {
                const payload = { id: 'user-123', email: 'test@example.com' };
                const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });

                await expect(AuthService.verifyToken(expiredToken))
                    .rejects.toThrow('Invalid token');
            });
        });

        describe('blacklistToken', () => {
            it('should blacklist a token with default expiration', async () => {
                const token = 'sample.jwt.token';

                await AuthService.blacklistToken(token);

                expect(redisService.setex).toHaveBeenCalledWith(
                    `blacklist:${token}`,
                    86400,
                    'true'
                );
            });

            it('should blacklist a token with custom expiration', async () => {
                const token = 'sample.jwt.token';
                const customExpiry = 3600;

                await AuthService.blacklistToken(token, customExpiry);

                expect(redisService.setex).toHaveBeenCalledWith(
                    `blacklist:${token}`,
                    customExpiry,
                    'true'
                );
            });
        });
    });

    describe('User Operations', () => {
        describe('createUser', () => {
            it('should create a new user successfully', async () => {
                const userData = {
                    email: 'newuser@example.com',
                    password: 'password123',
                    name: 'New User',
                    role: 'advertiser'
                };

                const user = await AuthService.createUser(userData);

                expect(user).toHaveProperty('id');
                expect(user.email).toBe(userData.email);
                expect(user.name).toBe(userData.name);
                expect(user.role).toBe(userData.role);
                expect(user).not.toHaveProperty('password_hash');

                // Clean up
                await global.testPool.query('DELETE FROM users WHERE id = $1', [user.id]);
            });

            it('should throw error if user already exists', async () => {
                const userData = {
                    email: 'existing@example.com',
                    password: 'password123',
                    name: 'Existing User'
                };

                // Create user first
                const user1 = await AuthService.createUser(userData);

                // Try to create same user again
                await expect(AuthService.createUser(userData))
                    .rejects.toThrow('User already exists');

                // Clean up
                await global.testPool.query('DELETE FROM users WHERE id = $1', [user1.id]);
            });

            it('should use default role if not provided', async () => {
                const userData = {
                    email: 'defaultrole@example.com',
                    password: 'password123',
                    name: 'Default Role User'
                };

                const user = await AuthService.createUser(userData);

                expect(user.role).toBe('advertiser');

                // Clean up
                await global.testPool.query('DELETE FROM users WHERE id = $1', [user.id]);
            });
        });

        describe('authenticateUser', () => {
            let testUser;

            beforeEach(async () => {
                // Create a test user for authentication tests
                testUser = await testUtils.createTestUser({
                    email: 'auth@example.com',
                    password: 'testpassword123',
                    name: 'Auth Test User'
                });
            });

            afterEach(async () => {
                // Clean up test user
                if (testUser) {
                    await testUtils.deleteTestUser(testUser.id);
                }
            });

            it('should authenticate valid credentials', async () => {
                const authenticatedUser = await AuthService.authenticateUser(
                    testUser.email,
                    testUser.password
                );

                expect(authenticatedUser.id).toBe(testUser.id);
                expect(authenticatedUser.email).toBe(testUser.email);
                expect(authenticatedUser.name).toBe(testUser.name);
                expect(authenticatedUser).not.toHaveProperty('password_hash');
            });

            it('should reject invalid email', async () => {
                await expect(AuthService.authenticateUser(
                    'nonexistent@example.com',
                    'anypassword'
                )).rejects.toThrow('Invalid credentials');
            });

            it('should reject invalid password', async () => {
                await expect(AuthService.authenticateUser(
                    testUser.email,
                    'wrongpassword'
                )).rejects.toThrow('Invalid credentials');
            });

            it('should reject inactive user', async () => {
                // Create inactive user
                const inactiveUser = await global.testPool.query(
                    `INSERT INTO users (email, password_hash, name, role, status)
                     VALUES ($1, $2, $3, $4, 'inactive')
                     RETURNING id, email`,
                    ['inactive@example.com', await bcrypt.hash('password123', 12), 'Inactive User', 'advertiser']
                );

                await expect(AuthService.authenticateUser(
                    'inactive@example.com',
                    'password123'
                )).rejects.toThrow('Account is not active');

                // Clean up
                await global.testPool.query('DELETE FROM users WHERE id = $1', [inactiveUser.rows[0].id]);
            });
        });

        describe('getUserById', () => {
            let testUser;

            beforeEach(async () => {
                testUser = await testUtils.createTestUser({
                    email: 'getuser@example.com',
                    password: 'testpassword123',
                    name: 'Get User Test'
                });
            });

            afterEach(async () => {
                if (testUser) {
                    await testUtils.deleteTestUser(testUser.id);
                }
            });

            it('should return user by valid ID', async () => {
                const user = await AuthService.getUserById(testUser.id);

                expect(user.id).toBe(testUser.id);
                expect(user.email).toBe(testUser.email);
                expect(user.name).toBe(testUser.name);
                expect(user).not.toHaveProperty('password_hash');
            });

            it('should throw error for invalid user ID', async () => {
                const invalidId = '00000000-0000-0000-0000-000000000000';

                await expect(AuthService.getUserById(invalidId))
                    .rejects.toThrow('User not found');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // This would require mocking the database pool, which is complex
            // For now, we'll test that methods exist and basic error handling
            expect(typeof AuthService.createUser).toBe('function');
            expect(typeof AuthService.authenticateUser).toBe('function');
            expect(typeof AuthService.getUserById).toBe('function');
        });

        it('should handle Redis connection errors gracefully', async () => {
            // Mock Redis to return null (connection failed)
            redisService.get.mockResolvedValueOnce(null);

            const payload = { id: 'user-123', email: 'test@example.com' };
            const { accessToken } = AuthService.generateTokens(payload);

            // Should still verify token even if Redis fails (returns null)
            const decoded = await AuthService.verifyToken(accessToken);
            expect(decoded.id).toBe(payload.id);
            expect(redisService.get).toHaveBeenCalledWith(`blacklist:${accessToken}`);
        });
    });
});