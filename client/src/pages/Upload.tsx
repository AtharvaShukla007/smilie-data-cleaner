import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Upload as UploadIcon, 
  FileSpreadsheet, 
  X, 
  Loader2,
  CheckCircle2,
  Sparkles,
  Globe
} from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Upload() {
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [region, setRegion] = useState("singapore");
  const [useLLM, setUseLLM] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBatchId, setUploadedBatchId] = useState<number | null>(null);

  const { data: regions } = trpc.dashboard.regions.useQuery();
  const { data: batches, refetch: refetchBatches } = trpc.batches.list.useQuery({ limit: 10 });
  
  const uploadMutation = trpc.batches.upload.useMutation({
    onSuccess: (data) => {
      setUploadedBatchId(data.batchId);
      toast.success(`Uploaded ${data.recordCount} records successfully`);
      refetchBatches();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    }
  });

  const cleanMutation = trpc.processing.clean.useMutation({
    onSuccess: (data) => {
      toast.success(`Cleaned ${data.cleanedCount} records. ${data.errorCount} errors, ${data.warningCount} warnings.`);
      setIsUploading(false);
      setFile(null);
      setUploadProgress(0);
      setUploadedBatchId(null);
      refetchBatches();
      setLocation(`/review?batch=${uploadedBatchId}`);
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
      setIsUploading(false);
    }
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
    } else {
      toast.error("Please upload a CSV or Excel file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
    } else {
      toast.error("Please upload a CSV or Excel file");
    }
  };

  const isValidFile = (file: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    return validTypes.includes(file.type) || file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        setUploadProgress(30);

        // Upload file
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          region,
          fileType: file.name.endsWith(".csv") ? "csv" : "xlsx"
        });

        setUploadProgress(60);
        setUploadedBatchId(result.batchId);

        // Start cleaning
        await cleanMutation.mutateAsync({
          batchId: result.batchId,
          useLLM
        });

        setUploadProgress(100);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
    }
  };

  const regionOptions = regions?.supported || ["singapore", "malaysia", "indonesia", "thailand", "vietnam", "philippines", "australia", "usa", "uk", "germany", "france", "international"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
        <p className="text-muted-foreground">
          Upload CSV or Excel files containing address and customer data for cleaning
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dropzone */}
          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>
                Drag and drop your file or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                  ${file ? "bg-accent/50" : ""}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFile(null)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-16 w-16 rounded-full bg-muted mx-auto flex items-center justify-center">
                      <UploadIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Drop your file here</p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Browse Files
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              {isUploading && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Settings</CardTitle>
              <CardDescription>
                Configure how your data should be cleaned and validated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Target Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the region for address validation rules
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI-Powered Enhancement
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use LLM to intelligently correct ambiguous addresses
                  </p>
                </div>
                <Switch checked={useLLM} onCheckedChange={setUseLLM} />
              </div>

              <Button 
                onClick={handleUpload} 
                disabled={!file || isUploading}
                className="w-full"
                size="lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Uploads */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>Your latest batch uploads</CardDescription>
            </CardHeader>
            <CardContent>
              {!batches || batches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No uploads yet
                </p>
              ) : (
                <div className="space-y-3">
                  {batches.slice(0, 5).map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/review?batch=${batch.id}`)}
                    >
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{batch.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {batch.totalRecords} records
                        </p>
                      </div>
                      <Badge variant={batch.status === "completed" ? "outline" : "secondary"} className="shrink-0">
                        {batch.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : null}
                        {batch.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supported Formats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">.csv</Badge>
                  <span className="text-muted-foreground">Comma-separated values</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">.xlsx</Badge>
                  <span className="text-muted-foreground">Excel workbook</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">.xls</Badge>
                  <span className="text-muted-foreground">Legacy Excel</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Files should contain columns for name, phone, email, address, city, state, postal code, and country.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
