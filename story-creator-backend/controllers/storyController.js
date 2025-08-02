const questionService = require('../services/questionService'); // Singleton import
const responseHelper = require('../utils/responseHelper');
const logger = require('../utils/logger');

class StoryController {
    constructor() {
        this.questionService = questionService; // Singleton kullan, new yapma!
    }

    // Get all categories
    async getCategories(req, res) {
        try {
            logger.info('Getting categories...');
            
            const categories = await this.questionService.generateCategories();
            
            responseHelper.success(res, categories, 'Kategoriler başarıyla getirildi');
            
        } catch (error) {
            responseHelper.error(res, 'Kategoriler yüklenemedi', 500, error);
        }
    }

    // Get questions by category
    async getQuestionsByCategory(req, res) {
        try {
            const { categoryId } = req.params;
            const { categoryName } = req.query;
            
            // Validation
            if (!categoryId) {
                return responseHelper.validation(res, 'Kategori ID gereklidir');
            }
            
            logger.info(`Getting questions for category: ${categoryId}`);
            
            const questions = await this.questionService.generateQuestionsForCategory(
                categoryId, 
                categoryName || categoryId
            );
            
            responseHelper.success(res, questions, 'Sorular başarıyla getirildi');
            
        } catch (error) {
            responseHelper.error(res, 'Sorular yüklenemedi', 500, error);
        }
    }

    // Create story
    async createStory(req, res) {
        try {
            const { categoryId, answers, categoryName } = req.body;
            
            // Validation
            if (!categoryId) {
                return responseHelper.validation(res, 'Kategori ID gereklidir');
            }
            
            if (!answers || typeof answers !== 'object') {
                return responseHelper.validation(res, 'Cevaplar gereklidir');
            }
            
            if (Object.keys(answers).length === 0) {
                return responseHelper.validation(res, 'En az bir cevap gereklidir');
            }
            
            logger.info(`Creating story for category: ${categoryId}`);
            
            const story = await this.questionService.generateStory(
                categoryId, 
                answers,
                categoryName
            );
            
            const result = {
                story,
                categoryId,
                categoryName,
                answers,
                createdAt: new Date().toISOString(),
                wordCount: story.split(' ').length
            };
            
            responseHelper.success(res, result, 'Hikaye başarıyla oluşturuldu', 201);
            
        } catch (error) {
            responseHelper.error(res, 'Hikaye oluşturulamadı', 500, error);
        }
    }

    // Get service stats
    async getStats(req, res) {
        try {
            const cacheStats = this.questionService.getCacheStats();
            
            const stats = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cache: cacheStats,
                timestamp: new Date().toISOString()
            };
            
            responseHelper.success(res, stats, 'İstatistikler getirildi');
            
        } catch (error) {
            responseHelper.error(res, 'İstatistikler alınamadı', 500, error);
        }
    }

    // Clear cache
    async clearCache(req, res) {
        try {
            this.questionService.clearCache();
            responseHelper.success(res, null, 'Cache temizlendi');
            
        } catch (error) {
            responseHelper.error(res, 'Cache temizlenemedi', 500, error);
        }
    }

    // Health check for Gemini service
    async healthCheck(req, res) {
        try {
            // Check if Gemini service is healthy
            const isHealthy = await this.questionService.geminiService.healthCheck();
            
            if (isHealthy) {
                responseHelper.success(res, { gemini: 'healthy' }, 'Servis sağlıklı');
            } else {
                responseHelper.error(res, 'Gemini servisi yanıt vermiyor', 503);
            }
            
        } catch (error) {
            responseHelper.error(res, 'Sağlık kontrolü başarısız', 503, error);
        }
    }
}

module.exports = new StoryController();