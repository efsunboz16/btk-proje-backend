const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const logger = require('../utils/logger');

// Middleware to log all story routes
router.use((req, res, next) => {
    logger.info(`Story API: ${req.method} ${req.path}`);
    next();
});

// Get all categories - bind ile this context'i koruyor
router.get('/categories', storyController.getCategories.bind(storyController));

// Get questions by category ID
router.get('/questions/:categoryId', storyController.getQuestionsByCategory.bind(storyController));

// Create a new story
router.post('/create', storyController.createStory.bind(storyController));

// Get service statistics
router.get('/stats', storyController.getStats.bind(storyController));

// Clear cache
router.post('/cache/clear', storyController.clearCache.bind(storyController));

// Health check
router.get('/health', storyController.healthCheck.bind(storyController));

module.exports = router;