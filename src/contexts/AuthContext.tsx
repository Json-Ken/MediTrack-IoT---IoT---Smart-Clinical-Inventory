 import React, { createContext, useContext, useState, ReactNode } from 'react';
 import { User, UserRole } from '@/types/inventory';
 import { mockUsers } from '@/data/mockData';
 
 interface AuthContextType {
   user: User | null;
   login: (email: string, password: string, role: UserRole) => Promise<boolean>;
   logout: () => void;
   isAuthenticated: boolean;
 }
 
 const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
 export function AuthProvider({ children }: { children: ReactNode }) {
   const [user, setUser] = useState<User | null>(null);
 
   const login = async (email: string, password: string, role: UserRole): Promise<boolean> => {
     // Simulate API call
     await new Promise(resolve => setTimeout(resolve, 800));
     
     // For demo: accept any credentials, assign role
     const mockUser = mockUsers.find(u => u.role === role) || {
       id: Date.now().toString(),
       name: email.split('@')[0],
       email,
       role,
     };
     
     setUser(mockUser);
     return true;
   };
 
   const logout = () => {
     setUser(null);
   };
 
   return (
     <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
       {children}
     </AuthContext.Provider>
   );
 }
 
 export function useAuth() {
   const context = useContext(AuthContext);
   if (!context) {
     throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
 }