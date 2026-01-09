// Local storage utilities for Bank Buckets

const Storage = {
    // Keys
    KEYS: {
        TRANSACTIONS: 'bank_buckets_transactions',
        BUCKETS: 'bank_buckets_buckets',
        STARTING_ALLOCATIONS: 'bank_buckets_starting_allocations',
        ACCOUNTS: 'bank_buckets_accounts',
        CONFIRMED_ACCOUNTS: 'bank_buckets_confirmed_accounts',
        WORKFLOW_PHASE: 'bank_buckets_workflow_phase',
        TRANSACTION_CLASSIFICATIONS: 'bank_buckets_transaction_classifications',
        SAVED_ACCOUNTS: 'bank_buckets_saved_accounts' // User-managed account details
    },

    // Cache for performance
    _cache: {},

    /**
     * Invalidate all cache entries
     */
    invalidateCache() {
        this._cache = {};
    },

    /**
     * Safely save data to localStorage with error handling
     * @param {string} key - Storage key
     * @param {*} data - Data to save
     * @returns {boolean} Success status
     */
    _safeSave(key, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(key, serialized);
            // Invalidate cache for this key
            delete this._cache[key];
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.error('Storage quota exceeded. Please export and clear old data.');
                alert('Storage limit reached! Please export your data and reset to free up space.');
            } else {
                console.error('Storage save error:', e);
            }
            return false;
        }
    },

    /**
     * Safely load data from localStorage with caching
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Loaded data or default
     */
    _safeLoad(key, defaultValue = null) {
        // Check cache first
        if (this._cache.hasOwnProperty(key)) {
            return this._cache[key];
        }
        
        try {
            const data = localStorage.getItem(key);
            if (data === null) {
                this._cache[key] = defaultValue;
                return defaultValue;
            }
            const parsed = JSON.parse(data);
            this._cache[key] = parsed;
            return parsed;
        } catch (e) {
            console.error('Storage load error:', e);
            return defaultValue;
        }
    },

    // Transactions
    saveTransactions(transactions) {
        return this._safeSave(this.KEYS.TRANSACTIONS, transactions);
    },

    getTransactions() {
        return this._safeLoad(this.KEYS.TRANSACTIONS, []);
    },

    // Buckets
    saveBuckets(buckets) {
        return this._safeSave(this.KEYS.BUCKETS, buckets);
    },

    getBuckets() {
        return this._safeLoad(this.KEYS.BUCKETS, []);
    },

    // Starting Allocations
    saveStartingAllocations(allocations) {
        return this._safeSave(this.KEYS.STARTING_ALLOCATIONS, allocations);
    },

    getStartingAllocations() {
        return this._safeLoad(this.KEYS.STARTING_ALLOCATIONS, {});
    },

    // Accounts
    saveAccounts(accounts) {
        return this._safeSave(this.KEYS.ACCOUNTS, accounts);
    },

    getAccounts() {
        return this._safeLoad(this.KEYS.ACCOUNTS, []);
    },

    // Confirmed Accounts (user-approved accounts)
    saveConfirmedAccounts(accounts) {
        return this._safeSave(this.KEYS.CONFIRMED_ACCOUNTS, accounts);
    },

    getConfirmedAccounts() {
        return this._safeLoad(this.KEYS.CONFIRMED_ACCOUNTS, []);
    },

    // Workflow Phase
    saveWorkflowPhase(phase) {
        try {
            localStorage.setItem(this.KEYS.WORKFLOW_PHASE, phase);
            delete this._cache[this.KEYS.WORKFLOW_PHASE];
            return true;
        } catch (e) {
            console.error('Storage save error:', e);
            return false;
        }
    },

    getWorkflowPhase() {
        if (this._cache.hasOwnProperty(this.KEYS.WORKFLOW_PHASE)) {
            return this._cache[this.KEYS.WORKFLOW_PHASE];
        }
        const value = localStorage.getItem(this.KEYS.WORKFLOW_PHASE) || 'accounts';
        this._cache[this.KEYS.WORKFLOW_PHASE] = value;
        return value;
    },

    // Transaction Classifications (which bucket each transaction belongs to)
    saveTransactionClassifications(classifications) {
        return this._safeSave(this.KEYS.TRANSACTION_CLASSIFICATIONS, classifications);
    },

    getTransactionClassifications() {
        return this._safeLoad(this.KEYS.TRANSACTION_CLASSIFICATIONS, {});
    },

    // Saved Accounts (user-managed account details)
    saveSavedAccounts(accounts) {
        return this._safeSave(this.KEYS.SAVED_ACCOUNTS, accounts);
    },

    getSavedAccounts() {
        return this._safeLoad(this.KEYS.SAVED_ACCOUNTS, []);
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        this.invalidateCache();
    },

    /**
     * Get approximate storage usage
     * @returns {Object} Storage usage info
     */
    getStorageInfo() {
        let totalSize = 0;
        const breakdown = {};
        
        Object.entries(this.KEYS).forEach(([name, key]) => {
            const data = localStorage.getItem(key);
            const size = data ? new Blob([data]).size : 0;
            breakdown[name] = size;
            totalSize += size;
        });
        
        return {
            totalBytes: totalSize,
            totalKB: (totalSize / 1024).toFixed(2),
            breakdown: breakdown
        };
    }
};

