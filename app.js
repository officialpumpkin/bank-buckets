// Main application logic

// PDF import disabled - data parsing was unreliable
// /**
//  * Download PDF Debug Log
//  */
// window.downloadPdfDebugLog = function() {
//     console.log('Downloading debug log...');
//     if (!window.PDFParser) {
//         alert('PDFParser not found');
//         return;
//     }
//     const log = PDFParser.getDebugLog();
//     const blob = new Blob([log], { type: 'text/plain' });
//     const url = window.URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `pdf-debug-log-${new Date().toISOString().split('T')[0]}.txt`;
//     a.click();
//     window.URL.revokeObjectURL(url);
// };

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    initializeApp();

    // CSV Import
    const csvFileInput = document.getElementById('csv-file-input');
    const importCsvBtn = document.getElementById('import-csv-btn');

    importCsvBtn.addEventListener('click', () => {
        csvFileInput.click();
    });

    csvFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            UI.showStatus(`Processing ${files.length} file(s)...`, 'success');
            
            let totalNewTransactions = 0;
            let totalDuplicates = 0;
            let filesProcessed = 0;
            let errors = [];

            // Process each file
            for (const file of files) {
                try {
                    const text = await file.text();
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:csvImport',message:'Processing file',data:{fileName:file.name,fileSize:file.size,textLength:text.length,lineCount:text.split('\n').length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    
                    // Pass filename to parser for account number extraction (Qudos Bank format)
                    const newTransactions = CSVParser.parse(text, file.name);
                    
                    // Add source file info
                    newTransactions.forEach(tx => tx.source_file = file.name);
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:csvImport',message:'Parsed transactions',data:{fileName:file.name,parsedCount:newTransactions.length,firstTx:newTransactions[0]?{date:newTransactions[0].transaction_date,desc:(newTransactions[0].description||'').substring(0,40),amount:newTransactions[0].amount}:null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    
                    if (newTransactions.length === 0) {
                        errors.push(`${file.name}: No transactions found`);
                        continue;
                    }

                    // Merge with existing transactions (handle duplicates)
                    const existingTransactions = Storage.getTransactions();
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:csvImport',message:'Before merge',data:{fileName:file.name,existingCount:existingTransactions.length,newCount:newTransactions.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    const mergeResult = DuplicateDetector.mergeTransactions(existingTransactions, newTransactions);

                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:csvImport',message:'After merge',data:{fileName:file.name,mergedCount:mergeResult.merged.length,duplicatesFound:mergeResult.stats.duplicates,uniqueAdded:mergeResult.stats.unique},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion

                    // Save merged transactions
                    Storage.saveTransactions(mergeResult.merged);

                    // Track duplicate count
                    if (mergeResult.stats.duplicates > 0) {
                        Storage.addDuplicatesFiltered(mergeResult.stats.duplicates);
                    }

                    totalNewTransactions += newTransactions.length;
                    totalDuplicates += mergeResult.stats.duplicates;
                    filesProcessed++;
                } catch (fileError) {
                    errors.push(`${file.name}: ${fileError.message}`);
                }
            }

            // Extract and save accounts from all transactions
            const allTransactions = Storage.getTransactions();
            const accounts = CSVParser.extractAccounts(allTransactions);
            Storage.saveAccounts(accounts);

            // Show import results
            let statusMsg = `Imported ${totalNewTransactions} transactions from ${filesProcessed} file(s). `;
            if (totalDuplicates > 0) {
                statusMsg += `${totalDuplicates} duplicates filtered out. `;
            }
            statusMsg += `Total: ${allTransactions.length} transactions.`;
            
            if (errors.length > 0) {
                statusMsg += `<br><span style="color: #e74c3c;">Errors: ${errors.join(', ')}</span>`;
            }
            
            UI.showStatus(statusMsg, errors.length > 0 ? 'error' : 'success', errors.length > 0);

            // Detect and suggest accounts (will cross-reference with saved accounts)
            const suggestedAccounts = AccountDetector.detectAccounts(allTransactions);
            UI.renderAccountSuggestions(suggestedAccounts);

            // Show manage accounts button
            document.getElementById('manage-accounts-from-import-btn').style.display = 'inline-block';

            // Initialize workflow - force Account Setup phase to review new imports
            WorkflowManager.setPhase('accounts');
            WorkflowManager.updateUI();

            // Reset file input so the same files can be selected again if needed
            csvFileInput.value = '';

        } catch (error) {
            UI.showStatus(`Error importing CSV files: ${error.message}`, 'error');
            console.error('CSV import error:', error);
        }
    });

    // PDF Import - disabled (data parsing was unreliable)
    // const pdfFileInput = document.getElementById('pdf-file-input');
    // const importPdfBtn = document.getElementById('import-pdf-btn');

    // importPdfBtn.addEventListener('click', () => {
    //     pdfFileInput.click();
    // });

    // pdfFileInput.addEventListener('change', async (e) => {
    //     const file = e.target.files[0];
    //     if (!file) return;

    //     try {
    //         UI.showStatus('Parsing PDF statement...', 'success');
            
    //         // Parse PDF
    //         const newTransactions = await PDFParser.parse(file);
            
    //         // Add source file info
    //         newTransactions.forEach(tx => tx.source_file = file.name);
            
    //         if (newTransactions.length === 0) {
    //             UI.showStatus('No transactions found in PDF file', 'error');
    //             return;
    //         }

    //         // Merge with existing transactions (handle duplicates)
    //         const existingTransactions = Storage.getTransactions();
    //         const mergeResult = DuplicateDetector.mergeTransactions(existingTransactions, newTransactions);

    //         // Save merged transactions
    //         Storage.saveTransactions(mergeResult.merged);

    //         // Extract and save accounts
    //         const accounts = CSVParser.extractAccounts(mergeResult.merged);
    //         Storage.saveAccounts(accounts);

    //         // Show import results (persistent - user must close it)
    //         let statusMsg = `Imported ${newTransactions.length} transactions from PDF. `;
    //         if (mergeResult.stats.duplicates > 0) {
    //             statusMsg += `${mergeResult.stats.duplicates} duplicates filtered out. `;
    //         }
    //         statusMsg += `Total: ${mergeResult.merged.length} transactions.`;
            
    //         // Optional debug log button
    //         statusMsg += `<br><button class="btn btn-secondary btn-small" onclick="downloadPdfDebugLog()" style="margin-top: 8px;">Download Debug Log</button>`;
            
    //         UI.showStatus(statusMsg, 'success', true);

    //         // Detect and suggest accounts (will cross-reference with saved accounts)
    //         const suggestedAccounts = AccountDetector.detectAccounts(mergeResult.merged);
    //         UI.renderAccountSuggestions(suggestedAccounts);

    //         // Show manage accounts button
    //         document.getElementById('manage-accounts-from-import-btn').style.display = 'inline-block';

    //         // Initialize workflow - force Account Setup phase to review new imports
    //         WorkflowManager.setPhase('accounts');
    //         WorkflowManager.updateUI();

    //     } catch (error) {
    //         let errorMsg = `Error importing PDF: ${error.message}`;
            
    //         // Optional debug log button
    //         errorMsg += `<br><button class="btn btn-secondary btn-small" onclick="downloadPdfDebugLog()" style="margin-top: 8px;">Download Debug Log</button>`;
            
    //         UI.showStatus(errorMsg, 'error', true);
    //         console.error('PDF import error:', error);
    //     }
    // });

    // Export functionality
    const exportCsvBtn = document.getElementById('export-csv-btn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
    
    const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
    if (copyClipboardBtn) copyClipboardBtn.addEventListener('click', copyToClipboard);

    // Reset functionality
    document.getElementById('reset-btn').addEventListener('click', resetAllData);

    // Workflow navigation
    document.getElementById('proceed-to-buckets-btn').addEventListener('click', () => {
        WorkflowManager.proceedToNextPhase();
    });

    document.getElementById('proceed-to-classification-btn').addEventListener('click', () => {
        WorkflowManager.proceedToNextPhase();
    });

    document.getElementById('proceed-to-review-btn').addEventListener('click', () => {
        WorkflowManager.setPhase(WorkflowManager.PHASES.REVIEW);
        window.scrollTo(0, 0);
    });

    // Account management
    document.getElementById('add-account-btn').addEventListener('click', () => {
        UI.showAddAccountForm();
    });

    document.getElementById('merge-accounts-btn').addEventListener('click', () => {
        UI.showMergeAccountsForm();
    });

    document.getElementById('save-accounts-btn').addEventListener('click', () => {
        const confirmed = Storage.getConfirmedAccounts();
        const saved = Storage.getSavedAccounts();
        let addedCount = 0;
        let updatedCount = 0;

        confirmed.forEach(conf => {
            const existingIndex = saved.findIndex(s => s.account_number === conf.account_number);
            
            const accountToSave = {
                account_number: conf.account_number,
                account_name: conf.account_name || `Account ${conf.account_number}`,
                account_type: conf.account_type,
                bsb: conf.bsb || null
            };

            if (existingIndex >= 0) {
                saved[existingIndex] = accountToSave;
                updatedCount++;
            } else {
                saved.push(accountToSave);
                addedCount++;
            }
        });

        Storage.saveSavedAccounts(saved);
        UI.showStatus(`Saved ${addedCount} new and updated ${updatedCount} existing accounts.`);
        
        // Re-render suggestions to update UI
        const transactions = Storage.getTransactions();
        if (transactions.length > 0) {
            const suggestedAccounts = AccountDetector.detectAccounts(transactions);
            UI.renderAccountSuggestions(suggestedAccounts);
        }
    });

    document.getElementById('manage-accounts-btn').addEventListener('click', () => {
        document.getElementById('account-management-section').style.display = 'block';
        document.getElementById('account-setup-section').style.display = 'none';
        UI.renderSavedAccounts();
    });

    document.getElementById('back-to-setup-btn').addEventListener('click', () => {
        document.getElementById('account-management-section').style.display = 'none';
        document.getElementById('account-setup-section').style.display = 'block';
        // Re-render account suggestions to show updated saved accounts
        const transactions = Storage.getTransactions();
        if (transactions.length > 0) {
            const suggestedAccounts = AccountDetector.detectAccounts(transactions);
            UI.renderAccountSuggestions(suggestedAccounts);
        }
    });

    // Access account management from import section
    document.getElementById('manage-accounts-from-import-btn').addEventListener('click', () => {
        document.getElementById('account-management-section').style.display = 'block';
        document.getElementById('account-setup-section').style.display = 'none';
        UI.renderSavedAccounts();
    });
});

/**
 * Initialize app - load existing data
 */
function initializeApp() {
    const transactions = Storage.getTransactions();

    // Always initialize workflow to setup navigation
    WorkflowManager.initialize();

    if (transactions.length > 0) {
        // Show manage accounts button if we have transactions
        document.getElementById('manage-accounts-from-import-btn').style.display = 'inline-block';
        
        const phase = WorkflowManager.getCurrentPhase();
        
        if (phase === WorkflowManager.PHASES.ACCOUNTS) {
            const suggestedAccounts = AccountDetector.detectAccounts(transactions);
            UI.renderAccountSuggestions(suggestedAccounts);
        } else if (phase === WorkflowManager.PHASES.BUCKETS) {
            UI.renderPerAccountBuckets();
        } else if (phase === WorkflowManager.PHASES.CLASSIFICATION) {
            UI.renderUnclassifiedTransactions();
        } else if (phase === WorkflowManager.PHASES.REVIEW) {
            UI.renderBreakdown();
        }
        
        WorkflowManager.updateUI();
    }
}

// Removed suggestBuckets - now using per-account bucket setup

/**
 * Export bucket balances to CSV
 */
function exportToCSV() {
    const buckets = Storage.getBuckets();
    const transactions = Storage.getTransactions();
    const startingAllocations = Storage.getStartingAllocations();

    if (buckets.length === 0) {
        UI.showStatus('No buckets to export', 'error');
        return;
    }

    const balances = BalanceCalculator.calculateBalances(buckets, transactions, startingAllocations);
    const total = BalanceCalculator.calculateTotal(balances);

    // Build CSV
    let csv = 'Bucket Name,Balance\n';
    buckets.forEach(bucket => {
        const balance = balances[bucket.id] || 0;
        csv += `"${bucket.name}",${balance.toFixed(2)}\n`;
    });
    csv += `"Total",${total.toFixed(2)}\n`;

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank-buckets-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    UI.showStatus('Export downloaded successfully');
}

/**
 * Copy bucket balances to clipboard
 */
function copyToClipboard() {
    const buckets = Storage.getBuckets();
    const transactions = Storage.getTransactions();
    const startingAllocations = Storage.getStartingAllocations();

    if (buckets.length === 0) {
        UI.showStatus('No buckets to copy', 'error');
        return;
    }

    const balances = BalanceCalculator.calculateBalances(buckets, transactions, startingAllocations);
    const total = BalanceCalculator.calculateTotal(balances);

    // Build text
    let text = 'Bank Buckets Summary\n';
    text += '===================\n\n';
    buckets.forEach(bucket => {
        const balance = balances[bucket.id] || 0;
        text += `${bucket.name}: $${balance.toFixed(2)}\n`;
    });
    text += `\nTotal: $${total.toFixed(2)}\n`;

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        UI.showStatus('Copied to clipboard');
    }).catch(err => {
        UI.showStatus('Failed to copy to clipboard', 'error');
        console.error('Clipboard error:', err);
    });
}

/**
 * Reset all data and clear the application
 * Note: Saved accounts are preserved and can be deleted manually
 */
function resetAllData() {
    // Confirm with user
    const confirmed = confirm(
        'Are you sure you want to reset imported transactions?\n\n' +
        'This will delete:\n' +
        '- All imported transactions\n' +
        '- Active session data (Confirmed Accounts)\n\n' +
        'It will PRESERVE:\n' +
        '- Saved Accounts\n' +
        '- Bucket definitions and Keywords\n' +
        '- Starting Allocations\n\n' +
        'To delete buckets or accounts, remove them individually from their respective sections.\n'
    );

    if (!confirmed) return;

    // Preserve configuration
    const savedAccounts = Storage.getSavedAccounts();
    const buckets = Storage.getBuckets();
    const allocations = Storage.getStartingAllocations();

    // Clear all storage
    Storage.clearAll();

    // Restore configuration
    if (savedAccounts.length > 0) Storage.saveSavedAccounts(savedAccounts);
    if (buckets.length > 0) Storage.saveBuckets(buckets);
    if (Object.keys(allocations).length > 0) Storage.saveStartingAllocations(allocations);

    // Clear file inputs
    document.getElementById('csv-file-input').value = '';
    // PDF import disabled
    // document.getElementById('pdf-file-input').value = '';

    // Hide all sections
    document.getElementById('account-management-section').style.display = 'none';
    document.getElementById('account-setup-section').style.display = 'none';
    document.getElementById('bucket-setup-section').style.display = 'none';
    document.getElementById('classification-section').style.display = 'none';
    document.getElementById('reset-btn').style.display = 'none';

    // Clear all UI elements
    // Note: saved-accounts-list is NOT cleared - saved accounts are preserved
    document.getElementById('account-suggestions').innerHTML = '';
    document.getElementById('account-confirmation').innerHTML = '';
    document.getElementById('bucket-suggestions').innerHTML = '';
    document.getElementById('bucket-management').innerHTML = '';
    document.getElementById('unclassified-transactions').innerHTML = '';
    document.getElementById('accounts-list').innerHTML = '';
    document.getElementById('breakdown-list').innerHTML = '';
    document.getElementById('import-status').className = 'status-message';
    document.getElementById('import-status').innerHTML = '';

    // Re-render saved accounts if account management section is visible
    if (document.getElementById('account-management-section').style.display !== 'none') {
        UI.renderSavedAccounts();
    }

    // Hide workflow navigation buttons
    document.getElementById('proceed-to-buckets-btn').style.display = 'none';
    document.getElementById('proceed-to-classification-btn').style.display = 'none';

    // Clear any stored suggestions
    UI.currentSuggestions = [];

    // Reset workflow phase
    Storage.saveWorkflowPhase(WorkflowManager.PHASES.ACCOUNTS); // Explicitly save to storage before reload
    WorkflowManager.setPhase(WorkflowManager.PHASES.ACCOUNTS);

    let statusMsg = 'All data has been reset';
    if (savedAccounts.length > 0) {
        statusMsg += `. ${savedAccounts.length} saved account(s) preserved.`;
    }
    UI.showStatus(statusMsg, 'success');
    
    // Force refresh of the page to ensure clean state
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

