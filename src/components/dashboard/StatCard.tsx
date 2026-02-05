 import { motion } from 'framer-motion';
 import { LucideIcon } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface StatCardProps {
   title: string;
   value: string | number;
   icon: LucideIcon;
   trend?: {
     value: number;
     isPositive: boolean;
   };
   variant?: 'default' | 'success' | 'warning' | 'danger';
   delay?: number;
 }
 
 const variantStyles = {
   default: 'bg-card',
   success: 'bg-success/10 border-success/20',
   warning: 'bg-warning/10 border-warning/20',
   danger: 'bg-danger/10 border-danger/20',
 };
 
 const iconStyles = {
   default: 'bg-primary/10 text-primary',
   success: 'bg-success/20 text-success',
   warning: 'bg-warning/20 text-warning',
   danger: 'bg-danger/20 text-danger',
 };
 
 export function StatCard({ title, value, icon: Icon, trend, variant = 'default', delay = 0 }: StatCardProps) {
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, delay }}
       className={cn(
         'relative overflow-hidden rounded-2xl border p-6 shadow-md transition-all duration-300 hover:shadow-lg',
         variantStyles[variant]
       )}
     >
       <div className="flex items-start justify-between">
         <div className="space-y-2">
           <p className="text-sm font-medium text-muted-foreground">{title}</p>
           <p className="text-3xl font-bold text-foreground">{value}</p>
           {trend && (
             <p className={cn(
               'text-sm font-medium',
               trend.isPositive ? 'text-success' : 'text-danger'
             )}>
               {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from yesterday
             </p>
           )}
         </div>
         <div className={cn('p-3 rounded-xl', iconStyles[variant])}>
           <Icon className="w-6 h-6" />
         </div>
       </div>
       
       {/* Decorative gradient */}
       <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent" />
     </motion.div>
   );
 }