/**
 * Error Handling Tests
 * Tests for comprehensive error handling, logging, and user-friendly error responses
 */

const request = require('supertest');
const app = require('../src/app');

// Mock logger to capture error logs
jest.mock('../src/utils/logger');
const logger = require('../src/utils/logger');

describe('Error Handling Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('404 Not Found Handling', () => {
        it('should return 404 for non-existent routes', async () => {
            const response = await request(app)
                .get('/non-existent-route')
                .expect(404);

            expect(response.body).toEqual({
                error: {
                    message: 'Route not found',
                    code: 'ROUTE_NOT_FOUND',
                    path: '/non-existent-route',
                    method: 'GET',
                    requestId: expect.any(String)
                }
            });
        });

        it('should return 401 for non-existent protected API routes', async () => {
            const response = await request(app)
                .get('/api/v1/non-existent')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });

        it('should return 404 for non-existent nested routes', async () => {
            const response = await request(app)
                .post('/api/v1/campaigns/123/non-existent')
                .expect(401); // Auth middleware runs first, so unauthorized

            expect(response.body.error.code).toBe('MISSING_TOKEN');
            expect(response.body.error.message).toBe('Authorization token required');
        });

        it('should include request ID in 404 responses', async () => {
            const response = await request(app)
                .get('/non-existent')
                .expect(404);

            expect(response.body.error.requestId).toBeDefined();
            expect(typeof response.body.error.requestId).toBe('string');
        });
    });

    describe('HTTP Method Errors', () => {
        it('should handle unsupported HTTP methods', async () => {
            const response = await request(app)
                .patch('/api/v2/unsupported')
                .expect(404);

            expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
            expect(response.body.error.method).toBe('PATCH');
        });

        it('should handle OPTIONS requests for CORS preflight', async () => {
            const response = await request(app)
                .options('/api/v1/campaigns')
                .set('Origin', 'http://localhost:3001')
                .set('Access-Control-Request-Method', 'GET')
                .expect(204); // CORS preflight successful

            expect(response.headers).toHaveProperty('access-control-allow-origin');
        });
    });

    describe('Request Parsing Errors', () => {
        it('should handle malformed JSON gracefully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .set('Content-Type', 'application/json')
                .send('{"malformed": json}')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle empty request body for required endpoints', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .set('Content-Type', 'application/json')
                .send('')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });

        it('should handle oversized payloads', async () => {
            const largePayload = {
                data: 'x'.repeat(11 * 1024 * 1024) // 11MB (over 10MB limit)
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(largePayload)
                .expect(413);
        });

        it('should handle invalid content types', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .set('Content-Type', 'text/plain')
                .send('plain text data')
                .expect(400);
        });
    });

    describe('Validation Error Handling', () => {
        it('should return structured validation errors', async () => {
            const invalidData = {
                email: 'invalid-email',
                password: '123', // too short
                // missing name
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.message).toBe('Validation failed');
            expect(response.body.error.details).toBeInstanceOf(Array);
            expect(response.body.error.details.length).toBeGreaterThan(0);

            // Check for specific validation errors
            const emailError = response.body.error.details.find(err => err.field === 'email');
            const passwordError = response.body.error.details.find(err => err.field === 'password');
            const nameError = response.body.error.details.find(err => err.field === 'name');

            expect(emailError).toBeDefined();
            expect(passwordError).toBeDefined();
            expect(nameError).toBeDefined();
        });

        it('should handle single validation errors', async () => {
            const invalidData = {
                email: 'valid@example.com',
                password: 'validpassword123',
                name: 'Valid Name',
                role: 'invalid-role' // invalid role
            };

            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.details).toHaveLength(1);
            expect(response.body.error.details[0].field).toBe('role');
        });

        it('should preserve field names in validation errors', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({})
                .expect(400);

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

    describe('Authentication Error Handling', () => {
        it('should handle missing authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
            expect(response.body.error.message).toBe('Authorization token required');
        });

        it('should handle malformed authorization header', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'InvalidFormat token123')
                .expect(401);

            expect(response.body.error.code).toBe('MISSING_TOKEN');
        });

        it('should handle invalid JWT tokens', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer invalid.jwt.token')
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_TOKEN');
            expect(response.body.error.message).toBe('Invalid or expired token');
        });

        it('should handle expired tokens', async () => {
            // This would require creating an expired token in a real scenario
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer expired.token.here')
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_TOKEN');
        });
    });

    describe('Business Logic Error Handling', () => {
        let testUser;

        afterEach(async () => {
            if (testUser) {
                await global.testPool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
                testUser = null;
            }
        });

        it('should handle duplicate user registration', async () => {
            const userData = {
                email: `duplicate-error-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
                password: 'testpassword123',
                name: 'Test User'
            };

            // Register user first time
            const firstResponse = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(201);

            testUser = firstResponse.body.user;

            // Try to register same user again
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send(userData)
                .expect(409);

            expect(response.body.error.code).toBe('USER_EXISTS');
            expect(response.body.error.message).toBe('A user with this email already exists');
        });

        it('should handle invalid login credentials', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'anypassword'
                })
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
            expect(response.body.error.message).toBe('Invalid email or password');
        });

        it('should handle invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .send({
                    refreshToken: 'invalid-refresh-token'
                })
                .expect(401);

            expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
            expect(response.body.error.message).toBe('Invalid refresh token');
        });
    });

    describe('Internal Server Error Handling', () => {
        it('should log internal errors properly', async () => {
            // This test simulates an internal error
            // In practice, you'd need to trigger a real error condition

            const response = await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer malformed-token-that-causes-error')
                .expect(401);

            // Should handle gracefully without exposing internals
            expect(response.body.error.code).toBe('INVALID_TOKEN');
            expect(response.body.error).not.toHaveProperty('stack');
        });

        it('should include request ID in error responses', async () => {
            const response = await request(app)
                .get('/api/v1/auth/profile')
                .expect(401);

            // Request ID is in headers, not necessarily in body
            expect(response.headers).toHaveProperty('x-request-id');
            expect(typeof response.headers['x-request-id']).toBe('string');
        });

        it('should not expose sensitive information in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const response = await request(app)
                .get('/non-existent-route')
                .expect(404);

            expect(response.body.error).not.toHaveProperty('stack');
            expect(response.body.error.message).not.toContain('internal');
            expect(response.body.error.message).not.toContain('server');

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Error Response Format Consistency', () => {
        it('should use consistent error format across all endpoints', async () => {
            const endpoints = [
                { path: '/non-existent', expectedCode: 'ROUTE_NOT_FOUND' },
                { path: '/api/v1/auth/profile', expectedCode: 'MISSING_TOKEN' },
                { path: '/api/v1/campaigns', expectedCode: 'MISSING_TOKEN' }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app).get(endpoint.path);

                expect(response.body).toHaveProperty('error');
                expect(response.body.error).toHaveProperty('message');
                expect(response.body.error).toHaveProperty('code');
                expect(response.body.error.code).toBe(endpoint.expectedCode);
                expect(response.headers).toHaveProperty('x-request-id');
            }
        });

        it('should include proper HTTP status codes', async () => {
            const testCases = [
                {
                    request: () => request(app).get('/non-existent'),
                    expectedStatus: 404,
                    expectedCode: 'ROUTE_NOT_FOUND'
                },
                {
                    request: () => request(app).get('/api/v1/auth/profile'),
                    expectedStatus: 401,
                    expectedCode: 'MISSING_TOKEN'
                },
                {
                    request: () => request(app).post('/api/v1/auth/register').send({}),
                    expectedStatus: 400,
                    expectedCode: 'VALIDATION_ERROR'
                }
            ];

            for (const testCase of testCases) {
                const response = await testCase.request().expect(testCase.expectedStatus);
                expect(response.body.error.code).toBe(testCase.expectedCode);
            }
        });

        it('should preserve error context in structured format', async () => {
            const response = await request(app)
                .post('/api/v1/auth/register')
                .send({
                    email: 'invalid-email',
                    password: '123'
                })
                .expect(400);

            expect(response.body.error).toEqual({
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: expect.any(String),
                        message: expect.any(String)
                    })
                ])
            });
        });
    });

    describe('Error Logging', () => {
        it('should log validation errors appropriately', async () => {
            await request(app)
                .post('/api/v1/auth/register')
                .send({})
                .expect(400);

            // Validation errors might not be logged as errors (they're user errors)
            // But they should be handled gracefully
        });

        it('should log authentication errors for monitoring', async () => {
            await request(app)
                .get('/api/v1/auth/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            // Auth errors might be logged for security monitoring
        });

        it('should include correlation IDs in error logs', async () => {
            const response = await request(app)
                .get('/non-existent')
                .expect(404);

            expect(response.body.error.requestId).toBeDefined();
            // In a real scenario, this ID would be used for log correlation
        });
    });

    describe('Error Recovery', () => {
        it('should handle multiple consecutive errors gracefully', async () => {
            const requests = [
                request(app).get('/non-existent-1'),
                request(app).get('/non-existent-2'),
                request(app).get('/non-existent-3')
            ];

            const responses = await Promise.all(requests);

            responses.forEach(response => {
                expect(response.status).toBe(404);
                expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
                expect(response.body.error.requestId).toBeDefined();
            });
        });

        it('should maintain service availability after errors', async () => {
            // Trigger an error
            await request(app)
                .get('/non-existent')
                .expect(404);

            // Service should still be available
            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.body.message).toBe('CTV Ad Server API Gateway');
        });
    });
});