import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
      tools: TOOLS,
      tool_choice: "auto",
      stream: false,
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

    // Handle tool calls loop
    let result = await response.json();
    let choice = result.choices?.[0];
    const conversationMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Loop while the model wants to call tools (max 3 iterations)
    let iterations = 0;
    while (choice?.finish_reason === "tool_calls" && iterations < 3) {
      iterations++;
      const assistantMsg = choice.message;
      conversationMessages.push(assistantMsg);

      // Execute each tool call
      for (const toolCall of assistantMsg.tool_calls || []) {
        const fn = toolCall.function;
        let toolResult: string;
        try {
          toolResult = await executeTool(fn.name, JSON.parse(fn.arguments));
        } catch (e) {
          toolResult = `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
        }
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      // Call model again with tool results
      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: conversationMessages,
          tools: TOOLS,
          tool_choice: "auto",
          stream: false,
        }),
      });
      if (!followUp.ok) break;
      result = await followUp.json();
      choice = result.choices?.[0];
    }

    const content = choice?.message?.content || "Sorry, I couldn't process that right now.";
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meditrack-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Tool definitions ───
const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_medicines",
      description: "Search the clinic's medicine inventory. Returns name, category, quantity, reorder_level, status, expiry_date, batch_number, supplier, and unit_price. Use this whenever the user asks about stock levels, what medicines are available, expiring items, or low-stock items.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Optional medicine name or category to search for (case-insensitive partial match). Leave empty to get all medicines." },
          status_filter: { type: "string", enum: ["ok", "low", "critical", "expired"], description: "Optional filter by stock status." },
          limit: { type: "number", description: "Max rows to return. Default 20." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_recent_dispenses",
      description: "Get recent dispense records showing what medicines were dispensed, quantities, who dispensed them, and when. Use when users ask about recent dispensing activity.",
      parameters: {
        type: "object",
        properties: {
          medicine_name: { type: "string", description: "Optional filter by medicine name (partial match)." },
          limit: { type: "number", description: "Max rows. Default 10." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_alerts",
      description: "Get active (unacknowledged) alerts for the clinic: theft alerts, low stock, expiry warnings, reorder notices.",
      parameters: {
        type: "object",
        properties: {
          type_filter: { type: "string", enum: ["theft", "low_stock", "expiry", "reorder"], description: "Optional filter by alert type." },
          limit: { type: "number", description: "Max rows. Default 10." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_summary",
      description: "Get a high-level summary of the inventory: total medicines count, how many are low/critical/expired, total stock value.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ─── Tool execution ───
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  switch (name) {
    case "query_medicines": {
      let query = supabase.from("medicines").select("name, category, quantity, reorder_level, status, expiry_date, batch_number, supplier, unit_price");
      if (args.search) query = query.ilike("name", `%${args.search}%`);
      if (args.status_filter) query = query.eq("status", args.status_filter);
      const { data, error } = await query.limit(Number(args.limit) || 20);
      if (error) return `DB error: ${error.message}`;
      if (!data?.length) return "No medicines found matching that query.";
      return JSON.stringify(data);
    }
    case "query_recent_dispenses": {
      let query = supabase.from("dispense_records").select("medicine_name, quantity, user_name, notes, created_at").order("created_at", { ascending: false });
      if (args.medicine_name) query = query.ilike("medicine_name", `%${args.medicine_name}%`);
      const { data, error } = await query.limit(Number(args.limit) || 10);
      if (error) return `DB error: ${error.message}`;
      if (!data?.length) return "No recent dispense records found.";
      return JSON.stringify(data);
    }
    case "query_alerts": {
      let query = supabase.from("alerts").select("type, severity, title, message, created_at").eq("acknowledged", false).order("created_at", { ascending: false });
      if (args.type_filter) query = query.eq("type", args.type_filter);
      const { data, error } = await query.limit(Number(args.limit) || 10);
      if (error) return `DB error: ${error.message}`;
      if (!data?.length) return "No active alerts.";
      return JSON.stringify(data);
    }
    case "get_inventory_summary": {
      const { data, error } = await supabase.from("medicines").select("quantity, status, unit_price");
      if (error) return `DB error: ${error.message}`;
      const total = data?.length || 0;
      const low = data?.filter(m => m.status === "low").length || 0;
      const critical = data?.filter(m => m.status === "critical").length || 0;
      const expired = data?.filter(m => m.status === "expired").length || 0;
      const totalValue = data?.reduce((s, m) => s + (m.quantity * (Number(m.unit_price) || 0)), 0) || 0;
      const totalUnits = data?.reduce((s, m) => s + m.quantity, 0) || 0;
      return JSON.stringify({ total_medicines: total, total_units: totalUnits, low_stock: low, critical_stock: critical, expired, total_value: totalValue });
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
