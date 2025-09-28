module.exports = {
    rootDir: __dirname,
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/services/api-gateway/tests/setup.js'],
    testMatch: [
        '<rootDir>/services/**/tests/**/*.integration.test.js'
    ],
    testTimeout: 15000,
    verbose: false,
};
