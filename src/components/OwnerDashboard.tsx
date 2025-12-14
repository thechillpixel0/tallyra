import { useState, useEffect } from 'react';
import { BarChart3, Package, Users, Settings, TrendingUp, CreditCard, AlertTriangle, LogOut, Plus, CreditCard as Edit2, Calendar, Download, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Item, Staff, Transaction, DailySalesReport } from '../types/database';

export const OwnerDashboard = () => {
  const { shop, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState<Item[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyReport, setDailyReport] = useState<DailySalesReport | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (shop) {
      loadDashboardData();
    }
  }, [shop]);

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
      .limit(50);
    
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

      // Calculate staff performance
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'staff', label: 'Staff', icon: Users },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const lowStockItems = items.filter(item => item.stock_quantity <= item.min_stock_alert);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-2xl shadow-lg p-4">
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
                          ? 'bg-blue-600 text-white'
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
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="text-sm text-yellow-700">
                      {item.name}: {item.stock_quantity} left
                    </div>
                  ))}
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
            {activeTab === 'items' && (
              <ItemsTab 
                items={items} 
                onRefresh={loadItems}
                showAdd={showAddItem}
                setShowAdd={setShowAddItem}
              />
            )}
            {activeTab === 'staff' && (
              <StaffTab 
                staff={staff} 
                onRefresh={loadStaff}
                showAdd={showAddStaff}
                setShowAdd={setShowAddStaff}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsTab transactions={transactions} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab shop={shop} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ dailyReport, items, staff, transactions }: any) => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
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

      <div className="bg-white rounded-2xl shadow-lg p-6">
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

      <div className="bg-white rounded-2xl shadow-lg p-6">
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

      <div className="bg-white rounded-2xl shadow-lg p-6">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-green-50 rounded-xl">
          <p className="text-sm font-medium text-green-700">Cash</p>
          <p className="text-2xl font-bold text-green-600">₹{dailyReport?.cash_sales || 0}</p>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-xl">
          <p className="text-sm font-medium text-blue-700">UPI</p>
          <p className="text-2xl font-bold text-blue-600">₹{dailyReport?.upi_sales || 0}</p>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-xl">
          <p className="text-sm font-medium text-orange-700">Credit</p>
          <p className="text-2xl font-bold text-orange-600">₹{dailyReport?.credit_sales || 0}</p>
        </div>
      </div>
    </div>

    {/* Staff Performance */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Today's Staff Performance</h2>
      <div className="space-y-4">
        {dailyReport?.staff_performance?.map((performance: any) => (
          <div key={performance.staff_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-semibold text-gray-900">{performance.staff_name}</p>
              <p className="text-sm text-gray-600">{performance.transaction_count} transactions</p>
            </div>
            <p className="text-lg font-bold text-blue-600">₹{performance.total_amount}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Items Tab Component
const ItemsTab = ({ items, onRefresh, showAdd, setShowAdd }: any) => {
  const [newItem, setNewItem] = useState({
    name: '',
    base_price: '',
    stock_quantity: '',
    min_stock_alert: '',
    max_discount_percentage: '',
    max_discount_fixed: ''
  });

  const handleAddItem = async () => {
    // Implementation for adding item
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: Item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                <p className="text-2xl font-bold text-blue-600">₹{item.base_price}</p>
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Edit2 size={16} />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Stock:</span>
                <span className={`font-semibold ${
                  item.stock_quantity <= item.min_stock_alert 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {item.stock_quantity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Min Alert:</span>
                <span className="text-gray-900">{item.min_stock_alert}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max Discount:</span>
                <span className="text-gray-900">{item.max_discount_percentage}%</span>
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
            </div>
          </div>
        ))}
      </div>

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Item</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Base Price"
                value={newItem.base_price}
                onChange={(e) => setNewItem({...newItem, base_price: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Stock Quantity"
                value={newItem.stock_quantity}
                onChange={(e) => setNewItem({...newItem, stock_quantity: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Min Stock Alert"
                value={newItem.min_stock_alert}
                onChange={(e) => setNewItem({...newItem, min_stock_alert: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount %"
                value={newItem.max_discount_percentage}
                onChange={(e) => setNewItem({...newItem, max_discount_percentage: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Max Discount Fixed Amount"
                value={newItem.max_discount_fixed}
                onChange={(e) => setNewItem({...newItem, max_discount_fixed: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Staff Tab Component  
const StaffTab = ({ staff, onRefresh, showAdd, setShowAdd }: any) => {
  const [newStaff, setNewStaff] = useState({
    name: '',
    passcode: ''
  });
  const [showPasscodes, setShowPasscodes] = useState<{[key: string]: boolean}>({});

  const togglePasscodeVisibility = (staffId: string) => {
    setShowPasscodes(prev => ({
      ...prev,
      [staffId]: !prev[staffId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-xl transition-colors duration-150"
        >
          <Plus size={20} />
          Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Staff Members</h3>
          <div className="space-y-4">
            {staff.map((member: Staff) => (
              <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <h4 className="font-semibold text-gray-900">{member.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">Passcode:</span>
                    <span className="text-sm font-mono">
                      {showPasscodes[member.id] ? '****' : '****'}
                    </span>
                    <button
                      onClick={() => togglePasscodeVisibility(member.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showPasscodes[member.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                  
                  <button className="p-2 text-gray-400 hover:text-gray-600">
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Add New Staff Member</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Staff Name"
                value={newStaff.name}
                onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Numeric Passcode (e.g., 129)"
                value={newStaff.passcode}
                onChange={(e) => setNewStaff({...newStaff, passcode: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Transactions Tab Component
const TransactionsTab = ({ transactions }: any) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
          <Calendar size={16} />
          Filter Date
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          <Download size={16} />
          Export
        </button>
      </div>
    </div>

    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
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
                Staff
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction: any) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(transaction.created_at).toLocaleString()}
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
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {transaction.discount_amount > 0 ? (
                    <span className="text-yellow-600">
                      ₹{transaction.discount_amount}
                      {transaction.is_discount_override && (
                        <span className="ml-1 text-red-500">*</span>
                      )}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Settings Tab Component
const SettingsTab = ({ shop }: any) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-gray-900">Shop Settings</h2>
    
    {/* Shop Information */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Shop Information</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name</label>
          <input
            type="text"
            value={shop?.name || ''}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
          <select className="w-full px-4 py-3 border border-gray-300 rounded-lg">
            <option value="INR">Indian Rupee (₹)</option>
          </select>
        </div>
      </div>
    </div>

    {/* Payment Settings */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
          <input
            type="text"
            value={shop?.upi_id || ''}
            placeholder="your-upi@bank"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">QR Code URL</label>
          <input
            type="url"
            value={shop?.upi_qr_url || ''}
            placeholder="https://example.com/qr-code.jpg"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
    </div>

    {/* Security Settings */}
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
      <div className="space-y-4">
        <button className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg">
          Change Master Passcode
        </button>
      </div>
    </div>
  </div>
);