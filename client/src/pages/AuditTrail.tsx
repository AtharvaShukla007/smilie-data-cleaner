import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Upload, 
  FileCheck, 
  Download, 
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  History,
  Key
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function AuditTrail() {
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");

  const { data: batches } = trpc.batches.list.useQuery({ limit: 50 });
  const { data: auditLogs, isLoading } = trpc.audit.list.useQuery({
    batchId: selectedBatchId === "all" ? undefined : parseInt(selectedBatchId),
    limit: 100
  });

  const getActionIcon = (action: string) => {
    const icons: Record<string, any> = {
      upload: Upload,
      clean: FileCheck,
      export: Download,
      delete: Trash2,
      update: Edit,
      approve: CheckCircle2,
      reject: XCircle,
      create: Key,
      revoke: XCircle
    };
    return icons[action] || History;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      upload: "text-blue-600 bg-blue-50",
      clean: "text-green-600 bg-green-50",
      export: "text-purple-600 bg-purple-50",
      delete: "text-red-600 bg-red-50",
      update: "text-yellow-600 bg-yellow-50",
      approve: "text-green-600 bg-green-50",
      reject: "text-red-600 bg-red-50",
      create: "text-blue-600 bg-blue-50",
      revoke: "text-red-600 bg-red-50"
    };
    return colors[action] || "text-gray-600 bg-gray-50";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="text-muted-foreground">
          Track all data transformations and user actions with timestamps
        </p>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Filter by batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches?.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Complete history of all operations performed
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !auditLogs || auditLogs.length === 0 ? (
            <div className="p-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => {
                    const Icon = getActionIcon(log.action);
                    const colorClass = getActionColor(log.action);
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium capitalize">{log.entityType}</p>
                            {log.entityId && (
                              <p className="text-xs text-muted-foreground">ID: {log.entityId}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          {log.newValue && (
                            <div className="text-sm">
                              {Object.entries(log.newValue as Record<string, unknown>).slice(0, 3).map(([key, value]) => (
                                <p key={key} className="truncate">
                                  <span className="text-muted-foreground">{key}:</span>{" "}
                                  <span>{String(value)}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{format(new Date(log.createdAt), "MMM d, yyyy")}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.createdAt), "HH:mm:ss")}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {auditLogs && auditLogs.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(l => l.action === "upload").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Uploads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <FileCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(l => l.action === "clean").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Cleaning Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Download className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(l => l.action === "export").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Exports</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <Edit className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {auditLogs.filter(l => l.action === "update" || l.action === "approve" || l.action === "reject").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Modifications</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
