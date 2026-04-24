import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Plus, Radio, ScanLine, Lock, Unlock, Trash2, Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface IoTDevice {
  id: string;
  name: string;
  device_type: string;
  location: string | null;
  api_key_prefix: string;
  is_active: boolean;
  last_seen_at: string | null;
}

interface IoTEvent {
  id: string;
  device_name: string | null;
  event_type: string;
  medicine_name: string | null;
  scan_code: string | null;
  quantity_change: number;
  created_at: string;
}

function generateApiKey(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return 'iot_' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const eventIcon = (type: string) => {
  if (type === 'dispense') return <ScanLine className="w-4 h-4 text-warning" />;
  if (type === 'restock') return <ScanLine className="w-4 h-4 text-success" />;
  if (type === 'lock_open') return <Unlock className="w-4 h-4 text-danger" />;
  if (type === 'lock_close') return <Lock className="w-4 h-4 text-muted-foreground" />;
  return <Radio className="w-4 h-4 text-primary" />;
};

export function IoTPage() {
  const { user } = useAuth();
  const { medicines, refreshData } = useInventory();
  const isAdmin = user?.role === 'admin';
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [events, setEvents] = useState<IoTEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Add device dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', device_type: 'scanner', location: '' });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Simulator state
  const [simDeviceKey, setSimDeviceKey] = useState('');
  const [simEvent, setSimEvent] = useState<'dispense' | 'restock' | 'lock_open' | 'lock_close'>('dispense');
  const [simScanCode, setSimScanCode] = useState('');
  const [simQty, setSimQty] = useState(1);
  const [simNotes, setSimNotes] = useState('');
  const [simSubmitting, setSimSubmitting] = useState(false);
  const [simResponse, setSimResponse] = useState<string | null>(null);

  const fetchAll = async () => {
    const [d, e] = await Promise.all([
      supabase.from('iot_devices').select('*').order('created_at', { ascending: false }),
      supabase.from('iot_events').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    if (d.data) setDevices(d.data as IoTDevice[]);
    if (e.data) setEvents(e.data as IoTEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('iot_events_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_events' }, () => {
        fetchAll();
        refreshData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refreshData]);

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.name.trim()) return toast.error('Device name required');
    const key = generateApiKey();
    const hash = await sha256Hex(key);
    const { error } = await supabase.from('iot_devices').insert({
      name: newDevice.name.trim(),
      device_type: newDevice.device_type,
      location: newDevice.location.trim() || null,
      api_key_hash: hash,
      api_key_prefix: key.slice(0, 12),
    });
    if (error) return toast.error(error.message);
    setGeneratedKey(key);
    toast.success('Device registered');
    fetchAll();
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Delete this device? Its key will stop working immediately.')) return;
    const { error } = await supabase.from('iot_devices').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Device removed');
    fetchAll();
  };

  const closeAddDialog = () => {
    setAddOpen(false);
    setNewDevice({ name: '', device_type: 'scanner', location: '' });
    setGeneratedKey(null);
    setKeyCopied(false);
  };

  const sendSimEvent = async () => {
    if (!simDeviceKey) return toast.error('Paste a device key first');
    setSimSubmitting(true);
    setSimResponse(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iot-ingest`;
      const body: Record<string, unknown> = { event_type: simEvent };
      if (simEvent === 'dispense' || simEvent === 'restock') {
        body.scan_code = simScanCode;
        body.quantity = simQty;
      }
      if (simNotes) body.notes = simNotes;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-Key': simDeviceKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setSimResponse(JSON.stringify(data, null, 2));
      if (res.ok) toast.success('Event ingested');
      else toast.error(data.error || 'Failed');
    } catch (err) {
      toast.error('Network error');
      setSimResponse(String(err));
    } finally {
      setSimSubmitting(false);
    }
  };

  const ingestUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iot-ingest`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Cpu className="w-8 h-8 text-primary" />
              IoT Devices
            </h1>
            <p className="text-muted-foreground mt-1">
              Register RFID/QR scanners, smart locks, and sensors. Events stream to your inventory in real time.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={addOpen} onOpenChange={(o) => o ? setAddOpen(true) : closeAddDialog()}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Register Device</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{generatedKey ? 'Device Registered' : 'Register New Device'}</DialogTitle>
                </DialogHeader>
                {!generatedKey ? (
                  <form onSubmit={handleCreateDevice} className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={newDevice.name} onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })} placeholder="Pharmacy Scanner #1" />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={newDevice.device_type} onValueChange={(v) => setNewDevice({ ...newDevice, device_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scanner">RFID / QR Scanner</SelectItem>
                          <SelectItem value="smart_lock">Smart Lock / Cabinet</SelectItem>
                          <SelectItem value="sensor">Sensor (temp / weight)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Location (optional)</Label>
                      <Input value={newDevice.location} onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })} placeholder="Pharmacy room" />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Generate API Key</Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Copy this key now — it cannot be retrieved later. The device must send it as the <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Device-Key</code> header.
                    </p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-xs break-all flex items-center gap-2">
                      <span className="flex-1">{generatedKey}</span>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(generatedKey); setKeyCopied(true); toast.success('Copied'); }}>
                        {keyCopied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button onClick={closeAddDialog}>Done</Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      {/* Endpoint info */}
      <Card className="p-4 bg-muted/30">
        <p className="text-xs text-muted-foreground mb-1">Devices POST events to:</p>
        <code className="text-xs break-all font-mono">{ingestUrl}</code>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Devices */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" /> Registered Devices
          </h2>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices yet. {isAdmin ? 'Register your first scanner above.' : 'Ask an admin to register one.'}</p>
            ) : (
              <div className="space-y-3">
                {devices.map(d => {
                  const online = d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 60000;
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${d.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Cpu className={`w-5 h-5 ${d.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{d.name}</span>
                          <Badge variant="outline" className="text-xs">{d.device_type}</Badge>
                          {online ? <Wifi className="w-3 h-3 text-success" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {d.location || 'No location'} · key {d.api_key_prefix}…
                          {d.last_seen_at && ` · last seen ${formatDistanceToNow(new Date(d.last_seen_at))} ago`}
                        </p>
                      </div>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteDevice(d.id)}>
                          <Trash2 className="w-4 h-4 text-danger" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </Card>

        {/* Simulator */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-accent" /> Scan Simulator
          </h2>
          <p className="text-xs text-muted-foreground mb-4">Test the ingestion endpoint as if a physical scanner were sending events.</p>
          <div className="space-y-3">
            <div>
              <Label>Device Key</Label>
              <Input value={simDeviceKey} onChange={(e) => setSimDeviceKey(e.target.value)} placeholder="iot_..." className="font-mono text-xs" />
            </div>
            <div>
              <Label>Event</Label>
              <Select value={simEvent} onValueChange={(v) => setSimEvent(v as typeof simEvent)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dispense">Dispense (decrement)</SelectItem>
                  <SelectItem value="restock">Restock (increment)</SelectItem>
                  <SelectItem value="lock_open">Cabinet opened</SelectItem>
                  <SelectItem value="lock_close">Cabinet closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(simEvent === 'dispense' || simEvent === 'restock') && (
              <>
                <div>
                  <Label>Scan code (RFID tag or QR)</Label>
                  <Select value={simScanCode} onValueChange={setSimScanCode}>
                    <SelectTrigger><SelectValue placeholder="Pick a tagged medicine…" /></SelectTrigger>
                    <SelectContent>
                      {medicines.filter(m => (m as Medicine & { rfid_tag?: string; qr_code?: string }).rfid_tag || (m as Medicine & { rfid_tag?: string; qr_code?: string }).qr_code).length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">No medicines have RFID/QR tags yet</div>
                      )}
                      {medicines.map(m => {
                        const code = (m as Medicine & { rfid_tag?: string; qr_code?: string }).rfid_tag || (m as Medicine & { rfid_tag?: string; qr_code?: string }).qr_code;
                        if (!code) return null;
                        return <SelectItem key={m.id} value={code}>{m.name} ({code})</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <Input className="mt-2 font-mono text-xs" value={simScanCode} onChange={(e) => setSimScanCode(e.target.value)} placeholder="or type a code" />
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={simQty} onChange={(e) => setSimQty(parseInt(e.target.value) || 1)} />
                </div>
              </>
            )}
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={simNotes} onChange={(e) => setSimNotes(e.target.value)} rows={2} />
            </div>
            <Button onClick={sendSimEvent} disabled={simSubmitting} className="w-full">
              {simSubmitting ? 'Sending…' : 'Send Event'}
            </Button>
            {simResponse && (
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">{simResponse}</pre>
            )}
          </div>
        </Card>
      </div>

      {/* Recent events */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">Recent IoT Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet. Send one from the simulator to see it appear here in real time.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                {eventIcon(ev.event_type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{ev.event_type}</span>
                    {ev.medicine_name && <span className="text-muted-foreground"> · {ev.medicine_name}</span>}
                    {ev.quantity_change !== 0 && (
                      <span className={ev.quantity_change > 0 ? 'text-success ml-1' : 'text-danger ml-1'}>
                        {ev.quantity_change > 0 ? '+' : ''}{ev.quantity_change}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {ev.device_name} · {format(new Date(ev.created_at), 'MMM d, HH:mm:ss')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Type augmentation reference
import type { Medicine } from '@/types/inventory';