import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface FileUploadProps {
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Invalid file type. Please upload PDF, DOC, DOCX, PPT, or PPTX files.";
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
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);

    try {
      // Generate unique file path
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get the file URL
      const { data: urlData } = supabase.storage
        .from("notes")
        .getPublicUrl(filePath);

      // Create database record with processing status
      const { data: noteData, error: dbError } = await supabase.from("notes").insert({
        user_id: user.id,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        file_url: urlData.publicUrl,
        status: "processing",
      }).select().single();

      if (dbError) throw dbError;

      toast({
        title: "Upload successful",
        description: "Your notes are being processed. This may take a moment.",
      });

      // Trigger processing via edge function
      supabase.functions.invoke("process-notes", {
        body: { filePath, userId: user.id, noteId: noteData.id },
      }).catch((err) => {
        console.error("Processing trigger error:", err);
      });

      setSelectedFile(null);
      onUploadComplete();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileTypeLabel = (type: string) => {
    if (type.includes("pdf")) return "PDF";
    if (type.includes("word") || type.includes("document")) return "DOC";
    if (type.includes("presentation") || type.includes("powerpoint")) return "PPT";
    return "FILE";
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`upload-zone cursor-pointer ${dragActive ? "active" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="font-medium">
          Drag and drop your file here, or click to browse
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          PDF, DOC, DOCX, PPT, PPTX • Max 50MB
        </p>
      </div>

      {/* Selected File */}
      {selectedFile && (
        <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-sm">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {getFileTypeLabel(selectedFile.type)} • {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
