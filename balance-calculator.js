// Balance calculation logic for buckets

const BalanceCalculator = {
    /**
     * Calculate bucket balances based on transactions and starting allocations
     * @param {Array} buckets - Array of bucket objects with keywords
     * @param {Array} transactions - Array of transaction objects
     * @param {Object} startingAllocations - Object mapping bucket IDs to starting amounts and dates
     * @returns {Object} Object mapping bucket IDs to current balances
     */
    calculateBalances(buckets, transactions, startingAllocations) {
        const balances = {};

        // Initialize balances from starting allocations
        buckets.forEach(bucket => {
            const allocation = startingAllocations[bucket.id];
            if (allocation) {
                balances[bucket.id] = parseFloat(allocation.amount) || 0;
            } else {
                balances[bucket.id] = 0;
            }
        });

        // Sort transactions by date
        const sortedTransactions = [...transactions].sort((a, b) => {
            const dateA = new Date(a.transaction_date || a.posted_date || 0);
            const dateB = new Date(b.transaction_date || b.posted_date || 0);
            return dateA - dateB;
        });

        // Apply transactions to buckets
        sortedTransactions.forEach(tx => {
            // Skip ignored transactions
            if (tx.included === false) return;

            const amount = parseFloat(tx.amount) || 0;
            if (amount === 0) return;

            const txDate = new Date(tx.transaction_date || tx.posted_date || 0);

            // Determine if credit or debit
            const isCredit = tx.credit_debit?.toLowerCase() === 'credit' || amount > 0;
            const transactionAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

            // Find matching buckets
            const matchingBuckets = this.findMatchingBuckets(tx, buckets);

            if (matchingBuckets.length > 0) {
                // Distribute transaction across matching buckets
                matchingBuckets.forEach(bucket => {
                    if (balances[bucket.id] !== undefined) {
                        // Check if transaction is after starting allocation date
                        const allocation = startingAllocations[bucket.id];
                        if (allocation && allocation.date) {
                            const allocationDate = new Date(allocation.date);
                            if (txDate < allocationDate) {
                                // Transaction is before starting allocation, skip it
                                return;
                            }
                        }
                        balances[bucket.id] += transactionAmount;
                    }
                });
            }
        });

        return balances;
    },

    /**
     * Find buckets that match a transaction
     * @param {Object} transaction - Transaction object
     * @param {Array} buckets - Array of bucket objects
     * @returns {Array} Array of matching bucket objects
     */
    findMatchingBuckets(transaction, buckets) {
        const matching = [];

        // Get description text
        const descText = (transaction.user_description || transaction.description || '').toLowerCase();
        if (!descText) return matching;

        buckets.forEach(bucket => {
            if (!bucket.keywords || bucket.keywords.length === 0) return;

            // Check if any keyword matches
            const matches = bucket.keywords.some(keyword => {
                const keywordLower = keyword.toLowerCase();
                return descText.includes(keywordLower);
            });

            if (matches) {
                matching.push(bucket);
            }
        });

        return matching;
    },

    /**
     * Calculate account totals from bucket balances
     * @param {Object} balances - Object mapping bucket IDs to balances
     * @returns {number} Total balance
     */
    calculateTotal(balances) {
        return Object.values(balances).reduce((sum, balance) => sum + (parseFloat(balance) || 0), 0);
    }
};

