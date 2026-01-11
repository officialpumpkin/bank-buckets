// CSV Parser - supports multiple formats

const CSVParser = {
    // Format detection constants
    FORMATS: {
        FROLLO: 'frollo',
        QUDOS_BANK: 'qudos_bank'
    },

    // Qudos Bank CSV headers
    QUDOS_HEADERS: ['effective_date', 'entered_date', 'transaction_description', 'amount', 'balance'],

    // Expected Frollo CSV headers
    FROLLO_HEADERS: [
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
     * Detect CSV format based on headers
     * @param {Array} headers - Normalized header array
     * @returns {string} Format identifier
     */
    detectFormat(headers) {
        // Check for Qudos Bank format
        const qudosMatches = this.QUDOS_HEADERS.filter(h => 
            headers.some(header => header.includes(h.replace('_', '')))
        );
        if (qudosMatches.length >= 3) {
            return this.FORMATS.QUDOS_BANK;
        }

        // Check for Frollo format (has account_number in headers)
        if (headers.some(h => h.includes('account_number'))) {
            return this.FORMATS.FROLLO;
        }

        // Default to Qudos if we see entered_date or transaction_description
        if (headers.some(h => h.includes('entered') || h.includes('transaction_description'))) {
            return this.FORMATS.QUDOS_BANK;
        }

        return this.FORMATS.FROLLO;
    },

    /**
     * Extract account number from filename
     * Expected format: Statement_XXXXXXXX_DD.MM.YY-DD.MM.YY.csv
     * Account numbers can be 8-10 digits
     * @param {string} filename - The CSV filename
     * @returns {string|null} Account number or null
     */
    extractAccountNumberFromFilename(filename) {
        if (!filename) return null;
        
        // Match pattern: Statement_XXXXXXXX_ where XXXXXXXX is 8-10 digits
        const match = filename.match(/Statement_(\d{8,10})_/i);
        if (match) {
            return match[1];
        }
        
        // Also try to find any 8-10 digit sequence that looks like an account number
        const accountMatch = filename.match(/(\d{8,10})/);
        if (accountMatch) {
            return accountMatch[1];
        }
        
        return null;
    },

    /**
     * Parse CSV file content
     * @param {string} csvText - Raw CSV text
     * @param {string} filename - Optional filename for account number extraction
     * @returns {Array} Array of transaction objects
     */
    parse(csvText, filename = null) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file must contain at least a header row and one data row');
        }

        // Parse header
        const headers = this.parseCSVLine(lines[0]);
        const normalizedHeaders = headers.map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

        // Detect format
        const format = this.detectFormat(normalizedHeaders);
        console.log(`Detected CSV format: ${format}`);

        if (format === this.FORMATS.QUDOS_BANK) {
            return this.parseQudosFormat(lines, normalizedHeaders, filename);
        } else {
            return this.parseFrolloFormat(lines, normalizedHeaders);
        }
    },

    /**
     * Parse Qudos Bank CSV format
     */
    parseQudosFormat(lines, headers, filename) {
        const transactions = [];
        const accountNumber = this.extractAccountNumberFromFilename(filename) || 'unknown';
        const accountName = `Account ${accountNumber}`;

        // Find column indices
        const enteredDateIdx = headers.findIndex(h => h.includes('entered'));
        const effectiveDateIdx = headers.findIndex(h => h.includes('effective'));
        const descriptionIdx = headers.findIndex(h => h.includes('description'));
        const amountIdx = headers.findIndex(h => h === 'amount');
        const balanceIdx = headers.findIndex(h => h === 'balance');

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = this.parseCSVLine(lines[i]);
            
            // Get date - prefer entered_date, fall back to effective_date
            let dateStr = enteredDateIdx >= 0 ? values[enteredDateIdx] : null;
            if (!dateStr && effectiveDateIdx >= 0) {
                dateStr = values[effectiveDateIdx];
            }
            
            const description = descriptionIdx >= 0 ? values[descriptionIdx]?.trim() : '';
            const amountStr = amountIdx >= 0 ? values[amountIdx] : '';
            const balanceStr = balanceIdx >= 0 ? values[balanceIdx] : '';

            // Parse amount (handles $X.XX and -$X.XX format)
            const amount = this.parseAmount(amountStr);
            const balance = this.parseAmount(balanceStr);

            // Parse date (DD/MM/YYYY format)
            const transactionDate = this.parseDateDDMMYYYY(dateStr);

            if (amount === null || !transactionDate) {
                continue; // Skip invalid rows
            }

            // Generate transaction ID
            const transactionId = this.generateTransactionId(transactionDate, description, amount, accountNumber);

            transactions.push({
                transaction_id: transactionId,
                description: description,
                user_description: description,
                amount: amount,
                currency: 'AUD',
                transaction_date: transactionDate,
                posted_date: transactionDate,
                account_number: accountNumber,
                account_name: accountName,
                credit_debit: amount >= 0 ? 'credit' : 'debit',
                transaction_type: this.inferTransactionType(description),
                provider_name: 'Qudos Bank',
                merchant_name: this.extractMerchantName(description),
                budget_category: null,
                category_name: null,
                user_tags: null,
                notes: null,
                included: true,
                balance: balance,
                source: 'csv'
            });
        }

        console.log(`Parsed ${transactions.length} transactions from Qudos Bank CSV for account ${accountNumber}`);
        return transactions;
    },

    /**
     * Parse Frollo CSV format (original implementation)
     */
    parseFrolloFormat(lines, headers) {
        // Validate headers (flexible - check for key ones)
        const requiredHeaders = ['amount', 'transaction_date', 'account_number', 'account_name'];
        const missingHeaders = requiredHeaders.filter(h => 
            !headers.some(nh => nh.includes(h))
        );

        if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
        }

        // Parse data rows
        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = this.parseCSVLine(lines[i]);
            const transaction = {};

            headers.forEach((header, index) => {
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
                transaction.source = 'csv';
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
     * Handles formats: $1,234.56, -$1,234.56, 1234.56, -1234.56
     */
    parseAmount(value) {
        if (!value) return null;
        
        // Check for negative before removing symbols
        const isNegative = value.includes('-');
        
        // Remove currency symbols, spaces, and commas
        const cleaned = value.replace(/[^\d.]/g, '');
        const num = parseFloat(cleaned);
        
        if (isNaN(num)) return null;
        
        return isNegative ? -num : num;
    },

    /**
     * Parse date string (flexible format detection)
     */
    parseDate(value) {
        if (!value) return null;
        
        // Try DD/MM/YYYY first
        const ddmmyyyy = this.parseDateDDMMYYYY(value);
        if (ddmmyyyy) return ddmmyyyy;
        
        // Fall back to standard parsing
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    },

    /**
     * Parse date in DD/MM/YYYY format
     */
    parseDateDDMMYYYY(value) {
        if (!value) return null;
        
        const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = match[2].padStart(2, '0');
            const year = match[3];
            return `${year}-${month}-${day}`;
        }
        
        return null;
    },

    /**
     * Generate a unique transaction ID
     */
    generateTransactionId(date, description, amount, accountNumber) {
        const str = `${date}-${description}-${amount}-${accountNumber}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `tx_${Math.abs(hash)}`;
    },

    /**
     * Infer transaction type from description
     */
    inferTransactionType(description) {
        const desc = description.toLowerCase();
        if (desc.includes('transfer')) return 'transfer';
        if (desc.includes('direct debit')) return 'direct_debit';
        if (desc.includes('bpay')) return 'bpay';
        if (desc.includes('payto')) return 'payto';
        if (desc.includes('interest')) return 'interest';
        if (desc.includes('external transfer')) return 'external_transfer';
        return 'other';
    },

    /**
     * Extract merchant/payee name from description
     */
    extractMerchantName(description) {
        // Try to extract merchant from Direct Debit format: "Direct Debit MERCHANT - REF"
        const directDebitMatch = description.match(/Direct Debit\s+([^-]+)/i);
        if (directDebitMatch) {
            return directDebitMatch[1].trim();
        }
        
        // Try to extract from PayTo format: "PayTo: MERCHANT Reference:..."
        const paytoMatch = description.match(/PayTo:\s+([^R]+)/i);
        if (paytoMatch) {
            return paytoMatch[1].trim();
        }
        
        // Try to extract from Bpay format: "Bpay ... to MERCHANT ..."
        const bpayMatch = description.match(/Bpay\s+[^\s]+\s+to\s+([^\d]+)/i);
        if (bpayMatch) {
            return bpayMatch[1].trim();
        }
        
        return description;
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
