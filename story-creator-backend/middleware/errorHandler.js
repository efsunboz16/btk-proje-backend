const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error('Error Handler:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    // CORS errors
    if (err.message === 'CORS policy violation') {
        return res.status(403).json({
            success: false,
            message: 'CORS policy violation - Origin not allowed'
        });
    }

    // JSON parsing errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Geçersiz JSON formatı'
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Geçersiz veri',
            errors: err.errors
        });
    }

    // Default error
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Sunucu hatası';

    res.status(statusCode).json({
        success: false,
        message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            error: err 
        })
    });
};

module.exports = errorHandler;