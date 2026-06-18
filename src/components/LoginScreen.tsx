// src/components/LoginScreen.tsx

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

  const handleLogin = async () => {
    if (!selectedEmployee) return;
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    
    if (!latest || pin !== latest.pin) {
      setError('Incorrect PIN'); 
      setPin(''); 
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
      onLogin(latest);
      return;
    }

    const currentDeviceUUID = getDeviceUUID();

    if (!latest.device_id) {
      try {
        await bindEmployeeDevice(latest.id, currentDeviceUUID);
        const updatedEmployee = { ...latest, device_id: currentDeviceUUID };
        onLogin(updatedEmployee);
      } catch (err) {
        setError('Device binding failed. Please try again.');
        setPin('');
      }
    } else if (latest.device_id === currentDeviceUUID) {
      onLogin(latest);
    } else {
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
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute -top-32 -right-32 w-64 h-64 bg-blue-100/40 rounded-full blur-3xl transition-all duration-[2s] ${mounted ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute -bottom-32 -left-32 w-64 h-64 bg-slate-100/60 rounded-full blur-3xl transition-all duration-[2s] delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`} />
      </div>
      <div className="w-full max-w-sm relative z-10">
        <div className={`text-center mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
          <div className={`inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/25 mb-4 transition-all duration-700 delay-200 ${mounted ? 'scale-100 rotate-0' : 'scale-50 rotate-12'}`}>
            <span className="text-white text-xl font-bold">Af</span>
          </div>
          <h1 className={`text-2xl font-bold text-slate-800 transition-all duration-500 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Attendify</h1>
          <p className={`text-slate-400 text-xs mt-1 transition-all duration-500 delay-400 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Employee Attendance</p>
        </div>
        <div className={`bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all duration-600 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {phase === 'select' && ( <div className="p-6 animate-fade-in">{/* ... */}</div> )}
          {phase === 'pin' && selectedEmployee && ( <div className="animate-fade-in">{/* ... */}</div> )}
        </div>
        <p className={`text-center text-slate-300 text-[10px] mt-5 transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>Attendify v3.0</p>
      </div>
      <style>{` @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } `}</style>
    </div>
  );
}
