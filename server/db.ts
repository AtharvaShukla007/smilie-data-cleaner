import { eq, desc, and, sql, inArray, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  uploadBatches, InsertUploadBatch, UploadBatch,
  dataRecords, InsertDataRecord, DataRecord,
  validationIssues, InsertValidationIssue, ValidationIssue,
  auditLogs, InsertAuditLog, AuditLog,
  processingJobs, InsertProcessingJob, ProcessingJob,
  apiKeys, InsertApiKey, ApiKey
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ UPLOAD BATCH FUNCTIONS ============
export async function createUploadBatch(batch: InsertUploadBatch): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(uploadBatches).values(batch);
  return result[0].insertId;
}

export async function getUploadBatch(id: number): Promise<UploadBatch | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(uploadBatches).where(eq(uploadBatches.id, id)).limit(1);
  return result[0];
}

export async function getUserBatches(userId: number, limit = 50): Promise<UploadBatch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uploadBatches)
    .where(eq(uploadBatches.userId, userId))
    .orderBy(desc(uploadBatches.createdAt))
    .limit(limit);
}

export async function updateUploadBatch(id: number, updates: Partial<InsertUploadBatch>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(uploadBatches).set(updates).where(eq(uploadBatches.id, id));
}

export async function getBatchStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, processing: 0, failed: 0 };
  
  const stats = await db.select({
    status: uploadBatches.status,
    count: count()
  }).from(uploadBatches)
    .where(eq(uploadBatches.userId, userId))
    .groupBy(uploadBatches.status);
  
  const result = { total: 0, completed: 0, processing: 0, failed: 0, pending: 0 };
  stats.forEach(s => {
    result[s.status as keyof typeof result] = s.count;
    result.total += s.count;
  });
  return result;
}

// ============ DATA RECORD FUNCTIONS ============
export async function createDataRecords(records: InsertDataRecord[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (records.length === 0) return;
  
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await db.insert(dataRecords).values(batch);
  }
}

export async function getDataRecord(id: number): Promise<DataRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dataRecords).where(eq(dataRecords.id, id)).limit(1);
  return result[0];
}

export async function getBatchRecords(batchId: number, options?: { 
  status?: string; 
  needsReview?: boolean;
  limit?: number;
  offset?: number;
}): Promise<DataRecord[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(dataRecords.batchId, batchId)];
  
  if (options?.status) {
    conditions.push(eq(dataRecords.status, options.status as any));
  }
  
  if (options?.needsReview !== undefined) {
    conditions.push(eq(dataRecords.needsReview, options.needsReview));
  }
  
  return db.select().from(dataRecords)
    .where(and(...conditions))
    .orderBy(dataRecords.rowIndex)
    .limit(options?.limit ?? 1000)
    .offset(options?.offset ?? 0);
}

export async function updateDataRecord(id: number, updates: Partial<InsertDataRecord>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(dataRecords).set(updates).where(eq(dataRecords.id, id));
}

export async function updateDataRecordsBulk(ids: number[], updates: Partial<InsertDataRecord>): Promise<void> {
  const db = await getDb();
  if (!db || ids.length === 0) return;
  await db.update(dataRecords).set(updates).where(inArray(dataRecords.id, ids));
}

export async function getRecordsNeedingReview(batchId: number): Promise<DataRecord[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataRecords)
    .where(and(
      eq(dataRecords.batchId, batchId),
      eq(dataRecords.needsReview, true)
    ))
    .orderBy(dataRecords.qualityScore);
}

export async function getBatchRecordStats(batchId: number) {
  const db = await getDb();
  if (!db) return { total: 0, cleaned: 0, flagged: 0, approved: 0, rejected: 0, pending: 0 };
  
  const stats = await db.select({
    status: dataRecords.status,
    count: count()
  }).from(dataRecords)
    .where(eq(dataRecords.batchId, batchId))
    .groupBy(dataRecords.status);
  
  const result = { total: 0, cleaned: 0, flagged: 0, approved: 0, rejected: 0, pending: 0 };
  stats.forEach(s => {
    result[s.status as keyof typeof result] = s.count;
    result.total += s.count;
  });
  return result;
}

// ============ VALIDATION ISSUE FUNCTIONS ============
export async function createValidationIssues(issues: InsertValidationIssue[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (issues.length === 0) return;
  
  const batchSize = 100;
  for (let i = 0; i < issues.length; i += batchSize) {
    const batch = issues.slice(i, i + batchSize);
    await db.insert(validationIssues).values(batch);
  }
}

export async function getRecordIssues(recordId: number): Promise<ValidationIssue[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(validationIssues)
    .where(eq(validationIssues.recordId, recordId))
    .orderBy(desc(validationIssues.severity));
}

export async function getBatchIssues(batchId: number, severity?: string): Promise<ValidationIssue[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (severity) {
    return db.select().from(validationIssues)
      .where(and(
        eq(validationIssues.batchId, batchId),
        eq(validationIssues.severity, severity as any)
      ))
      .orderBy(desc(validationIssues.createdAt));
  }
  
  return db.select().from(validationIssues)
    .where(eq(validationIssues.batchId, batchId))
    .orderBy(desc(validationIssues.severity));
}

export async function resolveValidationIssue(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(validationIssues).set({
    isResolved: true,
    resolvedBy: userId,
    resolvedAt: new Date()
  }).where(eq(validationIssues.id, id));
}

export async function getBatchIssueStats(batchId: number) {
  const db = await getDb();
  if (!db) return { total: 0, error: 0, warning: 0, info: 0, resolved: 0 };
  
  const stats = await db.select({
    severity: validationIssues.severity,
    count: count()
  }).from(validationIssues)
    .where(eq(validationIssues.batchId, batchId))
    .groupBy(validationIssues.severity);
  
  const resolvedCount = await db.select({ count: count() })
    .from(validationIssues)
    .where(and(
      eq(validationIssues.batchId, batchId),
      eq(validationIssues.isResolved, true)
    ));
  
  const result = { total: 0, error: 0, warning: 0, info: 0, resolved: resolvedCount[0]?.count ?? 0 };
  stats.forEach(s => {
    result[s.severity as keyof typeof result] = s.count;
    result.total += s.count;
  });
  return result;
}

// ============ AUDIT LOG FUNCTIONS ============
export async function createAuditLog(log: InsertAuditLog): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(log);
}

export async function getAuditLogs(options: {
  userId?: number;
  batchId?: number;
  recordId?: number;
  limit?: number;
}): Promise<AuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(auditLogs);
  
  if (options.userId) {
    query = query.where(eq(auditLogs.userId, options.userId)) as any;
  }
  if (options.batchId) {
    query = query.where(eq(auditLogs.batchId, options.batchId)) as any;
  }
  if (options.recordId) {
    query = query.where(eq(auditLogs.recordId, options.recordId)) as any;
  }
  
  return query.orderBy(desc(auditLogs.createdAt)).limit(options.limit ?? 100);
}

// ============ PROCESSING JOB FUNCTIONS ============
export async function createProcessingJob(job: InsertProcessingJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(processingJobs).values(job);
  return result[0].insertId;
}

export async function getProcessingJob(id: number): Promise<ProcessingJob | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(processingJobs).where(eq(processingJobs.id, id)).limit(1);
  return result[0];
}

export async function updateProcessingJob(id: number, updates: Partial<InsertProcessingJob>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(processingJobs).set(updates).where(eq(processingJobs.id, id));
}

export async function getBatchJobs(batchId: number): Promise<ProcessingJob[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processingJobs)
    .where(eq(processingJobs.batchId, batchId))
    .orderBy(desc(processingJobs.createdAt));
}

export async function getActiveJobs(userId: number): Promise<ProcessingJob[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(processingJobs)
    .where(and(
      eq(processingJobs.userId, userId),
      inArray(processingJobs.status, ['queued', 'processing'])
    ))
    .orderBy(desc(processingJobs.createdAt));
}

// ============ API KEY FUNCTIONS ============
export async function createApiKey(key: InsertApiKey): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(apiKeys).values(key);
  return result[0].insertId;
}

export async function getUserApiKeys(userId: number): Promise<ApiKey[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function getApiKeyByPrefix(prefix: string): Promise<ApiKey | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(apiKeys)
    .where(and(
      eq(apiKeys.keyPrefix, prefix),
      eq(apiKeys.isActive, true)
    ))
    .limit(1);
  return result[0];
}

export async function deactivateApiKey(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id));
}

export async function updateApiKeyLastUsed(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
}

// ============ DASHBOARD STATS ============
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get batch stats
  const batchStats = await getBatchStats(userId);
  
  // Get total records processed
  const totalRecords = await db.select({ 
    total: sql<number>`SUM(${uploadBatches.totalRecords})`,
    cleaned: sql<number>`SUM(${uploadBatches.cleanedRecords})`,
    errors: sql<number>`SUM(${uploadBatches.errorRecords})`,
    warnings: sql<number>`SUM(${uploadBatches.warningRecords})`
  }).from(uploadBatches)
    .where(eq(uploadBatches.userId, userId));
  
  // Get recent activity
  const recentBatches = await db.select().from(uploadBatches)
    .where(eq(uploadBatches.userId, userId))
    .orderBy(desc(uploadBatches.createdAt))
    .limit(5);
  
  return {
    batches: batchStats,
    records: totalRecords[0] ?? { total: 0, cleaned: 0, errors: 0, warnings: 0 },
    recentBatches
  };
}
