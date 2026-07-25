// src/components/AdminAlerts.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee, AdminAlert, AlertType, AlertSeverity } from '../types';
import {
  getAdminAlerts, markAlertRead, dismissAlert,
  getEmployees, syncAll, generateSmartAlerts,
  getPKTDateString,
} from '../store';
import { format, parseISO } from 'date-fns';

interface AdminAlertsProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

// Alert type configs
const ALERT_CONFIG: Record<AlertType, {
  label: string; icon: string;
  color: string; bg: string; border: string;
}> = {
  late_pattern:       { label: 'Late Pattern',         icon: '⏰', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  frequent_absent:    { label: 'Frequent Absent',       icon: '❌', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  ot_excess:          { label: 'OT Excess',             icon: '⚡', color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  wfh_excess:         { label: 'WFH Excess',            icon: '🏠', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  outside_office:     { label: 'Outside Office',        icon: '🚨', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  gps_off:            { label: 'GPS Off',               icon: '📍', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  unauthorized_device:{ label: 'Unauthorized Device',   icon: '📱', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  failed_login:       { label: 'Failed Login',          icon: '🔑', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  no_checkout:        { label: 'No Checkout',           icon: '⚠️', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  correction_request: { label: 'Correction Request',    icon: '✏️', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  leave_request:      { label: 'Leave Request',         icon: '📅', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  suspicious_override:{ label: 'Suspicious Override',   icon: '🔐', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  consecutive_absent: { label: 'Consecutive Absences',  icon: '🔴', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const SEVERITY_CONFIG: Record<AlertSeverity, {
  label: string; color: string; bg: string;
  border: string; dot: string; ring: string;
}> = {
  low:      { label: 'Low',      color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200',  dot: 'bg-slate-400',   ring: 'ring-slate-200' },
  medium:   { label: 'Medium',   color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',   ring: 'ring-amber-200' },
  high:     { label: 'High',     color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-500',  ring: 'ring-orange-200' },
  critical: { label: 'Critical', color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500',     ring: 'ring-red-200' },
};

type FilterTab = 'all' | 'unread' | 'critical' | 'high' | 'dismissed';

export default function AdminAlerts({ currentUser }: AdminAlertsProps) {
  const [mounted, setMounted]         = useState(false);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [activeTab, setActiveTab]     = useState<FilterTab>('unread');
  const [typeFilter, setTypeFilter]   = useState<string>('all');
  const [empFilter, setEmpFilter]     = useState<string>('all');
  const [generating, setGenerating]   = useState(false);
  const [syncing, setSyncing]         = useState(false);

  const employees = getEmployees();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const allAlerts = useMemo(() => {
  let alerts = getAdminAlerts();

  // Agar current user Wahab nahi hai toh Wahab ke alerts hide karo
  if (currentUser.id !== 'emp-001') {
    alerts = alerts.filter(a => a.employeeId !== 'emp-001');
  }

  return alerts;
}, [refreshKey, currentUser.id]);

  const filteredAlerts = useMemo(() => {
    let alerts = [...allAlerts];

    // Tab filter
    if (activeTab === 'unread')    alerts = alerts.filter(a => !a.isRead && !a.isDismissed);
    if (activeTab === 'critical')  alerts = alerts.filter(a => a.severity === 'critical' && !a.isDismissed);
    if (activeTab === 'high')      alerts = alerts.filter(a => a.severity === 'high' && !a.isDismissed);
    if (activeTab === 'dismissed') alerts = alerts.filter(a => a.isDismissed);
    if (activeTab === 'all')       alerts = alerts.filter(a => !a.isDismissed);

    // Type filter
    if (typeFilter !== 'all') alerts = alerts.filter(a => a.type === typeFilter);

    // Employee filter
    if (empFilter !== 'all') alerts = alerts.filter(a => a.employeeId === empFilter);

    return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allAlerts, activeTab, typeFilter, empFilter]);

  // Stats
  const stats = useMemo(() => ({
    unread:   allAlerts.filter(a => !a.isRead && !a.isDismissed).length,
    critical: allAlerts.filter(a => a.severity === 'critical' && !a.isDismissed).length,
    high:     allAlerts.filter(a => a.severity === 'high' && !a.isDismissed).length,
    total:    allAlerts.filter(a => !a.isDismissed).length,
  }), [allAlerts]);

  const handleMarkRead = async (alertId: string) => {
    await markAlertRead(alertId);
    setRefreshKey(k => k + 1);
  };

  const handleDismiss = async (alertId: string) => {
    await dismissAlert(alertId);
    setRefreshKey(k => k + 1);
  };

  const handleMarkAllRead = async () => {
    const unread = allAlerts.filter(a => !a.isRead && !a.isDismissed);
    for (const alert of unread) {
      await markAlertRead(alert.id);
    }
    setRefreshKey(k => k + 1);
  };

  const handleRefresh = async () => {
    setSyncing(true);
    await syncAll();
    setRefreshKey(k => k + 1);
    setSyncing(false);
  };

  const handleGenerateAlerts = async () => {
    setGenerating(true);
    await generateSmartAlerts();
    setRefreshKey(k => k + 1);
    setGenerating(false);
  };

  const formatTime = (ts: string) => {
    try {
      const d = parseISO(ts);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1)    return 'Just now';
      if (diffMins < 60)   return `${diffMins}m ago`;
      if (diffHours < 24)  return `${diffHours}h ago`;
      if (diffDays < 7)    return `${diffDays}d ago`;
      return format(d, 'dd MMM');
    } catch { return ts; }
  };

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: 'unread',    label: 'Unread',    count: stats.unread },
    { key: 'critical',  label: 'Critical',  count: stats.critical },
    { key: 'high',      label: 'High',      count: stats.high },
    { key: 'all',       label: 'All',       count: stats.total },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 relative">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {stats.unread > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2 border-white">
                  {stats.unread > 99 ? '99+' : stats.unread}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Smart Alerts</h2>
              <p className="text-blue-200 text-xs font-bold">Real-time security & attendance monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Generate button */}
            <button
              onClick={handleGenerateAlerts}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-bold border border-white/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              {generating ? 'Scanning...' : 'Scan'}
            </button>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-bold border border-white/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              {syncing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ===== STATS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unread',   value: stats.unread,   color: 'text-[#1E40AF]',  bg: 'from-blue-50 to-indigo-50',    border: 'border-blue-200',   icon: '🔔' },
          { label: 'Critical', value: stats.critical, color: 'text-red-600',    bg: 'from-red-50 to-rose-50',       border: 'border-red-200',    icon: '🚨' },
          { label: 'High',     value: stats.high,     color: 'text-orange-600', bg: 'from-orange-50 to-amber-50',   border: 'border-orange-200', icon: '⚠️' },
          { label: 'Total',    value: stats.total,    color: 'text-slate-700',  bg: 'from-slate-50 to-slate-100',   border: 'border-slate-200',  icon: '📋' },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 border ${s.border} shadow-sm`}>
            <p className="text-lg mb-1">{s.icon}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ===== FILTERS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-3">

        {/* Tab filters */}
        <div className="flex gap-1 overflow-x-auto bg-slate-50 p-1 rounded-2xl">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center ${
                activeTab === t.key
                  ? t.key === 'critical'
                    ? 'bg-red-600 text-white shadow-md'
                    : t.key === 'high'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  activeTab === t.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl pl-4 pr-8 py-2 text-xs font-semibold focus:outline-none focus:border-[#1E40AF] transition-all cursor-pointer"
            >
              <option value="all">All Types</option>
              {Object.entries(ALERT_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Employee filter */}
          <div className="relative">
            <select
              value={empFilter}
              onChange={e => setEmpFilter(e.target.value)}
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

          {/* Mark all read */}
          {stats.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="ml-auto px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#1E40AF] rounded-2xl text-xs font-bold border border-blue-200 transition-all active:scale-95"
            >
              ✓ Mark All Read
            </button>
          )}

          <span className="text-[10px] font-bold text-slate-400 ml-auto">
            {filteredAlerts.length} alerts
          </span>
        </div>
      </div>

      {/* ===== ALERTS LIST ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {filteredAlerts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              </div>
              <p className="text-slate-400 font-bold text-sm">
                {activeTab === 'unread' ? '🎉 All caught up! No unread alerts.' : 'No alerts found'}
              </p>
              <p className="text-slate-300 text-xs mt-1">
                {activeTab === 'unread' ? 'Alerts will appear here automatically' : 'Try changing filters or run a scan'}
              </p>
              {activeTab === 'unread' && (
                <button
                  onClick={handleGenerateAlerts}
                  disabled={generating}
                  className="mt-4 px-5 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {generating ? 'Scanning...' : '🔍 Run Smart Scan'}
                </button>
              )}
            </div>
          ) : (
            filteredAlerts.map((alert, idx) => {
              const typeCfg = ALERT_CONFIG[alert.type] || {
                label: alert.type, icon: '•',
                color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200'
              };
              const sevCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
              const emp = employees.find(e => e.id === alert.employeeId);
              const isUnread = !alert.isRead;

              return (
                <div
                  key={alert.id}
                  className={`px-5 py-4 hover:bg-slate-50/80 transition-all ${
                    isUnread ? 'border-l-4 border-l-[#1E40AF]' : ''
                  }`}
                  style={{ animationDelay: `${idx * 20}ms` }}
                >
                  <div className="flex items-start gap-3">

                    {/* Alert Icon */}
                    <div className={`w-11 h-11 ${typeCfg.bg} rounded-2xl flex items-center justify-center text-xl border ${typeCfg.border} shrink-0 relative`}>
                      {typeCfg.icon}
                      {/* Severity dot */}
                      <div className={`absolute -top-1 -right-1 w-3 h-3 ${sevCfg.dot} rounded-full border-2 border-white ${
                        alert.severity === 'critical' ? 'animate-pulse' : ''
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-black ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                              {alert.title}
                            </p>
                            {isUnread && (
                              <span className="w-2 h-2 bg-[#1E40AF] rounded-full shrink-0" />
                            )}
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${typeCfg.bg} ${typeCfg.color} ${typeCfg.border}`}>
                              {typeCfg.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${sevCfg.bg} ${sevCfg.color} ${sevCfg.border}`}>
                              {sevCfg.label}
                            </span>
                          </div>
                        </div>

                        {/* Time */}
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {formatTime(alert.createdAt)}
                        </span>
                      </div>

                      {/* Message */}
                      <p className={`text-xs font-medium mt-1.5 leading-relaxed ${isUnread ? 'text-slate-600' : 'text-slate-400'}`}>
                        {alert.message}
                      </p>

                      {/* Employee info */}
                      {emp && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-5 h-5 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-md flex items-center justify-center text-[8px] font-black text-white">
                            {getInitials(emp.name)}
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold">{emp.name}</span>
                          <span className="text-[10px] text-slate-300 capitalize">· {emp.role}</span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {isUnread && (
                          <button
                            onClick={() => handleMarkRead(alert.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E40AF] rounded-xl text-[10px] font-bold border border-blue-200 transition-all active:scale-95"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Mark Read
                          </button>
                        )}
                        {!alert.isDismissed && (
                          <button
                            onClick={() => handleDismiss(alert.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[10px] font-bold border border-slate-200 transition-all active:scale-95"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Dismiss
                          </button>
                        )}
                        {alert.readAt && (
                          <span className="text-[9px] text-slate-300 font-medium ml-auto">
                            Read {formatTime(alert.readAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {filteredAlerts.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-slate-50 to-blue-50/20 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400">
              Showing <span className="text-[#1E40AF]">{filteredAlerts.length}</span> of{' '}
              <span className="text-[#1E40AF]">{allAlerts.length}</span> total alerts
            </p>
          </div>
        )}
      </div>
    </div>
  );
}