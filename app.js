// Main application logic

/**
 * Download PDF Debug Log
 */
window.downloadPdfDebugLog = function() {
    console.log('Downloading debug log...');
    if (!window.PDFParser) {
        alert('PDFParser not found');
        return;
    }
    const log = PDFParser.getDebugLog();
    const blob = new Blob([log], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-debug-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
};

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
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const newTransactions = CSVParser.parse(text);
            
            if (newTransactions.length === 0) {
                UI.showStatus('No transactions found in CSV file', 'error');
                return;
            }

            // Merge with existing transactions (handle duplicates)
            const existingTransactions = Storage.getTransactions();
            const mergeResult = DuplicateDetector.mergeTransactions(existingTransactions, newTransactions);

            // Save merged transactions
            Storage.saveTransactions(mergeResult.merged);

            // Extract and save accounts
            const accounts = CSVParser.extractAccounts(mergeResult.merged);
            Storage.saveAccounts(accounts);

            // Show import results
            let statusMsg = `Imported ${newTransactions.length} transactions from CSV. `;
            if (mergeResult.stats.duplicates > 0) {
                statusMsg += `${mergeResult.stats.duplicates} duplicates filtered out. `;
            }
            statusMsg += `Total: ${mergeResult.merged.length} transactions.`;
            UI.showStatus(statusMsg, 'success');

            // Detect and suggest accounts (will cross-reference with saved accounts)
            const suggestedAccounts = AccountDetector.detectAccounts(mergeResult.merged);
            UI.renderAccountSuggestions(suggestedAccounts);

            // Show manage accounts button
            document.getElementById('manage-accounts-from-import-btn').style.display = 'inline-block';

            // Initialize workflow - force Account Setup phase to review new imports
            WorkflowManager.setPhase('accounts');
            WorkflowManager.updateUI();

        } catch (error) {
            UI.showStatus(`Error importing CSV: ${error.message}`, 'error');
            console.error('CSV import error:', error);
        }
    });

    // PDF Import
    const pdfFileInput = document.getElementById('pdf-file-input');
    const importPdfBtn = document.getElementById('import-pdf-btn');

    importPdfBtn.addEventListener('click', () => {
        pdfFileInput.click();
    });

    pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            UI.showStatus('Parsing PDF statement...', 'success');
            
            // Parse PDF
            const newTransactions = await PDFParser.parse(file);
            
            if (newTransactions.length === 0) {
                UI.showStatus('No transactions found in PDF file', 'error');
                return;
            }

            // Merge with existing transactions (handle duplicates)
            const existingTransactions = Storage.getTransactions();
            const mergeResult = DuplicateDetector.mergeTransactions(existingTransactions, newTransactions);

            // Save merged transactions
            Storage.saveTransactions(mergeResult.merged);

            // Extract and save accounts
            const accounts = CSVParser.extractAccounts(mergeResult.merged);
            Storage.saveAccounts(accounts);

            // Show import results (persistent - user must close it)
            let statusMsg = `Imported ${newTransactions.length} transactions from PDF. `;
            if (mergeResult.stats.duplicates > 0) {
                statusMsg += `${mergeResult.stats.duplicates} duplicates filtered out. `;
            }
            statusMsg += `Total: ${mergeResult.merged.length} transactions.`;
            
            // Optional debug log button
            statusMsg += `<br><button class="btn btn-secondary btn-small" onclick="downloadPdfDebugLog()" style="margin-top: 8px;">Download Debug Log</button>`;
            
            UI.showStatus(statusMsg, 'success', true);

            // Detect and suggest accounts (will cross-reference with saved accounts)
            const suggestedAccounts = AccountDetector.detectAccounts(mergeResult.merged);
            UI.renderAccountSuggestions(suggestedAccounts);

            // Show manage accounts button
            document.getElementById('manage-accounts-from-import-btn').style.display = 'inline-block';

            // Initialize workflow - force Account Setup phase to review new imports
            WorkflowManager.setPhase('accounts');
            WorkflowManager.updateUI();

        } catch (error) {
            let errorMsg = `Error importing PDF: ${error.message}`;
            
            // Optional debug log button
            errorMsg += `<br><button class="btn btn-secondary btn-small" onclick="downloadPdfDebugLog()" style="margin-top: 8px;">Download Debug Log</button>`;
            
            UI.showStatus(errorMsg, 'error', true);
            console.error('PDF import error:', error);
        }
    });

    // Export functionality
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);
    document.getElementById('copy-clipboard-btn').addEventListener('click', copyToClipboard);

    // Reset functionality
    document.getElementById('reset-btn').addEventListener('click', resetAllData);

    // Workflow navigation
    document.getElementById('proceed-to-buckets-btn').addEventListener('click', () => {
        WorkflowManager.proceedToNextPhase();
    });

    document.getElementById('proceed-to-classification-btn').addEventListener('click', () => {
        WorkflowManager.proceedToNextPhase();
    });

    // Account management
    document.getElementById('add-account-btn').addEventListener('click', () => {
        UI.showAddAccountForm();
    });

    document.getElementById('merge-accounts-btn').addEventListener('click', () => {
        UI.showMergeAccountsForm();
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
    document.getElementById('pdf-file-input').value = '';

    // Hide all sections
    document.getElementById('account-management-section').style.display = 'none';
    document.getElementById('account-setup-section').style.display = 'none';
    document.getElementById('bucket-setup-section').style.display = 'none';
    document.getElementById('classification-section').style.display = 'none';
    document.getElementById('accounts-section').style.display = 'none';
    document.getElementById('export-section').style.display = 'none';
    document.getElementById('reset-btn').style.display = 'none';

    // Clear all UI elements
    // Note: saved-accounts-list is NOT cleared - saved accounts are preserved
    document.getElementById('account-suggestions').innerHTML = '';
    document.getElementById('account-confirmation').innerHTML = '';
    document.getElementById('bucket-suggestions').innerHTML = '';
    document.getElementById('bucket-management').innerHTML = '';
    document.getElementById('unclassified-transactions').innerHTML = '';
    document.getElementById('accounts-list').innerHTML = '';
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
    WorkflowManager.setPhase(WorkflowManager.PHASES.ACCOUNTS);

    let statusMsg = 'All data has been reset';
    if (savedAccounts.length > 0) {
        statusMsg += `. ${savedAccounts.length} saved account(s) preserved.`;
    }
    UI.showStatus(statusMsg, 'success');
}

