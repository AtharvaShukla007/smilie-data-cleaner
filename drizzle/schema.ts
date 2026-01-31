import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Upload batches - tracks each file upload session
 */
export const uploadBatches = mysqlTable("upload_batches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  originalFileUrl: text("originalFileUrl"),
  fileSize: bigint("fileSize", { mode: "number" }),
  totalRecords: int("totalRecords").default(0),
  cleanedRecords: int("cleanedRecords").default(0),
  errorRecords: int("errorRecords").default(0),
  warningRecords: int("warningRecords").default(0),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  region: varchar("region", { length: 64 }).default("singapore"),
  processedFileUrl: text("processedFileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type UploadBatch = typeof uploadBatches.$inferSelect;
export type InsertUploadBatch = typeof uploadBatches.$inferInsert;

/**
 * Data records - individual rows from uploaded files
 */
export const dataRecords = mysqlTable("data_records", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  rowIndex: int("rowIndex").notNull(),
  // Original data
  originalData: json("originalData").$type<Record<string, string>>(),
  // Cleaned/standardized data
  cleanedData: json("cleanedData").$type<Record<string, string>>(),
  // Address fields (extracted for easier querying)
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 320 }),
  addressLine1: text("addressLine1"),
  addressLine2: text("addressLine2"),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 128 }),
  postalCode: varchar("postalCode", { length: 32 }),
  country: varchar("country", { length: 128 }),
  // Cleaned versions
  cleanedName: varchar("cleanedName", { length: 255 }),
  cleanedPhone: varchar("cleanedPhone", { length: 64 }),
  cleanedEmail: varchar("cleanedEmail", { length: 320 }),
  cleanedAddressLine1: text("cleanedAddressLine1"),
  cleanedAddressLine2: text("cleanedAddressLine2"),
  cleanedCity: varchar("cleanedCity", { length: 128 }),
  cleanedState: varchar("cleanedState", { length: 128 }),
  cleanedPostalCode: varchar("cleanedPostalCode", { length: 32 }),
  cleanedCountry: varchar("cleanedCountry", { length: 128 }),
  // Status
  status: mysqlEnum("status", ["pending", "cleaned", "flagged", "approved", "rejected"]).default("pending").notNull(),
  qualityScore: int("qualityScore").default(100),
  needsReview: boolean("needsReview").default(false),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DataRecord = typeof dataRecords.$inferSelect;
export type InsertDataRecord = typeof dataRecords.$inferInsert;

/**
 * Validation issues - problems found during data cleaning
 */
export const validationIssues = mysqlTable("validation_issues", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("recordId").notNull(),
  batchId: int("batchId").notNull(),
  field: varchar("field", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["error", "warning", "info"]).default("warning").notNull(),
  issueType: varchar("issueType", { length: 64 }).notNull(),
  message: text("message").notNull(),
  originalValue: text("originalValue"),
  suggestedValue: text("suggestedValue"),
  isResolved: boolean("isResolved").default(false),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ValidationIssue = typeof validationIssues.$inferSelect;
export type InsertValidationIssue = typeof validationIssues.$inferInsert;

/**
 * Audit logs - track all data transformations and user actions
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  batchId: int("batchId"),
  recordId: int("recordId"),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId"),
  previousValue: json("previousValue").$type<Record<string, unknown>>(),
  newValue: json("newValue").$type<Record<string, unknown>>(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Processing jobs - background job queue for batch operations
 */
export const processingJobs = mysqlTable("processing_jobs", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  userId: int("userId").notNull(),
  jobType: mysqlEnum("jobType", ["clean", "validate", "export", "llm_enhance"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed"]).default("queued").notNull(),
  progress: int("progress").default(0),
  totalItems: int("totalItems").default(0),
  processedItems: int("processedItems").default(0),
  errorMessage: text("errorMessage"),
  result: json("result").$type<Record<string, unknown>>(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = typeof processingJobs.$inferInsert;

/**
 * API keys - for external integrations
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),
  permissions: json("permissions").$type<string[]>(),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
