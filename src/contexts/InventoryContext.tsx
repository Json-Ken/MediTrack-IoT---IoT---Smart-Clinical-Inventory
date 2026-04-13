import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Medicine, Alert, AuditLog, DispenseRecord, DashboardStats } from '@/types/inventory';
import { supabase } from '@/integrations/supabase/client';

const generateHash = (data: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
};

interface InventoryContextType {
  medicines: Medicine[];
  alerts: Alert[];
  auditLogs: AuditLog[];
  dispenseRecords: DispenseRecord[];
  stats: DashboardStats;
  loading: boolean;
  addMedicine: (medicine: Omit<Medicine, 'id' | 'status'>) => Promise<void>;
  dispenseMedicine: (medicineId: string, quantity: number, userId: string, userName: string, notes?: string) => Promise<{ success: boolean; alert?: Alert }>;
  restockMedicine: (medicineId: string, quantity: number, userId: string, userName: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const getStockStatus = (quantity: number, reorderLevel: number): Medicine['status'] => {
  if (quantity <= 0) return 'critical';
  if (quantity < reorderLevel * 0.5) return 'critical';
  if (quantity < reorderLevel) return 'low';
  return 'ok';
};

function mapMedicine(row: any): Medicine {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: row.quantity,
    reorderLevel: row.reorder_level,
    expiryDate: row.expiry_date || '',
    batchNumber: row.batch_number || '',
    supplier: row.supplier || '',
    unitPrice: Number(row.unit_price) || 0,
    status: row.status as Medicine['status'],
  };
}

function mapAlert(row: any): Alert {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    timestamp: row.created_at,
    acknowledged: row.acknowledged,
    medicineId: row.medicine_id,
  };
}

function mapAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    timestamp: row.created_at,
    action: row.action,
    medicineId: row.medicine_id,
    medicineName: row.medicine_name,
    quantityChange: row.quantity_change,
    userId: row.user_id,
    userName: row.user_name || '',
    prevHash: row.prev_hash || '',
    currHash: row.curr_hash || '',
    details: row.details,
  };
}

function mapDispenseRecord(row: any): DispenseRecord {
  return {
    id: row.id,
    medicineId: row.medicine_id,
    medicineName: row.medicine_name,
    quantity: row.quantity,
    userId: row.user_id,
    userName: row.user_name,
    timestamp: row.created_at,
    notes: row.notes,
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dispenseRecords, setDispenseRecords] = useState<DispenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const [medsRes, alertsRes, logsRes, dispensesRes] = await Promise.all([
      supabase.from('medicines').select('*').order('name'),
      supabase.from('alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }),
      supabase.from('dispense_records').select('*').order('created_at', { ascending: false }),
    ]);

    if (medsRes.data) setMedicines(medsRes.data.map(mapMedicine));
    if (alertsRes.data) setAlerts(alertsRes.data.map(mapAlert));
    if (logsRes.data) setAuditLogs(logsRes.data.map(mapAuditLog));
    if (dispensesRes.data) setDispenseRecords(dispensesRes.data.map(mapDispenseRecord));
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const stats: DashboardStats = {
    totalMedicines: medicines.length,
    lowStockCount: medicines.filter(m => m.status === 'low' || m.status === 'critical').length,
    expiringCount: medicines.filter(m => {
      if (!m.expiryDate) return false;
      const diff = new Date(m.expiryDate).getTime() - Date.now();
      return diff > 0 && diff < 90 * 86400000;
    }).length,
    theftAlerts: alerts.filter(a => a.type === 'theft').length,
    todayDispensed: dispenseRecords
      .filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, r) => sum + r.quantity, 0),
    todayRestocked: auditLogs
      .filter(l => l.action === 'restock' && new Date(l.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, l) => sum + l.quantityChange, 0),
  };

  const addMedicine = async (medicine: Omit<Medicine, 'id' | 'status'>) => {
    const status = getStockStatus(medicine.quantity, medicine.reorderLevel);
    await supabase.from('medicines').insert({
      name: medicine.name,
      category: medicine.category,
      quantity: medicine.quantity,
      reorder_level: medicine.reorderLevel,
      expiry_date: medicine.expiryDate || null,
      batch_number: medicine.batchNumber,
      supplier: medicine.supplier,
      unit_price: medicine.unitPrice,
      status,
    });
    await refreshData();
  };

  const dispenseMedicine = async (
    medicineId: string, quantity: number, userId: string, userName: string, notes?: string
  ): Promise<{ success: boolean; alert?: Alert }> => {
    const medicine = medicines.find(m => m.id === medicineId);
    if (!medicine || medicine.quantity < quantity) return { success: false };

    const newQuantity = medicine.quantity - quantity;
    const newStatus = getStockStatus(newQuantity, medicine.reorderLevel);
    let newAlert: Alert | undefined;

    // Update medicine quantity
    await supabase.from('medicines').update({ quantity: newQuantity, status: newStatus }).eq('id', medicineId);

    // Theft detection
    const currentHour = new Date().getHours();
    const isAfterHours = currentHour < 6 || currentHour > 22;
    if (quantity > 20 || isAfterHours) {
      const { data: alertData } = await supabase.from('alerts').insert({
        type: 'theft',
        severity: 'critical',
        title: 'Suspicious Withdrawal Detected',
        message: `${userName} withdrew ${quantity} units of ${medicine.name}${isAfterHours ? ' after-hours' : ''}`,
        medicine_id: medicineId,
      }).select().single();
      if (alertData) newAlert = mapAlert(alertData);
    }

    // Low stock alert
    if (newQuantity < medicine.reorderLevel && medicine.quantity >= medicine.reorderLevel) {
      await supabase.from('alerts').insert({
        type: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Alert',
        message: `${medicine.name} is below reorder level (${newQuantity} units remaining)`,
        medicine_id: medicineId,
      });
    }

    // Audit log
    const prevHash = auditLogs[0]?.currHash || 'GENESIS';
    const logData = `${new Date().toISOString()}${medicine.name}${-quantity}${userName}${prevHash}`;
    const currHash = generateHash(logData);

    await supabase.from('audit_logs').insert({
      action: 'dispense',
      medicine_id: medicineId,
      medicine_name: medicine.name,
      quantity_change: -quantity,
      user_id: userId,
      user_name: userName,
      prev_hash: prevHash,
      curr_hash: currHash,
      details: notes,
    });

    // Dispense record
    await supabase.from('dispense_records').insert({
      medicine_id: medicineId,
      medicine_name: medicine.name,
      quantity,
      user_id: userId,
      user_name: userName,
      notes,
    });

    await refreshData();
    return { success: true, alert: newAlert };
  };

  const restockMedicine = async (medicineId: string, quantity: number, userId: string, userName: string) => {
    const medicine = medicines.find(m => m.id === medicineId);
    if (!medicine) return;

    const newQuantity = medicine.quantity + quantity;
    const newStatus = getStockStatus(newQuantity, medicine.reorderLevel);

    await supabase.from('medicines').update({ quantity: newQuantity, status: newStatus }).eq('id', medicineId);

    const prevHash = auditLogs[0]?.currHash || 'GENESIS';
    const logData = `${new Date().toISOString()}${medicine.name}${quantity}${userName}${prevHash}`;
    const currHash = generateHash(logData);

    await supabase.from('audit_logs').insert({
      action: 'restock',
      medicine_id: medicineId,
      medicine_name: medicine.name,
      quantity_change: quantity,
      user_id: userId,
      user_name: userName,
      prev_hash: prevHash,
      curr_hash: currHash,
      details: 'Manual restock',
    });

    await refreshData();
  };

  const acknowledgeAlert = async (alertId: string) => {
    await supabase.from('alerts').update({ acknowledged: true }).eq('id', alertId);
    await refreshData();
  };

  return (
    <InventoryContext.Provider
      value={{
        medicines, alerts, auditLogs, dispenseRecords, stats, loading,
        addMedicine, dispenseMedicine, restockMedicine, acknowledgeAlert, refreshData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
