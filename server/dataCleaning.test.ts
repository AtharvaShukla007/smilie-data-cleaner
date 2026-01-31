import { describe, expect, it } from "vitest";
import { 
  cleanRecord, 
  mapRawDataToRecord, 
  getSupportedRegions,
  getRegionConfigs 
} from "./dataCleaningEngine";

describe("Data Cleaning Engine", () => {
  describe("mapRawDataToRecord", () => {
    it("maps raw CSV data to record structure", () => {
      const rawData = {
        name: "John Doe",
        phone: "91234567",
        email: "john@example.com",
        address: "123 Main St",
        postal_code: "123456",
        city: "Singapore",
        country: "Singapore"
      };
      
      const result = mapRawDataToRecord(rawData, 0, 1);
      
      expect(result.name).toBe("John Doe");
      expect(result.phone).toBe("91234567");
      expect(result.email).toBe("john@example.com");
      expect(result.postalCode).toBe("123456");
      expect(result.batchId).toBe(1);
      expect(result.rowIndex).toBe(0);
    });

    it("handles various column name formats", () => {
      const rawData = {
        "Full Name": "Jane Smith",
        "Phone Number": "+6598765432",
        "Email Address": "jane@test.com",
        "Address Line 1": "456 Oak Ave",
        "Postal Code": "654321"
      };
      
      const result = mapRawDataToRecord(rawData, 1, 2);
      
      expect(result.name).toBe("Jane Smith");
      expect(result.phone).toBe("+6598765432");
      expect(result.email).toBe("jane@test.com");
      expect(result.addressLine1).toBe("456 Oak Ave");
      expect(result.postalCode).toBe("654321");
    });
  });

  describe("cleanRecord - Singapore", () => {
    it("validates correct Singapore postal code", () => {
      const record = {
        id: 1,
        batchId: 1,
        rowIndex: 0,
        name: "Test User",
        phone: "91234567",
        email: "test@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.cleanedPostalCode).toBe("123456");
      expect(result.issues.filter(i => i.field === "postalCode" && i.severity === "error")).toHaveLength(0);
    });

    it("flags invalid Singapore postal code", () => {
      const record = {
        id: 2,
        batchId: 1,
        rowIndex: 1,
        name: "Test User",
        phone: "91234567",
        email: "test@example.com",
        postalCode: "12345", // Invalid - should be 6 digits
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      const postalIssues = result.issues.filter(i => i.field === "postalCode");
      expect(postalIssues.length).toBeGreaterThan(0);
      expect(postalIssues.some(i => i.severity === "error" || i.severity === "warning")).toBe(true);
    });

    it("formats Singapore phone number", () => {
      const record = {
        id: 3,
        batchId: 1,
        rowIndex: 2,
        name: "Test User",
        phone: "91234567",
        email: "test@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      // Phone is cleaned with country code prefix
      expect(result.record.cleanedPhone).toMatch(/^\+65/);
    });

    it("validates Singapore phone number with country code", () => {
      const record = {
        id: 4,
        batchId: 1,
        rowIndex: 3,
        name: "Test User",
        phone: "+6591234567",
        email: "test@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      // Phone is cleaned with country code prefix
      expect(result.record.cleanedPhone).toMatch(/^\+65/);
    });
  });

  describe("cleanRecord - Email Validation", () => {
    it("validates correct email format", () => {
      const record = {
        id: 5,
        batchId: 1,
        rowIndex: 4,
        name: "Test User",
        phone: "91234567",
        email: "valid@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.cleanedEmail).toBe("valid@example.com");
      expect(result.issues.filter(i => i.field === "email" && i.severity === "error")).toHaveLength(0);
    });

    it("flags invalid email format", () => {
      const record = {
        id: 6,
        batchId: 1,
        rowIndex: 5,
        name: "Test User",
        phone: "91234567",
        email: "invalid-email",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      const emailIssues = result.issues.filter(i => i.field === "email");
      // Invalid email should be flagged with error or warning
      expect(emailIssues.length).toBeGreaterThan(0);
    });

    it("normalizes email to lowercase", () => {
      const record = {
        id: 7,
        batchId: 1,
        rowIndex: 6,
        name: "Test User",
        phone: "91234567",
        email: "Test@EXAMPLE.COM",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.cleanedEmail).toBe("test@example.com");
    });
  });

  describe("cleanRecord - Name Cleaning", () => {
    it("trims whitespace from names", () => {
      const record = {
        id: 8,
        batchId: 1,
        rowIndex: 7,
        name: "  John Doe  ",
        phone: "91234567",
        email: "john@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.cleanedName).toBe("John Doe");
    });

    it("flags missing name", () => {
      const record = {
        id: 9,
        batchId: 1,
        rowIndex: 8,
        name: "",
        phone: "91234567",
        email: "test@example.com",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      const nameIssues = result.issues.filter(i => i.field === "name");
      expect(nameIssues.some(i => i.severity === "error")).toBe(true);
    });
  });

  describe("cleanRecord - Quality Score", () => {
    it("calculates high quality score for complete valid data", () => {
      const record = {
        id: 10,
        batchId: 1,
        rowIndex: 9,
        name: "John Doe",
        phone: "91234567",
        email: "john@example.com",
        addressLine1: "123 Main Street",
        city: "Singapore",
        postalCode: "123456",
        country: "Singapore",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.qualityScore).toBeGreaterThanOrEqual(70);
    });

    it("calculates lower quality score for incomplete data", () => {
      const record = {
        id: 11,
        batchId: 1,
        rowIndex: 10,
        name: "John",
        phone: "",
        email: "",
        postalCode: "",
        country: "",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "singapore");
      
      expect(result.record.qualityScore).toBeLessThan(50);
    });
  });

  describe("getSupportedRegions", () => {
    it("returns list of supported regions", () => {
      const regions = getSupportedRegions();
      
      expect(regions).toContain("singapore");
      expect(regions).toContain("malaysia");
      expect(regions).toContain("usa");
      expect(regions).toContain("uk");
      expect(Array.isArray(regions)).toBe(true);
    });
  });

  describe("getRegionConfigs", () => {
    it("returns region configurations", () => {
      const configs = getRegionConfigs();
      
      expect(configs.singapore).toBeDefined();
      expect(configs.singapore.postalCodePattern).toBeDefined();
      expect(configs.singapore.phonePattern).toBeDefined();
    });
  });

  describe("cleanRecord - International Regions", () => {
    it("validates US postal code (ZIP)", () => {
      const record = {
        id: 12,
        batchId: 1,
        rowIndex: 11,
        name: "Test User",
        phone: "2025551234",
        email: "test@example.com",
        postalCode: "90210",
        country: "USA",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "usa");
      
      expect(result.record.cleanedPostalCode).toBe("90210");
    });

    it("validates UK postal code", () => {
      const record = {
        id: 13,
        batchId: 1,
        rowIndex: 12,
        name: "Test User",
        phone: "02071234567",
        email: "test@example.com",
        postalCode: "SW1A 1AA",
        country: "UK",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "uk");
      
      expect(result.record.cleanedPostalCode).toBe("SW1A 1AA");
    });

    it("validates Malaysia postal code", () => {
      const record = {
        id: 14,
        batchId: 1,
        rowIndex: 13,
        name: "Test User",
        phone: "0123456789",
        email: "test@example.com",
        postalCode: "50000",
        country: "Malaysia",
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = cleanRecord(record, "malaysia");
      
      expect(result.record.cleanedPostalCode).toBe("50000");
    });
  });
});
