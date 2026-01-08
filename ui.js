// UI rendering and interaction logic

const UI = {
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
            
            item.innerHTML = `
                <h3>${suggestion.name}</h3>
                <p>Found ${suggestion.matchCount} matching transactions</p>
                <div class="suggestion-keywords">
                    ${suggestion.keywords.slice(0, 5).map(k => 
                        `<span class="keyword-tag">${k}</span>`
                    ).join('')}
                </div>
                <button class="btn btn-primary btn-small" onclick="UI.acceptSuggestion('${suggestion.id}')" style="margin-top: 8px;">
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
            } else {
                this.renderAccounts(); // This might be wrong function? renderTransactionClassification?
                // The snippet showed renderAccounts() in original code, but line 182 comment says renderAccounts.
                // Let's stick to original logic for render.
                this.renderAccounts(); 
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
            } else {
                this.renderAccounts();
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
                this.renderAccounts();
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
                this.renderPerAccountBuckets();
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
            this.renderAccounts();
            if (phase === WorkflowManager.PHASES.CLASSIFICATION) {
                this.renderUnclassifiedTransactions();
            }
        }
    },

    /**
     * Render accounts and buckets view (updated to use classifications)
     */
    renderAccounts() {
        const container = document.getElementById('accounts-list');
        const transactions = Storage.getTransactions();
        const buckets = Storage.getBuckets();
        const startingAllocations = Storage.getStartingAllocations();
        const classifications = Storage.getTransactionClassifications();
        const confirmedAccounts = Storage.getConfirmedAccounts();

        if (transactions.length === 0) {
            container.innerHTML = '<p>No transactions imported yet.</p>';
            return;
        }

        // Only show savings accounts in the accounts view
        const savingsAccounts = confirmedAccounts.filter(acc => acc.account_type === 'savings');
        const accounts = savingsAccounts.length > 0 ? savingsAccounts : 
            (confirmedAccounts.length > 0 ? confirmedAccounts : CSVParser.extractAccounts(transactions));
        container.innerHTML = '';

        // Filter to only savings accounts
        const accountsToShow = accounts.filter(acc => {
            const confirmed = confirmedAccounts.find(ca => ca.account_number === acc.account_number);
            return !confirmed || confirmed.account_type === 'savings';
        });

        accountsToShow.forEach((account, index) => {
            const accountCard = document.createElement('div');
            accountCard.className = 'account-card';

            const isMainAccount = index === 0; // First account is main
            const isExpanded = isMainAccount;

            // Get buckets for this account
            const accountBuckets = buckets.filter(b => b.account_number === account.account_number);
            
            // Get transactions for this account
            const accountTransactions = transactions.filter(tx => 
                (tx.account_number || 'unknown') === account.account_number
            );

            // Calculate balances using classifications
            const balances = this.calculateBucketBalancesFromClassifications(
                accountBuckets,
                accountTransactions,
                classifications,
                startingAllocations
            );

            const totalBuckets = Object.values(balances).reduce((sum, b) => sum + (b || 0), 0);

            // Account header
            const accountName = account.account_name || `Account ${account.account_number}`;
            const accountType = account.account_type || '';
            const typeLabel = accountType === 'day_to_day' ? ' (Day to Day)' : 
                            accountType === 'savings' ? ' (Savings)' : '';
            
            const header = document.createElement('div');
            header.className = `account-header ${isExpanded ? 'expanded' : ''}`;
            header.onclick = () => UI.toggleAccount(account.account_number);
            header.innerHTML = `
                <div class="account-info">
                    <div class="account-name">${accountName}${typeLabel}</div>
                    <div class="account-number">${account.account_number}</div>
                </div>
                <div class="account-balance ${account.balance < 0 ? 'negative' : ''}">
                    $${account.balance.toFixed(2)}
                </div>
                <div class="expand-icon">▼</div>
            `;

            // Account content
            const content = document.createElement('div');
            content.className = `account-content ${isExpanded ? 'expanded' : ''}`;

            // Buckets list
            const bucketsList = document.createElement('div');
            bucketsList.className = 'buckets-list';

            if (accountBuckets.length === 0) {
                bucketsList.innerHTML = '<p>No buckets configured for this account. Set up buckets in Step 2.</p>';
            } else {
                accountBuckets.forEach(bucket => {
                    const balance = balances[bucket.id] || 0;
                    const row = document.createElement('div');
                    row.className = 'bucket-row';
                    row.innerHTML = `
                        <div class="bucket-row-name">
                            ${bucket.name}
                            <button class="btn btn-secondary btn-small" 
                                    onclick="UI.showStartingAllocationModal('${bucket.id}', '${bucket.name.replace(/'/g, "\\'")}')" 
                                    style="margin-left: 8px; font-size: 11px;">
                                Set Starting Amount
                            </button>
                        </div>
                        <div class="bucket-row-balance ${balance < 0 ? 'negative' : ''}">
                            $${balance.toFixed(2)}
                        </div>
                    `;
                    bucketsList.appendChild(row);
                });

                // Total buckets
                const totalRow = document.createElement('div');
                totalRow.className = 'total-buckets';
                totalRow.innerHTML = `
                    <span>Total Allocated:</span>
                    <span>$${totalBuckets.toFixed(2)}</span>
                `;
                bucketsList.appendChild(totalRow);
            }

            content.appendChild(bucketsList);
            accountCard.setAttribute('data-account', account.account_number);
            accountCard.appendChild(header);
            accountCard.appendChild(content);
            container.appendChild(accountCard);
        });
    },

    /**
     * Toggle account expansion
     */
    toggleAccount(accountNumber) {
        const accountCard = document.querySelector(`[data-account="${accountNumber}"]`);
        if (!accountCard) return;

        const header = accountCard.querySelector('.account-header');
        const content = accountCard.querySelector('.account-content');

        const isExpanded = header.classList.contains('expanded');
        if (isExpanded) {
            header.classList.remove('expanded');
            content.classList.remove('expanded');
        } else {
            header.classList.add('expanded');
            content.classList.add('expanded');
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
        
        // Update accounts view if visible
        const phase = WorkflowManager.getCurrentPhase();
        if (phase === WorkflowManager.PHASES.CLASSIFICATION) {
            this.renderAccounts();
        }
    },

    /**
     * Show starting allocation modal (for accounts view)
     */
    showStartingAllocationModal(bucketId, bucketName) {
        // Simple prompt for now - could be enhanced with a proper modal
        const amount = prompt(`Enter starting allocation amount for "${bucketName}":`);
        if (amount === null) return;

        const date = prompt(`Enter allocation date (YYYY-MM-DD) or leave blank for today:`) || 
                     new Date().toISOString().split('T')[0];

        this.updateStartingAllocation(bucketId, amount, date);
        this.renderAccounts();
        this.showStatus('Starting allocation saved');
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
    renderPerAccountBuckets() {
        const container = document.getElementById('bucket-management');
        
        // Preserve open/closed state of details elements
        const openAccountNumbers = new Set();
        const existingDetails = container.querySelectorAll('details');
        const isFirstRender = existingDetails.length === 0;
        
        if (!isFirstRender) {
            existingDetails.forEach(el => {
                if (el.hasAttribute('open')) {
                    const contentDiv = el.querySelector('.buckets-for-account');
                    if (contentDiv && contentDiv.id) {
                        const accNum = contentDiv.id.replace('buckets-', '');
                        openAccountNumbers.add(accNum);
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
            
            // Determine open state: Open by default on first render, otherwise restore state
            const isOpen = isFirstRender || openAccountNumbers.has(account.account_number);

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
            this.renderBucketsForAccount(account.account_number, accountBuckets, bucketsContainer);
        });

        // Update proceed button
        this.updateProceedToClassificationButton();
    },

    /**
     * Render buckets for a specific account
     */
    renderBucketsForAccount(accountNumber, buckets, container) {
        container.innerHTML = '';

        if (buckets.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-style: italic;">No buckets yet. Create your first bucket above.</p>';
            return;
        }

        const startingAllocations = Storage.getStartingAllocations();

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

            const allocation = startingAllocations[bucket.id];
            const allocationAmount = allocation ? parseFloat(allocation.amount) || 0 : 0;
            const allocationDate = allocation ? allocation.date : '';

            item.innerHTML = `
                <div class="bucket-header" style="align-items: flex-end;">
                    <div style="flex-grow: 1; margin-right: 15px;">
                        <label style="display: block; font-weight: 500; font-size: 0.9em; margin-bottom: 6px; color: #555;">Bucket Name:</label>
                        <input type="text" class="bucket-name-input" value="${bucket.name}" 
                               onchange="UI.updateBucketName('${bucket.id}', this.value)" style="width: 100%;">
                    </div>
                    <button class="btn btn-danger btn-small" onclick="UI.deleteBucket('${bucket.id}')" style="margin-bottom: 2px;">Delete Bucket</button>
                </div>
                <div class="bucket-keywords">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Keywords (for auto-assignment):</label>
                    ${keywordsHtml}
                    <button class="btn btn-secondary btn-small add-keyword-btn" onclick="UI.addBucketKeyword('${bucket.id}')">+ Add Keyword</button>
                </div>
                <div class="bucket-starting-balance" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #dee2e6;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">Starting Balance:</label>
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
            id: 'bucket_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name.trim(),
            account_number: accountNumber,
            keywords: [name.trim()],
            suggested: false
        };

        buckets.push(newBucket);
        Storage.saveBuckets(buckets);
        this.renderPerAccountBuckets();
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
            return !classifications[txId];
        });

        container.innerHTML = '';

        if (unclassified.length === 0) {
            container.innerHTML = '<p style="color: #27ae60;">✓ All transactions have been classified!</p>';
            this.renderAccounts();
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
            return !updatedClassifications[txId];
        }).filter(tx => {
            const txAccountNum = tx.account_number || 'unknown';
            return savingsAccountNumbers.has(txAccountNum);
        });

        if (stillUnclassified.length === 0 && beforeCount > 0) {
            container.innerHTML = '<p style="color: #27ae60;">✓ All transactions have been classified!</p>';
            this.renderAccounts();
            return;
        }

        // Update title with current count
        title.textContent = `Unclassified Transactions (${stillUnclassified.length})`;
        
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
            this.renderAccounts();
        };
        container.appendChild(autoAssignBtn);

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
            const account = savingsAccounts.find(a => a.account_number === accountNum);
            const accountBuckets = buckets.filter(b => b.account_number === accountNum);
            const accountTxs = byAccount[accountNum];

            if (!account || accountBuckets.length === 0) {
                // Skip if not a savings account or no buckets
                return;
            }

            const accountSection = document.createElement('div');
            accountSection.className = 'unclassified-account-section';
            accountSection.innerHTML = `
                <h4>${account ? account.account_name : accountNum}</h4>
            `;

            accountTxs.forEach(tx => {
                const txId = tx.transaction_id || this.generateTransactionId(tx);
                const txRow = document.createElement('div');
                txRow.className = 'unclassified-transaction-row';
                
                const desc = tx.description || tx.user_description || 'Transaction';
                const amount = parseFloat(tx.amount) || 0;
                const date = tx.transaction_date || tx.posted_date || 'Unknown date';

                txRow.innerHTML = `
                    <div class="transaction-info">
                        <div class="transaction-date">${date}</div>
                        <div class="transaction-description">${desc}</div>
                        <div class="transaction-amount ${amount < 0 ? 'negative' : ''}">$${Math.abs(amount).toFixed(2)}</div>
                    </div>
                    <div class="transaction-classify">
                        <select class="bucket-select" onchange="UI.classifyTransaction('${txId}', this.value)">
                            <option value="">-- Select Bucket --</option>
                            ${accountBuckets.map(b => 
                                `<option value="${b.id}">${b.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;

                accountSection.appendChild(txRow);
            });

            container.appendChild(accountSection);
        });

        this.renderAccounts();
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
        this.renderAccounts();
    },

    /**
     * Generate transaction ID if missing
     */
    generateTransactionId(tx) {
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

            // Delete Source Account
            const savedAccounts = Storage.getSavedAccounts();
            const newAccounts = savedAccounts.filter(acc => acc.account_number !== sourceNum);
            Storage.saveSavedAccounts(newAccounts);

            UI.showStatus(`Merged successfully. ${txUpdated} transactions and ${bkUpdated} buckets moved.`);
            UI.renderSavedAccounts();
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
    }
};

