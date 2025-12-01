import { useState, useEffect } from 'react';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 7;

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
            try {
                setHistory(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse search history', e);
            }
        }
    }, []);

    const addToHistory = (term: string) => {
        if (!term.trim()) return;

        setHistory((prev) => {
            // Remove duplicates and add to front
            const filtered = prev.filter((t) => t !== term);
            const newHistory = [term, ...filtered].slice(0, MAX_HISTORY);

            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const removeFromHistory = (term: string) => {
        setHistory((prev) => {
            const newHistory = prev.filter((t) => t !== term);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const clearHistory = () => {
        setHistory([]);
        localStorage.removeItem(HISTORY_KEY);
    };

    return { history, addToHistory, removeFromHistory, clearHistory };
}
