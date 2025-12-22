import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, noteContent, conversationHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are 1Note, a specialized math tutor for Engineering Mathematics I. 

CRITICAL RULES:
1. ONLY use information from the provided lecture notes as context
2. NEVER guess or make up solutions - if unsure, say so
3. NEVER skip steps in solutions
4. All solutions MUST follow this structure:
   **Given:** [State the problem and known values]
   **Formula:** [State the formula(s) to be used]
   **Solution:** [Step-by-step working]
   **Step 1:** [First step with explanation]
   **Step 2:** [Continue as needed]
   **Answer:** [Final answer clearly stated]

5. Use LaTeX notation for all math: $inline$ for inline, $$display$$ for display
6. If a problem is ambiguous, explain your assumptions
7. Topics covered: Limits, Continuity, Differentiation, Integration, Differential Equations, Linear Algebra

LECTURE NOTES CONTEXT:
${noteContent || "No notes content available. Please inform the user to upload notes first."}

Be precise, clear, and educational. Act as a patient private tutor.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI Gateway error");
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Math solver error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
