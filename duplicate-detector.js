// Duplicate transaction detection utility

const DuplicateDetector = {
    /**
     * Check if two transactions are duplicates
     * @param {Object} tx1 - First transaction
     * @param {Object} tx2 - Second transaction
     * @returns {boolean} True if transactions are duplicates
     */
    areDuplicates(tx1, tx2) {
        // 1. Check Reference IDs (Strongest Match)
        const ref1 = this.extractRefId(tx1.description || tx1.user_description);
        const ref2 = this.extractRefId(tx2.description || tx2.user_description);
        
        if (ref1 && ref2 && ref1 === ref2) {
            // Confirm amount match (allowing small float diff)
            const amount1 = Math.abs(parseFloat(tx1.amount) || 0);
            const amount2 = Math.abs(parseFloat(tx2.amount) || 0);
            if (Math.abs(amount1 - amount2) < 0.05) {
                // #region agent log
                if (!this._loggedRefMatch) { this._loggedRefMatch = 0; } if (this._loggedRefMatch < 5) { this._loggedRefMatch++; fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'duplicate-detector.js:areDuplicates:refMatch',message:'RefID match',data:{ref1,ref2,amount1,amount2,desc1:(tx1.description||'').substring(0,60),desc2:(tx2.description||'').substring(0,60)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{}); }
                // #endregion
                return true; // ID match + Amount match = Duplicate
            }
        }

        // 2. Standard Match (Date + Amount + Description)
        
        // Normalize amounts
        const amount1 = Math.abs(parseFloat(tx1.amount) || 0);
        const amount2 = Math.abs(parseFloat(tx2.amount) || 0);
        const amountDiff = Math.abs(amount1 - amount2);
        
        if (amountDiff > 0.01) {
            return false;
        }

        // Check dates (allow 1 day difference)
        const date1 = this.normalizeDate(tx1.transaction_date || tx1.posted_date);
        const date2 = this.normalizeDate(tx2.transaction_date || tx2.posted_date);
        const dateDiff = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
        
        if (dateDiff > 1) {
            return false;
        }

        // Check account numbers (handle masking)
        const account1 = (tx1.account_number || '').toString().trim();
        const account2 = (tx2.account_number || '').toString().trim();
        
        if (account1 && account2) {
             const clean1 = account1.replace(/\D/g, ''); // Digits only
             const clean2 = account2.replace(/\D/g, '');
             
             // If sufficient digits to compare
             if (clean1.length >= 3 && clean2.length >= 3) {
                 // If suffix mismatches, they are different accounts
                 if (!clean1.endsWith(clean2) && !clean2.endsWith(clean1)) {
                     return false;
                 }
             } else if (clean1 !== clean2 && account1 !== account2) {
                 // Fallback for short/different strings
                 return false; 
             }
        }

        // Check descriptions (fuzzy match)
        const desc1 = (tx1.description || tx1.user_description || '').toLowerCase().trim();
        const desc2 = (tx2.description || tx2.user_description || '').toLowerCase().trim();
        
        if (desc1 && desc2) {
            // If one contains the other (e.g. "Transfer" vs "Transfer Ref#..."), match!
            // Or if similarity is high
            if (desc1.includes(desc2) || desc2.includes(desc1)) {
                // #region agent log
                if (!this._loggedDescContains) { this._loggedDescContains = 0; } if (this._loggedDescContains < 5) { this._loggedDescContains++; fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'duplicate-detector.js:areDuplicates:descContains',message:'Desc contains match',data:{desc1:desc1.substring(0,60),desc2:desc2.substring(0,60),date1:tx1.transaction_date,date2:tx2.transaction_date,amount1:tx1.amount,amount2:tx2.amount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{}); }
                // #endregion
                return true;
            }

            const similarity = this.calculateSimilarity(desc1, desc2);
            if (similarity < 0.5) {
                return false;
            }
        }

        // #region agent log
        if (!this._loggedFinalMatch) { this._loggedFinalMatch = 0; } if (this._loggedFinalMatch < 5) { this._loggedFinalMatch++; fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'duplicate-detector.js:areDuplicates:finalMatch',message:'Final similarity match',data:{desc1:desc1.substring(0,60),desc2:desc2.substring(0,60),date1:tx1.transaction_date,date2:tx2.transaction_date,amount1:tx1.amount,amount2:tx2.amount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{}); }
        // #endregion
        return true;
    },

    /**
     * Extract unique reference ID from description
     */
    extractRefId(description) {
        if (!description) return null;
        // Matches: NET#123, APP#123, Ref#123, Ref.123
        const match = description.match(/(?:NET|APP|Ref)[\#\.]\s*(\d+)/i);
        return match ? match[0].toUpperCase().replace(/\s+/, '') : null;
    },

    /**
     * Normalize date to Date object
     */
    normalizeDate(dateStr) {
        if (!dateStr) return new Date(0);
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? new Date(0) : date;
    },

    /**
     * Calculate string similarity
     */
    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 1.0;
        if (!str1 || !str2) return 0.0;

        const words1 = str1.split(/\s+/).filter(w => w.length > 2);
        const words2 = str2.split(/\s+/).filter(w => w.length > 2);
        
        if (words1.length === 0 || words2.length === 0) {
            return str1.includes(str2) || str2.includes(str1) ? 0.6 : 0.0;
        }

        const matches = words1.filter(w1 => 
            words2.some(w2 => w1.includes(w2) || w2.includes(w1))
        ).length;

        return matches / Math.max(words1.length, words2.length);
    },

    /**
     * Merge transactions arrays, merging duplicates with better data
     * @param {Array} existingTransactions - Existing transactions
     * @param {Array} newTransactions - New transactions to merge
     * @returns {Object} { merged: Array, stats: Object }
     */
    mergeTransactions(existingTransactions, newTransactions) {
        // Clone existing to allow updates without mutation issues during iteration
        const merged = existingTransactions.map(tx => ({...tx}));
        
        let duplicatesCount = 0;
        let uniqueCount = 0;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'duplicate-detector.js:mergeTransactions',message:'Merge start',data:{existingCount:existingTransactions.length,newCount:newTransactions.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        newTransactions.forEach((newTx, newIdx) => {
            const matchIndex = merged.findIndex(existingTx => 
                this.areDuplicates(newTx, existingTx)
            );

            if (matchIndex !== -1) {
                // Duplicate found - MERGE DATA
                duplicatesCount++;
                // #region agent log
                if (duplicatesCount <= 10) { fetch('http://127.0.0.1:7242/ingest/9cad563e-b494-4967-bd12-266b766fec3d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'duplicate-detector.js:mergeTransactions',message:'Duplicate found',data:{newIdx,newTxDate:newTx.transaction_date,newTxDesc:(newTx.description||'').substring(0,50),newTxAmount:newTx.amount,newTxAccount:newTx.account_number,matchedTxDate:merged[matchIndex].transaction_date,matchedTxDesc:(merged[matchIndex].description||'').substring(0,50),matchedTxAmount:merged[matchIndex].amount,matchedTxAccount:merged[matchIndex].account_number},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B,C,D'})}).catch(()=>{}); }
                // #endregion
                const existingTx = merged[matchIndex];
                
                // 1. Improve Description: Keep the longer one
                const newDesc = newTx.description || '';
                const oldDesc = existingTx.description || '';
                
                if (newDesc.length > oldDesc.length) {
                    existingTx.description = newDesc;
                    // Also update user_description if it matched original
                    if (existingTx.user_description === oldDesc || !existingTx.user_description) {
                        existingTx.user_description = newDesc;
                    }
                }

                // 2. Improve Account Number: Explicit over masked/unknown
                const oldAcc = existingTx.account_number;
                const newAcc = newTx.account_number;
                
                // If old is unknown or masked (has 'x'), and new is explicit (no 'x' and digits)
                const oldIsMasked = !oldAcc || oldAcc === 'unknown' || oldAcc.toLowerCase().includes('x');
                const newIsExplicit = newAcc && !newAcc.toLowerCase().includes('x');
                
                if (oldIsMasked && newIsExplicit) {
                    existingTx.account_number = newAcc;
                }
                
                // 3. Improve Date? (Optional, usually first import is fine)

            } else {
                // Unique
                merged.push(newTx);
                uniqueCount++;
            }
        });

        return {
            merged,
            stats: {
                existing: existingTransactions.length,
                new: newTransactions.length,
                unique: uniqueCount,
                duplicates: duplicatesCount,
                total: merged.length
            }
        };
    }
};
