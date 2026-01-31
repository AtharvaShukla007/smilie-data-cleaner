import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search,
  Filter,
  Edit,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";
import { useLocation, useSearch } from "wouter";

export default function Review() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const batchIdParam = params.get("batch");
  
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(
    batchIdParam ? parseInt(batchIdParam) : null
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: batches } = trpc.batches.list.useQuery({ limit: 50 });
  const { data: records, isLoading: recordsLoading, refetch: refetchRecords } = trpc.records.list.useQuery(
    { 
      batchId: selectedBatchId!, 
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: pageSize,
      offset: page * pageSize
    },
    { enabled: !!selectedBatchId }
  );
  const { data: recordStats } = trpc.records.stats.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );
  const { data: batch } = trpc.batches.get.useQuery(
    { id: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const approveMutation = trpc.records.approve.useMutation({
    onSuccess: () => {
      toast.success("Record approved");
      refetchRecords();
    }
  });

  const rejectMutation = trpc.records.reject.useMutation({
    onSuccess: () => {
      toast.success("Record rejected");
      refetchRecords();
    }
  });

  const bulkApproveMutation = trpc.records.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`Approved ${data.count} records`);
      setSelectedRecords([]);
      refetchRecords();
    }
  });

  const bulkRejectMutation = trpc.records.bulkReject.useMutation({
    onSuccess: (data) => {
      toast.success(`Rejected ${data.count} records`);
      setSelectedRecords([]);
      refetchRecords();
    }
  });

  const acceptAllCleanedMutation = trpc.records.acceptAllCleaned.useMutation({
    onSuccess: (data) => {
      if (data.count > 0) {
        toast.success(`Accepted all ${data.count} cleaned records`);
      } else {
        toast.info("No cleaned records to accept");
      }
      setSelectedRecords([]);
      refetchRecords();
    }
  });

  const updateMutation = trpc.records.update.useMutation({
    onSuccess: () => {
      toast.success("Record updated");
      setEditingRecord(null);
      refetchRecords();
    }
  });

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (!searchQuery) return records;
    
    const query = searchQuery.toLowerCase();
    return records.filter(r => 
      r.name?.toLowerCase().includes(query) ||
      r.cleanedName?.toLowerCase().includes(query) ||
      r.phone?.includes(query) ||
      r.cleanedPhone?.includes(query) ||
      r.email?.toLowerCase().includes(query) ||
      r.postalCode?.includes(query) ||
      r.cleanedPostalCode?.includes(query)
    );
  }, [records, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedRecords.length === filteredRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredRecords.map(r => r.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedRecords(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Review & Clean</h1>
        <p className="text-muted-foreground">
          Review flagged records and approve or reject data entries
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
            onValueChange={(v) => {
              setSelectedBatchId(parseInt(v));
              setPage(0);
              setSelectedRecords([]);
            }}
          >
            <SelectTrigger className="w-full md:w-[400px]">
              <SelectValue placeholder="Select a batch to review" />
            </SelectTrigger>
            <SelectContent>
              {batches?.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span>{b.fileName}</span>
                    <Badge variant="outline" className="ml-2">
                      {b.totalRecords} records
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
                <div className="text-2xl font-bold">{recordStats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{recordStats?.cleaned || 0}</div>
                <p className="text-xs text-muted-foreground">Cleaned</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{recordStats?.flagged || 0}</div>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{recordStats?.approved || 0}</div>
                <p className="text-xs text-muted-foreground">Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{recordStats?.rejected || 0}</div>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Actions */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full md:w-[250px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cleaned">Cleaned</SelectItem>
                      <SelectItem value="flagged">Flagged</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  {(recordStats?.cleaned || 0) > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => acceptAllCleanedMutation.mutate({ batchId: selectedBatchId! })}
                      disabled={acceptAllCleanedMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {acceptAllCleanedMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Accept All Cleaned ({recordStats?.cleaned || 0})
                    </Button>
                  )}
                  {selectedRecords.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => bulkApproveMutation.mutate({ ids: selectedRecords })}
                        disabled={bulkApproveMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve ({selectedRecords.length})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => bulkRejectMutation.mutate({ ids: selectedRecords })}
                        disabled={bulkRejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject ({selectedRecords.length})
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <Card>
            <CardContent className="p-0">
              {recordsLoading ? (
                <div className="p-8 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No records found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={selectedRecords.length === filteredRecords.length && filteredRecords.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Postal Code</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedRecords.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{record.cleanedName || record.name || "-"}</p>
                              {record.name !== record.cleanedName && record.name && (
                                <p className="text-xs text-muted-foreground line-through">{record.name}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{record.cleanedPhone || record.phone || "-"}</p>
                              {record.phone !== record.cleanedPhone && record.phone && (
                                <p className="text-xs text-muted-foreground line-through">{record.phone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{record.cleanedPostalCode || record.postalCode || "-"}</p>
                              {record.postalCode !== record.cleanedPostalCode && record.postalCode && (
                                <p className="text-xs text-muted-foreground line-through">{record.postalCode}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={record.status} />
                          </TableCell>
                          <TableCell>
                            <QualityBadge score={record.qualityScore || 0} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingRecord(record)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingRecord(record)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {record.status !== "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => approveMutation.mutate({ id: record.id })}
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              {record.status !== "rejected" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => rejectMutation.mutate({ id: record.id })}
                                  disabled={rejectMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, recordStats?.total || 0)} of {recordStats?.total || 0} records
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * pageSize >= (recordStats?.total || 0)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* View Record Dialog */}
      <Dialog open={!!viewingRecord} onOpenChange={() => setViewingRecord(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Details</DialogTitle>
            <DialogDescription>
              View original and cleaned data for this record
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">Original Data</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {viewingRecord.name || "-"}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {viewingRecord.phone || "-"}</p>
                    <p><span className="text-muted-foreground">Email:</span> {viewingRecord.email || "-"}</p>
                    <p><span className="text-muted-foreground">Address:</span> {viewingRecord.addressLine1 || "-"}</p>
                    <p><span className="text-muted-foreground">City:</span> {viewingRecord.city || "-"}</p>
                    <p><span className="text-muted-foreground">Postal:</span> {viewingRecord.postalCode || "-"}</p>
                    <p><span className="text-muted-foreground">Country:</span> {viewingRecord.country || "-"}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2 text-sm text-muted-foreground">Cleaned Data</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {viewingRecord.cleanedName || "-"}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {viewingRecord.cleanedPhone || "-"}</p>
                    <p><span className="text-muted-foreground">Email:</span> {viewingRecord.cleanedEmail || "-"}</p>
                    <p><span className="text-muted-foreground">Address:</span> {viewingRecord.cleanedAddressLine1 || "-"}</p>
                    <p><span className="text-muted-foreground">City:</span> {viewingRecord.cleanedCity || "-"}</p>
                    <p><span className="text-muted-foreground">Postal:</span> {viewingRecord.cleanedPostalCode || "-"}</p>
                    <p><span className="text-muted-foreground">Country:</span> {viewingRecord.cleanedCountry || "-"}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t">
                <StatusBadge status={viewingRecord.status} />
                <QualityBadge score={viewingRecord.qualityScore || 0} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>
              Manually correct the cleaned data
            </DialogDescription>
          </DialogHeader>
          {editingRecord && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={editingRecord.cleanedName || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, cleanedName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={editingRecord.cleanedPhone || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, cleanedPhone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={editingRecord.cleanedEmail || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, cleanedEmail: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Address Line 1</Label>
                <Input
                  value={editingRecord.cleanedAddressLine1 || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, cleanedAddressLine1: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>City</Label>
                  <Input
                    value={editingRecord.cleanedCity || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cleanedCity: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={editingRecord.cleanedPostalCode || ""}
                    onChange={(e) => setEditingRecord({ ...editingRecord, cleanedPostalCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Country</Label>
                <Input
                  value={editingRecord.cleanedCountry || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, cleanedCountry: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate({
                id: editingRecord.id,
                cleanedName: editingRecord.cleanedName,
                cleanedPhone: editingRecord.cleanedPhone,
                cleanedEmail: editingRecord.cleanedEmail,
                cleanedAddressLine1: editingRecord.cleanedAddressLine1,
                cleanedCity: editingRecord.cleanedCity,
                cleanedPostalCode: editingRecord.cleanedPostalCode,
                cleanedCountry: editingRecord.cleanedCountry
              })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    pending: { variant: "secondary", icon: null },
    cleaned: { variant: "outline", icon: CheckCircle2 },
    flagged: { variant: "destructive", icon: AlertTriangle },
    approved: { variant: "default", icon: CheckCircle2 },
    rejected: { variant: "destructive", icon: XCircle },
  };

  const { variant, icon: Icon } = config[status] || config.pending;

  return (
    <Badge variant={variant} className="gap-1">
      {Icon && <Icon className="h-3 w-3" />}
      {status}
    </Badge>
  );
}

function QualityBadge({ score }: { score: number }) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let color = "text-muted-foreground";

  if (score >= 80) {
    color = "text-green-600";
  } else if (score >= 60) {
    color = "text-yellow-600";
  } else {
    color = "text-red-600";
  }

  return (
    <Badge variant={variant} className={`${color} gap-1`}>
      {score}%
    </Badge>
  );
}
