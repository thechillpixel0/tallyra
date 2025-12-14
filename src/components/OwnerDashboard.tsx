import { useState, useEffect } from 'react';
import { LogOut, Crown, Users, Package, TrendingUp, Settings, Plus, CreditCard as Edit, Trash2, Eye, EyeOff, Save, X, QrCode, Upload, Calculator, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, hashPasscode } from '../lib/supabase';
import { Item, Staff, Transaction, Shop } from '../types/database';
import { Calculator as CalculatorComponent } from './Calculator';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalItems: number;
  activeStaff: number;
  lowStockItems: number;
}

export const OwnerDashboard = () => {
  const { shop, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'staff' | 'transactions' | 'settings' | 'calculator'>('overview');
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    totalItems: 0,
    activeStaff: 0,
    lowStockItems: 0
  });
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    min_stock_alert: '5',
    max_discount_percentage: '0',
    max_discount_fixed: '0'
  });
  const [newStaff, setNewStaff] = useState({
    name: '',
    passcode: '',
    phone: '',
    email: '',
    address: ''
  });
  const [shopSettings, setShopSettings] = useState({
    name: shop?.name || '',
    currency: shop?.currency || 'INR',
    upi_id: shop?.upi_id || '',
    upi_qr_url: shop?.upi_qr_url || '',
    master_passcode: ''
  });
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (shop) {
      loadDashboardData();
      setupRealtimeSubscriptions();
    }
  }, [shop]);

  const setupRealtimeSubscriptions = () => {
    if (!shop) return;

    const subscription = supabase
      .channel('owner-dashboard')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions', filter: `shop_id=eq.${shop.id}` },
        () => loadDashboardData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'items', filter: `shop_id=eq.${shop.id}` },
        () => loadDashboardData()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'staff', filter: `shop_id=eq.${shop.id}` },
        () => loadDashboardData()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadDashboardData = async () => {
    if (!shop) return;

    setIsLoading(true);
    try {
      // Load items
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shop.id)
        .order('name');

      // Load staff
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('shop_id', shop.id)
        .order('name');

      // Load today's transactions
      const today = new Date().toISOString().split('T')[0];
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          inferred_item:inferred_item_id(name),
          staff:staff_id(name)
        `)
        .eq('shop_id', shop.id)
        .gte('created_at', today)
        .order('created_at', { ascending: false });

      if (itemsData) setItems(itemsData);
      if (staffData) setStaff(staffData);
      if (transactionsData) setTransactions(transactionsData as any);

      // Calculate stats
      const todaySales = transactionsData?.reduce((sum, t) => sum + t.entered_amount, 0) || 0;
      const lowStockItems = itemsData?.filter(item => 
        item.stock_quantity <= item.min_stock_alert
      ).length || 0;

      setStats({
        todaySales,
        todayTransactions: transactionsData?.length || 0,
        totalItems: itemsData?.length || 0,
        activeStaff: staffData?.filter(s => s.is_active).length || 0,
        lowStockItems
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!shop || !newItem.name || !newItem.base_price) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('items')
        .insert({
          shop_id: shop.id,
          name: newItem.name,
          base_price: parseFloat(newItem.base_price),
          stock_quantity: parseInt(newItem.stock_quantity) || 0,
          min_stock_alert: parseInt(newItem.min_stock_alert) || 5,
          max_discount_percentage: parseFloat(newItem.max_discount_percentage) || 0,
          max_discount_fixed: parseFloat(newItem.max_discount_fixed) || 0,
          is_active: true
        });

      if (error) throw error;

      setNewItem({
        name: '',
        base_price: '',
        stock_quantity: '',
        min_stock_alert: '5',
        max_discount_percentage: '0',
        max_discount_fixed: '0'
      });
      setShowAddItem(false);
      setSuccess('Item added successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error adding item:', error);
      setError('Failed to add item');
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('items')
        .update({
          name: editingItem.name,
          base_price: editingItem.base_price,
          stock_quantity: editingItem.stock_quantity,
          min_stock_alert: editingItem.min_stock_alert,
          max_discount_percentage: editingItem.max_discount_percentage,
          max_discount_fixed: editingItem.max_discount_fixed,
          is_active: editingItem.is_active
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      setEditingItem(null);
      setSuccess('Item updated successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error updating item:', error);
      setError('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setSuccess('Item deleted successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting item:', error);
      setError('Failed to delete item');
    }
  };

  const handleAddStaff = async () => {
    if (!shop || !newStaff.name || !newStaff.passcode) {
      setError('Please fill in name and passcode');
      return;
    }

    try {
      const { error } = await supabase
        .from('staff')
        .insert({
          shop_id: shop.id,
          name: newStaff.name,
          passcode_hash: newStaff.passcode, // In production, this should be hashed
          phone: newStaff.phone || undefined,
          email: newStaff.email || undefined,
          address: newStaff.address || undefined,
          is_active: true
        });

      if (error) throw error;

      setNewStaff({
        name: '',
        phone: '',
        email: '',
        address: ''
      });
      setError(`Error adding staff: ${error.message}`);
      setShowAddStaff(false);
      setSuccess('Staff member added successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error adding staff:', error);
      setError(`Error adding staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    try {
      const updateData: any = {
        name: editingStaff.name,
        is_active: editingStaff.is_active,
        phone: editingStaff.phone || null,
        email: editingStaff.email || null,
        address: editingStaff.address || null
      };

      // Only update passcode if it's changed
      if (editingStaff.passcode_hash !== staff.find(s => s.id === editingStaff.id)?.passcode_hash) {
        updateData.passcode_hash = editingStaff.passcode_hash;
      }

      const { error } = await supabase
        .from('staff')
        .update(updateData)
        .eq('id', editingStaff.id);

      if (error) throw error;

      setEditingStaff(null);
      setSuccess('Staff member updated successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error updating staff:', error);
      setError('Failed to update staff member');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      setSuccess('Staff member deleted successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error deleting staff:', error);
      setError('Failed to delete staff member');
    }
  };

  const handleUpdateShopSettings = async () => {
    if (!shop) return;

    try {
      const updateData: any = {
        name: shopSettings.name,
        currency: shopSettings.currency,
        upi_id: shopSettings.upi_id || null,
        upi_qr_url: shopSettings.upi_qr_url || null
      };

      // Only update master passcode if provided
      if (shopSettings.master_passcode) {
        updateData.master_passcode_hash = shopSettings.master_passcode;
      }

      const { error } = await supabase
        .from('shops')
        .update(updateData)
        .eq('id', shop.id);

      if (error) throw error;

      setSuccess('Shop settings updated successfully');
      setShopSettings({ ...shopSettings, master_passcode: '' });
    } catch (error) {
      console.error('Error updating shop settings:', error);
      setError('Failed to update shop settings');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: shop?.currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleTransactionComplete = (transaction: Transaction) => {
    loadDashboardData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Crown className="text-yellow-600" size={24} />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {shop?.name} - Owner Dashboard
                  </h1>
                  <p className="text-sm text-gray-600">
                    Complete business management
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(stats.todaySales)}</p>
                <p className="text-xs text-gray-500">{stats.todayTransactions} transactions</p>
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

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'calculator', label: 'Calculator', icon: Calculator },
              { id: 'items', label: 'Items', icon: Package },
              { id: 'staff', label: 'Staff', icon: Users },
              { id: 'transactions', label: 'Transactions', icon: DollarSign },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
            <button onClick={() => setSuccess('')} className="float-right">
              <X size={16} />
            </button>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button onClick={() => setError('')} className="float-right">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="text-green-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Today's Sales</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.todaySales)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ShoppingCart className="text-blue-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.todayTransactions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="text-purple-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertTriangle className="text-orange-600" size={24} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Low Stock</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
              </div>
              <div className="p-6">
                {transactions.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No transactions today</p>
                ) : (
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900">{formatCurrency(transaction.entered_amount)}</p>
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
                          <p className="text-xs text-gray-500 mt-1">
                            Staff: {(transaction as any).staff?.name || 'Owner'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className="max-w-md mx-auto">
            <CalculatorComponent onTransactionComplete={handleTransactionComplete} isOwner={true} />
          </div>
        )}

        {/* Items Tab */}
        {activeTab === 'items' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
              <button
                onClick={() => setShowAddItem(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(item.base_price)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          item.stock_quantity <= item.min_stock_alert 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-900'
                        }`}>
                          {item.stock_quantity}
                          {item.stock_quantity <= item.min_stock_alert && (
                            <span className="ml-1 text-xs">(Low Stock)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
              <button
                onClick={() => setShowAddStaff(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus size={16} />
                Add Staff
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Passcode
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
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {member.phone && <div>📞 {member.phone}</div>}
                          {member.email && <div>📧 {member.email}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-mono">
                          {member.passcode_hash}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          member.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setEditingStaff(member)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(member.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Staff
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(transaction.entered_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(transaction as any).inferred_item?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.payment_mode === 'CASH' 
                            ? 'bg-green-100 text-green-800'
                            : transaction.payment_mode === 'UPI'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {transaction.payment_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(transaction as any).staff?.name || 'Owner'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.discount_amount > 0 ? formatCurrency(transaction.discount_amount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Name
                  </label>
                  <input
                    type="text"
                    value={shopSettings.name}
                    onChange={(e) => setShopSettings({...shopSettings, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={shopSettings.currency}
                    onChange={(e) => setShopSettings({...shopSettings, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={shopSettings.upi_id}
                    onChange={(e) => setShopSettings({...shopSettings, upi_id: e.target.value})}
                    placeholder="yourname@paytm"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UPI QR Code URL
                  </label>
                  <input
                    type="url"
                    value={shopSettings.upi_qr_url}
                    onChange={(e) => setShopSettings({...shopSettings, upi_qr_url: e.target.value})}
                    placeholder="https://example.com/qr-code.png"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Master Passcode (leave empty to keep current)
                  </label>
                  <div className="relative">
                    <input
                      type={showPasscode ? "text" : "password"}
                      value={shopSettings.master_passcode}
                      onChange={(e) => setShopSettings({...shopSettings, master_passcode: e.target.value})}
                      placeholder="Enter new master passcode"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleUpdateShopSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                >
                  <Save size={16} />
                  Save Settings
                </button>
              </div>

              {/* QR Code Preview */}
              {shopSettings.upi_qr_url && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">QR Code Preview</h4>
                  <img 
                    src={shopSettings.upi_qr_url} 
                    alt="UPI QR Code" 
                    className="max-w-32 max-h-32 rounded-lg shadow-sm"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Item</h3>
              <button
                onClick={() => setShowAddItem(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name *"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Base Price *"
                value={newItem.base_price}
                onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={newItem.stock_quantity}
                onChange={(e) => setNewItem({...newItem, stock_quantity: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Min Stock Alert (default: 5)"
                value={newItem.min_stock_alert}
                onChange={(e) => setNewItem({...newItem, min_stock_alert: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount % (default: 0)"
                value={newItem.max_discount_percentage}
                onChange={(e) => setNewItem({...newItem, max_discount_percentage: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount (default: 0)"
                value={newItem.max_discount_fixed}
                onChange={(e) => setNewItem({...newItem, max_discount_fixed: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add New Staff</h3>
              <button
                onClick={() => setShowAddStaff(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Staff Name *"
                value={newStaff.name}
                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Passcode (numbers only) *"
                value={newStaff.passcode}
                onChange={(e) => setNewStaff({...newStaff, passcode: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newStaff.email}
                onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Address"
                value={newStaff.address}
                onChange={(e) => setNewStaff({...newStaff, address: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddStaff(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Item</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={editingItem.name}
                onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={editingItem.base_price}
                onChange={(e) => setEditingItem({...editingItem, base_price: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={editingItem.stock_quantity}
                onChange={(e) => setEditingItem({...editingItem, stock_quantity: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={editingItem.min_stock_alert}
                onChange={(e) => setEditingItem({...editingItem, min_stock_alert: parseInt(e.target.value) || 5})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={editingItem.max_discount_percentage}
                onChange={(e) => setEditingItem({...editingItem, max_discount_percentage: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed"
                value={editingItem.max_discount_fixed}
                onChange={(e) => setEditingItem({...editingItem, max_discount_fixed: parseFloat(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editingItem.is_active}
                  onChange={(e) => setEditingItem({...editingItem, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Staff</h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Staff Name"
                value={editingStaff.name}
                onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Passcode"
                value={editingStaff.passcode_hash}
                onChange={(e) => setEditingStaff({...editingStaff, passcode_hash: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={editingStaff.phone || ''}
                onChange={(e) => setEditingStaff({...editingStaff, phone: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={editingStaff.email || ''}
                onChange={(e) => setEditingStaff({...editingStaff, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Address"
                value={editingStaff.address || ''}
                onChange={(e) => setEditingStaff({...editingStaff, address: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="staff_active"
                  checked={editingStaff.is_active}
                  onChange={(e) => setEditingStaff({...editingStaff, is_active: e.target.checked})}
                  className="mr-2"
                />
                <label htmlFor="staff_active" className="text-sm text-gray-700">Active</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingStaff(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStaff}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};