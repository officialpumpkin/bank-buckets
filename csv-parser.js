// CSV Parser for Frollo export format

const CSVParser = {
    // Expected Frollo CSV headers
    EXPECTED_HEADERS: [
        'transaction_id',
        'description',
        'user_description',
        'amount',
        'currency',
        'transaction_date',
        'posted_date',
        'account_number',
        'account_name',
        'credit_debit',
        'transaction_type',
        'provider_name',
        'merchant_name',
        'budget_category',
        'category_name',
        'user_tags',
        'notes',
        'included'
    ],

    /**
     * Parse CSV file content
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Array of transaction objects
     */
    parse(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file must contain at least a header row and one data row');
        }

        // Parse header
        const headers = this.parseCSVLine(lines[0]);
        const normalizedHeaders = headers.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

        // Validate headers (flexible - check for key ones)
        const requiredHeaders = ['amount', 'transaction_date', 'account_number', 'account_name'];
        const missingHeaders = requiredHeaders.filter(h => 
            !normalizedHeaders.some(nh => nh.includes(h))
        );

        if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
        }

        // Parse data rows
        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue; // Skip empty lines

            const values = this.parseCSVLine(lines[i]);
            const transaction = {};

            normalizedHeaders.forEach((header, index) => {
                let value = values[index] || '';
                value = value.trim();

                // Type conversions
                if (header.includes('amount')) {
                    value = this.parseAmount(value);
                } else if (header.includes('date')) {
                    value = this.parseDate(value);
                } else if (header.includes('included')) {
                    value = value.toLowerCase() === 'true' || value === '1';
                }

                transaction[header] = value;
            });

            // Ensure we have required fields
            if (transaction.amount !== null && transaction.transaction_date) {
                transactions.push(transaction);
            }
        }

        return transactions;
    },

    /**
     * Parse a single CSV line, handling quoted fields
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Add last field
        values.push(current);

        return values;
    },

    /**
     * Parse amount string to number
     */
    parseAmount(value) {
        if (!value) return null;
        // Remove currency symbols, spaces, and commas
        const cleaned = value.replace(/[^\d.-]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    },

    /**
     * Parse date string to Date object
     */
    parseDate(value) {
        if (!value) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    },

    /**
     * Extract unique accounts from transactions
     */
    extractAccounts(transactions) {
        const accountMap = new Map();

        transactions.forEach(tx => {
            const accountNumber = tx.account_number || 'unknown';
            const accountName = tx.account_name || 'Unknown Account';

            if (!accountMap.has(accountNumber)) {
                accountMap.set(accountNumber, {
                    account_number: accountNumber,
                    account_name: accountName,
                    transactions: []
                });
            }

            accountMap.get(accountNumber).transactions.push(tx);
        });

        // Calculate balances
        accountMap.forEach(account => {
            const balance = account.transactions.reduce((sum, tx) => {
                const amount = tx.amount || 0;
                // Determine if credit or debit based on amount sign or credit_debit field
                const isCredit = tx.credit_debit?.toLowerCase() === 'credit' || amount > 0;
                return isCredit ? sum + Math.abs(amount) : sum - Math.abs(amount);
            }, 0);

            account.balance = balance;
        });

        return Array.from(accountMap.values());
    }
};

