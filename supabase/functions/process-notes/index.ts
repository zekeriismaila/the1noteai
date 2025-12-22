import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  try {
    const { filePath, userId } = await req.json();
    console.log("Processing notes:", filePath, "for user:", userId);

    // Get the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Extract text content based on file type
    let extractedText = "";
    const fileName = filePath.split("/").pop() || "";
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    // For PDF files, we'll extract what we can
    if (fileExtension === "pdf") {
      // Basic PDF text extraction - in production use a proper PDF parser
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder().decode(arrayBuffer);
      
      // Try to extract readable text from PDF
      const textMatches = text.match(/\((.*?)\)/g);
      if (textMatches) {
        extractedText = textMatches
          .map(m => m.slice(1, -1))
          .filter(t => t.length > 1 && /[a-zA-Z0-9]/.test(t))
          .join(" ");
      }
    } else {
      // For DOC/DOCX/PPT/PPTX, try to extract text
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
      
      // Extract readable content
      extractedText = text
        .replace(/<[^>]*>/g, " ")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // If we got content, use AI to enhance and structure it
    let processedContent = extractedText;
    
    if (LOVABLE_API_KEY && extractedText.length > 50) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are a document processor for Engineering Mathematics I lecture notes. 
Extract and structure the mathematical content from the following text.
Preserve all:
- Mathematical formulas and equations
- Definitions and theorems  
- Worked examples
- Problem sets
Format equations in LaTeX notation where possible.
If the text is garbled or unreadable, summarize what topics seem to be covered.`
              },
              {
                role: "user",
                content: `Process this lecture note content:\n\n${extractedText.substring(0, 10000)}`
              }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          processedContent = data.choices?.[0]?.message?.content || extractedText;
        }
      } catch (aiError) {
        console.error("AI processing error:", aiError);
        // Continue with raw extracted text
      }
    }

    // If no content was extracted, use a placeholder
    if (!processedContent || processedContent.length < 20) {
      processedContent = `Document: ${fileName}

This document has been uploaded successfully. The system was unable to extract detailed text content from this file format.

You can still ask questions about Engineering Mathematics I topics, and I'll help you with:
- Limits and continuity
- Differentiation techniques
- Integration methods
- Differential equations
- Linear algebra concepts

Please describe the problems or concepts you'd like help with!`;
    }

    // Find and update the note by user_id and most recent
    const { data: notes, error: findError } = await supabase
      .from("notes")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "processing")
      .order("created_at", { ascending: false })
      .limit(1);

    if (findError) {
      console.error("Find error:", findError);
      throw findError;
    }

    if (notes && notes.length > 0) {
      const { error: updateError } = await supabase
        .from("notes")
        .update({
          status: "ready",
          processed_content: processedContent,
        })
        .eq("id", notes[0].id);

      if (updateError) {
        console.error("Update error:", updateError);
        throw updateError;
      }
    }

    console.log("Notes processed successfully, content length:", processedContent.length);

    return new Response(
      JSON.stringify({ success: true, contentLength: processedContent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Processing error:", error);
    
    // Try to mark the note as error
    try {
      const { filePath, userId } = await req.json().catch(() => ({}));
      if (userId) {
        const supabase2 = createClient(supabaseUrl, supabaseKey);
        await supabase2
          .from("notes")
          .update({ 
            status: "error", 
            error_message: error instanceof Error ? error.message : "Processing failed" 
          })
          .eq("user_id", userId)
          .eq("status", "processing");
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
