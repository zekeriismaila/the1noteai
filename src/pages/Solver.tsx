import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  ArrowLeft, 
  Send, 
  Loader2, 
  Calculator,
  FileText,
  MessageSquare
} from "lucide-react";
import ToolsPanel from "@/components/ToolsPanel";
import MathRenderer from "@/components/MathRenderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Note {
  id: string;
  file_name: string;
  processed_content: string | null;
  status: string;
}

export default function Solver() {
  const { noteId } = useParams();
  const [note, setNote] = useState<Note | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showTools, setShowTools] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchNoteAndMessages();
  }, [user, noteId, navigate]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const fetchNoteAndMessages = async () => {
    try {
      // Fetch note
      const { data: noteData, error: noteError } = await supabase
        .from("notes")
        .select("*")
        .eq("id", noteId)
        .single();

      if (noteError) throw noteError;
      setNote(noteData);

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("note_id", noteId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages((messagesData || []).map(m => ({
        ...m,
        role: m.role as "user" | "assistant"
      })));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error loading notes",
        description: "Please try again.",
      });
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || !note) return;

    const userMessage = input.trim();
    setInput("");
    setIsSending(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Save user message
      const { data: savedUserMsg, error: userMsgError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          note_id: noteId,
          role: "user",
          content: userMessage,
        })
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Update with actual message
      setMessages(prev => prev.map(m => 
        m.id === tempUserMsg.id ? { ...savedUserMsg, role: savedUserMsg.role as "user" | "assistant" } : m
      ));

      // Call AI for response
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("math-solver", {
        body: {
          message: userMessage,
          noteContent: note.processed_content,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
      });

      if (aiError) throw aiError;

      // Save and display AI response
      const { data: savedAiMsg, error: aiMsgError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          note_id: noteId,
          role: "assistant",
          content: aiResponse.response,
        })
        .select()
        .single();

      if (aiMsgError) throw aiMsgError;
      setMessages(prev => [...prev, { ...savedAiMsg, role: savedAiMsg.role as "user" | "assistant" }]);

    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get response. Please try again.",
      });
      // Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card flex-shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg truncate max-w-[200px] md:max-w-none">
                {note?.file_name}
              </h1>
              <p className="text-xs text-muted-foreground">Math Solver</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowTools(!showTools)}
            className={showTools ? "bg-accent text-accent-foreground" : ""}
          >
            <Calculator className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Start Learning</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Ask questions about your lecture notes, request step-by-step solutions, 
                    or explore mathematical concepts. I'll use only your uploaded notes as context.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {[
                      "Solve a limit problem",
                      "Explain differentiation",
                      "Show integration steps",
                      "Help with differential equations",
                    ].map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => setInput(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] ${
                        message.role === "user"
                          ? "chat-message-user"
                          : "chat-message-assistant"
                      }`}
                    >
                      <MathRenderer content={message.content} />
                    </div>
                  </div>
                ))
              )}
              
              {isSending && (
                <div className="flex justify-start">
                  <div className="chat-message-assistant flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
              
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t bg-card p-4 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your notes, request solutions, or explore concepts..."
                disabled={isSending}
                className="flex-1"
              />
              <Button type="submit" disabled={isSending || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </main>

        {/* Tools Panel */}
        {showTools && (
          <aside className="w-80 border-l bg-card p-4 overflow-y-auto flex-shrink-0">
            <ToolsPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
