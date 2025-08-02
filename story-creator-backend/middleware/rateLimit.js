const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const windowMs = (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000; // 15 minutes
const max = parseInt(process.env.RATE_LIMIT_MAX) || 100; // 100 requests per window

const rateLimitMiddleware = rateLimit({
    windowMs,
    max,
    message: {
        success: false,
        message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.',
        retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.',
            retryAfter: Math.ceil(windowMs / 1000)
        });
    }
});

module.exports = rateLimitMiddleware;