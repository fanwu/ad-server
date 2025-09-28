/**
 * Unit Tests for Middleware Components
 */

const authMiddleware = require('../src/middleware/auth');
const { validateRequest, schemas } = require('../src/middleware/validation');
const loggingMiddleware = require('../src/middleware/logging');

// Mock dependencies
jest.mock('../src/services/authService');
jest.mock('../src/utils/logger');

const authService = require('../src/services/authService');
const logger = require('../src/utils/logger');

describe('Middleware Tests', () => {
    let req, res, next;

    beforeEach(() => {
        // Create mock request, response, and next function
        req = {
            headers: {},
            body: {},
            get: jest.fn(),
            ip: '127.0.0.1',
            method: 'GET',
            url: '/test',
            connection: { remoteAddress: '127.0.0.1' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn()
        };

        next = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('Auth Middleware', () => {
        describe('Token Validation', () => {
            it('should reject request without authorization header', async () => {
                await authMiddleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Authorization token required',
                        code: 'MISSING_TOKEN'
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should reject request with invalid authorization header format', async () => {
                req.headers.authorization = 'InvalidFormat token123';

                await authMiddleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Authorization token required',
                        code: 'MISSING_TOKEN'
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should reject request with invalid token', async () => {
                req.headers.authorization = 'Bearer invalid-token';
                authService.verifyToken.mockRejectedValueOnce(new Error('Invalid token'));

                await authMiddleware(req, res, next);

                expect(authService.verifyToken).toHaveBeenCalledWith('invalid-token');
                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Invalid or expired token',
                        code: 'INVALID_TOKEN'
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should authenticate valid token and fetch user data', async () => {
                const token = 'valid-jwt-token';
                const decodedToken = { id: 'user-123', email: 'test@example.com' };
                const userData = { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'advertiser' };

                req.headers.authorization = `Bearer ${token}`;
                authService.verifyToken.mockResolvedValueOnce(decodedToken);
                authService.getUserById.mockResolvedValueOnce(userData);

                await authMiddleware(req, res, next);

                expect(authService.verifyToken).toHaveBeenCalledWith(token);
                expect(authService.getUserById).toHaveBeenCalledWith(decodedToken.id);
                expect(req.user).toEqual(userData);
                expect(req.token).toBe(token);
                expect(next).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });

            it('should handle user not found after token verification', async () => {
                const token = 'valid-jwt-token';
                const decodedToken = { id: 'user-123', email: 'test@example.com' };

                req.headers.authorization = `Bearer ${token}`;
                authService.verifyToken.mockResolvedValueOnce(decodedToken);
                authService.getUserById.mockRejectedValueOnce(new Error('User not found'));

                await authMiddleware(req, res, next);

                expect(authService.verifyToken).toHaveBeenCalledWith(token);
                expect(authService.getUserById).toHaveBeenCalledWith(decodedToken.id);
                expect(res.status).toHaveBeenCalledWith(401);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Invalid or expired token',
                        code: 'INVALID_TOKEN'
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should handle service errors gracefully', async () => {
                // Simulate an error in the authorization header parsing
                // by making the headers property throw an error
                Object.defineProperty(req, 'headers', {
                    get() {
                        throw new Error('Request headers unavailable');
                    }
                });

                await authMiddleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Authentication service error',
                        code: 'AUTH_SERVICE_ERROR'
                    }
                });
                expect(logger.error).toHaveBeenCalled();
                expect(next).not.toHaveBeenCalled();
            });
        });
    });

    describe('Validation Middleware', () => {
        describe('validateRequest function', () => {
            it('should pass validation with valid data', () => {
                req.body = {
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User'
                };

                const middleware = validateRequest(schemas.register);
                middleware(req, res, next);

                expect(req.validatedBody).toEqual({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    role: 'advertiser' // default value
                });
                expect(next).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });

            it('should reject validation with invalid email', () => {
                req.body = {
                    email: 'invalid-email',
                    password: 'password123',
                    name: 'Test User'
                };

                const middleware = validateRequest(schemas.register);
                middleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'email',
                                message: 'Please provide a valid email address'
                            })
                        ])
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should reject validation with short password', () => {
                req.body = {
                    email: 'test@example.com',
                    password: '123',
                    name: 'Test User'
                };

                const middleware = validateRequest(schemas.register);
                middleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'password',
                                message: 'Password must be at least 8 characters long'
                            })
                        ])
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should reject validation with missing required fields', () => {
                req.body = {
                    email: 'test@example.com'
                    // missing password and name
                };

                const middleware = validateRequest(schemas.register);
                middleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'password',
                                message: 'Password is required'
                            }),
                            expect.objectContaining({
                                field: 'name',
                                message: 'Name is required'
                            })
                        ])
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });

            it('should strip unknown fields from request body', () => {
                req.body = {
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    unknownField: 'should be removed',
                    anotherUnknown: 123
                };

                const middleware = validateRequest(schemas.register);
                middleware(req, res, next);

                expect(req.validatedBody).toEqual({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    role: 'advertiser'
                });
                expect(req.validatedBody).not.toHaveProperty('unknownField');
                expect(req.validatedBody).not.toHaveProperty('anotherUnknown');
                expect(next).toHaveBeenCalled();
            });
        });

        describe('Login schema validation', () => {
            it('should validate login data correctly', () => {
                req.body = {
                    email: 'test@example.com',
                    password: 'anypassword'
                };

                const middleware = validateRequest(schemas.login);
                middleware(req, res, next);

                expect(req.validatedBody).toEqual({
                    email: 'test@example.com',
                    password: 'anypassword'
                });
                expect(next).toHaveBeenCalled();
            });

            it('should reject login with invalid email', () => {
                req.body = {
                    email: 'not-an-email',
                    password: 'anypassword'
                };

                const middleware = validateRequest(schemas.login);
                middleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(next).not.toHaveBeenCalled();
            });
        });

        describe('Refresh token schema validation', () => {
            it('should validate refresh token correctly', () => {
                req.body = {
                    refreshToken: 'valid-refresh-token'
                };

                const middleware = validateRequest(schemas.refreshToken);
                middleware(req, res, next);

                expect(req.validatedBody).toEqual({
                    refreshToken: 'valid-refresh-token'
                });
                expect(next).toHaveBeenCalled();
            });

            it('should reject missing refresh token', () => {
                req.body = {};

                const middleware = validateRequest(schemas.refreshToken);
                middleware(req, res, next);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: expect.arrayContaining([
                            expect.objectContaining({
                                field: 'refreshToken',
                                message: 'Refresh token is required'
                            })
                        ])
                    }
                });
                expect(next).not.toHaveBeenCalled();
            });
        });
    });

    describe('Logging Middleware', () => {
        let dateNowSpy;
        let dateToISOStringSpy;

        beforeEach(() => {
            // Mock Date.now for consistent timing tests
            dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
            dateToISOStringSpy = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
        });

        afterEach(() => {
            dateNowSpy.mockRestore();
            dateToISOStringSpy.mockRestore();
        });

        it('should add request ID and log incoming request', () => {
            req.get.mockReturnValue('Test User Agent');

            loggingMiddleware(req, res, next);

            expect(req.requestId).toBeDefined();
            expect(typeof req.requestId).toBe('string');
            expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
            expect(logger.info).toHaveBeenCalledWith('Incoming request', {
                requestId: req.requestId,
                method: 'GET',
                url: '/test',
                userAgent: 'Test User Agent',
                ip: '127.0.0.1',
                timestamp: '2023-01-01T00:00:00.000Z'
            });
            expect(next).toHaveBeenCalled();
        });

        it('should log successful response with duration', () => {
            loggingMiddleware(req, res, next);

            // Simulate time passing
            dateNowSpy.mockReturnValue(1500); // 500ms later

            // Trigger response logging by calling res.json
            const responseBody = { success: true };
            res.statusCode = 200;
            res.json(responseBody);

            expect(logger.info).toHaveBeenCalledWith('Outgoing response', {
                requestId: req.requestId,
                method: 'GET',
                url: '/test',
                statusCode: 200,
                duration: '500ms',
                responseSize: JSON.stringify(responseBody).length,
                timestamp: '2023-01-01T00:00:00.000Z'
            });
        });

        it('should log error response with warning', () => {
            loggingMiddleware(req, res, next);

            // Simulate time passing
            dateNowSpy.mockReturnValue(1200); // 200ms later

            // Trigger error response logging
            const errorBody = { error: { message: 'Not found' } };
            res.statusCode = 404;
            res.json(errorBody);

            expect(logger.info).toHaveBeenCalledWith('Outgoing response', expect.any(Object));
            expect(logger.warn).toHaveBeenCalledWith('Request resulted in error', {
                requestId: req.requestId,
                method: 'GET',
                url: '/test',
                statusCode: 404,
                duration: '200ms',
                error: errorBody.error,
                timestamp: '2023-01-01T00:00:00.000Z'
            });
        });

        it('should handle missing User-Agent gracefully', () => {
            req.get.mockReturnValue(undefined);

            loggingMiddleware(req, res, next);

            expect(logger.info).toHaveBeenCalledWith('Incoming request', {
                requestId: req.requestId,
                method: 'GET',
                url: '/test',
                userAgent: undefined,
                ip: '127.0.0.1',
                timestamp: '2023-01-01T00:00:00.000Z'
            });
        });

        it('should use connection.remoteAddress when req.ip is not available', () => {
            req.ip = undefined;
            req.connection.remoteAddress = '192.168.1.1';

            loggingMiddleware(req, res, next);

            expect(logger.info).toHaveBeenCalledWith('Incoming request', {
                requestId: req.requestId,
                method: 'GET',
                url: '/test',
                userAgent: undefined,
                ip: '192.168.1.1',
                timestamp: '2023-01-01T00:00:00.000Z'
            });
        });

        it('should preserve original res.json functionality', () => {
            const originalJson = jest.fn();
            res.json = originalJson;

            loggingMiddleware(req, res, next);

            const responseBody = { data: 'test' };
            res.json(responseBody);

            expect(originalJson).toHaveBeenCalledWith(responseBody);
        });
    });
});