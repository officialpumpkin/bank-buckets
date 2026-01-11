# Bank Buckets

A financial visibility and allocation tool designed for homeowners using mortgage redraw accounts. Bank Buckets makes invisible money allocations visible inside real bank accounts.

## What It Does

Bank Buckets shows users how money inside real bank accounts is internally allocated into virtual buckets, updating automatically based on transaction references and simple user-defined rules.

**This is NOT:**
- A spending tracker
- A budgeting app
- An analytics tool

**This IS:**
- A tool to answer "What is this money for?" (not "Where did my money go?")
- A way to see virtual bucket allocations within real bank accounts
- Designed for clarity of allocations above all else

## Features

### MVP Capabilities

1. **CSV Import** - Import transaction data from Frollo app exports or direct bank CSV downloads
2. ~~**PDF Statement Import** - Parse and import transactions from bank statement PDFs~~ *(Currently disabled - data parsing was unreliable)*
3. **Duplicate Detection** - Automatically filters out duplicate transactions when importing from multiple sources
4. **Automatic Bucket Suggestions** - The app scans transactions and suggests buckets based on recurring patterns
5. **Hybrid Matching** - Accept suggestions or manually create/edit buckets with keyword rules
6. **Balance Calculation** - Buckets update automatically based on matched transactions and starting allocations
7. **Simple UI** - Table/list layout showing accounts and their bucket allocations
8. **Export** - Export bucket balances to CSV or copy to clipboard

## Getting Started

1. Open `index.html` in a modern web browser
2. Import your transactions:
   - Click "Import CSV" to import from Frollo app exports or direct bank CSV downloads
3. The app will automatically detect and filter out duplicate transactions
4. Review the suggested buckets and accept or modify them
5. Set starting allocation amounts for each bucket (optional)
6. View your account allocations in the Accounts section
7. You can import additional files - duplicates will be automatically filtered

## Import Formats

### CSV Format

The app supports multiple CSV formats and will auto-detect the format based on the headers.

#### Qudos Bank Direct Export (Recommended)

Export transaction CSV files directly from your Qudos Bank online banking. Each account will have its own CSV file.

**Filename format:** `Statement_XXXXXXXX_DD.MM.YY-DD.MM.YY.csv` (where `XXXXXXXX` is the 8-10 digit account number)

**Headers:**
- `Effective Date`
- `Entered Date`
- `Transaction Description`
- `Amount`
- `Balance`

The account number is automatically extracted from the filename.

#### Frollo App Export

The app also supports CSV files exported from the Frollo app with the following headers:

- `transaction_id`
- `description`
- `user_description`
- `amount`
- `currency`
- `transaction_date`
- `posted_date`
- `account_number`
- `account_name`
- `credit_debit`
- `transaction_type`
- `provider_name`
- `merchant_name`
- `budget_category`
- `category_name`
- `user_tags`
- `notes`
- `included`

### PDF Statement Format (Disabled)

> **Note:** PDF parsing has been disabled due to unreliable data extraction. Please use CSV exports directly from your bank for more consistent and trustworthy transaction data.

### Duplicate Detection

When importing from multiple sources (e.g., CSV and PDF), the app automatically detects and filters duplicate transactions based on:
- Transaction amount (with tolerance for rounding)
- Transaction date (within 1 day)
- Account number
- Description similarity

You'll see a summary showing how many duplicates were filtered out after each import.

## How It Works

1. **Import**: Transactions are parsed from CSV and stored locally in your browser
2. **Suggest**: The app analyses transaction descriptions to find recurring patterns (e.g., "Transfer to Emergency", "Loan Repayment")
3. **Match**: Buckets are matched to transactions based on keyword rules you define
4. **Calculate**: Balances are calculated by applying matched transactions to starting allocations
5. **Display**: Accounts are shown with their total balance and virtual bucket breakdowns

## Data Storage

All data is stored locally in your browser using localStorage. No data is sent to any server. Your financial information never leaves your device.

## Technical Details

- Plain JavaScript (no frameworks)
- Local storage only (no backend)
- Desktop-first design
- Works offline after initial load

## Browser Support

Works in modern browsers that support:
- ES6 JavaScript
- localStorage
- File API
- Clipboard API

## License

See LICENSE file for details.
