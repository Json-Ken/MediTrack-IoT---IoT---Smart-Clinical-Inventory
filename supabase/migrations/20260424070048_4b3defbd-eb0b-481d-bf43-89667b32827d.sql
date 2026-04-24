CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Add RFID / QR fields to medicines
ALTER TABLE public.medicines
  ADD COLUMN IF NOT EXISTS rfid_tag text UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_code text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_medicines_rfid_tag ON public.medicines(rfid_tag);
CREATE INDEX IF NOT EXISTS idx_medicines_qr_code ON public.medicines(qr_code);

-- 2. IoT devices registry
CREATE TABLE IF NOT EXISTS public.iot_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  device_type text NOT NULL DEFAULT 'scanner',
  location text,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view devices"
  ON public.iot_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert devices"
  ON public.iot_devices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update devices"
  ON public.iot_devices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete devices"
  ON public.iot_devices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_iot_devices_updated_at
  BEFORE UPDATE ON public.iot_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. IoT events log
CREATE TABLE IF NOT EXISTS public.iot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.iot_devices(id) ON DELETE SET NULL,
  device_name text,
  event_type text NOT NULL,
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE SET NULL,
  medicine_name text,
  scan_code text,
  quantity_change integer NOT NULL DEFAULT 0,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iot_events_created_at ON public.iot_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iot_events_device ON public.iot_events(device_id);

ALTER TABLE public.iot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view IoT events"
  ON public.iot_events FOR SELECT TO authenticated USING (true);

-- 4. Secure device-key verification function
CREATE OR REPLACE FUNCTION public.verify_iot_device_key(_api_key text)
RETURNS TABLE(device_id uuid, device_name text, device_type text, is_active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT id, name, device_type, is_active
  FROM public.iot_devices
  WHERE api_key_hash = encode(extensions.digest(_api_key, 'sha256'), 'hex')
  LIMIT 1;
$$;