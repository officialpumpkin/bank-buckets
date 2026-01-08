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

    // Transactions
    saveTransactions(transactions) {
        localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
    },

    getTransactions() {
        const data = localStorage.getItem(this.KEYS.TRANSACTIONS);
        return data ? JSON.parse(data) : [];
    },

    // Buckets
    saveBuckets(buckets) {
        localStorage.setItem(this.KEYS.BUCKETS, JSON.stringify(buckets));
    },

    getBuckets() {
        const data = localStorage.getItem(this.KEYS.BUCKETS);
        return data ? JSON.parse(data) : [];
    },

    // Starting Allocations
    saveStartingAllocations(allocations) {
        localStorage.setItem(this.KEYS.STARTING_ALLOCATIONS, JSON.stringify(allocations));
    },

    getStartingAllocations() {
        const data = localStorage.getItem(this.KEYS.STARTING_ALLOCATIONS);
        return data ? JSON.parse(data) : {};
    },

    // Accounts
    saveAccounts(accounts) {
        localStorage.setItem(this.KEYS.ACCOUNTS, JSON.stringify(accounts));
    },

    getAccounts() {
        const data = localStorage.getItem(this.KEYS.ACCOUNTS);
        return data ? JSON.parse(data) : [];
    },

    // Confirmed Accounts (user-approved accounts)
    saveConfirmedAccounts(accounts) {
        localStorage.setItem(this.KEYS.CONFIRMED_ACCOUNTS, JSON.stringify(accounts));
    },

    getConfirmedAccounts() {
        const data = localStorage.getItem(this.KEYS.CONFIRMED_ACCOUNTS);
        return data ? JSON.parse(data) : [];
    },

    // Workflow Phase
    saveWorkflowPhase(phase) {
        localStorage.setItem(this.KEYS.WORKFLOW_PHASE, phase);
    },

    getWorkflowPhase() {
        return localStorage.getItem(this.KEYS.WORKFLOW_PHASE) || 'accounts';
    },

    // Transaction Classifications (which bucket each transaction belongs to)
    saveTransactionClassifications(classifications) {
        localStorage.setItem(this.KEYS.TRANSACTION_CLASSIFICATIONS, JSON.stringify(classifications));
    },

    getTransactionClassifications() {
        const data = localStorage.getItem(this.KEYS.TRANSACTION_CLASSIFICATIONS);
        return data ? JSON.parse(data) : {};
    },

    // Saved Accounts (user-managed account details)
    saveSavedAccounts(accounts) {
        localStorage.setItem(this.KEYS.SAVED_ACCOUNTS, JSON.stringify(accounts));
    },

    getSavedAccounts() {
        const data = localStorage.getItem(this.KEYS.SAVED_ACCOUNTS);
        return data ? JSON.parse(data) : [];
    },

    // Clear all data
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
};

