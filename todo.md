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
