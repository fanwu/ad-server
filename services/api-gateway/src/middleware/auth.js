const authService = require('../services/authService');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    message: 'Authorization token required',
                    code: 'MISSING_TOKEN'
                }
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        try {
            const decoded = await authService.verifyToken(token);

            // Get fresh user data
            const user = await authService.getUserById(decoded.id);

            req.user = user;
            req.token = token;

            next();
        } catch (tokenError) {
            logger.warn('Token verification failed:', tokenError.message);
            return res.status(401).json({
                error: {
                    message: 'Invalid or expired token',
                    code: 'INVALID_TOKEN'
                }
            });
        }
    } catch (error) {
        logger.error('Auth middleware error:', error);
        return res.status(500).json({
            error: {
                message: 'Authentication service error',
                code: 'AUTH_SERVICE_ERROR'
            }
        });
    }
};

module.exports = authMiddleware;