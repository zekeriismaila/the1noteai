import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  MessageSquare, 
  FileText, 
  Loader2,
  Download,
  Eye
} from "lucide-react";
import MathRenderer from "@/components/MathRenderer";

interface Note {
  id: string;
  file_name: string;
  file_url: string;
  processed_content: string | null;
  original_content: string | null;
  status: string;
}

interface NoteViewerProps {
  noteId: string;
  open: boolean;
  onClose: () => void;
}

export default function NoteViewer({ noteId, open, onClose }: NoteViewerProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("processed");
  const navigate = useNavigate();

  useEffect(() => {
    if (open && noteId) {
      fetchNote();
    }
  }, [open, noteId]);

  const fetchNote = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (error) throw error;
      setNote(data);
    } catch (error) {
      console.error("Error fetching note:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!note?.file_url) return;
    
    try {
      const { data, error } = await supabase.storage
        .from("notes")
        .download(note.file_url);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = note.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleStudy = () => {
    onClose();
    navigate(`/solver/${noteId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <span className="truncate max-w-[300px]">{note?.file_name || "Loading..."}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button size="sm" onClick={handleStudy}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Study with AI
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : note?.status !== "ready" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-warning mb-4" />
            <h3 className="font-semibold text-lg mb-2">Still Processing</h3>
            <p className="text-muted-foreground max-w-md">
              This note is still being processed. Please check back in a moment.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-6 border-b">
                <TabsList className="grid w-full max-w-[300px] grid-cols-2">
                  <TabsTrigger value="processed">Processed</TabsTrigger>
                  <TabsTrigger value="original">Original Text</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="processed" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-6 prose prose-slate dark:prose-invert max-w-none">
                    {note?.processed_content ? (
                      <MathRenderer content={note.processed_content} />
                    ) : (
                      <p className="text-muted-foreground text-center">
                        No processed content available.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="original" className="flex-1 overflow-hidden m-0">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    {note?.original_content ? (
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                        {note.original_content}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground text-center">
                        Original text extraction not available.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
