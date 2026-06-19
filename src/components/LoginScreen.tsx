// src/components/LoginScreen.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { Employee } from '../types';
import { getEmployees, addAccountRequest, bindEmployeeDevice } from '../store';

interface LoginScreenProps { onLogin: (employee: Employee) => void; }

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

const PAD_KEYS = ["1","2","3","4","5","6","7","8","9","back","0","clear"] as const;
type PadKey = (typeof PAD_KEYS)[number];

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'select' | 'pin'>('select');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const employees = getEmployees();
  
  const filtered = useMemo(
    () => employees.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase())),
    [search, employees]
  );

  useEffect(() => { 
    setTimeout(() => setMounted(true), 50); 
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectEmp = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDropdownOpen(false);
    setSearch('');
    setPin('');
    setError('');
    setTimeout(() => setPhase('pin'), 200);
  };

  const goBack = () => {
    setPhase('select');
    setTimeout(() => setSelectedEmployee(null), 300);
    setPin('');
    setError('');
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

  const processLogin = async (enteredPin: string) => {
    if (!selectedEmployee) return;
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    
    if (!latest || enteredPin !== latest.pin) {
      setError('Incorrect Password');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin(''); 
      setLoading(false);
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
        setError('Device binding failed.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin('');
        setLoading(false);
      }
    } else if (latest.device_id === currentDeviceUUID) {
      onLogin(latest);
    } else {
      setError("🚫 Unregistered Device!");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setLoading(false);
    }
  };

  const handlePad = async (key: PadKey) => {
    if (loading) return;
    if (key === "clear") { setPin(""); setError(""); return; }
    if (key === "back") { setPin((p) => p.slice(0, -1)); setError(""); return; }
    if (pin.length >= 4) return;

    const next = pin + key;
    setPin(next);
    setError("");

    if (next.length === 4) {
      setLoading(true);
      await processLogin(next);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const cpin = newPin.replace(/\D/g, "").slice(0, 4);
    if (!name) { setCreateMsg({ type: "err", text: "Name is required." }); return; }
    if (cpin.length !== 4) { setCreateMsg({ type: "err", text: "PIN must be 4 digits." }); return; }

    setCreateMsg(null);
    try {
      addAccountRequest({ 
        id: `req-${Date.now()}`, 
        name: name, 
        pin: cpin, 
        requestedAt: new Date().toISOString(), 
        status: 'pending' 
      });
      setCreateMsg({ type: "ok", text: "Request sent! Wait for admin approval." });
      setNewName(''); 
      setNewPin('');
      setTimeout(() => { setCreateMsg(null); setShowCreate(false); }, 3000);
    } catch (err) {
      setCreateMsg({ type: "err", text: "Failed to send request." });
    }
  };

  // =============================================
  // CREATE ACCOUNT — Premium Light Theme
  // =============================================
  if (showCreate) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-200/30 rounded-full filter blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-200/20 rounded-full filter blur-[120px]" />
        
        <div className={`relative w-full max-w-[420px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Top Accent Line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full" />

          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4 hover:scale-105 transition-transform duration-300">
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12">
                <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#2563EB"/>
                <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#60A5FA"/>
                <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#3B82F6"/>
                <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#93C5FD"/>
              </svg>
              <span className="text-slate-900 text-2xl font-bold tracking-tight ml-3">Attendify</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">New Account</h1>
            <p className="text-slate-500 text-xs font-medium mt-1 tracking-wide">Request will be sent to admin</p>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Full Name</label>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="Enter your full name"
                className="w-full bg-white/70 backdrop-blur-sm border-2 border-slate-200/80 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 text-slate-900 placeholder-slate-400 transition-all duration-200" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">4-Digit PIN</label>
              <input 
                value={newPin} 
                onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} 
                placeholder="Enter 4-digit PIN" 
                maxLength={4}
                className="w-full bg-white/70 backdrop-blur-sm border-2 border-slate-200/80 rounded-xl px-4 py-3.5 text-2xl font-bold text-center tracking-[0.4em] focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 text-slate-900 placeholder-slate-400 transition-all duration-200" 
              />
            </div>
            
            {createMsg && (
              <div className={`text-xs text-center p-3.5 rounded-xl font-semibold animate-fade-in ${createMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {createMsg.text}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[0.98] text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              Submit Request
            </button>
            <button 
              type="button" 
              onClick={() => setShowCreate(false)} 
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 rounded-xl font-semibold text-sm transition-all duration-200"
            >
              ← Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN LOGIN — Premium Light Theme
  // =============================================
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 font-sans overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-blue-200/30 rounded-full filter blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-indigo-200/20 rounded-full filter blur-[120px] animate-pulse delay-1000" />
      <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-white/40 rounded-full filter blur-[100px]" />

      {/* Main Card — Premium Glassmorphism */}
      <div className={`relative w-full max-w-[420px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_20px_60px_-15px_rgba(37,99,235,0.15)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Top Accent Glow Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 rounded-full" />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 hover:scale-105 transition-transform duration-300">
            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 drop-shadow-sm">
              <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#2563EB"/>
              <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#60A5FA"/>
              <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#3B82F6"/>
              <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#93C5FD"/>
            </svg>
            <span className="text-slate-900 text-2xl font-bold tracking-tight ml-3">Attendify</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 bg-white/60 backdrop-blur-sm inline-block px-4 py-1.5 rounded-full border border-slate-200/50 uppercase tracking-wider">
            Employee Attendance System
          </p>
        </div>

        {/* ===== PHASE 1: USER SELECTION ===== */}
        {phase === 'select' && (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                Username
              </label>
              
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white/60 backdrop-blur-sm hover:bg-white/80 border-2 border-slate-200/80 rounded-xl transition-all duration-300 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 text-left group"
              >
                <span className={`text-sm font-medium ${selectedEmployee ? "text-slate-900" : "text-slate-400"}`}>
                  {selectedEmployee ? selectedEmployee.name : "Select your username"}
                </span>
                <svg className={`w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-blue-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-xl z-50 overflow-hidden animate-drop-in origin-top">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                    <input
                      type="text"
                      placeholder="Search your name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border-2 border-slate-200/80 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 placeholder-slate-400 text-slate-900 transition-all duration-200"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                    {filtered.length > 0 ? (
                      filtered.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => selectEmp(emp)}
                          className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all duration-200 flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                            {getInitials(emp.name)}
                          </div>
                          {emp.name}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm font-medium text-slate-400">No users found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 opacity-60 pointer-events-none">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">Password</label>
              <div className="w-full px-4 py-3.5 bg-white/40 backdrop-blur-sm border-2 border-slate-200/80 rounded-xl text-slate-900 font-bold text-lg tracking-[0.3em]">
                ••••••••
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 active:scale-[0.98] text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              Next
            </button>

            <div className="pt-6 text-center border-t border-slate-200/50 mt-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">or create new account</p>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateMsg(null); }}
                className="w-full py-3 bg-white/60 backdrop-blur-sm hover:bg-white/90 border-2 border-slate-200/80 text-slate-700 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] hover:border-blue-300 hover:text-blue-600"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register Account
              </button>
            </div>
          </div>
        )}

        {/* ===== PHASE 2: PIN PAD ===== */}
        {phase === 'pin' && selectedEmployee && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm border-2 border-slate-200/80 p-2 rounded-xl mb-4">
              <div className="w-11 h-11 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 rounded-lg flex items-center justify-center font-bold text-base shadow-inner">
                {getInitials(selectedEmployee.name)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{selectedEmployee.name}</p>
                <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mt-0.5">Selected User</p>
              </div>
              <button type="button" onClick={goBack} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors active:scale-90">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="text-center space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Enter Password (PIN)</label>
              
              <div className={`flex justify-center gap-3 py-3 ${shake ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      i < pin.length 
                        ? "bg-blue-600 scale-110 shadow-[0_0_16px_rgba(37,99,235,0.35)]" 
                        : "bg-slate-200 border-2 border-slate-300"
                    }`}
                  />
                ))}
              </div>
              <div className="h-6">
                {error ? <span className="text-xs font-semibold text-red-500 animate-bounce block">{error}</span> 
                 : loading ? <span className="text-xs font-semibold text-blue-500 animate-pulse block">Verifying securely...</span> : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mt-4">
              {PAD_KEYS.map((key) => {
                const isSpecial = key === "back" || key === "clear";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => void handlePad(key)}
                    className={`h-14 w-14 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                      isSpecial 
                        ? "text-slate-500 text-sm font-bold bg-slate-100/80 hover:bg-slate-200/80 backdrop-blur-sm" 
                        : "text-slate-800 text-xl font-bold bg-white/70 backdrop-blur-sm border-2 border-slate-200/80 hover:bg-white hover:border-blue-300 hover:shadow-[0_0_20px_rgba(37,99,235,0.08)]"
                    }`}
                  >
                    {key === "back" ? "⌫" : key === "clear" ? "C" : key}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
      
      {/* Footer */}
      <p className={`fixed bottom-4 text-center text-slate-400 text-[10px] font-semibold tracking-wider transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        Attendify v3.0 — © {new Date().getFullYear()}
      </p>

      <style>{`
        @keyframes dropIn {
          from { 
            opacity: 0; 
            transform: translateY(-8px) scaleY(0.95) scaleX(0.98); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scaleY(1) scaleX(1); 
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-drop-in { 
          animation: dropIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-fade-in { 
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-shake { 
          animation: shake 0.4s ease forwards; 
        }
        .animate-pulse-slow { 
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; 
        }
      `}</style>
    </div>
  );
}
