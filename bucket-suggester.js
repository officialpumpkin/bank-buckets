// Automatic bucket suggestion based on transaction patterns

const BucketSuggester = {
    /**
     * Analyse transactions and suggest buckets
     * @param {Array} transactions - Array of transaction objects
     * @returns {Array} Array of suggested bucket objects
     */
    suggestBuckets(transactions) {
        const suggestions = [];

        // Analyse transaction descriptions for patterns
        const patternMap = new Map();

        transactions.forEach(tx => {
            // Get description text (prefer user_description, fallback to description)
            const descText = (tx.user_description || tx.description || '').toLowerCase();
            if (!descText) return;

            // Look for common patterns
            const patterns = this.extractPatterns(descText);
            
            patterns.forEach(pattern => {
                if (!patternMap.has(pattern)) {
                    patternMap.set(pattern, {
                        pattern: pattern,
                        keywords: new Set(),
                        count: 0,
                        examples: []
                    });
                }

                const entry = patternMap.get(pattern);
                entry.count++;
                entry.keywords.add(pattern);
                
                // Extract individual keywords
                const words = descText.split(/\s+/).filter(w => w.length > 3);
                words.forEach(word => entry.keywords.add(word));

                // Store example
                if (entry.examples.length < 3) {
                    entry.examples.push(tx.user_description || tx.description);
                }
            });
        });

        // Convert to suggestions, filtering by frequency
        patternMap.forEach((entry, pattern) => {
            if (entry.count >= 2) { // At least 2 occurrences
                const bucketName = this.generateBucketName(pattern);
                suggestions.push({
                    id: this.generateId(),
                    name: bucketName,
                    keywords: Array.from(entry.keywords).slice(0, 10), // Limit keywords
                    matchCount: entry.count,
                    examples: entry.examples,
                    suggested: true
                });
            }
        });

        // Sort by frequency
        suggestions.sort((a, b) => b.matchCount - a.matchCount);

        return suggestions;
    },

    /**
     * Extract patterns from transaction description
     */
    extractPatterns(text) {
        const patterns = [];
        const lowerText = text.toLowerCase();

        // Common patterns to look for
        const commonPatterns = [
            /transfer\s+to\s+(\w+)/i,
            /transfer\s+from\s+(\w+)/i,
            /(\w+)\s+fund/i,
            /(\w+)\s+buffer/i,
            /(\w+)\s+savings/i,
            /(\w+)\s+account/i,
            /loan\s+(\w+)/i,
            /(\w+)\s+repayment/i,
            /(\w+)\s+payment/i,
            /(\w+)\s+deposit/i
        ];

        commonPatterns.forEach(regex => {
            const match = lowerText.match(regex);
            if (match && match[1]) {
                patterns.push(match[1]);
            }
        });

        // If no pattern found, use first significant word
        if (patterns.length === 0) {
            const words = lowerText.split(/\s+/).filter(w => 
                w.length > 3 && 
                !['transfer', 'payment', 'deposit', 'withdrawal'].includes(w)
            );
            if (words.length > 0) {
                patterns.push(words[0]);
            }
        }

        return patterns;
    },

    /**
     * Generate a readable bucket name from pattern
     */
    generateBucketName(pattern) {
        // Capitalize first letter
        return pattern.charAt(0).toUpperCase() + pattern.slice(1) + ' Fund';
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return 'bucket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }
};

