const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/search/trending
 * @desc    Get trending search terms based on actual user search data
 * @access  Public
 */
router.get('/trending', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const limit = parseInt(req.query.limit) || 8;

        // Aggregate search history to find most popular terms
        // This assumes we're tracking search queries in a collection
        const trendingSearches = await db.collection('search_history').aggregate([
            // Filter out searches from the last 30 days
            {
                $match: {
                    createdAt: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            // Group by search term and count occurrences
            {
                $group: {
                    _id: '$searchTerm',
                    count: { $sum: 1 }
                }
            },
            // Sort by count descending
            {
                $sort: { count: -1 }
            },
            // Limit results
            {
                $limit: limit
            },
            // Project only the search term
            {
                $project: {
                    _id: 0,
                    term: '$_id'
                }
            }
        ]).toArray();

        // Extract just the terms as an array
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
            message: 'خطا در دریافت جستجوهای محبوب',
            trending: []
        });
    }
});

/**
 * @route   POST /api/search/track
 * @desc    Track a search query for trending analytics
 * @access  Public
 */
router.post('/track', async (req, res) => {
    try {
        const { searchTerm } = req.body;

        if (!searchTerm || !searchTerm.trim()) {
            return res.status(400).json({
                success: false,
                message: 'عبارت جستجو الزامی است'
            });
        }

        const db = req.app.locals.db;

        // Save the search term with timestamp
        await db.collection('search_history').insertOne({
            searchTerm: searchTerm.trim(),
            userId: req.user?.id || null, // If user is authenticated
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: 'جستجو ثبت شد'
        });

    } catch (error) {
        console.error('Error tracking search:', error);
        res.status(500).json({
            success: false,
            message: 'خطا در ثبت جستجو'
        });
    }
});

/**
 * @route   GET /api/search/suggestions
 * @desc    Get search suggestions based on partial input
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

        // Get suggestions from products and search history
        const productSuggestions = await db.collection('products')
            .find({
                $or: [
                    { title: { $regex: q, $options: 'i' } },
                    { description: { $regex: q, $options: 'i' } },
                    { tags: { $regex: q, $options: 'i' } }
                ],
                isActive: true
            })
            .limit(limit)
            .project({ title: 1 })
            .toArray();

        const suggestions = [...new Set(productSuggestions.map(p => p.title))];

        res.json({
            success: true,
            suggestions
        });

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'خطا در دریافت پیشنهادات',
            suggestions: []
        });
    }
});

module.exports = router;
