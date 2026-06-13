import { useState } from 'react';
import { Employee } from '../types';
import { getEmployees } from '../store';

interface LoginScreenProps {
  onLogin: (employee: Employee) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const employees = getEmployees();

  const handleLogin = () => {
    if (!selectedEmployee) { setError('Please select your name'); return; }
    // Re-fetch to get latest PIN
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    if (latest && pin === latest.pin) { onLogin(latest); }
    else { setError('Incorrect PIN. Please try again.'); setPin(''); }
  };

  const handlePinInput = (d: string) => { if (pin.length < 4) { setPin(pin + d); setError(''); } };
  const handleBackspace = () => setPin(pin.slice(0, -1));

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl shadow-lg mb-4">
            <span className="text-white text-xl font-bold">Af</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Attendify</h1>
          <p className="text-slate-500 text-sm mt-1">Employee Tracking System</p>
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
                    <div className="text-left flex-1">
                      <p className="text-slate-800 font-medium text-sm">{emp.name}</p>
                      <p className="text-slate-400 text-xs capitalize">{emp.role}</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                ))}
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
                <p className="text-slate-400 text-xs capitalize">{selectedEmployee.role}</p>
              </div>
              <div className="flex justify-center gap-3 mb-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-12 h-14 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${pin.length > i ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-200 bg-slate-50'}`}>
                    {showPin ? (pin[i]||'') : (pin.length > i ? '●' : '')}
                  </div>
                ))}
              </div>
              <button onClick={() => setShowPin(!showPin)} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 mb-4">{showPin ? 'Hide PIN' : 'Show PIN'}</button>
              {error && <div className="text-red-500 text-sm text-center mb-4 bg-red-50 py-2 rounded-lg">{error}</div>}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <button key={n} onClick={() => handlePinInput(String(n))} className="h-12 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-lg font-medium active:scale-95">{n}</button>
                ))}
                <button onClick={handleBackspace} className="h-12 rounded-lg bg-slate-50 hover:bg-red-50 border border-slate-200 text-slate-500 text-lg active:scale-95">⌫</button>
                <button onClick={() => handlePinInput('0')} className="h-12 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-lg font-medium active:scale-95">0</button>
                <button onClick={handleLogin} disabled={pin.length !== 4} className="h-12 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-medium active:scale-95">→</button>
              </div>
              <p className="text-center text-slate-400 text-xs">Enter your 4-digit PIN</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
