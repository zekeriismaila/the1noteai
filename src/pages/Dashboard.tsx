import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Upload, 
  FileText, 
  LogOut, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Trash2,
  MessageSquare,
  Calculator,
  RefreshCw
} from "lucide-react";
import FileUpload from "@/components/FileUpload";
import ToolsPanel from "@/components/ToolsPanel";

interface Note {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showTools, setShowTools] = useState(false);
  
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchNotes();
  }, [user, navigate, fetchNotes]);

  // Poll for processing updates
  useEffect(() => {
    const hasProcessing = notes.some(n => n.status === "processing" || n.status === "uploading");
    
    if (hasProcessing) {
      const interval = setInterval(fetchNotes, 3000);
      return () => clearInterval(interval);
    }
  }, [notes, fetchNotes]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteNote = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from("notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      
      setNotes(notes.filter(n => n.id !== noteId));
      toast({
        title: "Note deleted",
        description: "The note has been removed.",
      });
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        variant: "destructive",
        title: "Error deleting note",
        description: "Please try again.",
      });
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchNotes();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="w-3 h-3 mr-1" />
            Ready
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Uploading
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">1Note</h1>
              <p className="text-xs text-muted-foreground">Engineering Mathematics I</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowTools(!showTools)}
              className={showTools ? "bg-accent text-accent-foreground" : ""}
              title="Toggle Tools"
            >
              <Calculator className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Upload Section */}
          {showUpload ? (
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Upload Lecture Notes</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload PDF, DOC, DOCX, PPT, or PPTX files. Maximum 50MB per file.
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowUpload(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-4 mb-8">
              <Button 
                onClick={() => setShowUpload(true)} 
                size="lg"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Notes
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={fetchNotes}
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Notes List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Notes</h2>
            
            {notes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No notes uploaded yet.<br />
                    Upload your lecture notes to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {notes.map((note) => (
                  <Card 
                    key={note.id} 
                    className={`hover:shadow-md transition-shadow ${note.status === "ready" ? "cursor-pointer" : ""}`}
                    onClick={() => note.status === "ready" && navigate(`/solver/${note.id}`)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                          <FileText className="w-5 h-5 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{note.file_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(note.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                          {note.error_message && (
                            <p className="text-sm text-destructive mt-1">
                              {note.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {getStatusBadge(note.status)}
                        
                        {note.status === "ready" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/solver/${note.id}`);
                            }}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Study
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDeleteNote(note.id, e)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Tools Panel */}
        {showTools && (
          <aside className="w-80 border-l bg-card p-4 overflow-y-auto max-h-[calc(100vh-73px)] sticky top-[73px]">
            <ToolsPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
