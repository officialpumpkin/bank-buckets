// Workflow manager for 3-phase setup process

const WorkflowManager = {
    PHASES: {
        ACCOUNTS: 'accounts',      // Phase 1: Setup accounts
        BUCKETS: 'buckets',        // Phase 2: Define buckets per account
        CLASSIFICATION: 'classification', // Phase 3: Classify transactions
        REVIEW: 'review'           // Phase 4: Final Breakdown
    },

    /**
     * Get current workflow phase
     */
    getCurrentPhase() {
        return Storage.getWorkflowPhase();
    },

    /**
     * Set workflow phase
     */
    setPhase(phase) {
        Storage.saveWorkflowPhase(phase);
        this.updateUI();
        this.updateNavState();
    },

    /**
     * Initialize workflow based on current state
     */
    initialize() {
        const transactions = Storage.getTransactions();
        
        // Always show nav but disable unavailable steps
        const nav = document.getElementById('main-nav');
        if (nav) nav.style.display = 'flex';
        
        this.setupNavigation();
        this.updateNavState();

        const buckets = Storage.getBuckets();

        // If no transactions, always show import
        if (transactions.length === 0) {
            this.showImportSection();
            return;
        }

        const confirmedAccounts = Storage.getConfirmedAccounts();

        // Restore correct phase based on data
        if (confirmedAccounts.length === 0) {
            this.setPhase(this.PHASES.ACCOUNTS);
        } else if (buckets.length === 0) {
            this.setPhase(this.PHASES.BUCKETS);
        } else {
            // Use saved phase if valid, otherwise default to classification
            const savedPhase = this.getCurrentPhase();
            
            // Validate saved phase
            if (savedPhase && Object.values(this.PHASES).includes(savedPhase)) {
                this.setPhase(savedPhase);
            } else {
                this.setPhase(this.PHASES.CLASSIFICATION);
            }
        }
    },

    /**
     * Setup navigation click handlers
     */
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-step');
        navButtons.forEach(btn => {
            // Clone to remove old listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const step = newBtn.dataset.step;
                if (step === 'import') {
                    this.showImportSection();
                } else {
                    this.setPhase(step);
                }
            });
        });
    },

    /**
     * Update navigation state (active/disabled)
     */
    updateNavState() {
        const phase = this.getCurrentPhase();
        const transactions = Storage.getTransactions();
        const confirmedAccounts = Storage.getConfirmedAccounts();
        const buckets = Storage.getBuckets();
        const hasTransactions = transactions.length > 0;
        const hasAccounts = confirmedAccounts.length > 0;
        
        const navButtons = document.querySelectorAll('.nav-step');
        navButtons.forEach(btn => {
            const step = btn.dataset.step;
            
            // Handle active state
            if ((step === 'import' && document.getElementById('import-section').style.display !== 'none') ||
                (step === phase && document.getElementById('import-section').style.display === 'none')) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
            
            // Handle disabled state
            if (step === 'import') {
                btn.disabled = false;
            } else if (step === 'accounts') {
                btn.disabled = !hasTransactions;
            } else if (step === 'buckets') {
                btn.disabled = !hasAccounts;
            } else if (step === 'classification') {
                btn.disabled = !hasAccounts;
            }
        });
    },

    /**
     * Show import section explicitly
     */
    showImportSection() {
        // Hide all phase sections
        document.getElementById('account-management-section').style.display = 'none';
        document.getElementById('account-setup-section').style.display = 'none';
        document.getElementById('bucket-setup-section').style.display = 'none';
        document.getElementById('classification-section').style.display = 'none';
        // document.getElementById('accounts-section') removed
        // document.getElementById('export-section').style.display = 'none';
        
        // Show import
        document.getElementById('import-section').style.display = 'block';
        
        // Update nav
        this.updateNavState();
    },

    /**
     * Check if we can proceed to next phase
     */
    canProceedToNextPhase() {
        const phase = this.getCurrentPhase();
        
        if (phase === this.PHASES.ACCOUNTS) {
            const confirmed = Storage.getConfirmedAccounts();
            // Need at least one savings account
            const savingsAccounts = confirmed.filter(acc => acc.account_type === 'savings');
            return savingsAccounts.length > 0;
        } else if (phase === this.PHASES.BUCKETS) {
            const buckets = Storage.getBuckets();
            const confirmedAccounts = Storage.getConfirmedAccounts();
            // Check if all savings accounts have at least one bucket
            const savingsAccounts = confirmedAccounts.filter(acc => acc.account_type === 'savings');
            return savingsAccounts.length > 0 && savingsAccounts.every(account => 
                buckets.some(bucket => bucket.account_number === account.account_number)
            );
        }
        
        return true;
    },

    /**
     * Move to next phase
     */
    proceedToNextPhase() {
        const currentPhase = this.getCurrentPhase();
        
        if (currentPhase === this.PHASES.ACCOUNTS) {
            // Auto-save confirmed accounts to permanent storage
            const confirmed = Storage.getConfirmedAccounts();
            const saved = Storage.getSavedAccounts();
            let added = false;
            
            confirmed.forEach(conf => {
                // Check if account matches by number
                if (!saved.some(s => s.account_number === conf.account_number)) {
                    // Create a clean saved account object
                    saved.push({
                        account_number: conf.account_number,
                        account_name: conf.account_name || `Account ${conf.account_number}`,
                        account_type: conf.account_type, // Maintain selected type (Savings/Day-to-day)
                        bsb: conf.bsb || null
                    });
                    added = true;
                }
            });
            
            if (added) {
                Storage.saveSavedAccounts(saved);
                UI.showStatus('New confirmed accounts saved for future imports.');
            }

            this.setPhase(this.PHASES.BUCKETS);
        } else if (currentPhase === this.PHASES.BUCKETS) {
            this.setPhase(this.PHASES.CLASSIFICATION);
        }
    },

    /**
     * Update UI based on current phase
     */
    updateUI() {
        const phase = this.getCurrentPhase();
        
        // Hide import section when in a phase
        document.getElementById('import-section').style.display = 'none';
        
        // Hide all phase sections
        document.getElementById('account-management-section').style.display = 'none';
        document.getElementById('account-setup-section').style.display = 'none';
        document.getElementById('bucket-setup-section').style.display = 'none';
        document.getElementById('classification-section').style.display = 'none';
        // document.getElementById('accounts-section') removed
        document.getElementById('review-section').style.display = 'none';
        
        // Show appropriate section and render content
        if (phase === this.PHASES.ACCOUNTS) {
            document.getElementById('account-setup-section').style.display = 'block';
            // Re-render account suggestions if we have transactions
            const transactions = Storage.getTransactions();
            if (transactions.length > 0) {
                const suggestedAccounts = AccountDetector.detectAccounts(transactions);
                UI.renderAccountSuggestions(suggestedAccounts);
            }
        } else if (phase === this.PHASES.BUCKETS) {
            document.getElementById('bucket-setup-section').style.display = 'block';
            // Render buckets for all savings accounts
            UI.renderPerAccountBuckets();
        } else if (phase === this.PHASES.CLASSIFICATION) {
            document.getElementById('classification-section').style.display = 'block';
            // Render unclassified transactions
            UI.renderUnclassifiedTransactions();
        } else if (phase === this.PHASES.REVIEW) {
            document.getElementById('review-section').style.display = 'block';
            UI.renderBreakdown();
        }
        
        // Always show export if we have data
        const transactions = Storage.getTransactions();
        if (transactions.length > 0) {
            // document.getElementById('export-section').style.display = 'block';
            document.getElementById('reset-btn').style.display = 'inline-block';
        }
    }
};

