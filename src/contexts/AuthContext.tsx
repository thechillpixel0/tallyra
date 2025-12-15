import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Shop, Staff } from '../types/database';

interface AuthContextType {
  shop: Shop | null;
  staff: Staff | null;
  userRole: 'owner' | 'staff' | null;
  isLoading: boolean;
  loginAsOwner: (shopId: string, passcode: string) => Promise<boolean>;
  loginAsStaff: (shopId: string, passcode: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'staff' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedAuth = localStorage.getItem('tallyra-auth');
    if (savedAuth) {
      try {
        const { shop: savedShop, staff: savedStaff, role } = JSON.parse(savedAuth);
        setShop(savedShop);
        setStaff(savedStaff);
        setUserRole(role);
      } catch (error) {
        console.error('Failed to parse saved auth:', error);
        localStorage.removeItem('tallyra-auth');
      }
    }
    setIsLoading(false);
  }, []);

  const loginAsOwner = async (shopId: string, passcode: string): Promise<boolean> => {
    try {
      // For demo purposes, use simple comparison instead of hashing
      if (passcode === '1032005') {
        // First try to get the specific shop
        let { data: shopData, error } = await supabase
          .from('shops')
          .select('*')
          .eq('id', shopId)
          .single();

        // If shop not found, try to get the demo shop
        if (error || !shopData) {
          const { data: demoShop, error: demoError } = await supabase
            .from('shops')
            .select('*')
            .eq('id', 'demo-shop-123')
            .single();
          
          if (demoError || !demoShop) {
            console.error('No shop found:', error || demoError);
            return false;
          }
          
          shopData = demoShop;
        }

        setShop(shopData);
        setUserRole('owner');
        
        localStorage.setItem('tallyra-auth', JSON.stringify({
          shop: shopData,
          staff: null,
          role: 'owner'
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error('Owner login error:', error);
      return false;
    }
  };

  const loginAsStaff = async (shopId: string, passcode: string): Promise<boolean> => {
    try {
      // First try to get the specific shop
      let { data: shopData, error } = await supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      // If shop not found, try to get the demo shop
      if (error || !shopData) {
        const { data: demoShop, error: demoError } = await supabase
          .from('shops')
          .select('*')
          .eq('id', 'demo-shop-123')
          .single();
        
        if (demoError || !demoShop) {
          console.error('No shop found:', error || demoError);
          return false;
        }
        
        shopData = demoShop;
      }

      // Find staff member with matching passcode
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('shop_id', shopData.id)
        .eq('passcode_hash', passcode) // In production, this should be hashed
        .eq('is_active', true)
        .single();

      if (staffError || !staffData) {
        console.error('Staff not found or invalid passcode:', staffError);
        return false;
      }

      setShop(shopData);
      setStaff(staffData);
      setUserRole('staff');

      localStorage.setItem('tallyra-auth', JSON.stringify({
        shop: shopData,
        staff: staffData,
        role: 'staff'
      }));

      return true;
    } catch (error) {
      console.error('Staff login error:', error);
      return false;
    }
  };

  const logout = () => {
    setShop(null);
    setStaff(null);
    setUserRole(null);
    localStorage.removeItem('tallyra-auth');
  };

  return (
    <AuthContext.Provider
      value={{
        shop,
        staff,
        userRole,
        isLoading,
        loginAsOwner,
        loginAsStaff,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};