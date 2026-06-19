// src/components/LeaveManagement.tsx

import { useState, useEffect, useMemo } from 'react';
import { Employee, LeaveRequest, LeaveType } from '../types';
import {
  getEmployees,
  getLeaveRequests,
  addLeaveRequest,
  updateLeaveRequest,
  getPendingLeaves,
  getEmployeeLeaves,
  getPKTDateString,
  getPKTISOString,
  addNotification,
} from '../store';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';

interface LeaveManagementProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const LEAVE_TYPE_CONFIG: Record<LeaveType, { label: string; color: string; bg: string; border: string; icon: string }> = {
  casual:    { label: 'Casual',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: '🌴' },
  sick:      { label: 'Sick',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: '🤒' },
  annual:    { label: 'Annual',    color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: '🏖️' },
  emergency: { label: 'Emergency', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: '🚨' },
  unpaid:    { label: 'Unpaid',    color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200',  icon: '💼' },
  maternity: { label: 'Maternity', color: 'text-pink-700',   bg: 'bg-pink-50',   border: 'border-pink-200',   icon: '👶' },
  other:     { label: 'Other',     color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: '📋' },
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending',  color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '⏳' },
  approved:  { label: 'Approved', color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: '✓' },
  rejected:  { label: 'Rejected', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: '✕' },
  cancelled: { label: 'Cancelled',color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200',  icon: '✕' },
};

function calculateWorkingDays(from: string, to: string): number {
  if (!from || !to) return 0;
  try {
    const start = parseISO(from);
    const end = parseISO(to);
    if (end < start) return 0;
    const days = eachDayOfInterval({ start, end });
    return days.filter(d => !isWeekend(d)).length;
  } catch { return 0; }
}

export default function LeaveManagement({ currentUser }: LeaveManagementProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'apply' | 'manage'>(
    isAdmin ? 'manage' : 'my-leaves'
  );
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Apply form state
  const [form, setForm] = useState({
    type: 'casual' as LeaveType,
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Admin filter
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const employees = getEmployees();

  const myLeaves = useMemo(() =>
    getEmployeeLeaves(currentUser.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [refreshKey]
  );

  const allLeaves = useMemo(() => {
    let leaves = getLeaveRequests();
    if (filterStatus !== 'all') leaves = leaves.filter(l => l.status === filterStatus);
    if (filterEmployee !== 'all') leaves = leaves.filter(l => l.employeeId === filterEmployee);
    return leaves.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [refreshKey, filterStatus, filterEmployee]);

  const pendingCount = useMemo(() => getPendingLeaves().length, [refreshKey]);

  const workingDays = useMemo(() =>
    calculateWorkingDays(form.fromDate, form.toDate),
    [form.fromDate, form.toDate]
  );

  const showNotif = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!form.fromDate || !form.toDate) { setFormError('Please select dates.'); return; }
    if (parseISO(form.toDate) < parseISO(form.fromDate)) { setFormError('End date must be after start date.'); return; }
    if (!form.reason.trim()) { setFormError('Please enter a reason.'); return; }
    if (workingDays === 0) { setFormError('No working days in selected range.'); return; }

    setSubmitting(true);
    const leave: LeaveRequest = {
      id: `leave-${currentUser.id}-${Date.now()}`,
      employeeId: currentUser.id,
      type: form.type,
      fromDate: form.fromDate,
      toDate: form.toDate,
      totalDays: workingDays,
      reason: form.reason.trim(),
      attachmentUrl: null,
      status: 'pending',
      requestedAt: getPKTISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewerNote: null,
    };

    await addLeaveRequest(leave);

    await addNotification({
      id: `notif-${Date.now()}`,
      employeeId: currentUser.id,
      type: 'general',
      title: 'Leave Request Submitted',
      message: `Your ${form.type} leave request (${workingDays} days) has been submitted.`,
      isRead: false,
      createdAt: getPKTISOString(),
    });

    setForm({ type: 'casual', fromDate: '', toDate: '', reason: '' });
    setRefreshKey(k => k + 1);
    setSubmitting(false);
    showNotif('success', `Leave request submitted! (${workingDays} working days)`);
    setActiveTab('my-leaves');
  };

  const handleApprove = async (leave: LeaveRequest) => {
    const nowISO = getPKTISOString();
    await updateLeaveRequest(leave.id, {
      status: 'approved',
      reviewedBy: currentUser.id,
      reviewedAt: nowISO,
      reviewerNote: reviewNote || null,
    });

    const emp = employees.find(e => e.id === leave.employeeId);
    await addNotification({
      id: `notif-${Date.now()}`,
      employeeId: leave.employeeId,
      type: 'leave_approved',
      title: '✅ Leave Approved!',
      message: `Your ${leave.type} leave (${leave.fromDate} → ${leave.toDate}, ${leave.totalDays} days) has been approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      isRead: false,
      createdAt: nowISO,
    });

    setReviewNote('');
    setReviewingId(null);
    setRefreshKey(k => k + 1);
    showNotif('success', `Leave approved for ${emp?.name || 'employee'}`);
  };

  const handleReject = async (leave: LeaveRequest) => {
    if (!reviewNote.trim()) {
      showNotif('error', 'Please enter a rejection reason.');
      return;
    }
    const nowISO = getPKTISOString();
    await updateLeaveRequest(leave.id, {
      status: 'rejected',
      reviewedBy: currentUser.id,
      reviewedAt: nowISO,
      reviewerNote: reviewNote,
    });

    const emp = employees.find(e => e.id === leave.employeeId);
    await addNotification({
      id: `notif-${Date.now()}`,
      employeeId: leave.employeeId,
      type: 'leave_rejected',
      title: '❌ Leave Rejected',
      message: `Your ${leave.type} leave request was rejected. Reason: ${reviewNote}`,
      isRead: false,
      createdAt: nowISO,
    });

    setReviewNote('');
    setReviewingId(null);
    setRefreshKey(k => k + 1);
    showNotif('warning', `Leave rejected for ${emp?.name || 'employee'}`);
  };

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all";

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

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Leave Management</h2>
              <p className="text-blue-200 text-xs font-bold">Apply & manage leave requests</p>
            </div>
          </div>
          {isAdmin && pendingCount > 0 && (
            <div className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full border border-red-400 animate-pulse">
              {pendingCount} Pending
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-1">
          {[
            { key: 'my-leaves', label: 'My Leaves', icon: '📋', show: true },
            { key: 'apply',     label: 'Apply Leave', icon: '➕', show: true },
            { key: 'manage',    label: `Manage${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: '⚙️', show: isAdmin },
          ].filter(t => t.show).map(t => (
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

      {/* ===== MY LEAVES ===== */}
      {activeTab === 'my-leaves' && (
        <div className="space-y-4">

          {/* My Leave History */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
              <h3 className="text-sm font-black text-slate-800">My Leave History</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {myLeaves.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">🌴</span>
                  </div>
                  <p className="text-slate-400 font-bold text-sm">No leave requests yet</p>
                  <p className="text-slate-300 text-xs mt-1">Apply for leave using the Apply tab</p>
                </div>
              ) : (
                myLeaves.map(leave => {
                  const cfg = LEAVE_TYPE_CONFIG[leave.type];
                  const stCfg = STATUS_CONFIG[leave.status];
                  return (
                    <div key={leave.id} className="px-5 py-4 hover:bg-slate-50/80 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 ${cfg.bg} rounded-xl flex items-center justify-center text-lg shrink-0 border ${cfg.border}`}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-black ${cfg.color}`}>{cfg.label} Leave</p>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${stCfg.bg} ${stCfg.color} ${stCfg.border}`}>
                                {stCfg.icon} {stCfg.label}
                              </span>
                            </div>
                            <p className="text-slate-600 text-xs font-medium mt-0.5">
                              {leave.fromDate} → {leave.toDate}
                              <span className="ml-2 text-[#1E40AF] font-bold">({leave.totalDays} days)</span>
                            </p>
                            <p className="text-slate-400 text-xs font-medium mt-0.5 truncate">{leave.reason}</p>
                            {leave.reviewerNote && (
                              <p className="text-amber-600 text-xs font-bold mt-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                                Note: {leave.reviewerNote}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-slate-400 text-[10px] font-medium">
                            {leave.requestedAt ? format(parseISO(leave.requestedAt), 'dd MMM') : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== APPLY LEAVE ===== */}
      {activeTab === 'apply' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
            <h3 className="text-sm font-black text-slate-800">Apply for Leave</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Fill the form below to submit a leave request</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Leave Type */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Leave Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(LEAVE_TYPE_CONFIG) as LeaveType[]).map(type => {
                  const cfg = LEAVE_TYPE_CONFIG[type];
                  const isSelected = form.type === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setForm(f => ({ ...f, type }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        isSelected
                          ? `${cfg.bg} ${cfg.color} ${cfg.border} shadow-md`
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cfg.icon}</span>
                      <span>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
                <input
                  type="date"
                  value={form.fromDate}
                  min={getPKTDateString()}
                  onChange={e => setForm(f => ({ ...f, fromDate: e.target.value, toDate: f.toDate < e.target.value ? e.target.value : f.toDate }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
                <input
                  type="date"
                  value={form.toDate}
                  min={form.fromDate || getPKTDateString()}
                  onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Working Days Preview */}
            {workingDays > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1E40AF] rounded-xl flex items-center justify-center shrink-0">
                  <span className="text-white font-black text-sm">{workingDays}</span>
                </div>
                <div>
                  <p className="text-[#1E40AF] font-black text-sm">Working Days Selected</p>
                  <p className="text-blue-600 text-xs font-medium">
                    {LEAVE_TYPE_CONFIG[form.type].icon} {LEAVE_TYPE_CONFIG[form.type].label} Leave
                  </p>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
              <textarea
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Please explain why you need this leave..."
                rows={4}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-red-600 text-xs font-bold">{formError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] disabled:from-slate-300 disabled:to-slate-400 text-white font-black rounded-2xl text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:shadow-none flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Submit Leave Request
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== MANAGE LEAVES (Admin/Manager) ===== */}
      {activeTab === 'manage' && isAdmin && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Status filter */}
              <div className="flex rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all capitalize ${
                      filterStatus === s
                        ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Employee filter */}
              <div className="relative">
                <select
                  value={filterEmployee}
                  onChange={e => setFilterEmployee(e.target.value)}
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

              <span className="ml-auto text-[10px] font-bold text-slate-400">
                {allLeaves.length} records
              </span>
            </div>
          </div>

          {/* Leave List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {allLeaves.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">📋</span>
                  </div>
                  <p className="text-slate-400 font-bold text-sm">No leave requests found</p>
                </div>
              ) : (
                allLeaves.map(leave => {
                  const cfg = LEAVE_TYPE_CONFIG[leave.type];
                  const stCfg = STATUS_CONFIG[leave.status];
                  const emp = employees.find(e => e.id === leave.employeeId);
                  const isReviewing = reviewingId === leave.id;

                  return (
                    <div key={leave.id} className="px-5 py-4 hover:bg-slate-50/80 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Employee Avatar */}
                        <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 shadow-md shadow-blue-500/20">
                          {getInitials(emp?.name || '?')}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Top row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-800">{emp?.name || 'Unknown'}</p>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                              {cfg.icon} {cfg.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${stCfg.bg} ${stCfg.color} ${stCfg.border}`}>
                              {stCfg.icon} {stCfg.label}
                            </span>
                          </div>

                          {/* Date & days */}
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {leave.fromDate} → {leave.toDate}
                            <span className="ml-2 text-[#1E40AF] font-bold">({leave.totalDays} working days)</span>
                          </p>

                          {/* Reason */}
                          <p className="text-xs text-slate-600 font-medium mt-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                            "{leave.reason}"
                          </p>

                          {/* Reviewer note */}
                          {leave.reviewerNote && (
                            <p className="text-amber-600 text-xs font-bold mt-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                              Admin Note: {leave.reviewerNote}
                            </p>
                          )}

                          {/* Action buttons for pending */}
                          {leave.status === 'pending' && (
                            <div className="mt-3 space-y-2">
                              {isReviewing ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={reviewNote}
                                    onChange={e => setReviewNote(e.target.value)}
                                    placeholder="Add a note (required for rejection)..."
                                    rows={2}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#1E40AF] resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApprove(leave)}
                                      className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                      ✓ Approve
                                    </button>
                                    <button
                                      onClick={() => handleReject(leave)}
                                      className="flex-1 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-xs font-black shadow-md shadow-red-500/20 transition-all active:scale-95"
                                    >
                                      ✕ Reject
                                    </button>
                                    <button
                                      onClick={() => { setReviewingId(null); setReviewNote(''); }}
                                      className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all active:scale-95"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setReviewingId(leave.id)}
                                  className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-500/20"
                                >
                                  Review Request →
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Date requested */}
                        <div className="text-right shrink-0">
                          <p className="text-slate-400 text-[10px] font-medium">
                            {leave.requestedAt ? format(parseISO(leave.requestedAt), 'dd MMM') : '—'}
                          </p>
                          {leave.reviewedAt && (
                            <p className="text-slate-300 text-[9px] font-medium mt-0.5">
                              Reviewed {format(parseISO(leave.reviewedAt), 'dd MMM')}
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