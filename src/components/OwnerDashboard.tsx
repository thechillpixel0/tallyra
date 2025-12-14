import { useState, useEffect } from 'react';
import { BarChart3, Package, Users, Settings, TrendingUp, CreditCard, AlertTriangle, LogOut, Plus, CreditCard as Edit2, Calendar, Download, Eye, EyeOff, Calculator as CalculatorIcon, Save, X, Upload, Trash2, User, Phone, Mail, MapPin, Clock, DollarSign, Shield, Bell, Palette, Globe, Database, FileText, BarChart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Item, Staff, Transaction, DailySalesReport } from '../types/database';
import { Calculator } from './Calculator';

export const OwnerDashboard = () => {
  const { shop, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyReport, setDailyReport] = useState<DailySalesReport | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasscodes, setShowPasscodes] = useState<{[key: string]: boolean}>({});
  const [transactionFilter, setTransactionFilter] = useState({
    date: '',
    paymentMode: '',
    staff: ''
  });
  const [shopSettings, setShopSettings] = useState({
    name: shop?.name || '',
    currency: shop?.currency || 'INR',
    upi_id: shop?.upi_id || '',
    upi_qr_url: shop?.upi_qr_url || ''
  });
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<Staff | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (shop) {
      loadDashboardData();
      setupRealtimeSubscriptions();
    }
  }, [shop]);

  useEffect(() => {
    if (shop) {
      setShopSettings({
        name: shop.name,
        currency: shop.currency,
        upi_id: shop.upi_id || '',
        upi_qr_url: shop.upi_qr_url || ''
      });
    }
  }, [shop]);

  const setupRealtimeSubscriptions = () => {
    if (!shop) return;

    // Subscribe to transactions
    const transactionSubscription = supabase
      .channel('owner-transactions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadTransactions();
          loadDailyReport();
        }
      )
      .subscribe();

    // Subscribe to items
    const itemSubscription = supabase
      .channel('owner-items')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadItems();
        }
      )
      .subscribe();

    // Subscribe to staff
    const staffSubscription = supabase
      .channel('owner-staff')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'staff', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadStaff();
        }
      )
      .subscribe();

    return () => {
      transactionSubscription.unsubscribe();
      itemSubscription.unsubscribe();
      staffSubscription.unsubscribe();
    };
  };

  const loadDashboardData = async () => {
    if (!shop) return;
    
    setIsLoading(true);
    try {
      await Promise.all([
        loadItems(),
        loadStaff(),
        loadTransactions(),
        loadDailyReport()
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async () => {
    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('shop_id', shop!.id)
      .order('name');
    
    if (data) setItems(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('shop_id', shop!.id)
      .order('name');
    
    if (data) setStaff(data);
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        staff:staff_id(name),
        inferred_item:inferred_item_id(name)
      `)
      .eq('shop_id', shop!.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) setTransactions(data as any);
  };

  const loadDailyReport = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: todayTransactions } = await supabase
      .from('transactions')
      .select(`
        *,
        staff:staff_id(name)
      `)
      .eq('shop_id', shop!.id)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (todayTransactions) {
      const totalSales = todayTransactions.reduce((sum, t) => sum + t.entered_amount, 0);
      const cashSales = todayTransactions
        .filter(t => t.payment_mode === 'CASH')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const upiSales = todayTransactions
        .filter(t => t.payment_mode === 'UPI')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const creditSales = todayTransactions
        .filter(t => t.payment_mode === 'CREDIT')
        .reduce((sum, t) => sum + t.entered_amount, 0);
      const totalDiscounts = todayTransactions.reduce((sum, t) => sum + t.discount_amount, 0);

      const staffPerformance = staff.map(s => {
        const staffTransactions = todayTransactions.filter(t => t.staff_id === s.id);
        return {
          staff_id: s.id,
          staff_name: s.name,
          transaction_count: staffTransactions.length,
          total_amount: staffTransactions.reduce((sum, t) => sum + t.entered_amount, 0)
        };
      });

      setDailyReport({
        date: today,
        total_sales: totalSales,
        cash_sales: cashSales,
        upi_sales: upiSales,
        credit_sales: creditSales,
        total_transactions: todayTransactions.length,
        total_discounts: totalDiscounts,
        staff_performance: staffPerformance
      });
    }
  };

  const handleTransactionComplete = (transaction: Transaction) => {
    loadTransactions();
    loadDailyReport();
    loadItems(); // Refresh items for stock updates
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'calculator', label: 'Calculator', icon: CalculatorIcon },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'reports', label: 'Reports', icon: BarChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const lowStockItems = items.filter(item => item.stock_quantity <= item.min_stock_alert);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {shop?.name} - Owner Dashboard
              </h1>
              <p className="text-gray-600">
                Complete business management and analytics
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {dailyReport && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Today's Sales</p>
                  <p className="text-xl font-bold text-green-600">₹{dailyReport.total_sales}</p>
                  <p className="text-xs text-gray-500">{dailyReport.total_transactions} transactions</p>
                </div>
              )}
              
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-2xl shadow-lg p-4 sticky top-8">
              <div className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl
                                  transition-all duration-150 ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="text-yellow-600" size={20} />
                  <h3 className="font-semibold text-yellow-800">Low Stock Alert</h3>
                </div>
                <div className="space-y-2">
                  {lowStockItems.slice(0, 3).map((item) => (
                    <div key={item.id} className="text-sm text-yellow-700">
                      {item.name}: {item.stock_quantity} left
                    </div>
                  ))}
                  {lowStockItems.length > 3 && (
                    <p className="text-xs text-yellow-600">
                      +{lowStockItems.length - 3} more items
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'overview' && (
              <OverviewTab 
                dailyReport={dailyReport} 
                items={items} 
                staff={staff}
                transactions={transactions}
              />
            )}
            {activeTab === 'calculator' && (
              <CalculatorTab onTransactionComplete={handleTransactionComplete} />
            )}
            {activeTab === 'items' && (
              <ItemsTab 
                items={items} 
                onRefresh={loadItems}
                showAdd={showAddItem}
                setShowAdd={setShowAddItem}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                shop={shop}
              />
            )}
            {activeTab === 'staff' && (
              <StaffTab 
                staff={staff} 
                onRefresh={loadStaff}
                showAdd={showAddStaff}
                setShowAdd={setShowAddStaff}
                editingStaff={editingStaff}
                setEditingStaff={setEditingStaff}
                showPasscodes={showPasscodes}
                setShowPasscodes={setShowPasscodes}
                selectedProfile={selectedStaffProfile}
                setSelectedProfile={setSelectedStaffProfile}
                shop={shop}
                transactions={transactions}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsTab 
                transactions={transactions} 
                staff={staff}
                filter={transactionFilter}
                setFilter={setTransactionFilter}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsTab 
                transactions={transactions}
                items={items}
                staff={staff}
                dailyReport={dailyReport}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab 
                shop={shop} 
                settings={shopSettings}
                setSettings={setShopSettings}
                onSave={loadDashboardData}
                isSaving={isSaving}
                setIsSaving={setIsSaving}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Calculator Tab Component
const CalculatorTab = ({ onTransactionComplete }: any) => (
  <div className="space-y-6">
    <div className="text-center">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Owner Calculator</h2>
      <p className="text-gray-600">Make sales and test the system</p>
    </div>
    <div className="flex justify-center">
      <Calculator onTransactionComplete={onTransactionComplete} isOwner={true} />
    </div>
  </div>
);

// Overview Tab Component
const OverviewTab = ({ dailyReport, items, staff, transactions }: any) => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Today's Sales</p>
            <p className="text-3xl font-bold text-green-600">
              ₹{dailyReport?.total_sales || 0}
            </p>
          </div>
          <TrendingUp className="text-green-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          {dailyReport?.total_transactions || 0} transactions
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Items</p>
            <p className="text-3xl font-bold text-blue-600">
              {items.filter((i: Item) => i.is_active).length}
            </p>
          </div>
          <Package className="text-blue-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Total inventory items
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Active Staff</p>
            <p className="text-3xl font-bold text-purple-600">
              {staff.filter((s: Staff) => s.is_active).length}
            </p>
          </div>
          <Users className="text-purple-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Team members
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Pending Credits</p>
            <p className="text-3xl font-bold text-orange-600">
              ₹{transactions
                .filter((t: Transaction) => !t.is_credit_settled)
                .reduce((sum: number, t: Transaction) => sum + t.entered_amount, 0)}
            </p>
          </div>
          <CreditCard className="text-orange-600" size={32} />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Outstanding amount
        </p>
      </div>
    </div>

    {/* Payment Breakdown */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Payment Breakdown</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6 bg-green-50 rounded-xl border border-green-200">
          <Banknote className="mx-auto text-green-600 mb-3" size={32} />
          <p className="text-sm font-medium text-green-700">Cash</p>
          <p className="text-2xl font-bold text-green-600">₹{dailyReport?.cash_sales || 0}</p>
        </div>
        <div className="text-center p-6 bg-blue-50 rounded-xl border border-blue-200">
          <Smartphone className="mx-auto text-blue-600 mb-3" size={32} />
          <p className="text-sm font-medium text-blue-700">UPI</p>
          <p className="text-2xl font-bold text-blue-600">₹{dailyReport?.upi_sales || 0}</p>
        </div>
        <div className="text-center p-6 bg-orange-50 rounded-xl border border-orange-200">
          <CreditCard className="mx-auto text-orange-600 mb-3" size={32} />
          <p className="text-sm font-medium text-orange-700">Credit</p>
          <p className="text-2xl font-bold text-orange-600">₹{dailyReport?.credit_sales || 0}</p>
        </div>
      </div>
    </div>

    {/* Staff Performance */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Staff Performance</h2>
      <div className="space-y-4">
        {dailyReport?.staff_performance?.length > 0 ? (
          dailyReport.staff_performance.map((performance: any) => (
            <div key={performance.staff_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{performance.staff_name}</p>
                  <p className="text-sm text-gray-600">{performance.transaction_count} transactions</p>
                </div>
              </div>
              <p className="text-lg font-bold text-blue-600">₹{performance.total_amount}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="mx-auto mb-3" size={48} />
            <p>No staff activity today</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

// Items Tab Component
const ItemsTab = ({ items, onRefresh, showAdd, setShowAdd, editingItem, setEditingItem, shop }: any) => {
  const [newItem, setNewItem] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    min_stock_alert: '',
    max_discount_percentage: '',
    max_discount_fixed: ''
  });

  const handleAddItem = async () => {
    if (!shop || !newItem.name || !newItem.base_price) return;

    try {
      await supabase.from('items').insert({
        shop_id: shop.id,
        name: newItem.name,
        base_price: parseFloat(newItem.base_price),
        stock_quantity: parseInt(newItem.stock_quantity) || 0,
        min_stock_alert: parseInt(newItem.min_stock_alert) || 5,
        max_discount_percentage: parseFloat(newItem.max_discount_percentage) || 0,
        max_discount_fixed: parseFloat(newItem.max_discount_fixed) || 0,
        is_active: true
      });

      setShowAdd(false);
      setNewItem({
        name: '',
        base_price: '',
        stock_quantity: '',
        min_stock_alert: '',
        max_discount_percentage: '',
        max_discount_fixed: ''
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;

    try {
      await supabase
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

      setEditingItem(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await supabase.from('items').delete().eq('id', itemId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleStockAdjustment = async (itemId: string, adjustment: number) => {
    const item = items.find((i: Item) => i.id === itemId);
    if (!item) return;

    const newQuantity = Math.max(0, item.stock_quantity + adjustment);
    
    try {
      await supabase
        .from('items')
        .update({ stock_quantity: newQuantity })
        .eq('id', itemId);

      await supabase
        .from('inventory_movements')
        .insert({
          shop_id: shop.id,
          item_id: itemId,
          movement_type: 'ADJUSTMENT',
          quantity_change: adjustment,
          previous_quantity: item.stock_quantity,
          new_quantity: newQuantity,
          notes: adjustment > 0 ? 'Stock added' : 'Stock removed'
        });

      onRefresh();
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-600">Manage your products and stock levels</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150 shadow-lg"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: Item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
                <p className="text-2xl font-bold text-blue-600">₹{item.base_price}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingItem(item)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Stock:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStockAdjustment(item.id, -1)}
                    className="w-6 h-6 bg-red-100 hover:bg-red-200 text-red-600 rounded-full flex items-center justify-center"
                  >
                    <Minus size={12} />
                  </button>
                  <span className={`font-semibold px-2 py-1 rounded ${
                    item.stock_quantity <= item.min_stock_alert 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {item.stock_quantity}
                  </span>
                  <button
                    onClick={() => handleStockAdjustment(item.id, 1)}
                    className="w-6 h-6 bg-green-100 hover:bg-green-200 text-green-600 rounded-full flex items-center justify-center"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Min Alert:</span>
                <span className="text-gray-900">{item.min_stock_alert}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Discount:</span>
                <span className="text-gray-900">{item.max_discount_percentage}% / ₹{item.max_discount_fixed}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                item.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
              {item.stock_quantity <= item.min_stock_alert && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  Low Stock
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Item</h3>
              <button
                onClick={() => setShowAdd(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={newItem.base_price}
                onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={newItem.stock_quantity}
                onChange={(e) => setNewItem({...newItem, stock_quantity: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={newItem.min_stock_alert}
                onChange={(e) => setNewItem({...newItem, min_stock_alert: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={newItem.max_discount_percentage}
                onChange={(e) => setNewItem({...newItem, max_discount_percentage: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount"
                value={newItem.max_discount_fixed}
                onChange={(e) => setNewItem({...newItem, max_discount_fixed: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newItem.name || !newItem.base_price}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={editingItem.base_price}
                onChange={(e) => setEditingItem({...editingItem, base_price: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={editingItem.stock_quantity}
                onChange={(e) => setEditingItem({...editingItem, stock_quantity: parseInt(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={editingItem.min_stock_alert}
                onChange={(e) => setEditingItem({...editingItem, min_stock_alert: parseInt(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={editingItem.max_discount_percentage}
                onChange={(e) => setEditingItem({...editingItem, max_discount_percentage: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount"
                value={editingItem.max_discount_fixed}
                onChange={(e) => setEditingItem({...editingItem, max_discount_fixed: parseFloat(e.target.value)})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingItem.is_active}
                  onChange={(e) => setEditingItem({...editingItem, is_active: e.target.checked})}
                  className="rounded"
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Update Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Staff Tab Component  
const StaffTab = ({ staff, onRefresh, showAdd, setShowAdd, editingStaff, setEditingStaff, showPasscodes, setShowPasscodes, selectedProfile, setSelectedProfile, shop, transactions }: any) => {
  const [newStaff, setNewStaff] = useState({
    name: '',
    passcode: '',
    phone: '',
    email: '',
    address: ''
  });

  const togglePasscodeVisibility = (staffId: string) => {
    setShowPasscodes((prev: any) => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  const handleAddStaff = async () => {
    if (!shop || !newStaff.name || !newStaff.passcode) return;

    try {
      await supabase.from('staff').insert({
        shop_id: shop.id,
        name: newStaff.name,
        passcode_hash: newStaff.passcode, // In production, this should be hashed
        phone: newStaff.phone || null,
        email: newStaff.email || null,
        address: newStaff.address || null,
        is_active: true
      });

      setShowAdd(false);
      setNewStaff({ name: '', passcode: '', phone: '', email: '', address: '' });
      onRefresh();
    } catch (error) {
      console.error('Error adding staff:', error);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    try {
      await supabase
        .from('staff')
        .update({
          name: editingStaff.name,
          passcode_hash: editingStaff.passcode_hash,
          phone: editingStaff.phone,
          email: editingStaff.email,
          address: editingStaff.address,
          is_active: editingStaff.is_active
        })
        .eq('id', editingStaff.id);

      setEditingStaff(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating staff:', error);
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;

    try {
      await supabase.from('staff').delete().eq('id', staffId);
      onRefresh();
    } catch (error) {
      console.error('Error deleting staff:', error);
    }
  };

  const getStaffStats = (staffId: string) => {
    const staffTransactions = transactions.filter((t: any) => t.staff_id === staffId);
    const today = new Date().toDateString();
    const todayTransactions = staffTransactions.filter((t: any) => 
      new Date(t.created_at).toDateString() === today
    );
    
    return {
      totalSales: staffTransactions.reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      totalTransactions: staffTransactions.length,
      todaySales: todayTransactions.reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      todayTransactions: todayTransactions.length
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-gray-600">Manage your team members and their access</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150 shadow-lg"
        >
          <Plus size={20} />
          Add Staff
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member: Staff) => {
          const stats = getStaffStats(member.id);
          return (
            <div key={member.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{member.name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      member.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedProfile(member)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    onClick={() => setEditingStaff(member)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteStaff(member.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Passcode:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">
                      {showPasscodes[member.id] ? member.passcode_hash : '****'}
                    </span>
                    <button
                      onClick={() => togglePasscodeVisibility(member.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasscodes[member.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">₹{stats.todaySales}</p>
                    <p className="text-xs text-gray-500">Today's Sales</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{stats.todayTransactions}</p>
                    <p className="text-xs text-gray-500">Today's Orders</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Profile Modal */}
      {selectedProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Staff Profile</h3>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="text-blue-600" size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-900">{selectedProfile.name}</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedProfile.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {selectedProfile.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Shield className="text-gray-600" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Passcode</p>
                  <p className="font-mono">{selectedProfile.passcode_hash}</p>
                </div>
              </div>

              {selectedProfile.phone && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="text-gray-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p>{selectedProfile.phone}</p>
                  </div>
                </div>
              )}

              {selectedProfile.email && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="text-gray-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p>{selectedProfile.email}</p>
                  </div>
                </div>
              )}

              {selectedProfile.address && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="text-gray-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Address</p>
                    <p>{selectedProfile.address}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Clock className="text-gray-600" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Joined</p>
                  <p>{new Date(selectedProfile.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {(() => {
                const stats = getStaffStats(selectedProfile.id);
                return (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xl font-bold text-blue-600">₹{stats.totalSales}</p>
                      <p className="text-sm text-gray-600">Total Sales</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">{stats.totalTransactions}</p>
                      <p className="text-sm text-gray-600">Total Orders</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Staff Member</h3>
              <button
                onClick={() => setShowAdd(false)}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Numeric Passcode (e.g., 129) *"
                value={newStaff.passcode}
                onChange={(e) => setNewStaff({...newStaff, passcode: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newStaff.email}
                onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Address"
                value={newStaff.address}
                onChange={(e) => setNewStaff({...newStaff, address: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStaff}
                disabled={!newStaff.name || !newStaff.passcode}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Staff Member</h3>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Numeric Passcode"
                value={editingStaff.passcode_hash}
                onChange={(e) => setEditingStaff({...editingStaff, passcode_hash: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={editingStaff.phone || ''}
                onChange={(e) => setEditingStaff({...editingStaff, phone: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={editingStaff.email || ''}
                onChange={(e) => setEditingStaff({...editingStaff, email: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Address"
                value={editingStaff.address || ''}
                onChange={(e) => setEditingStaff({...editingStaff, address: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingStaff.is_active}
                  onChange={(e) => setEditingStaff({...editingStaff, is_active: e.target.checked})}
                  className="rounded"
                />
                <span>Active</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingStaff(null)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStaff}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Update Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Transactions Tab Component
const TransactionsTab = ({ transactions, staff, filter, setFilter }: any) => {
  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Time', 'Amount', 'Item', 'Staff', 'Payment Mode', 'Discount', 'Status'].join(','),
      ...filteredTransactions.map((t: any) => [
        new Date(t.created_at).toLocaleDateString(),
        new Date(t.created_at).toLocaleTimeString(),
        t.entered_amount,
        t.inferred_item?.name || 'Unknown',
        t.staff?.name || 'Unknown',
        t.payment_mode,
        t.discount_amount,
        t.is_credit_settled ? 'Settled' : 'Pending'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTransactions = transactions.filter((t: any) => {
    if (filter.date && !t.created_at.includes(filter.date)) return false;
    if (filter.paymentMode && t.payment_mode !== filter.paymentMode) return false;
    if (filter.staff && t.staff_id !== filter.staff) return false;
    return true;
  });

  const clearFilters = () => {
    setFilter({ date: '', paymentMode: '', staff: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Transaction History</h2>
          <p className="text-gray-600">View and analyze all transactions</p>
        </div>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg"
        >
          <Download size={20} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filter.date}
              onChange={(e) => setFilter({...filter, date: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
            <select
              value={filter.paymentMode}
              onChange={(e) => setFilter({...filter, paymentMode: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff</label>
            <select
              value={filter.staff}
              onChange={(e) => setFilter({...filter, staff: e.target.value})}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Staff</option>
              {staff.map((s: Staff) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
            >
              Clear Filters
            </button>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction: any) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₹{transaction.entered_amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.inferred_item?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.staff?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
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
                      {transaction.discount_amount > 0 ? (
                        <span className="text-yellow-600">
                          ₹{transaction.discount_amount}
                          {transaction.is_discount_override && (
                            <span className="ml-1 text-red-500 font-bold">*</span>
                          )}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.is_credit_settled 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {transaction.is_credit_settled ? 'Settled' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="mx-auto mb-3" size={48} />
                    <p>No transactions found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Reports Tab Component
const ReportsTab = ({ transactions, items, staff, dailyReport }: any) => {
  const [reportPeriod, setReportPeriod] = useState('today');
  
  const getReportData = () => {
    const now = new Date();
    let startDate: Date;
    
    switch (reportPeriod) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    const filteredTransactions = transactions.filter((t: any) => 
      new Date(t.created_at) >= startDate
    );
    
    return {
      totalSales: filteredTransactions.reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      totalTransactions: filteredTransactions.length,
      totalDiscounts: filteredTransactions.reduce((sum: number, t: any) => sum + t.discount_amount, 0),
      cashSales: filteredTransactions.filter((t: any) => t.payment_mode === 'CASH').reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      upiSales: filteredTransactions.filter((t: any) => t.payment_mode === 'UPI').reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      creditSales: filteredTransactions.filter((t: any) => t.payment_mode === 'CREDIT').reduce((sum: number, t: any) => sum + t.entered_amount, 0),
      transactions: filteredTransactions
    };
  };

  const reportData = getReportData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-600">Business insights and performance metrics</p>
        </div>
        <select
          value={reportPeriod}
          onChange={(e) => setReportPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-blue-600">₹{reportData.totalSales}</p>
            </div>
            <DollarSign className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-bold text-green-600">{reportData.totalTransactions}</p>
            </div>
            <BarChart className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Discounts</p>
              <p className="text-2xl font-bold text-yellow-600">₹{reportData.totalDiscounts}</p>
            </div>
            <TrendingUp className="text-yellow-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Order Value</p>
              <p className="text-2xl font-bold text-purple-600">
                ₹{reportData.totalTransactions > 0 ? Math.round(reportData.totalSales / reportData.totalTransactions) : 0}
              </p>
            </div>
            <BarChart3 className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Payment Method Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-green-50 rounded-xl">
            <Banknote className="mx-auto text-green-600 mb-3" size={32} />
            <p className="text-sm font-medium text-green-700">Cash</p>
            <p className="text-2xl font-bold text-green-600">₹{reportData.cashSales}</p>
            <p className="text-sm text-gray-500">
              {reportData.totalSales > 0 ? Math.round((reportData.cashSales / reportData.totalSales) * 100) : 0}% of total
            </p>
          </div>
          <div className="text-center p-6 bg-blue-50 rounded-xl">
            <Smartphone className="mx-auto text-blue-600 mb-3" size={32} />
            <p className="text-sm font-medium text-blue-700">UPI</p>
            <p className="text-2xl font-bold text-blue-600">₹{reportData.upiSales}</p>
            <p className="text-sm text-gray-500">
              {reportData.totalSales > 0 ? Math.round((reportData.upiSales / reportData.totalSales) * 100) : 0}% of total
            </p>
          </div>
          <div className="text-center p-6 bg-orange-50 rounded-xl">
            <CreditCard className="mx-auto text-orange-600 mb-3" size={32} />
            <p className="text-sm font-medium text-orange-700">Credit</p>
            <p className="text-2xl font-bold text-orange-600">₹{reportData.creditSales}</p>
            <p className="text-sm text-gray-500">
              {reportData.totalSales > 0 ? Math.round((reportData.creditSales / reportData.totalSales) * 100) : 0}% of total
            </p>
          </div>
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Top Selling Items</h3>
        <div className="space-y-4">
          {(() => {
            const itemSales = items.map((item: Item) => {
              const sales = reportData.transactions.filter((t: any) => t.inferred_item_id === item.id);
              return {
                ...item,
                salesCount: sales.length,
                salesAmount: sales.reduce((sum: number, t: any) => sum + t.entered_amount, 0)
              };
            }).sort((a: any, b: any) => b.salesAmount - a.salesAmount).slice(0, 5);

            return itemSales.length > 0 ? (
              itemSales.map((item: any, index: number) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.salesCount} sales</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-blue-600">₹{item.salesAmount}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto mb-3" size={48} />
                <p>No sales data available</p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// Settings Tab Component
const SettingsTab = ({ shop, settings, setSettings, onSave, isSaving, setIsSaving }: any) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleSave = async () => {
    if (!shop) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          name: settings.name,
          currency: settings.currency,
          upi_id: settings.upi_id,
          upi_qr_url: settings.upi_qr_url
        })
        .eq('id', shop.id);

      if (error) throw error;

      await onSave();
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // In a real app, you'd upload to a storage service like Supabase Storage
      // For demo, we'll create a local URL
      const url = URL.createObjectURL(file);
      setSettings({...settings, upi_qr_url: url});
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload QR code');
    } finally {
      setIsUploading(false);
    }
  };

  const currencies = [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'NPR', name: 'Nepalese Rupee', symbol: 'रू' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Shop Settings</h2>
        <p className="text-gray-600">Configure your shop details and preferences</p>
      </div>
      
      {/* Shop Information */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="text-blue-600" size={24} />
          <h3 className="text-xl font-bold text-gray-900">Shop Information</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({...settings, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your shop name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select 
              value={settings.currency}
              onChange={(e) => setSettings({...settings, currency: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.name} ({currency.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="text-green-600" size={24} />
          <h3 className="text-xl font-bold text-gray-900">Payment Settings</h3>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
            <input
              type="text"
              value={settings.upi_id}
              onChange={(e) => setSettings({...settings, upi_id: e.target.value})}
              placeholder="your-upi@bank"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              This will be displayed to customers for UPI payments
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">QR Code for UPI Payments</label>
            <div className="space-y-4">
              <input
                type="url"
                value={settings.upi_qr_url}
                onChange={(e) => setSettings({...settings, upi_qr_url: e.target.value})}
                placeholder="https://example.com/qr-code.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Or upload QR code image:</span>
                <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
                  <Upload size={16} />
                  {isUploading ? 'Uploading...' : 'Upload QR'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
              
              {settings.upi_qr_url && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">QR Code Preview:</p>
                  <div className="inline-block p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <img 
                      src={settings.upi_qr_url} 
                      alt="QR Code Preview" 
                      className="w-32 h-32 object-contain"
                      onError={(e) => {
                        console.error('QR Code preview failed to load');
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Settings */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="text-purple-600" size={24} />
          <h3 className="text-xl font-bold text-gray-900">System Settings</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Real-time Updates</p>
              <p className="text-sm text-gray-600">Automatically sync data across devices</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Low Stock Alerts</p>
              <p className="text-sm text-gray-600">Get notified when items are running low</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Transaction Notifications</p>
              <p className="text-sm text-gray-600">Receive alerts for new transactions</p>
            </div>
            <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="text-orange-600" size={24} />
          <h3 className="text-xl font-bold text-gray-900">Data Management</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Download className="text-blue-600" size={20} />
              <div>
                <p className="font-medium text-gray-900">Export Data</p>
                <p className="text-sm text-gray-600">Download all your business data</p>
              </div>
            </div>
          </button>
          
          <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              <Upload className="text-green-600" size={20} />
              <div>
                <p className="font-medium text-gray-900">Import Data</p>
                <p className="text-sm text-gray-600">Import items and staff data</p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};