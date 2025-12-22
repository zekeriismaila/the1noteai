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

  try {
    const { filePath, userId } = await req.json();
    console.log("Processing notes:", filePath, "for user:", userId);

    // Get the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("notes")
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // For now, mark as ready with placeholder content
    // In production, you would use a document parsing service here
    const processedContent = `[Document content from ${filePath}. Full text extraction would be implemented with a document parsing service.]`;

    // Update the note status
    const { error: updateError } = await supabase
      .from("notes")
      .update({
        status: "ready",
        processed_content: processedContent,
      })
      .eq("user_id", userId)
      .eq("file_url", `LIKE %${filePath}%`);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    // Update by file path match
    await supabase
      .from("notes")
      .update({ status: "ready", processed_content: processedContent })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("Notes processed successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Processing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
