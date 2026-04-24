import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Pill, 
  ClipboardList, 
  FileText, 
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Cpu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Pill },
  { id: 'dispense', label: 'Dispense', icon: ClipboardList },
  { id: 'iot', label: 'IoT Devices', icon: Cpu },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
];

export function MobileNav({ currentPage, onNavigate }: MobileNavProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-sidebar px-4 flex items-center justify-between z-50 lg:hidden border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <Pill className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">MediTrack</h1>
          </div>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
            {/* Logo */}
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <Pill className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-sidebar-foreground">MediTrack</h1>
                  <p className="text-xs text-sidebar-foreground/60">IoT Inventory</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                if (user?.role === 'auditor' && !['dashboard', 'audit'].includes(item.id)) {
                  return null;
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                    {item.id === 'alerts' && (
                      <span className="ml-auto bg-danger text-danger-foreground text-xs px-2 py-0.5 rounded-full">
                        2
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* User Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border bg-sidebar">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center">
                  <span className="text-sm font-semibold text-sidebar-foreground">
                    {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="w-full mt-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
