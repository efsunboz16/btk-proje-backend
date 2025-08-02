const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

class GeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            logger.error('GEMINI_API_KEY is not configured');
            throw new Error('Gemini API key is required');
        }

        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.9,
                topK: 1,
                topP: 1,
                maxOutputTokens: 2048,
            }
        });
        
        logger.info('Gemini service initialized successfully');
    }

    async generateContent(prompt, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                logger.debug(`Gemini API call attempt ${attempt}/${retries}`);
                
                const result = await this.model.generateContent(prompt); // prompt bir string olmalı
                const text = result.response.text();
                
                if (!text || text.trim().length === 0) {
                    throw new Error('Empty response from Gemini API');
                }
                
                logger.debug('Gemini API call successful');
                return text;
                
            } catch (error) {
                logger.warn(`Gemini API attempt ${attempt} failed:`, error.message);
                
                if (attempt === retries) {
                    logger.error('All Gemini API attempts failed:', error);
                    throw new Error(`Gemini API failed after ${retries} attempts: ${error.message}`);
                }
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    // JSON response'u temizleyen yardımcı fonksiyon
    extractJSON(responseText) {
        try {
            // Kod bloğu işaretlerini temizle
            let clean = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // Sadece ilk { ile son } arasını al
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            // Son çare, tümünü parse etmeye çalış
            return JSON.parse(clean);
        } catch (error) {
            logger.warn('Could not extract JSON from response:', error.message);
            logger.debug('Problematic response:', responseText);
            throw new Error('Invalid JSON response format');
        }
    }

    async healthCheck() {
        try {
            const result = await this.generateContent('Test connection. Respond with: OK');
            return result.includes('OK');
        } catch (error) {
            logger.error('Gemini health check failed:', error);
            return false;
        }
    }
}

const geminiService = new GeminiService(); // Singleton instance

module.exports = geminiService;