import { useState, useEffect } from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calculator } from './Calculator';
import { Transaction } from '../types/database';

export const StaffView = () => {
  const { shop, staff, logout } = useAuth();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    if (shop && staff) {
      loadRecentTransactions();
      setupRealtimeSubscription();
    }
  }, [shop, staff]);

  const setupRealtimeSubscription = () => {
    if (!shop || !staff) return;

    const subscription = supabase
      .channel('staff-transactions')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'transactions',
          filter: `shop_id=eq.${shop.id}`
        },
        (payload) => {
          if (payload.new.staff_id === staff.id) {
            loadRecentTransactions();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadRecentTransactions = async () => {
    if (!shop || !staff) return;

    try {
      const { data } = await supabase
        .from('transactions')
        .select(`
          *,
          inferred_item:inferred_item_id(name),
          staff:staff_id(name)
        `)
        .eq('shop_id', shop.id)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setRecentTransactions(data as any);
        updateStats(data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const updateStats = (transactions: Transaction[]) => {
    const today = new Date().toDateString();
    const todayTransactions = transactions.filter(t => 
      new Date(t.created_at).toDateString() === today
    );
    
    setTodaySales(todayTransactions.reduce((sum, t) => sum + t.entered_amount, 0));
    setTodayCount(todayTransactions.length);
  };

  const handleTransaction = async (amount: number, paymentMode: string) => {
    if (!shop || !staff) return;

    try {
      // Find the best matching item based on amount
      const { data: items } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true);

      let bestMatch = items?.[0];
      if (items && items.length > 0) {
        bestMatch = items.reduce((prev, current) => 
          Math.abs(current.base_price - amount) < Math.abs(prev.base_price - amount) ? current : prev
        );
      }

      const transactionData = {
        shop_id: shop.id,
        staff_id: staff.id,
        entered_amount: amount,
        inferred_item_id: bestMatch?.id || null,
        base_price: bestMatch?.base_price || amount,
        discount_amount: bestMatch ? Math.max(0, bestMatch.base_price - amount) : 0,
        discount_percentage: bestMatch && bestMatch.base_price > 0 
          ? Math.max(0, ((bestMatch.base_price - amount) / bestMatch.base_price) * 100) 
          : 0,
        payment_mode: paymentMode as 'CASH' | 'UPI' | 'CREDIT',
        is_discount_override: false,
        is_credit_settled: paymentMode !== 'CREDIT'
      };

      const { error } = await supabase
        .from('transactions')
        .insert([transactionData]);

      if (error) {
        console.error('Error creating transaction:', error);
        alert('Failed to create transaction');
        return;
      }

      // Update inventory if item was matched
      if (bestMatch) {
        const { error: inventoryError } = await supabase
          .from('items')
          .update({ 
            stock_quantity: Math.max(0, bestMatch.stock_quantity - 1),
            updated_at: new Date().toISOString()
          })
          .eq('id', bestMatch.id);

        if (inventoryError) {
          console.error('Error updating inventory:', inventoryError);
        }
      }

      loadRecentTransactions();
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Failed to process transaction');
    }
  };

  // Don't render if shop or staff data is not available
  if (!shop || !staff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
    loadRecentTransactions();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="text-blue-600" size={24} />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {shop?.name}
                  </h1>
                  <p className="text-sm text-gray-600">
                    Staff: {staff?.name}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Today's Sales</p>
                <p className="text-lg font-bold text-green-600">{shop.currency} {todaySales}</p>
                <p className="text-xs text-gray-500">{todayCount} transactions</p>
              </div>
              
              <button
                onClick={logout}
                className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-full
                           transition-colors duration-150"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Calculator */}
          <div>
            <Calculator 
              shopData={shop} 
              staffData={staff} 
              onTransaction={handleTransaction} 
            />
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Recent Transactions
            </h2>
            
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No transactions yet</p>
                <p className="text-sm">Complete your first sale to see it here</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {shop.currency} {transaction.entered_amount}
                      </p>
                      <p className="text-sm text-gray-600">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(transaction as any).inferred_item?.name || 'Unknown Item'}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        transaction.payment_mode === 'CASH' 
                          ? 'bg-green-100 text-green-800'
                          : transaction.payment_mode === 'UPI'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {transaction.payment_mode}
                      </span>
                      {transaction.discount_amount > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">
                          {shop.currency} {transaction.discount_amount} discount
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};