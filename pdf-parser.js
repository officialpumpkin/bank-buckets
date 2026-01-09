const PDFParser = {
    lastDebug: {
        rawText: '',
        accounts: [],
        sections: [],
        transactions: []
    },

    async readPdfText(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            const items = textContent.items.map(item => ({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
                hasEOL: item.hasEOL
            }));
            
            items.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 5) return b.y - a.y; 
                return a.x - b.x;
            });

            let lastY = -1;
            let pageText = '';
            
            for (const item of items) {
                if (lastY !== -1 && Math.abs(item.y - lastY) > 5) {
                    pageText += '\n';
                } else if (lastY !== -1) {
                    // Try to preserve column spacing roughly
                    const xDiff = item.x - (items.find(i => i.y === lastY)?.x || 0); // Simplified
                    pageText += '  '; 
                }
                pageText += item.str;
                lastY = item.y;
            }
            
            fullText += pageText + '\n\n';
        }
        
        return fullText;
    },

    async parse(file) {
        try {
            const text = await this.readPdfText(file);
            this.lastDebug = {
                rawText: text,
                accounts: [],
                sections: [],
                transactions: []
            };

            const summaryAccounts = this.extractAccountsFromSummary(text);
            this.lastDebug.accounts = summaryAccounts;

            const sections = this.splitIntoAccountSections(text, summaryAccounts);
            this.lastDebug.sections = sections;

            let allTransactions = [];
            for (const section of sections) {
                const transactions = this.parseAccountSection(section);
                allTransactions = allTransactions.concat(transactions);
            }

            if (allTransactions.length === 0) {
                console.log('No transactions found via sections, trying fallback...');
                // Fallback: Try aggressive scanning on the whole text if section parsing failed completely
                // But prefer section-based if sections exist
                if (sections.length > 0) {
                     // Sections existed but empty? Maybe regex failed.
                     // The aggressive logic is now BUILT-IN to parseAccountSection, so if that failed, 
                     // global aggressive might also fail or produce duplicates.
                     // But let's try generic fallback for the "Monster Account" case ONLY if zero transactions.
                     const fallback = this.parseAggressiveLineScanning(text, summaryAccounts.length > 0 ? summaryAccounts[0].number : null);
                     allTransactions = fallback;
                } else {
                     const fallback = this.parseAggressiveLineScanning(text, null);
                     allTransactions = fallback;
                }
            }

            this.lastDebug.transactions = allTransactions;
            return allTransactions;

        } catch (error) {
            console.error('PDF Parse Error:', error);
            throw error;
        }
    },

    extractAccountsFromSummary(text) {
        const accounts = [];
        const lines = text.split('\n');
        let inSummary = false;

        for (const line of lines) {
            if (/account\s+summary/i.test(line)) {
                inSummary = true;
                continue;
            }
            if (inSummary && line.trim() === '') continue;
            
            if (inSummary && /posting\s+effective/i.test(line)) {
                inSummary = false;
                break;
            }

            if (inSummary) {
                const match = line.match(/([A-Z]{2,3})\s*\|?\s*(\d{8,10})\s*\|?\s*([^|]+?)(?:\s*\|?\s*\$[\d,]+\.\d{2})?$/);
                if (match) {
                    accounts.push({
                        type: match[1],
                        number: match[2],
                        name: match[3].trim()
                    });
                }
            }
        }
        return accounts;
    },

    splitIntoAccountSections(text, knownAccounts = []) {
        const sections = [];
        const lines = text.split('\n');
        let currentSection = { text: '', accountNumber: null, accountName: null };

        for (const line of lines) {
            let foundAccount = null;
            
            for (const acc of knownAccounts) {
                if (line.includes(acc.number)) {
                    if (/AC No:/i.test(line) || /Account No\./i.test(line) || /Account Number/i.test(line)) {
                        foundAccount = acc;
                        break;
                    }
                }
            }

            if (!foundAccount && knownAccounts.length === 0) {
                 const match = line.match(/AC No:\s*(\d{8,10})/i);
                 if (match) {
                     foundAccount = { number: match[1], name: 'Account ' + match[1] };
                 }
            }

            if (foundAccount) {
                if (currentSection.text.length > 0 && currentSection.accountNumber) {
                    sections.push(currentSection);
                }
                currentSection = {
                    text: line + '\n',
                    accountNumber: foundAccount.number,
                    accountName: foundAccount.name
                };
            } else {
                currentSection.text += line + '\n';
            }
        }

        if (currentSection.text.length > 0 && currentSection.accountNumber) {
            sections.push(currentSection);
        }

        return sections;
    },

    parseAccountSection(section) {
        const transactions = [];
        const lines = section.text.split('\n');
        let inTable = false;
        let currentTransaction = null;
        let descriptionLines = [];
        
        let statementYear = new Date().getFullYear();
        // Try to find a valid year (2000-2099) in the header context first
        const headerText = section.text.substring(0, 1000); // Check first 1000 chars
        const explicitYearMatch = headerText.match(/statement\s+begins\s+.*?(\d{4})/i) ||
                                  headerText.match(/period\s+.*?(\d{4})/i) ||
                                  headerText.match(/date\s+.*?(\d{4})/i);
        
        if (explicitYearMatch) {
            const y = parseInt(explicitYearMatch[1]);
            if (y >= 2000 && y <= 2100) statementYear = y;
        } else {
            // Fallback: Find any 4 digits that look like a recent year (20xx)
            // Avoid matching account numbers starting with 0242 etc.
            const genericYearMatches = [...headerText.matchAll(/\b(20\d{2})\b/g)];
            if (genericYearMatches.length > 0) {
                statementYear = parseInt(genericYearMatches[0][1]);
            }
        }

        for (const line of lines) {
            // Header Detection
            if (/date\s*\|.*balance/i.test(line) || 
                /date\s+.*(?:description|details|transaction)\s+.*(debit|credit|amount|withdrawal|deposit)/i.test(line)) {
                inTable = true;
                continue;
            }

            // End Detection
            if (/^page\s+\d+\s+of\s+\d+$/i.test(line)) {
                inTable = false; 
                if (currentTransaction) {
                    currentTransaction.description = descriptionLines.join(' ').trim();
                    transactions.push(this.finalizeTransaction(currentTransaction, section));
                    currentTransaction = null;
                }
                continue;
            }

            // Transaction Detection
            // Matches: DD/MM/YYYY or DD Mon
            const dateMatch = line.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3})/);
            const hasAmount = /-?\$?[\d,]+\.\d{2}/.test(line);

            if (dateMatch && (inTable || hasAmount)) {
                if (currentTransaction) {
                    currentTransaction.description = descriptionLines.join(' ').trim();
                    transactions.push(this.finalizeTransaction(currentTransaction, section));
                }

                const date = this.parseDate(dateMatch[1], statementYear);
                const amountMatches = [...line.matchAll(/-?\$?([\d,]+\.\d{2})/g)];
                let amount = 0;
                
                if (amountMatches.length > 0) {
                    const firstVal = parseFloat(amountMatches[0][1].replace(/,/g, ''));
                    
                    // Keyword Heuristics for Sign
                    const lineLower = line.toLowerCase();
                    const isCredit = lineLower.includes('payment from') || 
                                     lineLower.includes('deposit') || 
                                     lineLower.includes('transfer from') ||
                                     lineLower.includes('interest');
                                     
                    const isDebit = lineLower.includes('purchase') || 
                                    lineLower.includes('payment to') || 
                                    lineLower.includes('transfer to') || 
                                    lineLower.includes('withdrawal') ||
                                    lineLower.includes('loan payment');

                    if (amountMatches[0][0].startsWith('-')) {
                        amount = -firstVal;
                    } else if (isCredit) {
                        amount = firstVal;
                    } else if (isDebit) {
                        amount = -firstVal;
                    } else {
                        // Default: assume debit if unknown? Or assume credit?
                        // If 2 columns (Debit | Credit), and this is the first number.
                        // If the line has 2 numbers, the first is usually the tx amount.
                        // If it's single column "Amount" (+/-), we need sign.
                        // If no sign and no keyword, default to negative (spending)? 
                        // Safer to default to negative for bank statements unless known income.
                        amount = -firstVal; 
                    }
                }

                // Clean Description
                let description = line.substring(dateMatch[0].length).trim();
                description = description.replace(/\|?\s*-?\$?[\d,]+\.\d{2}.*$/, '').trim();
                description = description.replace(/^\|/, '').replace(/\|$/, '').trim();

                currentTransaction = {
                    date: date,
                    description: description,
                    amount: amount,
                    accountNumber: section.accountNumber,
                    accountName: section.accountName
                };
                descriptionLines = [description];
            
            } else if (currentTransaction) {
                 // Continuation
                 if (!line.includes('$') && !/page\s+\d+/i.test(line)) {
                     descriptionLines.push(line.trim());
                 }
            }
        }
        
        if (currentTransaction) {
            currentTransaction.description = descriptionLines.join(' ').trim();
            transactions.push(this.finalizeTransaction(currentTransaction, section));
        }

        return transactions;
    },

    parseDate(dateStr, defaultYear) {
        if (!dateStr) return null;
        const now = new Date();
        const currentYear = defaultYear || now.getFullYear();
        
        let day, month, year;
        const monthMap = {jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11};

        // DD/MM/YYYY
        const slashMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (slashMatch) {
            day = parseInt(slashMatch[1]);
            month = parseInt(slashMatch[2]) - 1;
            year = parseInt(slashMatch[3]);
            if (year < 100) year += 2000;
        } else {
            // DD Mon
            const monMatch = dateStr.match(/(\d{1,2})\s+([a-zA-Z]{3})/);
            if (monMatch) {
                day = parseInt(monMatch[1]);
                month = monthMap[monMatch[2].toLowerCase()];
                year = currentYear;
                
                // Adjust year if date is in future
                // e.g. parsing "Dec" in Jan 2026 -> should be Dec 2025
                // e.g. parsing "Jan" in Dec 2025 -> should be Jan 2026
                // But we usually trust the statement year.
                // If statement says "Begins July 2025", then July is 2025.
            }
        }

        if (day !== undefined && month !== undefined) {
            return new Date(year, month, day);
        }
        return null;
    },
    
    finalizeTransaction(tx, section) {
        return {
            transaction_id: this.generateTransactionId(tx.date, tx.description, tx.amount),
            description: tx.description || 'Transaction',
            user_description: tx.description || 'Transaction',
            amount: tx.amount,
            currency: 'AUD',
            transaction_date: tx.date ? this.formatDate(tx.date) : null,
            posted_date: tx.date ? this.formatDate(tx.date) : null,
            account_number: tx.accountNumber || section.accountNumber || 'unknown',
            account_name: tx.accountName || section.accountName || 'Bank Account',
            credit_debit: tx.amount >= 0 ? 'credit' : 'debit',
            transaction_type: this.inferTransactionType(tx.description || ''),
            provider_name: 'Qudos Bank',
            merchant_name: this.extractMerchantName(tx.description || ''),
            budget_category: null,
            category_name: null,
            user_tags: null,
            notes: null,
            included: true,
            source: 'pdf'
        };
    },

    generateTransactionId(date, desc, amount) {
        const str = `${date ? date.toISOString() : ''}-${desc}-${amount}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `tx_${Math.abs(hash)}`;
    },

    inferTransactionType(desc) {
        desc = desc.toLowerCase();
        if (desc.includes('transfer')) return 'transfer';
        if (desc.includes('purchase')) return 'purchase';
        if (desc.includes('payment')) return 'payment';
        if (desc.includes('deposit')) return 'deposit';
        if (desc.includes('withdrawal')) return 'withdrawal';
        if (desc.includes('interest')) return 'interest';
        if (desc.includes('fee')) return 'fee';
        return 'unknown';
    },

    extractMerchantName(desc) {
        const visaMatch = desc.match(/visa-([^(]+)/i);
        if (visaMatch) return visaMatch[1].trim();
        return desc;
    },
    
    formatDate(date) {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    },

    parseAggressiveLineScanning(text, accountNumber) {
        // Fallback implementation
        const transactions = [];
        const lines = text.split('\n');
        let currentYear = new Date().getFullYear();
        
        for (const line of lines) {
             const dateMatch = line.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+[a-zA-Z]{3})/);
             const amountMatch = line.match(/-?\$?([\d,]+\.\d{2})/);
             
             if (dateMatch && amountMatch) {
                 const date = this.parseDate(dateMatch[1], currentYear);
                 const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                 // Basic heuristic for scanning
                 let signedAmount = amount;
                 if (line.includes('-') || line.toLowerCase().includes('debit')) signedAmount = -amount;
                 
                 transactions.push(this.finalizeTransaction({
                     date: date,
                     description: line.substring(dateMatch[0].length).trim(),
                     amount: signedAmount,
                     accountNumber: accountNumber || 'unknown'
                 }, { accountNumber: accountNumber }));
             }
        }
        return transactions;
    },

    parseAlternativeFormat(text) { return []; },
    
    getDebugLog() {
        return `Debug Log:\n` +
               `Accounts: ${JSON.stringify(this.lastDebug.accounts)}\n` +
               `Sections: ${this.lastDebug.sections.length}\n` +
               `Transactions: ${this.lastDebug.transactions.length}`;
    }
};

window.PDFParser = PDFParser;
