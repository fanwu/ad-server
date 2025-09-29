/**
 * Unit tests for RedisService utility
 */

jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

jest.mock('redis', () => {
    const clients = [];

    const createClient = jest.fn(() => {
        const handlers = {};

        const client = {
            on: jest.fn((event, handler) => {
                handlers[event] = handler;
            }),
            connect: jest.fn(async () => {
                if (handlers.connect) {
                    handlers.connect();
                }
            }),
            disconnect: jest.fn(async () => {
                if (handlers.disconnect) {
                    handlers.disconnect();
                }
            }),
            get: jest.fn(),
            set: jest.fn(),
            setEx: jest.fn(),
            del: jest.fn(),
            __handlers: handlers
        };

        clients.push(client);
        return client;
    });

    return {
        createClient,
        __clients: clients,
        __getLastClient: () => clients[clients.length - 1] || null,
        __resetClients: () => { clients.length = 0; }
    };
});

const logger = require('../src/utils/logger');
const redis = require('redis');

const loadService = () => {
    let redisService;
    jest.isolateModules(() => {
        redisService = require('../src/services/redisService');
    });
    return redisService;
};

const resetEnvironment = () => {
    redis.__resetClients();
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
};

describe('RedisService', () => {
    beforeEach(() => {
        resetEnvironment();
    });

    test('connect establishes connection and updates state', async () => {
        const redisService = loadService();

        await redisService.connect();

        const client = redis.__getLastClient();
        expect(client).toBeTruthy();
        expect(client.connect).toHaveBeenCalledTimes(1);
        expect(redisService.isConnected).toBe(true);
        expect(logger.info).toHaveBeenCalledWith('Redis connection established');
    });

    test('connect propagates failure and logs error', async () => {
        const error = new Error('connect failed');
        redis.createClient.mockImplementationOnce(() => ({
            on: jest.fn(),
            connect: jest.fn(async () => { throw error; }),
            disconnect: jest.fn(),
            get: jest.fn(),
            set: jest.fn(),
            setEx: jest.fn(),
            del: jest.fn()
        }));

        const redisService = loadService();

        await expect(redisService.connect()).rejects.toThrow('connect failed');
        expect(logger.error).toHaveBeenCalledWith('Failed to connect to Redis:', error);
    });

    test('connect hooks react to disconnect and error events', async () => {
        const redisService = loadService();

        await redisService.connect();
        const client = redis.__getLastClient();
        const handlers = client.__handlers;
        const error = new Error('boom');

        handlers.error(error);
        expect(logger.error).toHaveBeenCalledWith('Redis Client Error:', error);
        expect(redisService.isConnected).toBe(false);

        handlers.connect();
        expect(redisService.isConnected).toBe(true);

        handlers.disconnect();
        expect(logger.warn).toHaveBeenCalledWith('Redis Client Disconnected');
        expect(redisService.isConnected).toBe(false);
    });

    test('get returns null and warns when not connected', async () => {
        const redisService = loadService();

        await expect(redisService.get('missing')).resolves.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith('Redis not connected, skipping get operation');
    });

    test('get returns value when connected', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        client.get.mockResolvedValueOnce('value');

        await expect(redisService.get('key')).resolves.toBe('value');
        expect(client.get).toHaveBeenCalledWith('key');
    });

    test('get logs error and returns null on failure', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        const error = new Error('get failed');
        client.get.mockRejectedValueOnce(error);

        await expect(redisService.get('key')).resolves.toBeNull();
        expect(logger.error).toHaveBeenCalledWith('Redis get error:', error);
    });

    test('set returns false and warns when not connected', async () => {
        const redisService = loadService();

        await expect(redisService.set('key', 'value')).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith('Redis not connected, skipping set operation');
    });

    test('set stores value without TTL when connected', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        client.set.mockResolvedValueOnce('OK');

        await expect(redisService.set('key', 'value')).resolves.toBe(true);
        expect(client.set).toHaveBeenCalledWith('key', 'value');
        expect(client.setEx).not.toHaveBeenCalled();
    });

    test('set stores value with TTL when provided', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        client.setEx.mockResolvedValueOnce('OK');

        await expect(redisService.set('key', 'value', 60)).resolves.toBe(true);
        expect(client.setEx).toHaveBeenCalledWith('key', 60, 'value');
        expect(client.set).not.toHaveBeenCalled();
    });

    test('set handles client errors gracefully', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        const error = new Error('set failed');
        client.set.mockRejectedValueOnce(error);

        await expect(redisService.set('key', 'value')).resolves.toBe(false);
        expect(logger.error).toHaveBeenCalledWith('Redis set error:', error);
    });

    test('setex delegates to set with TTL', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        client.setEx.mockResolvedValueOnce('OK');

        await expect(redisService.setex('key', 120, 'value')).resolves.toBe(true);
        expect(client.setEx).toHaveBeenCalledWith('key', 120, 'value');
    });

    test('del returns false and warns when not connected', async () => {
        const redisService = loadService();

        await expect(redisService.del('key')).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith('Redis not connected, skipping delete operation');
    });

    test('del removes key when connected', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        client.del.mockResolvedValueOnce(1);

        await expect(redisService.del('key')).resolves.toBe(true);
        expect(client.del).toHaveBeenCalledWith('key');
    });

    test('del logs error and returns false on failure', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        const error = new Error('del failed');
        client.del.mockRejectedValueOnce(error);

        await expect(redisService.del('key')).resolves.toBe(false);
        expect(logger.error).toHaveBeenCalledWith('Redis delete error:', error);
    });

    test('disconnect closes client connection', async () => {
        const redisService = loadService();
        await redisService.connect();
        const client = redis.__getLastClient();
        expect(redisService.isConnected).toBe(true);

        await redisService.disconnect();
        expect(client.disconnect).toHaveBeenCalledTimes(1);
        expect(redisService.isConnected).toBe(false);
        expect(logger.info).toHaveBeenCalledWith('Redis connection closed');
    });
});
