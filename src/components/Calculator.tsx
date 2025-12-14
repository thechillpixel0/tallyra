import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Banknote, Trash2, Check, AlertTriangle, QrCode, CheckCircle, Plus, Minus, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Item, Transaction } from '../types/database';

interface CalculatorProps {
  onTransactionComplete?: (transaction: Transaction) => void;
  isOwner?: boolean;
}

export const Calculator = ({ onTransactionComplete, isOwner = false }: CalculatorProps) => {
  const { shop, staff } = useAuth();
  const [display, setDisplay] = useState('0');
  const [items, setItems] = useState<Item[]>([]);
  const [showPaymentModes, setShowPaymentModes] = useState(false);
  const [inferredItem, setInferredItem] = useState<Item | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showDiscountWarning, setShowDiscountWarning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [showCashInput, setShowCashInput] = useState(false);
  const [discountOverride, setDiscountOverride] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT' | null>(null);
  const [changeAmount, setChangeAmount] = useState(0);
  const [showChange, setShowChange] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomProduct, setShowCustomProduct] = useState(false);
  const [customProduct, setCustomProduct] = useState({ name: '', price: '' });
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [selectedCustomItem, setSelectedCustomItem] = useState<Item | null>(null);

  // Derived state
  const currentAmount = parseFloat(display) || 0;

  useEffect(() => {
    if (shop) {
      loadItems();
      setupRealtimeSubscription();
    }
  }, [shop]);

  const setupRealtimeSubscription = () => {
    if (!shop) return;

    const subscription = supabase
      .channel('calculator-items')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'items', filter: `shop_id=eq.${shop.id}` },
        () => {
          loadItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const loadItems = async () => {
    if (!shop) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .order('base_price', { ascending: true });

      if (data && !error) {
        setItems(data);
      } else {
        console.error('Error loading items:', error);
        setError('Failed to load items');
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    setError('');
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else if (display.length < 10) {
      setDisplay(display + num);
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setShowPaymentModes(false);
    setInferredItem(null);
    setDiscountAmount(0);
    setShowDiscountWarning(false);
    setCashReceived('');
    setShowCashInput(false);
    setShowUpiQr(false);
    setDiscountOverride(false);
    setShowSuccess(false);
    setShowChange(false);
    setChangeAmount(0);
    setSelectedPaymentMode(null);
    setError('');
    setShowCustomProduct(false);
    setShowItemSelector(false);
    setSelectedCustomItem(null);
  };

  const inferItemFromAmount = (amount: number) => {
    if (!items.length) return { item: null, discount: 0 };
    
    // If custom item is selected, use it
    if (selectedCustomItem) {
      const discount = Math.max(0, selectedCustomItem.base_price - amount);
      return { item: selectedCustomItem, discount };
    }
    
    // Improved item inference logic
    let exactMatch = null;
    let bestDiscountMatch = null;
    let closestMatch = null;
    let smallestDifference = Infinity;
    
    // Handle multiple quantity logic
    const possibleQuantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 24, 25, 30, 50, 100];
    
    for (const item of items) {
      // Check for exact match
      if (amount === item.base_price) {
        exactMatch = item;
        break;
      }
      
      // Check for multiple quantity matches
      for (const qty of possibleQuantities) {
        const totalPrice = item.base_price * qty;
        if (amount === totalPrice) {
          // Create a virtual item for multiple quantities
          const multiItem = {
            ...item,
            name: `${item.name} (${qty} pcs)`,
            base_price: totalPrice,
          };
          return { item: multiItem, discount: 0 };
        }
        
        // Check for discounted multiple quantities
        const maxDiscount = Math.max(
          (totalPrice * (item.max_discount_percentage || 0)) / 100,
          (item.max_discount_fixed || 0) * qty
        );
        const minPrice = totalPrice - maxDiscount;
        
        if (amount >= minPrice && amount < totalPrice) {
          const multiItem = {
            ...item,
            name: `${item.name} (${qty} pcs)`,
            base_price: totalPrice,
          };
          const discount = totalPrice - amount;
          if (!bestDiscountMatch || discount < (bestDiscountMatch.item.base_price - amount)) {
            bestDiscountMatch = { item: multiItem, discount };
          }
        }
      }
    }
    
    if (exactMatch) {
      return { item: exactMatch, discount: 0 };
    }
    
    if (bestDiscountMatch) {
      return bestDiscountMatch;
    }
    
    // Single item discount matching
    for (const item of items) {
      const maxDiscount = Math.max(
        (item.base_price * (item.max_discount_percentage || 0)) / 100,
        item.max_discount_fixed || 0
      );
      const minPrice = item.base_price - maxDiscount;
      
      if (amount >= minPrice && amount <= item.base_price) {
        const difference = item.base_price - amount;
        if (!bestDiscountMatch || difference < (bestDiscountMatch.item.base_price - amount)) {
          bestDiscountMatch = { item, discount: difference };
        }
      }
    }
    
    if (bestDiscountMatch) {
      return bestDiscountMatch;
    }
    
    // Find closest price match as fallback
    for (const item of items) {
      const difference = Math.abs(amount - item.base_price);
      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestMatch = item;
      }
    }
    
    // Check for rounded amounts (like 10, 20, 50, 100)
    const roundedAmounts = [10, 20, 50, 100, 200, 500, 1000];
    if (roundedAmounts.includes(amount)) {
      for (const item of items) {
        // If amount is a round number, prefer items close to that price
        if (Math.abs(item.base_price - amount) <= amount * 0.1) { // Within 10%
          closestMatch = item;
          break;
        }
      }
    }
    
    const discount = closestMatch ? Math.max(0, closestMatch.base_price - amount) : 0;
    return { item: closestMatch, discount };
  };

  const calculateDiscount = (enteredAmount: number, basePrice: number) => {
    if (enteredAmount >= basePrice) {
      return { amount: 0, percentage: 0 };
    }
    
    const discountAmount = basePrice - enteredAmount;
    const discountPercentage = (discountAmount / basePrice) * 100;
    
    return {
      amount: discountAmount,
      percentage: Math.round(discountPercentage * 100) / 100
    };
  };

  const isDiscountAllowed = (item: Item, enteredAmount: number) => {
    const maxDiscount = Math.max(
      (item.base_price * (item.max_discount_percentage || 0)) / 100,
      item.max_discount_fixed || 0
    );
    const minAllowedPrice = item.base_price - maxDiscount;
    return enteredAmount >= minAllowedPrice;
  };

  const handleConfirmAmount = () => {
    const amount = parseFloat(display);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    const { item, discount } = inferItemFromAmount(amount);
    if (!item) {
      setError('No matching item found for this amount');
      return;
    }

    setInferredItem(item);
    setDiscountAmount(discount);

    const discountPercentage = (discount / item.base_price) * 100;
    const exceedsPercentageLimit = discountPercentage > (item.max_discount_percentage || 0);
    const exceedsFixedLimit = discount > (item.max_discount_fixed || 0);

    if (discount > 0 && (exceedsPercentageLimit || exceedsFixedLimit) && !isOwner) {
      setShowDiscountWarning(true);
    } else {
      setShowPaymentModes(true);
    }
  };

  const handleDiscountConfirm = (confirmed: boolean) => {
    setShowDiscountWarning(false);
    if (confirmed) {
      setDiscountOverride(true);
      setShowPaymentModes(true);
    } else {
      handleClear();
    }
  };

  const handlePayment = async (mode: 'CASH' | 'UPI' | 'CREDIT', cashAmount?: number) => {
    if (!currentAmount || !inferredItem || !shop) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const discount = calculateDiscount(currentAmount, inferredItem.base_price);
      const needsOverride = !isDiscountAllowed(inferredItem, currentAmount);
      const changeAmount = cashAmount ? Math.max(0, cashAmount - currentAmount) : 0;
      
      // Use staff ID if available, otherwise use a default for owner
      const staffId = staff?.id || 'owner-transaction';
      
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          shop_id: shop.id,
          staff_id: staffId,
          entered_amount: currentAmount,
          inferred_item_id: inferredItem.id,
          base_price: inferredItem.base_price,
          discount_amount: discount.amount,
          discount_percentage: discount.percentage,
          payment_mode: mode,
          cash_received: cashAmount || null,
          change_amount: changeAmount || null,
          is_discount_override: needsOverride,
          is_credit_settled: mode !== 'CREDIT'
        })
        .select()
        .single();
      
      if (transactionError) {
        throw transactionError;
      }
      
      // Update stock
      const newQuantity = Math.max(0, (inferredItem.stock_quantity || 0) - 1);
      
      await supabase
        .from('items')
        .update({ stock_quantity: newQuantity })
        .eq('id', inferredItem.id);
      
      // Record inventory movement
      await supabase
        .from('inventory_movements')
        .insert({
          shop_id: shop.id,
          item_id: inferredItem.id,
          transaction_id: transaction.id,
          movement_type: 'SALE',
          quantity_change: -1,
          previous_quantity: inferredItem.stock_quantity || 0,
          new_quantity: newQuantity
        });
      
      if (changeAmount > 0) {
        setChangeAmount(changeAmount);
        setShowChange(true);
      } else {
        setShowSuccess(true);
      }
      
      if (onTransactionComplete) {
        onTransactionComplete(transaction);
      }
      
      setTimeout(() => {
        handleClear();
      }, 2000);
      
    } catch (error) {
      console.error('Transaction error:', error);
      setError('Transaction failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCashPayment = () => {
    setSelectedPaymentMode('CASH');
    setShowCashInput(true);
  };

  const processCashPayment = async () => {
    const cashAmount = parseFloat(cashReceived) || currentAmount;
    await handlePayment('CASH', cashAmount);
  };

  const handleUpiPayment = () => {
    setSelectedPaymentMode('UPI');
    setShowUpiQr(true);
  };

  const confirmUpiPayment = () => {
    handlePayment('UPI');
  };

  const handleCreditPayment = () => {
    handlePayment('CREDIT');
  };

  const handleAddCustomProduct = async () => {
    if (!customProduct.name || !customProduct.price || !shop) return;

    try {
      const { data, error } = await supabase
        .from('items')
        .insert({
          shop_id: shop.id,
          name: customProduct.name,
          base_price: parseFloat(customProduct.price),
          stock_quantity: 1000, // High stock for custom items
          min_stock_alert: 10,
          max_discount_percentage: 0,
          max_discount_fixed: 0,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setCustomProduct({ name: '', price: '' });
      setShowCustomProduct(false);
      loadItems();
      
      // Auto-select the new item
      setSelectedCustomItem(data);
      setDisplay(customProduct.price);
    } catch (error) {
      console.error('Error adding custom product:', error);
      setError('Failed to add custom product');
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

  useEffect(() => {
    if (currentAmount > 0) {
      const { item } = inferItemFromAmount(currentAmount);
      if (!selectedCustomItem) {
        setInferredItem(item);
      }
    } else {
      setInferredItem(null);
    }
  }, [display, items, selectedCustomItem]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calculator...</p>
        </div>
      </div>
    );
  }

  const numberButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['00', '0', '⌫']
  ];

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Smart Calculator</h2>
        <p className="text-gray-600">Enter amount to start transaction</p>
      </div>

      {/* Amount Display */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 shadow-inner">
        <div className="text-right">
          <div className="text-4xl font-mono text-green-400 mb-2 tracking-wider">
            {currentAmount > 0 ? formatCurrency(currentAmount) : '₹0'}
          </div>
          {(inferredItem || selectedCustomItem) && (
            <div className="text-sm text-gray-300 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-blue-300">{(selectedCustomItem || inferredItem)?.name}</span>
                {selectedCustomItem && (
                  <button
                    onClick={() => setSelectedCustomItem(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex justify-between">
                <span>Base: {formatCurrency((selectedCustomItem || inferredItem)?.base_price || 0)}</span>
                {currentAmount < ((selectedCustomItem || inferredItem)?.base_price || 0) && (
                  <span className="text-orange-400">
                    Discount: {formatCurrency(((selectedCustomItem || inferredItem)?.base_price || 0) - currentAmount)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setShowItemSelector(true)}
          className="py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-xl 
                     transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Select Item
        </button>
        <button
          onClick={() => setShowCustomProduct(true)}
          className="py-3 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-xl 
                     transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Custom Item
        </button>
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {numberButtons.flat().map((num, index) => {
          if (num === '⌫') {
            return (
              <button
                key={index}
                onClick={handleBackspace}
                className="h-16 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 
                           text-white text-xl font-bold rounded-2xl transition-all duration-150 active:scale-95 
                           shadow-lg hover:shadow-xl"
                disabled={isProcessing}
              >
                ⌫
              </button>
            );
          }

          return (
            <button
              key={index}
              onClick={() => handleNumberClick(num)}
              className="h-16 bg-gradient-to-b from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 
                         text-xl font-bold text-gray-800 rounded-2xl transition-all duration-150 active:scale-95 
                         shadow-lg hover:shadow-xl border border-gray-300"
              disabled={isProcessing}
            >
              {num}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleClear}
          className="w-full py-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700
                     text-white text-lg font-bold rounded-2xl transition-all duration-200 active:scale-95 
                     shadow-lg hover:shadow-xl"
          disabled={isProcessing}
        >
          Clear All
        </button>

        {currentAmount > 0 && (inferredItem || selectedCustomItem) && !showPaymentModes && (
          <button
            onClick={handleConfirmAmount}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                       text-white text-lg font-bold rounded-2xl transition-all duration-200 active:scale-95 
                       shadow-lg hover:shadow-xl"
            disabled={isProcessing}
          >
            Continue to Payment
          </button>
        )}
      </div>

      {/* Payment Mode Selection */}
      {showPaymentModes && !showCashInput && !showUpiQr && (
        <div className="space-y-4 mt-6">
          <h3 className="text-xl font-bold text-gray-800 text-center mb-6">
            Choose Payment Method
          </h3>
          
          <button
            onClick={handleCashPayment}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                       text-white text-lg font-bold rounded-2xl transition-all duration-150 active:scale-95 
                       flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            disabled={isProcessing}
          >
            <Banknote size={24} />
            Cash Payment
          </button>
          
          <button
            onClick={handleUpiPayment}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 
                       text-white text-lg font-bold rounded-2xl transition-all duration-150 active:scale-95 
                       flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            disabled={isProcessing}
          >
            <Smartphone size={24} />
            UPI Payment
          </button>
          
          <button
            onClick={handleCreditPayment}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 
                       text-white text-lg font-bold rounded-2xl transition-all duration-150 active:scale-95 
                       flex items-center justify-center gap-3 shadow-lg hover:shadow-xl"
            disabled={isProcessing}
          >
            <CreditCard size={24} />
            Credit Sale
          </button>
          
          <button
            onClick={() => setShowPaymentModes(false)}
            className="w-full py-3 bg-gray-400 hover:bg-gray-500 text-white font-bold rounded-2xl 
                       transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} />
            Back
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mt-4 text-center">
          <AlertTriangle className="inline mr-2" size={20} />
          {error}
        </div>
      )}

      {/* Modals */}
      
      {/* Item Selector Modal */}
      {showItemSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Select Item</h3>
              <button
                onClick={() => setShowItemSelector(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedCustomItem(item);
                    setDisplay(item.base_price.toString());
                    setShowItemSelector(false);
                  }}
                  className="w-full p-4 text-left bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">Stock: {item.stock_quantity}</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(item.base_price)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Product Modal */}
      {showCustomProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Custom Item</h3>
              <button
                onClick={() => setShowCustomProduct(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Item Name"
                value={customProduct.name}
                onChange={(e) => setCustomProduct({...customProduct, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Price"
                value={customProduct.price}
                onChange={(e) => setCustomProduct({...customProduct, price: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCustomProduct(false)}
                className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomProduct}
                disabled={!customProduct.name || !customProduct.price}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                Add & Use
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Confirmation Modal */}
      {showDiscountWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertTriangle className="mx-auto text-orange-500 mb-4" size={48} />
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                High Discount Alert
              </h3>
              <p className="text-gray-600 mb-6">
                This discount exceeds the allowed limit. Owner approval required.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDiscountConfirm(false)}
                  className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDiscountConfirm(true)}
                  className="py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl"
                >
                  Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Input Modal */}
      {showCashInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 text-center mb-4">
              Cash Payment
            </h3>
            <div className="mb-4">
              <p className="text-center text-2xl font-bold text-green-600 mb-4">
                Amount: {formatCurrency(currentAmount)}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cash Received (Optional)
              </label>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder={`Enter amount (min: ${formatCurrency(currentAmount)})`}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {parseFloat(cashReceived) > currentAmount && (
                <p className="text-sm text-green-600 mt-2 text-center">
                  Change: {formatCurrency(parseFloat(cashReceived) - currentAmount)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCashInput(false)}
                className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={processCashPayment}
                disabled={isProcessing}
                className="py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI QR Modal */}
      {showUpiQr && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              UPI Payment
            </h3>
            <div className="bg-gray-50 rounded-xl p-6 mb-4">
              {shop?.upi_qr_url ? (
                <div>
                  <img 
                    src={shop.upi_qr_url} 
                    alt="UPI QR Code" 
                    className="mx-auto w-48 h-48 object-contain rounded-lg shadow-lg border border-gray-200"
                    onError={(e) => {
                      console.error('QR Code failed to load:', shop.upi_qr_url);
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="text-center py-8">
                            <div class="mx-auto text-gray-400 mb-2">⚠️</div>
                            <p class="text-gray-600">Failed to load QR Code</p>
                            <p class="text-xs text-gray-500 mt-1">Check URL in settings</p>
                          </div>
                        `;
                      }
                    }}
                  />
                  {shop.upi_id && (
                    <p className="text-sm text-gray-600 mt-3 text-center font-mono bg-white px-3 py-1 rounded border">
                      {shop.upi_id}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <QrCode className="mx-auto text-gray-400 mb-2" size={64} />
                  <p className="text-gray-600 mb-2">QR Code not configured</p>
                  <p className="text-xs text-gray-500">Add QR URL in owner settings</p>
                  {shop?.upi_id && (
                    <p className="text-sm text-gray-600 mt-3 font-mono bg-white px-3 py-1 rounded border inline-block">
                      {shop.upi_id}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(currentAmount)}
              </p>
            </div>
            <p className="text-sm text-gray-500 text-center mb-4">
              Scan QR code or use UPI ID to pay
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowUpiQr(false)}
                className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={confirmUpiPayment}
                disabled={isProcessing}
                className="py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Payment Done'}
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Click "Payment Done" after completing the UPI payment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Transaction Successful!
            </h3>
            <p className="text-gray-600">
              Sale completed for {formatCurrency(currentAmount)}
            </p>
          </div>
        </div>
      )}

      {/* Change Modal */}
      {showChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <Banknote className="mx-auto text-green-500 mb-4" size={64} />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Transaction Complete!
            </h3>
            <p className="text-gray-600 mb-2">
              Sale: {formatCurrency(currentAmount)}
            </p>
            <p className="text-lg font-bold text-green-600">
              Change to Return: {formatCurrency(changeAmount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;