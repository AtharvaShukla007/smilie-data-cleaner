import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info,
  CheckCircle2,
  Filter
} from "lucide-react";
import { useLocation } from "wouter";

export default function Issues() {
  const [, setLocation] = useLocation();
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: batches } = trpc.batches.list.useQuery({ limit: 50 });
  const { data: issues, isLoading, refetch } = trpc.issues.list.useQuery(
    { 
      batchId: selectedBatchId!, 
      severity: severityFilter === "all" ? undefined : severityFilter 
    },
    { enabled: !!selectedBatchId }
  );
  const { data: issueStats } = trpc.issues.stats.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const resolveMutation = trpc.issues.resolve.useMutation({
    onSuccess: () => {
      toast.success("Issue resolved");
      refetch();
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Validation Issues</h1>
        <p className="text-muted-foreground">
          Review and resolve data quality issues found during cleaning
        </p>
      </div>

      {/* Batch Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedBatchId?.toString() || ""} 
            onValueChange={(v) => setSelectedBatchId(parseInt(v))}
          >
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Select a batch to view issues" />
            </SelectTrigger>
            <SelectContent>
              {batches?.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span>{b.fileName}</span>
                    <Badge variant="outline" className="ml-2">
                      {b.errorRecords || 0} errors
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedBatchId && (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{issueStats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">Total Issues</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div className="text-2xl font-bold text-red-600">{issueStats?.error || 0}</div>
                </div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div className="text-2xl font-bold text-yellow-600">{issueStats?.warning || 0}</div>
                </div>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-600">{issueStats?.info || 0}</div>
                </div>
                <p className="text-xs text-muted-foreground">Info</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div className="text-2xl font-bold text-green-600">{issueStats?.resolved || 0}</div>
                </div>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
          </div>

          {/* Filter */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="error">Errors Only</SelectItem>
                    <SelectItem value="warning">Warnings Only</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Issues Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !issues || issues.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No issues found for this batch
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Severity</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Issue Type</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Original Value</TableHead>
                        <TableHead>Suggested Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell>
                            <SeverityBadge severity={issue.severity} />
                          </TableCell>
                          <TableCell className="font-medium">{issue.field}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{issue.issueType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {issue.message}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[150px] truncate">
                            {issue.originalValue || "-"}
                          </TableCell>
                          <TableCell className="text-primary max-w-[150px] truncate">
                            {issue.suggestedValue || "-"}
                          </TableCell>
                          <TableCell>
                            {issue.isResolved ? (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Open</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!issue.isResolved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resolveMutation.mutate({ id: issue.id })}
                                disabled={resolveMutation.isPending}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Resolve
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/review?batch=${selectedBatchId}`)}
                            >
                              View Record
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color: string }> = {
    error: { variant: "destructive", icon: AlertCircle, color: "text-red-600" },
    warning: { variant: "outline", icon: AlertTriangle, color: "text-yellow-600" },
    info: { variant: "secondary", icon: Info, color: "text-blue-600" },
  };

  const { variant, icon: Icon, color } = config[severity] || config.info;

  return (
    <Badge variant={variant} className={`gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  );
}
