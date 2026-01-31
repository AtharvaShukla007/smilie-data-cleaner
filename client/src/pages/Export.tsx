import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Download, 
  FileSpreadsheet, 
  Loader2,
  CheckCircle2,
  ExternalLink
} from "lucide-react";

export default function Export() {
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const { data: batches } = trpc.batches.list.useQuery({ limit: 50 });
  const { data: batch } = trpc.batches.get.useQuery(
    { id: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );
  const { data: recordStats } = trpc.records.stats.useQuery(
    { batchId: selectedBatchId! },
    { enabled: !!selectedBatchId }
  );

  const exportMutation = trpc.export.generate.useMutation({
    onSuccess: (data) => {
      setExportUrl(data.url);
      toast.success(`Export ready! ${data.recordCount} records exported.`);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    }
  });

  const handleExport = () => {
    if (!selectedBatchId) return;
    
    exportMutation.mutate({
      batchId: selectedBatchId,
      format,
      includeOriginal,
      onlyApproved
    });
  };

  const completedBatches = batches?.filter(b => b.status === "completed") || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Export Data</h1>
        <p className="text-muted-foreground">
          Export cleaned datasets ready for upload to logistics systems
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Export Configuration</CardTitle>
            <CardDescription>
              Select a batch and configure export options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Batch Selection */}
            <div className="space-y-2">
              <Label>Select Batch</Label>
              <Select 
                value={selectedBatchId?.toString() || ""} 
                onValueChange={(v) => {
                  setSelectedBatchId(parseInt(v));
                  setExportUrl(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a completed batch" />
                </SelectTrigger>
                <SelectContent>
                  {completedBatches.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No completed batches available
                    </div>
                  ) : (
                    completedBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id.toString()}>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>{b.fileName}</span>
                          <Badge variant="outline" className="ml-2">
                            {b.cleanedRecords} cleaned
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={format} onValueChange={(v: "csv" | "xlsx") => setFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">.csv</Badge>
                      <span>Comma-separated values</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="xlsx">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">.xlsx</Badge>
                      <span>Excel workbook</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Original Data</Label>
                  <p className="text-xs text-muted-foreground">
                    Add original values alongside cleaned data
                  </p>
                </div>
                <Switch checked={includeOriginal} onCheckedChange={setIncludeOriginal} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Only Approved Records</Label>
                  <p className="text-xs text-muted-foreground">
                    Export only manually approved records
                  </p>
                </div>
                <Switch checked={onlyApproved} onCheckedChange={setOnlyApproved} />
              </div>
            </div>

            {/* Export Button */}
            <Button 
              onClick={handleExport}
              disabled={!selectedBatchId || exportMutation.isPending}
              className="w-full"
              size="lg"
            >
              {exportMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Export...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Export
                </>
              )}
            </Button>

            {/* Download Link */}
            {exportUrl && (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Export Ready!</span>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batch Preview */}
        <div className="space-y-6">
          {selectedBatchId && batch && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Batch Summary</CardTitle>
                  <CardDescription>{batch.fileName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Records</p>
                        <p className="text-2xl font-bold">{batch.totalRecords}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cleaned</p>
                        <p className="text-2xl font-bold text-green-600">{batch.cleanedRecords}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Errors</p>
                        <p className="text-2xl font-bold text-red-600">{batch.errorRecords}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Warnings</p>
                        <p className="text-2xl font-bold text-yellow-600">{batch.warningRecords}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Region</p>
                      <Badge variant="outline">{batch.region || "Singapore"}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {recordStats && (
                <Card>
                  <CardHeader>
                    <CardTitle>Record Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Cleaned</span>
                        <Badge variant="outline" className="text-green-600">{recordStats.cleaned}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Approved</span>
                        <Badge variant="outline" className="text-blue-600">{recordStats.approved}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Flagged</span>
                        <Badge variant="outline" className="text-yellow-600">{recordStats.flagged}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Rejected</span>
                        <Badge variant="outline" className="text-red-600">{recordStats.rejected}</Badge>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        {onlyApproved 
                          ? `${recordStats.approved + recordStats.cleaned} records will be exported`
                          : `${recordStats.total - recordStats.rejected} records will be exported`
                        }
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Export Format Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Export Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Standard export includes:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>name</li>
                  <li>phone</li>
                  <li>email</li>
                  <li>address_line_1</li>
                  <li>address_line_2</li>
                  <li>city</li>
                  <li>state</li>
                  <li>postal_code</li>
                  <li>country</li>
                  <li>status</li>
                  <li>quality_score</li>
                </ul>
                {includeOriginal && (
                  <p className="text-xs text-primary mt-2">
                    + Original values will be included
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
