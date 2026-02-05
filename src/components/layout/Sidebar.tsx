 import { motion } from 'framer-motion';
 import { 
   LayoutDashboard, 
   Pill, 
   ClipboardList, 
   FileText, 
   AlertTriangle,
   Settings,
   LogOut,
   ChevronLeft,
   ChevronRight
 } from 'lucide-react';
 import { cn } from '@/lib/utils';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { useState } from 'react';
 
 interface SidebarProps {
   currentPage: string;
   onNavigate: (page: string) => void;
 }
 
 const navItems = [
   { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
   { id: 'inventory', label: 'Inventory', icon: Pill },
   { id: 'dispense', label: 'Dispense', icon: ClipboardList },
   { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
   { id: 'audit', label: 'Audit Logs', icon: FileText },
 ];
 
 export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
   const { user, logout } = useAuth();
   const [collapsed, setCollapsed] = useState(false);
 
  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0, width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-screen sidebar-gradient flex-col z-50 hidden lg:flex"
    >
       {/* Logo */}
       <div className="p-6 border-b border-sidebar-border">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
             <Pill className="w-6 h-6 text-accent-foreground" />
           </div>
           {!collapsed && (
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
             >
               <h1 className="text-lg font-bold text-sidebar-foreground">MediTrack</h1>
               <p className="text-xs text-sidebar-foreground/60">IoT Inventory</p>
             </motion.div>
           )}
         </div>
       </div>
 
       {/* Navigation */}
       <nav className="flex-1 p-4 space-y-2">
         {navItems.map((item, index) => {
           const Icon = item.icon;
           const isActive = currentPage === item.id;
           
           // Auditors can only see audit logs and dashboard
           if (user?.role === 'auditor' && !['dashboard', 'audit'].includes(item.id)) {
             return null;
           }
 
           return (
             <motion.button
               key={item.id}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: index * 0.05 }}
               onClick={() => onNavigate(item.id)}
               className={cn(
                 'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                 isActive
                   ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                   : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
               )}
             >
               <Icon className="w-5 h-5 flex-shrink-0" />
               {!collapsed && <span className="font-medium">{item.label}</span>}
               {item.id === 'alerts' && !collapsed && (
                 <span className="ml-auto bg-danger text-danger-foreground text-xs px-2 py-0.5 rounded-full animate-pulse-soft">
                   2
                 </span>
               )}
             </motion.button>
           );
         })}
       </nav>
 
       {/* User Info */}
       <div className="p-4 border-t border-sidebar-border">
         <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
           <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
             <span className="text-sm font-semibold text-sidebar-foreground">
               {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
             </span>
           </div>
           {!collapsed && (
             <div className="flex-1 min-w-0">
               <p className="text-sm font-medium text-sidebar-foreground truncate">
                 {user?.name}
               </p>
               <p className="text-xs text-sidebar-foreground/60 capitalize">
                 {user?.role}
               </p>
             </div>
           )}
         </div>
         
         <div className={cn('mt-4 flex gap-2', collapsed && 'flex-col')}>
           <Button
             variant="ghost"
             size="sm"
             onClick={() => setCollapsed(!collapsed)}
             className="flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
           >
             {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
           </Button>
           <Button
             variant="ghost"
             size="sm"
             onClick={logout}
             className="flex-1 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
           >
             <LogOut className="w-4 h-4" />
             {!collapsed && <span className="ml-2">Logout</span>}
           </Button>
         </div>
       </div>
     </motion.aside>
   );
 }