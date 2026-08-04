const express = require('express');
const router = express.Router();
const { createCustomLimiter } = require('../middleware/rateLimiter');

const searchTrackLimiter = createCustomLimiter({
    name: 'search-track',
    windowMs: 60 * 1000,
    max: 30,
    keyType: 'ip',
});

// ============================================
// Persian/Arabic Character Normalization for Search
// ============================================
function buildPersianSearchRegex(text) {
    if (!text) return text
    const equivalences = [
        ['\u06cc', '\u064a', '\u0626'],
        ['\u06a9', '\u0643'],
        ['\u0647', '\u0629'],
        ['\u0622', '\u0623', '\u0625', '\u0627'],
        ['\u0648', '\u0624'],
        ['\u06f0', '\u0660', '0'], ['\u06f1', '\u0661', '1'], ['\u06f2', '\u0662', '2'],
        ['\u06f3', '\u0663', '3'], ['\u06f4', '\u0664', '4'], ['\u06f5', '\u0665', '5'],
        ['\u06f6', '\u0666', '6'], ['\u06f7', '\u0667', '7'], ['\u06f8', '\u0668', '8'],
        ['\u06f9', '\u0669', '9'],
    ]
    const charMap = new Map()
    for (const group of equivalences) {
        const charClass = `[${group.join('')}]`
        for (const ch of group) charMap.set(ch, charClass)
    }
    const regexSpecial = /[.*+?^${}()|[\]\\]/g
    let pattern = ''
    for (const ch of text) {
        if (charMap.has(ch)) pattern += charMap.get(ch)
        else if (regexSpecial.test(ch)) pattern += '\\' + ch
        else pattern += ch
    }
    return pattern
}

/**
 * @route   GET /api/search/trending
 * @desc    Get trending search terms based on actual user search data
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const limit = parseInt(req.query.limit) || 8;

        const trendingSearches = await db.collection('search_history').aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: '$searchTerm',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: limit
            },
            {
                $project: {
                    _id: 0,
                    term: '$_id'
                }
            }
        ]).toArray();

        const trending = trendingSearches.map(item => item.term);

        res.json({
            success: true,
            trending,
            count: trending.length
        });

    } catch (error) {
        console.error('Error fetching trending searches:', error);
        res.status(500).json({
            success: false,
            message: '\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u062c\u0633\u062a\u062c\u0648\u0647\u0627\u06cc \u0645\u062d\u0628\u0648\u0628',
            trending: []
        });
    }
});

/**
 * @route   POST /api/search/track
 * @desc    Track a search query for trending analytics
 * @access  Public
 */
router.post('/track', searchTrackLimiter, async (req, res) => {
    try {
        const { searchTerm } = req.body;

        if (!searchTerm || !searchTerm.trim()) {
            return res.status(400).json({
                success: false,
                message: '\u0639\u0628\u0627\u0631\u062a \u062c\u0633\u062a\u062c\u0648 \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a'
            });
        }

        const db = req.app.locals.db;

        await db.collection('search_history').insertOne({
            searchTerm: searchTerm.trim(),
            userId: req.user?.id || null,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: '\u062c\u0633\u062a\u062c\u0648 \u062b\u0628\u062a \u0634\u062f'
        });

    } catch (error) {
        console.error('Error tracking search:', error);
        res.status(500).json({
            success: false,
            message: '\u062e\u0637\u0627 \u062f\u0631 \u062b\u0628\u062a \u062c\u0633\u062a\u062c\u0648'
        });
    }
});

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions based on partial input (with Persian/Arabic normalization)
 * @access  Public
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        const limit = parseInt(req.query.limit) || 5;

        if (!q || !q.trim()) {
            return res.json({
                success: true,
                suggestions: []
            });
        }

        const db = req.app.locals.db;
        const normalizedPattern = buildPersianSearchRegex(q.trim())

        // Get suggestions from products with normalized search
        const productSuggestions = await db.collection('products')
            .find({
                $or: [
                    { name: { $regex: normalizedPattern, $options: 'i' } },
                    { title: { $regex: normalizedPattern, $options: 'i' } },
                    { tags: { $regex: normalizedPattern, $options: 'i' } }
                ],
                isActive: true
            })
            .limit(limit)
            .project({ name: 1, title: 1 })
            .toArray();

        const suggestions = [...new Set(productSuggestions.map(p => p.name || p.title))];

        res.json({
            success: true,
            suggestions
        });

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({
            success: false,
            message: '\u062e\u0637\u0627 \u062f\u0631 \u062f\u0631\u06cc\u0627\u0641\u062a \u067e\u06cc\u0634\u0646\u0647\u0627\u062f\u0627\u062a',
            suggestions: []
        });
    }
});

module.exports = router;
