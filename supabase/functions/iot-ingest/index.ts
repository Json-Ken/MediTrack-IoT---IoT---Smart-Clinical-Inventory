// Public IoT ingestion endpoint. Devices POST events authenticated via X-Device-Key.
// No JWT required (devices don't have user sessions). Authenticated by hashed API key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IoTPayload {
  event_type: "dispense" | "restock" | "lock_open" | "lock_close" | "sensor_reading";
  scan_code?: string;        // RFID tag or QR code identifying the medicine
  quantity?: number;         // positive integer; sign applied via event_type
  notes?: string;
  metadata?: Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hashKey(key: string): string {
  // Lightweight non-crypto hash for genesis chain (matches frontend impl style).
  // The DB also verifies the key via SHA-256 in verify_iot_device_key.
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(12, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const deviceKey = req.headers.get("x-device-key");
  if (!deviceKey || deviceKey.length < 16) {
    return json({ error: "Missing or invalid X-Device-Key header" }, 401);
  }

  let payload: IoTPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const allowedTypes = ["dispense", "restock", "lock_open", "lock_close", "sensor_reading"];
  if (!payload.event_type || !allowedTypes.includes(payload.event_type)) {
    return json({ error: "Invalid event_type" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify device key
  const { data: deviceRows, error: verifyErr } = await admin.rpc("verify_iot_device_key", {
    _api_key: deviceKey,
  });
  if (verifyErr) {
    console.error("verify error", verifyErr);
    return json({ error: "Device verification failed" }, 500);
  }
  const device = deviceRows?.[0];
  if (!device) return json({ error: "Unknown device key" }, 401);
  if (!device.is_active) return json({ error: "Device disabled" }, 403);

  // 2. Resolve medicine for stock events
  let medicineId: string | null = null;
  let medicineName: string | null = null;
  let qtyChange = 0;

  const stockEvent = payload.event_type === "dispense" || payload.event_type === "restock";
  if (stockEvent) {
    if (!payload.scan_code) return json({ error: "scan_code required for stock events" }, 400);
    const qty = Math.floor(Math.abs(payload.quantity ?? 1));
    if (qty < 1 || qty > 1000) return json({ error: "quantity must be 1-1000" }, 400);

    const { data: med } = await admin
      .from("medicines")
      .select("id, name, quantity, reorder_level")
      .or(`rfid_tag.eq.${payload.scan_code},qr_code.eq.${payload.scan_code}`)
      .maybeSingle();

    if (!med) return json({ error: `No medicine matches scan_code '${payload.scan_code}'` }, 404);

    medicineId = med.id;
    medicineName = med.name;
    qtyChange = payload.event_type === "restock" ? qty : -qty;

    const newQty = Math.max(0, med.quantity + qtyChange);
    if (payload.event_type === "dispense" && med.quantity < qty) {
      return json({ error: "Insufficient stock", available: med.quantity }, 409);
    }

    let newStatus: string = "ok";
    if (newQty <= 0) newStatus = "critical";
    else if (newQty < med.reorder_level * 0.5) newStatus = "critical";
    else if (newQty < med.reorder_level) newStatus = "low";

    await admin.from("medicines")
      .update({ quantity: newQty, status: newStatus })
      .eq("id", med.id);

    // Audit log entry
    const { data: lastLog } = await admin
      .from("audit_logs")
      .select("curr_hash")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevHash = lastLog?.curr_hash || "GENESIS";
    const currHash = hashKey(`${new Date().toISOString()}${med.name}${qtyChange}${device.device_name}${prevHash}`);

    await admin.from("audit_logs").insert({
      action: payload.event_type,
      medicine_id: med.id,
      medicine_name: med.name,
      quantity_change: qtyChange,
      user_id: null,
      user_name: `IoT: ${device.device_name}`,
      prev_hash: prevHash,
      curr_hash: currHash,
      details: payload.notes ?? `Auto via device ${device.device_name}`,
    });

    if (payload.event_type === "dispense") {
      await admin.from("dispense_records").insert({
        medicine_id: med.id,
        medicine_name: med.name,
        quantity: qty,
        user_id: null,
        user_name: `IoT: ${device.device_name}`,
        notes: payload.notes ?? "Auto-dispensed via scanner",
      });
    }

    // Low-stock alert
    if (payload.event_type === "dispense" && newQty < med.reorder_level && med.quantity >= med.reorder_level) {
      await admin.from("alerts").insert({
        type: "low_stock",
        severity: "warning",
        title: "Low Stock Alert (IoT)",
        message: `${med.name} fell to ${newQty} units after ${device.device_name} scan`,
        medicine_id: med.id,
      });
    }
  }

  // 3. Cabinet open/close audit (no quantity change)
  if (payload.event_type === "lock_open" || payload.event_type === "lock_close") {
    const { data: lastLog } = await admin
      .from("audit_logs")
      .select("curr_hash")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevHash = lastLog?.curr_hash || "GENESIS";
    const currHash = hashKey(`${new Date().toISOString()}lock${device.device_name}${prevHash}`);

    await admin.from("audit_logs").insert({
      action: "alert",
      medicine_id: null,
      medicine_name: null,
      quantity_change: 0,
      user_id: null,
      user_name: `IoT: ${device.device_name}`,
      prev_hash: prevHash,
      curr_hash: currHash,
      details: payload.event_type === "lock_open"
        ? `Cabinet opened (${device.device_name})`
        : `Cabinet closed (${device.device_name})`,
    });

    // After-hours open → theft alert
    const hr = new Date().getUTCHours();
    if (payload.event_type === "lock_open" && (hr < 6 || hr > 22)) {
      await admin.from("alerts").insert({
        type: "theft",
        severity: "critical",
        title: "After-hours Cabinet Access",
        message: `${device.device_name} opened outside operating hours`,
      });
    }
  }

  // 4. Always log raw IoT event + bump last_seen
  await admin.from("iot_events").insert({
    device_id: device.device_id,
    device_name: device.device_name,
    event_type: payload.event_type,
    medicine_id: medicineId,
    medicine_name: medicineName,
    scan_code: payload.scan_code ?? null,
    quantity_change: qtyChange,
    payload: payload.metadata ?? {},
  });

  await admin.from("iot_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", device.device_id);

  return json({
    ok: true,
    device: device.device_name,
    event_type: payload.event_type,
    medicine: medicineName,
    quantity_change: qtyChange,
  });
});