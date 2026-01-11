// UI rendering and interaction logic

const UI = {
    // Sort state for transactions (persisted in memory during session)
    sortState: {
        unclassified: {},       // Per-account sort state: { accountNumber: 'newest' | 'oldest' }
        breakdown: {}           // Per-bucket sort state: { bucketId: 'newest' | 'oldest' }
    },

    // Expanded state for collapsible sections
    expandedState: {
        unclassifiedAccounts: new Set(),  // Account numbers that are expanded
        breakdownAccounts: new Set(),      // Account numbers that are expanded
        breakdownBuckets: new Set()        // Bucket IDs that are expanded
    },

    /**
     * Toggle sort order for unclassified transactions for a specific account
     */
    toggleUnclassifiedSort(accountNumber) {
        const current = this.sortState.unclassified[accountNumber] || 'newest';
        this.sortState.unclassified[accountNumber] = current === 'newest' ? 'oldest' : 'newest';
        this.renderUnclassifiedTransactions();
    },

    /**
     * Toggle sort order for a specific bucket in breakdown
     */
    toggleBreakdownSort(bucketId) {
        const current = this.sortState.breakdown[bucketId] || 'newest';
        this.sortState.breakdown[bucketId] = current === 'newest' ? 'oldest' : 'newest';
        this.renderBreakdown();
    },

    /**
     * Get sort comparator for transactions
     * @param {string} order - 'newest' or 'oldest'
     * @returns {Function} Comparator function
     */
    getDateSortComparator(order) {
        return (a, b) => {
            const dateA = new Date(a.transaction_date || a.posted_date || 0);
            const dateB = new Date(b.transaction_date || b.posted_date || 0);
            return order === 'newest' ? dateB - dateA : dateA - dateB;
        };
    },

    /**
     * Show status message
     * @param {string} message - Message to display
     * @param {string} type - Message type: 'success' or 'error'
     * @param {boolean} persistent - If true, message stays until user closes it
     */
    showStatus(message, type = 'success', persistent = false) {
        const statusEl = document.getElementById('import-status');
        
        // Clear any existing timeout
        if (statusEl._timeout) {
            clearTimeout(statusEl._timeout);
            statusEl._timeout = null;
        }
        
        // Create message content
        const messageContent = document.createElement('div');
        messageContent.className = 'status-content';
        messageContent.innerHTML = message; // Use innerHTML to support links
        
        // Clear existing content
        statusEl.innerHTML = '';
        statusEl.appendChild(messageContent);
        
        // Add close button if persistent
        if (persistent) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'status-close';
            closeBtn.innerHTML = '×';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.onclick = () => {
                statusEl.className = 'status-message';
                statusEl.innerHTML = '';
            };
            statusEl.appendChild(closeBtn);
        }
        
        statusEl.className = `status-message ${type}${persistent ? ' persistent' : ''}`;
        
        // Auto-hide after 5 seconds if not persistent
        if (!persistent) {
            statusEl._timeout = setTimeout(() => {
                statusEl.className = 'status-message';
                statusEl.innerHTML = '';
            }, 5000);
        }
    },

    /**
     * Render bucket suggestions
     */
    renderBucketSuggestions(suggestions) {
        const container = document.getElementById('bucket-suggestions');
        container.innerHTML = '';

        if (suggestions.length === 0) {
            container.innerHTML = '<p>No bucket suggestions found. You can create buckets manually below.</p>';
            return;
        }

        const title = document.createElement('h3');
        title.textContent = 'Suggested Buckets';
        title.style.marginBottom = '16px';
        container.appendChild(title);

        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            // Use Utils.escapeHtml to prevent XSS attacks
            const escapeHtml = window.Utils ? Utils.escapeHtml : (t) => t;
            
            item.innerHTML = `
                <h3>${escapeHtml(suggestion.name)}</h3>
                <p>Found ${suggestion.matchCount} matching transactions</p>
                <div class="suggestion-keywords">
                    ${suggestion.keywords.slice(0, 5).map(k => 
                        `<span class="keyword-tag">${escapeHtml(k)}</span>`
                    ).join('')}
                </div>
                <button class="btn btn-primary btn-small" onclick="UI.acceptSuggestion('${escapeHtml(suggestion.id)}')" style="margin-top: 8px;">
                    Accept & Create Bucket
                </button>
            `;

            container.appendChild(item);
        });
    },

    /**
     * Accept a bucket suggestion
     */
    acceptSuggestion(suggestionId) {
        const buckets = Storage.getBuckets();
        const suggestions = this.currentSuggestions || [];

        const suggestion = suggestions.find(s => s.id === suggestionId);
        if (!suggestion) return;

        // Add to buckets
        buckets.push({
            id: suggestion.id,
            name: suggestion.name,
            keywords: suggestion.keywords,
            suggested: true
        });

        Storage.saveBuckets(buckets);
        this.renderBucketManagement();
        this.showStatus(`Bucket "${suggestion.name}" created successfully`);
    },

    /**
     * Render bucket management interface
     */
    renderBucketManagement() {
        const container = document.getElementById('bucket-management');
        const buckets = Storage.getBuckets();

        container.innerHTML = '';

        const title = document.createElement('h3');
        title.textContent = 'Manage Buckets';
        title.style.marginBottom = '16px';
        container.appendChild(title);

        if (buckets.length === 0) {
            container.innerHTML += '<p>No buckets created yet. Accept suggestions above or create one manually.</p>';
        }

        buckets.forEach(bucket => {
            const item = document.createElement('div');
            item.className = 'bucket-item';
            item.id = `bucket-${bucket.id}`;

            const keywordsHtml = (bucket.keywords || []).map((keyword, idx) => `
                <div class="keyword-input-group">
                    <input type="text" class="keyword-input" value="${keyword}" 
                           onchange="UI.updateBucketKeyword('${bucket.id}', ${idx}, this.value)">
                    <button class="btn btn-danger btn-small" onclick="UI.removeBucketKeyword('${bucket.id}', ${idx})">Remove</button>
                </div>
            `).join('');

            item.innerHTML = `
                <div class="bucket-header">
                    <input type="text" class="bucket-name-input" value="${bucket.name}" 
                           onchange="UI.updateBucketName('${bucket.id}', this.value)">
                    <button class="btn btn-danger btn-small" onclick="UI.deleteBucket('${bucket.id}')">Delete</button>
                </div>
                <div class="bucket-keywords">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Keywords:</label>
                    ${keywordsHtml}
                    <button class="btn btn-secondary btn-small add-keyword-btn" onclick="UI.addBucketKeyword('${bucket.id}')">+ Add Keyword</button>
                </div>
            `;

            container.appendChild(item);
        });

        // Add button to create new bucket
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary';
        addBtn.textContent = '+ Create New Bucket';
        addBtn.style.marginTop = '16px';
        addBtn.onclick = () => UI.createNewBucket();
        container.appendChild(addBtn);
    },

    /**
     * Update bucket name
     */
    updateBucketName(bucketId, newName) {
        if (!newName || !newName.trim()) return;

        const buckets = Storage.getBuckets();
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket) {
            const oldName = bucket.name;
            bucket.name = newName.trim();
            
            // Update keyword to match new name
            if (!bucket.keywords) bucket.keywords = [];
            
            // Find if the old name was used as a keyword
            const oldIndex = bucket.keywords.findIndex(k => k === oldName);
            
            if (oldIndex !== -1) {
                // Replace old keyword with new name
                bucket.keywords[oldIndex] = bucket.name;
            } else {
                // If old name wasn't a keyword, add the new name as a keyword
                // (Only if it doesn't already exist)
                if (!bucket.keywords.includes(bucket.name)) {
                    bucket.keywords.unshift(bucket.name); // Add to front
                }
            }
            
            // Ensure uniqueness
            bucket.keywords = [...new Set(bucket.keywords)];

            Storage.saveBuckets(buckets);
            const phase = WorkflowManager.getCurrentPhase();
            if (phase === WorkflowManager.PHASES.BUCKETS) {
                this.renderPerAccountBuckets();
            }
        }
    },

    /**
     * Update bucket keyword
     */
    updateBucketKeyword(bucketId, keywordIndex, newKeyword) {
        const buckets = Storage.getBuckets();
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket && bucket.keywords) {
            bucket.keywords[keywordIndex] = newKeyword.trim();
            Storage.saveBuckets(buckets);
            const phase = WorkflowManager.getCurrentPhase();
            if (phase === WorkflowManager.PHASES.BUCKETS) {
                this.renderPerAccountBuckets();
            }
        }
    },

    /**
     * Remove bucket keyword
     */
    removeBucketKeyword(bucketId, keywordIndex) {
        const buckets = Storage.getBuckets();
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket && bucket.keywords) {
            bucket.keywords.splice(keywordIndex, 1);
            Storage.saveBuckets(buckets);
            const phase = WorkflowManager.getCurrentPhase();
            if (phase === WorkflowManager.PHASES.BUCKETS) {
                this.renderPerAccountBuckets();
            } else {
                this.renderBucketManagement();
            }
        }
    },

    /**
     * Add keyword to bucket
     */
    addBucketKeyword(bucketId) {
        const buckets = Storage.getBuckets();
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket) {
            if (!bucket.keywords) bucket.keywords = [];
            bucket.keywords.push('');
            Storage.saveBuckets(buckets);
            const phase = WorkflowManager.getCurrentPhase();
            if (phase === WorkflowManager.PHASES.BUCKETS) {
                this.renderPerAccountBuckets(bucketId);
            } else {
                this.renderBucketManagement();
            }
        }
    },

    /**
     * Delete bucket
     */
    deleteBucket(bucketId) {
        if (!confirm('Are you sure you want to delete this bucket? This will also remove all transaction classifications for this bucket.')) return;

        const buckets = Storage.getBuckets();
        const filtered = buckets.filter(b => b.id !== bucketId);
        Storage.saveBuckets(filtered);

        // Remove classifications for this bucket
        const classifications = Storage.getTransactionClassifications();
        Object.keys(classifications).forEach(txId => {
            if (classifications[txId] === bucketId) {
                delete classifications[txId];
            }
        });
        Storage.saveTransactionClassifications(classifications);

        const phase = WorkflowManager.getCurrentPhase();
        if (phase === WorkflowManager.PHASES.BUCKETS) {
            this.renderPerAccountBuckets();
        } else {
            this.renderBucketManagement();
            if (phase === WorkflowManager.PHASES.CLASSIFICATION) {
                this.renderUnclassifiedTransactions();
            }
        }
    },


    /**
     * Update starting allocation (called from Step 2 bucket form)
     */
    updateStartingAllocation(bucketId, amount, date) {
        const allocations = Storage.getStartingAllocations();
        const amountValue = parseFloat(amount) || 0;
        const dateValue = date || new Date().toISOString().split('T')[0];
        
        if (amountValue !== 0 || dateValue) {
            allocations[bucketId] = {
                amount: amountValue,
                date: dateValue
            };
        } else {
            // Remove allocation if both are empty/zero
            delete allocations[bucketId];
        }
        
        Storage.saveStartingAllocations(allocations);
    },

    /**
     * Render account suggestions (Phase 1)
     */
    renderAccountSuggestions(accounts) {
        const container = document.getElementById('account-suggestions');
        container.innerHTML = '';

        if (accounts.length === 0) {
            container.innerHTML = '<p>No accounts found in transactions.</p>';
            return;
        }

        const title = document.createElement('h3');
        title.textContent = 'Detected Accounts';
        title.style.marginBottom = '16px';
        container.appendChild(title);

        accounts.forEach(account => {
            const item = document.createElement('div');
            item.className = 'account-suggestion-item';
            item.id = `account-suggestion-${account.account_number}`;
            
            // Get saved account details from storage (persisted data)
            const savedAccounts = Storage.getSavedAccounts();
            const savedAccount = savedAccounts.find(acc => acc.account_number === account.account_number);
            const allAccounts = Storage.getAccounts();
            const allAccount = allAccounts.find(acc => acc.account_number === account.account_number);
            const confirmedAccount = this.getConfirmedAccountDetails(account.account_number);
            
            // Prefer saved account data, then confirmed, then detected
            const accountName = savedAccount?.account_name || allAccount?.account_name || confirmedAccount?.account_name || account.account_name || `Account ${account.account_number}`;
            const accountType = savedAccount?.account_type || allAccount?.account_type || confirmedAccount?.account_type || account.account_type || '';
            const isSavedAccount = !!savedAccount;
            
            // Escape account number for use in HTML attributes
            const safeAccountNumber = account.account_number.replace(/'/g, "\\'");
            
            item.innerHTML = `
                <div class="account-suggestion-info">
                    <div class="account-suggestion-header">
                        <input type="text" class="account-name-input" 
                               value="${accountName.replace(/"/g, '&quot;')}" 
                               placeholder="Account name"
                               onblur="UI.updateAccountName('${safeAccountNumber}', this.value)"
                               onkeypress="if(event.key==='Enter') { this.blur(); }"
                               style="font-weight: 600; font-size: 1.1em; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; width: 350px;">
                        <div class="account-suggestion-details">
                            Account: ${account.account_number}
                            ${account.bsb || savedAccount?.bsb ? ` | BSB: ${savedAccount?.bsb || account.bsb}` : ''}
                            | ${account.transaction_count} transactions
                            | Balance: $${account.balance.toFixed(2)}
                            ${isSavedAccount ? ' | <span style="color: #27ae60; font-weight: 500;">✓ Saved Account</span>' : ''}
                        </div>
                    </div>
                    <div class="account-type-selection" style="margin-top: 12px;">
                        <label class="account-type-label">
                            <input type="radio" name="account-type-${account.account_number}" 
                                   value="savings" 
                                   onclick="UI.updateAccountType('${safeAccountNumber}', 'savings')"
                                   ${accountType === 'savings' ? 'checked' : ''}>
                            <span>Savings Account (for buckets)</span>
                        </label>
                        <label class="account-type-label" style="margin-left: 16px;">
                            <input type="radio" name="account-type-${account.account_number}" 
                                   value="day_to_day" 
                                   onclick="UI.updateAccountType('${safeAccountNumber}', 'day_to_day')"
                                   ${accountType === 'day_to_day' ? 'checked' : ''}>
                            <span>Day to Day Account (ignore transactions)</span>
                        </label>
                    </div>
                </div>
                <div class="account-suggestion-actions">
                    <label class="account-checkbox-label">
                        <input type="checkbox" class="account-checkbox" 
                               onchange="UI.toggleAccountConfirmation('${safeAccountNumber}', this.checked)"
                               ${this.isAccountConfirmed(account.account_number) ? 'checked' : ''}>
                        <span>Use this account</span>
                    </label>
                </div>
            `;

            container.appendChild(item);
        });

        // Update proceed button visibility based on initial state
        this.updateProceedToBucketsButton();
    },

    /**
     * Check if account is confirmed
     */
    isAccountConfirmed(accountNumber) {
        const confirmed = Storage.getConfirmedAccounts();
        return confirmed.some(acc => acc.account_number === accountNumber);
    },

    /**
     * Get confirmed account details
     */
    getConfirmedAccountDetails(accountNumber) {
        const confirmed = Storage.getConfirmedAccounts();
        return confirmed.find(acc => acc.account_number === accountNumber);
    },

    /**
     * Update account name
     */
    updateAccountName(accountNumber, newName) {
        const confirmed = Storage.getConfirmedAccounts();
        const allAccounts = Storage.getAccounts();
        let account = confirmed.find(acc => acc.account_number === accountNumber);
        
        const trimmedName = newName.trim() || `Account ${accountNumber}`;
        
        if (!account) {
            // Create account entry if it doesn't exist
            account = allAccounts.find(acc => acc.account_number === accountNumber) || {
                account_number: accountNumber,
                account_name: trimmedName,
                account_type: null
            };
        }
        
        account.account_name = trimmedName;
        
        // Update in confirmed accounts
        if (confirmed.some(acc => acc.account_number === accountNumber)) {
            const index = confirmed.findIndex(acc => acc.account_number === accountNumber);
            confirmed[index] = { ...account }; // Create new object to ensure update
        }
        
        // Always update in all accounts for persistence
        const accounts = Storage.getAccounts();
        const accIndex = accounts.findIndex(acc => acc.account_number === accountNumber);
        if (accIndex >= 0) {
            accounts[accIndex].account_name = trimmedName;
        } else {
            accounts.push({
                account_number: accountNumber,
                account_name: trimmedName,
                account_type: account.account_type || null
            });
        }
        Storage.saveAccounts(accounts);
        Storage.saveConfirmedAccounts(confirmed);
        
        // Also update saved accounts if it exists there
        const savedAccounts = Storage.getSavedAccounts();
        const savedIndex = savedAccounts.findIndex(acc => acc.account_number === accountNumber);
        if (savedIndex >= 0) {
            savedAccounts[savedIndex].account_name = trimmedName;
            Storage.saveSavedAccounts(savedAccounts);
        } else {
            // If account is confirmed and has a type, save it to saved accounts
            if (confirmed.some(acc => acc.account_number === accountNumber)) {
                const confirmedAcc = confirmed.find(acc => acc.account_number === accountNumber);
                if (confirmedAcc && confirmedAcc.account_type) {
                    savedAccounts.push({
                        account_number: accountNumber,
                        account_name: trimmedName,
                        account_type: confirmedAcc.account_type,
                        bsb: confirmedAcc.bsb || null
                    });
                    Storage.saveSavedAccounts(savedAccounts);
                }
            }
        }
        
        // Don't re-render immediately - let the user continue editing
        // The name will persist on next render or page reload
    },

    /**
     * Update account type
     */
    updateAccountType(accountNumber, accountType) {
        const confirmed = Storage.getConfirmedAccounts();
        const allAccounts = Storage.getAccounts();
        let account = confirmed.find(acc => acc.account_number === accountNumber);
        
        if (!account) {
            account = allAccounts.find(acc => acc.account_number === accountNumber) || {
                account_number: accountNumber,
                account_name: `Account ${accountNumber}`,
                account_type: null
            };
        }
        
        account.account_type = accountType;
        
        // Update in confirmed accounts
        if (confirmed.some(acc => acc.account_number === accountNumber)) {
            const index = confirmed.findIndex(acc => acc.account_number === accountNumber);
            confirmed[index] = { ...account }; // Create new object to ensure update
        }
        
        // Always update in all accounts for persistence
        const accounts = Storage.getAccounts();
        const accIndex = accounts.findIndex(acc => acc.account_number === accountNumber);
        if (accIndex >= 0) {
            accounts[accIndex].account_type = accountType;
            if (!accounts[accIndex].account_name) {
                accounts[accIndex].account_name = account.account_name || `Account ${accountNumber}`;
            }
        } else {
            accounts.push({
                account_number: accountNumber,
                account_name: account.account_name || `Account ${accountNumber}`,
                account_type: accountType
            });
        }
        Storage.saveAccounts(accounts);
        Storage.saveConfirmedAccounts(confirmed);
        
        // Also update saved accounts if it exists there, or create if confirmed
        const savedAccounts = Storage.getSavedAccounts();
        const savedIndex = savedAccounts.findIndex(acc => acc.account_number === accountNumber);
        if (savedIndex >= 0) {
            savedAccounts[savedIndex].account_type = accountType;
            Storage.saveSavedAccounts(savedAccounts);
        } else if (confirmed.some(acc => acc.account_number === accountNumber)) {
            // If account is confirmed, save it to saved accounts for persistence
            const confirmedAcc = confirmed.find(acc => acc.account_number === accountNumber);
            savedAccounts.push({
                account_number: accountNumber,
                account_name: confirmedAcc.account_name || `Account ${accountNumber}`,
                account_type: accountType,
                bsb: confirmedAcc.bsb || null
            });
            Storage.saveSavedAccounts(savedAccounts);
        }
        
        // Update proceed button visibility
        this.updateProceedToBucketsButton();
        
        // Update the radio button state without full re-render
        const item = document.getElementById(`account-suggestion-${accountNumber}`);
        if (item) {
            const savingsRadio = item.querySelector('input[value="savings"]');
            const dayToDayRadio = item.querySelector('input[value="day_to_day"]');
            
            if (accountType === 'savings' && savingsRadio) {
                savingsRadio.checked = true;
            } else if (accountType === 'day_to_day' && dayToDayRadio) {
                dayToDayRadio.checked = true;
            }
        }
    },

    /**
     * Toggle account confirmation
     */
    toggleAccountConfirmation(accountNumber, isConfirmed) {
        const confirmed = Storage.getConfirmedAccounts();
        const allAccounts = Storage.getAccounts();
        const savedAccounts = Storage.getSavedAccounts();
        let account = confirmed.find(acc => acc.account_number === accountNumber);
        
        if (!account) {
            // Prefer saved account, then all accounts, then create new
            account = savedAccounts.find(acc => acc.account_number === accountNumber) ||
                     allAccounts.find(acc => acc.account_number === accountNumber) || {
                account_number: accountNumber,
                account_name: `Account ${accountNumber}`,
                account_type: null
            };
        }

        if (isConfirmed) {
            // Add to confirmed if not already there
            if (!confirmed.some(acc => acc.account_number === accountNumber)) {
                // Make sure we have the latest data from saved accounts
                const savedAccount = savedAccounts.find(acc => acc.account_number === accountNumber);
                if (savedAccount) {
                    confirmed.push({ ...savedAccount });
                } else {
                    confirmed.push({ ...account });
                }
                Storage.saveConfirmedAccounts(confirmed);
            }
        } else {
            // Remove from confirmed
            const filtered = confirmed.filter(acc => acc.account_number !== accountNumber);
            Storage.saveConfirmedAccounts(filtered);
        }

        // Update proceed button visibility
        this.updateProceedToBucketsButton();
    },

    /**
     * Update proceed to buckets button
     */
    updateProceedToBucketsButton() {
        const confirmed = Storage.getConfirmedAccounts();
        // Only show button if we have at least one savings account
        const savingsAccounts = confirmed.filter(acc => acc.account_type === 'savings');
        const btn = document.getElementById('proceed-to-buckets-btn');
        if (btn) {
            btn.style.display = savingsAccounts.length > 0 ? 'inline-block' : 'none';
        }
    },

    /**
     * Render per-account bucket management (Phase 2)
     */
    renderPerAccountBuckets(expandedBucketId = null) {
        const container = document.getElementById('bucket-management');
        
        // Preserve open/closed state of details elements
        const openAccountNumbers = new Set();
        const openBucketIds = new Set();
        const existingDetails = container.querySelectorAll('details');
        
        if (existingDetails.length > 0) {
            existingDetails.forEach(el => {
                if (el.hasAttribute('open')) {
                    const contentDiv = el.querySelector('.buckets-for-account');
                    if (contentDiv && contentDiv.id) {
                        const accNum = contentDiv.id.replace('buckets-', '');
                        openAccountNumbers.add(accNum);
                    } else {
                        // Check if it's a bucket details
                        const bucketItem = el.closest('.bucket-item');
                        if (bucketItem && bucketItem.id) {
                            openBucketIds.add(bucketItem.id.replace('bucket-', ''));
                        }
                    }
                }
            });
        }

        const savedAccounts = Storage.getSavedAccounts();
        const confirmedAccounts = Storage.getConfirmedAccounts();
        const buckets = Storage.getBuckets();

        // Merge accounts to show ALL relevant savings accounts
        // Map account_number -> account object
        const allAccountsMap = new Map();

        // 1. Add Saved Accounts (Master list)
        savedAccounts.forEach(acc => {
            allAccountsMap.set(acc.account_number, acc);
        });

        // 2. Add Confirmed Accounts (Current session, if not already saved)
        confirmedAccounts.forEach(acc => {
            if (!allAccountsMap.has(acc.account_number)) {
                allAccountsMap.set(acc.account_number, acc);
            }
        });

        const allAccounts = Array.from(allAccountsMap.values());

        container.innerHTML = '';

        // Only show savings accounts for bucket setup
        const savingsAccounts = allAccounts.filter(acc => acc.account_type === 'savings');

        if (savingsAccounts.length === 0) {
            container.innerHTML = '<p>No Savings Accounts found. Please set up a Savings Account in Step 1.</p>';
            return;
        }

        savingsAccounts.forEach(account => {
            const accountBuckets = buckets.filter(b => b.account_number === account.account_number);
            
            // Determine open state: Restore state (default closed if not in set)
            // BUT force open if this account contains the newly created bucket
            let isOpen = openAccountNumbers.has(account.account_number);
            if (expandedBucketId && accountBuckets.some(b => b.id === expandedBucketId)) {
                isOpen = true;
            }

            const accountSection = document.createElement('div');
            accountSection.className = 'account-bucket-section';
            accountSection.style.padding = '0'; 
            accountSection.style.border = 'none'; 
            accountSection.style.background = 'transparent';

            accountSection.innerHTML = `
                <details ${isOpen ? 'open' : ''} style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <summary style="cursor: pointer; padding: 15px; font-weight: 600; font-size: 1.1em; background: #f8f9fa; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                        <span>${account.account_name} <span style="font-weight: normal; color: #666; font-size: 0.9em;">(${account.account_number})</span></span>
                        <span class="dropdown-arrow" style="font-size: 0.8em; color: #666;">▼</span>
                    </summary>
                    <div style="padding: 15px; border-top: 1px solid #eee;">
                        <div class="buckets-for-account" id="buckets-${account.account_number}"></div>
                        <button class="btn btn-primary btn-small" onclick="UI.createBucketForAccount('${account.account_number}')" style="margin-top: 12px;">
                            + Add Bucket
                        </button>
                    </div>
                </details>
            `;

            container.appendChild(accountSection);

            // Render buckets for this account
            const bucketsContainer = accountSection.querySelector(`#buckets-${account.account_number}`);
            this.renderBucketsForAccount(account, accountBuckets, bucketsContainer, expandedBucketId, openBucketIds);
        });

        // Update proceed button
        this.updateProceedToClassificationButton();
    },

    /**
     * Render buckets for a specific account
     */
    renderBucketsForAccount(account, buckets, container, expandedBucketId = null, openBucketIds = new Set()) {
        container.innerHTML = '';

        if (buckets.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No buckets yet. Create your first bucket above.</p>';
            return;
        }

        const startingAllocations = Storage.getStartingAllocations();
        const accountBalance = parseFloat(account.balance) || 0;
        
        // Calculate total allocated so far for this account
        const totalAllocated = buckets.reduce((sum, b) => {
            return sum + (parseFloat(startingAllocations[b.id]?.amount) || 0);
        }, 0);

        buckets.forEach(bucket => {
            const item = document.createElement('div');
            item.className = 'bucket-item';
            item.id = `bucket-${bucket.id}`;
            item.style.marginBottom = '10px';

            const keywordsHtml = (bucket.keywords || []).map((keyword, idx) => `
                <div class="keyword-input-group">
                    <input type="text" class="keyword-input" value="${keyword}" 
                           onchange="UI.updateBucketKeyword('${bucket.id}', ${idx}, this.value)">
                    <button class="btn btn-danger btn-small" onclick="UI.removeBucketKeyword('${bucket.id}', ${idx})">Remove</button>
                </div>
            `).join('');

            const allocation = startingAllocations[bucket.id];
            const allocationAmount = allocation ? parseFloat(allocation.amount) || 0 : 0;
            const allocationDate = allocation ? allocation.date : '';
            
            // Calculate remaining available for this bucket (Account Balance - Other Buckets)
            const availableForBucket = Math.max(0, accountBalance - (totalAllocated - allocationAmount));
            
            // Determine if bucket should be open (expanded)
            const isBucketOpen = (bucket.id === expandedBucketId) || openBucketIds.has(bucket.id);

            item.innerHTML = `
                <details ${isBucketOpen ? 'open' : ''} style="background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                    <summary style="cursor: pointer; padding: 12px; font-weight: 500; display: flex; align-items: center; justify-content: space-between; outline: none;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-weight: 600; font-size: 1.05em;">${bucket.name}</span>
                        </div>
                        <span class="dropdown-arrow" style="font-size: 0.8em; color: #999;">▼</span>
                    </summary>
                    
                    <div class="bucket-details-content" style="padding: 15px; border-top: 1px solid #f0f0f0;">
                        <div class="bucket-header" style="align-items: flex-end;">
                            <div style="flex-grow: 1; margin-right: 15px;">
                                <label style="display: block; font-weight: 500; font-size: 1.1em; margin-bottom: 6px; color: #555;">Bucket Name:</label>
                                <input type="text" class="bucket-name-input" value="${bucket.name}" 
                                       onchange="UI.updateBucketName('${bucket.id}', this.value)" style="width: 100%;">
                            </div>
                            <button class="btn btn-danger btn-small" onclick="UI.deleteBucket('${bucket.id}')" style="margin-bottom: 2px;">Delete Bucket</button>
                        </div>
                        <div class="bucket-keywords">
                            <label style="display: block; margin-bottom: 8px; font-weight: 500; font-size: 0.9em; color: #555;">Keywords (for auto-assignment):</label>
                            ${keywordsHtml}
                            <button class="btn btn-secondary btn-small add-keyword-btn" onclick="UI.addBucketKeyword('${bucket.id}')">+ Add Keyword</button>
                        </div>
                        <details class="bucket-starting-balance-details" style="margin-top: 12px; border-top: 1px solid #dee2e6; padding-top: 12px;">
                            <summary style="cursor: pointer; font-weight: 500; font-size: 0.9em; color: #555; outline: none; display: flex; align-items: center; justify-content: space-between;">
                                <span>Starting Balance</span>
                                <span class="dropdown-arrow" style="font-size: 0.8em; color: #999;">▼</span>
                            </summary>
                            <div class="bucket-starting-balance-content" style="margin-top: 10px;">
                                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <input type="number" step="0.01" id="starting-amount-${bucket.id}" class="starting-amount-input" 
                                           value="${allocationAmount}" 
                                           placeholder="0.00"
                                           onchange="UI.updateStartingAllocation('${bucket.id}', this.value, document.getElementById('starting-date-${bucket.id}').value)"
                                           style="width: 120px; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                                    <span style="font-weight: 500;">$</span>
                                    <input type="date" id="starting-date-${bucket.id}" 
                                           value="${allocationDate}" 
                                           onchange="UI.updateStartingAllocation('${bucket.id}', document.getElementById('starting-amount-${bucket.id}').value, this.value)"
                                           style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
                                    <span style="color: #7f8c8d; font-size: 0.9em;">Date</span>
                                </div>
                                <p style="color: #7f8c8d; font-size: 0.85em; margin-top: 4px; font-style: italic;">
                                    Transactions before this date will be ignored for this bucket.
                                </p>
                            </div>
                        </details>
                    </div>
                </details>
            `;

            container.appendChild(item);
        });
    },

    /**
     * Create bucket for specific account
     */
    createBucketForAccount(accountNumber) {
        const name = prompt('Enter bucket name:');
        if (!name) return;

        const buckets = Storage.getBuckets();
        const newBucket = {
            id: 'bucket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11),
            name: name.trim(),
            account_number: accountNumber,
            keywords: [name.trim()],
            suggested: false
        };

        buckets.push(newBucket);
        Storage.saveBuckets(buckets);
        this.renderPerAccountBuckets(newBucket.id);
    },

    /**
     * Update proceed to classification button
     */
    updateProceedToClassificationButton() {
        const confirmedAccounts = Storage.getConfirmedAccounts();
        const buckets = Storage.getBuckets();
        const btn = document.getElementById('proceed-to-classification-btn');
        
        if (btn) {
            // Only check savings accounts
            const savingsAccounts = confirmedAccounts.filter(acc => acc.account_type === 'savings');
            const allSavingsAccountsHaveBuckets = savingsAccounts.length > 0 && 
                savingsAccounts.every(account => 
                    buckets.some(bucket => bucket.account_number === account.account_number)
                );
            btn.style.display = allSavingsAccountsHaveBuckets ? 'inline-block' : 'none';
        }
    },

    /**
     * Auto-assign transactions based on bucket keywords
     */
    autoAssignTransactionsByKeywords(transactions, buckets, classifications) {
        let autoAssignedCount = 0;
        
        transactions.forEach(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            
            // Skip if already classified
            if (classifications[txId]) return;
            
            const description = (tx.description || tx.user_description || '').toLowerCase();
            const accountNumber = tx.account_number || 'unknown';
            
            // Find matching bucket by keyword
            for (const bucket of buckets) {
                // Only match buckets for the same account
                if (bucket.account_number !== accountNumber) continue;
                
                // Check if any keyword matches
                if (bucket.keywords && bucket.keywords.length > 0) {
                    const matches = bucket.keywords.some(keyword => {
                        if (!keyword || !keyword.trim()) return false;
                        return description.includes(keyword.toLowerCase().trim());
                    });
                    
                    if (matches) {
                        classifications[txId] = bucket.id;
                        autoAssignedCount++;
                        break;
                    }
                }
            }
        });
        
        if (autoAssignedCount > 0) {
            Storage.saveTransactionClassifications(classifications);
            // Only show status if called manually (not on every render)
            // Status will be shown by the caller if needed
        }
        
        return autoAssignedCount;
    },

    /**
     * Render unclassified transactions (Phase 3)
     */
    renderUnclassifiedTransactions() {
        const container = document.getElementById('unclassified-transactions');
        const transactions = Storage.getTransactions();
        const classifications = Storage.getTransactionClassifications();
        const confirmedAccounts = Storage.getConfirmedAccounts();
        const buckets = Storage.getBuckets();

        // Find unclassified transactions
        const unclassified = transactions.filter(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            if (tx.included === false) return false;
            return !classifications[txId];
        });

        container.innerHTML = '';

        if (unclassified.length === 0) {
            container.innerHTML = '<p style="color: #27ae60;">✓ All transactions have been classified!</p>';
            return;
        }

        const title = document.createElement('h3');
        title.textContent = `Unclassified Transactions (${unclassified.length})`;
        title.style.marginBottom = '16px';
        container.appendChild(title);

        // Only show transactions for savings accounts
        const savingsAccounts = confirmedAccounts.filter(acc => acc.account_type === 'savings');
        const savingsAccountNumbers = new Set(savingsAccounts.map(acc => acc.account_number));
        
        // Filter transactions - only show those in savings accounts OR transfers TO savings accounts
        const relevantTransactions = unclassified.filter(tx => {
            const txAccountNum = tx.account_number || 'unknown';
            
            // Include if transaction is in a savings account
            if (savingsAccountNumbers.has(txAccountNum)) {
                return true;
            }
            
            // Include if it's a transfer TO a savings account (from day-to-day)
            const description = (tx.description || tx.user_description || '').toLowerCase();
            const isTransferToSavings = savingsAccounts.some(acc => 
                description.includes(acc.account_number) || 
                description.includes('transfer') && savingsAccountNumbers.has(txAccountNum)
            );
            
            return isTransferToSavings;
        });

        // Auto-assign transactions based on keywords (silently, don't show status every render)
        const beforeCount = relevantTransactions.length;
        this.autoAssignTransactionsByKeywords(relevantTransactions, buckets, classifications);
        
        // Re-fetch classifications after auto-assignment
        const updatedClassifications = Storage.getTransactionClassifications();
        
        // Find still unclassified transactions after auto-assignment
        const stillUnclassified = transactions.filter(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            if (tx.included === false) return false;
            return !updatedClassifications[txId];
        }).filter(tx => {
            const txAccountNum = tx.account_number || 'unknown';
            return savingsAccountNumbers.has(txAccountNum);
        });

        if (stillUnclassified.length === 0 && beforeCount > 0) {
            container.innerHTML = '<p style="color: #27ae60;">✓ All transactions have been classified!</p>';
            return;
        }

        // Update title with current count
        title.textContent = `Unclassified Transactions (${stillUnclassified.length})`;
        
        // Add controls row with auto-assign button
        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;';
        
        // Add button to manually trigger auto-assignment
        const autoAssignBtn = document.createElement('button');
        autoAssignBtn.className = 'btn btn-secondary';
        autoAssignBtn.textContent = '🔄 Re-run Auto-Assignment';
        autoAssignBtn.style.marginBottom = '16px';
        autoAssignBtn.onclick = () => {
            const currentUnclassified = transactions.filter(tx => {
                const txId = tx.transaction_id || this.generateTransactionId(tx);
                return !updatedClassifications[txId];
            }).filter(tx => {
                const txAccountNum = tx.account_number || 'unknown';
                return savingsAccountNumbers.has(txAccountNum);
            });
            const assignedCount = this.autoAssignTransactionsByKeywords(currentUnclassified, buckets, updatedClassifications);
            if (assignedCount > 0) {
                this.showStatus(`Auto-assigned ${assignedCount} transaction(s) based on keywords`, 'success');
            } else {
                this.showStatus('No transactions matched keywords', 'success');
            }
            this.renderUnclassifiedTransactions();
        };
        controlsRow.appendChild(autoAssignBtn);
        container.appendChild(controlsRow);

        // Group still unclassified transactions by account
        const byAccount = {};
        stillUnclassified.forEach(tx => {
            const accountNum = tx.account_number || 'unknown';
            // Only group savings account transactions
            if (savingsAccountNumbers.has(accountNum)) {
                if (!byAccount[accountNum]) {
                    byAccount[accountNum] = [];
                }
                byAccount[accountNum].push(tx);
            }
        });

        Object.keys(byAccount).forEach(accountNum => {
            const account = savingsAccounts.find(a => String(a.account_number).trim() === String(accountNum).trim());
            // Robust matching for buckets
            const accountBuckets = buckets.filter(b => String(b.account_number).trim() === String(accountNum).trim());
            const accountTxs = byAccount[accountNum];

            if (!account || accountBuckets.length === 0) {
                // Skip if not a savings account or no buckets
                return;
            }

            // Sort by date based on current sort state for this account
            const accountSortOrder = this.sortState.unclassified[accountNum] || 'newest';
            accountTxs.sort(this.getDateSortComparator(accountSortOrder));

            const accountSection = document.createElement('div');
            accountSection.className = 'account-card'; // Collapsed by default
            accountSection.style.marginBottom = '20px';

            const accountName = account ? account.account_name : `Account ${accountNum}`;

            accountSection.innerHTML = `
                <div class="account-header" style="background-color: #f0f4f8; border-bottom: 2px solid #ddd; cursor: pointer;">
                    <div class="account-info">
                        <div class="account-name" style="font-size: 1.1em;">${accountName}</div>
                        <div class="account-number">${accountNum}</div>
                    </div>
                    <div style="font-size: 0.9em; color: #666; margin-right: 15px;">
                        ${accountTxs.length} unclassified
                    </div>
                    <div class="expand-icon">▼</div>
                </div>
                <div class="account-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background-color: #fff; border-bottom: 1px solid #f0f0f0;">
                        <div style="font-size: 0.85em; font-weight: 600; color: #777;">Transactions:</div>
                        <button class="btn-sort-small" data-account="${accountNum}" title="Toggle sort order">
                            ${accountSortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
                        </button>
                    </div>
                    <div class="unclassified-transactions-list">
                        <!-- Transactions injected here -->
                    </div>
                </div>
            `;
            
            const listContainer = accountSection.querySelector('.unclassified-transactions-list');

            accountTxs.forEach(tx => {
                const txId = tx.transaction_id || this.generateTransactionId(tx);
                const txRow = document.createElement('div');
                txRow.className = 'unclassified-transaction-row';
                
                const desc = tx.description || tx.user_description || 'Transaction';
                const amount = parseFloat(tx.amount) || 0;
                const date = tx.transaction_date || tx.posted_date || 'Unknown date';
                const source = tx.source_file || 'Unknown Source';

                // Use Utils.escapeHtml to prevent XSS attacks
                const escapeHtml = window.Utils ? Utils.escapeHtml : (t) => t;
                
                txRow.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-meta" style="font-size: 0.8em; color: #888; display: flex; gap: 10px; margin-bottom: 2px;">
                            <span class="transaction-date">${escapeHtml(date)}</span>
                            <span class="transaction-source" style="font-style: italic;">From: ${escapeHtml(source)}</span>
                        </div>
                        <div class="transaction-description" style="font-weight: 500;">${escapeHtml(desc)}</div>
                        <div class="transaction-amount ${amount < 0 ? 'negative' : ''}">$${Math.abs(amount).toFixed(2)}</div>
                    </div>
                    <div class="transaction-classify" style="display: flex; gap: 8px;">
                        <select class="bucket-select" onchange="UI.classifyTransaction('${escapeHtml(txId)}', this.value)" style="flex-grow: 1;">
                            <option value="">-- Select Bucket --</option>
                            ${accountBuckets.map(b => 
                                `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`
                            ).join('')}
                        </select>
                        <button class="btn btn-secondary btn-small" title="Ignore this transaction" 
                                onclick="UI.ignoreTransaction('${escapeHtml(txId)}')" 
                                style="padding: 0 10px; color: #666;">✕</button>
                    </div>
                `;
                listContainer.appendChild(txRow);
            });

            // Add toggle logic for header
            const header = accountSection.querySelector('.account-header');
            const content = accountSection.querySelector('.account-content');
            
            // Restore expanded state if previously expanded
            if (this.expandedState.unclassifiedAccounts.has(accountNum)) {
                header.classList.add('expanded');
                content.classList.add('expanded');
            }
            
            header.addEventListener('click', () => {
                const isExpanded = header.classList.toggle('expanded');
                content.classList.toggle('expanded');
                // Track expanded state
                if (isExpanded) {
                    this.expandedState.unclassifiedAccounts.add(accountNum);
                } else {
                    this.expandedState.unclassifiedAccounts.delete(accountNum);
                }
            });

            // Add sort button handler (with stopPropagation to prevent collapse)
            const sortButton = accountSection.querySelector('.btn-sort-small');
            if (sortButton) {
                sortButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleUnclassifiedSort(accountNum);
                });
            }

            container.appendChild(accountSection);
        });
    },

    /**
     * Classify a transaction to a bucket
     */
    classifyTransaction(transactionId, bucketId) {
        if (!bucketId) return;

        const classifications = Storage.getTransactionClassifications();
        classifications[transactionId] = bucketId;
        Storage.saveTransactionClassifications(classifications);

        // Re-render to update counts
        this.renderUnclassifiedTransactions();
    },

    /**
     * Ignore a transaction
     */
    ignoreTransaction(transactionId) {
        const transactions = Storage.getTransactions();
        const tx = transactions.find(t => (t.transaction_id || this.generateTransactionId(t)) === transactionId);
        
        if (tx) {
            if (confirm('Are you sure you want to ignore this transaction? It will be excluded from all bucket calculations.')) {
                tx.included = false;
                Storage.saveTransactions(transactions);
                this.renderUnclassifiedTransactions();
            }
        }
    },

    /**
     * Generate transaction ID if missing
     * Uses shared Utils.generateTransactionId for consistency
     */
    generateTransactionId(tx) {
        // Use shared utility if available for consistent ID generation
        if (window.Utils && Utils.generateTransactionId) {
            return Utils.generateTransactionId(tx);
        }
        // Fallback for backwards compatibility
        const date = tx.transaction_date || tx.posted_date || 'unknown';
        const desc = (tx.description || tx.user_description || '').substring(0, 20).replace(/\s+/g, '_');
        const amount = Math.abs(parseFloat(tx.amount) || 0).toFixed(2);
        return `tx_${date}_${desc}_${amount}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    },

    /**
     * Render saved accounts management interface
     */
    renderSavedAccounts() {
        const container = document.getElementById('saved-accounts-list');
        const savedAccounts = Storage.getSavedAccounts();
        
        container.innerHTML = '';

        if (savedAccounts.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No saved accounts yet. Add your first account below.</p>';
        } else {
            savedAccounts.forEach(account => {
                const item = document.createElement('div');
                item.className = 'saved-account-item';
                item.id = `saved-account-${account.account_number}`;
                
                const safeAccountNumber = account.account_number.replace(/'/g, "\\'");
                const accountName = account.account_name || `Account ${account.account_number}`;
                const accountType = account.account_type || '';
                const typeLabel = accountType === 'savings' ? 'Savings' : accountType === 'day_to_day' ? 'Day to Day' : 'Not Set';
                
                item.innerHTML = `
                    <div class="saved-account-info">
                        <div class="saved-account-header">
                            <input type="text" class="saved-account-name-input" 
                                   value="${accountName.replace(/"/g, '&quot;')}" 
                                   placeholder="Account name"
                                   onblur="UI.updateSavedAccountName('${safeAccountNumber}', this.value)"
                                   style="width: 350px;">
                            <div class="saved-account-details">
                                Account: ${account.account_number}
                                ${account.bsb ? ` | BSB: ${account.bsb}` : ''}
                                | Type: ${typeLabel}
                            </div>
                        </div>
                        <div class="saved-account-type-selection" style="margin-top: 12px;">
                            <label class="account-type-label">
                                <input type="radio" name="saved-account-type-${account.account_number}" 
                                       value="savings" 
                                       onclick="UI.updateSavedAccountType('${safeAccountNumber}', 'savings')"
                                       ${accountType === 'savings' ? 'checked' : ''}>
                                <span>Savings Account</span>
                            </label>
                            <label class="account-type-label" style="margin-left: 16px;">
                                <input type="radio" name="saved-account-type-${account.account_number}" 
                                       value="day_to_day" 
                                       onclick="UI.updateSavedAccountType('${safeAccountNumber}', 'day_to_day')"
                                       ${accountType === 'day_to_day' ? 'checked' : ''}>
                                <span>Day to Day Account</span>
                            </label>
                        </div>
                    </div>
                    <div class="saved-account-actions">
                        <button class="btn btn-danger btn-small" onclick="UI.deleteSavedAccount('${safeAccountNumber}')">
                            Delete
                        </button>
                    </div>
                `;
                
                container.appendChild(item);
            });
        }
    },

    /**
     * Show merge accounts form
     */
    showMergeAccountsForm() {
        const container = document.getElementById('saved-accounts-list');
        const savedAccounts = Storage.getSavedAccounts();
        
        if (savedAccounts.length < 2) {
            UI.showStatus('Need at least 2 accounts to perform a merge.', 'error');
            return;
        }

        container.innerHTML = `
            <div class="card" style="border: 1px solid #ddd; padding: 20px; background: #fafafa;">
                <h3 style="margin-top: 0;">Merge Accounts</h3>
                <p>Select a Source account to merge into a Target account.</p> 
                <p class="warning-text" style="color: #e74c3c; font-size: 0.9em; margin-bottom: 20px;">
                    <strong>Warning:</strong> The Source account will be DELETED. All its transactions and buckets will be moved to the Target account.
                    This is useful for combining duplicate accounts (e.g. PDF full number vs CSV masked number).
                </p>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Source Account (Delete this one):</label>
                    <select id="merge-source-account" class="form-control" style="width: 100%; padding: 8px;" onchange="UI.updateMergeTargetOptions()">
                        <option value="">Select Source Account...</option>
                        ${savedAccounts.map(acc => `<option value="${acc.account_number}">${acc.account_name || 'Account ' + acc.account_number} (${acc.account_number})</option>`).join('')}
                    </select>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Target Account (Keep this one):</label>
                    <select id="merge-target-account" class="form-control" style="width: 100%; padding: 8px;" disabled>
                        <option value="">Select Target Account...</option>
                    </select>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="UI.performMergeAccounts()">Merge Accounts</button>
                    <button class="btn btn-secondary" onclick="UI.renderSavedAccounts()">Cancel</button>
                </div>
            </div>
        `;
    },

    updateMergeTargetOptions() {
        const sourceSelect = document.getElementById('merge-source-account');
        const targetSelect = document.getElementById('merge-target-account');
        const sourceValue = sourceSelect.value;
        const savedAccounts = Storage.getSavedAccounts();

        // Save current target selection
        const currentTarget = targetSelect.value;

        // Rebuild options
        targetSelect.innerHTML = '<option value="">Select Target Account...</option>' + 
            savedAccounts
                .filter(acc => acc.account_number !== sourceValue)
                .map(acc => `<option value="${acc.account_number}">${acc.account_name || 'Account ' + acc.account_number} (${acc.account_number})</option>`)
                .join('');
        
        targetSelect.disabled = !sourceValue;
        
        // Restore selection if valid (and not the source)
        if (currentTarget && currentTarget !== sourceValue) {
            targetSelect.value = currentTarget;
        }
    },

    performMergeAccounts() {
        const sourceNum = document.getElementById('merge-source-account').value;
        const targetNum = document.getElementById('merge-target-account').value;

        if (!sourceNum || !targetNum) {
            UI.showStatus('Please select both Source and Target accounts.', 'error');
            return;
        }

        if (confirm(`Are you sure you want to merge account ${sourceNum} into ${targetNum}? This cannot be undone.`)) {
            // Update Transactions
            const transactions = Storage.getTransactions();
            let txUpdated = 0;
            transactions.forEach(tx => {
                if (tx.account_number === sourceNum) {
                    tx.account_number = targetNum;
                    txUpdated++;
                }
            });
            Storage.saveTransactions(transactions);

            // Update Buckets
            const buckets = Storage.getBuckets();
            let bkUpdated = 0;
            buckets.forEach(bk => {
                if (bk.account_number === sourceNum) {
                    bk.account_number = targetNum;
                    bkUpdated++;
                }
            });
            Storage.saveBuckets(buckets);

            // Delete Source Account from Saved Accounts
            const savedAccounts = Storage.getSavedAccounts();
            const newAccounts = savedAccounts.filter(acc => acc.account_number !== sourceNum);
            Storage.saveSavedAccounts(newAccounts);

            // Update Confirmed Accounts (Remove Source, Ensure Target is Confirmed)
            const confirmedAccounts = Storage.getConfirmedAccounts();
            if (confirmedAccounts.length > 0) {
                const sourceWasConfirmed = confirmedAccounts.some(acc => acc.account_number === sourceNum);
                const newConfirmed = confirmedAccounts.filter(acc => acc.account_number !== sourceNum);
                
                if (sourceWasConfirmed && !newConfirmed.some(acc => acc.account_number === targetNum)) {
                    const targetAccount = newAccounts.find(acc => acc.account_number === targetNum);
                    if (targetAccount) {
                        newConfirmed.push(targetAccount);
                    }
                }
                Storage.saveConfirmedAccounts(newConfirmed);
            }

            UI.showStatus(`Merged successfully. ${txUpdated} transactions and ${bkUpdated} buckets moved.`);
            
            // If we still have enough accounts to merge, stay on the merge screen
            if (newAccounts.length >= 2) {
                UI.showMergeAccountsForm();
            } else {
                UI.renderSavedAccounts();
            }
        }
    },

    /**
     * Show add account form
     */
    showAddAccountForm() {
        const accountNumber = prompt('Enter account number:');
        if (!accountNumber || !accountNumber.trim()) return;
        
        const accountName = prompt('Enter account name (optional):') || `Account ${accountNumber.trim()}`;
        const bsb = prompt('Enter BSB (optional, format: XXX-XXX):') || null;
        
        const accountType = confirm('Is this a Savings Account? (Click OK for Savings, Cancel for Day to Day)') 
            ? 'savings' : 'day_to_day';
        
        const savedAccounts = Storage.getSavedAccounts();
        
        // Check if account already exists
        if (savedAccounts.some(acc => acc.account_number === accountNumber.trim())) {
            UI.showStatus('Account already exists', 'error');
            return;
        }
        
        savedAccounts.push({
            account_number: accountNumber.trim(),
            account_name: accountName.trim(),
            bsb: bsb ? bsb.trim() : null,
            account_type: accountType
        });
        
        Storage.saveSavedAccounts(savedAccounts);
        this.renderSavedAccounts();
        this.showStatus('Account saved successfully');
    },

    /**
     * Update saved account name
     */
    updateSavedAccountName(accountNumber, newName) {
        const savedAccounts = Storage.getSavedAccounts();
        const account = savedAccounts.find(acc => acc.account_number === accountNumber);
        
        if (account) {
            account.account_name = newName.trim() || `Account ${accountNumber}`;
            Storage.saveSavedAccounts(savedAccounts);
        }
    },

    /**
     * Update saved account type
     */
    updateSavedAccountType(accountNumber, accountType) {
        const savedAccounts = Storage.getSavedAccounts();
        const account = savedAccounts.find(acc => acc.account_number === accountNumber);
        
        if (account) {
            account.account_type = accountType;
            Storage.saveSavedAccounts(savedAccounts);
            
            // Also update in confirmed accounts if it's confirmed
            const confirmed = Storage.getConfirmedAccounts();
            const confirmedAccount = confirmed.find(acc => acc.account_number === accountNumber);
            if (confirmedAccount) {
                confirmedAccount.account_type = accountType;
                Storage.saveConfirmedAccounts(confirmed);
            }
            
            // Update proceed button
            this.updateProceedToBucketsButton();
        }
    },

    /**
     * Delete saved account
     */
    deleteSavedAccount(accountNumber) {
        if (!confirm(`Are you sure you want to delete account ${accountNumber}? This will not delete transactions, but you'll need to re-enter account details.`)) {
            return;
        }
        
        const savedAccounts = Storage.getSavedAccounts();
        const filtered = savedAccounts.filter(acc => acc.account_number !== accountNumber);
        Storage.saveSavedAccounts(filtered);
        
        // Also remove from confirmed accounts
        const confirmed = Storage.getConfirmedAccounts();
        const filteredConfirmed = confirmed.filter(acc => acc.account_number !== accountNumber);
        Storage.saveConfirmedAccounts(filteredConfirmed);
        
        // Remove buckets for this account
        const buckets = Storage.getBuckets();
        const filteredBuckets = buckets.filter(b => b.account_number !== accountNumber);
        Storage.saveBuckets(filteredBuckets);
        
        // Remove classifications for transactions in this account
        const transactions = Storage.getTransactions();
        const classifications = Storage.getTransactionClassifications();
        transactions.forEach(tx => {
            if ((tx.account_number || 'unknown') === accountNumber) {
                const txId = tx.transaction_id || this.generateTransactionId(tx);
                delete classifications[txId];
            }
        });
        Storage.saveTransactionClassifications(classifications);
        
        this.renderSavedAccounts();
        this.showStatus('Account deleted');
        
        // Update proceed button
        this.updateProceedToBucketsButton();
    },

    /**
     * Calculate bucket balances from transaction classifications
     */
    calculateBucketBalancesFromClassifications(buckets, transactions, classifications, startingAllocations) {
        const balances = {};

        // Initialize from starting allocations
        buckets.forEach(bucket => {
            const allocation = startingAllocations[bucket.id];
            balances[bucket.id] = allocation ? parseFloat(allocation.amount) || 0 : 0;
        });

        // Apply transactions based on classifications
        transactions.forEach(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            const bucketId = classifications[txId];

            if (bucketId && balances[bucketId] !== undefined) {
                const amount = parseFloat(tx.amount) || 0;
                const isCredit = tx.credit_debit?.toLowerCase() === 'credit' || amount > 0;
                const transactionAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

                // Check if transaction is after starting allocation date
                const allocation = startingAllocations[bucketId];
                if (allocation && allocation.date) {
                    const txDate = new Date(tx.transaction_date || tx.posted_date || 0);
                    const allocationDate = new Date(allocation.date);
                    if (txDate < allocationDate) {
                        return; // Skip transactions before allocation date
                    }
                }

                balances[bucketId] += transactionAmount;
            }
        });

        return balances;
    },

    /**
     * Render final breakdown (Phase 4)
     */
    renderBreakdown() {
        const container = document.getElementById('breakdown-list');
        const transactions = Storage.getTransactions();
        const buckets = Storage.getBuckets();
        const startingAllocations = Storage.getStartingAllocations();
        const classifications = Storage.getTransactionClassifications();
        const confirmedAccounts = Storage.getConfirmedAccounts();

        if (transactions.length === 0) {
            container.innerHTML = '<p>No data available.</p>';
            return;
        }

        container.innerHTML = '';
        
        // Only show confirmed savings accounts
        const savingsAccounts = confirmedAccounts.filter(acc => acc.account_type === 'savings');
        
        if (savingsAccounts.length === 0) {
            container.innerHTML = '<p>No savings accounts found.</p>';
            return;
        }

        // Calculate transaction statistics
        const savingsAccountNumbers = new Set(savingsAccounts.map(acc => acc.account_number));
        const relevantTransactions = transactions.filter(tx => 
            savingsAccountNumbers.has(tx.account_number || 'unknown')
        );
        const totalImported = relevantTransactions.length;
        const ignoredTransactions = relevantTransactions.filter(tx => tx.included === false);
        const activeTransactions = relevantTransactions.filter(tx => tx.included !== false);
        const classifiedTransactions = activeTransactions.filter(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            return classifications[txId];
        });
        const unclassifiedTransactions = activeTransactions.filter(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            return !classifications[txId];
        });

        // Get unique source files
        const sourceFiles = [...new Set(
            transactions
                .map(tx => tx.source_file)
                .filter(f => f && f !== 'Unknown Source')
        )].sort();

        // Get import stats (duplicates filtered)
        const importStats = Storage.getImportStats();
        const duplicatesFiltered = importStats.duplicatesFiltered || 0;

        // Use Utils.escapeHtml to prevent XSS attacks
        const escapeHtml = window.Utils ? Utils.escapeHtml : (t) => t;

        // Add transaction summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'transaction-summary';
        summaryDiv.style.cssText = 'background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; font-size: 0.9em;';
        summaryDiv.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #2c3e50;">Transaction Summary:</div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <span style="color: #666;">
                        <strong>${totalImported}</strong> imported
                    </span>
                    <span style="color: #27ae60;">
                        <strong>${classifiedTransactions.length}</strong> classified
                    </span>
                    ${unclassifiedTransactions.length > 0 ? `
                        <span style="color: #e67e22;">
                            <strong>${unclassifiedTransactions.length}</strong> unclassified
                        </span>
                    ` : ''}
                    ${ignoredTransactions.length > 0 ? `
                        <span style="color: #95a5a6;">
                            <strong>${ignoredTransactions.length}</strong> ignored
                        </span>
                    ` : ''}
                    ${duplicatesFiltered > 0 ? `
                        <span style="color: #6c757d;" title="Duplicate transactions that were automatically filtered during import">
                            <strong>${duplicatesFiltered}</strong> duplicates filtered
                        </span>
                    ` : ''}
                </div>
            </div>
            ${sourceFiles.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; padding-top: 8px; border-top: 1px solid #dee2e6;">
                    <div style="font-weight: 600; color: #2c3e50; white-space: nowrap;">Source Files:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${sourceFiles.map(f => `
                            <span style="background: #e9ecef; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; color: #495057;">
                                ${escapeHtml(f)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            <div style="padding-top: 8px; border-top: 1px solid #dee2e6; margin-top: 8px;">
                <button class="btn btn-secondary btn-small" id="download-diagnostic-csv" style="font-size: 0.85em;">
                    📋 Download Diagnostic CSV
                </button>
                <span style="font-size: 0.8em; color: #888; margin-left: 8px;">
                    Detailed log for troubleshooting import issues
                </span>
            </div>
        `;
        container.appendChild(summaryDiv);
        
        // Add diagnostic CSV download handler
        const diagBtn = document.getElementById('download-diagnostic-csv');
        if (diagBtn) {
            diagBtn.addEventListener('click', () => this.downloadDiagnosticCSV());
        }

        savingsAccounts.forEach(account => {
            const accountBuckets = buckets.filter(b => b.account_number === account.account_number);
            const accountTransactions = transactions.filter(tx => 
                (tx.account_number || 'unknown') === account.account_number && tx.included !== false
            );
            
            // Calculate bucket balances
            const bucketBalances = this.calculateBucketBalancesFromClassifications(
                accountBuckets,
                accountTransactions,
                classifications,
                startingAllocations
            );

            const totalBucketsBalance = Object.values(bucketBalances).reduce((sum, b) => sum + (b || 0), 0);
            
            // Calculate unallocated (Account Balance - Sum of Buckets)
            const unallocated = (account.balance || 0) - totalBucketsBalance;

            const card = document.createElement('div');
            card.className = 'account-card'; // Default collapsed
            card.style.marginBottom = '20px';

            const accountName = account.account_name || `Account ${account.account_number}`;

            let bucketsHtml = '';
            if (accountBuckets.length > 0) {
                accountBuckets.forEach(bucket => {
                    const balance = bucketBalances[bucket.id] || 0;
                    
                    // Filter transactions for this bucket
                    const bucketTransactions = accountTransactions.filter(tx => {
                        const txId = tx.transaction_id || this.generateTransactionId(tx);
                        return classifications[txId] === bucket.id;
                    });

                    // Sort transactions by date based on sort state for this bucket
                    const bucketSortOrder = this.sortState.breakdown[bucket.id] || 'newest';
                    bucketTransactions.sort(this.getDateSortComparator(bucketSortOrder));

                    // Check for starting allocation
                    const allocation = startingAllocations[bucket.id];
                    
                    let transactionsHtml = '';
                    if (allocation) {
                         transactionsHtml += `
                            <div class="transaction-row" style="padding: 6px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; color: #555; font-style: italic;">
                                <div>Starting Balance (${allocation.date})</div>
                                <div>$${parseFloat(allocation.amount).toFixed(2)}</div>
                            </div>
                        `;
                    }

                    if (bucketTransactions.length === 0 && !allocation) {
                         transactionsHtml += '<div style="padding: 8px; color: #999; font-style: italic;">No transactions allocated to this bucket.</div>';
                    } else {
                        // Use Utils.escapeHtml to prevent XSS attacks
                        const escapeHtml = window.Utils ? Utils.escapeHtml : (t) => t;
                        
                        bucketTransactions.forEach(tx => {
                             // Check if transaction is before allocation date (if exists) and skip if so (logic matches calculation)
                            if (allocation && allocation.date) {
                                const txDate = new Date(tx.transaction_date || tx.posted_date || 0);
                                const allocationDate = new Date(allocation.date);
                                if (txDate < allocationDate) return;
                            }

                            const amount = parseFloat(tx.amount) || 0;
                            // Display amount relative to bucket (credits add, debits subtract usually, but here we just show signed amount)
                            // Wait, logic in calculation: isCredit ? abs(amount) : -abs(amount)
                            const isCredit = tx.credit_debit?.toLowerCase() === 'credit' || amount > 0;
                            const displayAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);

                            transactionsHtml += `
                                <div class="transaction-row" style="padding: 6px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; font-size: 0.9em;">
                                    <div style="flex-grow: 1; padding-right: 10px;">
                                        <div style="font-weight: 500;">${escapeHtml(tx.description || tx.user_description)}</div>
                                        <div style="font-size: 0.85em; color: #888;">${escapeHtml(tx.transaction_date || tx.posted_date)}</div>
                                    </div>
                                    <div style="${displayAmount < 0 ? 'color: #e74c3c;' : 'color: #27ae60;'}">
                                        $${displayAmount.toFixed(2)}
                                    </div>
                                </div>
                            `;
                        });
                    }

                    const bucketIsOpen = this.expandedState.breakdownBuckets.has(bucket.id);
                    bucketsHtml += `
                        <div class="bucket-row-container" style="border-bottom: 1px solid #eee;">
                            <details style="width: 100%;" data-bucket-id="${bucket.id}" ${bucketIsOpen ? 'open' : ''}>
                                <summary style="padding: 12px 16px; display: flex; justify-content: space-between; cursor: pointer; align-items: center; list-style: none;">
                                    <div class="bucket-row-name" style="font-weight: 500; display: flex; align-items: center;">
                                        ${bucket.name}
                                        <span class="dropdown-arrow" style="font-size: 0.8em; color: #999; margin-left: 8px;">▼</span>
                                    </div>
                                    <div class="bucket-row-balance ${balance < 0 ? 'negative' : ''}">
                                        $${balance.toFixed(2)}
                                    </div>
                                </summary>
                                <div class="bucket-transactions" style="padding: 0 16px 12px 16px; background-color: #fafafa; border-top: 1px solid #f0f0f0;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0;">
                                        <div style="font-size: 0.85em; font-weight: 600; color: #777;">Transactions:</div>
                                        <button class="btn-sort-small" onclick="event.stopPropagation(); UI.toggleBreakdownSort('${bucket.id}')" title="Toggle sort order">
                                            ${bucketSortOrder === 'newest' ? '↓ Newest' : '↑ Oldest'}
                                        </button>
                                    </div>
                                    ${transactionsHtml}
                                </div>
                            </details>
                        </div>
                    `;
                });
            } else {
                bucketsHtml = '<div style="padding: 16px; font-style: italic; color: #666;">No buckets defined.</div>';
            }
            
            // Add Unallocated if significant
            if (Math.abs(unallocated) > 0.01) {
                 bucketsHtml += `
                        <div class="bucket-row" style="padding: 12px 16px; border-bottom: 1px solid #eee; background-color: #fff3e0;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div class="bucket-row-name" style="font-style: italic; color: #e65100;">Unallocated / Remaining</div>
                                <div class="bucket-row-balance ${unallocated < 0 ? 'negative' : ''}" style="color: #e65100;">
                                    $${unallocated.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    `;
            }

            const accountIsOpen = this.expandedState.breakdownAccounts.has(account.account_number);
            card.innerHTML = `
                <details style="width: 100%;" data-account-number="${account.account_number}" ${accountIsOpen ? 'open' : ''}>
                    <summary class="account-header" style="background-color: #f0f4f8; border-bottom: 2px solid #ddd; cursor: pointer; padding: 15px; display: flex; justify-content: space-between; align-items: center; list-style: none;">
                        <div class="account-info">
                            <div class="account-name" style="font-size: 1.2em; font-weight: 600;">${accountName}</div>
                            <div class="account-number" style="color: #666;">${account.account_number}</div>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <div class="account-balance ${account.balance < 0 ? 'negative' : ''}" style="font-size: 1.2em; font-weight: bold; margin-right: 15px;">
                                $${(account.balance || 0).toFixed(2)}
                            </div>
                            <div class="expand-icon">▼</div>
                        </div>
                    </summary>
                    <div class="account-content" style="display: block;"> <!-- Always block because details handles visibility -->
                        <div style="padding: 12px 16px; font-weight: bold; color: #555; border-bottom: 1px solid #eee; background-color: #fff;">
                            Which is made up of:
                        </div>
                        <div class="buckets-list">
                            ${bucketsHtml}
                        </div>
                        <div class="bucket-row" style="padding: 12px 16px; background-color: #e8f5e9; font-weight: bold; border-top: 2px solid #c8e6c9; display: flex; justify-content: space-between;">
                            <div class="bucket-row-name">Total Calculated</div>
                            <div class="bucket-row-balance">
                                 $${(totalBucketsBalance + unallocated).toFixed(2)}
                            </div>
                        </div>
                    </div>
                </details>
            `;
            
            container.appendChild(card);

            // Add event listeners to track open/close state for details elements
            const accountDetails = card.querySelector('details[data-account-number]');
            if (accountDetails) {
                accountDetails.addEventListener('toggle', () => {
                    const accNum = accountDetails.dataset.accountNumber;
                    if (accountDetails.open) {
                        this.expandedState.breakdownAccounts.add(accNum);
                    } else {
                        this.expandedState.breakdownAccounts.delete(accNum);
                    }
                });
            }

            // Track bucket details open/close state
            const bucketDetails = card.querySelectorAll('details[data-bucket-id]');
            bucketDetails.forEach(details => {
                details.addEventListener('toggle', () => {
                    const bucketId = details.dataset.bucketId;
                    if (details.open) {
                        this.expandedState.breakdownBuckets.add(bucketId);
                    } else {
                        this.expandedState.breakdownBuckets.delete(bucketId);
                    }
                });
            });
        });

    },

    /**
     * Download diagnostic CSV with detailed transaction information
     * Helps troubleshoot import and parsing issues
     */
    downloadDiagnosticCSV() {
        const transactions = Storage.getTransactions();
        const classifications = Storage.getTransactionClassifications();
        const buckets = Storage.getBuckets();
        const confirmedAccounts = Storage.getConfirmedAccounts();
        const savedAccounts = Storage.getSavedAccounts();
        const importStats = Storage.getImportStats();

        // Create bucket lookup
        const bucketLookup = {};
        buckets.forEach(b => { bucketLookup[b.id] = b.name; });

        // Create account lookup
        const accountLookup = {};
        confirmedAccounts.forEach(a => { 
            accountLookup[a.account_number] = { 
                name: a.account_name, 
                type: a.account_type,
                confirmed: true
            }; 
        });
        savedAccounts.forEach(a => { 
            if (!accountLookup[a.account_number]) {
                accountLookup[a.account_number] = { 
                    name: a.account_name, 
                    type: a.account_type,
                    confirmed: false
                };
            }
        });

        // CSV Header
        const headers = [
            'Row',
            'Transaction ID',
            'Date',
            'Description',
            'Amount',
            'Credit/Debit',
            'Account Number',
            'Account Name',
            'Account Type',
            'Account Confirmed',
            'Source File',
            'Included',
            'Classified Bucket',
            'Transaction Type',
            'Provider',
            'Merchant',
            'Source',
            'Raw Amount',
            'Currency'
        ];

        // Build CSV rows
        const rows = [headers.join(',')];
        
        transactions.forEach((tx, index) => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            const bucketId = classifications[txId];
            const bucketName = bucketId ? bucketLookup[bucketId] : '';
            const accountInfo = accountLookup[tx.account_number] || {};
            
            const row = [
                index + 1,
                this.escapeCSV(txId),
                this.escapeCSV(tx.transaction_date || tx.posted_date || ''),
                this.escapeCSV(tx.description || tx.user_description || ''),
                tx.amount || 0,
                this.escapeCSV(tx.credit_debit || (parseFloat(tx.amount) >= 0 ? 'credit' : 'debit')),
                this.escapeCSV(tx.account_number || 'unknown'),
                this.escapeCSV(accountInfo.name || tx.account_name || ''),
                this.escapeCSV(accountInfo.type || ''),
                accountInfo.confirmed ? 'Yes' : 'No',
                this.escapeCSV(tx.source_file || ''),
                tx.included === false ? 'No (Ignored)' : 'Yes',
                this.escapeCSV(bucketName || '(Unclassified)'),
                this.escapeCSV(tx.transaction_type || ''),
                this.escapeCSV(tx.provider_name || ''),
                this.escapeCSV(tx.merchant_name || ''),
                this.escapeCSV(tx.source || ''),
                this.escapeCSV(String(tx.amount)),
                this.escapeCSV(tx.currency || 'AUD')
            ];
            
            rows.push(row.join(','));
        });

        // Add summary section at the end
        rows.push('');
        rows.push('--- DIAGNOSTIC SUMMARY ---');
        rows.push(`Total Transactions in Storage,${transactions.length}`);
        rows.push(`Duplicates Filtered (cumulative),${importStats.duplicatesFiltered || 0}`);
        rows.push(`Confirmed Accounts,${confirmedAccounts.length}`);
        rows.push(`Saved Accounts,${savedAccounts.length}`);
        rows.push(`Buckets Defined,${buckets.length}`);
        rows.push('');
        
        // Transactions by source file
        rows.push('--- TRANSACTIONS BY SOURCE FILE ---');
        const bySource = {};
        transactions.forEach(tx => {
            const source = tx.source_file || 'Unknown';
            bySource[source] = (bySource[source] || 0) + 1;
        });
        Object.entries(bySource).forEach(([source, count]) => {
            rows.push(`${this.escapeCSV(source)},${count}`);
        });
        rows.push('');
        
        // Transactions by account
        rows.push('--- TRANSACTIONS BY ACCOUNT ---');
        const byAccount = {};
        transactions.forEach(tx => {
            const acc = tx.account_number || 'Unknown';
            byAccount[acc] = (byAccount[acc] || 0) + 1;
        });
        Object.entries(byAccount).forEach(([acc, count]) => {
            const info = accountLookup[acc] || {};
            rows.push(`${this.escapeCSV(acc)},${this.escapeCSV(info.name || '')},${info.type || ''},${count}`);
        });
        rows.push('');
        
        // Classification summary
        rows.push('--- CLASSIFICATION SUMMARY ---');
        const included = transactions.filter(tx => tx.included !== false);
        const ignored = transactions.filter(tx => tx.included === false);
        const classified = included.filter(tx => {
            const txId = tx.transaction_id || this.generateTransactionId(tx);
            return classifications[txId];
        });
        rows.push(`Included Transactions,${included.length}`);
        rows.push(`Ignored Transactions,${ignored.length}`);
        rows.push(`Classified Transactions,${classified.length}`);
        rows.push(`Unclassified Transactions,${included.length - classified.length}`);
        
        // Download
        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bank-buckets-diagnostic-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showStatus('Diagnostic CSV downloaded', 'success');
    },

    /**
     * Escape a value for CSV format
     */
    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }
};

