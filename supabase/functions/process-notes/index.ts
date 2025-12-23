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
    
    console.log("=== PROCESS-NOTES START ===");
    console.log("filePath:", filePath);
    console.log("userId:", userId);
    console.log("noteId:", noteId);
    console.log("LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);

    if (!filePath || !userId) {
      console.error("Missing required fields - filePath:", !!filePath, "userId:", !!userId);
      throw new Error("Missing filePath or userId");
    }

    // Update status to show we're actively processing
    if (noteId) {
      await supabase.from("notes").update({ 
        status: "processing",
        error_message: null,
        updated_at: new Date().toISOString()
      }).eq("id", noteId);
      console.log("Updated note status to processing");
    }

    // Get the file from storage
    console.log("Downloading file from storage:", filePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(filePath);

    if (downloadError) {
      console.error("Download error:", downloadError);
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    console.log("File downloaded successfully, size:", fileData.size);

    // Extract text content based on file type
    let extractedText = "";
    const fileName = filePath.split("/").pop() || "";
    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    console.log("Processing file:", fileName, "extension:", fileExtension);

    // For PDF files, extract text using improved method
    if (fileExtension === "pdf") {
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Enhanced PDF text extraction
      let textContent = "";
      let parenDepth = 0;
      let currentText = "";
      
      for (let i = 0; i < bytes.length - 1; i++) {
        const char = String.fromCharCode(bytes[i]);
        
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

    // Process with AI
    let processedContent = extractedText;
    
    if (LOVABLE_API_KEY && extractedText.length > 30) {
      console.log("Sending to AI for processing, text preview:", extractedText.substring(0, 200));
      
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
Your task is to extract and structure mathematical content clearly.

ALWAYS preserve:
- Mathematical formulas and equations (use LaTeX: $..$ for inline, $$...$$ for block)
- Definitions, theorems, and proofs
- Worked examples with step-by-step solutions
- Problem sets and exercises

Structure the output with clear headings (##) and organize topics logically.
If text is unclear, infer likely mathematical topics from context.`
              },
              {
                role: "user",
                content: `Process and structure this lecture note content. Extract all mathematical content and organize it clearly:\n\n${extractedText.substring(0, 12000)}`
              }
            ],
          }),
        });

        console.log("AI response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          processedContent = data.choices?.[0]?.message?.content || extractedText;
          console.log("AI processing successful, content length:", processedContent.length);
        } else {
          const errorText = await response.text();
          console.error("AI response error:", response.status, errorText);
        }
      } catch (aiError) {
        console.error("AI processing error:", aiError);
      }
    } else {
      console.log("Skipping AI - API key present:", !!LOVABLE_API_KEY, "Text length:", extractedText.length);
    }

    // Provide fallback content if extraction failed
    if (!processedContent || processedContent.length < 20) {
      console.log("Using fallback content");
      processedContent = `# ${fileName.replace(/\.[^/.]+$/, "")}

This document has been uploaded successfully.

## Document Information
- **File Name:** ${fileName}
- **File Type:** ${fileExtension?.toUpperCase() || "Unknown"}

## Available Topics
You can ask questions about Engineering Mathematics I topics including:

- **Limits and Continuity**: Finding limits, L'Hôpital's rule, continuity tests
- **Differentiation**: Power rule, chain rule, product/quotient rules, implicit differentiation
- **Integration**: Substitution, integration by parts, partial fractions
- **Differential Equations**: First-order ODEs, separable equations, linear equations
- **Linear Algebra**: Matrices, determinants, eigenvalues, systems of equations

## How to Use
Simply type your question or describe the problem you need help with. I'll provide step-by-step solutions.`;
    }

    // Update the note in database
    console.log("Updating note in database with processed content");
    
    const { error: updateError } = await supabase.from("notes").update({
      status: "ready",
      processed_content: processedContent,
      original_content: extractedText.substring(0, 50000),
      updated_at: new Date().toISOString(),
    }).eq("id", noteId);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw updateError;
    }

    console.log("=== PROCESS-NOTES SUCCESS ===");
    console.log("Final content length:", processedContent.length);

    return new Response(
      JSON.stringify({ success: true, contentLength: processedContent.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("=== PROCESS-NOTES ERROR ===");
    console.error("Error:", error);
    
    // Mark the note as error
    try {
      const { noteId } = requestData;
      if (noteId) {
        const errorMessage = error instanceof Error ? error.message : "Processing failed";
        await supabase.from("notes").update({ 
          status: "error", 
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        }).eq("id", noteId);
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
