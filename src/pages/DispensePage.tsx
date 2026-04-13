 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { Pill, Send, AlertTriangle, CheckCircle, Package } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useInventory } from '@/contexts/InventoryContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { cn } from '@/lib/utils';
 import { toast } from 'sonner';
 
 export function DispensePage() {
   const { medicines, dispenseMedicine, dispenseRecords } = useInventory();
   const { user } = useAuth();
   const [selectedMedicine, setSelectedMedicine] = useState('');
   const [quantity, setQuantity] = useState('');
   const [notes, setNotes] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const availableMedicines = medicines.filter(m => m.status !== 'expired' && m.quantity > 0);
   const selectedMed = medicines.find(m => m.id === selectedMedicine);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!selectedMedicine || !quantity || !user) return;
 
     const qty = parseInt(quantity);
     if (isNaN(qty) || qty <= 0) {
       toast.error('Please enter a valid quantity');
       return;
     }
 
     if (selectedMed && qty > selectedMed.quantity) {
       toast.error(`Only ${selectedMed.quantity} units available`);
       return;
     }
 
     setIsSubmitting(true);
 
     // Simulate processing time
     await new Promise(resolve => setTimeout(resolve, 500));
 
     const result = await dispenseMedicine(selectedMedicine, qty, user.id, user.name, notes || undefined);
 
     if (result.success) {
       if (result.alert) {
         toast.error(result.alert.title, {
           description: result.alert.message,
           duration: 5000,
         });
       } else {
         toast.success('Medicine dispensed successfully', {
           description: `${qty} units of ${selectedMed?.name} recorded`,
         });
       }
       setSelectedMedicine('');
       setQuantity('');
       setNotes('');
     } else {
       toast.error('Failed to dispense medicine');
     }
 
     setIsSubmitting(false);
   };
 
   const showTheftWarning = selectedMed && parseInt(quantity) > 20;
   const showLowStockWarning = selectedMed && 
     (selectedMed.quantity - parseInt(quantity || '0')) < selectedMed.reorderLevel;
 
   return (
     <div className="space-y-6">
       {/* Header */}
       <motion.div
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
       >
         <h1 className="text-3xl font-bold text-foreground">Dispense Medicine</h1>
         <p className="text-muted-foreground mt-1">
           Record medicine dispensing with automated alerts
         </p>
       </motion.div>
 
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Dispense Form */}
         <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.1 }}
           className="bg-card rounded-2xl border shadow-md p-6"
         >
           <div className="flex items-center gap-3 mb-6">
             <div className="p-3 rounded-xl bg-primary/10">
               <Pill className="w-6 h-6 text-primary" />
             </div>
             <div>
               <h2 className="text-lg font-semibold text-foreground">Dispense Form</h2>
               <p className="text-sm text-muted-foreground">Fill in the details below</p>
             </div>
           </div>
 
           <form onSubmit={handleSubmit} className="space-y-5">
             {/* Medicine Selection */}
             <div className="space-y-2">
               <Label className="text-foreground">Medicine</Label>
               <Select value={selectedMedicine} onValueChange={setSelectedMedicine}>
                 <SelectTrigger className="h-12">
                   <SelectValue placeholder="Select medicine" />
                 </SelectTrigger>
                 <SelectContent>
                   {availableMedicines.map((med) => (
                     <SelectItem key={med.id} value={med.id}>
                       <div className="flex items-center justify-between w-full gap-4">
                         <span>{med.name}</span>
                         <span className={cn(
                           'text-xs',
                           med.status === 'ok' ? 'text-success' :
                           med.status === 'low' ? 'text-warning' : 'text-danger'
                         )}>
                           {med.quantity} units
                         </span>
                       </div>
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             {/* Selected Medicine Info */}
             <AnimatePresence>
               {selectedMed && (
                 <motion.div
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: 'auto' }}
                   exit={{ opacity: 0, height: 0 }}
                   className="p-4 bg-muted/50 rounded-xl"
                 >
                   <div className="grid grid-cols-2 gap-4 text-sm">
                     <div>
                       <p className="text-muted-foreground">Available</p>
                       <p className="font-semibold text-foreground">{selectedMed.quantity} units</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Reorder Level</p>
                       <p className="font-semibold text-foreground">{selectedMed.reorderLevel} units</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Batch</p>
                       <p className="font-semibold text-foreground">{selectedMed.batchNumber}</p>
                     </div>
                     <div>
                       <p className="text-muted-foreground">Category</p>
                       <p className="font-semibold text-foreground">{selectedMed.category}</p>
                     </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
 
             {/* Quantity */}
             <div className="space-y-2">
               <Label className="text-foreground">Quantity</Label>
               <Input
                 type="number"
                 placeholder="Enter quantity"
                 value={quantity}
                 onChange={(e) => setQuantity(e.target.value)}
                 min="1"
                 max={selectedMed?.quantity}
                 className="h-12"
               />
             </div>
 
             {/* Warnings */}
             <AnimatePresence>
               {showTheftWarning && (
                 <motion.div
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/20 rounded-xl"
                 >
                   <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                   <div>
                     <p className="font-medium text-danger">Theft Alert Warning</p>
                     <p className="text-sm text-danger/80">
                       Withdrawing more than 20 units will trigger a security alert.
                     </p>
                   </div>
                 </motion.div>
               )}
 
               {showLowStockWarning && !showTheftWarning && (
                 <motion.div
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -10 }}
                   className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-xl"
                 >
                   <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                   <div>
                     <p className="font-medium text-warning">Low Stock Warning</p>
                     <p className="text-sm text-warning/80">
                       This will trigger a low stock alert and auto-reorder.
                     </p>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
 
             {/* Notes */}
             <div className="space-y-2">
               <Label className="text-foreground">Notes (Optional)</Label>
               <Textarea
                 placeholder="Add any notes..."
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 className="min-h-[100px] resize-none"
               />
             </div>
 
             {/* Submit */}
             <Button
               type="submit"
               disabled={!selectedMedicine || !quantity || isSubmitting}
               className="w-full h-12 bg-primary hover:bg-primary/90"
             >
               {isSubmitting ? (
                 <motion.div
                   animate={{ rotate: 360 }}
                   transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                   className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                 />
               ) : (
                 <>
                   <Send className="w-4 h-4 mr-2" />
                   Dispense Medicine
                 </>
               )}
             </Button>
           </form>
         </motion.div>
 
         {/* Recent Dispenses */}
         <motion.div
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.2 }}
           className="bg-card rounded-2xl border shadow-md overflow-hidden"
         >
           <div className="p-6 border-b border-border">
             <div className="flex items-center gap-3">
               <div className="p-3 rounded-xl bg-accent/10">
                 <Package className="w-6 h-6 text-accent" />
               </div>
               <div>
                 <h2 className="text-lg font-semibold text-foreground">Recent Dispenses</h2>
                 <p className="text-sm text-muted-foreground">Latest transactions</p>
               </div>
             </div>
           </div>
 
           <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
             {dispenseRecords.length === 0 ? (
               <div className="p-8 text-center text-muted-foreground">
                 <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                 <p>No recent dispenses</p>
               </div>
             ) : (
               dispenseRecords.slice(0, 10).map((record, index) => (
                 <motion.div
                   key={record.id}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: 0.3 + index * 0.05 }}
                   className="p-4 hover:bg-muted/30 transition-colors"
                 >
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="font-medium text-foreground">{record.medicineName}</p>
                       <p className="text-sm text-muted-foreground">
                         by {record.userName}
                       </p>
                     </div>
                     <div className="text-right">
                       <p className="font-semibold text-foreground">-{record.quantity} units</p>
                       <p className="text-xs text-muted-foreground">
                         {new Date(record.timestamp).toLocaleTimeString()}
                       </p>
                     </div>
                   </div>
                   {record.notes && (
                     <p className="mt-2 text-sm text-muted-foreground italic">
                       "{record.notes}"
                     </p>
                   )}
                 </motion.div>
               ))
             )}
           </div>
         </motion.div>
       </div>
     </div>
   );
 }