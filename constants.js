// Shared constants for Bank Buckets application

const CONSTANTS = {
    // Currency
    CURRENCY: 'AUD',
    DEFAULT_PROVIDER: 'Qudos Bank',
    
    // Workflow Phases
    PHASES: {
        ACCOUNTS: 'accounts',
        BUCKETS: 'buckets',
        CLASSIFICATION: 'classification',
        REVIEW: 'review'
    },
    
    // Account Types
    ACCOUNT_TYPES: {
        SAVINGS: 'savings',
        DAY_TO_DAY: 'day_to_day'
    },
    
    // Storage Keys
    STORAGE_KEYS: {
        TRANSACTIONS: 'bank_buckets_transactions',
        BUCKETS: 'bank_buckets_buckets',
        STARTING_ALLOCATIONS: 'bank_buckets_starting_allocations',
        ACCOUNTS: 'bank_buckets_accounts',
        CONFIRMED_ACCOUNTS: 'bank_buckets_confirmed_accounts',
        WORKFLOW_PHASE: 'bank_buckets_workflow_phase',
        TRANSACTION_CLASSIFICATIONS: 'bank_buckets_transaction_classifications',
        SAVED_ACCOUNTS: 'bank_buckets_saved_accounts'
    },
    
    // Transaction Types
    TRANSACTION_TYPES: {
        TRANSFER: 'transfer',
        PURCHASE: 'purchase',
        PAYMENT: 'payment',
        DEPOSIT: 'deposit',
        WITHDRAWAL: 'withdrawal',
        INTEREST: 'interest',
        FEE: 'fee',
        UNKNOWN: 'unknown'
    },
    
    // UI Settings
    UI: {
        STATUS_TIMEOUT_MS: 5000,
        MAX_KEYWORDS_DISPLAY: 5,
        MAX_EXAMPLES: 3,
        MIN_BUCKET_OCCURRENCES: 2
    },
    
    // Validation
    VALIDATION: {
        MIN_YEAR: 2000,
        MAX_YEAR: 2100,
        MAX_AMOUNT: 1000000000
    }
};

// Make available globally
window.CONSTANTS = CONSTANTS;
