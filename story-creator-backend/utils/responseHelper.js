const logger = require('./logger');

const responseHelper = {
    success: (res, data, message = 'İşlem başarılı', statusCode = 200) => {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },

    error: (res, message = 'Bir hata oluştu', statusCode = 500, error = null) => {
        logger.error(`API Error: ${message}`, error);
        
        return res.status(statusCode).json({
            success: false,
            message,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && error && { error: error.message })
        });
    },

    validation: (res, message = 'Geçersiz veri', errors = []) => {
        return res.status(400).json({
            success: false,
            message,
            errors,
            timestamp: new Date().toISOString()
        });
    }
};

module.exports = responseHelper;