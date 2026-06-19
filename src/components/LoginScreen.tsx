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

  // --- RENDER: CREATE ACCOUNT (Premium Theme) ---
  if (showCreate) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 font-sans">
        {/* Animated Gradient Orbs */}
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-500/30 rounded-full filter blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[700px] h-[700px] bg-purple-500/20 rounded-full filter blur-[140px] animate-pulse delay-1000" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] bg-cyan-400/10 rounded-full filter blur-[100px] animate-pulse delay-2000" />
        
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 10}s`,
              }}
            />
          ))}
        </div>
        
        <div className={`relative w-full max-w-[440px] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] rounded-3xl p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_30px_80px_-12px_rgba(37,99,235,0.2)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Glow Line Top */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full" />
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4 hover:scale-110 hover:-translate-y-1 transition-all duration-500 ease-out cursor-default">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full" />
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[56px] h-[56px] relative">
                  <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#60A5FA"/>
                  <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#93C5FD"/>
                  <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#3B82F6"/>
                  <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#DBEAFE"/>
                </svg>
              </div>
              <span className="text-white text-3xl font-bold tracking-tight ml-3 drop-shadow-lg">Attendify</span>
            </div>
            <h1 className="text-xl font-semibold text-white/90">New Account</h1>
            <p className="text-blue-300/70 text-xs font-medium mt-1 uppercase tracking-[0.2em]">Request will be sent to admin</p>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wider mb-1.5">Full Name</label>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="Enter your full name"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-medium text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all duration-200" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wider mb-1.5">4-Digit PIN</label>
              <input 
                value={newPin} 
                onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} 
                placeholder="Enter 4-digit PIN" 
                maxLength={4}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3.5 text-2xl font-bold text-center tracking-[0.4em] text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all duration-200" 
              />
            </div>
            
            {createMsg && (
              <div className={`text-xs text-center p-3.5 rounded-xl font-semibold animate-fade-in ${createMsg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                {createMsg.text}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
            >
              Submit Request
            </button>
            <button 
              type="button" 
              onClick={() => setShowCreate(false)} 
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white/70 rounded-xl font-semibold text-sm transition-all duration-200 border border-white/5"
            >
              ← Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN LOGIN (Premium Lock Screen) ---
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 font-sans">
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
      
      {/* Animated Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-500/30 rounded-full filter blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[700px] h-[700px] bg-purple-500/20 rounded-full filter blur-[140px] animate-pulse delay-1000" />
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[400px] h-[400px] bg-cyan-400/10 rounded-full filter blur-[100px] animate-pulse delay-2000" />
      
      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/10 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card - Premium Glassmorphism */}
      <div className={`relative w-full max-w-[440px] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] rounded-3xl p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_30px_80px_-12px_rgba(37,99,235,0.2)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Glow Line Top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 hover:scale-110 hover:-translate-y-1 transition-all duration-500 ease-out cursor-default">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full animate-pulse" />
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[56px] h-[56px] relative">
                <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="#60A5FA"/>
                <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#93C5FD"/>
                <path d="M11.66 12.6l-2.6-4.32a.24.24 0 00-.42 0l-5.6 9.6a1 1 0 00.86 1.51h7.82a1 1 0 00.85-1.5l-.9-1.52a.49.49 0 010-.49l.9-1.5a1 1 0 00-.01-1.02z" fill="#3B82F6"/>
                <path d="M19.06 19.49L12.56 8.52a.24.24 0 00-.42 0L6.78 17.5a1 1 0 00.86 1.5h10.56a1 1 0 00.86-1.5z" fill="#DBEAFE"/>
              </svg>
            </div>
            <span className="text-white text-3xl font-bold tracking-tight ml-3 drop-shadow-lg">Attendify</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-blue-400/50" />
            <p className="text-[10px] font-semibold text-blue-300/80 tracking-[0.3em] uppercase">Employee Attendance</p>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-blue-400/50" />
          </div>
        </div>

        {/* ===== PHASE 1: USER SELECTION ===== */}
        {phase === 'select' && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2 relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wider ml-1">
                Username
              </label>
              
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-left group"
              >
                <span className={`text-sm font-medium ${selectedEmployee ? "text-white" : "text-white/40"}`}>
                  {selectedEmployee ? selectedEmployee.name : "Select your username"}
                </span>
                <svg className={`w-5 h-5 text-white/40 group-hover:text-blue-400 transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-blue-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/10 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.5)] rounded-xl z-50 overflow-hidden animate-drop-in origin-top">
                  <div className="p-3 border-b border-white/5 bg-white/5">
                    <input
                      type="text"
                      placeholder="Search your name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 transition-all duration-200"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                    {filtered.length > 0 ? (
                      filtered.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => selectEmp(emp)}
                          className="w-full text-left px-4 py-3 text-sm font-semibold text-white/70 hover:bg-blue-500/20 hover:text-white rounded-lg transition-all duration-200 flex items-center gap-3 hover:translate-x-1 group"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold group-hover:bg-blue-400 group-hover:text-white transition-colors">
                            {getInitials(emp.name)}
                          </div>
                          {emp.name}
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm font-medium text-white/30">No users found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 opacity-50 pointer-events-none">
              <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wider ml-1">Password</label>
              <div className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white/50 font-bold text-lg tracking-[0.3em]">
                ••••••••
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:scale-[0.98] text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
            >
              Next
            </button>

            <div className="pt-6 text-center border-t border-white/5 mt-4">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-3">or create new account</p>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateMsg(null); }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register Account
              </button>
            </div>
          </div>
        )}

        {/* ===== PHASE 2: PIN PAD (Enhanced) ===== */}
        {phase === 'pin' && selectedEmployee && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-xl mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-blue-500/30">
                {getInitials(selectedEmployee.name)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{selectedEmployee.name}</p>
                <p className="text-[10px] text-blue-300/70 font-semibold uppercase tracking-wider mt-0.5">Selected User</p>
              </div>
              <button type="button" onClick={goBack} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors active:scale-90">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="text-center space-y-3">
              <label className="block text-xs font-semibold text-blue-200/70 uppercase tracking-wider">Enter Password (PIN)</label>
              
              <div className={`flex justify-center gap-4 py-4 ${shake ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      i < pin.length 
                        ? "bg-blue-400 scale-125 shadow-[0_0_20px_rgba(96,165,250,0.6)]" 
                        : "bg-white/20 border-2 border-white/10"
                    }`}
                  />
                ))}
              </div>
              <div className="h-6">
                {error ? <span className="text-xs font-semibold text-red-400 animate-bounce block">{error}</span> 
                 : loading ? <span className="text-xs font-semibold text-blue-300 animate-pulse block">Verifying securely...</span> : null}
              </div>
            </div>

            {/* Keypad - Premium Glass Style */}
            <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto mt-4">
              {PAD_KEYS.map((key) => {
                const isSpecial = key === "back" || key === "clear";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => void handlePad(key)}
                    className={`h-16 w-16 mx-auto rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 ${
                      isSpecial 
                        ? "text-white/40 text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/5" 
                        : "text-white text-2xl font-bold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/30 hover:shadow-[0_0_30px_rgba(96,165,250,0.1)]"
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
      <p className={`fixed bottom-4 text-center text-white/20 text-[10px] font-semibold tracking-wider transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        Attendify v3.0 — © {new Date().getFullYear()}
      </p>

      {/* Animations */}
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
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100px) translateX(20px); opacity: 0; }
        }
        .animate-drop-in { 
          animation: dropIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-fade-in { 
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-shake { 
          animation: shake 0.4s ease forwards; 
        }
        .animate-float {
          animation: float linear infinite;
        }
      `}</style>
    </div>
  );
}
