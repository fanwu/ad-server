/**
 * Health route tests covering success and failure paths
 */

const request = require('supertest');

jest.mock('../src/services/redisService', () => ({
    isConnected: true,
    set: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
}));

jest.mock('../src/services/authService', () => ({
    pool: {
        query: jest.fn()
    }
}));

const redisService = require('../src/services/redisService');
const authService = require('../src/services/authService');
const app = require('../src/app');

describe('GET /health', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        redisService.isConnected = true;
        redisService.set.mockResolvedValue();
        redisService.get.mockResolvedValue('ok');
        authService.pool.query.mockResolvedValue({ rows: [] });
    });

    test('returns OK status when dependencies are healthy', async () => {
        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
        expect(response.body.checks.redis.status).toBe('OK');
        expect(response.body.checks.database.status).toBe('OK');
    });

    test('reports redis disconnected state gracefully', async () => {
        redisService.isConnected = false;

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body.checks.redis.status).toBe('DISCONNECTED');
        expect(redisService.set).not.toHaveBeenCalled();
        expect(redisService.get).not.toHaveBeenCalled();
    });

    test('returns 503 when redis operations throw', async () => {
        const error = new Error('redis failure');
        redisService.set.mockRejectedValueOnce(error);

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('ERROR');
        expect(response.body.checks.redis.status).toBe('ERROR');
        expect(response.body.checks.redis.error).toBe(error.message);
    });

    test('returns 503 when database check fails', async () => {
        const error = new Error('db failure');
        authService.pool.query.mockRejectedValueOnce(error);

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body.status).toBe('ERROR');
        expect(response.body.checks.database.status).toBe('ERROR');
        expect(response.body.checks.database.error).toBe(error.message);
    });
});
