import { useState } from 'react';
import { Calculator, User, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage = () => {
  const { loginAsOwner, loginAsStaff } = useAuth();
  const [userType, setUserType] = useState<'owner' | 'staff' | null>(null);
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Demo shop ID - in production this would be configured per deployment
  const SHOP_ID = 'demo-shop-123';

  const handleNumberClick = (num: string) => {
    if (passcode.length < 10) {
      setPasscode(passcode + num);
    }
  };

  const handleClear = () => {
    setPasscode('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!passcode || !userType) return;

    setIsLoading(true);
    setError('');

    try {
      let success = false;
      
      if (userType === 'owner') {
        success = await loginAsOwner(SHOP_ID, passcode);
      } else {
        success = await loginAsStaff(SHOP_ID, passcode);
      }

      if (!success) {
        setError('Invalid passcode. Please try again.');
        setPasscode('');
      }
    } catch (error) {
      setError('Something went wrong. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setUserType(null);
    setPasscode('');
    setError('');
  };

  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'], 
    ['7', '8', '9'],
    ['', '0', '⌫']
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Calculator className="text-white" size={48} />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Tallyra</h1>
          <p className="text-blue-200 text-lg">"Looks like a calculator. Works like an accountant."</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
          {!userType ? (
            // User Type Selection
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white text-center mb-8">
                Choose Your Access Level
              </h2>
              
              <button
                onClick={() => setUserType('owner')}
                className="w-full p-6 bg-gradient-to-r from-yellow-500 to-orange-500 
                           hover:from-yellow-600 hover:to-orange-600 text-white rounded-2xl
                           transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <Crown size={32} />
                  <div className="text-left">
                    <h3 className="text-xl font-bold">Continue as Owner</h3>
                    <p className="text-yellow-100">Full dashboard access</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setUserType('staff')}
                className="w-full p-6 bg-gradient-to-r from-blue-500 to-purple-500 
                           hover:from-blue-600 hover:to-purple-600 text-white rounded-2xl
                           transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                <div className="flex items-center gap-4">
                  <User size={32} />
                  <div className="text-left">
                    <h3 className="text-xl font-bold">Continue as Staff</h3>
                    <p className="text-blue-100">Calculator interface only</p>
                  </div>
                </div>
              </button>

              <div className="text-center mt-8 pt-6 border-t border-white/20">
                <div className="bg-white/10 rounded-xl p-4 mb-4">
                  <h4 className="text-white font-semibold mb-2">Demo Access Codes</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Owner:</span>
                      <span className="text-yellow-300 font-mono">1032005</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Staff:</span>
                      <span className="text-blue-300 font-mono">129, 456</span>
                    </div>
                  </div>
                </div>
                <p className="text-white/60 text-xs">
                  Use these codes to explore the system features
                </p>
              </div>
            </div>
          ) : (
            // Passcode Entry
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  {userType === 'owner' ? (
                    <Crown className="text-yellow-400" size={24} />
                  ) : (
                    <User className="text-blue-400" size={24} />
                  )}
                  <h2 className="text-xl font-semibold text-white">
                    {userType === 'owner' ? 'Owner Access' : 'Staff Access'}
                  </h2>
                </div>
                <p className="text-white/70">Enter your numeric passcode</p>
              </div>

              {/* Passcode Display */}
              <div className="bg-black/20 rounded-2xl p-6 text-center">
                <div className="text-3xl font-mono text-white tracking-widest">
                  {passcode ? '●'.repeat(passcode.length) : 'Enter passcode...'}
                </div>
                {error && (
                  <p className="text-red-300 text-sm mt-2">{error}</p>
                )}
              </div>

              {/* Number Pad */}
              <div className="text-center mb-4">
                <p className="text-white/70 text-sm">
                  {userType === 'owner' ? 'Enter owner master passcode' : 'Enter your staff passcode'}
                </p>
                <p className="text-white/50 text-xs mt-1">
                  Demo: {userType === 'owner' ? '1032005' : '129 or 456'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {numbers.flat().map((num, index) => {
                  if (num === '') {
                    return <div key={index}></div>;
                  }
                  
                  if (num === '⌫') {
                    return (
                      <button
                        key={index}
                        onClick={handleClear}
                        className="h-16 bg-red-500/30 hover:bg-red-500/40 text-white 
                                   rounded-xl transition-all duration-150 active:scale-95
                                   flex items-center justify-center text-xl"
                        disabled={isLoading}
                      >
                        ⌫
                      </button>
                    );
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => handleNumberClick(num)}
                      className="h-16 bg-white/15 hover:bg-white/25 text-white text-xl font-bold
                                 rounded-xl transition-all duration-150 active:scale-95 shadow-lg
                                 border border-white/20 hover:border-white/40"
                      disabled={isLoading}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <button
                  onClick={handleBack}
                  className="py-3 bg-gray-500/30 hover:bg-gray-500/40 text-white rounded-xl font-medium
                             transition-all duration-150 active:scale-95"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!passcode || isLoading}
                  className="py-3 bg-gradient-to-r from-green-500 to-emerald-500 
                             hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-bold
                             transition-all duration-150 active:scale-95 disabled:opacity-50
                             disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Enter'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-white/60">
          <p className="text-sm">
            Concept & Product Design by <span className="font-semibold">Aftab Alam</span>
          </p>
        </div>
      </div>
    </div>
  );
};