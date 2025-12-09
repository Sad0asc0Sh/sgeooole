/**
 * Search Service
 * Handles search-related API calls including trending searches, tracking, and suggestions
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface TrendingSearchesResponse {
    success: boolean;
    trending: string[];
    count: number;
}

interface SearchSuggestionsResponse {
    success: boolean;
    suggestions: string[];
}

/**
 * Fetch trending search terms from the API
 */
export async function getTrendingSearches(limit: number = 8): Promise<string[]> {
    try {
        const response = await fetch(`${API_BASE_URL}/search/trending?limit=${limit}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch trending searches');
        }

        const data: TrendingSearchesResponse = await response.json();
        return data.trending || [];
    } catch (error) {
        console.error('Error fetching trending searches:', error);
        return [];
    }
}

/**
 * Track a search query for analytics
 */
export async function trackSearch(searchTerm: string): Promise<void> {
    if (!searchTerm || !searchTerm.trim()) return;

    try {
        await fetch(`${API_BASE_URL}/search/track`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ searchTerm: searchTerm.trim() }),
        });
    } catch (error) {
        // Silent fail - tracking shouldn't break the app
        console.error('Error tracking search:', error);
    }
}

/**
 * Get search suggestions based on partial input
 */
export async function getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || !query.trim()) return [];

    try {
        const response = await fetch(
            `${API_BASE_URL}/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch search suggestions');
        }

        const data: SearchSuggestionsResponse = await response.json();
        return data.suggestions || [];
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        return [];
    }
}

export const searchService = {
    getTrendingSearches,
    trackSearch,
    getSearchSuggestions,
};
