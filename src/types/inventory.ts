 export type UserRole = 'admin' | 'pharmacist' | 'auditor';
 
 export interface User {
   id: string;
   name: string;
   email: string;
   role: UserRole;
   avatar?: string;
 }
 
 export type StockStatus = 'ok' | 'low' | 'critical' | 'expired';
 
 export interface Medicine {
   id: string;
   name: string;
   category: string;
   quantity: number;
   reorderLevel: number;
   expiryDate: string;
   batchNumber: string;
   supplier: string;
   unitPrice: number;
   status: StockStatus;
 }
 
 export interface DispenseRecord {
   id: string;
   medicineId: string;
   medicineName: string;
   quantity: number;
   userId: string;
   userName: string;
   timestamp: string;
   notes?: string;
 }
 
 export interface AuditLog {
   id: string;
   timestamp: string;
   action: 'dispense' | 'restock' | 'adjustment' | 'alert' | 'login' | 'logout';
   medicineId?: string;
   medicineName?: string;
   quantityChange: number;
   userId: string;
   userName: string;
   prevHash: string;
   currHash: string;
   details?: string;
 }
 
 export interface Alert {
   id: string;
   type: 'theft' | 'low_stock' | 'expiry' | 'reorder';
   severity: 'warning' | 'critical';
   title: string;
   message: string;
   timestamp: string;
   acknowledged: boolean;
   medicineId?: string;
 }
 
 export interface DashboardStats {
   totalMedicines: number;
   lowStockCount: number;
   expiringCount: number;
   theftAlerts: number;
   todayDispensed: number;
   todayRestocked: number;
 }