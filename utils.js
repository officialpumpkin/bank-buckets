// Shared utility functions for Bank Buckets application

const Utils = {
    /**
     * Escape HTML entities to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML string
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    },

    /**
     * Generate a unique ID for various entities
     * @param {string} prefix - Prefix for the ID (e.g., 'bucket', 'tx')
     * @returns {string} Unique ID
     */
    generateUniqueId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },

    /**
     * Generate a consistent transaction ID from transaction data
     * This ensures the same transaction always gets the same ID
     * @param {Object} tx - Transaction object or individual fields
     * @param {Date|string} tx.date - Transaction date
     * @param {string} tx.description - Transaction description
     * @param {number} tx.amount - Transaction amount
     * @returns {string} Consistent transaction ID
     */
    generateTransactionId(tx) {
        // Handle both object form and individual property access
        const date = tx.transaction_date || tx.posted_date || tx.date || '';
        const desc = (tx.description || tx.user_description || '').substring(0, 50);
        const amount = parseFloat(tx.amount) || 0;
        const account = tx.account_number || '';
        
        // Create a consistent string representation
        const str = `${date}-${desc}-${amount.toFixed(2)}-${account}`;
        
        // Generate hash
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return `tx_${Math.abs(hash)}`;
    },

    /**
     * Format a number as currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (default: AUD)
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount, currency = 'AUD') {
        const formatter = new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: currency
        });
        return formatter.format(amount);
    },

    /**
     * Format a date for display
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date string (YYYY-MM-DD)
     */
    formatDate(date) {
        if (!date) return null;
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    },

    /**
     * Parse a date string to Date object
     * @param {string} dateStr - Date string to parse
     * @returns {Date|null} Parsed Date or null if invalid
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    },

    /**
     * Debounce a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Deep clone an object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if a value is a valid number
     * @param {*} value - Value to check
     * @returns {boolean} True if valid number
     */
    isValidNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
    },

    /**
     * Safely parse a JSON string
     * @param {string} jsonStr - JSON string to parse
     * @param {*} defaultValue - Default value if parsing fails
     * @returns {*} Parsed value or default
     */
    safeJsonParse(jsonStr, defaultValue = null) {
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.warn('JSON parse error:', e);
            return defaultValue;
        }
    },

    /**
     * Calculate string similarity (for duplicate detection)
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score 0-1
     */
    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 1.0;
        if (!str1 || !str2) return 0.0;

        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        const words1 = s1.split(/\s+/).filter(w => w.length > 2);
        const words2 = s2.split(/\s+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) {
            return s1.includes(s2) || s2.includes(s1) ? 0.6 : 0.0;
        }

        const matches = words1.filter(w1 => 
            words2.some(w2 => w1.includes(w2) || w2.includes(w1))
        ).length;

        return matches / Math.max(words1.length, words2.length);
    }
};

// Make available globally
window.Utils = Utils;
