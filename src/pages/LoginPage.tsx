import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pill, User, Lock, ArrowRight, Shield, Activity, Package, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const roles: { id: UserRole; label: string; icon: typeof User }[] = [
  { id: 'admin', label: 'Administrator', icon: Shield },
  { id: 'pharmacist', label: 'Pharmacist', icon: Activity },
  { id: 'auditor', label: 'Auditor', icon: Package },
];

export function LoginPage() {
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('pharmacist');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    if (isSignUp && !name) {
      setError('Name is required for signup');
      return;
    }
    setIsLoading(true);

    try {
      if (isSignUp) {
        const success = await signup(email, password, name, selectedRole);
        if (success) {
          toast.success('Account created! Check your email to confirm, then sign in.');
          setIsSignUp(false);
        } else {
          setError('Signup failed. Try a different email.');
        }
      } else {
        const success = await login(email, password, selectedRole);
        if (!success) {
          setError('Invalid email or password');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 sidebar-gradient flex-col justify-between p-12 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border-2 border-sidebar-foreground" />
          <div className="absolute bottom-40 right-20 w-96 h-96 rounded-full border border-sidebar-foreground" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-sidebar-primary/20" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-lg">
              <Pill className="w-8 h-8 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-sidebar-foreground">MediTrack IoT</h1>
              <p className="text-sidebar-foreground/70">Smart Clinic Inventory</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-sidebar-foreground leading-tight">
              Intelligent Inventory<br />
              <span className="text-accent">Management System</span>
            </h2>
            <p className="text-lg text-sidebar-foreground/70 mt-4 max-w-md">
              Real-time tracking, theft detection, and automated reordering for healthcare facilities.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '86%', desc: 'Stockout Reduction' },
              { label: '92.4%', desc: 'Theft Detection' },
              { label: '53×', desc: 'ROI Achieved' },
              { label: '24/7', desc: 'Monitoring' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="bg-sidebar-accent/50 rounded-xl p-4 backdrop-blur-sm"
              >
                <p className="text-2xl font-bold text-accent">{stat.label}</p>
                <p className="text-sm text-sidebar-foreground/70">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-sidebar-foreground/50">© 2024 JOOUST Capstone Project</p>
        </div>
      </motion.div>

      {/* Right Panel - Auth Form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background"
      >
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Pill className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">MediTrack IoT</h1>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-foreground">
              {isSignUp ? 'Create account' : 'Welcome back'}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isSignUp ? 'Sign up to get started' : 'Sign in to access the inventory system'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div className="space-y-3">
              <Label className="text-foreground font-medium">Select Role</Label>
              <div className="grid grid-cols-3 gap-3">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <motion.button
                      key={role.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        'p-4 rounded-xl border-2 transition-all duration-200 text-center',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <Icon className={cn('w-6 h-6 mx-auto mb-2', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      <p className={cn('text-sm font-medium', isSelected ? 'text-primary' : 'text-foreground')}>{role.label}</p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Name (signup only) */}
            {isSignUp && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                <Label htmlFor="name" className="text-foreground font-medium">Full Name</Label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input id="name" placeholder="John Kipchoge" value={name} onChange={e => setName(e.target.value)} className="pl-12 h-12" />
                </div>
              </motion.div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@clinic.ke" value={email} onChange={e => setEmail(e.target.value)} className="pl-12 h-12" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} className="pl-12 h-12" />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-danger text-center">
                {error}
              </motion.p>
            )}

            <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl">
              {isLoading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-primary font-medium hover:underline">
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
