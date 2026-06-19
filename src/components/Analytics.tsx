// src/components/Analytics.tsx

import { useMemo, useState, useEffect } from 'react';
import { Employee } from '../types';
import { getAttendanceEmployees, getAttendanceRecords, getEmployeeTiming, getLocationFromIP } from '../store';
import { generateEmployeeSummary } from '../aiSearch';
import { format, subDays } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts';

interface AnalyticsProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

// Royal Blue theme colors for charts
const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#2563EB', '#8b5cf6'];

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '10px 14px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
  fontSize: '12px',
  fontWeight: '600',
};

export default function Analytics({ currentUser }: AnalyticsProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [mounted, setMounted] = useState(false);

  // ✅ Fix: Month selector with navigation
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const allRecords = useMemo(() => getAttendanceRecords(), []);

  // ✅ Fix: memoized
  const employeesToShow = useMemo(() =>
    isAdmin
      ? getAttendanceEmployees()
      : getAttendanceEmployees().filter(e => e.id === currentUser.id),
    [isAdmin, currentUser.id]
  );

  const summaries = useMemo(() =>
    employeesToShow.map(emp =>
      generateEmployeeSummary(emp.id, allRecords, selectedMonth.year, selectedMonth.month)
    ),
    [allRecords, selectedMonth, employeesToShow]
  );

  const employeeChartData = useMemo(() =>
    summaries.map(s => ({
      name: s.employeeName.split(' ')[0],
      Present: s.presentDays - s.lateDays,
      Late: s.lateDays,
      Absent: s.absentDays,
    })),
    [summaries]
  );

  const hoursChartData = useMemo(() =>
    summaries.map(s => ({
      name: s.employeeName.split(' ')[0],
      'Total Hours': parseFloat(s.totalHours.toFixed(1)),
      'Avg/Day': parseFloat(s.avgHoursPerDay.toFixed(1)),
    })),
    [summaries]
  );

  const pieData = useMemo(() => {
    const totalPresent = summaries.reduce((sum, s) => sum + s.presentDays - s.lateDays, 0);
    const totalLate = summaries.reduce((sum, s) => sum + s.lateDays, 0);
    const totalAbsent = summaries.reduce((sum, s) => sum + s.absentDays, 0);
    return [
      { name: 'On Time', value: totalPresent },
      { name: 'Late',    value: totalLate },
      { name: 'Absent',  value: totalAbsent },
    ].filter(d => d.value > 0);
  }, [summaries]);

  const trendData = useMemo(() => {
    const days: { date: string; present: number; late: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      // ✅ Fix: Only skip Saturday (Sunday is OT day in this system)
      if (d.getDay() === 6) continue;
      const dayRecords = allRecords.filter(r => r.date === dateStr);
      days.push({
        date: format(d, 'dd'),
        present: dayRecords.filter(r => r.status === 'present' || r.status === 'work-from-home').length,
        late: dayRecords.filter(r => r.status === 'late').length,
      });
    }
    return days;
  }, [allRecords]);

  // ✅ Leaderboard ranking
  const ranking = useMemo(() =>
    [...summaries].sort((a, b) => b.onTimePercentage - a.onTimePercentage),
    [summaries]
  );

  // ✅ OT Data — extracted from IIFE
  const otData = useMemo(() => {
    return getAttendanceEmployees().map(emp => {
      const t = getEmployeeTiming(emp.id);
      const recs = allRecords.filter(r => r.employeeId === emp.id && r.totalHours > 0);
      const otRecs = recs.filter(r => r.totalHours > t.minHoursForFullDay || r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY'));
      const sundayOT = otRecs.filter(r => r.notes?.includes('SUNDAY')).reduce((s, r) => s + r.totalHours, 0);
      const holidayOT = otRecs.filter(r => r.notes?.includes('HOLIDAY')).reduce((s, r) => s + r.totalHours, 0);
      const regularOT = otRecs
        .filter(r => !r.notes?.includes('SUNDAY') && !r.notes?.includes('HOLIDAY'))
        .reduce((s, r) => s + Math.max(0, r.totalHours - t.minHoursForFullDay), 0);
      return {
        emp,
        otRecs,
        sundayOT: Math.round(sundayOT * 100) / 100,
        holidayOT: Math.round(holidayOT * 100) / 100,
        regularOT: Math.round(regularOT * 100) / 100,
        totalOT: Math.round((sundayOT + holidayOT + regularOT) * 100) / 100,
      };
    }).filter(d => d.totalOT > 0);
  }, [allRecords]);

  const navigateMonth = (dir: -1 | 1) => {
    setSelectedMonth(prev => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m > 12) { m = 1; y++; }
      if (m < 1) { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  const kpis = [
    {
      label: 'Avg On-Time',
      value: `${summaries.length > 0 ? Math.round(summaries.reduce((s, a) => s + a.onTimePercentage, 0) / summaries.length) : 0}%`,
      color: 'text-[#1E40AF]',
      bg: 'from-blue-50 to-indigo-50',
      border: 'border-blue-200',
      icon: (
        <svg className="w-5 h-5 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Hours',
      value: `${Math.round(summaries.reduce((s, a) => s + a.totalHours, 0))}h`,
      color: 'text-emerald-600',
      bg: 'from-emerald-50 to-green-50',
      border: 'border-emerald-200',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Late Entries',
      value: summaries.reduce((s, a) => s + a.lateDays, 0),
      color: 'text-amber-600',
      bg: 'from-amber-50 to-yellow-50',
      border: 'border-amber-200',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
      ),
    },
    {
      label: 'Absent Days',
      value: summaries.reduce((s, a) => s + a.absentDays, 0),
      color: 'text-red-600',
      bg: 'from-red-50 to-rose-50',
      border: 'border-red-200',
      icon: (
        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  // Shared chart card wrapper
  const ChartCard = ({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) => (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        {icon && <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">{icon}</div>}
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );

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
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Analytics & Reports</h2>
              <p className="text-blue-200 text-xs font-bold">Performance overview & insights</p>
            </div>
          </div>

          {/* ✅ Month Navigator */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-2 border border-white/10">
            <button
              onClick={() => navigateMonth(-1)}
              className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-white text-xs font-black px-1 min-w-[80px] text-center">
              {format(new Date(selectedMonth.year, selectedMonth.month - 1), 'MMM yyyy')}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`bg-gradient-to-br ${kpi.bg} rounded-3xl p-5 border ${kpi.border} shadow-sm hover:shadow-md transition-all`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                {kpi.icon}
              </div>
            </div>
            <p className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ===== LEADERBOARD ===== */}
      {isAdmin && ranking.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span>🏆</span> Performance Leaderboard
              <span className="ml-auto text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {format(new Date(selectedMonth.year, selectedMonth.month - 1), 'MMMM yyyy')}
              </span>
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {ranking.map((s, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const barColor = idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-blue-500' : idx === 2 ? 'bg-amber-500' : 'bg-slate-300';
              return (
                <div key={s.employeeId} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${idx === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-100'}`}>
                  <span className="text-lg w-7 text-center shrink-0">{medals[idx] || `${idx + 1}`}</span>
                  <div className="w-9 h-9 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black shadow-md shadow-blue-500/20 shrink-0">
                    {getInitials(s.employeeName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-bold truncate">{s.employeeName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${s.onTimePercentage}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-slate-500 shrink-0">{s.onTimePercentage}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[#1E40AF] font-black text-sm">{s.totalHours.toFixed(0)}h</p>
                    <p className="text-slate-400 text-[10px] font-bold">{s.presentDays}d present</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CHARTS ROW 1 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Overview by Employee"
          icon={
            <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employeeChartData} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(30,64,175,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              <Bar dataKey="Present" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Late" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Absent" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Status Distribution"
          icon={
            <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
            </svg>
          }
        >
          {pieData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-300 text-sm font-bold">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ===== CHARTS ROW 2 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="30-Day Attendance Trend"
          icon={
            <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2.5} dot={false} name="Present" activeDot={{ r: 5, fill: '#10b981' }} />
              <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2.5} dot={false} name="Late" activeDot={{ r: 5, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Hours Worked by Employee"
          icon={
            <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hoursChartData} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} width={55} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
              <Bar dataKey="Total Hours" fill="#2563EB" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ===== OVERTIME DETAILS (Admin) ===== */}
      {isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-indigo-50">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span>⚡</span> Overtime Details
              {otData.length > 0 && (
                <span className="ml-auto bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {otData.length} employees
                </span>
              )}
            </h3>
          </div>

          <div className="p-4">
            {otData.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-bold text-sm">No overtime recorded</p>
                <p className="text-slate-300 text-xs mt-1">Overtime will appear here when logged</p>
              </div>
            ) : (
              <div className="space-y-4">
                {otData.map(({ emp, otRecs, sundayOT, holidayOT, regularOT, totalOT }) => (
                  <div key={emp.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-purple-200 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-md shadow-purple-500/20">
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <p className="text-slate-800 font-bold text-sm">{emp.name}</p>
                          <p className="text-slate-400 text-[10px] font-bold">{otRecs.length} OT session{otRecs.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-600 font-black text-xl">+{totalOT}h</p>
                        <div className="flex flex-wrap gap-1.5 mt-1 justify-end">
                          {sundayOT > 0 && (
                            <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg border border-purple-200 font-bold">
                              Sun: +{sundayOT}h
                            </span>
                          )}
                          {holidayOT > 0 && (
                            <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-lg border border-pink-200 font-bold">
                              Holiday: +{holidayOT}h
                            </span>
                          )}
                          {regularOT > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-200 font-bold">
                              Regular: +{regularOT}h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {otRecs.slice(0, 5).map(r => {
                        const isSun = r.notes?.includes('SUNDAY');
                        const isHol = r.notes?.includes('HOLIDAY');
                        const ot = (isSun || isHol)
                          ? r.totalHours
                          : Math.round((r.totalHours - getEmployeeTiming(emp.id).minHoursForFullDay) * 100) / 100;
                        return (
                          <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-xl px-3.5 py-2.5 border border-slate-100">
                            <span className="text-slate-600 font-medium">{format(new Date(r.date), 'dd MMM (EEE)')}</span>
                            <span className="text-slate-400 font-medium hidden sm:block">{getLocationFromIP(r.ipAddress)}</span>
                            <span className="text-slate-500 font-medium">{r.totalHours.toFixed(1)}h worked</span>
                            <span className={`font-black ${isSun ? 'text-purple-600' : isHol ? 'text-pink-600' : 'text-blue-600'}`}>
                              +{ot}h {isSun ? '🌙' : isHol ? '🎉' : 'OT'}
                            </span>
                          </div>
                        );
                      })}
                      {otRecs.length > 5 && (
                        <p className="text-slate-400 text-xs text-center font-bold py-1">
                          +{otRecs.length - 5} more sessions
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}