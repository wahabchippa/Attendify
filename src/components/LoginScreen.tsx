// src/components/LoginScreen.tsx

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Employee } from '../types';
import { getEmployees, addAccountRequest, bindEmployeeDevice } from '../store';

interface LoginScreenProps {
  onLogin: (employee: Employee) => void;
}

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
  const selectedRef = useRef<Employee | null>(null);

  // ✅ Fix: employees memoized
  const employees = useMemo(() => getEmployees(), []);

  const filtered = useMemo(
    () => employees.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase())),
    [search, employees]
  );

  // ✅ Fix: cleanup timeout
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
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

  // ✅ Keep selectedRef in sync
  useEffect(() => {
    selectedRef.current = selectedEmployee;
  }, [selectedEmployee]);

  const selectEmp = useCallback((emp: Employee) => {
    setSelectedEmployee(emp);
    setDropdownOpen(false);
    setSearch('');
    setPin('');
    setError('');
    // ✅ Fix: Don't auto-jump to pin phase — let user click "Proceed"
  }, []);

  const goBack = useCallback(() => {
    setPhase('select');
    setPin('');
    setError('');
    // ✅ Fix: Don't clear selectedEmployee so user can see who was selected
  }, []);

  const getDeviceUUID = useCallback(() => {
    let uuid = localStorage.getItem('attendify_device_uuid');
    if (!uuid) {
      uuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('attendify_device_uuid', uuid);
    }
    return uuid;
  }, []);

  const processLogin = useCallback(async (enteredPin: string) => {
    const emp = selectedRef.current;
    if (!emp) return;

    const latest = getEmployees().find(e => e.id === emp.id);

    if (!latest || enteredPin !== latest.pin) {
      setError('Incorrect PIN. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setLoading(false);
      return;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
      setLoading(false); // ✅ Fix: reset loading before login
      onLogin(latest);
      return;
    }

    const currentDeviceUUID = getDeviceUUID();

    if (!latest.device_id) {
      try {
        await bindEmployeeDevice(latest.id, currentDeviceUUID);
        const updatedEmployee = { ...latest, device_id: currentDeviceUUID };
        setLoading(false); // ✅ Fix
        onLogin(updatedEmployee);
      } catch {
        setError('Device binding failed. Try again.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin('');
        setLoading(false);
      }
    } else if (latest.device_id === currentDeviceUUID) {
      setLoading(false); // ✅ Fix
      onLogin(latest);
    } else {
      setError("🚫 This device is not registered to your account.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setLoading(false);
    }
  }, [onLogin, getDeviceUUID]);

  const handlePad = useCallback(async (key: PadKey) => {
    if (loading) return;
    if (key === "clear") { setPin(""); setError(""); return; }
    if (key === "back") { setPin((p) => p.slice(0, -1)); setError(""); return; }

    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = prev + key;
      setError("");

      if (next.length === 4) {
        setLoading(true);
        // ✅ Fix: use setTimeout to let state update, then process
        setTimeout(() => processLogin(next), 100);
      }
      return next;
    });
  }, [loading, processLogin]);

  // ✅ Fix: Proceed button handler
  const handleProceed = useCallback(() => {
    if (!selectedEmployee) {
      setError("Please select your profile first.");
      setShake(true);
      setTimeout(() => { setShake(false); setError(""); }, 2500);
      return;
    }
    setError('');
    setPhase('pin');
  }, [selectedEmployee]);

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    const cpin = newPin.replace(/\D/g, "").slice(0, 4);

    if (!name) { setCreateMsg({ type: "err", text: "Full name is required." }); return; }
    if (cpin.length !== 4) { setCreateMsg({ type: "err", text: "PIN must be exactly 4 digits." }); return; }

    setCreateMsg(null);
    try {
      addAccountRequest({
        id: `req-${Date.now()}`,
        name,
        pin: cpin,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      });
      setCreateMsg({ type: "ok", text: "✅ Request submitted! Awaiting admin approval." });
      setNewName('');
      setNewPin('');
      setTimeout(() => { setCreateMsg(null); setShowCreate(false); }, 3000);
    } catch {
      setCreateMsg({ type: "err", text: "Failed to submit. Please try again." });
    }
  }, [newName, newPin]);

  // ---- Shared Icons ----
  const UserIcon = () => (
    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );

  const LockIcon = () => (
    <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );

  const BackArrow = () => (
    <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );

  // =============================================
  // LOADING SCREEN
  // =============================================
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] z-50 flex flex-col items-center justify-center font-sans">
        <div className="relative flex flex-col items-center animate-pulse">
          <div className="relative">
            <img src="/icon.png" alt="Attendify" className="h-24 w-auto object-contain mb-4 drop-shadow-2xl" />
            <div className="absolute -inset-4 bg-white/20 blur-2xl rounded-full -z-10" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">Attendify</h2>
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
        <p className="mt-6 text-blue-100 font-bold text-sm tracking-widest animate-pulse">AUTHENTICATING...</p>
      </div>
    );
  }

  // =============================================
  // REGISTER ACCOUNT SCREEN
  // =============================================
  if (showCreate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-5 transition-all duration-500">

          {/* Left Panel */}
          <div className="hidden md:flex md:col-span-2 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] p-10 flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-400/30 rounded-full blur-2xl" />

            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 self-start z-10">
              <img src="/icon.png" alt="Logo" className="h-10 w-auto object-contain" />
              <span className="text-xl font-bold tracking-tight">Attendify</span>
            </div>

            <div className="z-10 space-y-3">
              <h1 className="text-4xl font-extrabold leading-tight">Join the<br />Network</h1>
              <p className="text-blue-100 text-sm font-medium max-w-xs opacity-90">
                Register your account and request access to the attendance system.
              </p>
            </div>

            <p className="text-xs text-blue-200/70 font-medium z-10">Secure Console v3.0</p>
          </div>

          {/* Right Form Panel */}
          <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
            <div className="md:hidden flex flex-col items-center mb-6">
              <img src="/icon.png" alt="Logo" className="h-16 w-auto object-contain mb-2" />
              <h2 className="text-2xl font-black text-slate-900">Attendify</h2>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900">Create Account</h2>
              <p className="text-sm text-slate-400 font-medium mt-1">Submit your details for admin approval</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <div className="relative flex items-center h-12 border border-slate-200 rounded-xl px-4 bg-slate-50/50 focus-within:border-[#1E40AF] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <UserIcon />
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Muhammad Ali"
                    className="flex-1 bg-transparent border-none outline-none ml-3 text-sm font-semibold text-slate-800 placeholder-slate-400"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">4-Digit PIN</label>
                <div className="relative flex items-center h-12 border border-slate-200 rounded-xl px-4 bg-slate-50/50 focus-within:border-[#1E40AF] focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <LockIcon />
                  <input
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    type={showPassword ? 'text' : 'password'}
                    inputMode="numeric"
                    className="flex-1 bg-transparent border-none outline-none ml-3 text-sm font-bold text-slate-800 placeholder-slate-400 tracking-[0.3em]"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    aria-label={showPassword ? "Hide PIN" : "Show PIN"}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    )}
                  </button>
                </div>
                {/* PIN strength indicator */}
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i < newPin.length ? 'bg-[#1E40AF]' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {createMsg && (
                <div className={`text-xs text-center p-3 rounded-xl font-bold border transition-all ${
                  createMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {createMsg.text}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] text-white rounded-xl font-bold text-sm tracking-wide shadow-lg hover:shadow-blue-500/25 transition-all transform active:scale-[0.98]"
              >
                Submit Request
              </button>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-4 text-xs font-bold text-slate-400">or</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateMsg(null); setNewName(''); setNewPin(''); }}
                className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <BackArrow />
                Back to Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // MAIN LOGIN SCREEN
  // =============================================
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-5 transition-all duration-500">

        {/* ===== LEFT BRANDING PANEL ===== */}
        <div className="hidden md:flex md:col-span-2 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] p-10 flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-400/30 rounded-full blur-2xl" />

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 self-start z-10">
            <img src="/icon.png" alt="Attendify" className="h-10 w-auto object-contain" />
            <span className="text-xl font-black tracking-tight">Attendify</span>
          </div>

          <div className="z-10 space-y-4">
            <h1 className="text-4xl font-extrabold leading-tight">Secure<br />Access</h1>
            <p className="text-blue-100 text-sm font-medium max-w-xs opacity-90">
              Enterprise-grade authentication & attendance management.
            </p>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 w-fit">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">System Online</span>
            </div>
          </div>

          <p className="text-xs text-blue-200/70 font-medium z-10">v3.0 • Secure Console</p>
        </div>

        {/* ===== RIGHT LOGIN PANEL ===== */}
        <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center relative">
          <div className={`w-full max-w-sm mx-auto transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

            {/* Mobile logo */}
            <div className="md:hidden flex flex-col items-center mb-8">
              <img src="/icon.png" alt="Attendify" className="h-16 w-auto object-contain mb-2" />
              <h2 className="text-2xl font-black text-slate-900">Attendify</h2>
            </div>

            {/* ===== PHASE 1: USER SELECTION ===== */}
            {phase === 'select' && (
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-slate-900">Welcome Back</h2>
                  <p className="text-sm text-slate-400 font-medium">Select your profile to continue</p>
                </div>

                {/* ✅ Fix: relative wrapper for dropdown */}
                <div className="space-y-2 relative" ref={dropdownRef}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={`w-full h-12 flex items-center justify-between px-4 bg-slate-50/50 border rounded-xl transition-all ${
                      dropdownOpen
                        ? 'border-[#1E40AF] ring-2 ring-blue-500/20'
                        : selectedEmployee
                          ? 'border-[#1E40AF]/30 bg-blue-50/30'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {selectedEmployee ? (
                        <div className="w-6 h-6 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-lg flex items-center justify-center text-[9px] font-bold">
                          {getInitials(selectedEmployee.name)}
                        </div>
                      ) : (
                        <UserIcon />
                      )}
                      <span className={`text-sm font-semibold truncate ${selectedEmployee ? "text-slate-800" : "text-slate-400"}`}>
                        {selectedEmployee ? selectedEmployee.name : "Select your profile"}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${dropdownOpen ? 'rotate-180 text-[#1E40AF]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* ✅ Fix: Dropdown properly positioned relative to parent */}
                  {dropdownOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-scale-up">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                        <input
                          type="text"
                          placeholder="Search profiles..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-[#1E40AF] focus:ring-1 focus:ring-blue-500/20 placeholder-slate-400 transition-all"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto p-1 scrollbar-thin">
                        {filtered.length > 0 ? (
                          filtered.map(emp => {
                            const isSelected = selectedEmployee?.id === emp.id;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => selectEmp(emp)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3 ${
                                  isSelected
                                    ? 'bg-blue-50 text-[#1E40AF] font-bold ring-1 ring-blue-200'
                                    : 'hover:bg-slate-50 text-slate-700 font-medium'
                                }`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                                  isSelected ? 'bg-[#1E40AF] text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {getInitials(emp.name)}
                                </div>
                                <span className="flex-1 text-sm truncate">{emp.name}</span>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-[#1E40AF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-xs font-semibold text-slate-400">No profiles found</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">Try a different search</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* PIN preview (disabled) */}
                <div className="opacity-40 pointer-events-none space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">PIN</label>
                  <div className="relative flex items-center h-12 border border-slate-200 rounded-xl px-4 bg-slate-50/50">
                    <LockIcon />
                    <span className="ml-3 text-sm font-bold text-slate-400 tracking-[0.3em]">••••</span>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className={`text-xs font-bold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 ${shake ? 'animate-shake' : ''}`}>
                    {error}
                  </div>
                )}

                {/* ✅ Fix: Button now correctly goes to PIN phase */}
                <button
                  type="button"
                  onClick={handleProceed}
                  className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all transform active:scale-[0.98] ${
                    selectedEmployee
                      ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] text-white hover:shadow-blue-500/25'
                      : 'bg-gradient-to-r from-slate-300 to-slate-400 text-white/80 cursor-not-allowed shadow-none'
                  }`}
                >
                  {selectedEmployee ? 'Proceed to PIN →' : 'Select a Profile First'}
                </button>

                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="flex-shrink mx-3 text-xs font-bold text-slate-400">or</span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="w-full h-12 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] hover:border-slate-300"
                >
                  <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Register New Account
                </button>
              </div>
            )}

            {/* ===== PHASE 2: PIN ENTRY ===== */}
            {phase === 'pin' && selectedEmployee && (
              <div className="space-y-6">
                {/* Selected user card */}
                <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 border border-slate-200 p-3.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center font-bold text-xs shadow-md shadow-blue-500/20">
                      {getInitials(selectedEmployee.name)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-tight">{selectedEmployee.name}</p>
                      <p className="text-[9px] text-[#1E40AF] uppercase tracking-widest font-black mt-0.5">Authenticated User</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={goBack}
                    className="text-slate-400 p-2 hover:bg-white hover:text-slate-600 rounded-lg transition-all hover:shadow-sm"
                    aria-label="Go back to user selection"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* PIN display */}
                <div className="text-center space-y-5">
                  <div className="space-y-1">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-100 rounded-2xl mb-2">
                      <LockIcon />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enter your 4-digit PIN</p>
                  </div>

                  <div className={`flex justify-center gap-4 py-2 ${shake ? 'animate-shake' : ''}`}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="relative">
                        <div
                          className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                            i < pin.length
                              ? "bg-[#1E40AF] shadow-[0_0_12px_rgba(30,64,175,0.4)] scale-110"
                              : "bg-slate-200"
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 animate-scale-up">
                      {error}
                    </div>
                  )}
                </div>

                {/* Number pad */}
                <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                  {PAD_KEYS.map((key) => {
                    const isSpecial = key === "back" || key === "clear";
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={loading}
                        onClick={() => void handlePad(key)}
                        aria-label={key === "back" ? "Backspace" : key === "clear" ? "Clear" : `Number ${key}`}
                        className={`h-14 rounded-xl flex items-center justify-center font-extrabold transition-all duration-150 active:scale-[0.92] select-none ${
                          isSpecial
                            ? "bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 text-xs tracking-wide"
                            : "bg-white border border-slate-200 text-slate-800 text-lg shadow-sm hover:border-[#1E40AF] hover:shadow-md hover:shadow-blue-500/10 hover:bg-blue-50/30 active:bg-blue-100/50"
                        }`}
                      >
                        {key === "back" ? (
                          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                          </svg>
                        ) : key === "clear" ? "C" : key}
                      </button>
                    );
                  })}
                </div>

                {/* Back to selection link */}
                <button
                  type="button"
                  onClick={goBack}
                  className="w-full text-center text-xs font-bold text-slate-400 hover:text-[#1E40AF] transition-colors py-2"
                >
                  ← Switch Account
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-[10px] font-bold text-slate-400 tracking-wide">
            © {new Date().getFullYear()} Attendify Inc. All rights reserved.
          </div>
        </div>
      </div>

      {/* Global animations */}
      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-scale-up { animation: scaleUp 0.2s ease-out forwards; }
        .animate-shake { animation: shake 0.4s ease forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
      `}</style>
    </div>
  );
}