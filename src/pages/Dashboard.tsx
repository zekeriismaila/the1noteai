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
  RefreshCw,
  Menu,
  User,
  Settings,
  HelpCircle,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

interface Profile {
  full_name: string | null;
  email: string | null;
}

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
      }
      
      setProfile(data || { 
        full_name: user.user_metadata?.full_name || null, 
        email: user.email || null 
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchNotes();
    fetchProfile();
  }, [user, navigate, fetchNotes, fetchProfile]);

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

  const handleRetryProcessing = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const note = notes.find(n => n.id === noteId);
    if (!note || !user) return;
    
    try {
      // Update status back to processing
      await supabase
        .from("notes")
        .update({ status: "processing", error_message: null })
        .eq("id", noteId);
      
      // Trigger reprocessing
      await supabase.functions.invoke("process-notes", {
        body: { 
          filePath: note.file_name.includes("/") ? note.file_name : `${user.id}/${note.file_name}`,
          userId: user.id, 
          noteId 
        },
      });
      
      toast({
        title: "Reprocessing started",
        description: "Your notes are being processed again.",
      });
      
      fetchNotes();
    } catch (error) {
      console.error("Retry error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to restart processing.",
      });
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchNotes();
  };

  const getStatusBadge = (status: string, errorMessage: string | null) => {
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

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return "U";
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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    1Note
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 space-y-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      setShowUpload(true);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Upload className="w-4 h-4 mr-3" />
                    Upload Notes
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start"
                    onClick={() => {
                      setShowTools(!showTools);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <Calculator className="w-4 h-4 mr-3" />
                    Calculator & Tools
                  </Button>
                  <hr className="my-4" />
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sign Out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>

            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">1Note</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Engineering Mathematics I</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowTools(!showTools)}
              className={`hidden md:flex ${showTools ? "bg-accent text-accent-foreground" : ""}`}
              title="Toggle Tools"
            >
              <Calculator className="w-5 h-5" />
            </Button>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
                    {profile?.full_name || profile?.email || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile?.full_name || "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground truncate">
                      {profile?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowTools(!showTools)}>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculator & Tools
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help & Support
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {/* Welcome Section */}
          {notes.length === 0 && !showUpload && (
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border">
              <h2 className="text-xl font-semibold mb-2">
                Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}! 👋
              </h2>
              <p className="text-muted-foreground mb-4">
                Upload your lecture notes to get started with AI-powered math tutoring.
              </p>
              <Button onClick={() => setShowUpload(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First Note
              </Button>
            </div>
          )}

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
                    size="icon"
                    onClick={() => setShowUpload(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </CardContent>
            </Card>
          ) : notes.length > 0 && (
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
          {notes.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Notes</h2>
              
              <div className="grid gap-4">
                {notes.map((note) => (
                  <Card 
                    key={note.id} 
                    className={`hover:shadow-md transition-shadow ${note.status === "ready" ? "cursor-pointer" : ""}`}
                    onClick={() => note.status === "ready" && navigate(`/solver/${note.id}`)}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-secondary-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{note.file_name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(note.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                          {note.error_message && (
                            <p className="text-sm text-destructive mt-1 truncate">
                              {note.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {getStatusBadge(note.status, note.error_message)}
                        
                        {note.status === "ready" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/solver/${note.id}`);
                            }}
                            className="hidden sm:flex"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Study
                          </Button>
                        )}
                        
                        {note.status === "error" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleRetryProcessing(note.id, e)}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
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
            </div>
          )}

          {/* Empty State */}
          {notes.length === 0 && !showUpload && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No notes uploaded yet.<br />
                  Upload your lecture notes to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Tools Panel */}
        {showTools && (
          <aside className="w-80 border-l bg-card p-4 overflow-y-auto max-h-[calc(100vh-73px)] sticky top-[73px] hidden md:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Tools</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowTools(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <ToolsPanel />
          </aside>
        )}
      </div>

      {/* Mobile Tools Sheet */}
      <Sheet open={showTools && typeof window !== "undefined" && window.innerWidth < 768} onOpenChange={setShowTools}>
        <SheetContent side="right" className="w-[320px] p-4">
          <SheetHeader>
            <SheetTitle>Tools</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ToolsPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
