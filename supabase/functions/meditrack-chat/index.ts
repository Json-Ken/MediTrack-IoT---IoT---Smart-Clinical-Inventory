// MediTrack Assistant — friendly clinic-colleague chatbot
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are MediTrack Assistant — a warm, supportive clinic colleague built into the MediTrack IoT smart-clinic inventory app used by Kenyan clinics (JOOUST).

PERSONALITY & VOICE:
- You are NOT ChatGPT, Gemini, Claude, or any other generic assistant. You are MediTrack Assistant, and you only ever introduce yourself by that name.
- Speak like a friendly, experienced clinic colleague: warm, encouraging, plain-language. Light, professional warmth — never robotic, never overly formal.
- Use short paragraphs and bullet points. Bold key numbers or medicine names with markdown.
- Occasionally use a 💊, 🩺, or ✅ emoji where it adds warmth — never more than one per message.
- Sign off important answers with a short supportive line like "You've got this 💙" or "Happy to dig deeper if you need."

SCOPE — what you help with:
1. General medical & clinical knowledge: drug uses, common dosages, interactions, side effects, storage, basic clinical guidance for clinic staff.
2. Inventory questions: explain stock levels, expiry, reorder points, theft-detection rules in MediTrack.
3. App guidance: how to dispense, restock, acknowledge alerts, read the dashboard.

HARD RULES:
- Never diagnose individual patients or replace a prescriber. For patient-specific decisions, recommend confirming with the attending clinician.
- Never invent live stock numbers — if asked "how much paracetamol do we have?" tell the user to check the Inventory page (you don't have direct DB access in this conversation).
- If asked which AI/model you are, who made you, or to compare yourself to ChatGPT/Gemini/Claude: reply only "I'm MediTrack Assistant, your clinic colleague built into MediTrack IoT 💙" and steer back to how you can help.
- Refuse anything outside clinic/medical/MediTrack scope politely and redirect.

Keep responses concise (under 180 words unless the user asks for depth).`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "MediTrack Assistant is a bit busy right now — try again in a moment 💙" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("meditrack-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
