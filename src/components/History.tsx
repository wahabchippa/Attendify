// src/components/History.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getLocationFromIP, syncAll } from '../store';
import { format, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface HistoryProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export default function History({ currentUser }: HistoryProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    isAdmin ? 'all' : currentUser.id
  );
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'month' | 'all'>('30d');
  const [refreshKey, setRefreshKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  const allRecords = useMemo(() => getAttendanceRecords(), [refreshKey]);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    syncAll().then(() => setRefreshKey(k => k + 1));
    const handler = () => { syncAll().then(() => setRefreshKey(k => k + 1)); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const filteredRecords = useMemo(() => {
    let records = allRecords;
    if (selectedEmployee !== 'all') {
      records = records.filter(r => r.employeeId === selectedEmployee);
    }
    const now = new Date();
    if (dateRange === '7d') {
      const cutoff = subDays(now, 7).toISOString().split('T')[0];
      records = records.filter(r => r.date >= cutoff);
    } else if (dateRange === '30d') {
      const cutoff = subDays(now, 30).toISOString().split('T')[0];
      records = records.filter(r => r.date >= cutoff);
    } else if (dateRange === 'month') {
      records = records.filter(r => r.date.startsWith(selectedMonth));
    }
    return records.sort((a, b) => b.date.localeCompare(a.date) || a.employeeId.localeCompare(b.employeeId));
  }, [allRecords, selectedEmployee, dateRange, selectedMonth]);

  const statusStyle = (status: string) => {
    const styles: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      late: 'bg-amber-50 text-amber-700 border-amber-200',
      absent: 'bg-red-50 text-red-700 border-red-200',
      'half-day': 'bg-orange-50 text-orange-700 border-orange-200',
      'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
      'holiday-ot': 'bg-purple-50 text-purple-700 border-purple-200',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      present: 'Present',
      late: 'Late',
      absent: 'Absent',
      'half-day': 'Half Day',
      'work-from-home': 'WFH',
      'holiday-ot': 'Holiday OT',
    };
    return labels[status] || status.toUpperCase();
  };

  const getEmployeeName = (id: string) =>
    getEmployees().find(e => e.id === id)?.name || 'Unknown';

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  const getCalendarDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const empId = selectedEmployee === 'all' ? currentUser.id : selectedEmployee;
    return filteredRecords.find(r => r.date === dateStr && r.employeeId === empId);
  };

  const stats = useMemo(() => {
    const present = filteredRecords.filter(r => r.status === 'present').length;
    const late = filteredRecords.filter(r => r.status === 'late').length;
    const absent = filteredRecords.filter(r => r.status === 'absent').length;
    const halfDay = filteredRecords.filter(r => r.status === 'half-day').length;
    const wfh = filteredRecords.filter(r => r.status === 'work-from-home').length;
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
    return { present, late, absent, halfDay, wfh, totalHours: Math.round(totalHours * 10) / 10 };
  }, [filteredRecords]);

  const downloadCSV = () => {
    const emps = getEmployees();
    const header = ['Date', 'Employee', 'Status', 'Check In', 'Check Out', 'Time in Office', 'Location'];
    const rows = filteredRecords.map(r => {
      const emp = emps.find(e => e.id === r.employeeId);
      return [
        r.date,
        emp?.name || r.employeeId,
        r.status.toUpperCase(),
        r.checkIn ? format(parseISO(r.checkIn), 'hh:mm a') : '',
        r.checkOut ? format(parseISO(r.checkOut), 'hh:mm a') : '',
        r.totalHours > 0 ? `${r.totalHours}h` : '',
        getLocationFromIP(r.ipAddress),
      ].map(v => `"${v}"`).join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendify_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeFormat = (dateStr: string | null | undefined, fmt: string) => {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), fmt); } catch { return '—'; }
  };

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 md:p-6 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Attendance History</h2>
              <p className="text-blue-200 text-xs font-bold">View & filter records</p>
            </div>
          </div>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-2xl text-white text-xs font-bold border border-white/10 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ===== FILTERS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Employee Filter */}
          {isAdmin && (
            <div className="relative">
              <select
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl pl-4 pr-9 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all cursor-pointer"
              >
                <option value="all">👥 All Employees</option>
                {getAttendanceEmployees().map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          {/* Date Range Tabs */}
          <div className="flex rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
            {[
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: 'month', label: 'Month' },
              { key: 'all', label: 'All' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setDateRange(item.key as typeof dateRange)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  dateRange === item.key
                    ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Month Picker */}
          {dateRange === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all"
            />
          )}

          {/* View Mode Toggle */}
          <div className="ml-auto flex rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                viewMode === 'calendar'
                  ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* ===== STATS GRID ===== */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Present', value: stats.present, color: 'text-emerald-600', bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', icon: '✓' },
          { label: 'Late', value: stats.late, color: 'text-amber-600', bg: 'from-amber-50 to-yellow-50', border: 'border-amber-200', icon: '⚠' },
          { label: 'Absent', value: stats.absent, color: 'text-red-600', bg: 'from-red-50 to-rose-50', border: 'border-red-200', icon: '✕' },
          { label: 'Half Day', value: stats.halfDay, color: 'text-orange-600', bg: 'from-orange-50 to-amber-50', border: 'border-orange-200', icon: '½' },
          { label: 'WFH', value: stats.wfh, color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', icon: '🏠' },
          { label: 'Hours', value: `${stats.totalHours}h`, color: 'text-slate-700', bg: 'from-slate-50 to-slate-100', border: 'border-slate-200', icon: '⏱' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-3.5 text-center border ${s.border} shadow-sm`}>
            <p className="text-[10px] font-bold text-slate-400 mb-1">{s.icon}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ===== LIST VIEW ===== */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">

          {/* Table Header — Desktop */}
          <div className="hidden md:grid gap-3 px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-100">
            <div className={`grid gap-4 text-slate-400 text-[10px] font-black uppercase tracking-widest ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
              {isAdmin && <span>Employee</span>}
              <span>Date</span>
              <span>Status</span>
              <span>Check In</span>
              <span>Check Out</span>
              <span>Hours</span>
              <span>Location</span>
            </div>
          </div>

          {/* Records */}
          <div className="divide-y divide-slate-50">
            {filteredRecords.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-bold text-sm">No records found</p>
                <p className="text-slate-300 text-xs mt-1">Try changing the date range or filters</p>
              </div>
            ) : (
              filteredRecords.map((record, idx) => (
                <div
                  key={record.id}
                  className="px-5 py-4 hover:bg-slate-50/80 transition-all group"
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  {/* Mobile View */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black">
                            {getInitials(getEmployeeName(record.employeeId))}
                          </div>
                        )}
                        <div>
                          {isAdmin && <p className="text-slate-800 text-sm font-bold">{getEmployeeName(record.employeeId)}</p>}
                          <p className="text-slate-500 text-xs font-medium">{safeFormat(record.date, 'dd MMM yyyy, EEEE')}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${statusStyle(record.status)}`}>
                        {statusLabel(record.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium pl-1">
                      <span className="font-mono">In: <span className="text-slate-700 font-bold">{safeFormat(record.checkIn, 'hh:mm a')}</span></span>
                      <span className="font-mono">Out: <span className="text-slate-700 font-bold">{safeFormat(record.checkOut, 'hh:mm a')}</span></span>
                      {record.totalHours > 0 && <span className="text-[#1E40AF] font-bold">{record.totalHours.toFixed(1)}h</span>}
                      <span className="text-[#1E40AF] font-medium ml-auto">{getLocationFromIP(record.ipAddress)}</span>
                    </div>
                    {record.notes?.includes('OUTSIDE OFFICE') && (
                      <div className="text-[10px] text-red-600 font-black bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 animate-pulse">
                        ⚠️ Outside Office — Unverified
                      </div>
                    )}
                  </div>

                  {/* Desktop View */}
                  <div className={`hidden md:grid gap-4 items-center ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
                    {isAdmin && (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 shadow-md shadow-blue-500/20">
                          {getInitials(getEmployeeName(record.employeeId))}
                        </div>
                        <span className="text-slate-700 text-sm font-semibold truncate">{getEmployeeName(record.employeeId)}</span>
                      </div>
                    )}
                    <div className="text-slate-600 text-sm font-medium">
                      {safeFormat(record.date, 'dd MMM, EEE')}
                    </div>
                    <div>
                      <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black border ${statusStyle(record.status)}`}>
                        {statusLabel(record.status)}
                      </span>
                    </div>
                    <div className="text-slate-700 text-sm font-mono font-medium">
                      {safeFormat(record.checkIn, 'hh:mm a')}
                    </div>
                    <div className="text-slate-700 text-sm font-mono font-medium">
                      {safeFormat(record.checkOut, 'hh:mm a')}
                    </div>
                    <div className="text-[#1E40AF] text-sm font-black font-mono">
                      {record.totalHours > 0 ? `${record.totalHours.toFixed(1)}h` : '—'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#1E40AF] text-xs font-bold">{getLocationFromIP(record.ipAddress)}</span>
                      {record.notes?.includes('OUTSIDE OFFICE') && (
                        <span className="text-red-500 text-[10px] font-black animate-pulse">⚠️</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer count */}
          {filteredRecords.length > 0 && (
            <div className="px-6 py-3 bg-gradient-to-r from-slate-50 to-blue-50/20 border-t border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400">
                Showing <span className="text-[#1E40AF]">{filteredRecords.length}</span> records
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ===== CALENDAR VIEW ===== */
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">

          {/* Month Nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => {
                const [y, m] = selectedMonth.split('-').map(Number);
                const prev = new Date(y, m - 2);
                setSelectedMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                setDateRange('month');
              }}
              className="w-9 h-9 bg-slate-100 hover:bg-blue-50 hover:text-[#1E40AF] rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-black text-slate-800">
              {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
            </h3>
            <button
              onClick={() => {
                const [y, m] = selectedMonth.split('-').map(Number);
                const next = new Date(y, m);
                setSelectedMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                setDateRange('month');
              }}
              className="w-9 h-9 bg-slate-100 hover:bg-blue-50 hover:text-[#1E40AF] rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-slate-400 text-[10px] font-black uppercase tracking-wider py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {calendarDays.map(day => {
              const record = getCalendarDayStatus(day);
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              let bgColor = 'bg-slate-50 hover:bg-slate-100';
              let textColor = 'text-slate-500';
              let dotColor = '';

              if (record) {
                const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
                  present:          { bg: 'bg-emerald-100 hover:bg-emerald-200', text: 'text-emerald-800', dot: 'bg-emerald-500' },
                  late:             { bg: 'bg-amber-100 hover:bg-amber-200',     text: 'text-amber-800',   dot: 'bg-amber-500' },
                  absent:           { bg: 'bg-red-100 hover:bg-red-200',         text: 'text-red-800',     dot: 'bg-red-500' },
                  'half-day':       { bg: 'bg-orange-100 hover:bg-orange-200',   text: 'text-orange-800',  dot: 'bg-orange-500' },
                  'work-from-home': { bg: 'bg-blue-100 hover:bg-blue-200',       text: 'text-blue-800',    dot: 'bg-blue-500' },
                  'holiday-ot':     { bg: 'bg-purple-100 hover:bg-purple-200',   text: 'text-purple-800',  dot: 'bg-purple-500' },
                };
                const c = colorMap[record.status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
                bgColor = c.bg;
                textColor = c.text;
                dotColor = c.dot;
              } else if (isWeekend) {
                bgColor = 'bg-slate-50';
                textColor = 'text-slate-300';
              }

              const statusIcons: Record<string, string> = {
                present: '✓', late: 'L', absent: '✕',
                'half-day': '½', 'work-from-home': 'W', 'holiday-ot': '★',
              };

              return (
                <div
                  key={day.toISOString()}
                  title={record ? `${statusLabel(record.status)} — ${record.totalHours > 0 ? record.totalHours.toFixed(1) + 'h' : ''}` : ''}
                  className={`aspect-square rounded-2xl ${bgColor} ${
                    isToday ? 'ring-2 ring-[#1E40AF] ring-offset-1' : ''
                  } flex flex-col items-center justify-center text-xs transition-all cursor-default`}
                >
                  <span className={`font-black text-sm leading-none ${textColor} ${isToday ? 'text-[#1E40AF]' : ''}`}>
                    {format(day, 'd')}
                  </span>
                  {record && (
                    <span className={`text-[9px] font-black mt-1 ${textColor}`}>
                      {statusIcons[record.status] || '•'}
                    </span>
                  )}
                  {!record && dotColor && (
                    <div className={`w-1 h-1 rounded-full ${dotColor} mt-1`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-slate-100 justify-center">
            {[
              { label: 'Present', color: 'bg-emerald-400' },
              { label: 'Late',    color: 'bg-amber-400' },
              { label: 'Absent',  color: 'bg-red-400' },
              { label: 'Half Day',color: 'bg-orange-400' },
              { label: 'WFH',     color: 'bg-blue-400' },
              { label: 'Holiday OT', color: 'bg-purple-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                <span className="text-slate-500 text-[10px] font-bold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}