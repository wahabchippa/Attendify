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
        setPin('');
        setLoading(false);
      }
    } else if (latest.device_id === currentDeviceUUID) {
      onLogin(latest);
    } else {
      setError("🚫 Unregistered Device!");
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

  if (showCreate) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#e8f0fe] font-sans">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full filter blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-400/20 rounded-full filter blur-[120px] animate-pulse delay-1000" />
        
        <div className={`relative w-full max-w-[420px] bg-white/60 backdrop-blur-3xl border-2 border-white/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-[2.5rem] p-8 sm:p-10 z-10 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 cursor-default">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[52px] h-[52px] drop-shadow-xl">
                <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#0078D4"/>
                <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#50E6FF"/>
                <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#00BCF2"/>
                <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#32D4F5"/>
              </svg>
              <span className="text-slate-900 text-[28px] font-black tracking-tight ml-3">Attendify</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800">New Account</h1>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase">Request will be sent to admin</p>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-5">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name"
              className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-[#0078D4] focus:ring-4 focus:ring-[#0078D4]/20 text-slate-900 placeholder-slate-400 transition-all" />
            <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="4-digit PIN" maxLength={4}
              className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 text-2xl font-black text-center tracking-[0.4em] focus:outline-none focus:border-[#0078D4] focus:ring-4 focus:ring-[#0078D4]/20 text-slate-900 placeholder-slate-400 transition-all" />
            
            {createMsg && (
              <div className={`text-xs text-center p-4 rounded-xl font-black animate-fade-in ${createMsg.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {createMsg.text}
              </div>
            )}
            
            <button type="submit" className="w-full py-4 bg-[#0078D4] hover:bg-blue-500 text-white rounded-2xl font-extrabold text-sm transition-all duration-150 shadow-[0_6px_0_rgb(0,90,158)] hover:translate-y-[2px] hover:shadow-[0_4px_0_rgb(0,90,158)] active:translate-y-[6px] active:shadow-none">SUBMIT</button>
            <button type="button" onClick={() => setShowCreate(false)} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-sm transition-all duration-150 shadow-[0_4px_0_rgb(203,213,225)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(203,213,225)] active:translate-y-[4px] active:shadow-none">← CANCEL</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#e8f0fe] font-sans">
      
      {/* --- Ambient Background --- */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-400/20 rounded-full mix-blend-multiply filter blur-[120px] animate-pulse delay-1000" />
      <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-white/80 rounded-full mix-blend-overlay filter blur-[80px]" />

      {/* --- Main 8D Glassmorphism Card --- */}
      <div className={`relative w-full max-w-[420px] bg-white/60 backdrop-blur-3xl border-2 border-white/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] rounded-[2.5rem] p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_30px_60px_-15px_rgba(37,99,235,0.15)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Header Content */}
        <div className="text-center mb-8">
          {/* Exact 3D 'A' Logo Code */}
          <div className="inline-flex items-center justify-center mb-4 hover:scale-110 hover:-translate-y-1 transition-all duration-300 ease-out cursor-default">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[52px] h-[52px] drop-shadow-xl animate-pulse-slow">
              <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#0078D4"/>
              <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#50E6FF"/>
              <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#00BCF2"/>
              <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#32D4F5"/>
            </svg>
            <span className="text-slate-900 text-[28px] font-black tracking-tight ml-3">Attendify</span>
          </div>
          <p className="text-[13px] font-black text-slate-600 bg-slate-200/60 inline-block px-4 py-1.5 rounded-full shadow-inner uppercase">
            EMPLOYEE ATTENDANCE SYSTEM
          </p>
        </div>

        {/* ============ PHASE 1: USERNAME DROPDOWN ============ */}
        {phase === 'select' && (
          <div className="space-y-7 animation-fade-in">
            <div className="space-y-2.5 relative" ref={dropdownRef}>
              <label className="block text-[11px] font-extrabold text-slate-800 uppercase tracking-widest ml-1 drop-shadow-sm">
                Username
              </label>
              
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-2xl shadow-sm transition-all duration-300 focus:outline-none focus:border-[#0078D4] focus:ring-4 focus:ring-[#0078D4]/20 text-left group"
              >
                <span className={`text-[15px] font-bold ${selectedEmployee ? "text-slate-900" : "text-slate-400"}`}>
                  {selectedEmployee ? selectedEmployee.name : "Select your username"}
                </span>
                <svg className={`w-5 h-5 text-slate-400 group-hover:text-[#0078D4] transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-[#0078D4]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-slate-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl z-50 overflow-hidden animate-drop-in origin-top">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                    <input
                      type="text"
                      placeholder="Search your name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#0078D4] focus:ring-4 focus:ring-[#0078D4]/20 placeholder-slate-400 text-slate-900 transition-all"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                    {filtered.length > 0 ? (
                      filtered.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => selectEmp(emp)}
                          className="w-full text-left px-4 py-3.5 text-sm font-extrabold text-slate-700 hover:bg-[#0078D4] hover:text-white rounded-xl transition-all duration-200 flex items-center gap-3 hover:translate-x-1"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black">
                            {getInitials(emp.name)}
                          </div>
                          {emp.name}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm font-bold text-slate-400">No users found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2.5 opacity-60 pointer-events-none">
              <label className="block text-[11px] font-extrabold text-slate-800 uppercase tracking-widest ml-1 drop-shadow-sm">Password</label>
              <div className="w-full px-5 py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-900 font-black text-lg tracking-[0.3em]">
                ••••••••
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="w-full py-4 bg-[#0078D4] hover:bg-blue-500 text-white rounded-2xl font-black text-[15px] shadow-[0_8px_0_rgb(0,90,158)] hover:shadow-[0_6px_0_rgb(0,90,158)] hover:translate-y-[2px] active:shadow-[0_0px_0_rgb(0,90,158)] active:translate-y-[8px] transition-all duration-150"
            >
              NEXT
            </button>

            <div className="pt-8 text-center border-t border-slate-200/60 mt-6">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">or create new account</p>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateMsg(null); }}
                className="w-full py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-800 rounded-xl font-extrabold text-sm transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 active:scale-95"
              >
                <svg className="w-5 h-5 text-[#0078D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register Account
              </button>
            </div>
          </div>
        )}

        {/* ============ PHASE 2: PIN PAD (PASSWORD) ============ */}
        {phase === 'pin' && selectedEmployee && (
          <div className="space-y-6 animation-fade-in">
            <div className="flex items-center gap-3 bg-white border-2 border-slate-200 p-2.5 rounded-2xl shadow-sm mb-8">
              <div className="w-12 h-12 bg-blue-100 text-[#0078D4] rounded-xl flex items-center justify-center font-black text-lg">
                {getInitials(selectedEmployee.name)}
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-black text-slate-900">{selectedEmployee.name}</p>
                <p className="text-[10px] text-[#0078D4] font-extrabold uppercase tracking-widest mt-0.5">Selected User</p>
              </div>
              <button type="button" onClick={goBack} className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors active:scale-90">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="text-center space-y-3">
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Enter Password (PIN)</label>
              
              <div className="flex justify-center gap-4 py-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded-full transition-all duration-300 ${
                      i < pin.length 
                        ? "bg-[#0078D4] scale-125 shadow-[0_0_15px_rgba(0,120,212,0.6)]" 
                        : "bg-slate-200 border-2 border-slate-300"
                    }`}
                  />
                ))}
              </div>
              <div className="h-5">
                {error ? <span className="text-xs font-black text-red-600 animate-bounce block">{error}</span> 
                 : loading ? <span className="text-xs font-black text-[#0078D4] animate-pulse block">Verifying securely...</span> : null}
              </div>
            </div>

            {/* 3D Keypad */}
            <div className="grid grid-cols-3 gap-4 max-w-[280px] mx-auto mt-6">
              {PAD_KEYS.map((key) => {
                const isSpecial = key === "back" || key === "clear";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => void handlePad(key)}
                    className={`h-16 w-16 mx-auto rounded-full flex items-center justify-center transition-all duration-150 ${
                      isSpecial 
                        ? "text-slate-600 text-sm font-extrabold bg-slate-100 hover:bg-slate-200 shadow-[0_4px_0_rgb(203,213,225)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(203,213,225)] active:translate-y-[4px] active:shadow-none" 
                        : "text-slate-900 text-2xl font-black bg-white border-2 border-slate-100 shadow-[0_6px_0_rgb(226,232,240)] hover:translate-y-[2px] hover:shadow-[0_4px_0_rgb(226,232,240)] active:translate-y-[6px] active:shadow-none"
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
      
      <p className={`fixed bottom-4 text-center text-slate-400 text-[11px] font-bold tracking-wider transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        Attendify v3.0 — © {new Date().getFullYear()}
      </p>

      <style>{`
        .animate-drop-in { animation: dropIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-10px) scaleY(0.9); } to { opacity: 1; transform: translateY(0) scaleY(1); } }
      `}</style>
    </div>
  );
}
