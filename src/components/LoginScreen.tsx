import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { getEmployees, addAccountRequest } from '../store';

interface LoginScreenProps { onLogin: (employee: Employee) => void; }

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const employees = getEmployees();

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const handleLogin = () => {
    if (!selectedEmployee) { setError('Select your name'); return; }
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    if (latest && pin === latest.pin) onLogin(latest);
    else { setError('Incorrect PIN'); setPin(''); }
  };

  const handlePinInput = (d: string) => { if (pin.length < 4) { setPin(pin + d); setError(''); } };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp); setDropdownOpen(false); setPin(''); setError('');
    setCardKey(k => k + 1);
  };

  const handleCreateAccount = () => {
    if (!newName.trim()) { setCreateMsg('Enter your name'); return; }
    if (newPin.length !== 4) { setCreateMsg('PIN must be 4 digits'); return; }
    addAccountRequest({ id: `req-${Date.now()}`, name: newName.trim(), pin: newPin, requestedAt: new Date().toISOString(), status: 'pending' });
    setCreateMsg('Request sent! Wait for admin approval.');
    setNewName(''); setNewPin('');
    setTimeout(() => { setCreateMsg(''); setShowCreateAccount(false); }, 3000);
  };

  if (showCreateAccount) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className={`w-full max-w-sm transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl shadow-lg mb-3"><span className="text-white text-lg font-bold">Af</span></div>
            <h1 className="text-xl font-bold text-slate-800">Create Account</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
            <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="4-digit PIN" maxLength={4}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
            {createMsg && <div className={`text-sm text-center p-2.5 rounded-xl transition-all ${createMsg.includes('sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{createMsg}</div>}
            <button onClick={handleCreateAccount} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors active:scale-[0.98]">Submit Request</button>
            <button onClick={() => setShowCreateAccount(false)} className="w-full py-2 text-slate-400 text-sm hover:text-blue-600 transition-colors">Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className={`w-full max-w-sm transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        {/* Logo */}
        <div className={`text-center mb-6 transition-all duration-700 delay-100 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 mb-3">
            <span className="text-white text-xl font-bold">Af</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Attendify</h1>
          <p className="text-slate-400 text-xs mt-1">Employee Attendance</p>
        </div>

        {/* Card */}
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-500 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          {!selectedEmployee ? (
            <div className="p-5">
              {/* Custom Dropdown */}
              <label className="text-slate-500 text-xs mb-2 block font-medium">Select Your Name</label>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <span>— Choose your name —</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
                    {employees.map((emp, i) => (
                      <button key={emp.id}
                        onClick={() => selectEmployee(emp)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">{emp.avatar}</div>
                        <div className="text-left">
                          <p className="text-slate-700 text-sm font-medium">{emp.name}</p>
                          <p className="text-slate-400 text-[10px] capitalize">{emp.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Close dropdown on outside click */}
              {dropdownOpen && <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />}

              <div className="mt-4 pt-3 border-t border-slate-100">
                <button onClick={() => setShowCreateAccount(true)} className="w-full py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors">
                  Create New Account
                </button>
              </div>
            </div>
          ) : (
            <div key={cardKey} className="animate-fade-in">
              {/* Selected User Header */}
              <div className="flex items-center gap-3 p-5 bg-slate-50 border-b border-slate-100">
                <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-sm font-bold">{selectedEmployee.avatar}</div>
                <div className="flex-1">
                  <p className="text-slate-800 font-semibold text-sm">{selectedEmployee.name}</p>
                  <p className="text-slate-400 text-xs capitalize">{selectedEmployee.role}</p>
                </div>
                <button onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }} className="text-xs text-slate-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-white transition-all">Change</button>
              </div>

              <div className="p-5">
                {/* PIN Label */}
                <p className="text-center text-slate-400 text-xs mb-3">Enter your 4-digit PIN</p>

                {/* PIN Dots */}
                <div className="flex justify-center gap-3 mb-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all duration-200 ${
                      pin.length > i ? 'border-blue-500 bg-blue-50 text-blue-600 scale-105' : 'border-slate-200 bg-slate-50 text-slate-300'
                    }`}>
                      {showPin ? (pin[i]||'') : (pin.length > i ? '●' : '')}
                    </div>
                  ))}
                </div>

                <button onClick={() => setShowPin(!showPin)} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 mb-4 transition-colors">{showPin ? 'Hide' : 'Show'} PIN</button>

                {error && <div className="text-red-500 text-xs text-center mb-3 bg-red-50 py-2 rounded-xl animate-fade-in">{error}</div>}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onClick={() => handlePinInput(String(n))}
                      className="h-12 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 text-slate-700 text-lg font-medium transition-all duration-150 active:scale-90 active:bg-blue-100">{n}</button>
                  ))}
                  <button onClick={() => setPin(pin.slice(0,-1))} className="h-12 rounded-xl bg-slate-50 hover:bg-red-50 border border-slate-200 text-slate-400 text-lg transition-all active:scale-90">⌫</button>
                  <button onClick={() => handlePinInput('0')} className="h-12 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 text-slate-700 text-lg font-medium transition-all active:scale-90">0</button>
                  <button onClick={handleLogin} disabled={pin.length !== 4}
                    className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold transition-all active:scale-90 duration-150">→</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className={`text-center text-slate-300 text-[10px] mt-4 transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Attendify v3.0</p>
      </div>
    </div>
  );
}
