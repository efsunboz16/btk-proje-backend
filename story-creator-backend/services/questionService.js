const geminiService = require('./geminiService'); // Singleton import
const logger = require('../utils/logger');

class QuestionService {
    constructor() {
        this.geminiService = geminiService; // Singleton kullan
        this.categoryCache = new Map();
        this.questionCache = new Map();
        
        // Cache TTL (1 hour)
        this.cacheTTL = 60 * 60 * 1000;
    }

    // JSON response'u temizleyen yardımcı fonksiyon
    extractJSON(responseText) {
        try {
            let clean = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();

            // Sadece ilk { ile son } arasını al
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                clean = jsonMatch[0];
            }

            // JSON tamamlanmamışsa, son geçerli } veya ]'ye kadar kırp
            let lastBrace = clean.lastIndexOf('}');
            let lastBracket = clean.lastIndexOf(']');
            let cutIndex = Math.max(lastBrace, lastBracket);
            if (cutIndex !== -1 && cutIndex !== clean.length - 1) {
                clean = clean.substring(0, cutIndex + 1);
            }

            // Sonunda virgül varsa sil
            clean = clean.replace(/,\s*}$/, '}').replace(/,\s*]$/, ']');

            return JSON.parse(clean);
        } catch (error) {
            logger.warn('Could not extract JSON from response:', error.message);
            logger.debug('Problematic response:', responseText);
            throw new Error('Invalid JSON response format');
        }
    }

    async generateCategories(useCache = true) {
        const cacheKey = 'categories';
        
        // Check cache first
        if (useCache && this.categoryCache.has(cacheKey)) {
            const cached = this.categoryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                logger.debug('Returning cached categories');
                return cached.data;
            }
        }

        const prompt = `Çocuklar için hikaye kategorileri oluştur. 8-12 yaş arası çocuklara uygun olacak şekilde.
Kesinlikle sadece JSON formatında döndür, başka açıklama ekleme:

{
    "categories": [
        {
            "id": "macera",
            "name": "Macera",
            "description": "Heyecan dolu maceralar",
            "icon": "🏴‍☠️",
            "color": "#FF6B6B"
        }
    ]
}

Kurallar:
- 6 adet kategori oluştur
- Her kategori benzersiz ve çekici olsun
- Türkçe isimler kullan
- Renkler hex formatında olsun
- Çocuklara uygun emojiler kullan
- Sadece JSON döndür, başka metin ekleme`;

        try {
            const response = await this.geminiService.generateContent(prompt);
            
            if (!response || response.trim() === '') {
                throw new Error('Empty response from Gemini API');
            }

            logger.debug('Raw Gemini response for categories:', response.substring(0, 200) + '...');
            
            const data = this.extractJSON(response);
            
            if (data && data.categories && Array.isArray(data.categories)) {
                // Validate categories
                const validCategories = data.categories.filter(cat => 
                    cat.id && cat.name && cat.description && cat.icon
                );

                if (validCategories.length === 0) {
                    throw new Error('No valid categories found');
                }

                const result = { categories: validCategories };

                // Cache the result
                this.categoryCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                
                logger.info(`Generated ${validCategories.length} categories`);
                return result;
            }
            
            throw new Error('Invalid categories response format');
            
        } catch (error) {
            logger.error('Failed to generate categories:', error);
            return this.getFallbackCategories();
        }
    }

    async generateQuestionsForCategory(categoryId, categoryName, useCache = true) {
        const cacheKey = `questions_${categoryId}`;
        
        // Check cache first
        if (useCache && this.questionCache.has(cacheKey)) {
            const cached = this.questionCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                logger.debug(`Returning cached questions for ${categoryId}`);
                return cached.data;
            }
        }

        const prompt = `"${categoryName}" kategorisi için çocuk hikayesi oluşturmak amacıyla sorular üret.
Sorular çocuğun yaratıcılığını tetiklesin ve hikaye öğelerini belirlesin.

Kesinlikle sadece JSON formatında döndür:
{
    "questions": [
        {
            "id": 1,
            "type": "text",
            "question": "Ana karakterin adı ne olsun?",
            "placeholder": "Örneğin: Ayşe, Mehmet...",
            "required": true
        },
        {
            "id": 2,
            "type": "select",
            "question": "Hikaye nerede geçsin?",
            "options": ["Orman", "Şehir", "Uzay", "Okul"],
            "required": true
        }
    ]
}

Kurallar:
- 5 adet soru oluştur
- Sorular basit ve daha genel olmalı
- Soru tipleri: "select", "textarea"
- Textarea sorusu sadece en başta ve kahramının adını soracak
- Her soru ${categoryName} temasına uygun olsun
- Select sorularında 4 seçenek olsun
- Yaş grubu: 8-12 yaş
- Türkçe sorular oluştur
- Yanıtın kesinlikle geçerli ve tamamlanmış JSON olsun. Eksik bırakma, kod bloğu kullanma.
- Sadece JSON döndür`;

        try {
            const response = await this.geminiService.generateContent(prompt);
            
            if (!response || response.trim() === '') {
                return this.getFallbackQuestions(categoryId);
            }

            logger.debug(`Raw Gemini response for questions (${categoryId}):`, response.substring(0, 200) + '...');
            
            const data = this.extractJSON(response);
            
            if (data && data.questions && Array.isArray(data.questions)) {
                // Validate questions
                const validQuestions = data.questions.filter(q => 
                    q.id && q.question && q.type
                );

                if (validQuestions.length === 0) {
                    return this.getFallbackQuestions(categoryId);
                }

                const result = { questions: validQuestions };

                // Cache the result
                this.questionCache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });
                
                logger.info(`Generated ${validQuestions.length} questions for ${categoryId}`);
                return result;
            }
            
            throw new Error('Invalid questions response format');
            
        } catch (error) {
            logger.error(`Failed to generate questions for ${categoryId}:`, error);
            return this.getFallbackQuestions(categoryId);
        }
    }

    async generateStory(categoryId, answers, categoryName) {
        // Eğer answers bir dizi ise, anahtar-değer ilişkisi yoktur, sadece stringleri birleştir
        let answersText;
        if (Array.isArray(answers)) {
            answersText = answers.join(', ');
        } else if (typeof answers === 'object' && answers !== null) {
            // Anahtar-değer ilişkisi varsa
            answersText = Object.entries(answers)
                .map(([key, value]) => {
                    if (Array.isArray(value)) {
                        return `${key}: ${value.join(', ')}`;
                    }
                    return `${key}: ${value}`;
                })
                .join('\n');
        } else {
            answersText = String(answers);
        }

        const prompt = `Verilen cevapları kullanarak çocuklar için bir hikaye yaz.

Kategori: ${categoryName || categoryId}
Hikaye Öğeleri:
${answersText}

Hikaye Kuralları:
-Tarih: ${new Date().toISOString()}
-Aşağıdaki kategori ve cevaplara göre 8-12 yaş arası çocuklar için, her biri en fazla 3 cümlelik 10 sayfalık tamamen yeni ve özgün bir hikaye yaz.
- Her istekte, daha önce yazdıklarından tamamen farklı, yaratıcı ve şaşırtıcı bir hikaye üret.
- Aynı hikayeyi asla tekrar etme. Hikaye özgün karakterler, olaylar ve mekanlar içersin.
- Toplam 300 kelime kullan 
- Verilen öğeleri mutlaka kullan
- Yaratıcı ve ilgi çekici olsun
- Çocuğun hayal gücünü beslesin
- Daha önce yazdığın hikayelerden farklı, yeni bir hikaye oluştur.

Hikaye Öğeleri:
${answersText}

Kategori: ${categoryName || categoryId}

Sadece hikayeyi yaz, başka açıklama ekleme.`;

        try {
            const story = await this.geminiService.generateContent(prompt);
            
            if (!story || story.trim().length < 100) {
                throw new Error('Generated story is too short');
            }
            
            logger.info(`Generated story for ${categoryId} (${story.length} characters)`);
            return story.trim();
            
        } catch (error) {
            logger.error('Failed to generate story:', error);
            throw new Error('Hikaye oluşturulamadı. Lütfen tekrar deneyin.');
        }
    }

    // Fallback categories
    getFallbackCategories() {
        logger.info('Using fallback categories');
        return {
            categories: [
                {
                    id: "macera",
                    name: "Macera",
                    description: "Heyecan dolu maceralar",
                    icon: "🏴‍☠️",
                    color: "#FF6B6B"
                },
                {
                    id: "dostluk",
                    name: "Dostluk",
                    description: "Arkadaşlık hikayeleri",
                    icon: "👫",
                    color: "#4ECDC4"
                },
                {
                    id: "hayvanlar",
                    name: "Hayvanlar",
                    description: "Sevimli hayvan arkadaşlar",
                    icon: "🐾",
                    color: "#45B7D1"
                },
                {
                    id: "buyulu",
                    name: "Büyülü Dünya",
                    description: "Sihir ve fantezi",
                    icon: "✨",
                    color: "#96CEB4"
                },
                {
                    id: "uzay",
                    name: "Uzay",
                    description: "Galaksi maceraları",
                    icon: "🚀",
                    color: "#FFEAA7"
                },
                {
                    id: "aile",
                    name: "Aile",
                    description: "Aile değerleri",
                    icon: "👨‍👩‍👧‍👦",
                    color: "#DDA0DD"
                },
                {
                    id: "okul",
                    name: "Okul",
                    description: "Okul maceraları",
                    icon: "🏫",
                    color: "#87CEEB"
                },
                {
                    id: "dogal",
                    name: "Doğa",
                    description: "Doğa ve çevre",
                    icon: "🌳",
                    color: "#98FB98"
                }
            ]
        };
    }

    // Fallback questions
    getFallbackQuestions(categoryId) {
        logger.info(`Using fallback questions for ${categoryId}`);
        
        const questionSets = {
            macera: {
                questions: [
                    {
                        id: 1,
                        type: "text",
                        question: "Maceracı karakterin adı ne olsun?",
                        placeholder: "Örneğin: Kerem, Ayşe...",
                        required: true
                    },
                    {
                        id: 2,
                        type: "select",
                        question: "Macera nerede geçsin?",
                        options: ["Gizemli Orman", "Kayıp Ada", "Eski Kale", "Derin Mağara"],
                        required: true
                    },
                    {
                        id: 3,
                        type: "text",
                        question: "Hangi hazineyi buluyor?",
                        placeholder: "Örneğin: Altın para, Sihirli taş...",
                        required: true
                    },
                    {
                        id: 4,
                        type: "select",
                        question: "En büyük engel nedir?",
                        options: ["Ejder", "Bulmaca", "Büyülü Kapı", "Labirent"],
                        required: true
                    },
                    {
                        id: 5,
                        type: "textarea",
                        question: "Karakterin özel yeteneği nedir?",
                        placeholder: "Örneğin: Çok hızlı koşar, iyi tırmanır...",
                        required: false
                    }
                ]
            },
            dostluk: {
                questions: [
                    {
                        id: 1,
                        type: "text",
                        question: "Ana karakterin adı?",
                        placeholder: "Örneğin: Elif, Mehmet...",
                        required: true
                    },
                    {
                        id: 2,
                        type: "text",
                        question: "Yeni arkadaşının adı?",
                        placeholder: "Örneğin: Luna, Berk...",
                        required: true
                    },
                    {
                        id: 3,
                        type: "select",
                        question: "Nasıl tanışıyorlar?",
                        options: ["Okulda", "Parkta", "Kamp alanında", "Kütüphanede"],
                        required: true
                    },
                    {
                        id: 4,
                        type: "select",
                        question: "Birlikte ne yapıyorlar?",
                        options: ["Oyun oynuyorlar", "Proje hazırlıyorlar", "Yardımlaşıyorlar", "Keşif yapıyorlar"],
                        required: true
                    }
                ]
            }
        };

        return questionSets[categoryId] || {
            questions: [
                {
                    id: 1,
                    type: "text",
                    question: "Ana karakterin adı ne olsun?",
                    placeholder: "Karaktere bir isim ver...",
                    required: true
                },
                {
                    id: 2,
                    type: "select",
                    question: "Hikaye nerede geçsin?",
                    options: ["Evde", "Okulda", "Parkta", "Başka bir şehirde"],
                    required: true
                },
                {
                    id: 3,
                    type: "textarea",
                    question: "Ne tür bir macera yaşasın?",
                    placeholder: "Karakterin başına gelen ilginç olayı anlat...",
                    required: true
                }
            ]
        };
    }

    // Clear cache
    clearCache() {
        this.categoryCache.clear();
        this.questionCache.clear();
        logger.info('Cache cleared');
    }

    // Get cache stats
    getCacheStats() {
        return {
            categories: this.categoryCache.size,
            questions: this.questionCache.size
        };
    }
}

module.exports = new QuestionService();