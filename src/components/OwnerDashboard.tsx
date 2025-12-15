import { useState, useEffect } from 'react';
import { LogOut, Users, Package, TrendingUp, Plus, CreditCard as Edit, Trash2, Eye, EyeOff, Store, Calculator as CalcIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calculator } from './Calculator';
import { Staff, Item, Transaction } from '../types/database';

export const OwnerDashboard = () => {
  const { shop, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'inventory' | 'calculator'>('overview');
  const [staff, setStaff] = useState<Staff[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [todaySales, setTodaySales] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);

  // Form states
  const [staffForm, setStaffForm] = useState({
    name: '',
    passcode: '',
    phone: '',
    email: '',
    address: ''
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    min_stock_alert: '',
    max_discount_percentage: '',
    max_discount_fixed: ''
  });

  const [showPasscodes, setShowPasscodes] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (shop) {
      loadData();
    }
  }, [shop]);

  const loadData = async () => {
    if (!shop) return;

    try {
      // Load staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (staffData) setStaff(staffData);

      // Load items
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (itemsData) setItems(itemsData);

      // Load recent transactions
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          inferred_item:inferred_item_id(name),
          staff:staff_id(name)
        `)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactionsData) {
        setTransactions(transactionsData as any);
        updateStats(transactionsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const updateStats = (transactions: Transaction[]) => {
    const today = new Date().toDateString();
    const todayTxns = transactions.filter(t => 
      new Date(t.created_at).toDateString() === today
    );
    
    setTodaySales(todayTxns.reduce((sum, t) => sum + t.entered_amount, 0));
    setTodayTransactions(todayTxns.length);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    try {
      const { error } = await supabase
        .from('staff')
        .insert([{
          shop_id: shop.id,
          name: staffForm.name,
          passcode_hash: staffForm.passcode, // In production, this should be hashed
          phone: staffForm.phone || null,
          email: staffForm.email || null,
          address: staffForm.address || null,
          is_active: true
        }]);

      if (error) {
        console.error('Error adding staff:', error);
        alert('Failed to add staff member');
        return;
      }

      setStaffForm({ name: '', passcode: '', phone: '', email: '', address: '' });
      setShowAddStaff(false);
      loadData();
    } catch (error) {
      console.error('Error adding staff:', error);
      alert('Failed to add staff member');
    }
  };

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    try {
      const { error } = await supabase
        .from('staff')
        .update({
          name: staffForm.name,
          passcode_hash: staffForm.passcode,
          phone: staffForm.phone || null,
          email: staffForm.email || null,
          address: staffForm.address || null
        })
        .eq('id', editingStaff.id);

      if (error) {
        console.error('Error updating staff:', error);
        alert('Failed to update staff member');
        return;
      }

      setEditingStaff(null);
      setStaffForm({ name: '', passcode: '', phone: '', email: '', address: '' });
      loadData();
    } catch (error) {
      console.error('Error updating staff:', error);
      alert('Failed to update staff member');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.error('Error deleting staff:', error);
        alert('Failed to delete staff member');
        return;
      }

      loadData();
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff member');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    try {
      const { error } = await supabase
        .from('items')
        .insert([{
          shop_id: shop.id,
          name: itemForm.name,
          base_price: parseFloat(itemForm.base_price),
          stock_quantity: parseInt(itemForm.stock_quantity),
          min_stock_alert: parseInt(itemForm.min_stock_alert),
          max_discount_percentage: parseFloat(itemForm.max_discount_percentage),
          max_discount_fixed: parseFloat(itemForm.max_discount_fixed),
          is_active: true
        }]);

      if (error) {
        console.error('Error adding item:', error);
        alert('Failed to add item');
        return;
      }

      setItemForm({
        name: '',
        base_price: '',
        stock_quantity: '',
        min_stock_alert: '',
        max_discount_percentage: '',
        max_discount_fixed: ''
      });
      setShowAddItem(false);
      loadData();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: itemForm.name,
          base_price: parseFloat(itemForm.base_price),
          stock_quantity: parseInt(itemForm.stock_quantity),
          min_stock_alert: parseInt(itemForm.min_stock_alert),
          max_discount_percentage: parseFloat(itemForm.max_discount_percentage),
          max_discount_fixed: parseFloat(itemForm.max_discount_fixed)
        })
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating item:', error);
        alert('Failed to update item');
        return;
      }

      setEditingItem(null);
      setItemForm({
        name: '',
        base_price: '',
        stock_quantity: '',
        min_stock_alert: '',
        max_discount_percentage: '',
        max_discount_fixed: ''
      });
      loadData();
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting item:', error);
        alert('Failed to delete item');
        return;
      }

      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  const handleTransaction = async (amount: number, paymentMode: string) => {
    if (!shop) return;

    try {
      // Find the best matching item based on amount
      let bestMatch = items.find(item => item.is_active)?.[0];
      if (items.length > 0) {
        bestMatch = items
          .filter(item => item.is_active)
          .reduce((prev, current) => 
            Math.abs(current.base_price - amount) < Math.abs(prev.base_price - amount) ? current : prev
          );
      }

      const transactionData = {
        shop_id: shop.id,
        staff_id: null, // Owner transaction
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

      loadData();
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Failed to process transaction');
    }
  };

  const startEditStaff = (staffMember: Staff) => {
    setEditingStaff(staffMember);
    setStaffForm({
      name: staffMember.name,
      passcode: staffMember.passcode_hash,
      phone: staffMember.phone || '',
      email: staffMember.email || '',
      address: staffMember.address || ''
    });
  };

  const startEditItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      base_price: item.base_price.toString(),
      stock_quantity: item.stock_quantity.toString(),
      min_stock_alert: item.min_stock_alert.toString(),
      max_discount_percentage: item.max_discount_percentage.toString(),
      max_discount_fixed: item.max_discount_fixed.toString()
    });
  };

  const togglePasscodeVisibility = (staffId: string) => {
    setShowPasscodes(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  if (!shop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Store className="text-blue-600" size={28} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
                <p className="text-sm text-gray-600">Owner Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-600">Today's Sales</p>
                <p className="text-xl font-bold text-green-600">
                  {shop.currency} {todaySales.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">{todayTransactions} transactions</p>
              </div>
              
              <button
                onClick={logout}
                className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'staff', label: 'Staff Management', icon: Users },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'calculator', label: 'Calculator', icon: CalcIcon }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {shop.currency} {todaySales.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Staff</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {staff.filter(s => s.is_active).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {items.filter(i => i.is_active).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900">{todayTransactions}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staff
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.slice(0, 10).map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {shop.currency} {transaction.entered_amount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(transaction as any).inferred_item?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(transaction as any).staff?.name || 'Owner'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            transaction.payment_mode === 'CASH' 
                              ? 'bg-green-100 text-green-800'
                              : transaction.payment_mode === 'UPI'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {transaction.payment_mode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
              <button
                onClick={() => setShowAddStaff(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Add Staff
              </button>
            </div>

            {/* Staff List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passcode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {staff.map((staffMember) => (
                      <tr key={staffMember.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {staffMember.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {showPasscodes[staffMember.id] 
                                ? staffMember.passcode_hash 
                                : '••••••'
                              }
                            </span>
                            <button
                              onClick={() => togglePasscodeVisibility(staffMember.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              {showPasscodes[staffMember.id] ? (
                                <EyeOff size={16} />
                              ) : (
                                <Eye size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {staffMember.phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            staffMember.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {staffMember.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditStaff(staffMember)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staffMember.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add/Edit Staff Modal */}
            {(showAddStaff || editingStaff) && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                  </h3>
                  <form onSubmit={editingStaff ? handleEditStaff : handleAddStaff}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={staffForm.name}
                          onChange={(e) => setStaffForm({...staffForm, name: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Passcode *
                        </label>
                        <input
                          type="text"
                          value={staffForm.passcode}
                          onChange={(e) => setStaffForm({...staffForm, passcode: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={staffForm.phone}
                          onChange={(e) => setStaffForm({...staffForm, phone: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={staffForm.email}
                          onChange={(e) => setStaffForm({...staffForm, email: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {editingStaff ? 'Update' : 'Add'} Staff
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddStaff(false);
                          setEditingStaff(null);
                          setStaffForm({ name: '', passcode: '', phone: '', email: '', address: '' });
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
              <button
                onClick={() => setShowAddItem(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Add Item
              </button>
            </div>

            {/* Items List */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shop.currency} {item.base_price}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={item.stock_quantity <= item.min_stock_alert ? 'text-red-600 font-medium' : ''}>
                            {item.stock_quantity}
                          </span>
                          {item.stock_quantity <= item.min_stock_alert && (
                            <span className="ml-2 text-xs text-red-500">(Low Stock)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            item.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEditItem(item)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add/Edit Item Modal */}
            {(showAddItem || editingItem) && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingItem ? 'Edit Item' : 'Add New Item'}
                  </h3>
                  <form onSubmit={editingItem ? handleEditItem : handleAddItem}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={itemForm.name}
                          onChange={(e) => setItemForm({...itemForm, name: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Base Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={itemForm.base_price}
                          onChange={(e) => setItemForm({...itemForm, base_price: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Stock Quantity *
                        </label>
                        <input
                          type="number"
                          value={itemForm.stock_quantity}
                          onChange={(e) => setItemForm({...itemForm, stock_quantity: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Min Stock Alert *
                        </label>
                        <input
                          type="number"
                          value={itemForm.min_stock_alert}
                          onChange={(e) => setItemForm({...itemForm, min_stock_alert: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Discount %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={itemForm.max_discount_percentage}
                          onChange={(e) => setItemForm({...itemForm, max_discount_percentage: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Discount Fixed
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={itemForm.max_discount_fixed}
                          onChange={(e) => setItemForm({...itemForm, max_discount_fixed: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        {editingItem ? 'Update' : 'Add'} Item
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddItem(false);
                          setEditingItem(null);
                          setItemForm({
                            name: '',
                            base_price: '',
                            stock_quantity: '',
                            min_stock_alert: '',
                            max_discount_percentage: '',
                            max_discount_fixed: ''
                          });
                        }}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="max-w-md mx-auto">
            <Calculator 
              shopData={shop} 
              staffData={{ id: 'owner', name: 'Owner' } as any} 
              onTransaction={handleTransaction} 
            />
          </div>
        )}
      </div>
    </div>
  );
};