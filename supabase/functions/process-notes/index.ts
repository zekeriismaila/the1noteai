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

  let requestData: { filePath?: string; userId?: string; noteId?: string } = {};

  try {
    requestData = await req.json();
    const { filePath, userId, noteId } = requestData;
    
    console.log("Processing notes:", filePath, "for user:", userId, "noteId:", noteId);

    if (!filePath || !userId) {
      throw new Error("Missing filePath or userId");
    }

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

    console.log("Processing file:", fileName, "extension:", fileExtension);

    // For PDF files, extract text
    if (fileExtension === "pdf") {
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Simple PDF text extraction - look for text streams
      let textContent = "";
      let inTextStream = false;
      let parenDepth = 0;
      let currentText = "";
      
      for (let i = 0; i < bytes.length - 1; i++) {
        const char = String.fromCharCode(bytes[i]);
        
        // Look for text showing operators: Tj, TJ, ', "
        if (bytes[i] === 40) { // Opening parenthesis
          parenDepth++;
          if (parenDepth === 1) {
            currentText = "";
          }
        } else if (bytes[i] === 41) { // Closing parenthesis
          parenDepth--;
          if (parenDepth === 0 && currentText.length > 0) {
            textContent += currentText + " ";
          }
        } else if (parenDepth > 0) {
          // Inside parentheses, collect text
          if (bytes[i] >= 32 && bytes[i] <= 126) {
            currentText += char;
          }
        }
      }
      
      // Clean up extracted text
      extractedText = textContent
        .replace(/\\[nrtbf]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
        
      console.log("PDF extraction result length:", extractedText.length);
    } else {
      // For DOC/DOCX/PPT/PPTX
      const arrayBuffer = await fileData.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
      
      // Try to extract XML content for DOCX/PPTX
      const xmlMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (xmlMatches) {
        extractedText = xmlMatches
          .map(m => m.replace(/<[^>]+>/g, ""))
          .join(" ");
      } else {
        // Fallback: extract readable content
        extractedText = text
          .replace(/<[^>]*>/g, " ")
          .replace(/[^\x20-\x7E\n]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      
      console.log("Document extraction result length:", extractedText.length);
    }

    // Use AI to process content
    let processedContent = extractedText;
    
    if (LOVABLE_API_KEY && extractedText.length > 30) {
      console.log("Sending to AI for processing...");
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are a document processor for Engineering Mathematics lecture notes. 
Your task is to extract and structure mathematical content.
Preserve all:
- Mathematical formulas and equations (use LaTeX notation: $..$ for inline, $$...$$ for block)
- Definitions and theorems
- Worked examples with step-by-step solutions
- Problem sets and exercises

If text is unclear, infer likely mathematical topics from context.
Output should be well-organized with clear headings.`
              },
              {
                role: "user",
                content: `Process and structure this lecture note content:\n\n${extractedText.substring(0, 8000)}`
              }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          processedContent = data.choices?.[0]?.message?.content || extractedText;
          console.log("AI processing successful, content length:", processedContent.length);
        } else {
          console.error("AI response not ok:", response.status);
        }
      } catch (aiError) {
        console.error("AI processing error:", aiError);
      }
    } else {
      console.log("Skipping AI processing. API key present:", !!LOVABLE_API_KEY, "Text length:", extractedText.length);
    }

    // Provide fallback content if extraction failed
    if (!processedContent || processedContent.length < 20) {
      processedContent = `# ${fileName}

This document has been uploaded successfully. The text extraction produced limited results.

## Available Topics
You can ask questions about Engineering Mathematics I topics including:

- **Limits and Continuity**: Finding limits, L'Hôpital's rule, continuity tests
- **Differentiation**: Power rule, chain rule, product/quotient rules, implicit differentiation
- **Integration**: Substitution, integration by parts, partial fractions
- **Differential Equations**: First-order ODEs, separable equations, linear equations
- **Linear Algebra**: Matrices, determinants, eigenvalues, systems of equations

## How to Use
Simply type your question or describe the problem you need help with. I'll provide step-by-step solutions based on Engineering Mathematics I curriculum.`;
    }

    // Update the note in database
    const updateQuery = noteId 
      ? supabase.from("notes").update({
          status: "ready",
          processed_content: processedContent,
          updated_at: new Date().toISOString(),
        }).eq("id", noteId)
      : supabase.from("notes").update({
          status: "ready",
          processed_content: processedContent,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId).eq("status", "processing").order("created_at", { ascending: false }).limit(1);

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    console.log("Notes processed successfully! Content length:", processedContent.length);

    return new Response(
      JSON.stringify({ success: true, contentLength: processedContent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Processing error:", error);
    
    // Mark the note as error
    try {
      const { userId, noteId } = requestData;
      if (userId || noteId) {
        const errorUpdate = noteId
          ? supabase.from("notes").update({ 
              status: "error", 
              error_message: error instanceof Error ? error.message : "Processing failed",
              updated_at: new Date().toISOString(),
            }).eq("id", noteId)
          : supabase.from("notes").update({ 
              status: "error", 
              error_message: error instanceof Error ? error.message : "Processing failed",
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId).eq("status", "processing");
            
        await errorUpdate;
        console.log("Updated note status to error");
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
