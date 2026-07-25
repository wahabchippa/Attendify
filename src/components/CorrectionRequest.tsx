// src/components/CorrectionRequest.tsx

import { useState, useMemo, useEffect } from 'react';
import { Employee, CorrectionRequest as CorrectionRequestType, AttendanceStatus } from '../types';
import {
  getEmployees, getAttendanceRecords, getAttendanceEmployees,
  getCorrectionRequests, addCorrectionRequest, updateCorrectionRequest,
  getPendingCorrections, updateAttendanceRecord,
  getPKTDateString, getPKTISOString, getPKTDate,
  addNotification, syncAll,
} from '../store';
import { format, parseISO } from 'date-fns';

interface CorrectionRequestProps {
  currentUser: Employee;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

const STATUS_STYLES: Record<string, string> = {
  present:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  late:             'bg-amber-50 text-amber-700 border-amber-200',
  absent:           'bg-red-50 text-red-700 border-red-200',
  'half-day':       'bg-orange-50 text-orange-700 border-orange-200',
  'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
  'holiday-ot':     'bg-purple-50 text-purple-700 border-purple-200',
  'on-leave':       'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const STATUS_LABELS: Record<string, string> = {
  present: 'Present', late: 'Late', absent: 'Absent',
  'half-day': 'Half Day', 'work-from-home': 'WFH',
  'holiday-ot': 'Holiday OT', 'on-leave': 'On Leave',
};

const REQUEST_STATUS = {
  pending:  { label: 'Pending',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: '⏳' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',icon: '✓' },
  rejected: { label: 'Rejected', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',    icon: '✕' },
};

const safeFormatTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '';
  try {
    const pktMatch = isoString.match(/T(\d{2}):(\d{2}).*\+05:00/);
    if (pktMatch) return `${pktMatch[1]}:${pktMatch[2]}`;
    const utcMatch = isoString.match(/T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|\+00:00)?/);
    if (utcMatch) {
      let h = parseInt(utcMatch[1], 10) + 5;
      if (h >= 24) h -= 24;
      return `${String(h).padStart(2, '0')}:${utcMatch[2]}`;
    }
    return '';
  } catch { return ''; }
};

const formatDisplay = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'hh:mm a'); } catch { return '—'; }
};

export default function CorrectionRequest({ currentUser }: CorrectionRequestProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [mounted, setMounted]         = useState(false);
  const [activeTab, setActiveTab]     = useState<'my-requests' | 'apply' | 'manage'>(
    isAdmin ? 'manage' : 'my-requests'
  );
  const [refreshKey, setRefreshKey]   = useState(0);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [syncing, setSyncing]         = useState(false);

  // Apply form
  const [selectedDate, setSelectedDate]           = useState('');
  const [selectedRecord, setSelectedRecord]       = useState<any>(null);
  const [requestedStatus, setRequestedStatus]     = useState<AttendanceStatus>('present');
  const [requestedCheckIn, setRequestedCheckIn]   = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [reason, setReason]                       = useState('');
  const [submitting, setSubmitting]               = useState(false);
  const [formError, setFormError]                 = useState('');

  // Admin
  const [reviewNote, setReviewNote]   = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [filterEmployee, setFilterEmployee] = useState('all');

  const employees    = getEmployees();
  const attEmployees = getAttendanceEmployees();
  const allRecords   = useMemo(() => getAttendanceRecords(), [refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const showNotif = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRefresh = async () => {
    setSyncing(true);
    await syncAll();
    setRefreshKey(k => k + 1);
    setSyncing(false);
  };

  // My requests
  const myRequests = useMemo(() =>
    getCorrectionRequests()
      .filter(r => r.employeeId === currentUser.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [refreshKey]
  );

  // All requests (admin)
  const allRequests = useMemo(() => {
    let reqs = getCorrectionRequests();
    if (filterStatus !== 'all') reqs = reqs.filter(r => r.status === filterStatus);
    if (filterEmployee !== 'all') reqs = reqs.filter(r => r.employeeId === filterEmployee);
    return reqs.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [refreshKey, filterStatus, filterEmployee]);

  const pendingCount = useMemo(() => getPendingCorrections().length, [refreshKey]);

  // When date changes, load existing record
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedRecord(null);
    setRequestedCheckIn('');
    setRequestedCheckOut('');
    if (!date) return;

    const rec = allRecords.find(
      r => r.employeeId === currentUser.id && r.date === date
    );
    if (rec) {
      setSelectedRecord(rec);
      setRequestedStatus(rec.status as AttendanceStatus);
      setRequestedCheckIn(safeFormatTime(rec.checkIn));
      setRequestedCheckOut(safeFormatTime(rec.checkOut));
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!selectedDate) { setFormError('Please select a date.'); return; }
    if (!reason.trim()) { setFormError('Please enter a reason.'); return; }

    // Check if request already exists for this date
    const existing = getCorrectionRequests().find(
      r => r.employeeId === currentUser.id && r.date === selectedDate && r.status === 'pending'
    );
    if (existing) {
      setFormError('A pending correction already exists for this date.');
      return;
    }

    setSubmitting(true);

    const req: CorrectionRequestType = {
      id:               `corr-${currentUser.id}-${Date.now()}`,
      employeeId:       currentUser.id,
      date:             selectedDate,
      currentStatus:    (selectedRecord?.status as AttendanceStatus) || 'absent',
      requestedStatus,
      currentCheckIn:   selectedRecord?.checkIn || null,
      requestedCheckIn: requestedCheckIn
        ? `${selectedDate}T${requestedCheckIn}:00+05:00`
        : null,
      currentCheckOut:  selectedRecord?.checkOut || null,
      requestedCheckOut: requestedCheckOut
        ? `${selectedDate}T${requestedCheckOut}:00+05:00`
        : null,
      reason:           reason.trim(),
      status:           'pending',
      requestedAt:      getPKTISOString(),
      reviewedBy:       null,
      reviewedAt:       null,
      reviewerNote:     null,
    };

    await addCorrectionRequest(req);

    // Notify self
    await addNotification({
      id:          `notif-${Date.now()}`,
      employeeId:  currentUser.id,
      type:        'general',
      title:       'Correction Request Submitted',
      message:     `Your attendance correction for ${selectedDate} has been submitted.`,
      isRead:      false,
      createdAt:   getPKTISOString(),
    });

    setSelectedDate('');
    setSelectedRecord(null);
    setRequestedCheckIn('');
    setRequestedCheckOut('');
    setReason('');
    setRefreshKey(k => k + 1);
    setSubmitting(false);
    showNotif('success', 'Correction request submitted!');
    setActiveTab('my-requests');
  };

  const handleApprove = async (req: CorrectionRequestType) => {
    const nowISO = getPKTISOString();

    // Apply correction to attendance record
    const rec = allRecords.find(
      r => r.employeeId === req.employeeId && r.date === req.date
    );

    if (rec) {
      // Update existing record
      const hours = req.requestedCheckIn && req.requestedCheckOut
        ? Math.round(
            (new Date(req.requestedCheckOut).getTime() - new Date(req.requestedCheckIn).getTime())
            / 3600000 * 100
          ) / 100
        : rec.totalHours;

      await updateAttendanceRecord(rec.id, {
        status:    req.requestedStatus,
        checkIn:   req.requestedCheckIn || rec.checkIn,
        checkOut:  req.requestedCheckOut || rec.checkOut,
        totalHours: hours,
      });
    }

    await updateCorrectionRequest(req.id, {
      status:       'approved',
      reviewedBy:   currentUser.id,
      reviewedAt:   nowISO,
      reviewerNote: reviewNote || null,
    });

    // Notify employee
    const emp = employees.find(e => e.id === req.employeeId);
    await addNotification({
      id:         `notif-${Date.now()}`,
      employeeId: req.employeeId,
      type:       'correction_approved',
      title:      '✅ Correction Approved!',
      message:    `Your attendance correction for ${req.date} has been approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
      isRead:     false,
      createdAt:  nowISO,
    });

    setReviewNote('');
    setReviewingId(null);
    setRefreshKey(k => k + 1);
    showNotif('success', `Correction approved for ${emp?.name || 'employee'}`);
  };

  const handleReject = async (req: CorrectionRequestType) => {
    if (!reviewNote.trim()) {
      showNotif('error', 'Please enter rejection reason.');
      return;
    }
    const nowISO = getPKTISOString();
    await updateCorrectionRequest(req.id, {
      status:       'rejected',
      reviewedBy:   currentUser.id,
      reviewedAt:   nowISO,
      reviewerNote: reviewNote,
    });

    const emp = employees.find(e => e.id === req.employeeId);
    await addNotification({
      id:         `notif-${Date.now()}`,
      employeeId: req.employeeId,
      type:       'correction_rejected',
      title:      '❌ Correction Rejected',
      message:    `Your correction for ${req.date} was rejected. Reason: ${reviewNote}`,
      isRead:     false,
      createdAt:  nowISO,
    });

    setReviewNote('');
    setReviewingId(null);
    setRefreshKey(k => k + 1);
    showNotif('warning', `Correction rejected for ${emp?.name || 'employee'}`);
  };

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all";
  const selectCls = "w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all cursor-pointer";

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
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Attendance Correction</h2>
              <p className="text-blue-200 text-xs font-bold">Request fixes for attendance records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && pendingCount > 0 && (
              <div className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-full border border-red-400 animate-pulse">
                {pendingCount} Pending
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={syncing}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center border border-white/10 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 text-white ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-1">
          {[
            { key: 'my-requests', label: 'My Requests', icon: '📋', show: true },
            { key: 'apply',       label: 'Apply',       icon: '✏️', show: true },
            { key: 'manage',      label: `Manage${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: '⚙️', show: isAdmin },
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

      {/* ===== MY REQUESTS ===== */}
      {activeTab === 'my-requests' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
            <h3 className="text-sm font-black text-slate-800">My Correction Requests</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {myRequests.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">✏️</span>
                </div>
                <p className="text-slate-400 font-bold text-sm">No correction requests yet</p>
                <p className="text-slate-300 text-xs mt-1">Use the Apply tab to request a correction</p>
              </div>
            ) : (
              myRequests.map(req => {
                const stCfg = REQUEST_STATUS[req.status];
                return (
                  <div key={req.id} className="px-5 py-4 hover:bg-slate-50/80 transition-all">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 ${stCfg.bg} rounded-xl flex items-center justify-center text-lg border ${stCfg.border} shrink-0`}>
                        {stCfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-slate-800">{req.date}</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${stCfg.bg} ${stCfg.color} ${stCfg.border}`}>
                            {stCfg.label}
                          </span>
                        </div>
                        {/* Status change */}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_STYLES[req.currentStatus] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {STATUS_LABELS[req.currentStatus] || req.currentStatus}
                          </span>
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_STYLES[req.requestedStatus] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {STATUS_LABELS[req.requestedStatus] || req.requestedStatus}
                          </span>
                        </div>
                        {/* Times */}
                        {(req.requestedCheckIn || req.requestedCheckOut) && (
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            {req.requestedCheckIn && `In: ${formatDisplay(req.requestedCheckIn)}`}
                            {req.requestedCheckIn && req.requestedCheckOut && ' · '}
                            {req.requestedCheckOut && `Out: ${formatDisplay(req.requestedCheckOut)}`}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">"{req.reason}"</p>
                        {req.reviewerNote && (
                          <p className="text-amber-600 text-xs font-bold mt-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            Note: {req.reviewerNote}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-slate-400 text-[10px] font-medium">
                          {req.requestedAt ? format(parseISO(req.requestedAt), 'dd MMM') : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== APPLY TAB ===== */}
      {activeTab === 'apply' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
            <h3 className="text-sm font-black text-slate-800">Request Attendance Correction</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Select the date you want to correct</p>
          </div>
          <div className="p-6 space-y-5">

            {/* Date picker */}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                max={getPKTDateString()}
                onChange={e => handleDateChange(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Current record info */}
            {selectedDate && (
              <div className={`rounded-2xl p-4 border ${selectedRecord ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className="text-xs font-black mb-2 text-slate-700">
                  {selectedRecord ? '📋 Current Record Found:' : '⚠️ No Record Found for this date'}
                </p>
                {selectedRecord ? (
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className={`px-2 py-1 rounded-lg font-bold border ${STATUS_STYLES[selectedRecord.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {STATUS_LABELS[selectedRecord.status] || selectedRecord.status}
                    </span>
                    {selectedRecord.checkIn && <span className="text-slate-600 font-medium">In: {formatDisplay(selectedRecord.checkIn)}</span>}
                    {selectedRecord.checkOut && <span className="text-slate-600 font-medium">Out: {formatDisplay(selectedRecord.checkOut)}</span>}
                    {selectedRecord.totalHours > 0 && <span className="text-[#1E40AF] font-bold">{selectedRecord.totalHours}h</span>}
                  </div>
                ) : (
                  <p className="text-amber-600 text-xs font-medium">You can still request to add a record for this date.</p>
                )}
              </div>
            )}

            {/* Requested changes */}
            {selectedDate && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Requested Status</label>
                  <select
                    value={requestedStatus}
                    onChange={e => setRequestedStatus(e.target.value as AttendanceStatus)}
                    className={selectCls}
                  >
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="half-day">Half Day</option>
                    <option value="work-from-home">Work From Home</option>
                    <option value="holiday-ot">Holiday OT</option>
                    <option value="on-leave">On Leave</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Requested Check In
                    </label>
                    <input
                      type="time"
                      value={requestedCheckIn}
                      onChange={e => setRequestedCheckIn(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Requested Check Out
                    </label>
                    <input
                      type="time"
                      value={requestedCheckOut}
                      onChange={e => setRequestedCheckOut(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Reason</label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Explain why this correction is needed..."
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    </svg>
                    <p className="text-red-600 text-xs font-bold">{formError}</p>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] disabled:from-slate-300 disabled:to-slate-400 text-white font-black rounded-2xl text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                      Submit Correction Request
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== MANAGE TAB (Admin) ===== */}
      {activeTab === 'manage' && isAdmin && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
            <div className="flex flex-wrap gap-3 items-center">
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

              <div className="relative">
                <select
                  value={filterEmployee}
                  onChange={e => setFilterEmployee(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl pl-4 pr-8 py-2 text-xs font-semibold focus:outline-none focus:border-[#1E40AF] transition-all cursor-pointer"
                >
                  <option value="all">All Employees</option>
                  {attEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <span className="ml-auto text-[10px] font-bold text-slate-400">
                {allRequests.length} requests
              </span>
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {allRequests.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✏️</span>
                  </div>
                  <p className="text-slate-400 font-bold text-sm">No correction requests found</p>
                </div>
              ) : (
                allRequests.map(req => {
                  const stCfg = REQUEST_STATUS[req.status];
                  const emp = employees.find(e => e.id === req.employeeId);
                  const isReviewing = reviewingId === req.id;

                  return (
                    <div key={req.id} className="px-5 py-4 hover:bg-slate-50/80 transition-all">
                      <div className="flex items-start gap-3">
                        {/* Employee Avatar */}
                        <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 shadow-md shadow-blue-500/20">
                          {getInitials(emp?.name || '?')}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Header */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-800">{emp?.name || 'Unknown'}</p>
                            <span className="text-slate-400 text-xs font-medium">{req.date}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${stCfg.bg} ${stCfg.color} ${stCfg.border}`}>
                              {stCfg.icon} {stCfg.label}
                            </span>
                          </div>

                          {/* Status change */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_STYLES[req.currentStatus] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {STATUS_LABELS[req.currentStatus] || req.currentStatus}
                            </span>
                            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${STATUS_STYLES[req.requestedStatus] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {STATUS_LABELS[req.requestedStatus] || req.requestedStatus}
                            </span>
                          </div>

                          {/* Requested times */}
                          {(req.requestedCheckIn || req.requestedCheckOut) && (
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              Requested:
                              {req.requestedCheckIn && ` In: ${formatDisplay(req.requestedCheckIn)}`}
                              {req.requestedCheckIn && req.requestedCheckOut && ' ·'}
                              {req.requestedCheckOut && ` Out: ${formatDisplay(req.requestedCheckOut)}`}
                            </p>
                          )}

                          {/* Reason */}
                          <p className="text-xs text-slate-500 font-medium mt-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                            "{req.reason}"
                          </p>

                          {/* Reviewer note */}
                          {req.reviewerNote && (
                            <p className="text-amber-600 text-xs font-bold mt-1.5 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                              Note: {req.reviewerNote}
                            </p>
                          )}

                          {/* Actions */}
                          {req.status === 'pending' && (
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
                                      onClick={() => handleApprove(req)}
                                      className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                      ✓ Approve & Apply
                                    </button>
                                    <button
                                      onClick={() => handleReject(req)}
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
                                  onClick={() => setReviewingId(req.id)}
                                  className="px-4 py-2 bg-[#1E40AF] hover:bg-[#1d4ed8] text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-md shadow-blue-500/20"
                                >
                                  Review Request →
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-slate-400 text-[10px] font-medium">
                            {req.requestedAt ? format(parseISO(req.requestedAt), 'dd MMM') : '—'}
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