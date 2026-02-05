 import { motion } from 'framer-motion';
 import { AlertTriangle, ShieldAlert, Package, Clock, Check, X } from 'lucide-react';
 import { Alert } from '@/types/inventory';
 import { Button } from '@/components/ui/button';
 import { cn } from '@/lib/utils';
 import { formatDistanceToNow } from 'date-fns';
 
 interface AlertsPanelProps {
   alerts: Alert[];
   onAcknowledge: (id: string) => void;
   limit?: number;
 }
 
 const alertIcons = {
   theft: ShieldAlert,
   low_stock: Package,
   expiry: Clock,
   reorder: Package,
 };
 
 const alertStyles = {
   theft: {
     bg: 'bg-danger/10',
     border: 'border-danger/30',
     icon: 'text-danger',
     badge: 'bg-danger text-danger-foreground',
   },
   low_stock: {
     bg: 'bg-warning/10',
     border: 'border-warning/30',
     icon: 'text-warning',
     badge: 'bg-warning text-warning-foreground',
   },
   expiry: {
     bg: 'bg-danger/10',
     border: 'border-danger/30',
     icon: 'text-danger',
     badge: 'bg-danger text-danger-foreground',
   },
   reorder: {
     bg: 'bg-accent/10',
     border: 'border-accent/30',
     icon: 'text-accent',
     badge: 'bg-accent text-accent-foreground',
   },
 };
 
 export function AlertsPanel({ alerts, onAcknowledge, limit }: AlertsPanelProps) {
   const displayAlerts = limit ? alerts.slice(0, limit) : alerts;
   const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, delay: 0.3 }}
       className="bg-card rounded-2xl border shadow-md overflow-hidden"
     >
       <div className="p-6 border-b border-border flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="p-2 rounded-xl bg-danger/10">
             <AlertTriangle className="w-5 h-5 text-danger" />
           </div>
           <div>
             <h3 className="font-semibold text-foreground">Active Alerts</h3>
             <p className="text-sm text-muted-foreground">
               {unacknowledgedCount} unacknowledged
             </p>
           </div>
         </div>
         {unacknowledgedCount > 0 && (
           <span className="px-3 py-1 bg-danger text-danger-foreground text-sm font-medium rounded-full animate-pulse-soft">
             {unacknowledgedCount} New
           </span>
         )}
       </div>
 
       <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
         {displayAlerts.length === 0 ? (
           <div className="p-8 text-center text-muted-foreground">
             <Check className="w-12 h-12 mx-auto mb-3 text-success" />
             <p>No active alerts</p>
           </div>
         ) : (
           displayAlerts.map((alert, index) => {
             const Icon = alertIcons[alert.type];
             const styles = alertStyles[alert.type];
 
             return (
               <motion.div
                 key={alert.id}
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: index * 0.05 }}
                 className={cn(
                   'p-4 flex items-start gap-4 transition-colors',
                   alert.acknowledged ? 'opacity-60' : styles.bg
                 )}
               >
                 <div className={cn('p-2 rounded-xl', styles.bg)}>
                   <Icon className={cn('w-5 h-5', styles.icon)} />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', styles.badge)}>
                       {alert.type.replace('_', ' ').toUpperCase()}
                     </span>
                     <span className="text-xs text-muted-foreground">
                       {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                     </span>
                   </div>
                   <h4 className="font-medium text-foreground">{alert.title}</h4>
                   <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                 </div>
                 {!alert.acknowledged && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onAcknowledge(alert.id)}
                     className="text-muted-foreground hover:text-foreground"
                   >
                     <X className="w-4 h-4" />
                   </Button>
                 )}
               </motion.div>
             );
           })
         )}
       </div>
     </motion.div>
   );
 }