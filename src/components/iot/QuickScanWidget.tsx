import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Keyboard, ScanLine, KeyRound, CheckCircle2, XCircle, Loader2, Zap, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';

type EventType = 'dispense' | 'restock';
type ScanResult = { ok: boolean; code: string; medicine?: string; message: string; at: number };

const KEY_STORAGE = 'meditrack.iot.deviceKey';
const NEAR_EXPIRY_DAYS = 30;

type PendingExpiry = {
  code: string;
  medicineName: string;
  expiryDate: string;
  daysLeft: number;
  expired: boolean;
};

export function QuickScanWidget() {
  const [deviceKey, setDeviceKey] = useState<string>(() => localStorage.getItem(KEY_STORAGE) || '');
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState('');
  const [eventType, setEventType] = useState<EventType>('dispense');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<ScanResult[]>([]);
  const [mode, setMode] = useState<'camera' | 'hid'>('hid');
  const [pendingExpiry, setPendingExpiry] = useState<PendingExpiry | null>(null);

  // HID buffer
  const hidInputRef = useRef<HTMLInputElement>(null);
  const [hidBuffer, setHidBuffer] = useState('');

  // Camera
  const cameraDivId = 'meditrack-qr-reader';
  const cameraRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const performIngest = useCallback(async (trimmed: string, now: number) => {
    setBusy(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iot-ingest`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Key': deviceKey },
        body: JSON.stringify({ event_type: eventType, scan_code: trimmed, quantity }),
      });
      const data = await res.json().catch(() => ({}));
      const result: ScanResult = {
        ok: res.ok,
        code: trimmed,
        medicine: data?.medicine_name,
        message: res.ok
          ? `${eventType === 'dispense' ? 'Dispensed' : 'Restocked'} ${quantity} · ${data?.medicine_name || trimmed}`
          : data?.error || `Failed (${res.status})`,
        at: now,
      };
      setRecent((prev) => [result, ...prev].slice(0, 6));
      if (res.ok) {
        toast.success(result.message);
        // Audio cue for hands-free use
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
          g.gain.setValueAtTime(0.15, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          o.start(); o.stop(ctx.currentTime + 0.15);
        } catch { /* ignore */ }
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const result: ScanResult = { ok: false, code: trimmed, message: `Network error: ${String(err)}`, at: now };
      setRecent((prev) => [result, ...prev].slice(0, 6));
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }, [deviceKey, eventType, quantity]);

  const submitScan = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!deviceKey) {
      toast.error('Set a device key first');
      setKeyDialogOpen(true);
      return;
    }
    // de-dupe rapid repeats from camera
    const now = Date.now();
    if (lastScanRef.current.code === trimmed && now - lastScanRef.current.at < 1500) return;
    lastScanRef.current = { code: trimmed, at: now };

    // Pre-check expiry for dispense events
    if (eventType === 'dispense') {
      setBusy(true);
      const { data: med, error } = await supabase
        .from('medicines')
        .select('name, expiry_date')
        .or(`rfid_tag.eq.${trimmed},qr_code.eq.${trimmed}`)
        .maybeSingle();
      setBusy(false);

      if (!error && med?.expiry_date) {
        const expiry = new Date(med.expiry_date);
        const daysLeft = Math.floor((expiry.getTime() - Date.now()) / 86400000);
        if (daysLeft < 0) {
          const result: ScanResult = {
            ok: false,
            code: trimmed,
            medicine: med.name,
            message: `BLOCKED — ${med.name} expired on ${expiry.toLocaleDateString()}`,
            at: now,
          };
          setRecent((prev) => [result, ...prev].slice(0, 6));
          toast.error(result.message);
          return;
        }
        if (daysLeft <= NEAR_EXPIRY_DAYS) {
          setPendingExpiry({
            code: trimmed,
            medicineName: med.name,
            expiryDate: expiry.toLocaleDateString(),
            daysLeft,
            expired: false,
          });
          return;
        }
      }
    }

    await performIngest(trimmed, now);
  }, [deviceKey, eventType, performIngest]);

  // HID listener: capture rapid keystrokes ending with Enter (typical for USB scanners)
  useEffect(() => {
    if (mode !== 'hid') return;
    const el = hidInputRef.current;
    if (!el) return;
    el.focus();
    const refocus = () => { if (mode === 'hid' && document.activeElement !== el) el.focus(); };
    const interval = setInterval(refocus, 800);
    return () => clearInterval(interval);
  }, [mode]);

  const handleHidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = hidBuffer.trim();
      setHidBuffer('');
      if (value) submitScan(value);
    }
  };

  // Camera lifecycle
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(cameraDivId);
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 160 } },
        (decoded) => { submitScan(decoded); },
        () => { /* ignore per-frame errors */ },
      );
      cameraRef.current = { stop: async () => { await scanner.stop(); await scanner.clear(); } };
      setCameraOn(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not start camera');
    }
  }, [submitScan]);

  const stopCamera = useCallback(async () => {
    try { await cameraRef.current?.stop(); } catch { /* ignore */ }
    cameraRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    if (mode !== 'camera' && cameraOn) stopCamera();
    return () => { if (cameraRef.current) stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const saveKey = () => {
    const k = pendingKey.trim();
    if (!k.startsWith('iot_')) return toast.error('Key should start with "iot_"');
    localStorage.setItem(KEY_STORAGE, k);
    setDeviceKey(k);
    setKeyDialogOpen(false);
    setPendingKey('');
    toast.success('Device key saved on this browser');
  };

  const clearKey = () => {
    localStorage.removeItem(KEY_STORAGE);
    setDeviceKey('');
    toast.success('Device key cleared');
  };

  return (
    <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-accent/5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Quick Scan
          </h2>
          <p className="text-xs text-muted-foreground">Point a camera or plug in a USB scanner — events fire automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={deviceKey ? 'default' : 'destructive'} className="gap-1">
            <KeyRound className="w-3 h-3" />
            {deviceKey ? `Key ${deviceKey.slice(0, 8)}…` : 'No key set'}
          </Badge>
          <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Settings2 className="w-4 h-4 mr-1" /> {deviceKey ? 'Change' : 'Set key'}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Device Key</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Paste the API key generated when you registered the scanner. It is stored only on this browser.</p>
              <Input value={pendingKey} onChange={(e) => setPendingKey(e.target.value)} placeholder="iot_..." className="font-mono text-xs" />
              <DialogFooter className="gap-2">
                {deviceKey && <Button variant="ghost" onClick={clearKey}>Clear</Button>}
                <Button onClick={saveKey}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action config */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label className="text-xs">Action</Label>
          <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dispense">Dispense (−)</SelectItem>
              <SelectItem value="restock">Restock (+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Qty per scan</Label>
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="hid"><Keyboard className="w-4 h-4 mr-1" /> USB Scanner</TabsTrigger>
          <TabsTrigger value="camera"><Camera className="w-4 h-4 mr-1" /> Camera</TabsTrigger>
        </TabsList>

        <TabsContent value="hid" className="mt-4">
          <div
            className="border-2 border-dashed border-primary/40 rounded-lg p-6 text-center cursor-text bg-background/40 hover:border-primary transition"
            onClick={() => hidInputRef.current?.focus()}
          >
            <ScanLine className="w-10 h-10 mx-auto text-primary mb-2 animate-pulse" />
            <p className="font-medium">Ready for scanner input</p>
            <p className="text-xs text-muted-foreground mt-1">Most USB RFID/barcode readers act as keyboards. Just scan — the value will submit automatically on Enter.</p>
            <input
              ref={hidInputRef}
              value={hidBuffer}
              onChange={(e) => setHidBuffer(e.target.value)}
              onKeyDown={handleHidKeyDown}
              className="opacity-0 absolute pointer-events-none w-px h-px"
              autoComplete="off"
              aria-label="Scanner input"
            />
            {hidBuffer && <p className="text-xs font-mono mt-3 text-primary">Reading: {hidBuffer}</p>}
          </div>
        </TabsContent>

        <TabsContent value="camera" className="mt-4">
          <div className="space-y-3">
            <div id={cameraDivId} className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center text-muted-foreground text-sm">
              {!cameraOn && !cameraError && <span>Camera off</span>}
              {cameraError && <span className="text-danger px-4 text-center">{cameraError}</span>}
            </div>
            <div className="flex gap-2">
              {!cameraOn ? (
                <Button onClick={startCamera} className="flex-1"><Camera className="w-4 h-4 mr-1" /> Start camera</Button>
              ) : (
                <Button onClick={stopCamera} variant="outline" className="flex-1">Stop camera</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Hold a QR code in the frame. Repeated scans of the same code within 1.5s are ignored.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Status */}
      <div className="mt-4">
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
          </div>
        )}
        <AnimatePresence initial={false}>
          {recent.map((r) => (
            <motion.div
              key={r.at}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-start gap-2 text-sm p-2 mt-2 rounded-md border ${r.ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}
            >
              {r.ok ? <CheckCircle2 className="w-4 h-4 text-success mt-0.5" /> : <XCircle className="w-4 h-4 text-danger mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="truncate">{r.message}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{r.code}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Dialog open={!!pendingExpiry} onOpenChange={(open) => { if (!open) setPendingExpiry(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" /> Near-expiry batch
            </DialogTitle>
          </DialogHeader>
          {pendingExpiry && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">{pendingExpiry.medicineName}</span> expires on{' '}
                <span className="font-semibold">{pendingExpiry.expiryDate}</span>{' '}
                <span className="text-muted-foreground">
                  ({pendingExpiry.daysLeft} day{pendingExpiry.daysLeft === 1 ? '' : 's'} left)
                </span>.
              </p>
              <p className="text-muted-foreground">Confirm to proceed with dispensing this batch, or cancel and pick a fresher one.</p>
              <p className="font-mono text-xs text-muted-foreground">Scan: {pendingExpiry.code}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingExpiry(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!pendingExpiry) return;
                const { code } = pendingExpiry;
                setPendingExpiry(null);
                performIngest(code, Date.now());
              }}
            >
              Dispense anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}