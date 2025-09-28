/**
 * Integration Tests for Authentication Endpoints
 * These tests use the actual Express app and database
 */

const request = require('supertest');
const app = require('../src/app');

describe('Authentication Integration Tests', () => {
    let testUser;
    let authToken;
    let refreshToken;

    // Clean up function for test users
    const cleanupTestUser = async (userId) => {
        if (userId) {
            await global.testPool.query('DELETE FROM users WHERE id = $1', [userId]);
        }
    };

    // Clean up function for test users by email
    const cleanupTestUserByEmail = async (email) => {
        await global.testPool.query('DELETE FROM users WHERE email = $1', [email]);
    };

    describe('POST /api/v1/auth/register', () => {
        afterEach(async () => {
            // Clean up any test users created
            if (testUser) {
                await cleanupTestUser(testUser.id);
                testUser = null;
            }
        });

        it('should register a new user successfully', async () => {
            const userData = {
                email: 'integration-test@example.com',
                password: 'testpassword123',
                name: 'Integration Test User',
                role: 'advertiser'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body).toHaveProperty('message', 'User created successfully');
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tokens');

            const { user, tokens } = response.body;
            expect(user.email).toBe(userData.email);
            expect(user.name).toBe(userData.name);
            expect(user.role).toBe(userData.role);
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('createdAt');
            expect(user).not.toHaveProperty('password');

            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');

            // Store for cleanup
            testUser = user;
        });

        it('should reject registration with invalid email', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'testpassword123',
                name: 'Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'email',
                        message: 'Please provide a valid email address'
                    })
                ])
            );
        });

        it('should reject registration with short password', async () => {
            const userData = {
                email: 'test@example.com',
                password: '123',
                name: 'Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'password',
                        message: 'Password must be at least 8 characters long'
                    })
                ])
            );
        });

        it('should reject registration with duplicate email', async () => {
            const userData = {
                email: 'duplicate-test@example.com',
                password: 'testpassword123',
                name: 'First User'
            };

            await cleanupTestUserByEmail(userData.email);

            // Register first user
            const firstResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = firstResponse.body.user;

            // Try to register with same email
            const duplicateData = {
                ...userData,
                name: 'Second User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(duplicateData)
                .expect(409);

            expect(response.body.error.message).toBe('A user with this email already exists');
            expect(response.body.error.code).toBe('USER_EXISTS');
        });

        it('should use default role when not specified', async () => {
            const userData = {
                email: 'default-role@example.com',
                password: 'testpassword123',
                name: 'Default Role User'
                // role not specified
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.user.role).toBe('advertiser');
            testUser = response.body.user;
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            // Create a test user for login tests
            const userData = {
                email: 'login-test@example.com',
                password: 'testpassword123',
                name: 'Login Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = response.body.user;
        });

        afterEach(async () => {
            if (testUser) {
                await cleanupTestUser(testUser.id);
                testUser = null;
            }
        });

        it('should login successfully with valid credentials', async () => {
            const loginData = {
                email: 'login-test@example.com',
                password: 'testpassword123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(200);

            expect(response.body).toHaveProperty('message', 'Login successful');
            expect(response.body).toHaveProperty('user');
            expect(response.body).toHaveProperty('tokens');

            const { user, tokens } = response.body;
            expect(user.email).toBe(loginData.email);
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('name');
            expect(user).toHaveProperty('role');
            expect(user).not.toHaveProperty('password');

            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');
        });

        it('should reject login with invalid email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'testpassword123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error.message).toBe('Invalid email or password');
            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        });

        it('should reject login with invalid password', async () => {
            const loginData = {
                email: 'login-test@example.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error.message).toBe('Invalid email or password');
            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        });

        it('should reject login with invalid email format', async () => {
            const loginData = {
                email: 'invalid-email-format',
                password: 'testpassword123'
            };

            const response = await request(app)
                .post('/api/v1/auth/login')
                .send(loginData)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject login with missing fields', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({})
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'email',
                        message: 'Email is required'
                    }),
                    expect.objectContaining({
                        field: 'password',
                        message: 'Password is required'
                    })
                ])
            );
        });
    });

    describe('GET /api/v1/auth/profile', () => {
        beforeEach(async () => {
            // Create a test user and get auth token
            const userData = {
                email: 'profile-test@example.com',
                password: 'testpassword123',
                name: 'Profile Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = response.body.user;
            authToken = response.body.tokens.accessToken;
        });

        afterEach(async () => {
            if (testUser) {
                await cleanupTestUser(testUser.id);
                testUser = null;
                authToken = null;
            }
        });

        it('should return user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('user');
            const { user } = response.body;
            expect(user.id).toBe(testUser.id);
            expect(user.email).toBe(testUser.email);
            expect(user.name).toBe(testUser.name);
            expect(user.role).toBe(testUser.role);
            expect(user).toHaveProperty('status');
            expect(user).toHaveProperty('createdAt');
        });

        it('should reject request without authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            expect(response.body.error.message).toBe('Authorization token required');
            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.error.message).toBe('Invalid or expired token');
            expect(response.body.error.code).toBe('INVALID_TOKEN');
        });

        it('should reject request with malformed authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'InvalidFormat token123')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        beforeEach(async () => {
            // Create a test user and get auth token
            const userData = {
                email: 'logout-test@example.com',
                password: 'testpassword123',
                name: 'Logout Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = response.body.user;
            authToken = response.body.tokens.accessToken;
        });

        afterEach(async () => {
            if (testUser) {
                await cleanupTestUser(testUser.id);
                testUser = null;
                authToken = null;
            }
        });

        it('should logout successfully with valid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.message).toBe('Logout successful');
        });

        it('should invalidate token after logout', async () => {
            // First logout
            await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            // Try to use the same token - should be rejected
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_TOKEN');
        });

        it('should reject logout without authorization', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });
    });

    describe('POST /api/v1/auth/refresh', () => {
        beforeEach(async () => {
            // Create a test user and get tokens
            const userData = {
                email: 'refresh-test@example.com',
                password: 'testpassword123',
                name: 'Refresh Test User'
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = response.body.user;
            authToken = response.body.tokens.accessToken;
            refreshToken = response.body.tokens.refreshToken;
        });

        afterEach(async () => {
            if (testUser) {
                await cleanupTestUser(testUser.id);
                testUser = null;
                authToken = null;
                refreshToken = null;
            }
        });

        it('should refresh tokens successfully with valid refresh token', async () => {
            // Wait 2 seconds to ensure different timestamps in JWT generation
            await new Promise(resolve => setTimeout(resolve, 2000));

            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            expect(response.body.message).toBe('Token refreshed successfully');
            expect(response.body).toHaveProperty('tokens');
            expect(response.body.tokens).toHaveProperty('accessToken');
            expect(response.body.tokens).toHaveProperty('refreshToken');

            // New tokens should be different from original
            expect(response.body.tokens.accessToken).not.toBe(authToken);
            expect(response.body.tokens.refreshToken).not.toBe(refreshToken);
        });

        it('should invalidate old refresh token after refresh', async () => {
            // First refresh
            const firstRefresh = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(200);

            // Try to use the old refresh token again - should fail
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken })
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
        });

        it('should reject refresh with invalid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: 'invalid-refresh-token' })
                .expect(401);

            expect(response.body.error.message).toBe('Invalid refresh token');
            expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
        });

        it('should reject refresh with missing refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({})
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.details).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        field: 'refreshToken',
                        message: 'Refresh token is required'
                    })
                ])
            );
        });
    });

    describe('Authentication Flow Integration', () => {
        afterEach(async () => {
            await cleanupTestUserByEmail('flow-test@example.com');
        });

        it('should complete full authentication flow', async () => {
            // 1. Register user
            const userData = {
                email: 'flow-test@example.com',
                password: 'testpassword123',
                name: 'Flow Test User'
            };

            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            const { user, tokens } = registerResponse.body;

            // 2. Access protected route with access token
            const profileResponse = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${tokens.accessToken}`)
                .expect(200);

            expect(profileResponse.body.user.id).toBe(user.id);

            // 3. Refresh tokens
            const refreshResponse = await request(app)
                .post('/api/v1/auth/refresh')
                .send({ refreshToken: tokens.refreshToken })
                .expect(200);

            const newTokens = refreshResponse.body.tokens;

            // 4. Use new access token
            const newProfileResponse = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${newTokens.accessToken}`)
                .expect(200);

            expect(newProfileResponse.body.user.id).toBe(user.id);

            // 5. Logout with new token
            await request(app)
                .post('/api/v1/auth/logout')
                .set('Authorization', `Bearer ${newTokens.accessToken}`)
                .expect(200);

            // 6. Verify token is blacklisted
            await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', `Bearer ${newTokens.accessToken}`)
                .expect(401);
        });

        it('should handle login after registration', async () => {
            const userData = {
                email: 'flow-test@example.com',
                password: 'testpassword123',
                name: 'Flow Test User'
            };

            // Register
            const registerResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            // Login with same credentials
            const loginResponse = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: userData.email,
                    password: userData.password
                })
                .expect(200);

            expect(loginResponse.body.user.email).toBe(userData.email);
            expect(loginResponse.body.user.id).toBe(registerResponse.body.user.id);
        });
    });
});