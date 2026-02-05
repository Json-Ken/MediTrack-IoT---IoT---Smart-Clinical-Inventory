 import { motion } from 'framer-motion';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
 import { Medicine } from '@/types/inventory';
 import { TrendingUp } from 'lucide-react';
 
 interface InventoryChartProps {
   medicines: Medicine[];
 }
 
 const statusColors = {
   ok: 'hsl(142, 76%, 36%)',
   low: 'hsl(38, 92%, 50%)',
   critical: 'hsl(0, 84%, 60%)',
   expired: 'hsl(0, 0%, 60%)',
 };
 
 export function InventoryChart({ medicines }: InventoryChartProps) {
   const chartData = medicines.map(m => ({
     name: m.name.split(' ')[0],
     fullName: m.name,
     quantity: m.quantity,
     reorderLevel: m.reorderLevel,
     status: m.status,
   }));
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, delay: 0.2 }}
       className="bg-card rounded-2xl border shadow-md p-6"
     >
       <div className="flex items-center gap-3 mb-6">
         <div className="p-2 rounded-xl bg-accent/10">
           <TrendingUp className="w-5 h-5 text-accent" />
         </div>
         <div>
           <h3 className="font-semibold text-foreground">Inventory Levels</h3>
           <p className="text-sm text-muted-foreground">Current stock overview</p>
         </div>
       </div>
 
       <div className="h-[300px]">
         <ResponsiveContainer width="100%" height="100%">
           <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
             <XAxis 
               dataKey="name" 
               tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
               tickLine={{ stroke: 'hsl(var(--border))' }}
               axisLine={{ stroke: 'hsl(var(--border))' }}
               angle={-45}
               textAnchor="end"
               height={60}
             />
             <YAxis 
               tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
               tickLine={{ stroke: 'hsl(var(--border))' }}
               axisLine={{ stroke: 'hsl(var(--border))' }}
             />
             <Tooltip
               contentStyle={{
                 backgroundColor: 'hsl(var(--card))',
                 border: '1px solid hsl(var(--border))',
                 borderRadius: '12px',
                 boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
               }}
               labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
               formatter={(value: number, name: string, props: any) => [
                 `${value} units`,
                 props.payload.fullName
               ]}
             />
             <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
               {chartData.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={statusColors[entry.status]} />
               ))}
             </Bar>
           </BarChart>
         </ResponsiveContainer>
       </div>
 
       {/* Legend */}
       <div className="flex items-center justify-center gap-6 mt-4">
         {Object.entries(statusColors).map(([status, color]) => (
           <div key={status} className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
             <span className="text-xs text-muted-foreground capitalize">{status}</span>
           </div>
         ))}
       </div>
     </motion.div>
   );
 }