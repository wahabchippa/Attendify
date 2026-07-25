// src/components/SalaryCalculator.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee, SalaryConfig, MonthlySalaryReport } from '../types';
import {
  getEmployees, getAttendanceEmployees, getAttendanceRecords,
  getEmployeeTiming, getSalaryConfig, saveSalaryConfig,
  getAllSalaryConfigs, getPKTDate, isHoliday,
} from '../store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';

interface SalaryCalculatorProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const formatPKR = (amount: number) =>
  `PKR ${Math.round(amount).toLocaleString('en-PK')}`;

export default function SalaryCalculator({ currentUser }: SalaryCalculatorProps) {
  const [mounted, setMounted]             = useState(false);
  const [activeTab, setActiveTab]         = useState<'reports' | 'config'>('reports');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = getPKTDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [configEmpId, setConfigEmpId]     = useState<string>('');
  const [configForm, setConfigForm]       = useState<SalaryConfig | null>(null);
  const [configSaved, setConfigSaved]     = useState(false);
  const [notification, setNotification]   = useState<{ type: string; message: string } | null>(null);

  const employees = getAttendanceEmployees().filter(emp => {
  // Wahab ki salary sirf Wahab khud dekh sake
  if (emp.id === 'emp-001' && currentUser.id !== 'emp-001') return false;
  return true;
});
const allEmployees = getEmployees();
  const allRecords   = useMemo(() => getAttendanceRecords(), []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const showNotif = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Calculate monthly salary report ──
  const calculateReport = (empId: string, monthStr: string): MonthlySalaryReport => {
    const emp = allEmployees.find(e => e.id === empId);
    const config = getSalaryConfig(empId);
    const timing = getEmployeeTiming(empId);

    const [year, month] = monthStr.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end   = endOfMonth(new Date(year, month - 1));

    // Working days (excluding Saturday, including Sunday as OT)
    const allDays      = eachDayOfInterval({ start, end });
    const workingDays  = allDays.filter(d => d.getDay() !== 6).length; // exclude Saturday

    // Employee records for this month
    const prefix  = monthStr;
    const empRecs = allRecords.filter(r =>
      r.employeeId === empId && r.date.startsWith(prefix)
    );

    // Counts
    const presentDays = empRecs.filter(r =>
      ['present', 'late', 'work-from-home', 'on-leave'].includes(r.status)
    ).length;
    const absentDays  = empRecs.filter(r => r.status === 'absent').length;
    const lateDays    = empRecs.filter(r => r.status === 'late').length;
    const halfDays    = empRecs.filter(r => r.status === 'half-day').length;
    const wfhDays     = empRecs.filter(r => r.status === 'work-from-home').length;
    const leaveDays   = empRecs.filter(r => r.status === 'on-leave').length;

    // Hours
    const totalHoursWorked = empRecs.reduce((s, r) => s + (r.totalHours || 0), 0);

    // OT breakdown
    let regularOtHours = 0;
    let sundayOtHours  = 0;
    let holidayOtHours = 0;

    empRecs.forEach(r => {
      if (r.notes?.includes('SUNDAY OT') || r.notes?.includes('SUNDAY')) {
        sundayOtHours += r.totalHours || 0;
      } else if (r.notes?.includes('HOLIDAY OT') || isHoliday(r.date)) {
        holidayOtHours += r.totalHours || 0;
      } else if (r.totalHours > timing.minHoursForFullDay) {
        regularOtHours += r.totalHours - timing.minHoursForFullDay;
      }
    });

    regularOtHours = Math.round(regularOtHours * 100) / 100;
    sundayOtHours  = Math.round(sundayOtHours * 100) / 100;
    holidayOtHours = Math.round(holidayOtHours * 100) / 100;

    // Deductions
    const lateDeductions      = lateDays * config.lateDeductionPerIncident;
    const absentDeductions    = absentDays * config.absentDeductionPerDay;
    const halfDayDeductions   = halfDays * config.halfDayDeduction;
    const totalDeductions     = lateDeductions + absentDeductions + halfDayDeductions;

    // OT Pay
    const hourlyRate    = config.baseSalary > 0 ? config.baseSalary / (workingDays * timing.minHoursForFullDay) : 0;
    const regularOtPay  = regularOtHours * (config.otRatePerHour || hourlyRate * 1.5);
    const sundayOtPay   = sundayOtHours  * (config.sundayOtRate  || hourlyRate * 2);
    const holidayOtPay  = holidayOtHours * (config.holidayOtRate || hourlyRate * 2);
    const totalOtPay    = regularOtPay + sundayOtPay + holidayOtPay;

    // Final
    const grossPay = config.baseSalary + config.allowances + totalOtPay - totalDeductions;
    const netPay   = grossPay - config.deductions;

    return {
      employeeId:      empId,
      employeeName:    emp?.name || 'Unknown',
      month:           monthStr,
      workingDays,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
      wfhDays,
      leaveDays,
      totalHoursWorked:  Math.round(totalHoursWorked * 100) / 100,
      regularOtHours,
      sundayOtHours,
      holidayOtHours,
      baseSalary:          config.baseSalary,
      lateDeductions:      Math.round(lateDeductions),
      absentDeductions:    Math.round(absentDeductions),
      halfDayDeductions:   Math.round(halfDayDeductions),
      totalDeductions:     Math.round(totalDeductions),
      regularOtPay:        Math.round(regularOtPay),
      sundayOtPay:         Math.round(sundayOtPay),
      holidayOtPay:        Math.round(holidayOtPay),
      totalOtPay:          Math.round(totalOtPay),
      allowances:          config.allowances,
      grossPay:            Math.round(grossPay),
      netPay:              Math.round(netPay),
    };
  };

  // Generate all reports
  const reports = useMemo(() => {
    const emps = selectedEmpId === 'all' ? employees : employees.filter(e => e.id === selectedEmpId);
    return emps.map(emp => calculateReport(emp.id, selectedMonth));
  }, [selectedEmpId, selectedMonth, allRecords]);

  // Team totals
  const teamTotals = useMemo(() => ({
    netPay:      reports.reduce((s, r) => s + r.netPay, 0),
    totalOtPay:  reports.reduce((s, r) => s + r.totalOtPay, 0),
    totalDeductions: reports.reduce((s, r) => s + r.totalDeductions, 0),
    totalHours:  reports.reduce((s, r) => s + r.totalHoursWorked, 0),
  }), [reports]);

  // Load config for editing
  const handleLoadConfig = (empId: string) => {
    setConfigEmpId(empId);
    const config = getSalaryConfig(empId);
    setConfigForm({ ...config });
  };

  const handleSaveConfig = async () => {
    if (!configForm || !configEmpId) return;

    // Auto-calculate per day salary
    const perDay = configForm.baseSalary > 0
      ? Math.round(configForm.baseSalary / 26)
      : 0;

    const updated: SalaryConfig = {
      ...configForm,
      employeeId: configEmpId,
      perDaySalary: perDay,
    };

    await saveSalaryConfig(updated);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
    showNotif('success', `Salary config saved for ${allEmployees.find(e => e.id === configEmpId)?.name}`);
  };

  const handleExportCSV = () => {
    const headers = [
      'Employee', 'Month', 'Working Days', 'Present', 'Absent', 'Late',
      'Half Day', 'WFH', 'Total Hours', 'Regular OT', 'Sunday OT', 'Holiday OT',
      'Base Salary', 'Allowances', 'OT Pay', 'Late Deductions',
      'Absent Deductions', 'Half Day Deductions', 'Total Deductions',
      'Gross Pay', 'Net Pay',
    ];
    const rows = reports.map(r => [
      r.employeeName, r.month, r.workingDays, r.presentDays,
      r.absentDays, r.lateDays, r.halfDays, r.wfhDays,
      r.totalHoursWorked, r.regularOtHours, r.sundayOtHours, r.holidayOtHours,
      r.baseSalary, r.allowances, r.totalOtPay,
      r.lateDeductions, r.absentDeductions, r.halfDayDeductions, r.totalDeductions,
      r.grossPay, r.netPay,
    ].map(v => `"${v}"`).join(','));

    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `salary_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls  = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all";
  const labelCls  = "block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5";

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-bold max-w-[92%] border animate-slide-down ${
          notification.type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-500' : 'bg-red-600/95 text-white border-red-500'
        }`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 rounded-3xl p-5 text-white relative overflow-hidden shadow-xl shadow-emerald-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-teal-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Salary Calculator</h2>
              <p className="text-emerald-100 text-xs font-bold">Monthly payroll & deductions</p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white text-xs font-bold border border-white/10 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-1">
          {[
            { key: 'reports', label: '📊 Reports',      },
            { key: 'config',  label: '⚙️ Salary Config', },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                activeTab === t.key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== REPORTS TAB ===== */}
      {activeTab === 'reports' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
            {/* Month picker */}
            <div>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Employee filter */}
            <div className="relative">
              <select
                value={selectedEmpId}
                onChange={e => setSelectedEmpId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl pl-4 pr-8 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#1E40AF] transition-all cursor-pointer"
              >
                <option value="all">All Employees</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <p className="ml-auto text-[10px] font-bold text-slate-400">
              {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
          </div>

          {/* Team Summary */}
          {selectedEmpId === 'all' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Net Pay',   value: formatPKR(teamTotals.netPay),         color: 'text-emerald-600', bg: 'from-emerald-50 to-green-50',   border: 'border-emerald-200', icon: '💰' },
                { label: 'Total OT Pay',    value: formatPKR(teamTotals.totalOtPay),      color: 'text-purple-600',  bg: 'from-purple-50 to-indigo-50',   border: 'border-purple-200', icon: '⚡' },
                { label: 'Total Deductions',value: formatPKR(teamTotals.totalDeductions), color: 'text-red-600',     bg: 'from-red-50 to-rose-50',        border: 'border-red-200',    icon: '📉' },
                { label: 'Total Hours',     value: `${Math.round(teamTotals.totalHours)}h`, color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50',     border: 'border-blue-200',   icon: '⏱' },
              ].map(s => (
                <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border ${s.border} shadow-sm`}>
                  <p className="text-lg mb-1">{s.icon}</p>
                  <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Individual Reports */}
          <div className="space-y-4">
            {reports.map(report => {
              const emp = allEmployees.find(e => e.id === report.employeeId);
              const hasConfig = getSalaryConfig(report.employeeId).baseSalary > 0;

              return (
                <div key={report.employeeId} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Employee Header */}
                  <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-md">
                          {getInitials(report.employeeName)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">{report.employeeName}</p>
                          <p className="text-[10px] text-slate-400 font-medium capitalize">{emp?.role} · {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</p>
                        </div>
                      </div>
                      {!hasConfig && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-xl border border-amber-200">
                          ⚠️ Config Missing
                        </span>
                      )}
                      {hasConfig && (
                        <div className="text-right">
                          <p className="text-emerald-600 font-black text-lg">{formatPKR(report.netPay)}</p>
                          <p className="text-[10px] text-slate-400 font-medium">Net Pay</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!hasConfig ? (
                    <div className="p-6 text-center">
                      <p className="text-slate-400 text-sm font-medium mb-3">No salary config found for this employee.</p>
                      <button
                        onClick={() => { setActiveTab('config'); handleLoadConfig(report.employeeId); }}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl text-xs font-bold shadow-lg transition-all active:scale-95"
                      >
                        + Add Salary Config
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 space-y-4">
                      {/* Attendance Summary */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Attendance</p>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { label: 'Present',  value: report.presentDays,  color: 'text-emerald-600' },
                            { label: 'Absent',   value: report.absentDays,   color: 'text-red-600' },
                            { label: 'Late',     value: report.lateDays,     color: 'text-amber-600' },
                            { label: 'Half Day', value: report.halfDays,     color: 'text-orange-600' },
                            { label: 'WFH',      value: report.wfhDays,      color: 'text-blue-600' },
                            { label: 'Leave',    value: report.leaveDays,    color: 'text-purple-600' },
                          ].map(s => (
                            <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                              <p className="text-[9px] font-bold text-slate-400 mt-0.5">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Salary Breakdown */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salary Breakdown</p>
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                          {/* Base */}
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-medium">Base Salary</span>
                            <span className="text-slate-800 font-bold">{formatPKR(report.baseSalary)}</span>
                          </div>

                          {/* Allowances */}
                          {report.allowances > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 font-medium">Allowances</span>
                              <span className="text-emerald-600 font-bold">+ {formatPKR(report.allowances)}</span>
                            </div>
                          )}

                          {/* OT Pay */}
                          {report.totalOtPay > 0 && (
                            <div className="space-y-1.5">
                              {report.regularOtPay > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Regular OT ({report.regularOtHours}h)</span>
                                  <span className="text-purple-600 font-bold">+ {formatPKR(report.regularOtPay)}</span>
                                </div>
                              )}
                              {report.sundayOtPay > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Sunday OT ({report.sundayOtHours}h)</span>
                                  <span className="text-purple-600 font-bold">+ {formatPKR(report.sundayOtPay)}</span>
                                </div>
                              )}
                              {report.holidayOtPay > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Holiday OT ({report.holidayOtHours}h)</span>
                                  <span className="text-purple-600 font-bold">+ {formatPKR(report.holidayOtPay)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Deductions */}
                          {report.totalDeductions > 0 && (
                            <div className="space-y-1.5 border-t border-slate-200 pt-2">
                              {report.lateDeductions > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Late ({report.lateDays}x)</span>
                                  <span className="text-red-600 font-bold">- {formatPKR(report.lateDeductions)}</span>
                                </div>
                              )}
                              {report.absentDeductions > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Absent ({report.absentDays}d)</span>
                                  <span className="text-red-600 font-bold">- {formatPKR(report.absentDeductions)}</span>
                                </div>
                              )}
                              {report.halfDayDeductions > 0 && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400 font-medium ml-3">Half Day ({report.halfDays}d)</span>
                                  <span className="text-red-600 font-bold">- {formatPKR(report.halfDayDeductions)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Gross */}
                          <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                            <span className="text-slate-600 font-bold">Gross Pay</span>
                            <span className="text-slate-800 font-black">{formatPKR(report.grossPay)}</span>
                          </div>

                          {/* Other deductions */}
                          {getSalaryConfig(report.employeeId).deductions > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500 font-medium">Other Deductions</span>
                              <span className="text-red-600 font-bold">- {formatPKR(getSalaryConfig(report.employeeId).deductions)}</span>
                            </div>
                          )}

                          {/* Net Pay */}
                          <div className="flex justify-between text-base border-t-2 border-emerald-200 pt-2.5 mt-1">
                            <span className="text-emerald-700 font-black">Net Pay</span>
                            <span className="text-emerald-600 font-black text-lg">{formatPKR(report.netPay)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Hours worked */}
                      <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3 border border-blue-200">
                        <span className="text-blue-700 text-xs font-bold">Total Hours Worked</span>
                        <span className="text-[#1E40AF] font-black">{report.totalHoursWorked}h</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== CONFIG TAB ===== */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          {/* Employee selector */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
            <label className={labelCls}>Select Employee to Configure</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {employees.map(emp => {
                const hasConfig = getSalaryConfig(emp.id).baseSalary > 0;
                const isSelected = configEmpId === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => handleLoadConfig(emp.id)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400 shadow-md'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                    }`}>
                      {getInitials(emp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{emp.name.split(' ')[0]}</p>
                      <p className={`text-[9px] font-medium ${isSelected ? 'text-white/70' : hasConfig ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {hasConfig ? '✓ Configured' : '⚠ Not set'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Config Form */}
          {configForm && configEmpId && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center text-xs font-black">
                    {getInitials(allEmployees.find(e => e.id === configEmpId)?.name || '')}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">
                      {allEmployees.find(e => e.id === configEmpId)?.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Salary Configuration</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Base Salary */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">💰 Basic Pay</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Base Salary (PKR/month)</label>
                      <input
                        type="number"
                        value={configForm.baseSalary}
                        onChange={e => setConfigForm(f => f ? ({ ...f, baseSalary: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 50000"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Allowances (PKR/month)</label>
                      <input
                        type="number"
                        value={configForm.allowances}
                        onChange={e => setConfigForm(f => f ? ({ ...f, allowances: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Other Deductions (PKR/month)</label>
                      <input
                        type="number"
                        value={configForm.deductions}
                        onChange={e => setConfigForm(f => f ? ({ ...f, deductions: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 0"
                      />
                    </div>
                  </div>
                </div>

                {/* Deduction Rules */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">📉 Deduction Rules</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Late Deduction (per incident)</label>
                      <input
                        type="number"
                        value={configForm.lateDeductionPerIncident}
                        onChange={e => setConfigForm(f => f ? ({ ...f, lateDeductionPerIncident: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 200"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Absent Deduction (per day)</label>
                      <input
                        type="number"
                        value={configForm.absentDeductionPerDay}
                        onChange={e => setConfigForm(f => f ? ({ ...f, absentDeductionPerDay: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 1923"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Half Day Deduction</label>
                      <input
                        type="number"
                        value={configForm.halfDayDeduction}
                        onChange={e => setConfigForm(f => f ? ({ ...f, halfDayDeduction: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 961"
                      />
                    </div>
                  </div>
                </div>

                {/* OT Rates */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">⚡ Overtime Rates (PKR/hour)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Regular OT Rate</label>
                      <input
                        type="number"
                        value={configForm.otRatePerHour}
                        onChange={e => setConfigForm(f => f ? ({ ...f, otRatePerHour: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 360"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Sunday OT Rate</label>
                      <input
                        type="number"
                        value={configForm.sundayOtRate}
                        onChange={e => setConfigForm(f => f ? ({ ...f, sundayOtRate: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 480"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Holiday OT Rate</label>
                      <input
                        type="number"
                        value={configForm.holidayOtRate}
                        onChange={e => setConfigForm(f => f ? ({ ...f, holidayOtRate: parseFloat(e.target.value) || 0 }) : f)}
                        className={inputCls}
                        placeholder="e.g. 480"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto calculated preview */}
                {configForm.baseSalary > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Auto Calculated</p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-emerald-600 font-medium">Per Day Salary</span>
                        <span className="text-emerald-700 font-black">{formatPKR(Math.round(configForm.baseSalary / 26))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-600 font-medium">Per Hour Rate</span>
                        <span className="text-emerald-700 font-black">{formatPKR(Math.round(configForm.baseSalary / 26 / 8))}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={handleSaveConfig}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] shadow-lg ${
                    configSaved
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30'
                  }`}
                >
                  {configSaved ? '✓ Saved!' : 'Save Salary Config'}
                </button>
              </div>
            </div>
          )}
        </div>
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