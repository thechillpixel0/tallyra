import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Banknote, Trash2, Check, AlertTriangle, QrCode, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Item, Transaction } from '../types/database';

interface CalculatorProps {
  onTransactionComplete?: (transaction: Transaction) => void;
}

export const Calculator = ({ onTransactionComplete }: CalculatorProps) => {
  const { shop, staff } = useAuth();
  const [display, setDisplay] = useState('0');
  const [items, setItems] = useState<Item[]>([]);
  const [showPaymentModes, setShowPaymentModes] = useState(false);
  const [inferredItem, setInferredItem] = useState<Item | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showDiscountWarning, setShowDiscountWarning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [cashReceived, setCashReceived] = useState(0);
  const [showCashInput, setShowCashInput] = useState(false);
  const [discountOverride, setDiscountOverride] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT' | null>(null);
  const [changeAmount, setChangeAmount] = useState(0);
  const [showChange, setShowChange] = useState(false);
  const [error, setError] = useState('');
  const [showDiscountConfirm, setShowDiscountConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Derived state
  const currentAmount = parseFloat(display) || 0;

  useEffect(() => {
    if (shop) {
      loadItems();
    }
  }, [shop]);

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
    setError(''); // Clear any previous errors
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setShowPaymentModes(false);
    setInferredItem(null);
    setDiscountAmount(0);
    setShowDiscountWarning(false);
    setCashReceived(0);
    setShowCashInput(false);
    setShowQRCode(false);
    setShowUpiQr(false);
    setDiscountOverride(false);
    setShowSuccess(false);
    setShowChange(false);
    setChangeAmount(0);
    setSelectedPaymentMode(null);
    setError('');
    setShowDiscountConfirm(false);
  };

  const inferItemFromAmount = (amount: number) => {
    if (!items.length) return { item: null, discount: 0 };
    
    // Smart inference logic - find best match considering discounts
    let bestMatch = null;
    let smallestDifference = Infinity;
    
    for (const item of items) {
      // Check if amount matches base price exactly
      if (amount === item.base_price) {
        return { item, discount: 0 };
      }
      
      // Check if amount is within discount range
      const maxDiscount = Math.max(
        (item.base_price * (item.max_discount_percentage || 0)) / 100,
        item.max_discount_fixed || 0
      );
      const minPrice = item.base_price - maxDiscount;
      
      if (amount >= minPrice && amount <= item.base_price) {
        const difference = item.base_price - amount;
        if (difference < smallestDifference) {
          smallestDifference = difference;
          bestMatch = item;
        }
      }
    }
    
    // If no exact match found, find closest by price
    if (!bestMatch) {
      for (const item of items) {
        const difference = Math.abs(amount - item.base_price);
        if (difference < smallestDifference) {
          smallestDifference = difference;
          bestMatch = item;
        }
      }
    }
    
    const discount = bestMatch ? Math.max(0, bestMatch.base_price - amount) : 0;
    return { item: bestMatch, discount };
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
      setDisplay('Error');
      return;
    }

    const { item, discount } = inferItemFromAmount(amount);
    if (!item) {
      setError('No matching item found for this amount');
      return;
    }

    setInferredItem(item);
    setDiscountAmount(discount);

    // Check if discount exceeds limits
    const discountPercentage = (discount / item.base_price) * 100;
    const exceedsPercentageLimit = discountPercentage > (item.max_discount_percentage || 0);
    const exceedsFixedLimit = discount > (item.max_discount_fixed || 0);

    if (discount > 0 && (exceedsPercentageLimit || exceedsFixedLimit)) {
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
    if (!currentAmount || !inferredItem || !shop || !staff) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const discount = calculateDiscount(currentAmount, inferredItem.base_price);
      const needsOverride = !isDiscountAllowed(inferredItem, currentAmount);
      
      const changeAmount = cashAmount ? Math.max(0, cashAmount - currentAmount) : 0;
      
      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          shop_id: shop.id,
          staff_id: staff.id,
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
      
      // Update inventory
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
      
      // Show success with change amount if applicable
      if (changeAmount > 0) {
        setChangeAmount(changeAmount);
        setShowChange(true);
      } else {
        setShowSuccess(true);
      }
      
      // Call callback if provided
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
    await handlePayment('CASH', cashReceived || undefined);
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

  const handleDiscountOverride = (confirm: boolean) => {
    if (confirm) {
      setDiscountOverride(true);
      setShowDiscountConfirm(false);
      setShowPaymentModes(true);
    } else {
      setShowDiscountConfirm(false);
      handleClear();
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

  // Auto-infer item when amount changes
  useEffect(() => {
    if (currentAmount > 0) {
      const { item } = inferItemFromAmount(currentAmount);
      setInferredItem(item);
    } else {
      setInferredItem(null);
    }
  }, [display, items]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">{shop?.name}</h1>
          <p className="text-gray-600">Staff: {staff?.name}</p>
        </div>

        {/* Calculator Display */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          {/* Amount Display */}
          <div className="bg-gray-900 rounded-2xl p-6 mb-6">
            <div className="text-right">
              <div className="text-3xl font-mono text-green-400 mb-2">
                {currentAmount > 0 ? formatCurrency(currentAmount) : '₹0'}
              </div>
              {inferredItem && (
                <div className="text-sm text-gray-400">
                  <div>{inferredItem.name}</div>
                  <div className="flex justify-between mt-1">
                    <span>Base: {formatCurrency(inferredItem.base_price)}</span>
                    {currentAmount < inferredItem.base_price && (
                      <span className="text-orange-400">
                        Discount: {formatCurrency(inferredItem.base_price - currentAmount)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="h-16 bg-gray-100 hover:bg-gray-200 text-xl font-semibold text-gray-800
                           rounded-xl transition-all duration-150 active:scale-95"
                disabled={isProcessing}
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleNumberClick('00')}
              className="h-16 bg-gray-100 hover:bg-gray-200 text-xl font-semibold text-gray-800
                         rounded-xl transition-all duration-150 active:scale-95"
              disabled={isProcessing}
            >
              00
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              className="h-16 bg-gray-100 hover:bg-gray-200 text-xl font-semibold text-gray-800
                         rounded-xl transition-all duration-150 active:scale-95"
              disabled={isProcessing}
            >
              0
            </button>
            <button
              onClick={handleClear}
              className="h-16 bg-red-500 hover:bg-red-600 text-white text-lg font-semibold
                         rounded-xl transition-all duration-150 active:scale-95"
              disabled={isProcessing}
            >
              Clear
            </button>
          </div>

          {/* Payment Buttons */}
          {currentAmount > 0 && inferredItem && !showPaymentModes && (
            <button
              onClick={handleConfirmAmount}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                         text-white text-lg font-semibold rounded-xl transition-all duration-200 active:scale-95"
              disabled={isProcessing}
            >
              Continue to Payment
            </button>
          )}

          {/* Payment Mode Selection */}
          {showPaymentModes && !showCashInput && !showUpiQr && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">
                Choose Payment Method
              </h3>
              
              <button
                onClick={handleCashPayment}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-semibold
                           rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                disabled={isProcessing}
              >
                <Banknote size={24} />
                Cash Payment
              </button>
              
              <button
                onClick={handleUpiPayment}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white text-lg font-semibold
                           rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                disabled={isProcessing}
              >
                <Smartphone size={24} />
                UPI Payment
              </button>
              
              <button
                onClick={handleCreditPayment}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white text-lg font-semibold
                           rounded-xl transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
                disabled={isProcessing}
              >
                <CreditCard size={24} />
                Credit Sale
              </button>
              
              <button
                onClick={() => setShowPaymentModes(false)}
                className="w-full py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold
                           rounded-xl transition-all duration-150 active:scale-95"
              >
                Back
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}
      </div>

      {/* Modals */}
      
      {/* Discount Confirmation Modal */}
      {showDiscountWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <AlertTriangle className="mx-auto text-orange-500 mb-4" size={48} />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                High Discount Alert
              </h3>
              <p className="text-gray-600 mb-6">
                This price is significantly lower than the normal rate. Are you sure you want to continue?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDiscountConfirm(false)}
                  className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl"
                >
                  No, Re-enter
                </button>
                <button
                  onClick={() => handleDiscountConfirm(true)}
                  className="py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl"
                >
                  Yes, Continue
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
            <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">
              Cash Payment
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Pay: {formatCurrency(currentAmount)}
              </label>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cash Received (Optional)
              </label>
              <input
                type="number"
                value={cashReceived || ''}
                onChange={(e) => setCashReceived(Number(e.target.value))}
                placeholder="Enter cash received"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {cashReceived > currentAmount && (
                <p className="text-sm text-green-600 mt-2">
                  Change: {formatCurrency(cashReceived - currentAmount)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCashInput(false)}
                className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={processCashPayment}
                disabled={isProcessing}
                className="py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl disabled:opacity-50"
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
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              UPI Payment
            </h3>
            <div className="bg-gray-100 rounded-xl p-6 mb-4">
              {shop?.upi_qr_url ? (
                <img src={shop.upi_qr_url} alt="UPI QR Code" className="mx-auto max-w-48" />
              ) : (
                <div className="text-center py-8">
                  <QrCode className="mx-auto text-gray-400 mb-2" size={64} />
                  <p className="text-gray-600">QR Code not configured</p>
                  {shop?.upi_id && (
                    <p className="text-sm text-gray-500 mt-2">UPI ID: {shop.upi_id}</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-lg font-semibold text-gray-800 mb-4">
              Amount: {formatCurrency(currentAmount)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowUpiQr(false)}
                className="py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl"
              >
                Back
              </button>
              <button
                onClick={confirmUpiPayment}
                disabled={isProcessing}
                className="py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Payment Received'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
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
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Transaction Complete!
            </h3>
            <p className="text-gray-600 mb-2">
              Sale: {formatCurrency(currentAmount)}
            </p>
            <p className="text-lg font-semibold text-green-600">
              Change to Return: {formatCurrency(changeAmount)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;