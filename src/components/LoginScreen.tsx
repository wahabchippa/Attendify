import { useState } from 'react';
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
  const employees = getEmployees();

  const handleLogin = () => {
    if (!selectedEmployee) { setError('Select your name'); return; }
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    if (latest && pin === latest.pin) onLogin(latest);
    else { setError('Incorrect PIN'); setPin(''); }
  };

  const handlePinInput = (d: string) => { if (pin.length < 4) { setPin(pin + d); setError(''); } };

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl shadow-lg mb-3"><span className="text-white text-lg font-bold">Af</span></div>
            <h1 className="text-xl font-bold text-slate-800">Create Account</h1>
            <p className="text-slate-400 text-xs mt-1">Request access to Attendify</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div><label className="text-slate-500 text-xs mb-1 block">Full Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter your full name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-slate-500 text-xs mb-1 block">Choose a 4-digit PIN</label>
              <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="e.g. 1234" maxLength={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            {createMsg && <div className={`text-sm text-center p-2.5 rounded-lg ${createMsg.includes('sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{createMsg}</div>}
            <button onClick={handleCreateAccount} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm">Submit Request</button>
            <button onClick={() => setShowCreateAccount(false)} className="w-full py-2 text-slate-500 text-sm hover:text-blue-600">Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl shadow-lg mb-3">
            <span className="text-white text-lg font-bold">Af</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Attendify</h1>
          <p className="text-slate-400 text-xs mt-1">Employee Attendance</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          {!selectedEmployee ? (
            <div className="space-y-4">
              <div>
                <label className="text-slate-500 text-xs mb-1.5 block">Select Your Name</label>
                <select
                  onChange={e => {
                    const emp = employees.find(x => x.id === e.target.value);
                    if (emp) { setSelectedEmployee(emp); setError(''); setPin(''); }
                  }}
                  defaultValue=""
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="" disabled>— Choose your name —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <button onClick={() => setShowCreateAccount(true)} className="w-full py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg">
                  Create New Account
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Selected User */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-11 h-11 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-sm font-bold">{selectedEmployee.avatar}</div>
                <div className="flex-1">
                  <p className="text-slate-800 font-semibold text-sm">{selectedEmployee.name}</p>
                  <p className="text-slate-400 text-xs capitalize">{selectedEmployee.role}</p>
                </div>
                <button onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }} className="text-slate-400 hover:text-blue-600 text-xs">Change</button>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center gap-3 mb-3">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-11 h-13 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${pin.length > i ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50'}`}>
                    {showPin ? (pin[i]||'') : (pin.length > i ? '●' : '')}
                  </div>
                ))}
              </div>

              <button onClick={() => setShowPin(!showPin)} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 mb-3">{showPin ? 'Hide' : 'Show'} PIN</button>

              {error && <div className="text-red-500 text-xs text-center mb-3 bg-red-50 py-2 rounded-lg">{error}</div>}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => handlePinInput(String(n))} className="h-11 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-base font-medium active:scale-95">{n}</button>
                ))}
                <button onClick={() => setPin(pin.slice(0,-1))} className="h-11 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 text-slate-400 text-base active:scale-95">⌫</button>
                <button onClick={() => handlePinInput('0')} className="h-11 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-base font-medium active:scale-95">0</button>
                <button onClick={handleLogin} disabled={pin.length !== 4} className="h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-medium active:scale-95">→</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
