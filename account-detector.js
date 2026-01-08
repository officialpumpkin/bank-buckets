// Account detection and suggestion logic

const AccountDetector = {
    /**
     * Detect and suggest accounts from transactions
     * Cross-references with saved accounts to use saved details
     * @param {Array} transactions - Array of transaction objects
     * @returns {Array} Array of suggested account objects
     */
    detectAccounts(transactions) {
        const accountMap = new Map();
        const savedAccounts = Storage.getSavedAccounts();

        transactions.forEach(tx => {
            const accountNumber = tx.account_number || 'unknown';
            
            // Check if we have saved account details for this account
            const savedAccount = savedAccounts.find(sa => sa.account_number === accountNumber);
            
            const accountName = savedAccount?.account_name || tx.account_name || `Account ${accountNumber}`;
            const bsb = savedAccount?.bsb || tx.bsb || null;
            const accountType = savedAccount?.account_type || null;

            if (!accountMap.has(accountNumber)) {
                // Count transactions for this account
                const accountTransactions = transactions.filter(t => 
                    (t.account_number || 'unknown') === accountNumber
                );

                // Calculate balance
                const balance = accountTransactions.reduce((sum, t) => {
                    const amount = parseFloat(t.amount) || 0;
                    const isCredit = t.credit_debit?.toLowerCase() === 'credit' || amount > 0;
                    return isCredit ? sum + Math.abs(amount) : sum - Math.abs(amount);
                }, 0);

                accountMap.set(accountNumber, {
                    account_number: accountNumber,
                    account_name: accountName,
                    bsb: bsb,
                    transaction_count: accountTransactions.length,
                    balance: balance,
                    account_type: accountType, // Use saved type if available
                    suggested: !savedAccount, // Mark as suggested only if not in saved accounts
                    is_saved: !!savedAccount // Flag to indicate this is a saved account
                });
            }
        });

        return Array.from(accountMap.values()).sort((a, b) => 
            b.transaction_count - a.transaction_count
        );
    },

    /**
     * Validate account suggestion
     * @param {Object} account - Account object
     * @returns {boolean} True if account is valid
     */
    isValidAccount(account) {
        return account && 
               account.account_number && 
               account.account_number !== 'unknown' &&
               account.transaction_count > 0;
    }
};

