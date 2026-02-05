 import { useState } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { AuthProvider, useAuth } from '@/contexts/AuthContext';
 import { InventoryProvider } from '@/contexts/InventoryContext';
 import { LoginPage } from './LoginPage';
 import { DashboardPage } from './DashboardPage';
 import { InventoryPage } from './InventoryPage';
 import { DispensePage } from './DispensePage';
 import { AlertsPage } from './AlertsPage';
 import { AuditPage } from './AuditPage';
 import { Sidebar } from '@/components/layout/Sidebar';
 import { cn } from '@/lib/utils';
 
 type Page = 'dashboard' | 'inventory' | 'dispense' | 'alerts' | 'audit';
 
 function AppContent() {
   const { isAuthenticated } = useAuth();
   const [currentPage, setCurrentPage] = useState<Page>('dashboard');
 
   if (!isAuthenticated) {
     return <LoginPage />;
   }
 
   const renderPage = () => {
     switch (currentPage) {
       case 'dashboard':
         return <DashboardPage />;
       case 'inventory':
         return <InventoryPage />;
       case 'dispense':
         return <DispensePage />;
       case 'alerts':
         return <AlertsPage />;
       case 'audit':
         return <AuditPage />;
       default:
         return <DashboardPage />;
     }
   };
 
   return (
     <div className="min-h-screen bg-background">
       <Sidebar currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)} />
       <main className={cn('transition-all duration-300 ml-[280px] p-6 lg:p-8')}>
         <AnimatePresence mode="wait">
           <motion.div
             key={currentPage}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             transition={{ duration: 0.2 }}
           >
             {renderPage()}
           </motion.div>
         </AnimatePresence>
       </main>
     </div>
   );
 }
 
 const Index = () => {
   return (
     <AuthProvider>
       <InventoryProvider>
         <AppContent />
       </InventoryProvider>
     </AuthProvider>
   );
 };
 
 export default Index;
