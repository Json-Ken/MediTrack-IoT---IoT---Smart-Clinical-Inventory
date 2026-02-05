 import { motion } from 'framer-motion';
 import { Package, AlertTriangle, Clock, Shield, TrendingUp, TrendingDown, Activity } from 'lucide-react';
 import { StatCard } from '@/components/dashboard/StatCard';
 import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
 import { InventoryChart } from '@/components/dashboard/InventoryChart';
 import { useInventory } from '@/contexts/InventoryContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { format } from 'date-fns';
 
 export function DashboardPage() {
   const { stats, medicines, alerts, acknowledgeAlert } = useInventory();
   const { user } = useAuth();
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <motion.div
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
         className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
       >
         <div>
           <h1 className="text-3xl font-bold text-foreground">
             Welcome back, {user?.name?.split(' ')[0]}
           </h1>
           <p className="text-muted-foreground mt-1">
             {format(new Date(), 'EEEE, MMMM d, yyyy')} • Real-time inventory overview
           </p>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full">
           <Activity className="w-4 h-4" />
           <span className="text-sm font-medium">System Online</span>
         </div>
       </motion.div>
 
       {/* Stats Grid */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard
           title="Total Medicines"
           value={stats.totalMedicines}
           icon={Package}
           trend={{ value: 5, isPositive: true }}
           delay={0}
         />
         <StatCard
           title="Low Stock Items"
           value={stats.lowStockCount}
           icon={TrendingDown}
           variant="warning"
           delay={0.1}
         />
         <StatCard
           title="Expiring Soon"
           value={stats.expiringCount}
           icon={Clock}
           variant="danger"
           delay={0.2}
         />
         <StatCard
           title="Theft Alerts"
           value={stats.theftAlerts}
           icon={Shield}
           variant={stats.theftAlerts > 0 ? 'danger' : 'success'}
           delay={0.3}
         />
       </div>
 
       {/* Activity Stats */}
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <StatCard
           title="Dispensed Today"
           value={`${stats.todayDispensed} units`}
           icon={TrendingUp}
           trend={{ value: 12, isPositive: false }}
           variant="default"
           delay={0.4}
         />
         <StatCard
           title="Restocked Today"
           value={`${stats.todayRestocked} units`}
           icon={Package}
           trend={{ value: 25, isPositive: true }}
           variant="success"
           delay={0.5}
         />
       </div>
 
       {/* Charts and Alerts */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <InventoryChart medicines={medicines} />
         <AlertsPanel alerts={alerts} onAcknowledge={acknowledgeAlert} limit={5} />
       </div>
     </div>
   );
 }