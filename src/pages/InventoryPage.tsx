 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Search, Filter, Package, AlertTriangle, Clock, CheckCircle, Plus } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { useInventory } from '@/contexts/InventoryContext';
 import { Medicine, StockStatus } from '@/types/inventory';
 import { cn } from '@/lib/utils';
 import { format } from 'date-fns';
 
 const statusConfig: Record<StockStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
   ok: { label: 'In Stock', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' },
   low: { label: 'Low Stock', icon: AlertTriangle, className: 'bg-warning/10 text-warning border-warning/20' },
   critical: { label: 'Critical', icon: AlertTriangle, className: 'bg-danger/10 text-danger border-danger/20' },
   expired: { label: 'Expired', icon: Clock, className: 'bg-muted text-muted-foreground border-muted' },
 };
 
 export function InventoryPage() {
   const { medicines } = useInventory();
   const [search, setSearch] = useState('');
   const [statusFilter, setStatusFilter] = useState<StockStatus | 'all'>('all');
 
   const filteredMedicines = medicines.filter(m => {
     const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
       m.category.toLowerCase().includes(search.toLowerCase());
     const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
     return matchesSearch && matchesStatus;
   });
 
   const statusCounts = {
     all: medicines.length,
     ok: medicines.filter(m => m.status === 'ok').length,
     low: medicines.filter(m => m.status === 'low').length,
     critical: medicines.filter(m => m.status === 'critical').length,
     expired: medicines.filter(m => m.status === 'expired').length,
   };
 
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {medicines.length} medicines tracked • Real-time stock levels
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Medicine
        </Button>
      </motion.div>
 
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl border shadow-md p-3 sm:p-4"
      >
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-muted-foreground" />
            <Input
              placeholder="Search medicines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 sm:pl-12 h-10 sm:h-11 bg-background text-sm"
            />
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'ok', 'low', 'critical', 'expired'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'capitalize text-xs sm:text-sm',
                  statusFilter === status && 'bg-primary text-primary-foreground'
                )}
              >
                {status === 'all' ? 'All' : statusConfig[status].label}
                <span className="ml-1 sm:ml-2 text-xs opacity-70">({statusCounts[status]})</span>
              </Button>
            ))}
          </div>
        </div>
      </motion.div>
 
      {/* Inventory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        <AnimatePresence mode="popLayout">
          {filteredMedicines.map((medicine, index) => (
            <MedicineCard key={medicine.id} medicine={medicine} index={index} />
          ))}
        </AnimatePresence>
      </div>
 
       {filteredMedicines.length === 0 && (
         <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="text-center py-12"
         >
           <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
           <p className="text-muted-foreground">No medicines found matching your criteria</p>
         </motion.div>
       )}
     </div>
   );
 }
 
 function MedicineCard({ medicine, index }: { medicine: Medicine; index: number }) {
   const config = statusConfig[medicine.status];
   const Icon = config.icon;
   const isExpiringSoon = new Date(medicine.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
 
   return (
     <motion.div
       layout
       initial={{ opacity: 0, scale: 0.95 }}
       animate={{ opacity: 1, scale: 1 }}
       exit={{ opacity: 0, scale: 0.95 }}
       transition={{ duration: 0.2, delay: index * 0.03 }}
       className="bg-card rounded-2xl border shadow-md overflow-hidden hover:shadow-lg transition-shadow"
     >
       {/* Header */}
       <div className="p-4 border-b border-border">
         <div className="flex items-start justify-between">
           <div className="flex-1 min-w-0">
             <h3 className="font-semibold text-foreground truncate">{medicine.name}</h3>
             <p className="text-sm text-muted-foreground">{medicine.category}</p>
           </div>
           <Badge variant="outline" className={cn('ml-2 flex-shrink-0', config.className)}>
             <Icon className="w-3 h-3 mr-1" />
             {config.label}
           </Badge>
         </div>
       </div>
 
       {/* Content */}
       <div className="p-4 space-y-3">
         {/* Quantity */}
         <div className="flex items-center justify-between">
           <span className="text-sm text-muted-foreground">Quantity</span>
           <div className="text-right">
             <span className={cn(
               'text-lg font-bold',
               medicine.status === 'ok' ? 'text-foreground' :
               medicine.status === 'low' ? 'text-warning' : 'text-danger'
             )}>
               {medicine.quantity}
             </span>
             <span className="text-sm text-muted-foreground"> / {medicine.reorderLevel} min</span>
           </div>
         </div>
 
         {/* Progress Bar */}
         <div className="h-2 bg-muted rounded-full overflow-hidden">
           <motion.div
             initial={{ width: 0 }}
             animate={{ width: `${Math.min((medicine.quantity / (medicine.reorderLevel * 2)) * 100, 100)}%` }}
             transition={{ duration: 0.5, delay: index * 0.03 }}
             className={cn(
               'h-full rounded-full',
               medicine.status === 'ok' ? 'bg-success' :
               medicine.status === 'low' ? 'bg-warning' : 'bg-danger'
             )}
           />
         </div>
 
         {/* Details */}
         <div className="grid grid-cols-2 gap-3 pt-2">
           <div>
             <p className="text-xs text-muted-foreground">Batch</p>
             <p className="text-sm font-medium text-foreground">{medicine.batchNumber}</p>
           </div>
           <div>
             <p className="text-xs text-muted-foreground">Unit Price</p>
             <p className="text-sm font-medium text-foreground">KSh {medicine.unitPrice}</p>
           </div>
           <div className="col-span-2">
             <p className="text-xs text-muted-foreground">Expiry Date</p>
             <p className={cn(
               'text-sm font-medium',
               medicine.status === 'expired' ? 'text-danger' :
               isExpiringSoon ? 'text-warning' : 'text-foreground'
             )}>
               {format(new Date(medicine.expiryDate), 'MMM d, yyyy')}
               {medicine.status === 'expired' && ' (Expired)'}
               {isExpiringSoon && medicine.status !== 'expired' && ' (Expiring Soon)'}
             </p>
           </div>
         </div>
       </div>
 
       {/* Footer */}
       <div className="px-4 py-3 bg-muted/30 border-t border-border">
         <p className="text-xs text-muted-foreground">
           Supplier: {medicine.supplier}
         </p>
       </div>
     </motion.div>
   );
 }