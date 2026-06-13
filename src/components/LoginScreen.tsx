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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl shadow-lg mb-4"><span className="text-white text-xl font-bold">Af</span></div>
            <h1 className="text-2xl font-bold text-slate-800">Create Account</h1>
            <p className="text-slate-500 text-sm mt-1">Request access to Attendify</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div><label className="text-slate-600 text-sm mb-1.5 block">Full Name</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter your full name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-slate-600 text-sm mb-1.5 block">Choose a 4-digit PIN</label>
              <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="e.g. 1234" maxLength={4}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            {createMsg && <div className={`text-sm text-center p-3 rounded-lg ${createMsg.includes('sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{createMsg}</div>}
            <button onClick={handleCreateAccount} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium">Submit Request</button>
            <button onClick={() => setShowCreateAccount(false)} className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium">Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl shadow-lg mb-4"><span className="text-white text-xl font-bold">Af</span></div>
          <h1 className="text-2xl font-bold text-slate-800">Attendify</h1>
          <p className="text-slate-500 text-sm mt-1">Employee Attendance</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {!selectedEmployee ? (
            <>
              <h2 className="text-slate-700 text-sm font-medium mb-4">Select Your Name</h2>
              <div className="space-y-2">
                {employees.map(emp => (
                  <button key={emp.id} onClick={() => { setSelectedEmployee(emp); setError(''); setPin(''); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-semibold">{emp.avatar}</div>
                    <div className="text-left flex-1"><p className="text-slate-800 font-medium text-sm">{emp.name}</p><p className="text-slate-400 text-xs capitalize">{emp.role}</p></div>
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setShowCreateAccount(true)} className="w-full py-2.5 border border-blue-200 rounded-xl text-blue-600 text-sm font-medium hover:bg-blue-50">Create New Account</button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }} className="flex items-center gap-1 text-slate-500 hover:text-blue-600 text-sm mb-6">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Back
              </button>
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-lg font-bold mb-3">{selectedEmployee.avatar}</div>
                <h3 className="text-slate-800 font-semibold">{selectedEmployee.name}</h3>
              </div>
              <div className="flex justify-center gap-3 mb-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-xl font-bold ${pin.length > i ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50'}`}>
                    {showPin ? (pin[i]||'') : (pin.length > i ? '●' : '')}
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPin(!showPin)} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 mb-4">{showPin ? 'Hide' : 'Show'} PIN</button>
              {error && <div className="text-red-500 text-sm text-center mb-4 bg-red-50 py-2 rounded-lg">{error}</div>}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9].map(n => (<button key={n} onClick={() => handlePinInput(String(n))} className="h-12 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-lg font-medium active:scale-95">{n}</button>))}
                <button onClick={() => setPin(pin.slice(0,-1))} className="h-12 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 text-slate-500 text-lg active:scale-95">⌫</button>
                <button onClick={() => handlePinInput('0')} className="h-12 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-lg font-medium active:scale-95">0</button>
                <button onClick={handleLogin} disabled={pin.length !== 4} className="h-12 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-medium active:scale-95">→</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
