import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as XLSX from "xlsx";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";
import { notifyOwner } from "./_core/notification";
import {
  createUploadBatch, getUploadBatch, getUserBatches, updateUploadBatch, getBatchStats,
  createDataRecords, getDataRecord, getBatchRecords, updateDataRecord, updateDataRecordsBulk,
  getRecordsNeedingReview, getBatchRecordStats,
  createValidationIssues, getRecordIssues, getBatchIssues, resolveValidationIssue, getBatchIssueStats,
  createAuditLog, getAuditLogs,
  createProcessingJob, getProcessingJob, updateProcessingJob, getBatchJobs, getActiveJobs,
  createApiKey, getUserApiKeys, getApiKeyByPrefix, deactivateApiKey,
  getDashboardStats
} from "./db";
import { 
  mapRawDataToRecord, cleanRecord, enhanceWithLLM, 
  getSupportedRegions, getRegionConfigs 
} from "./dataCleaningEngine";
import { InsertDataRecord, InsertValidationIssue } from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ DASHBOARD ============
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardStats(ctx.user.id);
    }),
    
    regions: publicProcedure.query(() => {
      return {
        supported: getSupportedRegions(),
        configs: getRegionConfigs()
      };
    }),
  }),

  // ============ UPLOAD BATCHES ============
  batches: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getUserBatches(ctx.user.id, input?.limit ?? 50);
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getUploadBatch(input.id);
      }),
    
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getBatchStats(ctx.user.id);
    }),
    
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded
        region: z.string().default("singapore"),
        fileType: z.enum(["csv", "xlsx"]).default("csv")
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        
        // Decode base64 file
        const fileBuffer = Buffer.from(input.fileData, "base64");
        
        // Upload original file to S3
        const fileKey = `uploads/${userId}/${nanoid()}-${input.fileName}`;
        const { url: originalFileUrl } = await storagePut(fileKey, fileBuffer, 
          input.fileType === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        
        // Parse file
        let records: Record<string, string>[] = [];
        
        if (input.fileType === "csv") {
          const workbook = XLSX.read(fileBuffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        } else {
          const workbook = XLSX.read(fileBuffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        }
        
        // Create batch
        const batchId = await createUploadBatch({
          userId,
          fileName: input.fileName,
          originalFileUrl,
          fileSize: fileBuffer.length,
          totalRecords: records.length,
          status: "pending",
          region: input.region
        });
        
        // Create audit log
        await createAuditLog({
          userId,
          batchId,
          action: "upload",
          entityType: "batch",
          entityId: batchId,
          newValue: { fileName: input.fileName, recordCount: records.length, region: input.region }
        });
        
        // Map records to data records
        const dataRecordsToInsert: InsertDataRecord[] = records.map((raw, index) => 
          mapRawDataToRecord(raw, index, batchId) as InsertDataRecord
        );
        
        // Insert records
        await createDataRecords(dataRecordsToInsert);
        
        return { batchId, recordCount: records.length };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const batch = await getUploadBatch(input.id);
        if (!batch || batch.userId !== ctx.user.id) {
          throw new Error("Batch not found or unauthorized");
        }
        
        await updateUploadBatch(input.id, { status: "failed" }); // Soft delete
        
        await createAuditLog({
          userId: ctx.user.id,
          batchId: input.id,
          action: "delete",
          entityType: "batch",
          entityId: input.id
        });
        
        return { success: true };
      }),
  }),

  // ============ DATA PROCESSING ============
  processing: router({
    clean: protectedProcedure
      .input(z.object({ 
        batchId: z.number(),
        useLLM: z.boolean().default(false)
      }))
      .mutation(async ({ ctx, input }) => {
        const batch = await getUploadBatch(input.batchId);
        if (!batch || batch.userId !== ctx.user.id) {
          throw new Error("Batch not found or unauthorized");
        }
        
        // Create processing job
        const jobId = await createProcessingJob({
          batchId: input.batchId,
          userId: ctx.user.id,
          jobType: input.useLLM ? "llm_enhance" : "clean",
          status: "processing",
          totalItems: batch.totalRecords || 0,
          startedAt: new Date()
        });
        
        // Update batch status
        await updateUploadBatch(input.batchId, { status: "processing" });
        
        // Get all records
        const records = await getBatchRecords(input.batchId);
        
        // Process records
        const allIssues: InsertValidationIssue[] = [];
        const cleanedRecords: Partial<InsertDataRecord>[] = [];
        let errorCount = 0;
        let warningCount = 0;
        let cleanedCount = 0;
        
        for (const record of records) {
          const result = cleanRecord(record, batch.region || "singapore");
          cleanedRecords.push(result.record);
          
          // Update issues with actual record ID
          const issuesWithId = result.issues.map(issue => ({
            ...issue,
            recordId: record.id
          }));
          allIssues.push(...issuesWithId);
          
          if (result.issues.some(i => i.severity === "error")) {
            errorCount++;
          } else if (result.issues.some(i => i.severity === "warning")) {
            warningCount++;
          } else {
            cleanedCount++;
          }
          
          // Update record
          await updateDataRecord(record.id, result.record);
          
          // Update job progress
          await updateProcessingJob(jobId, {
            processedItems: cleanedRecords.length,
            progress: Math.round((cleanedRecords.length / records.length) * 100)
          });
        }
        
        // LLM enhancement if requested
        if (input.useLLM) {
          const recordsNeedingEnhancement = cleanedRecords.filter(r => r.needsReview);
          if (recordsNeedingEnhancement.length > 0) {
            const enhanced = await enhanceWithLLM(recordsNeedingEnhancement, batch.region || "singapore");
            
            // Update enhanced records
            for (const enhancedRecord of enhanced) {
              if (enhancedRecord.id) {
                await updateDataRecord(enhancedRecord.id, enhancedRecord);
              }
            }
          }
        }
        
        // Insert all issues
        await createValidationIssues(allIssues);
        
        // Update batch stats
        await updateUploadBatch(input.batchId, {
          status: "completed",
          cleanedRecords: cleanedCount,
          errorRecords: errorCount,
          warningRecords: warningCount,
          completedAt: new Date()
        });
        
        // Complete job
        await updateProcessingJob(jobId, {
          status: "completed",
          progress: 100,
          processedItems: records.length,
          completedAt: new Date(),
          result: { cleanedCount, errorCount, warningCount, totalIssues: allIssues.length }
        });
        
        // Create audit log
        await createAuditLog({
          userId: ctx.user.id,
          batchId: input.batchId,
          action: "clean",
          entityType: "batch",
          entityId: input.batchId,
          newValue: { cleanedCount, errorCount, warningCount, usedLLM: input.useLLM }
        });
        
        // Send notification if large batch
        if (records.length > 100) {
          await notifyOwner({
            title: "Batch Processing Complete",
            content: `Batch "${batch.fileName}" with ${records.length} records has been processed. Results: ${cleanedCount} cleaned, ${errorCount} errors, ${warningCount} warnings.`
          });
        }
        
        return { 
          jobId,
          cleanedCount, 
          errorCount, 
          warningCount, 
          totalIssues: allIssues.length 
        };
      }),
    
    jobs: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return getBatchJobs(input.batchId);
      }),
    
    activeJobs: protectedProcedure.query(async ({ ctx }) => {
      return getActiveJobs(ctx.user.id);
    }),
    
    jobStatus: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ input }) => {
        return getProcessingJob(input.jobId);
      }),
  }),

  // ============ RECORDS ============
  records: router({
    list: protectedProcedure
      .input(z.object({
        batchId: z.number(),
        status: z.string().optional(),
        needsReview: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional()
      }))
      .query(async ({ input }) => {
        return getBatchRecords(input.batchId, {
          status: input.status,
          needsReview: input.needsReview,
          limit: input.limit,
          offset: input.offset
        });
      }),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const record = await getDataRecord(input.id);
        if (!record) return null;
        
        const issues = await getRecordIssues(input.id);
        return { ...record, issues };
      }),
    
    stats: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return getBatchRecordStats(input.batchId);
      }),
    
    needingReview: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return getRecordsNeedingReview(input.batchId);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cleanedName: z.string().optional(),
        cleanedPhone: z.string().optional(),
        cleanedEmail: z.string().optional(),
        cleanedAddressLine1: z.string().optional(),
        cleanedAddressLine2: z.string().optional(),
        cleanedCity: z.string().optional(),
        cleanedState: z.string().optional(),
        cleanedPostalCode: z.string().optional(),
        cleanedCountry: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        const record = await getDataRecord(id);
        
        if (!record) throw new Error("Record not found");
        
        // Update cleaned data object
        const cleanedData = {
          name: updates.cleanedName ?? record.cleanedName ?? "",
          phone: updates.cleanedPhone ?? record.cleanedPhone ?? "",
          email: updates.cleanedEmail ?? record.cleanedEmail ?? "",
          addressLine1: updates.cleanedAddressLine1 ?? record.cleanedAddressLine1 ?? "",
          addressLine2: updates.cleanedAddressLine2 ?? record.cleanedAddressLine2 ?? "",
          city: updates.cleanedCity ?? record.cleanedCity ?? "",
          state: updates.cleanedState ?? record.cleanedState ?? "",
          postalCode: updates.cleanedPostalCode ?? record.cleanedPostalCode ?? "",
          country: updates.cleanedCountry ?? record.cleanedCountry ?? ""
        };
        
        await updateDataRecord(id, { ...updates, cleanedData });
        
        await createAuditLog({
          userId: ctx.user.id,
          batchId: record.batchId,
          recordId: id,
          action: "update",
          entityType: "record",
          entityId: id,
          previousValue: record.cleanedData as Record<string, unknown>,
          newValue: cleanedData
        });
        
        return { success: true };
      }),
    
    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const record = await getDataRecord(input.id);
        if (!record) throw new Error("Record not found");
        
        await updateDataRecord(input.id, {
          status: "approved",
          needsReview: false,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        });
        
        await createAuditLog({
          userId: ctx.user.id,
          batchId: record.batchId,
          recordId: input.id,
          action: "approve",
          entityType: "record",
          entityId: input.id
        });
        
        return { success: true };
      }),
    
    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const record = await getDataRecord(input.id);
        if (!record) throw new Error("Record not found");
        
        await updateDataRecord(input.id, {
          status: "rejected",
          needsReview: false,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        });
        
        await createAuditLog({
          userId: ctx.user.id,
          batchId: record.batchId,
          recordId: input.id,
          action: "reject",
          entityType: "record",
          entityId: input.id
        });
        
        return { success: true };
      }),
    
    bulkApprove: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await updateDataRecordsBulk(input.ids, {
          status: "approved",
          needsReview: false,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        });
        
        return { success: true, count: input.ids.length };
      }),
    
    bulkReject: protectedProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await updateDataRecordsBulk(input.ids, {
          status: "rejected",
          needsReview: false,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        });
        
        return { success: true, count: input.ids.length };
      }),
    
    acceptAllCleaned: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const batch = await getUploadBatch(input.batchId);
        if (!batch || batch.userId !== ctx.user.id) {
          throw new Error("Batch not found or unauthorized");
        }
        
        // Get all cleaned records for this batch
        const records = await getBatchRecords(input.batchId);
        const cleanedRecordIds = records
          .filter(r => r.status === "cleaned")
          .map(r => r.id);
        
        if (cleanedRecordIds.length === 0) {
          return { success: true, count: 0 };
        }
        
        // Approve all cleaned records
        await updateDataRecordsBulk(cleanedRecordIds, {
          status: "approved",
          needsReview: false,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date()
        });
        
        // Create audit log
        await createAuditLog({
          userId: ctx.user.id,
          batchId: input.batchId,
          action: "approve",
          entityType: "batch",
          entityId: input.batchId,
          newValue: { action: "accept_all_cleaned", count: cleanedRecordIds.length }
        });
        
        return { success: true, count: cleanedRecordIds.length };
      }),
  }),

  // ============ VALIDATION ISSUES ============
  issues: router({
    list: protectedProcedure
      .input(z.object({
        batchId: z.number(),
        severity: z.string().optional()
      }))
      .query(async ({ input }) => {
        return getBatchIssues(input.batchId, input.severity);
      }),
    
    stats: protectedProcedure
      .input(z.object({ batchId: z.number() }))
      .query(async ({ input }) => {
        return getBatchIssueStats(input.batchId);
      }),
    
    resolve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await resolveValidationIssue(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ AUDIT LOGS ============
  audit: router({
    list: protectedProcedure
      .input(z.object({
        batchId: z.number().optional(),
        recordId: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(async ({ ctx, input }) => {
        return getAuditLogs({
          userId: ctx.user.id,
          batchId: input.batchId,
          recordId: input.recordId,
          limit: input.limit
        });
      }),
  }),

  // ============ EXPORT ============
  export: router({
    generate: protectedProcedure
      .input(z.object({
        batchId: z.number(),
        format: z.enum(["csv", "xlsx"]).default("csv"),
        includeOriginal: z.boolean().default(false),
        onlyApproved: z.boolean().default(false)
      }))
      .mutation(async ({ ctx, input }) => {
        const batch = await getUploadBatch(input.batchId);
        if (!batch || batch.userId !== ctx.user.id) {
          throw new Error("Batch not found or unauthorized");
        }
        
        // Get records
        let records = await getBatchRecords(input.batchId);
        
        if (input.onlyApproved) {
          records = records.filter(r => r.status === "approved" || r.status === "cleaned");
        }
        
        // Prepare export data
        const exportData = records.map(record => {
          const base: Record<string, string> = {
            name: record.cleanedName || "",
            phone: record.cleanedPhone || "",
            email: record.cleanedEmail || "",
            address_line_1: record.cleanedAddressLine1 || "",
            address_line_2: record.cleanedAddressLine2 || "",
            city: record.cleanedCity || "",
            state: record.cleanedState || "",
            postal_code: record.cleanedPostalCode || "",
            country: record.cleanedCountry || "",
            status: record.status,
            quality_score: String(record.qualityScore || 0)
          };
          
          if (input.includeOriginal) {
            base.original_name = record.name || "";
            base.original_phone = record.phone || "";
            base.original_email = record.email || "";
            base.original_address = record.addressLine1 || "";
            base.original_postal_code = record.postalCode || "";
          }
          
          return base;
        });
        
        // Generate file
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cleaned Data");
        
        const buffer = XLSX.write(workbook, { 
          type: "buffer", 
          bookType: input.format === "csv" ? "csv" : "xlsx" 
        });
        
        // Upload to S3
        const fileName = `export-${batch.fileName.replace(/\.[^.]+$/, "")}-${Date.now()}.${input.format}`;
        const fileKey = `exports/${ctx.user.id}/${fileName}`;
        const { url } = await storagePut(fileKey, buffer,
          input.format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        
        // Update batch with processed file URL
        await updateUploadBatch(input.batchId, { processedFileUrl: url });
        
        // Create audit log
        await createAuditLog({
          userId: ctx.user.id,
          batchId: input.batchId,
          action: "export",
          entityType: "batch",
          entityId: input.batchId,
          newValue: { format: input.format, recordCount: records.length, fileName }
        });
        
        return { url, fileName, recordCount: records.length };
      }),
  }),

  // ============ API KEYS ============
  apiKeys: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserApiKeys(ctx.user.id);
    }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        permissions: z.array(z.string()).optional()
      }))
      .mutation(async ({ ctx, input }) => {
        const key = `sdc_${nanoid(32)}`;
        const keyPrefix = key.slice(0, 8);
        
        // Simple hash for storage (in production, use bcrypt)
        const keyHash = Buffer.from(key).toString("base64");
        
        const id = await createApiKey({
          userId: ctx.user.id,
          name: input.name,
          keyHash,
          keyPrefix,
          permissions: input.permissions || ["read", "write"]
        });
        
        await createAuditLog({
          userId: ctx.user.id,
          action: "create",
          entityType: "api_key",
          entityId: id,
          newValue: { name: input.name }
        });
        
        // Return the full key only once
        return { id, key, keyPrefix };
      }),
    
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deactivateApiKey(input.id);
        
        await createAuditLog({
          userId: ctx.user.id,
          action: "revoke",
          entityType: "api_key",
          entityId: input.id
        });
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
