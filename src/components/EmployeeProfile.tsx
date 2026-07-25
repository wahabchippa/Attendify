// src/components/EmployeeProfile.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee } from '../types';
import {
  getEmployees, getAttendanceRecords, getEmployeeTiming,
  getLocationFromIP, canSeeOT, getSalaryConfig,
  getLeaveBalance, getManagerNotes, addManagerNote,
  deleteManagerNote, getPKTDate, getPKTISOString,
  getDeviceLogs, bindEmployeeDevice, syncAll,
} from '../store';
import { format, parseISO, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface EmployeeProfileProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const formatPKR = (n: number) =>
  n > 0 ? `PKR ${Math.round(n).toLocaleString('en-PK')}` : '—';

const STATUS_STYLES: Record<string, string> = {
  present:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  late:             'bg-amber-50 text-amber-700 border-amber-200',
  absent:           'bg-red-50 text-red-700 border-red-200',
  'half-day':       'bg-orange-50 text-orange-700 border-orange-200',
  'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
  'holiday-ot':     'bg-purple-50 text-purple-700 border-purple-200',
  'on-leave':       'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const NOTE_TYPE_CONFIG = {
  general:       { label: 'General',       color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200',  icon: '📝' },
  appreciation:  { label: 'Appreciation',  color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200',icon: '🌟' },
  warning:       { label: 'Warning',       color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  icon: '⚠️' },
  disciplinary:  { label: 'Disciplinary',  color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: '🚨' },
};

export default function EmployeeProfile({ currentUser }: EmployeeProfileProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [mounted, setMounted]             = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    isAdmin ? '' : currentUser.id
  );
  const [activeTab, setActiveTab]         = useState<'overview' | 'attendance' | 'notes' | 'device'>('overview');
  const [refreshKey, setRefreshKey]       = useState(0);
  const [notification, setNotification]   = useState<{ type: string; message: string } | null>(null);

  // Notes form
  const [noteText, setNoteText]     = useState('');
  const [noteType, setNoteType]     = useState<'general' | 'appreciation' | 'warning' | 'disciplinary'>('general');
  const [notePrivate, setNotePrivate] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const employees    = getEmployees();
  const allRecords   = useMemo(() => getAttendanceRecords(), [refreshKey]);
  const selectedEmp  = useMemo(() => employees.find(e => e.id === selectedEmpId), [selectedEmpId, refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const showNotif = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Stats for selected employee
  const empStats = useMemo(() => {
    if (!selectedEmpId) return null;
    const now    = getPKTDate();
    const month  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recs   = allRecords.filter(r => r.employeeId === selectedEmpId);
    const thisMonth = recs.filter(r => r.date.startsWith(month));
    const last30    = recs.filter(r => r.date >= format(subDays(now, 30), 'yyyy-MM-dd'));
    const timing    = getEmployeeTiming(selectedEmpId);

    const totalHours    = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const monthHours    = thisMonth.reduce((s, r) => s + (r.totalHours || 0), 0);
    const presentAll    = recs.filter(r => ['present', 'late', 'work-from-home'].includes(r.status)).length;
    const lateAll       = recs.filter(r => r.status === 'late').length;
    const absentAll     = recs.filter(r => r.status === 'absent').length;
    const wfhAll        = recs.filter(r => r.status === 'work-from-home').length;
    const onTimePercent = presentAll > 0 ? Math.round(((presentAll - lateAll) / presentAll) * 100) : 0;

    // OT
    let totalOT = 0;
    recs.forEach(r => {
      if (r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY')) totalOT += r.totalHours || 0;
      else if (r.totalHours > timing.minHoursForFullDay) totalOT += r.totalHours - timing.minHoursForFullDay;
    });

    // Streak
    let streak = 0;
    const sorted = [...recs].sort((a, b) => b.date.localeCompare(a.date));
    for (const r of sorted) {
      if (['present', 'late', 'work-from-home'].includes(r.status)) streak++;
      else break;
    }

    // Last 5 records
    const recent = sorted.slice(0, 5);

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      monthHours: Math.round(monthHours * 10) / 10,
      presentAll, lateAll, absentAll, wfhAll,
      onTimePercent,
      totalOT: Math.round(totalOT * 10) / 10,
      streak,
      recent,
      last30Present: last30.filter(r => ['present', 'late', 'work-from-home'].includes(r.status)).length,
      last30Late: last30.filter(r => r.status === 'late').length,
      last30Absent: last30.filter(r => r.status === 'absent').length,
    };
  }, [selectedEmpId, allRecords]);

  const leaveBalance  = useMemo(() =>
    selectedEmpId ? getLeaveBalance(selectedEmpId, getPKTDate().getFullYear()) : null,
    [selectedEmpId, refreshKey]
  );

  const salaryConfig  = useMemo(() =>
    selectedEmpId ? getSalaryConfig(selectedEmpId) : null,
    [selectedEmpId, refreshKey]
  );

  const notes = useMemo(() =>
    selectedEmpId ? getManagerNotes(selectedEmpId) : [],
    [selectedEmpId, refreshKey]
  );

  const deviceLogs = useMemo(() =>
    selectedEmpId ? getDeviceLogs(selectedEmpId).slice(0, 10) : [],
    [selectedEmpId, refreshKey]
  );

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedEmpId) return;
    setAddingNote(true);
    await addManagerNote({
      id:          `note-${Date.now()}`,
      employeeId:  selectedEmpId,
      note:        noteText.trim(),
      type:        noteType,
      addedBy:     currentUser.id,
      addedByName: currentUser.name,
      addedAt:     getPKTISOString(),
      isPrivate:   notePrivate,
    });
    setNoteText('');
    setNoteType('general');
    setNotePrivate(false);
    setRefreshKey(k => k + 1);
    setAddingNote(false);
    showNotif('success', 'Note added!');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    await deleteManagerNote(noteId);
    setRefreshKey(k => k + 1);
    showNotif('warning', 'Note deleted');
  };

  const handleResetDevice = async () => {
    if (!selectedEmp || !confirm(`Reset device for ${selectedEmp.name}?`)) return;
    await bindEmployeeDevice(selectedEmpId, null);
    setRefreshKey(k => k + 1);
    showNotif('success', `Device reset for ${selectedEmp.name}`);
  };

  const getPerformanceColor = (pct: number) => {
    if (pct >= 90) return 'text-emerald-600';
    if (pct >= 75) return 'text-blue-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceLabel = (pct: number) => {
    if (pct >= 90) return { label: 'Excellent', color: 'bg-emerald-500' };
    if (pct >= 75) return { label: 'Good', color: 'bg-blue-500' };
    if (pct >= 60) return { label: 'Average', color: 'bg-amber-500' };
    return { label: 'Needs Improvement', color: 'bg-red-500' };
  };

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold max-w-[92%] border animate-slide-down ${
          notification.type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-500' :
          notification.type === 'error'   ? 'bg-red-600/95 text-white border-red-500' :
          'bg-amber-500/95 text-white border-amber-400'
        }`}>
          {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : '⚠'} {notification.message}
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Employee Profile</h2>
            <p className="text-blue-200 text-xs font-bold">Full employee details & performance</p>
          </div>
        </div>
      </div>

      {/* ===== EMPLOYEE SELECTOR (Admin only) ===== */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Employee</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {employees.map(emp => {
              const isSelected = selectedEmpId === emp.id;
              return (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedEmpId(emp.id); setActiveTab('overview'); }}
                  className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white border-blue-400 shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : emp.role === 'admin'   ? 'bg-purple-100 text-purple-700'
                      : emp.role === 'manager' ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {getInitials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {emp.name.split(' ')[0]}
                    </p>
                    <p className={`text-[9px] font-medium capitalize ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                      {emp.role}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No selection */}
      {!selectedEmpId && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className="text-slate-400 font-bold text-sm">Select an employee to view profile</p>
        </div>
      )}

      {/* ===== PROFILE CONTENT ===== */}
      {selectedEmp && empStats && (
        <>
          {/* Employee Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg shrink-0 ${
                  selectedEmp.role === 'admin'   ? 'bg-gradient-to-br from-purple-500 to-purple-700 shadow-purple-500/20' :
                  selectedEmp.role === 'manager' ? 'bg-gradient-to-br from-[#1E40AF] to-[#2563EB] shadow-blue-500/20' :
                                                  'bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-500/20'
                }`}>
                  {getInitials(selectedEmp.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-900">{selectedEmp.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                      selectedEmp.role === 'admin'   ? 'bg-purple-50 text-purple-600 border-purple-200' :
                      selectedEmp.role === 'manager' ? 'bg-blue-50 text-[#1E40AF] border-blue-200' :
                                                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>{selectedEmp.role.toUpperCase()}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{selectedEmp.id}</span>
                    {selectedEmp.device_id && (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-xl border border-emerald-200">
                        📱 Device Bound
                      </span>
                    )}
                  </div>

                  {/* Performance badge */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 max-w-[120px] h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getPerformanceLabel(empStats.onTimePercent).color}`}
                        style={{ width: `${empStats.onTimePercent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-black ${getPerformanceColor(empStats.onTimePercent)}`}>
                      {empStats.onTimePercent}% • {getPerformanceLabel(empStats.onTimePercent).label}
                    </span>
                  </div>
                </div>

                {/* Streak */}
                {empStats.streak > 0 && (
                  <div className="text-center shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md shadow-amber-500/20">
                      <span className="text-white font-black text-sm">{empStats.streak}</span>
                    </div>
                    <p className="text-[9px] font-bold text-amber-600 mt-1">Day Streak</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
            <div className="flex gap-1">
              {[
                { key: 'overview',   label: 'Overview',   icon: '📊' },
                { key: 'attendance', label: 'Attendance',  icon: '📅' },
                { key: 'notes',      label: 'Notes',       icon: '📝', show: isAdmin },
                { key: 'device',     label: 'Device',      icon: '📱', show: isAdmin },
              ].filter(t => t.show !== false).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    activeTab === t.key
                      ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total Present', value: empStats.presentAll,    color: 'text-emerald-600', bg: 'from-emerald-50 to-green-50',  border: 'border-emerald-200', icon: '✅' },
                  { label: 'Total Late',    value: empStats.lateAll,       color: 'text-amber-600',   bg: 'from-amber-50 to-yellow-50',   border: 'border-amber-200',  icon: '⚠️' },
                  { label: 'Total Absent',  value: empStats.absentAll,     color: 'text-red-600',     bg: 'from-red-50 to-rose-50',       border: 'border-red-200',    icon: '❌' },
                  { label: 'Total WFH',     value: empStats.wfhAll,        color: 'text-blue-600',    bg: 'from-blue-50 to-indigo-50',    border: 'border-blue-200',   icon: '🏠' },
                ].map(s => (
                  <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border ${s.border} shadow-sm`}>
                    <p className="text-lg mb-1">{s.icon}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Hours & OT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Hours (All Time)', value: `${empStats.totalHours}h`, color: 'text-[#1E40AF]',  icon: '⏱' },
                  { label: 'This Month Hours',        value: `${empStats.monthHours}h`, color: 'text-emerald-600', icon: '📅' },
                  { label: 'Total Overtime',          value: `+${empStats.totalOT}h`,   color: 'text-purple-600',  icon: '⚡' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <p className="text-xl mb-1">{s.icon}</p>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                    <p className="text-slate-400 text-[10px] font-bold mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Last 30 days mini summary */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Last 30 Days</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Present', value: empStats.last30Present, color: 'text-emerald-600' },
                    { label: 'Late',    value: empStats.last30Late,    color: 'text-amber-600' },
                    { label: 'Absent',  value: empStats.last30Absent,  color: 'text-red-600' },
                  ].map(s => (
                    <div key={s.label} className="text-center bg-slate-50 rounded-2xl p-3 border border-slate-100">
                      <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-slate-400 text-[10px] font-bold mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Balance */}
              {leaveBalance && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Leave Balance ({leaveBalance.year})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Casual',    remaining: leaveBalance.casual,    used: leaveBalance.casualUsed,    color: 'text-blue-600' },
                      { label: 'Sick',      remaining: leaveBalance.sick,      used: leaveBalance.sickUsed,      color: 'text-red-600' },
                      { label: 'Annual',    remaining: leaveBalance.annual,    used: leaveBalance.annualUsed,    color: 'text-emerald-600' },
                      { label: 'Emergency', remaining: leaveBalance.emergency, used: leaveBalance.emergencyUsed, color: 'text-orange-600' },
                    ].map(l => (
                      <div key={l.label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-center">
                        <p className={`text-xl font-black ${l.color}`}>{l.remaining}</p>
                        <p className="text-slate-400 text-[9px] font-bold mt-0.5">{l.label}</p>
                        <p className="text-slate-300 text-[9px] font-medium">{l.used} used</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Salary info */}
              {isAdmin && salaryConfig && salaryConfig.baseSalary > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">💰 Salary Info</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: 'Base Salary',  value: formatPKR(salaryConfig.baseSalary) },
                      { label: 'Allowances',   value: formatPKR(salaryConfig.allowances) },
                      { label: 'OT Rate/hr',   value: formatPKR(salaryConfig.otRatePerHour) },
                    ].map(s => (
                      <div key={s.label} className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                        <p className="text-emerald-700 font-black">{s.value}</p>
                        <p className="text-emerald-500 text-[10px] font-bold mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== ATTENDANCE TAB ===== */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
                <h3 className="text-sm font-black text-slate-800">Recent Attendance</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {empStats.recent.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-slate-400 font-bold text-sm">No attendance records</p>
                  </div>
                ) : (
                  empStats.recent.map(rec => {
                    const statusStyle = STATUS_STYLES[rec.status] || 'bg-slate-50 text-slate-600 border-slate-200';
                    return (
                      <div key={rec.id} className="px-5 py-3.5 hover:bg-slate-50/80 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black border shrink-0 ${statusStyle}`}>
                            {rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-700 text-sm font-bold">{rec.date}</p>
                            <p className="text-slate-400 text-[10px] font-medium">
                              {getLocationFromIP(rec.ipAddress)}
                              {rec.totalHours > 0 && ` · ${rec.totalHours}h`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {rec.checkIn && (
                              <p className="text-slate-600 text-xs font-mono font-bold">
                                {rec.checkIn ? format(parseISO(rec.checkIn), 'hh:mm a') : '—'}
                              </p>
                            )}
                            {rec.checkOut && (
                              <p className="text-slate-400 text-[10px] font-mono">
                                → {format(parseISO(rec.checkOut), 'hh:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ===== NOTES TAB ===== */}
          {activeTab === 'notes' && isAdmin && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
                  <h3 className="text-sm font-black text-slate-800">Add Manager Note</h3>
                </div>
                <div className="p-5 space-y-4">
                  {/* Note type */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(NOTE_TYPE_CONFIG) as Array<keyof typeof NOTE_TYPE_CONFIG>).map(type => {
                      const cfg = NOTE_TYPE_CONFIG[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setNoteType(type)}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                            noteType === type
                              ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-sm`
                              : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{cfg.icon}</span>
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Write your note here..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] resize-none transition-all"
                  />

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notePrivate}
                        onChange={e => setNotePrivate(e.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-600">Private (employee won't see)</span>
                    </label>

                    <button
                      onClick={handleAddNote}
                      disabled={!noteText.trim() || addingNote}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] disabled:from-slate-300 disabled:to-slate-400 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:shadow-none"
                    >
                      {addingNote ? 'Adding...' : '+ Add Note'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes list */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
                  <h3 className="text-sm font-black text-slate-800">Notes ({notes.length})</h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {notes.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-slate-400 font-bold text-sm">No notes yet</p>
                    </div>
                  ) : (
                    notes.map(note => {
                      const cfg = NOTE_TYPE_CONFIG[note.type as keyof typeof NOTE_TYPE_CONFIG] || NOTE_TYPE_CONFIG.general;
                      return (
                        <div key={note.id} className="px-5 py-4 hover:bg-slate-50/80 transition-all">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 ${cfg.bg} rounded-xl flex items-center justify-center text-lg border ${cfg.border} shrink-0`}>
                              {cfg.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-black ${cfg.color}`}>{cfg.label}</span>
                                {note.isPrivate && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">🔒 Private</span>
                                )}
                                <span className="text-slate-300 text-[9px] ml-auto">by {note.addedByName}</span>
                              </div>
                              <p className="text-slate-700 text-sm font-medium mt-1">{note.note}</p>
                              <p className="text-slate-400 text-[10px] font-medium mt-1">
                                {note.addedAt ? format(parseISO(note.addedAt), 'dd MMM yyyy, hh:mm a') : '—'}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="w-7 h-7 bg-red-50 hover:bg-red-100 text-red-400 rounded-xl flex items-center justify-center text-xs border border-red-200 transition-all active:scale-95 shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== DEVICE TAB ===== */}
          {activeTab === 'device' && isAdmin && (
            <div className="space-y-4">
              {/* Device Status */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
                  <h3 className="text-sm font-black text-slate-800">Device Status</h3>
                </div>
                <div className="p-5">
                  {selectedEmp.device_id ? (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                          <span className="text-2xl">📱</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-emerald-700 font-black text-sm">Device Bound</p>
                          <p className="text-emerald-600 text-[10px] font-medium font-mono truncate">{selectedEmp.device_id}</p>
                        </div>
                      </div>
                      {selectedEmp.role !== 'admin' && (
                        <button
                          onClick={handleResetDevice}
                          className="w-full py-3 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-2xl text-sm font-bold transition-all active:scale-95"
                        >
                          🔄 Reset Device Binding
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                      <span className="text-3xl">📵</span>
                      <p className="text-slate-500 font-bold text-sm mt-2">No Device Bound</p>
                      <p className="text-slate-400 text-xs mt-1">Employee will bind device on first login</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Logs */}
              {deviceLogs.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
                    <h3 className="text-sm font-black text-slate-800">Device Activity Log</h3>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {deviceLogs.map((log, idx) => {
                      const actionConfig: Record<string, { color: string; icon: string }> = {
                        bind:           { color: 'text-emerald-600', icon: '🔗' },
                        reset:          { color: 'text-amber-600',   icon: '🔄' },
                        login_attempt:  { color: 'text-blue-600',    icon: '🔑' },
                        login_blocked:  { color: 'text-red-600',     icon: '🚫' },
                      };
                      const cfg = actionConfig[log.action] || { color: 'text-slate-600', icon: '•' };
                      return (
                        <div key={idx} className="px-5 py-3 hover:bg-slate-50/80 transition-all">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{cfg.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold capitalize ${cfg.color}`}>{log.action.replace('_', ' ')}</p>
                              <p className="text-slate-400 text-[10px] font-medium truncate">{log.deviceInfo}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-[10px] font-black ${log.success ? 'text-emerald-600' : 'text-red-500'}`}>
                                {log.success ? '✓' : '✕'}
                              </p>
                              <p className="text-slate-300 text-[9px] font-medium">
                                {log.timestamp ? format(parseISO(log.timestamp), 'dd MMM') : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slide-down { animation: slideDown 0.35s ease-out forwards; }
      `}</style>
    </div>
  );
}