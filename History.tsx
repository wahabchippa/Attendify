import { useState, useMemo } from 'react';
import { Employee } from '../types';
import { EMPLOYEES, ATTENDANCE_EMPLOYEES, getAttendanceRecords } from '../store';
import { format, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

interface HistoryProps {
  currentUser: Employee;
}

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

  const allRecords = useMemo(() => getAttendanceRecords(), []);

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

  const getStatusStyle = (status: string) => {
    const styles: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      late: 'bg-amber-50 text-amber-700 border-amber-200',
      absent: 'bg-red-50 text-red-700 border-red-200',
      'half-day': 'bg-orange-50 text-orange-700 border-orange-200',
      'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getEmployeeName = (id: string) => EMPLOYEES.find(e => e.id === id)?.name || 'Unknown';
  const getEmployeeAvatar = (id: string) => EMPLOYEES.find(e => e.id === id)?.avatar || '?';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Attendance History</h2>
        <p className="text-slate-500 text-sm mt-1">View and filter attendance records</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Employee Filter */}
          {isAdmin && (
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {ATTENDANCE_EMPLOYEES.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}

          {/* Date Range */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {[
              { key: '7d', label: '7 Days' },
              { key: '30d', label: '30 Days' },
              { key: 'month', label: 'Month' },
              { key: 'all', label: 'All' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setDateRange(item.key as typeof dateRange)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  dateRange === item.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {dateRange === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* View Mode */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          { label: 'Present', value: stats.present, color: 'text-emerald-600' },
          { label: 'Late', value: stats.late, color: 'text-amber-600' },
          { label: 'Absent', value: stats.absent, color: 'text-red-600' },
          { label: 'Half Day', value: stats.halfDay, color: 'text-orange-600' },
          { label: 'WFH', value: stats.wfh, color: 'text-blue-600' },
          { label: 'Hours', value: stats.totalHours, color: 'text-slate-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-7 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-medium uppercase">
            {isAdmin && <span>Employee</span>}
            <span>Date</span>
            <span>Status</span>
            <span>Check In</span>
            <span>Check Out</span>
            <span>Hours</span>
            <span>WiFi</span>
          </div>

          {/* Records */}
          <div className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No records found
              </div>
            ) : (
              filteredRecords.map(record => (
                <div
                  key={record.id}
                  className="grid grid-cols-2 md:grid-cols-7 gap-2 p-4 hover:bg-slate-50 transition-colors items-center"
                >
                  {isAdmin && (
                    <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-semibold text-slate-600">
                        {getEmployeeAvatar(record.employeeId)}
                      </div>
                      <span className="text-slate-700 text-sm truncate">{getEmployeeName(record.employeeId)}</span>
                    </div>
                  )}
                  <div className="text-slate-600 text-sm">
                    {format(parseISO(record.date), 'dd MMM, EEE')}
                  </div>
                  <div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusStyle(record.status)}`}>
                      {record.status === 'work-from-home' ? 'WFH' : record.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-slate-700 text-sm font-mono">
                    {record.checkIn ? format(parseISO(record.checkIn), 'hh:mm a') : '—'}
                  </div>
                  <div className="text-slate-700 text-sm font-mono">
                    {record.checkOut ? format(parseISO(record.checkOut), 'hh:mm a') : '—'}
                  </div>
                  <div className="text-blue-600 text-sm font-mono font-medium">
                    {record.totalHours > 0 ? `${record.totalHours.toFixed(1)}h` : '—'}
                  </div>
                  <div className="text-sm">
                    {record.wifiVerified ? (
                      <span className="text-emerald-600 text-xs">✓ Verified</span>
                    ) : (
                      <span className="text-slate-400 text-xs">WFH</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-slate-400 text-xs font-medium py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {calendarDays.map(day => {
              const record = getCalendarDayStatus(day);
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              let bgColor = 'bg-slate-50';
              let textColor = 'text-slate-600';
              if (record) {
                switch (record.status) {
                  case 'present': bgColor = 'bg-emerald-100'; textColor = 'text-emerald-700'; break;
                  case 'late': bgColor = 'bg-amber-100'; textColor = 'text-amber-700'; break;
                  case 'absent': bgColor = 'bg-red-100'; textColor = 'text-red-700'; break;
                  case 'half-day': bgColor = 'bg-orange-100'; textColor = 'text-orange-700'; break;
                  case 'work-from-home': bgColor = 'bg-blue-100'; textColor = 'text-blue-700'; break;
                }
              } else if (isWeekend) {
                bgColor = 'bg-slate-100/50';
                textColor = 'text-slate-300';
              }

              return (
                <div
                  key={day.toISOString()}
                  className={`aspect-square rounded-lg ${bgColor} ${
                    isToday ? 'ring-2 ring-blue-500' : ''
                  } flex flex-col items-center justify-center text-xs transition-all`}
                >
                  <span className={`font-medium ${textColor}`}>
                    {format(day, 'd')}
                  </span>
                  {record && (
                    <span className="text-[9px] mt-0.5">
                      {record.status === 'present' ? '✓' : record.status === 'late' ? 'L' : record.status === 'absent' ? '✕' : record.status === 'work-from-home' ? 'W' : 'H'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 justify-center">
            {[
              { label: 'Present', color: 'bg-emerald-100' },
              { label: 'Late', color: 'bg-amber-100' },
              { label: 'Absent', color: 'bg-red-100' },
              { label: 'Half Day', color: 'bg-orange-100' },
              { label: 'WFH', color: 'bg-blue-100' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${item.color}`} />
                <span className="text-slate-500 text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
