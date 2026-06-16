import { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { getEmployees, addAccountRequest, bindEmployeeDevice } from '../store';

interface LoginScreenProps { onLogin: (employee: Employee) => void; }

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'select' | 'pin'>('select');
  const searchRef = useRef<HTMLInputElement>(null);
  const employees = getEmployees();
  const filtered = search ? employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : employees;

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const selectEmp = (emp: Employee) => {
    setSelectedEmployee(emp); setShowList(false); setSearch(''); setPin(''); setError('');
    setTimeout(() => setPhase('pin'), 50);
  };

  // 📱 Helper: Device ka unique hardware fingerprint (UUID) generate ya fetch karein
  const getDeviceUUID = () => {
    let uuid = localStorage.getItem('attendify_device_uuid');
    if (!uuid) {
      uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('attendify_device_uuid', uuid);
    }
    return uuid;
  };

  // 🔒 Main Login Logic with Device Binding
  const handleLogin = async () => {
    if (!selectedEmployee) return;
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    
    // PIN Check
    if (!latest || pin !== latest.pin) {
      setError('Incorrect PIN'); 
      setPin(''); 
      return;
    }

    // 1. Check karein ke yeh Mobile/Tablet hai ya Desktop/Laptop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Agar Desktop/Laptop hai, toh device lock bypass karein aur seedha login karwayein
    if (!isMobile) {
      onLogin(latest);
      return;
    }

    // 2. Mobile Device: UUID fetch karein
    const currentDeviceUUID = getDeviceUUID();

    // 3. Device Binding Logic (Cases A, B, C)
    if (!latest.device_id) {
      // Case A: First Time Login - Device ko database mein hamesha ke liye bind karein
      try {
        await bindEmployeeDevice(latest.id, currentDeviceUUID);
        const updatedEmployee = { ...latest, device_id: currentDeviceUUID };
        onLogin(updatedEmployee); // Dashboard par bhej dein
      } catch (err) {
        setError('Device binding failed. Please try again.');
        setPin('');
      }
    } else if (latest.device_id === currentDeviceUUID) {
      // Case B: Matched Device - Login allow karein
      onLogin(latest);
    } else {
      // Case C: Wrong Device / Fraud - Login BLOCK karein
      setError("🚫 Access Denied! Aap kisi doosre mobile se login kar rahe hain. Kripya apne registered device ka istemal karein ya Admin se device reset karwayein.");
      setPin('');
    }
  };

  const handlePinInput = (d: string) => { if (pin.length < 4) { setPin(pin + d); setError(''); } };

  const goBack = () => { setPhase('select'); setTimeout(() => setSelectedEmployee(null), 300); setPin(''); setError(''); };

  const handleCreate = () => {
    if (!newName.trim()) { setCreateMsg('Enter your name'); return; }
    if (newPin.length !== 4) { setCreateMsg('PIN must be 4 digits'); return; }
    addAccountRequest({ id: `req-${Date.now()}`, name: newName.trim(), pin: newPin, requestedAt: new Date().toISOString(), status: 'pending' });
    setCreateMsg('Request sent! Wait for admin approval.');
    setNewName(''); setNewPin('');
    setTimeout(() => { setCreateMsg(''); setShowCreate(false); }, 3000);
  };

  // Create Account Screen
  if (showCreate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4">
        <div className={`w-full max-w-sm transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 mb-4"><span className="text-white text-lg font-bold">Af</span></div>
            <h1 className="text-xl font-bold text-slate-800">New Account</h1>
            <p className="text-slate-400 text-xs mt-1">Request will be sent to admin</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 space-y-4">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name"
              className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 transition-all" />
            <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="4-digit PIN" maxLength={4}
              className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-mono text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 transition-all" />
            {createMsg && <div className={`text-sm text-center p-3 rounded-2xl animate-fade-in ${createMsg.includes('sent') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{createMsg}</div>}
            <button onClick={handleCreate} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium text-sm transition-all active:scale-[0.97] shadow-lg shadow-blue-600/20">Submit</button>
            <button onClick={() => setShowCreate(false)} className="w-full py-2 text-slate-400 text-sm hover:text-blue-600 transition-colors">← Back</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-32 -right-32 w-64 h-64 bg-blue-100/40 rounded-full blur-3xl transition-all duration-[2s] ${mounted ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute -bottom-32 -left-32 w-64 h-64 bg-slate-100/60 rounded-full blur-3xl transition-all duration-[2s] delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className={`text-center mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className={`inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/25 mb-4 transition-all duration-700 delay-200 ${mounted ? 'scale-100 rotate-0' : 'scale-50 rotate-12'}`}>
            <span className="text-white text-xl font-bold">Af</span>
          </div>
          <h1 className={`text-2xl font-bold text-slate-800 transition-all duration-500 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Attendify</h1>
          <p className={`text-slate-400 text-xs mt-1 transition-all duration-500 delay-400 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Employee Attendance</p>
        </div>

        {/* Card */}
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all duration-600 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* SELECT PHASE */}
          {phase === 'select' && (
            <div className="p-6 animate-fade-in">
              <p className="text-slate-500 text-xs font-medium mb-3">Who are you?</p>

              {/* Search Input */}
              <div className="relative mb-2">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowList(true); }}
                  onFocus={() => setShowList(true)}
                  placeholder="Search or tap to select..."
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-300 transition-all placeholder:text-slate-400"
                />
                {search && (
                  <button onClick={() => { setSearch(''); searchRef.current?.focus(); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              {/* Employee List */}
              {showList && (
                <div className="bg-white border border-slate-100 rounded-2xl shadow-lg max-h-56 overflow-y-auto mb-3 animate-fade-in overscroll-contain">
                  {filtered.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-6">No results found</p>
                  ) : (
                    filtered.map((emp, i) => (
                      <button key={emp.id} onClick={() => selectEmp(emp)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/80 transition-all duration-150 border-b border-slate-50 last:border-0 active:bg-blue-100"
                        style={{ animation: `fadeSlideUp 0.3s ease-out ${i * 0.04}s both` }}>
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm">{emp.avatar}</div>
                        <div className="text-left flex-1">
                          <p className="text-slate-700 text-sm font-medium">{emp.name}</p>
                          <p className="text-slate-400 text-[10px] capitalize">{emp.role}</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ))
                  )}
                </div>
              )}

              {!showList && (
                <button onClick={() => { setShowList(true); searchRef.current?.focus(); }}
                  className="w-full py-3 text-blue-600 text-sm font-medium hover:bg-blue-50/50 rounded-2xl transition-colors mb-2">
                  Tap to select employee ↓
                </button>
              )}

              <div className="pt-3 border-t border-slate-100">
                <button onClick={() => setShowCreate(true)} className="w-full py-2.5 text-slate-500 text-xs hover:text-blue-600 transition-colors">
                  Don't have an account? <span className="text-blue-600 font-medium">Request Access</span>
                </button>
              </div>
            </div>
          )}

          {/* PIN PHASE */}
          {phase === 'pin' && selectedEmployee && (
            <div className="animate-fade-in">
              {/* User Header */}
              <div className="flex items-center gap-3 p-5 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-600/20">{selectedEmployee.avatar}</div>
                <div className="flex-1">
                  <p className="text-slate-800 font-semibold">{selectedEmployee.name}</p>
                  <p className="text-slate-400 text-xs capitalize">{selectedEmployee.role}</p>
                </div>
                <button onClick={goBack} className="text-xs text-slate-400 hover:text-blue-600 px-3 py-1.5 rounded-xl hover:bg-white transition-all border border-transparent hover:border-slate-200">
                  ← Back
                </button>
              </div>

              <div className="p-5">
                <p className="text-center text-slate-400 text-xs mb-4">Enter PIN to continue</p>

                {/* PIN Display */}
                <div className="flex justify-center gap-3 mb-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`w-13 h-15 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                      pin.length > i
                        ? 'border-blue-500 bg-blue-50 text-blue-600 scale-110 shadow-md shadow-blue-500/10'
                        : pin.length === i
                        ? 'border-blue-300 bg-white scale-105'
                        : 'border-slate-200 bg-slate-50/80 text-slate-300'
                    }`} style={{ width: 52, height: 58 }}>
                      {showPin ? (pin[i]||'') : (pin.length > i ? '●' : '')}
                    </div>
                  ))}
                </div>

                <button onClick={() => setShowPin(!showPin)} className="block mx-auto text-xs text-slate-400 hover:text-blue-600 mb-4 transition-colors">
                  {showPin ? 'Hide' : 'Show'} PIN
                </button>

                {error && (
  <div className={`text-xs text-center mb-3 py-3 px-4 rounded-2xl animate-fade-in border ${
    error.includes('Access Denied') 
      ? 'bg-red-100 text-red-700 border-red-300 font-semibold' 
      : 'bg-red-50/80 text-red-500 border-transparent'
  }`}>
    {error}
  </div>
)}

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <button key={n} onClick={() => handlePinInput(String(n))}
                      className="h-13 rounded-2xl bg-slate-50/80 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 text-slate-700 text-lg font-semibold transition-all duration-150 active:scale-90 active:bg-blue-100 active:shadow-inner"
                      style={{ height: 50 }}>{n}</button>
                  ))}
                  <button onClick={() => setPin(pin.slice(0,-1))}
                    className="rounded-2xl bg-slate-50/80 hover:bg-red-50 hover:border-red-200 border border-slate-200 text-slate-400 text-lg transition-all active:scale-90"
                    style={{ height: 50 }}>⌫</button>
                  <button onClick={() => handlePinInput('0')}
                    className="rounded-2xl bg-slate-50/80 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 text-slate-700 text-lg font-semibold transition-all active:scale-90"
                    style={{ height: 50 }}>0</button>
                  <button onClick={handleLogin} disabled={pin.length !== 4}
                    className="rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-lg transition-all active:scale-90 shadow-lg shadow-blue-600/20 disabled:shadow-none"
                    style={{ height: 50 }}>→</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className={`text-center text-slate-300 text-[10px] mt-5 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Attendify v3.0</p>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
