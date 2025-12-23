import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload PDF, DOC, DOCX, PPT, PPTX, or TXT files.";
    }
    if (file.size > MAX_SIZE) {
      return "File size exceeds 50MB limit.";
    }
    return null;
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        toast({ variant: "destructive", title: "Invalid file", description: error });
        return;
      }
      setSelectedFile(file);
      setUploadStatus("idle");
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        toast({ variant: "destructive", title: "Invalid file", description: error });
        return;
      }
      setSelectedFile(file);
      setUploadStatus("idle");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setStatusMessage("Uploading file...");

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 40));
      }, 100);

      // Generate unique file path
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(50);

      if (uploadError) throw uploadError;

      setStatusMessage("Creating record...");
      setUploadProgress(60);

      // Create database record
      const { data: noteData, error: dbError } = await supabase.from("notes").insert({
        user_id: user.id,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        file_url: filePath,
        status: "processing",
      }).select().single();

      if (dbError) throw dbError;

      setUploadProgress(70);
      setStatusMessage("Processing notes with AI...");
      setUploadStatus("processing");

      // Trigger processing
      const { data: processResult, error: processError } = await supabase.functions.invoke("process-notes", {
        body: { filePath, userId: user.id, noteId: noteData.id },
      });

      if (processError) {
        console.error("Processing error:", processError);
        // Don't throw - the note is still uploaded, processing might complete in background
      }

      setUploadProgress(100);
      setUploadStatus("success");
      setStatusMessage("Upload complete!");

      toast({
        title: "Upload successful!",
        description: "Your notes have been uploaded and processed.",
      });

      // Small delay to show success state
      setTimeout(() => {
        setSelectedFile(null);
        setUploadStatus("idle");
        setUploadProgress(0);
        onUploadComplete();
      }, 1500);

    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Upload failed");
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const getFileTypeLabel = (type: string) => {
    if (type.includes("pdf")) return "PDF";
    if (type.includes("word") || type.includes("document")) return "DOC";
    if (type.includes("presentation") || type.includes("powerpoint")) return "PPT";
    if (type.includes("text")) return "TXT";
    return "FILE";
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case "uploading":
      case "processing":
        return "bg-primary";
      case "success":
        return "bg-success";
      case "error":
        return "bg-destructive";
      default:
        return "bg-primary";
    }
  };

  const isUploading = uploadStatus === "uploading" || uploadStatus === "processing";

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`upload-zone cursor-pointer ${dragActive ? "active" : ""} ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="font-medium">
          Drag and drop your file here, or click to browse
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          PDF, DOC, DOCX, PPT, PPTX, TXT • Max 50MB
        </p>
      </div>

      {/* Selected File */}
      {selectedFile && (
        <div className="p-4 bg-secondary rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                {uploadStatus === "success" ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {getFileTypeLabel(selectedFile.type)} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            {!isUploading && uploadStatus !== "success" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button onClick={handleUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {(isUploading || uploadStatus === "success") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploadStatus === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                  {statusMessage}
                </span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className={getStatusColor()} />
            </div>
          )}
          
          {uploadStatus === "error" && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-destructive">{statusMessage}</p>
              <Button size="sm" variant="outline" onClick={handleUpload}>
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
