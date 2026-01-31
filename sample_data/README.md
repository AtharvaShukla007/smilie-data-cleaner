# Smilie Data Cleaner - Sample Test Data

This directory contains sample CSV files designed to test the Smilie Data Cleaner's ability to detect and correct data inconsistencies, validate data quality, and flag problematic entries for manual review.

## Test Data Files

### 1. smilie_test_data_comprehensive.csv (80 records)
A comprehensive test file covering all types of data quality issues in a single file. This is the recommended file for initial testing.

**Includes:**
- Singapore addresses with various formatting styles
- Regional addresses (Malaysia, Indonesia, Thailand, Philippines)
- International addresses (USA, UK, Australia)
- Postal code issues (missing, truncated, transposed digits)
- Contact data problems (missing phone, invalid email)
- Duplicate entries
- Suspicious/problematic entries

### 2. singapore_address_issues.csv (30 records)
Focused on Singapore-specific address formatting inconsistencies.

**Test Scenarios:**
| Issue Type | Examples |
|------------|----------|
| Block abbreviations | "Blk", "Block", "BLK", "block", "Blk.", "B" |
| Street abbreviations | "Ave", "Avenue", "St", "Street", "Rd", "Road" |
| Unit number formats | "#05-123", "Unit 08-456", "#03-789" |
| Mixed formatting | Inconsistent capitalization, spacing |

### 3. postal_and_contact_issues.csv (30 records)
Focused on postal code and contact information problems.

**Test Scenarios:**
| Issue Type | Examples |
|------------|----------|
| Truncated postal codes | "56012" instead of "560123" |
| Missing postal codes | Empty postal code field |
| Invalid postal codes | "ABCDEF", "1234", "12345678" |
| Transposed digits | "123654" instead of "123456" |
| Missing phone numbers | Empty phone field |
| Invalid phone formats | Letters in phone, too short/long |
| Invalid email formats | Missing @, malformed domains |

### 4. regional_international_addresses.csv (42 records)
Tests multi-region address standardization capabilities.

**Regions Covered:**
| Region | Postal Format | Phone Format |
|--------|---------------|--------------|
| Malaysia | 5 digits (50200) | +60 XX XXX XXXX |
| Indonesia | 5 digits (12190) | +62 XXX XXXX XXXX |
| Thailand | 5 digits (10110) | +66 X XXXX XXXX |
| Philippines | 4 digits (1226) | +63 XXX XXX XXXX |
| USA | 5 digits (10001) | +1 XXX XXX XXXX |
| UK | Alphanumeric (W1D 2LG) | +44 XXXX XXXXXX |
| Australia | 4 digits (2000) | +61 X XXXX XXXX |

### 5. problematic_suspicious_entries.csv (40 records)
Tests the system's ability to flag suspicious and problematic data.

**Test Scenarios:**
| Issue Type | Description |
|------------|-------------|
| Missing required fields | Name, phone, email, address missing |
| Duplicate entries | Same record appearing multiple times |
| Suspicious patterns | All zeros, placeholder text (TBD, Test, Sample) |
| Injection attempts | HTML/SQL injection strings |
| Unicode/Emoji | Non-ASCII characters in fields |
| Whitespace issues | Tabs, newlines, extra spaces |
| Overly long fields | Names/addresses exceeding normal limits |

## Expected Outcomes

When processing these files, the Smilie Data Cleaner should:

1. **Detect Formatting Inconsistencies**
   - Standardize "Blk" vs "Block" to consistent format
   - Normalize phone numbers to regional format with country code
   - Lowercase and validate email addresses

2. **Validate Postal Codes**
   - Flag postal codes that don't match regional patterns
   - Identify truncated or transposed digits
   - Flag missing postal codes as errors

3. **Flag Problematic Entries**
   - Mark records with missing required fields
   - Identify duplicate entries
   - Flag suspicious patterns (all zeros, placeholder text)

4. **Calculate Quality Scores**
   - High scores (80-100) for complete, valid records
   - Medium scores (50-79) for records with minor issues
   - Low scores (0-49) for records with major problems

5. **Generate Cleaned Output**
   - Standardized addresses ready for logistics systems
   - Audit trail of all transformations
   - Clear indication of records requiring manual review

## Usage Instructions

1. Upload any of these CSV files through the Upload Data page
2. Select the appropriate region for validation rules
3. Enable "AI-Powered Enhancement" for intelligent corrections
4. Click "Upload & Process" to start cleaning
5. Review flagged entries in the Review & Clean page
6. Export cleaned data from the Export page

## Data Volume Notes

These test files are designed for functional testing. For performance testing with larger volumes (5,000-10,000 records as mentioned in Smilie's requirements), the comprehensive file can be duplicated or extended.
