import { invokeLLM } from "./_core/llm";
import { InsertDataRecord, InsertValidationIssue } from "../drizzle/schema";

// ============ REGION CONFIGURATIONS ============
interface RegionConfig {
  name: string;
  postalCodePattern: RegExp;
  postalCodeFormat: string;
  phonePattern: RegExp;
  phoneFormat: string;
  states?: string[];
  cities?: string[];
}

const REGION_CONFIGS: Record<string, RegionConfig> = {
  singapore: {
    name: "Singapore",
    postalCodePattern: /^\d{6}$/,
    postalCodeFormat: "6 digits (e.g., 123456)",
    phonePattern: /^(\+65)?[689]\d{7}$/,
    phoneFormat: "+65 XXXX XXXX",
    states: [],
    cities: ["Singapore"]
  },
  malaysia: {
    name: "Malaysia",
    postalCodePattern: /^\d{5}$/,
    postalCodeFormat: "5 digits (e.g., 50000)",
    phonePattern: /^(\+60)?[0-9]{9,10}$/,
    phoneFormat: "+60 XX XXX XXXX"
  },
  indonesia: {
    name: "Indonesia",
    postalCodePattern: /^\d{5}$/,
    postalCodeFormat: "5 digits (e.g., 12345)",
    phonePattern: /^(\+62)?[0-9]{9,12}$/,
    phoneFormat: "+62 XXX XXXX XXXX"
  },
  thailand: {
    name: "Thailand",
    postalCodePattern: /^\d{5}$/,
    postalCodeFormat: "5 digits (e.g., 10110)",
    phonePattern: /^(\+66)?[0-9]{9}$/,
    phoneFormat: "+66 X XXXX XXXX"
  },
  vietnam: {
    name: "Vietnam",
    postalCodePattern: /^\d{6}$/,
    postalCodeFormat: "6 digits (e.g., 100000)",
    phonePattern: /^(\+84)?[0-9]{9,10}$/,
    phoneFormat: "+84 XXX XXX XXXX"
  },
  philippines: {
    name: "Philippines",
    postalCodePattern: /^\d{4}$/,
    postalCodeFormat: "4 digits (e.g., 1000)",
    phonePattern: /^(\+63)?[0-9]{10}$/,
    phoneFormat: "+63 XXX XXX XXXX"
  },
  australia: {
    name: "Australia",
    postalCodePattern: /^\d{4}$/,
    postalCodeFormat: "4 digits (e.g., 2000)",
    phonePattern: /^(\+61)?[0-9]{9}$/,
    phoneFormat: "+61 X XXXX XXXX",
    states: ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
  },
  usa: {
    name: "United States",
    postalCodePattern: /^\d{5}(-\d{4})?$/,
    postalCodeFormat: "5 digits or ZIP+4 (e.g., 12345 or 12345-6789)",
    phonePattern: /^(\+1)?[0-9]{10}$/,
    phoneFormat: "+1 XXX XXX XXXX"
  },
  uk: {
    name: "United Kingdom",
    postalCodePattern: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
    postalCodeFormat: "UK format (e.g., SW1A 1AA)",
    phonePattern: /^(\+44)?[0-9]{10,11}$/,
    phoneFormat: "+44 XXXX XXXXXX"
  },
  germany: {
    name: "Germany",
    postalCodePattern: /^\d{5}$/,
    postalCodeFormat: "5 digits (e.g., 10115)",
    phonePattern: /^(\+49)?[0-9]{10,11}$/,
    phoneFormat: "+49 XXX XXXXXXX"
  },
  france: {
    name: "France",
    postalCodePattern: /^\d{5}$/,
    postalCodeFormat: "5 digits (e.g., 75001)",
    phonePattern: /^(\+33)?[0-9]{9}$/,
    phoneFormat: "+33 X XX XX XX XX"
  },
  international: {
    name: "International",
    postalCodePattern: /^.{3,10}$/,
    postalCodeFormat: "3-10 characters",
    phonePattern: /^\+?[0-9]{7,15}$/,
    phoneFormat: "International format with country code"
  }
};

// ============ FIELD MAPPINGS ============
const FIELD_MAPPINGS: Record<string, string[]> = {
  name: ["name", "full_name", "fullname", "customer_name", "recipient", "recipient_name", "contact_name", "customer"],
  phone: ["phone", "phone_number", "phonenumber", "mobile", "mobile_number", "contact", "tel", "telephone", "cell", "contact_number"],
  email: ["email", "email_address", "emailaddress", "e-mail", "e_mail"],
  address: ["address", "address1", "address_line_1", "addressline1", "street", "street_address", "address_1", "line1", "full_address", "delivery_address"],
  address2: ["address2", "address_line_2", "addressline2", "unit", "apt", "apartment", "suite", "floor", "address_2", "line2"],
  city: ["city", "town", "suburb", "district", "area"],
  state: ["state", "province", "region", "prefecture", "county"],
  postalCode: ["postal_code", "postalcode", "postcode", "post_code", "zip", "zipcode", "zip_code", "pincode"],
  country: ["country", "country_code", "nation"]
};

// ============ UTILITY FUNCTIONS ============
function normalizeFieldName(field: string): string {
  const normalized = field.toLowerCase().trim().replace(/[\s-]/g, "_");
  for (const [standardField, aliases] of Object.entries(FIELD_MAPPINGS)) {
    if (aliases.includes(normalized)) {
      return standardField;
    }
  }
  return normalized;
}

function cleanString(value: string | undefined | null): string {
  if (!value) return "";
  return value.toString().trim().replace(/\s+/g, " ");
}

function cleanName(name: string): string {
  if (!name) return "";
  // Remove extra spaces, capitalize properly
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanPhone(phone: string, region: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  
  // Format phone number based on region
  if (region === "singapore") {
    // Singapore format: +65 XXXX XXXX
    // Singapore local numbers are 8 digits starting with 8 or 9
    
    let localNumber = digits;
    
    // Handle various input formats:
    // "6591234567" (10 digits with 65 prefix)
    // "91234567" (8 digits local)
    // "+6591234567" (already has + prefix, digits would be "6591234567")
    
    // If starts with 65 and has 10 digits, extract the local number
    if (digits.startsWith("65") && digits.length === 10) {
      localNumber = digits.slice(2); // Get the 8-digit local number
    }
    // If it's exactly 8 digits, use as-is
    else if (digits.length === 8) {
      localNumber = digits;
    }
    // If it's longer than 10 digits and starts with 65, try to extract
    else if (digits.startsWith("65") && digits.length > 10) {
      localNumber = digits.slice(2, 10); // Take 8 digits after 65
    }
    // Otherwise, take the last 8 digits if available
    else if (digits.length > 8) {
      localNumber = digits.slice(-8);
    }
    
    // Format as +65 XXXX XXXX if we have 8 digits
    if (localNumber.length === 8) {
      return `+65 ${localNumber.slice(0, 4)} ${localNumber.slice(4)}`;
    } else {
      // If not 8 digits, return with +65 prefix but note it's malformed
      return `+65 ${localNumber}`;
    }
  }
  
  // For other regions, add country code if missing
  const countryPrefixes: Record<string, string> = {
    malaysia: "+60",
    indonesia: "+62",
    thailand: "+66",
    vietnam: "+84",
    philippines: "+63",
    australia: "+61",
    usa: "+1",
    uk: "+44",
    germany: "+49",
    france: "+33"
  };
  
  let cleaned = "+" + digits;
  if (countryPrefixes[region]) {
    const prefix = countryPrefixes[region].slice(1); // Remove + from prefix
    if (!digits.startsWith(prefix)) {
      cleaned = countryPrefixes[region] + digits;
    }
  }
  
  return cleaned;
}

function cleanEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

function cleanPostalCode(postalCode: string, region: string): string {
  if (!postalCode) return "";
  let cleaned = postalCode.trim().toUpperCase();
  
  // Region-specific cleaning
  if (region === "singapore") {
    cleaned = cleaned.replace(/\D/g, "").slice(0, 6);
  } else if (["malaysia", "indonesia", "thailand", "germany", "france"].includes(region)) {
    cleaned = cleaned.replace(/\D/g, "").slice(0, 5);
  } else if (["australia", "philippines"].includes(region)) {
    cleaned = cleaned.replace(/\D/g, "").slice(0, 4);
  } else if (region === "usa") {
    cleaned = cleaned.replace(/[^\d-]/g, "");
  } else if (region === "uk") {
    // UK postcodes need special handling
    cleaned = cleaned.replace(/[^A-Z0-9\s]/gi, "");
  }
  
  return cleaned;
}

function cleanAddress(address: string, region: string = "singapore"): string {
  if (!address) return "";
  
  let cleaned = address
    .trim()
    .replace(/\s+/g, " ")
    .replace(/,+/g, ",")
    .replace(/\s*,\s*/g, ", ");
  
  // Singapore-specific address standardization
  if (region === "singapore") {
    // Standardize common abbreviations
    const abbreviations: [RegExp, string][] = [
      // Block variations
      [/\bblk\b/gi, "Block"],
      [/\bBLK\b/g, "Block"],
      [/\bblock\b/gi, "Block"],
      
      // Street variations
      [/\bst\b/gi, "Street"],
      [/\bstr\b/gi, "Street"],
      
      // Road variations
      [/\brd\b/gi, "Road"],
      
      // Avenue variations
      [/\bave\b/gi, "Avenue"],
      [/\bav\b/gi, "Avenue"],
      
      // Drive variations
      [/\bdr\b/gi, "Drive"],
      
      // Lane variations
      [/\bln\b/gi, "Lane"],
      
      // Place variations
      [/\bpl\b/gi, "Place"],
      
      // Crescent variations
      [/\bcres\b/gi, "Crescent"],
      [/\bcr\b/gi, "Crescent"],
      
      // Terrace variations
      [/\bter\b/gi, "Terrace"],
      [/\bterr\b/gi, "Terrace"],
      
      // Close variations
      [/\bcl\b/gi, "Close"],
      
      // Walk variations
      [/\bwk\b/gi, "Walk"],
      
      // Garden/Gardens variations
      [/\bgdn\b/gi, "Garden"],
      [/\bgdns\b/gi, "Gardens"],
      
      // North/South/East/West variations
      [/\bnth\b/gi, "North"],
      [/\bsth\b/gi, "South"],
      [/\best\b/gi, "East"],
      [/\bwst\b/gi, "West"],
      [/\bn\b/gi, "North"],
      [/\bs\b(?!\d)/gi, "South"], // Avoid matching S followed by numbers
      [/\be\b/gi, "East"],
      [/\bw\b/gi, "West"],
      
      // Common Singapore location abbreviations
      [/\bAMK\b/gi, "Ang Mo Kio"],
      [/\bTPY\b/gi, "Toa Payoh"],
      [/\bCCK\b/gi, "Choa Chu Kang"],
      [/\bJE\b/gi, "Jurong East"],
      [/\bJW\b/gi, "Jurong West"],
      [/\bYCK\b/gi, "Yio Chu Kang"],
      [/\bBTK\b/gi, "Bukit Timah"],
      [/\bBBT\b/gi, "Bukit Batok"],
      [/\bBPJ\b/gi, "Bukit Panjang"],
      [/\bSGN\b/gi, "Serangoon"],
      [/\bSMB\b/gi, "Sembawang"],
      [/\bWDL\b/gi, "Woodlands"],
      [/\bPGR\b/gi, "Pasir Ris"],
      [/\bTPN\b/gi, "Tampines"],
      [/\bBDK\b/gi, "Bedok"],
      [/\bMRB\b/gi, "Marine Parade"],
      [/\bKLG\b/gi, "Kallang"],
      [/\bGYL\b/gi, "Geylang"],
      [/\bQTN\b/gi, "Queenstown"],
      [/\bCBD\b/gi, "Central Business District"],
      
      // Floor/Unit standardization
      [/\b#(\d+)-(\d+)\b/g, "#$1-$2"], // Keep unit format as-is
      [/\bunit\s*(\d+)/gi, "Unit $1"],
      [/\bflr\b/gi, "Floor"],
      [/\bfl\b/gi, "Floor"],
      [/\blvl\b/gi, "Level"],
    ];
    
    for (const [pattern, replacement] of abbreviations) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    // Ensure proper capitalization for Singapore addresses
    // Split by common delimiters and capitalize each part
    cleaned = cleaned
      .split(/([,#\-])/)
      .map(part => {
        if (/^[,#\-]$/.test(part)) return part;
        return part
          .split(' ')
          .map(word => {
            // Keep numbers and unit formats as-is
            if (/^\d+$/.test(word) || /^#\d+/.test(word)) return word;
            // Capitalize first letter of each word
            if (word.length > 0) {
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            return word;
          })
          .join(' ');
      })
      .join('');
  }
  
  return cleaned;
}

// ============ VALIDATION FUNCTIONS ============
function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email) return { valid: true }; // Empty is OK, will be flagged separately if required
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Invalid email format" };
  }
  return { valid: true };
}

function validatePhone(phone: string, region: string): { valid: boolean; message?: string } {
  if (!phone) return { valid: true };
  
  // Special validation for Singapore numbers
  if (region === "singapore") {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, "");
    
    // Extract the local number (8 digits)
    let localNumber = digits;
    if (digits.startsWith("65") && digits.length >= 10) {
      localNumber = digits.slice(2);
    }
    
    // Singapore mobile numbers must start with 8 or 9
    // Landlines start with 6, but most logistics data is mobile
    if (localNumber.length >= 1) {
      const firstDigit = localNumber[0];
      if (firstDigit !== "8" && firstDigit !== "9" && firstDigit !== "6") {
        return { 
          valid: false, 
          message: `Invalid Singapore number: must start with 8, 9, or 6 after +65 prefix (got ${firstDigit})` 
        };
      }
    }
    
    // Check length - should be 8 digits for local number
    if (localNumber.length !== 8) {
      return { 
        valid: false, 
        message: `Invalid Singapore number: local number should be 8 digits (got ${localNumber.length})` 
      };
    }
  }
  
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.international;
  if (!config.phonePattern.test(phone.replace(/[\s-]/g, ""))) {
    return { valid: false, message: `Phone number doesn't match ${config.name} format (${config.phoneFormat})` };
  }
  return { valid: true };
}

function validatePostalCode(postalCode: string, region: string): { valid: boolean; message?: string } {
  if (!postalCode) return { valid: true };
  const config = REGION_CONFIGS[region] || REGION_CONFIGS.international;
  if (!config.postalCodePattern.test(postalCode)) {
    return { valid: false, message: `Postal code doesn't match ${config.name} format (${config.postalCodeFormat})` };
  }
  return { valid: true };
}

function validateName(name: string): { valid: boolean; message?: string } {
  if (!name) return { valid: true };
  if (name.length < 2) {
    return { valid: false, message: "Name is too short" };
  }
  if (/^\d+$/.test(name)) {
    return { valid: false, message: "Name contains only numbers" };
  }
  return { valid: true };
}

function validateAddress(address: string): { valid: boolean; message?: string } {
  if (!address) return { valid: true };
  if (address.length < 5) {
    return { valid: false, message: "Address is too short" };
  }
  return { valid: true };
}

// ============ MAIN CLEANING FUNCTIONS ============
export interface CleaningResult {
  record: Partial<InsertDataRecord>;
  issues: InsertValidationIssue[];
  qualityScore: number;
  needsReview: boolean;
}

export function mapRawDataToRecord(rawData: Record<string, string>, rowIndex: number, batchId: number): Partial<InsertDataRecord> {
  const record: Partial<InsertDataRecord> = {
    batchId,
    rowIndex,
    originalData: rawData,
    status: "pending"
  };
  
  // Map fields from raw data
  for (const [key, value] of Object.entries(rawData)) {
    const normalizedKey = normalizeFieldName(key);
    const cleanedValue = cleanString(value);
    
    switch (normalizedKey) {
      case "name":
        record.name = cleanedValue;
        break;
      case "phone":
        record.phone = cleanedValue;
        break;
      case "email":
        record.email = cleanedValue;
        break;
      case "address":
      case "addressLine1":
        record.addressLine1 = cleanedValue;
        break;
      case "address2":
      case "addressLine2":
        record.addressLine2 = cleanedValue;
        break;
      case "city":
        record.city = cleanedValue;
        break;
      case "state":
        record.state = cleanedValue;
        break;
      case "postalCode":
        record.postalCode = cleanedValue;
        break;
      case "country":
        record.country = cleanedValue;
        break;
    }
  }
  
  return record;
}

export function cleanRecord(record: Partial<InsertDataRecord>, region: string = "singapore"): CleaningResult {
  const issues: InsertValidationIssue[] = [];
  let qualityScore = 100;
  let needsReview = false;
  
  const batchId = record.batchId!;
  const recordId = record.id || 0; // Will be updated after insert
  
  // Clean each field
  const cleanedName = cleanName(record.name || "");
  const cleanedPhone = cleanPhone(record.phone || "", region);
  const cleanedEmail = cleanEmail(record.email || "");
  const cleanedAddressLine1 = cleanAddress(record.addressLine1 || "", region);
  const cleanedAddressLine2 = cleanAddress(record.addressLine2 || "", region);
  const cleanedCity = cleanString(record.city || "");
  const cleanedState = cleanString(record.state || "");
  const cleanedPostalCode = cleanPostalCode(record.postalCode || "", region);
  const cleanedCountry = cleanString(record.country || "") || REGION_CONFIGS[region]?.name || "";
  
  // Validate and create issues
  
  // Name validation
  if (!cleanedName) {
    issues.push({
      recordId,
      batchId,
      field: "name",
      severity: "error",
      issueType: "missing_required",
      message: "Name is missing",
      originalValue: record.name || null
    });
    qualityScore -= 20;
    needsReview = true;
  } else {
    const nameValidation = validateName(cleanedName);
    if (!nameValidation.valid) {
      issues.push({
        recordId,
        batchId,
        field: "name",
        severity: "warning",
        issueType: "invalid_format",
        message: nameValidation.message!,
        originalValue: record.name || null,
        suggestedValue: cleanedName
      });
      qualityScore -= 10;
    }
  }
  
  // Phone validation
  if (!cleanedPhone) {
    issues.push({
      recordId,
      batchId,
      field: "phone",
      severity: "error",
      issueType: "missing_required",
      message: "Phone number is missing",
      originalValue: record.phone || null
    });
    qualityScore -= 20;
    needsReview = true;
  } else {
    const phoneValidation = validatePhone(cleanedPhone, region);
    if (!phoneValidation.valid) {
      issues.push({
        recordId,
        batchId,
        field: "phone",
        severity: "warning",
        issueType: "invalid_format",
        message: phoneValidation.message!,
        originalValue: record.phone || null,
        suggestedValue: cleanedPhone
      });
      qualityScore -= 10;
      needsReview = true;
    }
  }
  
  // Email validation
  if (cleanedEmail) {
    const emailValidation = validateEmail(cleanedEmail);
    if (!emailValidation.valid) {
      issues.push({
        recordId,
        batchId,
        field: "email",
        severity: "warning",
        issueType: "invalid_format",
        message: emailValidation.message!,
        originalValue: record.email || null,
        suggestedValue: cleanedEmail
      });
      qualityScore -= 5;
    }
  }
  
  // Address validation
  if (!cleanedAddressLine1) {
    issues.push({
      recordId,
      batchId,
      field: "addressLine1",
      severity: "error",
      issueType: "missing_required",
      message: "Address is missing",
      originalValue: record.addressLine1 || null
    });
    qualityScore -= 20;
    needsReview = true;
  } else {
    const addressValidation = validateAddress(cleanedAddressLine1);
    if (!addressValidation.valid) {
      issues.push({
        recordId,
        batchId,
        field: "addressLine1",
        severity: "warning",
        issueType: "invalid_format",
        message: addressValidation.message!,
        originalValue: record.addressLine1 || null,
        suggestedValue: cleanedAddressLine1
      });
      qualityScore -= 10;
      needsReview = true;
    }
  }
  
  // Postal code validation
  if (!cleanedPostalCode) {
    issues.push({
      recordId,
      batchId,
      field: "postalCode",
      severity: "error",
      issueType: "missing_required",
      message: "Postal code is missing",
      originalValue: record.postalCode || null
    });
    qualityScore -= 15;
    needsReview = true;
  } else {
    const postalValidation = validatePostalCode(cleanedPostalCode, region);
    if (!postalValidation.valid) {
      issues.push({
        recordId,
        batchId,
        field: "postalCode",
        severity: "warning",
        issueType: "invalid_format",
        message: postalValidation.message!,
        originalValue: record.postalCode || null,
        suggestedValue: cleanedPostalCode
      });
      qualityScore -= 10;
      needsReview = true;
    }
  }
  
  // Check for data that changed significantly
  if (record.name && cleanedName && record.name.toLowerCase() !== cleanedName.toLowerCase()) {
    issues.push({
      recordId,
      batchId,
      field: "name",
      severity: "info",
      issueType: "auto_corrected",
      message: "Name was standardized",
      originalValue: record.name,
      suggestedValue: cleanedName
    });
  }
  
  if (record.phone && cleanedPhone && record.phone !== cleanedPhone) {
    issues.push({
      recordId,
      batchId,
      field: "phone",
      severity: "info",
      issueType: "auto_corrected",
      message: "Phone number was formatted",
      originalValue: record.phone,
      suggestedValue: cleanedPhone
    });
  }
  
  // Ensure score doesn't go below 0
  qualityScore = Math.max(0, qualityScore);
  
  // Determine status
  // Check if any cleaning was actually performed (original differs from cleaned)
  const hasErrors = issues.some(i => i.severity === "error");
  const hasChanges = 
    (record.name || "") !== cleanedName ||
    (record.phone || "") !== cleanedPhone ||
    (record.email || "") !== cleanedEmail ||
    (record.addressLine1 || "") !== cleanedAddressLine1 ||
    (record.addressLine2 || "") !== cleanedAddressLine2 ||
    (record.postalCode || "") !== cleanedPostalCode;
  
  // If no errors and no changes needed, mark as accepted
  // If no errors but changes were made, mark as cleaned
  // If errors exist, mark as flagged
  const status = hasErrors ? "flagged" : (hasChanges ? "cleaned" : "accepted");
  
  return {
    record: {
      ...record,
      cleanedName,
      cleanedPhone,
      cleanedEmail,
      cleanedAddressLine1,
      cleanedAddressLine2,
      cleanedCity,
      cleanedState,
      cleanedPostalCode,
      cleanedCountry,
      cleanedData: {
        name: cleanedName,
        phone: cleanedPhone,
        email: cleanedEmail,
        addressLine1: cleanedAddressLine1,
        addressLine2: cleanedAddressLine2,
        city: cleanedCity,
        state: cleanedState,
        postalCode: cleanedPostalCode,
        country: cleanedCountry
      },
      status,
      qualityScore,
      needsReview
    },
    issues,
    qualityScore,
    needsReview
  };
}

// ============ LLM-POWERED ENHANCEMENT ============
export async function enhanceWithLLM(records: Partial<InsertDataRecord>[], region: string): Promise<Partial<InsertDataRecord>[]> {
  if (records.length === 0) return [];
  
  // Only process records that need review or have issues
  const recordsToEnhance = records.filter(r => r.needsReview || (r.qualityScore && r.qualityScore < 80));
  
  if (recordsToEnhance.length === 0) return records;
  
  // Process in batches of 10 for LLM
  const batchSize = 10;
  const enhancedRecords: Partial<InsertDataRecord>[] = [...records];
  
  for (let i = 0; i < recordsToEnhance.length; i += batchSize) {
    const batch = recordsToEnhance.slice(i, i + batchSize);
    
    try {
      const prompt = `You are a data cleaning expert specializing in ${REGION_CONFIGS[region]?.name || "international"} addresses.

Analyze and correct the following address records. For each record, provide corrections for any issues found.

Records to analyze:
${JSON.stringify(batch.map(r => ({
  rowIndex: r.rowIndex,
  name: r.name,
  phone: r.phone,
  email: r.email,
  address: r.addressLine1,
  address2: r.addressLine2,
  city: r.city,
  state: r.state,
  postalCode: r.postalCode,
  country: r.country
})), null, 2)}

For each record, provide corrections in the following JSON format. Only include fields that need correction.
IMPORTANT: All field values must be SHORT and CONCISE - no explanations in field values!
- state: Use only the state/province name (e.g., "California", "NSW"). For Singapore, use empty string "" since Singapore has no states.
- city: Use only the city name (e.g., "Singapore", "Sydney")
- All other fields: Use only the corrected value, no explanations

{
  "corrections": [
    {
      "rowIndex": number,
      "name": "corrected name",
      "phone": "corrected phone in format +65 XXXX XXXX for Singapore",
      "email": "corrected email",
      "addressLine1": "corrected full address including unit number",
      "addressLine2": "additional address line if any, otherwise empty",
      "city": "city name only (e.g., Singapore)",
      "state": "state/province name only, empty for Singapore",
      "postalCode": "corrected postal code",
      "country": "country name only (e.g., Singapore)",
      "confidence": "high" | "medium" | "low",
      "notes": "explanation of corrections (this is the only field for explanations)"
    }
  ]
}`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are a data cleaning expert. Respond only with valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "address_corrections",
            strict: true,
            schema: {
              type: "object",
              properties: {
                corrections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rowIndex: { type: "integer" },
                      name: { type: "string" },
                      phone: { type: "string" },
                      email: { type: "string" },
                      addressLine1: { type: "string" },
                      addressLine2: { type: "string" },
                      city: { type: "string" },
                      state: { type: "string" },
                      postalCode: { type: "string" },
                      country: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                      notes: { type: "string" }
                    },
                    required: ["rowIndex", "confidence", "notes"],
                    additionalProperties: false
                  }
                }
              },
              required: ["corrections"],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (content && typeof content === 'string') {
        const parsed = JSON.parse(content);
        
        // Apply corrections
        for (const correction of parsed.corrections) {
          const recordIndex = enhancedRecords.findIndex(r => r.rowIndex === correction.rowIndex);
          if (recordIndex !== -1 && correction.confidence !== "low") {
            const record = enhancedRecords[recordIndex];
            
            // Helper to truncate strings to max length
            const truncate = (str: string | undefined, maxLen: number) => str ? str.substring(0, maxLen) : str;
            
            if (correction.name) record.cleanedName = truncate(correction.name, 255);
            if (correction.phone) record.cleanedPhone = truncate(correction.phone, 64);
            if (correction.email) record.cleanedEmail = truncate(correction.email, 320);
            if (correction.addressLine1) record.cleanedAddressLine1 = correction.addressLine1;
            if (correction.addressLine2) record.cleanedAddressLine2 = correction.addressLine2;
            if (correction.city) record.cleanedCity = truncate(correction.city, 128);
            if (correction.state) record.cleanedState = truncate(correction.state, 128);
            if (correction.postalCode) record.cleanedPostalCode = truncate(correction.postalCode, 32);
            if (correction.country) record.cleanedCountry = truncate(correction.country, 128);
            
            // Update cleaned data object
            record.cleanedData = {
              name: record.cleanedName || "",
              phone: record.cleanedPhone || "",
              email: record.cleanedEmail || "",
              addressLine1: record.cleanedAddressLine1 || "",
              addressLine2: record.cleanedAddressLine2 || "",
              city: record.cleanedCity || "",
              state: record.cleanedState || "",
              postalCode: record.cleanedPostalCode || "",
              country: record.cleanedCountry || ""
            };
            
            // Improve quality score for high confidence corrections
            if (correction.confidence === "high" && record.qualityScore) {
              record.qualityScore = Math.min(100, record.qualityScore + 15);
            }
          }
        }
      }
    } catch (error) {
      console.error("LLM enhancement failed for batch:", error);
      // Continue with other batches even if one fails
    }
  }
  
  return enhancedRecords;
}

// ============ EXPORT FUNCTIONS ============
export function getRegionConfigs() {
  return REGION_CONFIGS;
}

export function getSupportedRegions(): string[] {
  return Object.keys(REGION_CONFIGS);
}
