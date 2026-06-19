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
  const [showPassword, setShowPassword] = useState(false);

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
  // REGISTER ACCOUNT — Premium Enterprise
  // =============================================
  if (showCreate) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] font-sans overflow-hidden">
        {/* Subtle blur orbs */}
        <div className="absolute top-[-8%] left-[-5%] w-[300px] h-[300px] bg-blue-400/15 rounded-full filter blur-[100px]" />
        <div className="absolute bottom-[-8%] right-[-5%] w-[300px] h-[300px] bg-blue-300/10 rounded-full filter blur-[100px]" />

        <div className={`relative w-full max-w-[420px] bg-white rounded-[32px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.08)] p-8 sm:p-10 z-10 transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-5">
              <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center mr-3">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                  <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="white"/>
                  <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#93C5FD"/>
                </svg>
              </div>
              <span className="text-slate-900 text-2xl font-bold tracking-tight">Attendify</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Create an account</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Request will be sent to admin for approval</p>
          </div>
          
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  placeholder="Enter your full name"
                  className="w-full h-14 bg-white border border-slate-200 rounded-[18px] pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 text-slate-900 placeholder-slate-400 transition-all duration-200" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">4-Digit PIN</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input 
                  value={newPin} 
                  onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} 
                  placeholder="Enter 4-digit PIN" 
                  maxLength={4}
                  type={showPassword ? 'text' : 'password'}
                  className="w-full h-14 bg-white border border-slate-200 rounded-[18px] pl-11 pr-12 text-2xl font-bold tracking-[0.4em] focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 text-slate-900 placeholder-slate-400 transition-all duration-200" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            {createMsg && (
              <div className={`text-xs text-center p-3.5 rounded-xl font-medium animate-fade-in ${createMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {createMsg.text}
              </div>
            )}
            
            <button 
              type="submit" 
              className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white rounded-[18px] font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Submit Request
            </button>
            <button 
              type="button" 
              onClick={() => setShowCreate(false)} 
              className="w-full h-14 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-600 rounded-[18px] font-medium text-sm transition-all duration-200 border border-slate-200"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN LOGIN — Premium Enterprise
  // =============================================
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* Subtle blur orbs */}
      <div className="absolute top-[-8%] left-[-5%] w-[300px] h-[300px] bg-blue-400/15 rounded-full filter blur-[100px]" />
      <div className="absolute bottom-[-8%] right-[-5%] w-[300px] h-[300px] bg-blue-300/10 rounded-full filter blur-[100px]" />

      {/* Main Card */}
      <div className={`relative w-full max-w-[420px] bg-white rounded-[32px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.08)] p-8 sm:p-10 z-10 transition-all duration-700 ease-out hover:shadow-[0_25px_70px_-12px_rgba(0,0,0,0.12)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center mr-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                <path d="M22.95 19.32l-10-16.7A1 1 0 0012 2H8.38a1 1 0 00-.86.5l-6 10.32a.49.49 0 00.33.72l4.89.84a1 1 0 001.12-.51l4-6.8a.24.24 0 01.42 0l7.26 12.15a1 1 0 01-.86 1.5H3.63a1 1 0 00.86.5h16.74a1 1 0 00.86-1.51z" fill="white"/>
                <path d="M12.18 2.37l-10 16.7a1 1 0 00.86 1.51H7a1 1 0 00.86-.5l10-16.7a1 1 0 00-.86-1.51h-4a1 1 0 00-.82.5z" fill="#93C5FD"/>
              </svg>
            </div>
            <span className="text-slate-900 text-2xl font-bold tracking-tight">Attendify</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-slate-100/80 px-3.5 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Employee Attendance System</span>
          </div>
        </div>

        {/* ===== PHASE 1: USER SELECTION ===== */}
        {phase === 'select' && (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-1.5 relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">
                Username
              </label>
              
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full h-14 flex items-center justify-between px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-[18px] transition-all duration-300 focus:outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className={`text-sm font-medium truncate ${selectedEmployee ? "text-slate-900" : "text-slate-400"}`}>
                    {selectedEmployee ? selectedEmployee.name : "Select your username"}
                  </span>
                </div>
                <svg className={`w-4 h-4 text-slate-400 group-hover:text-[#2563EB] transition-transform duration-300 flex-shrink-0 ${dropdownOpen ? 'rotate-180 text-[#2563EB]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12)] rounded-[20px] z-50 overflow-hidden animate-drop-in origin-top">
                  <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search employees..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 placeholder-slate-400 text-slate-900 transition-all duration-200"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-2 space-y-0.5">
                    {filtered.length > 0 ? (
                      filtered.map(emp => {
                        const isSelected = selectedEmployee?.id === emp.id;
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => selectEmp(emp)}
                            className={`w-full text-left px-3 py-2.5 rounded-[14px] transition-all duration-200 flex items-center gap-3 ${
                              isSelected 
                                ? 'bg-[#2563EB]/10 text-[#2563EB]' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isSelected 
                                ? 'bg-[#2563EB] text-white' 
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {getInitials(emp.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[#2563EB]' : 'text-slate-700'}`}>
                                {emp.name}
                              </p>
                            </div>
                            {isSelected && (
                              <svg className="w-4 h-4 text-[#2563EB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-sm font-medium text-slate-400">No employees found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 opacity-50 pointer-events-none">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider ml-1">Password</label>
              <div className="w-full h-14 flex items-center px-4 bg-slate-50 border border-slate-200 rounded-[18px] text-slate-500 font-bold text-lg tracking-[0.3em]">
                ••••••••
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="w-full h-14 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white rounded-[18px] font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Next
            </button>

            <div className="pt-6 text-center">
              <div className="flex items-center gap-4 before:flex-1 before:h-px before:bg-slate-200 after:flex-1 after:h-px after:bg-slate-200">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">or</span>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setCreateMsg(null); }}
                className="w-full mt-4 h-12 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-600 rounded-[18px] font-medium text-sm transition-all duration-200 border border-slate-200 flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Register Account
              </button>
            </div>
          </div>
        )}

        {/* ===== PHASE 2: PIN PAD ===== */}
        {phase === 'pin' && selectedEmployee && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-[18px] mb-3">
              <div className="w-11 h-11 bg-[#2563EB] text-white rounded-[14px] flex items-center justify-center font-bold text-base shadow-sm">
                {getInitials(selectedEmployee.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{selectedEmployee.name}</p>
                <p className="text-[10px] text-[#2563EB] font-semibold uppercase tracking-wider mt-0.5">Selected User</p>
              </div>
              <button type="button" onClick={goBack} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-[14px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors active:scale-95 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                        ? "bg-[#2563EB] scale-110 shadow-[0_0_16px_rgba(37,99,235,0.3)]" 
                        : "bg-slate-200 border-2 border-slate-300"
                    }`}
                  />
                ))}
              </div>
              <div className="h-6">
                {error ? (
                  <span className="text-xs font-medium text-red-500 animate-bounce block">{error}</span>
                ) : loading ? (
                  <span className="text-xs font-medium text-[#2563EB] animate-pulse block">Verifying...</span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mt-3">
              {PAD_KEYS.map((key) => {
                const isSpecial = key === "back" || key === "clear";
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => void handlePad(key)}
                    className={`h-14 w-14 mx-auto rounded-[18px] flex items-center justify-center transition-all duration-150 active:scale-95 ${
                      isSpecial 
                        ? "text-slate-500 text-sm font-medium bg-slate-100 hover:bg-slate-200" 
                        : "text-slate-800 text-xl font-semibold bg-white border-2 border-slate-200 hover:border-[#2563EB] hover:bg-slate-50"
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
      <p className={`fixed bottom-4 text-center text-slate-400 text-[10px] font-medium tracking-wider transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        Attendify v3.0 — © {new Date().getFullYear()}
      </p>

      {/* Animations */}
      <style>{`
        @keyframes dropIn {
          from { 
            opacity: 0; 
            transform: translateY(-6px) scaleY(0.96) scaleX(0.98); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scaleY(1) scaleX(1); 
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-drop-in { 
          animation: dropIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-fade-in { 
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        .animate-shake { 
          animation: shake 0.4s ease forwards; 
        }
      `}</style>
    </div>
  );
}
