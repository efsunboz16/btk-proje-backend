const express = require('express');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');

// Import middleware
const corsMiddleware = require('./middleware/cors');
const rateLimitMiddleware = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const storyRoutes = require('./routes/storyRoutes');

// Import utils
const logger = require('./utils/logger');

const app = express();

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS middleware
app.use(corsMiddleware);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ 
    limit: '10mb',
    strict: true
}));

app.use(express.urlencoded({ 
    extended: true,
    limit: '10mb'
}));

// Rate limiting middleware
app.use('/api/', rateLimitMiddleware);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: require('./package.json').version
    });
});

// API routes
app.use('/api/stories', storyRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: 'Endpoint bulunamadı',
        path: req.originalUrl
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;