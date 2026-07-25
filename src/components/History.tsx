// src/components/History.tsx — Clean Redesign

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getLocationFromIP, syncAll } from '../store';
import { format, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, isToday, isSameDay } from 'date-fns';

interface HistoryProps { currentUser: Employee; }

const getInitials = (name: string) =>
 name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; icon: string }> = {
 present: { label: 'Present', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✓' },
 late: { label: 'Late', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', icon: '!' },
 absent: { label: 'Absent', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', icon: '✕' },
 'half-day': { label: 'Half Day', dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', icon: '½' },
 'work-from-home': { label: 'WFH', dot: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-900', icon: '⌂' },
 'holiday-ot': { label: 'Holiday OT', dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', icon: '★' },
 'on-leave': { label: 'On Leave', dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700', icon: '⏸' },
};

const safeFmt = (dateStr: string | null | undefined, fmt: string) => {
 if (!dateStr) return '—';
 try { return format(parseISO(dateStr), fmt); } catch { return '—'; }
};

export default function History({ currentUser }: HistoryProps) {
 const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
 const [selectedEmployee, setSelectedEmployee] = useState(isAdmin ? 'all' : currentUser.id);
 const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
 const [currentDate, setCurrentDate] = useState(() => new Date());
 const [refreshKey, setRefreshKey] = useState(0);
 const [mounted, setMounted] = useState(false);

 const allRecords = useMemo(() => getAttendanceRecords(), [refreshKey]);
 const employees = useMemo(() => getEmployees(), [refreshKey]);
 const attendanceEmps = useMemo(() => getAttendanceEmployees(), [refreshKey]);

 useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);
 useEffect(() => {
 syncAll().then(() => setRefreshKey(k => k + 1));
 const h = () => { syncAll().then(() => setRefreshKey(k => k + 1)); };
 window.addEventListener('focus', h);
 return () => window.removeEventListener('focus', h);
 }, []);

 const getEmpName = useCallback((id: string) => employees.find(e => e.id === id)?.name || 'Unknown', [employees]);
 const sc = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG['present'];

 // ── DAILY: records for the selected date ──
 const dailyDateStr = useMemo(() => format(currentDate, 'yyyy-MM-dd'), [currentDate]);
 const dailyRecords = useMemo(() => {
 let recs = allRecords.filter(r => r.date === dailyDateStr);
 if (selectedEmployee !== 'all') recs = recs.filter(r => r.employeeId === selectedEmployee);
 return recs.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
 }, [allRecords, dailyDateStr, selectedEmployee]);

 // ── WEEKLY: Mon-Sun of current week ──
 const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
 const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
 const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);
 const weekRecords = useMemo(() => {
 const ws = format(weekStart, 'yyyy-MM-dd');
 const we = format(weekEnd, 'yyyy-MM-dd');
 let recs = allRecords.filter(r => r.date >= ws && r.date <= we);
 if (selectedEmployee !== 'all') recs = recs.filter(r => r.employeeId === selectedEmployee);
 return recs;
 }, [allRecords, weekStart, weekEnd, selectedEmployee]);

 // ── MONTHLY: full calendar ──
 const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
 const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
 const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);
 const monthRecords = useMemo(() => {
 const ms = format(monthStart, 'yyyy-MM-dd');
 const me = format(monthEnd, 'yyyy-MM-dd');
 let recs = allRecords.filter(r => r.date >= ms && r.date <= me);
 if (selectedEmployee !== 'all') recs = recs.filter(r => r.employeeId === selectedEmployee);
 return recs;
 }, [allRecords, monthStart, monthEnd, selectedEmployee]);

 // Stats for current view
 const viewRecords = viewMode === 'daily' ? dailyRecords : viewMode === 'weekly' ? weekRecords : monthRecords;
 const stats = useMemo(() => {
 const p = viewRecords.filter(r => r.status === 'present').length;
 const l = viewRecords.filter(r => r.status === 'late').length;
 const a = viewRecords.filter(r => r.status === 'absent').length;
 const h = Math.round(viewRecords.reduce((s, r) => s + (r.totalHours || 0), 0) * 10) / 10;
 return { present: p, late: l, absent: a, totalHours: h, total: viewRecords.length };
 }, [viewRecords]);

 // Navigation
 const goToday = () => setCurrentDate(new Date());
 const goPrev = () => {
 if (viewMode === 'daily') setCurrentDate(d => subDays(d, 1));
 else if (viewMode === 'weekly') setCurrentDate(d => subWeeks(d, 1));
 else setCurrentDate(d => subMonths(d, 1));
 };
 const goNext = () => {
 if (viewMode === 'daily') setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
 else if (viewMode === 'weekly') setCurrentDate(d => addWeeks(d, 1));
 else setCurrentDate(d => addMonths(d, 1));
 };

 // CSV Download
 const downloadCSV = () => {
 const header = ['Date', 'Employee', 'Status', 'Check In', 'Check Out', 'Hours', 'Location'];
 const rows = viewRecords.map(r => [
 r.date, getEmpName(r.employeeId), (sc(r.status).label),
 safeFmt(r.checkIn, 'hh:mm a'), safeFmt(r.checkOut, 'hh:mm a'),
 r.totalHours > 0 ? `${r.totalHours.toFixed(1)}h` : '', getLocationFromIP(r.ipAddress),
 ].map(v => `"${v}"`).join(','));
 const csv = [header.join(','), ...rows].join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a'); a.href = url; a.download = `attendify_${viewMode}_${format(currentDate, 'yyyy-MM-dd')}.csv`; a.click();
 URL.revokeObjectURL(url);
 };

 // What label to show in the nav bar
 const navLabel = viewMode === 'daily'
 ? format(currentDate, 'EEEE, dd MMMM yyyy')
 : viewMode === 'weekly'
 ? `${format(weekStart, 'dd MMM')} — ${format(weekEnd, 'dd MMM yyyy')}`
 : format(currentDate, 'MMMM yyyy');

 // Helper for weekly per-employee row
 const getWeeklyEmployeeData = () => {
 let empIds: string[];
 if (selectedEmployee === 'all') {
 // Show all attendance employees
 empIds = attendanceEmps.map(e => e.id);
 } else {
 // ONLY the selected employee
 empIds = [selectedEmployee];
 }
 return empIds.map(empId => ({
 empId,
 name: getEmpName(empId),
 days: weekDays.map(day => {
 const ds = format(day, 'yyyy-MM-dd');
 return weekRecords.find(r => r.employeeId === empId && r.date === ds) || null;
 }),
 }));
 };

 return (
 <div className={`space-y-3 font-sans transition-all duration-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>

 {/* ═══ TOP BAR ═══ */}
 <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
 <div className="flex flex-col sm:flex-row sm:items-center gap-3">

 {/* View Mode Tabs */}
 <div className="flex bg-slate-100 rounded p-1 gap-0.5 shrink-0">
 {(['daily', 'weekly', 'monthly'] as const).map(v => (
 <button key={v} onClick={() => setViewMode(v)}
 className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize ${
 viewMode === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
 }`}>
 {v}
 </button>
 ))}
 </div>

 {/* Date Navigation */}
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <button onClick={goPrev} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all shrink-0">
 <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
 </button>
 <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all shrink-0">Today</button>
 <p className="text-sm font-bold text-slate-800 truncate">{navLabel}</p>
 <button onClick={goNext} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all shrink-0">
 <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
 </button>
 </div>

 <div className="flex items-center gap-2 shrink-0">
 {/* Employee Filter */}
 {isAdmin && (
 <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
 className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/20 cursor-pointer">
 <option value="all">All Employees</option>
 {attendanceEmps.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
 </select>
 )}
 <button onClick={downloadCSV} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all" title="Export CSV">
 <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
 </button>
 </div>
 </div>
 </div>

 {/* ═══ MINI STATS ═══ */}
 <div className="grid grid-cols-4 gap-2">
 {[
 { label: 'Present', val: stats.present, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 { label: 'Late', val: stats.late, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
 { label: 'Absent', val: stats.absent, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
 { label: 'Hours', val: `${stats.totalHours}h`, color: 'text-slate-800', bg: 'bg-slate-50', border: 'border-slate-200' },
 ].map(s => (
 <div key={s.label} className={`${s.bg} ${s.border} border rounded p-2.5 text-center`}>
 <p className={`text-lg font-bold ${s.color} leading-none`}>{s.val}</p>
 <p className="text-xs font-medium text-slate-400 mt-1 uppercase">{s.label}</p>
 </div>
 ))}
 </div>

 {/* ═══════════════════════════════════════ */}
 {/* ═══ DAILY VIEW ═══ */}
 {/* ═══════════════════════════════════════ */}
 {viewMode === 'daily' && (
 <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
 {/* Selected Employee Banner */}
 {selectedEmployee !== 'all' && (
 <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
 <div className="w-7 h-7 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center text-white text-[11px] font-medium">
 {getInitials(getEmpName(selectedEmployee))}
 </div>
 <p className="text-sm font-bold text-slate-900">{getEmpName(selectedEmployee)}</p>
 <button onClick={() => setSelectedEmployee('all')} className="ml-auto text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 px-2 py-0.5 rounded">✕ Clear</button>
 </div>
 )}
 {dailyRecords.length === 0 ? (
 <div className="py-16 text-center">
 <div className="text-4xl mb-3">📭</div>
 <p className="text-sm font-bold text-slate-400">{selectedEmployee !== 'all' ? `No records for ${getEmpName(selectedEmployee)}` : 'No records for this day'}</p>
 <p className="text-xs text-slate-300 mt-1">{format(currentDate, 'EEEE, dd MMMM yyyy')}</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-100">
 {dailyRecords.map(r => {
 const s = sc(r.status);
 return (
 <div key={r.id} className="p-4 hover:bg-slate-50/50 transition-colors">
 <div className="flex items-center gap-3">
 {/* Avatar */}
 <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm">
 {getInitials(getEmpName(r.employeeId))}
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-0.5">
 <p className="text-sm font-bold text-slate-800 truncate">{getEmpName(r.employeeId)}</p>
 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${s.bg} ${s.text}`}>
 <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
 {s.label}
 </span>
 </div>
 {r.status !== 'absent' ? (
 <div className="flex items-center gap-3 text-xs text-slate-500">
 <span>In <span className="font-semibold text-slate-700">{safeFmt(r.checkIn, 'hh:mm a')}</span></span>
 <span className="text-slate-300">→</span>
 <span>Out <span className="font-semibold text-slate-700">{safeFmt(r.checkOut, 'hh:mm a')}</span></span>
 {r.totalHours > 0 && (
 <span className="font-bold text-slate-800">{r.totalHours.toFixed(1)}h</span>
 )}
 </div>
 ) : (
 <p className="text-xs text-red-400 font-medium">Did not check in</p>
 )}
 </div>

 {/* Hours badge */}
 {r.totalHours > 0 && (
 <div className="text-right shrink-0 hidden sm:block">
 <p className="text-lg font-bold text-slate-800">{r.totalHours.toFixed(1)}</p>
 <p className="text-[11px] text-slate-400 font-bold">HOURS</p>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* ═══════════════════════════════════════ */}
 {/* ═══ WEEKLY VIEW ═══ */}
 {/* ═══════════════════════════════════════ */}
 {viewMode === 'weekly' && (
 <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
 {/* Day headers */}
 <div className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-slate-100 bg-slate-50/80">
 <div className="p-3 text-xs font-medium text-slate-400 uppercase">Employee</div>
 {weekDays.map(day => {
 const isT = isToday(day);
 const isSun = day.getDay() === 0;
 return (
 <div key={day.toISOString()} className={`p-2 text-center border-l border-slate-100 ${isT ? 'bg-slate-50' : ''}`}>
 <p className={`text-xs font-medium uppercase ${isSun ? 'text-red-400' : isT ? 'text-slate-800' : 'text-slate-400'}`}>
 {format(day, 'EEE')}
 </p>
 <p className={`text-sm font-bold ${isT ? 'text-slate-800' : 'text-slate-700'}`}>
 {format(day, 'd')}
 </p>
 </div>
 );
 })}
 </div>

 {/* Employee rows */}
 {/* Selected employee indicator */}
 {selectedEmployee !== 'all' && (
 <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
 <div className="w-6 h-6 bg-slate-800 rounded-md flex items-center justify-center text-white text-[11px] font-medium">{getInitials(getEmpName(selectedEmployee))}</div>
 <p className="text-xs font-bold text-slate-900">Showing: {getEmpName(selectedEmployee)}</p>
 <button onClick={() => setSelectedEmployee('all')} className="ml-auto text-xs font-medium text-slate-700 hover:text-slate-900">Show All ×</button>
 </div>
 )}
 {getWeeklyEmployeeData().length === 0 ? (
 <div className="py-12 text-center">
 <p className="text-sm font-bold text-slate-400">No data for this week</p>
 </div>
 ) : (
 <div className="divide-y divide-slate-50">
 {getWeeklyEmployeeData().map(row => (
 <div key={row.empId} className="grid grid-cols-[140px_repeat(7,1fr)] hover:bg-slate-50/30 transition-colors">
 {/* Employee name */}
 <div className="p-3 flex items-center gap-2 border-r border-slate-100">
 <div className="w-7 h-7 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center text-white text-[11px] font-medium shrink-0">
 {getInitials(row.name)}
 </div>
 <p className="text-xs font-bold text-slate-700 truncate">{row.name}</p>
 </div>

 {/* Day cells */}
 {row.days.map((rec, i) => {
 const day = weekDays[i];
 const isT = isToday(day);
 const isSun = day.getDay() === 0;

 if (!rec) {
 return (
 <div key={i} className={`p-2 border-l border-slate-100 flex items-center justify-center ${isT ? 'bg-slate-50/50' : isSun ? 'bg-slate-50/50' : ''}`}>
 {isSun ? (
 <span className="text-[11px] text-slate-300 font-medium">OFF</span>
 ) : (
 <span className="text-[11px] text-slate-300">—</span>
 )}
 </div>
 );
 }

 const s = sc(rec.status);
 return (
 <div key={i} className={`p-1.5 border-l border-slate-100 flex items-center justify-center ${isT ? 'bg-slate-50/50' : ''}`}>
 <div className={`w-full rounded-lg p-1.5 text-center ${s.bg}`} title={`${s.label} | ${safeFmt(rec.checkIn, 'hh:mm a')} - ${safeFmt(rec.checkOut, 'hh:mm a')} | ${rec.totalHours.toFixed(1)}h`}>
 <div className={`w-5 h-5 rounded-full ${s.dot} mx-auto flex items-center justify-center`}>
 <span className="text-white text-[11px] font-medium">{s.icon}</span>
 </div>
 {rec.totalHours > 0 && (
 <p className={`text-[11px] font-medium mt-0.5 ${s.text}`}>{rec.totalHours.toFixed(1)}h</p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 ))}
 </div>
 )}

 {/* Legend */}
 <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
 {Object.entries(STATUS_CONFIG).slice(0, 5).map(([key, val]) => (
 <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
 <span className={`w-2 h-2 rounded-full ${val.dot}`} />
 {val.label}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* ═══════════════════════════════════════ */}
 {/* ═══ MONTHLY VIEW ═══ */}
 {/* ═══════════════════════════════════════ */}
 {viewMode === 'monthly' && (() => {
 // For monthly we show a calendar + summary
 const targetEmpId = selectedEmployee === 'all' ? currentUser.id : selectedEmployee;
 const empMonthRecs = monthRecords.filter(r => selectedEmployee === 'all' || r.employeeId === targetEmpId);
 const getDayRec = (day: Date) => {
 const ds = format(day, 'yyyy-MM-dd');
 if (selectedEmployee === 'all') {
 // Show aggregate status for the day
 const dayRecs = monthRecords.filter(r => r.date === ds);
 if (dayRecs.length === 0) return null;
 // Return most common status
 const counts: Record<string, number> = {};
 dayRecs.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
 const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
 return { status: top[0], count: dayRecs.length, total: attendanceEmps.length } as { status: string; count: number; total: number };
 }
 const rec = monthRecords.find(r => r.employeeId === targetEmpId && r.date === ds);
 return rec ? { status: rec.status, count: 1, total: 1 } : null;
 };

 // Monthly summary per employee (for 'all')
 const empSummaries = selectedEmployee === 'all'
 ? attendanceEmps.map(emp => {
 const recs = monthRecords.filter(r => r.employeeId === emp.id);
 const present = recs.filter(r => r.status === 'present' || r.status === 'late').length;
 const absent = recs.filter(r => r.status === 'absent').length;
 const hours = Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 10) / 10;
 const workingDays = monthDays.filter(d => d.getDay() !== 0).length;
 return { emp, present, absent, hours, workingDays, attendance: workingDays > 0 ? Math.round((present / workingDays) * 100) : 0 };
 }).sort((a, b) => b.attendance - a.attendance)
 : [];

 const firstDayOffset = monthDays.length > 0 ? monthDays[0].getDay() : 0;

 return (
 <div className="space-y-4">
 {/* Calendar */}
 <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
 {/* Weekday headers */}
 <div className="grid grid-cols-7 mb-2">
 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
 <div key={d} className={`text-center text-xs font-medium uppercase py-1 ${i === 0 ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
 ))}
 </div>

 {/* Calendar grid */}
 <div className="grid grid-cols-7 gap-1">
 {/* Empty cells for offset */}
 {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}

 {monthDays.map(day => {
 const isT = isToday(day);
 const isSun = day.getDay() === 0;
 const info = getDayRec(day);

 // Base cell style
 let cellBg = 'bg-slate-50';
 let dayColor = 'text-slate-600';
 let dotEl = null;

 if (isSun) {
 cellBg = 'bg-slate-50/50';
 dayColor = 'text-slate-300';
 } else if (info) {
 const s = sc(info.status);
 cellBg = s.bg;
 dayColor = s.text;
 dotEl = <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />;
 }

 if (isT) cellBg = 'bg-slate-100 ring-2 ring-slate-900 ring-offset-1';

 return (
 <div key={day.toISOString()} className={`aspect-square rounded-lg ${cellBg} flex flex-col items-center justify-center gap-0.5 transition-all`}>
 <span className={`text-xs font-bold ${isT ? 'text-slate-900' : dayColor}`}>{format(day, 'd')}</span>
 {dotEl}
 {info && selectedEmployee === 'all' && (
 <span className="text-[11px] font-medium text-slate-400">{info.count}/{info.total}</span>
 )}
 </div>
 );
 })}
 </div>

 {/* Legend */}
 <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
 {Object.entries(STATUS_CONFIG).slice(0, 5).map(([key, val]) => (
 <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
 <span className={`w-2 h-2 rounded-full ${val.dot}`} />
 {val.label}
 </span>
 ))}
 <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
 <span className="w-2 h-2 rounded-full bg-slate-900 ring-1 ring-slate-400" />
 Today
 </span>
 </div>
 </div>

 {/* Monthly Summary Table (admin view) */}
 {selectedEmployee === 'all' && empSummaries.length > 0 && (
 <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
 <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
 <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Monthly Summary — {format(currentDate, 'MMMM yyyy')}</h3>
 </div>
 <div className="divide-y divide-slate-50">
 {empSummaries.map(es => (
 <div key={es.emp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
 <div className="w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center text-white text-[11px] font-medium shrink-0">
 {getInitials(es.emp.name)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-bold text-slate-800 truncate">{es.emp.name}</p>
 <div className="flex gap-3 mt-0.5">
 <span className="text-xs font-medium text-emerald-600">{es.present} present</span>
 <span className="text-xs font-medium text-red-500">{es.absent} absent</span>
 <span className="text-xs font-medium text-slate-800">{es.hours}h worked</span>
 </div>
 </div>
 {/* Attendance % bar */}
 <div className="w-20 shrink-0 text-right">
 <p className={`text-sm font-bold ${es.attendance >= 80 ? 'text-emerald-600' : es.attendance >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
 {es.attendance}%
 </p>
 <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
 <div className={`h-full rounded-full transition-all ${es.attendance >= 80 ? 'bg-emerald-500' : es.attendance >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
 style={{ width: `${es.attendance}%` }} />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Single employee monthly detail */}
 {selectedEmployee !== 'all' && (
 <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
 <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
 <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
 {getEmpName(targetEmpId)} — {format(currentDate, 'MMMM yyyy')}
 </h3>
 </div>
 {empMonthRecs.length === 0 ? (
 <div className="py-8 text-center text-sm text-slate-400 font-medium">No records</div>
 ) : (
 <div className="divide-y divide-slate-50">
 {empMonthRecs.sort((a, b) => a.date.localeCompare(b.date)).map(r => {
 const s = sc(r.status);
 return (
 <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
 <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
 <span className={`w-3 h-3 rounded-full ${s.dot} flex items-center justify-center`}>
 <span className="text-white text-[11px] font-medium">{s.icon}</span>
 </span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-bold text-slate-700">{safeFmt(r.date + 'T00:00:00', 'EEE, dd MMM')}</p>
 {r.status !== 'absent' ? (
 <p className="text-[11px] text-slate-400">
 {safeFmt(r.checkIn, 'hh:mm a')} → {safeFmt(r.checkOut, 'hh:mm a')}
 </p>
 ) : (
 <p className="text-[11px] text-red-400">Absent</p>
 )}
 </div>
 <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${s.bg} ${s.text}`}>{s.label}</span>
 {r.totalHours > 0 && (
 <span className="text-xs font-semibold text-slate-700 w-12 text-right">{r.totalHours.toFixed(1)}h</span>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 );
 })()}
 </div>
 );
}
