 import React, { createContext, useContext, useState, ReactNode } from 'react';
 import { Medicine, Alert, AuditLog, DispenseRecord, DashboardStats } from '@/types/inventory';
 import { mockMedicines, mockAlerts, mockAuditLogs, mockDispenseRecords, mockDashboardStats } from '@/data/mockData';
 
 // Simple hash function for demo
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
    addMedicine: (medicine: Omit<Medicine, 'id' | 'status'>) => void;
    dispenseMedicine: (medicineId: string, quantity: number, userId: string, userName: string, notes?: string) => { success: boolean; alert?: Alert };
    restockMedicine: (medicineId: string, quantity: number, userId: string, userName: string) => void;
    acknowledgeAlert: (alertId: string) => void;
  }
 
 const InventoryContext = createContext<InventoryContextType | undefined>(undefined);
 
 export function InventoryProvider({ children }: { children: ReactNode }) {
   const [medicines, setMedicines] = useState<Medicine[]>(mockMedicines);
   const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
   const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
   const [dispenseRecords, setDispenseRecords] = useState<DispenseRecord[]>(mockDispenseRecords);
   const [stats, setStats] = useState<DashboardStats>(mockDashboardStats);
 
   const getStockStatus = (quantity: number, reorderLevel: number): Medicine['status'] => {
     if (quantity <= 0) return 'critical';
     if (quantity < reorderLevel * 0.5) return 'critical';
     if (quantity < reorderLevel) return 'low';
     return 'ok';
   };
 
   const dispenseMedicine = (
     medicineId: string,
     quantity: number,
     userId: string,
     userName: string,
     notes?: string
   ): { success: boolean; alert?: Alert } => {
     const medicine = medicines.find(m => m.id === medicineId);
     if (!medicine || medicine.quantity < quantity) {
       return { success: false };
     }
 
     const newQuantity = medicine.quantity - quantity;
     const newStatus = getStockStatus(newQuantity, medicine.reorderLevel);
     let newAlert: Alert | undefined;
 
     // Check for theft (>20 units or after-hours)
     const currentHour = new Date().getHours();
     const isAfterHours = currentHour < 6 || currentHour > 22;
     
     if (quantity > 20 || isAfterHours) {
       newAlert = {
         id: Date.now().toString(),
         type: 'theft',
         severity: 'critical',
         title: 'Suspicious Withdrawal Detected',
         message: `${userName} withdrew ${quantity} units of ${medicine.name}${isAfterHours ? ' after-hours' : ''}`,
         timestamp: new Date().toISOString(),
         acknowledged: false,
         medicineId,
       };
       setAlerts(prev => [newAlert!, ...prev]);
       setStats(prev => ({ ...prev, theftAlerts: prev.theftAlerts + 1 }));
     }
 
     // Check for low stock
     if (newQuantity < medicine.reorderLevel && medicine.quantity >= medicine.reorderLevel) {
       const lowStockAlert: Alert = {
         id: (Date.now() + 1).toString(),
         type: 'low_stock',
         severity: 'warning',
         title: 'Low Stock Alert',
         message: `${medicine.name} is below reorder level (${newQuantity} units remaining)`,
         timestamp: new Date().toISOString(),
         acknowledged: false,
         medicineId,
       };
       setAlerts(prev => [lowStockAlert, ...prev]);
       setStats(prev => ({ ...prev, lowStockCount: prev.lowStockCount + 1 }));
     }
 
     // Update medicine
     setMedicines(prev =>
       prev.map(m =>
         m.id === medicineId ? { ...m, quantity: newQuantity, status: newStatus } : m
       )
     );
 
     // Add audit log
     const prevHash = auditLogs[0]?.currHash || 'GENESIS';
     const logData = `${new Date().toISOString()}${medicine.name}${-quantity}${userName}${prevHash}`;
     const currHash = generateHash(logData);
 
     const newLog: AuditLog = {
       id: Date.now().toString(),
       timestamp: new Date().toISOString(),
       action: 'dispense',
       medicineId,
       medicineName: medicine.name,
       quantityChange: -quantity,
       userId,
       userName,
       prevHash,
       currHash,
       details: notes,
     };
     setAuditLogs(prev => [newLog, ...prev]);
 
     // Add dispense record
     const newRecord: DispenseRecord = {
       id: Date.now().toString(),
       medicineId,
       medicineName: medicine.name,
       quantity,
       userId,
       userName,
       timestamp: new Date().toISOString(),
       notes,
     };
     setDispenseRecords(prev => [newRecord, ...prev]);
 
     setStats(prev => ({ ...prev, todayDispensed: prev.todayDispensed + quantity }));
 
     return { success: true, alert: newAlert };
   };
 
   const restockMedicine = (
     medicineId: string,
     quantity: number,
     userId: string,
     userName: string
   ) => {
     const medicine = medicines.find(m => m.id === medicineId);
     if (!medicine) return;
 
     const newQuantity = medicine.quantity + quantity;
     const newStatus = getStockStatus(newQuantity, medicine.reorderLevel);
 
     setMedicines(prev =>
       prev.map(m =>
         m.id === medicineId ? { ...m, quantity: newQuantity, status: newStatus } : m
       )
     );
 
     const prevHash = auditLogs[0]?.currHash || 'GENESIS';
     const logData = `${new Date().toISOString()}${medicine.name}${quantity}${userName}${prevHash}`;
     const currHash = generateHash(logData);
 
     const newLog: AuditLog = {
       id: Date.now().toString(),
       timestamp: new Date().toISOString(),
       action: 'restock',
       medicineId,
       medicineName: medicine.name,
       quantityChange: quantity,
       userId,
       userName,
       prevHash,
       currHash,
       details: 'Manual restock',
     };
     setAuditLogs(prev => [newLog, ...prev]);
     setStats(prev => ({ ...prev, todayRestocked: prev.todayRestocked + quantity }));
   };
 
    const addMedicine = (medicine: Omit<Medicine, 'id' | 'status'>) => {
      const status = getStockStatus(medicine.quantity, medicine.reorderLevel);
      const newMedicine: Medicine = {
        ...medicine,
        id: Date.now().toString(),
        status,
      };
      setMedicines(prev => [...prev, newMedicine]);
      setStats(prev => ({ ...prev, totalMedicines: prev.totalMedicines + 1 }));
    };

    const acknowledgeAlert = (alertId: string) => {
      setAlerts(prev =>
        prev.map(a => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
    };

    return (
      <InventoryContext.Provider
        value={{
          medicines,
          alerts,
          auditLogs,
          dispenseRecords,
          stats,
          addMedicine,
          dispenseMedicine,
          restockMedicine,
          acknowledgeAlert,
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