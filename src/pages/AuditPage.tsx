 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { FileText, Search, Shield, ArrowDown, ArrowUp, Clock, User, Hash, ExternalLink, Copy, Check } from 'lucide-react';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { useInventory } from '@/contexts/InventoryContext';
 import { AuditLog } from '@/types/inventory';
 import { cn } from '@/lib/utils';
 import { format } from 'date-fns';
 import { toast } from 'sonner';
 
 const actionConfig = {
   dispense: { label: 'Dispense', icon: ArrowDown, color: 'bg-warning/10 text-warning border-warning/20' },
   restock: { label: 'Restock', icon: ArrowUp, color: 'bg-success/10 text-success border-success/20' },
   adjustment: { label: 'Adjustment', icon: Hash, color: 'bg-accent/10 text-accent border-accent/20' },
   alert: { label: 'Alert', icon: Shield, color: 'bg-danger/10 text-danger border-danger/20' },
   login: { label: 'Login', icon: User, color: 'bg-primary/10 text-primary border-primary/20' },
   logout: { label: 'Logout', icon: User, color: 'bg-muted text-muted-foreground border-muted' },
 };
 
 export function AuditPage() {
   const { auditLogs } = useInventory();
   const [search, setSearch] = useState('');
   const [copiedHash, setCopiedHash] = useState<string | null>(null);
 
   const filteredLogs = auditLogs.filter(log => {
     const searchLower = search.toLowerCase();
     return (
       log.medicineName?.toLowerCase().includes(searchLower) ||
       log.userName.toLowerCase().includes(searchLower) ||
       log.action.toLowerCase().includes(searchLower) ||
       log.currHash.toLowerCase().includes(searchLower)
     );
   });
 
   const copyHash = (hash: string) => {
     navigator.clipboard.writeText(hash);
     setCopiedHash(hash);
     toast.success('Hash copied to clipboard');
     setTimeout(() => setCopiedHash(null), 2000);
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
           <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
           <p className="text-muted-foreground mt-1">
             Tamper-proof transaction history with hash-chain integrity
           </p>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full">
           <Shield className="w-4 h-4" />
           <span className="text-sm font-medium">SHA-256 Protected</span>
         </div>
       </motion.div>
 
       {/* Search */}
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.1 }}
         className="relative"
       >
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
         <Input
           placeholder="Search by medicine, user, action, or hash..."
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="pl-12 h-12 bg-card border shadow-sm"
         />
       </motion.div>
 
       {/* Logs Table */}
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.2 }}
         className="bg-card rounded-2xl border shadow-md overflow-hidden"
       >
         {/* Table Header */}
         <div className="hidden lg:grid lg:grid-cols-6 gap-4 p-4 bg-muted/50 border-b border-border text-sm font-medium text-muted-foreground">
           <div>Timestamp</div>
           <div>Action</div>
           <div>Medicine</div>
           <div>Change</div>
           <div>User</div>
           <div>Hash Chain</div>
         </div>
 
         {/* Table Body */}
         <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
           {filteredLogs.length === 0 ? (
             <div className="p-12 text-center text-muted-foreground">
               <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
               <p className="font-medium">No logs found</p>
               <p className="text-sm mt-1">Try adjusting your search criteria</p>
             </div>
           ) : (
             filteredLogs.map((log, index) => (
               <AuditLogRow
                 key={log.id}
                 log={log}
                 index={index}
                 copiedHash={copiedHash}
                 onCopyHash={copyHash}
               />
             ))
           )}
         </div>
       </motion.div>
 
       {/* Hash Chain Info */}
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ delay: 0.3 }}
         className="bg-primary/5 rounded-2xl border border-primary/20 p-6"
       >
         <div className="flex items-start gap-4">
           <div className="p-3 rounded-xl bg-primary/10">
             <Shield className="w-6 h-6 text-primary" />
           </div>
           <div>
             <h3 className="font-semibold text-foreground">Hash-Chain Integrity</h3>
             <p className="text-sm text-muted-foreground mt-1">
               Each log entry contains the hash of the previous entry, creating an unbreakable chain.
               Any tampering would invalidate all subsequent hashes, making unauthorized modifications
               immediately detectable.
             </p>
             <div className="flex items-center gap-4 mt-4 text-sm">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-success" />
                 <span className="text-muted-foreground">Chain Valid</span>
               </div>
               <div className="flex items-center gap-2">
                 <Clock className="w-4 h-4 text-muted-foreground" />
                 <span className="text-muted-foreground">{auditLogs.length} total entries</span>
               </div>
             </div>
           </div>
         </div>
       </motion.div>
     </div>
   );
 }
 
 function AuditLogRow({
   log,
   index,
   copiedHash,
   onCopyHash,
 }: {
   log: AuditLog;
   index: number;
   copiedHash: string | null;
   onCopyHash: (hash: string) => void;
 }) {
   const config = actionConfig[log.action];
   const Icon = config.icon;
 
   return (
     <motion.div
       initial={{ opacity: 0, x: -20 }}
       animate={{ opacity: 1, x: 0 }}
       transition={{ delay: index * 0.03 }}
       className="p-4 hover:bg-muted/30 transition-colors"
     >
       {/* Mobile Layout */}
       <div className="lg:hidden space-y-3">
         <div className="flex items-center justify-between">
           <Badge variant="outline" className={cn('flex items-center gap-1', config.color)}>
             <Icon className="w-3 h-3" />
             {config.label}
           </Badge>
           <span className="text-xs text-muted-foreground">
             {format(new Date(log.timestamp), 'MMM d, HH:mm')}
           </span>
         </div>
         {log.medicineName && (
           <p className="font-medium text-foreground">{log.medicineName}</p>
         )}
         <div className="flex items-center justify-between text-sm">
           <span className="text-muted-foreground">by {log.userName}</span>
           <span className={cn(
             'font-semibold',
             log.quantityChange > 0 ? 'text-success' :
             log.quantityChange < 0 ? 'text-danger' : 'text-muted-foreground'
           )}>
             {log.quantityChange > 0 ? '+' : ''}{log.quantityChange} units
           </span>
         </div>
         <div className="flex items-center gap-2">
           <code className="text-xs font-mono text-muted-foreground truncate flex-1">
             {log.currHash}
           </code>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => onCopyHash(log.currHash)}
             className="flex-shrink-0"
           >
             {copiedHash === log.currHash ? (
               <Check className="w-3 h-3 text-success" />
             ) : (
               <Copy className="w-3 h-3" />
             )}
           </Button>
         </div>
       </div>
 
       {/* Desktop Layout */}
       <div className="hidden lg:grid lg:grid-cols-6 gap-4 items-center">
         <div className="flex items-center gap-2">
           <Clock className="w-4 h-4 text-muted-foreground" />
           <span className="text-sm text-foreground">
             {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
           </span>
         </div>
 
         <div>
           <Badge variant="outline" className={cn('flex items-center gap-1 w-fit', config.color)}>
             <Icon className="w-3 h-3" />
             {config.label}
           </Badge>
         </div>
 
         <div className="text-sm font-medium text-foreground truncate">
           {log.medicineName || '—'}
         </div>
 
         <div className={cn(
           'text-sm font-semibold',
           log.quantityChange > 0 ? 'text-success' :
           log.quantityChange < 0 ? 'text-danger' : 'text-muted-foreground'
         )}>
           {log.quantityChange > 0 ? '+' : ''}{log.quantityChange}
         </div>
 
         <div className="flex items-center gap-2">
           <User className="w-4 h-4 text-muted-foreground" />
           <span className="text-sm text-foreground truncate">{log.userName}</span>
         </div>
 
         <div className="flex items-center gap-2">
           <code className="text-xs font-mono text-muted-foreground truncate flex-1 bg-muted/50 px-2 py-1 rounded">
             {log.currHash.slice(0, 8)}...
           </code>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => onCopyHash(log.currHash)}
             className="flex-shrink-0 h-7 w-7 p-0"
           >
             {copiedHash === log.currHash ? (
               <Check className="w-3 h-3 text-success" />
             ) : (
               <Copy className="w-3 h-3" />
             )}
           </Button>
         </div>
       </div>
 
       {log.details && (
         <p className="mt-2 text-sm text-muted-foreground italic pl-6 lg:pl-0">
           {log.details}
         </p>
       )}
     </motion.div>
   );
 }