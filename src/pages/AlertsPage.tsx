 import { motion } from 'framer-motion';
 import { AlertTriangle, Bell, Shield, BellOff } from 'lucide-react';
 import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
 import { useInventory } from '@/contexts/InventoryContext';
 import { Button } from '@/components/ui/button';
 
 export function AlertsPage() {
   const { alerts, acknowledgeAlert } = useInventory();
 
   const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
 
   const acknowledgeAll = () => {
     alerts.filter(a => !a.acknowledged).forEach(a => acknowledgeAlert(a.id));
   };
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <motion.div
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
         className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
       >
         <div>
           <h1 className="text-3xl font-bold text-foreground">Alerts Center</h1>
           <p className="text-muted-foreground mt-1">
             {unacknowledgedCount} active alerts requiring attention
           </p>
         </div>
         {unacknowledgedCount > 0 && (
           <Button
             variant="outline"
             onClick={acknowledgeAll}
             className="flex items-center gap-2"
           >
             <BellOff className="w-4 h-4" />
             Acknowledge All
           </Button>
         )}
       </motion.div>
 
       {/* Summary Cards */}
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.1 }}
         className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
       >
         {[
           {
             type: 'theft',
             label: 'Theft Alerts',
             count: alerts.filter(a => a.type === 'theft').length,
             icon: Shield,
             color: 'bg-danger/10 text-danger',
           },
           {
             type: 'low_stock',
             label: 'Low Stock',
             count: alerts.filter(a => a.type === 'low_stock').length,
             icon: AlertTriangle,
             color: 'bg-warning/10 text-warning',
           },
           {
             type: 'expiry',
             label: 'Expiry Alerts',
             count: alerts.filter(a => a.type === 'expiry').length,
             icon: Bell,
             color: 'bg-danger/10 text-danger',
           },
           {
             type: 'reorder',
             label: 'Auto-Reorders',
             count: alerts.filter(a => a.type === 'reorder').length,
             icon: Bell,
             color: 'bg-accent/10 text-accent',
           },
         ].map((item, index) => (
           <motion.div
             key={item.type}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1 + index * 0.05 }}
             className="bg-card rounded-2xl border shadow-md p-5"
           >
             <div className="flex items-center gap-3">
               <div className={`p-3 rounded-xl ${item.color}`}>
                 <item.icon className="w-5 h-5" />
               </div>
               <div>
                 <p className="text-2xl font-bold text-foreground">{item.count}</p>
                 <p className="text-sm text-muted-foreground">{item.label}</p>
               </div>
             </div>
           </motion.div>
         ))}
       </motion.div>
 
       {/* All Alerts */}
       <AlertsPanel alerts={alerts} onAcknowledge={acknowledgeAlert} />
     </div>
   );
 }