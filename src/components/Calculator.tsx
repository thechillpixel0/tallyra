import React, { useState, useEffect } from 'react';
import { Calculator as CalcIcon, Trash2, Delete, Copy, Check, QrCode, Smartphone, CreditCard, Banknote } from 'lucide-react';

interface CalculatorProps {
  shopData: {
    id: string;
    name: string;
    currency: string;
    upi_id?: string;
    upi_qr_url?: string;
  };
  staffData: {
    id: string;
    name: string;
  };
  onTransaction: (amount: number, paymentMode: string) => void;
}

interface QRService {
  name: string;
  generateUrl: (upiString: string) => string;
}

export const Calculator: React.FC<CalculatorProps> = ({ shopData, staffData, onTransaction }) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CREDIT'>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentQrService, setCurrentQrService] = useState(0);

  // Add safety checks for shopData
  if (!shopData) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-md mx-auto">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading calculator...</p>
        </div>
      </div>
    );
  }

  const qrServices: QRService[] = [
    {
      name: 'QR Server',
      generateUrl: (upiString: string) => 
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiString)}&format=png&margin=10`
    },
    {
      name: 'QuickChart',
      generateUrl: (upiString: string) => 
        `https://quickchart.io/qr?text=${encodeURIComponent(upiString)}&size=300&margin=2&format=png`
    },
    {
      name: 'QR Code Generator',
      generateUrl: (upiString: string) => 
        `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(upiString)}&choe=UTF-8`
    }
  ];

  const amount = parseFloat(display) || 0;
  const changeAmount = paymentMode === 'CASH' && cashReceived ? 
    Math.max(0, parseFloat(cashReceived) - amount) : 0;

  // Generate UPI payment string
  const generateUpiString = (amount: number) => {
    if (!shopData?.upi_id) return '';
    return `upi://pay?pa=${shopData.upi_id}&pn=${encodeURIComponent(shopData.name)}&am=${amount}&cu=${shopData.currency}&tn=Payment%20to%20${encodeURIComponent(shopData.name)}`;
  };

  // Load QR code with fallback services
  const loadQrCode = async (upiString: string) => {
    if (!upiString) return;
    
    setQrLoading(true);
    setQrError(false);

    for (let i = 0; i < qrServices.length; i++) {
      const serviceIndex = (currentQrService + i) % qrServices.length;
      const service = qrServices[serviceIndex];
      
      try {
        const qrUrl = service.generateUrl(upiString);
        
        // Test if the image loads
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = qrUrl;
        });

        setQrImageUrl(qrUrl);
        setCurrentQrService(serviceIndex);
        setQrLoading(false);
        return;
      } catch (error) {
        console.warn(`QR service ${service.name} failed:`, error);
      }
    }

    // All services failed
    setQrError(true);
    setQrLoading(false);
  };

  // Load QR code when amount or payment mode changes
  useEffect(() => {
    if (showPayment && paymentMode === 'UPI' && amount > 0) {
      const upiString = generateUpiString(amount);
      loadQrCode(upiString);
    }
  }, [showPayment, paymentMode, amount, shopData.upi_id]);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const performOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '×':
        return firstValue * secondValue;
      case '÷':
        return secondValue !== 0 ? firstValue / secondValue : 0;
      case '=':
        return secondValue;
      default:
        return secondValue;
    }
  };

  const handleEquals = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  const handlePayment = () => {
    if (amount <= 0) return;
    setShowPayment(true);
  };

  const confirmTransaction = () => {
    if (amount <= 0) return;
    
    if (paymentMode === 'CASH' && (!cashReceived || parseFloat(cashReceived) < amount)) {
      alert('Please enter valid cash received amount');
      return;
    }

    onTransaction(amount, paymentMode);
    
    // Reset calculator
    clear();
    setShowPayment(false);
    setCashReceived('');
    setPaymentMode('CASH');
  };

  const copyUpiId = async () => {
    if (shopData.upi_id) {
      try {
        await navigator.clipboard.writeText(shopData.upi_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy UPI ID:', err);
      }
    }
  };

  const openUpiApp = () => {
    const upiString = generateUpiString(amount);
    if (upiString) {
      window.open(upiString, '_blank');
    }
  };

  const retryQr = () => {
    setCurrentQrService((prev) => (prev + 1) % qrServices.length);
    const upiString = generateUpiString(amount);
    loadQrCode(upiString);
  };

  if (showPayment) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Complete Payment</h3>
          <button
            onClick={() => setShowPayment(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            ×
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {shopData.currency} {amount.toFixed(2)}
          </div>
          <div className="text-sm text-gray-500">Amount to pay</div>
        </div>

        {/* Payment Mode Selection */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { mode: 'CASH' as const, icon: Banknote, label: 'Cash' },
            { mode: 'UPI' as const, icon: QrCode, label: 'UPI' },
            { mode: 'CREDIT' as const, icon: CreditCard, label: 'Credit' }
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setPaymentMode(mode)}
              className={`p-3 rounded-xl border-2 transition-all ${
                paymentMode === mode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className="w-6 h-6 mx-auto mb-1" />
              <div className="text-sm font-medium">{label}</div>
            </button>
          ))}
        </div>

        {/* Cash Payment */}
        {paymentMode === 'CASH' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cash Received
            </label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="Enter amount received"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              step="0.01"
              min={amount}
            />
            {changeAmount > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                <div className="text-sm text-yellow-800">
                  Change to return: <span className="font-bold">{shopData.currency} {changeAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* UPI Payment */}
        {paymentMode === 'UPI' && shopData.upi_id && (
          <div className="mb-6">
            {/* QR Code Display */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-center">
                {qrLoading ? (
                  <div className="flex flex-col items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <div className="text-sm text-gray-600">Loading QR Code...</div>
                  </div>
                ) : qrError || !qrImageUrl ? (
                  <div className="py-8">
                    <QrCode className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                    <div className="text-sm text-gray-600 mb-3">QR Code unavailable</div>
                    <button
                      onClick={retryQr}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div>
                    <img
                      src={qrImageUrl}
                      alt="UPI QR Code"
                      className="w-48 h-48 mx-auto mb-2 rounded-lg"
                      onError={() => setQrError(true)}
                    />
                    <div className="text-xs text-gray-500">
                      Scan with any UPI app
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* UPI Actions */}
            <div className="space-y-3">
              <button
                onClick={openUpiApp}
                className="w-full flex items-center justify-center gap-2 p-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                <Smartphone className="w-5 h-5" />
                Open UPI App
              </button>

              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">UPI ID</div>
                  <div className="font-mono text-sm">{shopData.upi_id}</div>
                </div>
                <button
                  onClick={copyUpiId}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={confirmTransaction}
          disabled={paymentMode === 'CASH' && (!cashReceived || parseFloat(cashReceived) < amount)}
          className="w-full p-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Confirm Transaction
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalcIcon className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Calculator</h2>
      </div>

      {/* Display */}
      <div className="bg-gray-900 rounded-xl p-4 mb-6">
        <div className="text-right">
          <div className="text-3xl sm:text-4xl font-mono text-white break-all">
            {display}
          </div>
          {operation && (
            <div className="text-sm text-gray-400 mt-1">
              {previousValue} {operation}
            </div>
          )}
        </div>
      </div>

      {/* Button Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* Row 1 */}
        <button
          onClick={clear}
          className="col-span-2 p-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors active:scale-95"
        >
          Clear
        </button>
        <button
          onClick={backspace}
          className="p-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-colors active:scale-95"
        >
          <Delete className="w-5 h-5 mx-auto" />
        </button>
        <button
          onClick={() => performOperation('÷')}
          className="p-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-95"
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          onClick={() => inputDigit('7')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          7
        </button>
        <button
          onClick={() => inputDigit('8')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          8
        </button>
        <button
          onClick={() => inputDigit('9')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          9
        </button>
        <button
          onClick={() => performOperation('×')}
          className="p-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-95"
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          onClick={() => inputDigit('4')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          4
        </button>
        <button
          onClick={() => inputDigit('5')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          5
        </button>
        <button
          onClick={() => inputDigit('6')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          6
        </button>
        <button
          onClick={() => performOperation('-')}
          className="p-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-95"
        >
          -
        </button>

        {/* Row 4 */}
        <button
          onClick={() => inputDigit('1')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          1
        </button>
        <button
          onClick={() => inputDigit('2')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          2
        </button>
        <button
          onClick={() => inputDigit('3')}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          3
        </button>
        <button
          onClick={() => performOperation('+')}
          className="p-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors active:scale-95"
        >
          +
        </button>

        {/* Row 5 */}
        <button
          onClick={() => inputDigit('0')}
          className="col-span-2 p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          0
        </button>
        <button
          onClick={inputDecimal}
          className="p-4 bg-gray-100 text-gray-800 rounded-xl font-semibold hover:bg-gray-200 transition-colors active:scale-95"
        >
          .
        </button>
        <button
          onClick={handleEquals}
          className="p-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors active:scale-95"
        >
          =
        </button>
      </div>

      {/* Payment Button */}
      {amount > 0 && (
        <button
          onClick={handlePayment}
          className="w-full mt-6 p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 active:scale-95"
        >
          Process Payment - {shopData.currency} {amount.toFixed(2)}
        </button>
      )}
    </div>
  );
};