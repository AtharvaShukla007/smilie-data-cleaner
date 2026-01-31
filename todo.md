# Smilie Data Cleaner - Project TODO

## Core Features

- [x] CSV/Excel file upload interface for bulk address and customer data import
- [x] Automated data cleaning engine for formatting inconsistencies in postal codes, addresses, contact info
- [x] Address standardization for Singapore, regional (SEA, Australia, NA, Europe), and international formats
- [x] Data quality validation with severity levels (error, warning, info) for flagging entries
- [x] Interactive dashboard with data quality metrics, cleaning statistics, processing history
- [x] Audit trail system tracking all data transformations with timestamps
- [x] Export functionality for cleaned datasets in CSV/Excel formats
- [x] Batch processing queue with progress tracking for large datasets
- [x] Manual review interface with approve/edit/reject and bulk actions
- [x] Integration API endpoints for external logistics platforms
- [x] LLM-powered intelligent address correction for ambiguous/malformed addresses
- [x] Automated notifications for batch completion, critical issues, review queue thresholds
- [x] S3 cloud storage for original files and processed datasets

## Database Schema

- [x] Users table (existing)
- [x] Upload batches table
- [x] Data records table
- [x] Validation issues table
- [x] Audit logs table
- [x] Processing jobs table
- [x] API keys table

## UI Components

- [x] Dashboard layout with sidebar navigation
- [x] File upload component with drag-and-drop
- [x] Data quality metrics cards
- [x] Processing history table
- [x] Flagged entries review table
- [x] Batch processing progress indicator
- [x] Export configuration modal
- [x] Audit trail viewer
- [x] API keys management page

## API Endpoints

- [x] File upload endpoint (batches.upload)
- [x] Data cleaning trigger endpoint (processing.clean)
- [x] Batch status endpoint (batches.get, batches.list)
- [x] Export endpoint (export.generate)
- [x] Records management endpoints (records.list, records.update, records.approve, records.reject)
- [x] Issues management endpoints (issues.list, issues.resolve)
- [x] Audit logs endpoint (audit.list)
- [x] API keys management endpoints (apiKeys.create, apiKeys.list, apiKeys.revoke)


## Sample Test Data Generation

- [x] Generate sample CSV with Singapore address formatting inconsistencies (Blk vs Block, St vs Street, etc.)
- [x] Generate sample CSV with postal code issues (missing, typos, transposed digits)
- [x] Generate sample CSV with contact data problems (missing phone, invalid email, incomplete fields)
- [x] Generate sample CSV with problematic/suspicious entries (invalid addresses, duplicate entries)
- [x] Generate sample CSV with regional addresses (Malaysia, Indonesia, Thailand, Philippines)
- [x] Generate sample CSV with international addresses (US, UK, Australia, Europe)
- [x] Create comprehensive test file combining all issue types

## Bug Fixes

- [x] Fix API error on /audit page returning HTML instead of JSON

- [x] Create comprehensive Singapore-only test dataset with all issue types

## New Feature Requests

- [x] Add "Accept All Cleaned" button to Review & Clean page
- [x] Update Singapore phone formatting to "+65 XXXX XXXX" format

- [x] Fix Singapore phone formatting for numbers like "6592223333" → "+65 9222 3333"
- [x] Validate Singapore numbers must start with 8 or 9 after +65 prefix
- [x] Flag invalid Singapore numbers like "6512345678" (starts with 1, not 8 or 9)

- [x] Verify and enhance address ingestion and cleaning in data pipeline
- [x] Create improved Singapore test dataset with realistic addresses
- [x] Fix stats not updating when rejecting records on Review & Clean page

- [x] Display address fields (raw and cleaned) in Review & Clean table

- [x] Merge address into single column (combine address line 1 and 2)
- [x] Ensure raw address is completely struck through when corrected

- [x] Create new Singapore test dataset with single address column and two perfect reference rows

- [x] Fix LLM generating excessively long state field values exceeding database column limit

- [x] Fix address field mapping so single "address" column in CSV is properly stored and displayed

- [x] Add "accepted" status for rows with no issues (no cleaning required)
- [x] Hide approve/reject buttons for accepted rows

- [x] Fix data quality scoring - flagged records should not have 100% score
- [x] Review and improve data quality scoring system
- [x] Increase page size to 30 records
- [x] Add pagination info (e.g., "Page X of Y") to the left of Previous button

- [x] Fix phone validation - numbers like +65 1234 5678 should be flagged (starts with 1, not 6/8/9)
- [x] Preserve N/A values - don't clean or modify N/A entries
- [x] Create v4 dataset with corrected test cases and real addresses for N/A records
