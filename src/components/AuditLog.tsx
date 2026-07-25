// src/components/AuditLog.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee, AuditLog as AuditLogType, AuditAction } from '../types';
import { getAuditLogs, getEmployees, syncAll } from '../store';
import { format, parseISO, subDays } from 'date-fns';

interface AuditLogProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

// Action configs
const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  check_in:          { label: 'Check In',          icon: '✓',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  check_out:         { label: 'Check Out',          icon: '←',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  record_edit:       { label: 'Record Edited',      icon: '✏️', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  record_delete:     { label: 'Record Deleted',     icon: '🗑', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  record_create:     { label: 'Record Created',     icon: '➕', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  pin_change:        { label: 'PIN Changed',        icon: '🔑', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  employee_add:      { label: 'Employee Added',     icon: '👤', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  employee_remove:   { label: 'Employee Removed',   icon: '👤', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  device_bind:       { label: 'Device Bound',       icon: '📱', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  device_reset:      { label: 'Device Reset',       icon: '🔄', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  wfh_approve:       { label: 'WFH Approved',       icon: '🏠', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  wfh_reject:        { label: 'WFH Rejected',       icon: '🏠', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  leave_approve:     { label: 'Leave Approved',     icon: '✓',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  leave_reject:      { label: 'Leave Rejected',     icon: '✕',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  account_approve:   { label: 'Account Approved',   icon: '✓',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  account_reject:    { label: 'Account Rejected',   icon: '✕',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  timing_change:     { label: 'Timing Updated',     icon: '⏰', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  access_grant:      { label: 'Access Granted',     icon: '🔓', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  access_revoke:     { label: 'Access Revoked',     icon: '🔒', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  holiday_add:       { label: 'Holiday Added',      icon: '🎉', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  holiday_remove:    { label: 'Holiday Removed',    icon: '🎉', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  salary_update:     { label: 'Salary Updated',     icon: '💰', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  correction_approve:{ label: 'Correction Approved',icon: '✓',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  correction_reject: { label: 'Correction Rejected',icon: '✕',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  secret_override:   { label: 'Secret Override',    icon: '🔐', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  login_attempt:     { label: 'Login Attempt',      icon: '🔑', color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  login_success:     { label: 'Login Success',      icon: '✓',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  login_failed:      { label: 'Login Failed',       icon: '✕',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  suspicious_activity:{ label: 'Suspicious Activity',icon: '🚨',color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const SEVERITY_CONFIG = {
  info:     { label: 'Info',     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  warning:  { label: 'Warning',  color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  critical: { label: 'Critical', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
};

type DateFilter = 'today' | '7d' | '30d' | 'all';
type SeverityFilter = 'all' | 'info' | 'warning' | 'critical';

export default function AuditLog({ currentUser }: AuditLogProps) {
  const [mounted, setMounted]                 = useState(false);
  const [refreshKey, setRefreshKey]           = useState(0);
  const [searchQuery, setSearchQuery]         = useState('');
  const [dateFilter, setDateFilter]           = useState<DateFilter>('7d');
  const [severityFilter, setSeverityFilter]   = useState<SeverityFilter>('all');
  const [actionFilter, setActionFilter]       = useState<string>('all');
  const [employeeFilter, setEmployeeFilter]   = useState<string>('all');
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [syncing, setSyncing]                 = useState(false);

  const employees = getEmployees();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = async () => {
    setSyncing(true);
    await syncAll();
    setRefreshKey(k => k + 1);
    setSyncing(false);
  };

  const allLogs = useMemo(() => {
  let logs = getAuditLogs();

  // Agar current user admin nahi hai (Wahab nahi hai)
  // toh Wahab (emp-001) ki entries hide karo
  if (currentUser.id !== 'emp-001') {
    logs = logs.filter(log =>
      log.performedBy !== 'emp-001' &&
      log.targetEmployeeId !== 'emp-001'
    );
  }

  return logs;
}, [refreshKey, currentUser.id]);

  const filteredLogs = useMemo(() => {
    let logs = [...allLogs];
    const now = new Date();

    // Date filter
    if (dateFilter === 'today') {
      const today = format(now, 'yyyy-MM-dd');
      logs = logs.filter(l => l.timestamp?.startsWith(today));
    } else if (dateFilter === '7d') {
      const cutoff = subDays(now, 7).toISOString();
      logs = logs.filter(l => l.timestamp >= cutoff);
    } else if (dateFilter === '30d') {
      const cutoff = subDays(now, 30).toISOString();
      logs = logs.filter(l => l.timestamp >= cutoff);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      logs = logs.filter(l => l.severity === severityFilter);
    }

    // Action filter
    if (actionFilter !== 'all') {
      logs = logs.filter(l => l.action === actionFilter);
    }

    // Employee filter
    if (employeeFilter !== 'all') {
      logs = logs.filter(l =>
        l.performedBy === employeeFilter ||
        l.targetEmployeeId === employeeFilter
      );
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(l =>
        l.description?.toLowerCase().includes(q) ||
        l.performedByName?.toLowerCase().includes(q) ||
        l.targetEmployeeName?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q)
      );
    }

    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [allLogs, dateFilter, severityFilter, actionFilter, employeeFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayLogs = allLogs.filter(l => l.timestamp?.startsWith(today));
    return {
      total:    allLogs.length,
      today:    todayLogs.length,
      critical: allLogs.filter(l => l.severity === 'critical').length,
      warning:  allLogs.filter(l => l.severity === 'warning').length,
    };
  }, [allLogs]);

  const formatTimestamp = (ts: string) => {
    try {
      return format(parseISO(ts), 'dd MMM yyyy, hh:mm:ss a');
    } catch { return ts; }
  };

  const getActionConfig = (action: string) => {
    return ACTION_CONFIG[action] || {
      label: action, icon: '•',
      color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200'
    };
  };

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-3xl p-5 text-white relative overflow-hidden shadow-xl">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Audit Log</h2>
              <p className="text-slate-400 text-xs font-bold">Complete activity trail</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-white text-xs font-bold border border-white/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ===== STATS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Logs',    value: stats.total,    color: 'text-[#1E40AF]', bg: 'from-blue-50 to-indigo-50',     border: 'border-blue-200',   icon: '📋' },
          { label: 'Today',         value: stats.today,    color: 'text-emerald-600', bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200',icon: '📅' },
          { label: 'Warnings',      value: stats.warning,  color: 'text-amber-600', bg: 'from-amber-50 to-yellow-50',   border: 'border-amber-200',  icon: '⚠️' },
          { label: 'Critical',      value: stats.critical, color: 'text-red-600',   bg: 'from-red-50 to-rose-50',       border: 'border-red-200',    icon: '🚨' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border ${s.border} shadow-sm`}>
            <p className="text-lg mb-1">{s.icon}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ===== FILTERS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by action, employee, description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium focus:outline-none focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Date Filter */}
          <div className="flex rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
            {([
              { key: 'today', label: 'Today' },
              { key: '7d',    label: '7 Days' },
              { key: '30d',   label: '30 Days' },
              { key: 'all',   label: 'All' },
            ] as const).map(d => (
              <button
                key={d.key}
                onClick={() => setDateFilter(d.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  dateFilter === d.key
                    ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <div className="flex rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
            {(['all', 'info', 'warning', 'critical'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all capitalize ${
                  severityFilter === s
                    ? s === 'critical' ? 'bg-red-600 text-white shadow-md'
                    : s === 'warning'  ? 'bg-amber-500 text-white shadow-md'
                    : s === 'info'     ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Employee Filter */}
          <div className="relative">
            <select
              value={employeeFilter}
              onChange={e => setEmployeeFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl pl-4 pr-8 py-2 text-xs font-semibold focus:outline-none focus:border-[#1E40AF] transition-all cursor-pointer"
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

          {/* Records count */}
          <span className="ml-auto text-[10px] font-bold text-slate-400 self-center">
            {filteredLogs.length} records
          </span>
        </div>
      </div>

      {/* ===== LOG LIST ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
              <p className="text-slate-400 font-bold text-sm">No audit logs found</p>
              <p className="text-slate-300 text-xs mt-1">Try changing filters or refresh</p>
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const cfg = getActionConfig(log.action);
              const sevCfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
              const isExpanded = expandedId === log.id;

              return (
                <div
                  key={log.id}
                  className="hover:bg-slate-50/80 transition-all"
                  style={{ animationDelay: `${idx * 10}ms` }}
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full px-5 py-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      {/* Action Icon */}
                      <div className={`w-9 h-9 ${cfg.bg} rounded-xl flex items-center justify-center text-sm border ${cfg.border} shrink-0 mt-0.5`}>
                        {cfg.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Top row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black ${cfg.color}`}>{cfg.label}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${sevCfg.bg} ${sevCfg.color} ${sevCfg.border}`}>
                            {sevCfg.label}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-slate-700 text-xs font-medium mt-0.5 truncate">
                          {log.description}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {log.performedByName && (
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-md flex items-center justify-center text-[7px] font-black text-white">
                                {getInitials(log.performedByName)}
                              </div>
                              <span className="text-[10px] text-slate-500 font-medium">{log.performedByName}</span>
                            </div>
                          )}
                          {log.targetEmployeeName && log.targetEmployeeName !== log.performedByName && (
                            <span className="text-[10px] text-slate-400 font-medium">→ {log.targetEmployeeName}</span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium ml-auto">
                            {log.timestamp ? formatTimestamp(log.timestamp) : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Expand chevron */}
                      <svg
                        className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 ml-12 animate-fade-in">
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2.5">

                        {log.performedBy && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-medium">Performed By</span>
                            <span className="text-slate-700 font-bold">{log.performedByName} ({log.performedBy})</span>
                          </div>
                        )}

                        {log.targetEmployeeId && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-medium">Target Employee</span>
                            <span className="text-slate-700 font-bold">{log.targetEmployeeName} ({log.targetEmployeeId})</span>
                          </div>
                        )}

                        {log.oldValue && (
                          <div className="text-xs">
                            <span className="text-slate-400 font-medium block mb-1">Old Value</span>
                            <code className="bg-red-50 text-red-700 px-2 py-1 rounded-lg text-[10px] block border border-red-100 break-all">
                              {log.oldValue}
                            </code>
                          </div>
                        )}

                        {log.newValue && (
                          <div className="text-xs">
                            <span className="text-slate-400 font-medium block mb-1">New Value</span>
                            <code className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[10px] block border border-emerald-100 break-all">
                              {log.newValue}
                            </code>
                          </div>
                        )}

                        {log.deviceInfo && (
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400 font-medium">Device</span>
                            <span className="text-slate-600 font-medium text-right max-w-[60%] truncate">{log.deviceInfo}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-xs border-t border-slate-200 pt-2">
                          <span className="text-slate-400 font-medium">Timestamp</span>
                          <span className="text-slate-700 font-bold">{log.timestamp ? formatTimestamp(log.timestamp) : '—'}</span>
                        </div>

                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Log ID</span>
                          <span className="text-slate-400 font-mono text-[10px]">{log.id}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {filteredLogs.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-slate-50 to-blue-50/20 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400">
              Showing <span className="text-[#1E40AF]">{filteredLogs.length}</span> of <span className="text-[#1E40AF]">{allLogs.length}</span> total logs
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
}