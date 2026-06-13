import { useMemo, useState } from 'react';
import { Employee } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getEmployeeTiming, getLocationFromIP } from '../store';
import { generateEmployeeSummary } from '../aiSearch';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';

interface AnalyticsProps {
  currentUser: Employee;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function Analytics({ currentUser }: AnalyticsProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [selectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const allRecords = useMemo(() => getAttendanceRecords(), []);

  const employeesToShow = isAdmin ? getAttendanceEmployees() : getAttendanceEmployees().filter(e => e.id === currentUser.id);

  const summaries = useMemo(() => {
    return employeesToShow.map(emp =>
      generateEmployeeSummary(emp.id, allRecords, selectedMonth.year, selectedMonth.month)
    );
  }, [allRecords, selectedMonth, employeesToShow]);

  const employeeChartData = useMemo(() => {
    return summaries.map(s => ({
      name: s.employeeName.split(' ')[0],
      Present: s.presentDays - s.lateDays,
      Late: s.lateDays,
      Absent: s.absentDays,
    }));
  }, [summaries]);

  const hoursChartData = useMemo(() => {
    return summaries.map(s => ({
      name: s.employeeName.split(' ')[0],
      'Total Hours': s.totalHours,
      'Avg/Day': s.avgHoursPerDay,
    }));
  }, [summaries]);

  const pieData = useMemo(() => {
    const totalPresent = summaries.reduce((sum, s) => sum + s.presentDays - s.lateDays, 0);
    const totalLate = summaries.reduce((sum, s) => sum + s.lateDays, 0);
    const totalAbsent = summaries.reduce((sum, s) => sum + s.absentDays, 0);
    return [
      { name: 'On Time', value: totalPresent },
      { name: 'Late', value: totalLate },
      { name: 'Absent', value: totalAbsent },
    ].filter(d => d.value > 0);
  }, [summaries]);

  const trendData = useMemo(() => {
    const days: { date: string; present: number; late: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayRecords = allRecords.filter(r => r.date === dateStr);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      days.push({
        date: format(d, 'dd'),
        present: dayRecords.filter(r => r.status === 'present' || r.status === 'work-from-home').length,
        late: dayRecords.filter(r => r.status === 'late').length,
      });
    }
    return days;
  }, [allRecords]);

  const ranking = useMemo(() => {
    return [...summaries].sort((a, b) => b.onTimePercentage - a.onTimePercentage);
  }, [summaries]);

  const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Analytics & Reports</h2>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(selectedMonth.year, selectedMonth.month - 1), 'MMMM yyyy')} Overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Avg On-Time',
            value: `${summaries.length > 0 ? Math.round(summaries.reduce((s, a) => s + a.onTimePercentage, 0) / summaries.length) : 0}%`,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Total Hours',
            value: `${Math.round(summaries.reduce((s, a) => s + a.totalHours, 0))}h`,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            label: 'Late Entries',
            value: summaries.reduce((s, a) => s + a.lateDays, 0),
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            label: 'Absent Days',
            value: summaries.reduce((s, a) => s + a.absentDays, 0),
            color: 'text-red-600',
            bg: 'bg-red-50',
          },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-slate-100`}>
            <p className={`text-2xl font-semibold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-slate-500 text-xs mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium text-sm mb-4">Overview by Employee</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium text-sm mb-4">Status Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium text-sm mb-4">30-Day Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="Present" />
                <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Late" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium text-sm mb-4">Hours Worked</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} width={60} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="Total Hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* OT Details */}
      {isAdmin && (() => {
        const otData = getAttendanceEmployees().map(emp => {
          const t = getEmployeeTiming(emp.id);
          const recs = allRecords.filter(r => r.employeeId === emp.id && r.totalHours > 0);
          const otRecs = recs.filter(r => r.totalHours > t.minHoursForFullDay || r.notes?.includes('SUNDAY'));
          const sundayOT = otRecs.filter(r => r.notes?.includes('SUNDAY')).reduce((s, r) => s + r.totalHours, 0);
          const regularOT = otRecs.filter(r => !r.notes?.includes('SUNDAY')).reduce((s, r) => s + Math.max(0, r.totalHours - t.minHoursForFullDay), 0);
          return { emp, otRecs, sundayOT: Math.round(sundayOT * 100) / 100, regularOT: Math.round(regularOT * 100) / 100, totalOT: Math.round((sundayOT + regularOT) * 100) / 100 };
        }).filter(d => d.totalOT > 0);

        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-slate-700 font-medium text-sm mb-4">Overtime Details</h3>
            {otData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">No overtime recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {otData.map(({ emp, otRecs, sundayOT, regularOT, totalOT }) => (
                  <div key={emp.id} className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-600">{emp.avatar}</div>
                        <div>
                          <p className="text-slate-800 font-medium text-sm">{emp.name}</p>
                          <p className="text-slate-400 text-xs">{otRecs.length} OT days</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-purple-600 font-bold text-lg">+{totalOT}h</p>
                        <div className="flex gap-2 mt-0.5">
                          {sundayOT > 0 && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-200">Sun: +{sundayOT}h</span>}
                          {regularOT > 0 && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200">Regular: +{regularOT}h</span>}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {otRecs.slice(0, 5).map(r => {
                        const isSun = r.notes?.includes('SUNDAY');
                        const ot = isSun ? r.totalHours : Math.round((r.totalHours - getEmployeeTiming(emp.id).minHoursForFullDay) * 100) / 100;
                        return (
                          <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2">
                            <span className="text-slate-600">{format(new Date(r.date), 'dd MMM (EEE)')}</span>
                            <span className="text-slate-500">{getLocationFromIP(r.ipAddress)}</span>
                            <span className="text-slate-500">{r.totalHours}h worked</span>
                            <span className={`font-medium ${isSun ? 'text-purple-600' : 'text-blue-600'}`}>+{ot}h {isSun ? 'Sunday' : 'OT'}</span>
                          </div>
                        );
                      })}
                      {otRecs.length > 5 && <p className="text-slate-400 text-xs text-center">+{otRecs.length - 5} more</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
