// src/components/Dashboard.tsx

import { useState, useEffect, useCallback } from 'react';
import { Employee, AttendanceRecord, WFHRequest } from '../types';
import {
  getEmployees, getAttendanceEmployees, getAttendanceRecords,
  getTodayRecord, getActiveRecord, addAttendanceRecord, updateAttendanceRecord,
  getEmployeeTiming, getLocationFromIP, canSeeOT,
  getWFHRequests, addWFHRequest, updateWFHRequest,
  getTodayWFHRequest, getPendingWFHRequests,
  getPendingAccountRequests, updateAccountRequest, addEmployee, syncAll,
  getPKTDate, getPKTDateString, getPKTISOString, isHoliday
} from '../store';
import { verifyWiFiConnection } from '../wifiService';
import { format, parseISO } from 'date-fns';
import AnalogClock from './AnalogClock';
import LateWarningModal from './LateWarningModal';
import EarlyCheckoutModal from './EarlyCheckoutModal';
import OfficeDistance from './OfficeDistance';
import AllOfficesDistance from './AllOfficesDistance';
import { isAdminOrManager } from '../utils/employeeOffice';
import WeatherWidget from './WeatherWidget';

interface DashboardProps { currentUser: Employee; onLogout: () => void; }

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [officeLocation, setOfficeLocation] = useState<string | null>(null);
  const [displayLabel, setDisplayLabel] = useState<string>('');
  const [detectedIP, setDetectedIP] = useState('');
  const [currentTime, setCurrentTime] = useState(getPKTDate());
  const [checkingIn, setCheckingIn] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [todayAllRecords, setTodayAllRecords] = useState<AttendanceRecord[]>([]);
  const [showWFHModal, setShowWFHModal] = useState(false);
  const [wfhReason, setWfhReason] = useState('');
  const [todayWFHRequest, setTodayWFHRequest] = useState<WFHRequest | null>(null);
  const [pendingWFHRequests, setPendingWFHRequests] = useState<WFHRequest[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [gpsOff, setGpsOff] = useState(false);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [pendingCheckIn, setPendingCheckIn] = useState<any>(null);
  const [showEarlyCheckoutModal, setShowEarlyCheckoutModal] = useState(false);
  const [officeDistance, setOfficeDistance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isManagerOnly = currentUser.role === 'manager';
  const canMarkAttendance = !isManagerOnly;
  const showOT = canSeeOT(currentUser.id);
  const canSeeAccountRequests = currentUser.id === 'emp-001' || currentUser.id === 'emp-005';

  const getInitials = (name: string) =>
    name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  const formatTime12hr = useCallback((isoString: string | null | undefined) => {
    if (!isoString) return '—';
    try {
      const pktMatch = isoString.match(/T(\d{2}):(\d{2}).*\+05:00/);
      if (pktMatch) {
        let h = parseInt(pktMatch[1], 10);
        const m = pktMatch[2];
        const period = h >= 12 ? 'pm' : 'am';
        if (h === 0) h = 12; else if (h > 12) h -= 12;
        return `${String(h).padStart(2, '0')}:${m} ${period}`;
      }
      const utcMatch = isoString.match(/T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|\+00:00)?/);
      if (utcMatch) {
        let h = parseInt(utcMatch[1], 10) + 5;
        if (h >= 24) h -= 24;
        const m = utcMatch[2];
        const period = h >= 12 ? 'pm' : 'am';
        if (h === 0) h = 12; else if (h > 12) h -= 12;
        return `${String(h).padStart(2, '0')}:${m} ${period}`;
      }
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '—';
      let h = date.getUTCHours() + 5;
      if (h >= 24) h -= 24;
      const m = String(date.getUTCMinutes()).padStart(2, '0');
      const period = h >= 12 ? 'pm' : 'am';
      if (h === 0) h = 12; else if (h > 12) h -= 12;
      return `${String(h).padStart(2, '0')}:${m} ${period}`;
    } catch { return '—'; }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(getPKTDate()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const initSync = async () => {
      await syncAll();
      if (canMarkAttendance) await checkOfficeStatus();
      loadTodayData();
    };
    initSync();
    const syncInterval = setInterval(async () => {
      await syncAll();
      loadTodayData();
    }, 5000);
    return () => clearInterval(syncInterval);
  }, [currentUser]);

  const showNotif = useCallback((type: string, msg: string) => {
    setNotification({ type, message: msg });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const checkOfficeStatus = async () => {
    setOfficeLocation(null);
    setDisplayLabel('');
    setGpsOff(false);
    const result = await verifyWiFiConnection();
    setDetectedIP(result.ipAddress);
    if (result.distance !== undefined) {
      setOfficeDistance(result.distance);
    }
    if (result.method === 'gps-off' || result.method === 'gps-failed') {
      setGpsOff(true);
      setOfficeLocation('');
      setDisplayLabel('📍 Location Off');
      showNotif('error', '⚠️ GPS is OFF — Please enable GPS for location verification.');
      return;
    }
    if (result.isConnected) {
      const rawLoc = result.locationLabel || getLocationFromIP(result.ipAddress);
      setOfficeLocation(rawLoc);
      if (rawLoc === 'PK Zone') setDisplayLabel('In PK Zone Office');
      else if (rawLoc === 'QC Center') setDisplayLabel('In QC Center Office');
      else if (rawLoc === 'Z House') setDisplayLabel('In Z House Office');
      else setDisplayLabel(`In ${rawLoc} Office`);
    } else {
      setOfficeLocation('');
      setDisplayLabel('Not in Office');
    }
  };

  const loadTodayData = useCallback(() => {
    if (canMarkAttendance) {
      const active = getActiveRecord(currentUser.id);
      const today = getTodayRecord(currentUser.id);
      setTodayRecord((active || today) ?? null);
      setTodayWFHRequest(getTodayWFHRequest(currentUser.id) || null);
    }
    if (isAdmin) {
      const today = getPKTDateString();
      setTodayAllRecords(getAttendanceRecords().filter(r => r.date === today));
      setPendingWFHRequests(getPendingWFHRequests());
      if (canSeeAccountRequests) setPendingAccounts(getPendingAccountRequests());
    }
  }, [currentUser, canMarkAttendance, isAdmin, canSeeAccountRequests]);

  const handleCheckIn = async () => {
    if (!officeLocation) {
      if (gpsOff) showNotif('error', '⚠️ GPS is OFF — Please enable GPS first.');
      else showNotif('error', 'You must be in office!');
      return;
    }
    setCheckingIn(true);
    const result = await verifyWiFiConnection();
    if (!result.isConnected) {
      setCheckingIn(false); setOfficeLocation(''); setDisplayLabel('Not in Office');
      showNotif('error', 'Not in office!'); return;
    }
    const now = getPKTDate();
    const localDate = getPKTDateString();
    const isSunday = now.getDay() === 0;
    const t = getEmployeeTiming(currentUser.id);
    const [sH, sM] = t.officeStartTime.split(':').map(Number);
    const offStart = new Date(now); offStart.setHours(sH, sM, 0, 0);
    const lateThr = new Date(offStart); lateThr.setMinutes(lateThr.getMinutes() + t.lateThresholdMinutes);
    const isLate = isSunday ? false : now > lateThr;
    const loc = getLocationFromIP(result.ipAddress);
    const localISOString = getPKTISOString();
    const record: AttendanceRecord = {
      id: `${currentUser.id}-${localDate}`, employeeId: currentUser.id,
      date: localDate, checkIn: localISOString, checkOut: null,
      status: isLate ? 'late' : 'present', totalHours: 0, wifiVerified: true,
      ipAddress: result.ipAddress, notes: isSunday ? `SUNDAY OT | ${loc}` : loc,
    };

    // 🆕 Late Warning Modal
    if (isLate && !isSunday) {
      const lateMin = Math.round((now.getTime() - lateThr.getTime()) / 60000);
      setLateMinutes(lateMin);
      setPendingCheckIn(record);
      setShowLateModal(true);
      setCheckingIn(false);
      return;
    }

    await addAttendanceRecord(record);
    await syncAll();
    setTodayRecord(record);
    setCheckingIn(false);
    const msg = isSunday ? `Sunday OT Check-in at ${loc}` : `Checked in at ${loc}`;
    showNotif('success', msg);
    loadTodayData();
  };

  // 🆕 Late Reason Handlers
  const handleLateReasonSubmit = async (reason: string) => {
    if (!pendingCheckIn) return;
    const recordWithReason = {
      ...pendingCheckIn,
      notes: `${pendingCheckIn.notes} | Late Reason: ${reason}`,
    };
    await addAttendanceRecord(recordWithReason);
    await syncAll();
    setTodayRecord(recordWithReason);
    setShowLateModal(false);
    setPendingCheckIn(null);
    showNotif('warning', `Late check-in recorded. Reason: ${reason}`);
    loadTodayData();
  };

  const handleLateReasonSkip = async () => {
    if (!pendingCheckIn) return;
    await addAttendanceRecord(pendingCheckIn);
    await syncAll();
    setTodayRecord(pendingCheckIn);
    setShowLateModal(false);
    setPendingCheckIn(null);
    showNotif('warning', 'Late check-in recorded');
    loadTodayData();
  };

  const handleCheckOut = async (force: boolean = false) => {
    if (!todayRecord) return;

    // 🆕 Early Checkout Warning
    if (!force && todayRecord.checkIn) {
      const checkNow = getPKTDate();
      const startTime = new Date(todayRecord.checkIn);
      const hoursWorked = (checkNow.getTime() - startTime.getTime()) / 3600000;
      const timing = getEmployeeTiming(currentUser.id);

      if (hoursWorked < timing.minHoursForFullDay && hoursWorked >= 0) {
        setShowEarlyCheckoutModal(true);
        return;
      }
    }

    const networkStatus = await verifyWiFiConnection();
    const isInsideOffice = networkStatus.isConnected;

    const now = getPKTDate();
    const isSunday = new Date(todayRecord.date).getDay() === 0;
    const isHolidayShift = isHoliday(todayRecord.date);
    const start = todayRecord.checkIn ? new Date(todayRecord.checkIn) : now;
    const totalHours = Math.round((now.getTime() - start.getTime()) / 3600000 * 100) / 100;
    const t = getEmployeeTiming(currentUser.id);
    let status = todayRecord.status;
    let otHours = 0;
    let overtime_hours = 0;
    const loc = getLocationFromIP(todayRecord.ipAddress);
    let notes = loc;

    if (isHolidayShift) {
      status = 'holiday-ot'; otHours = totalHours; overtime_hours = totalHours;
      notes = `HOLIDAY OT: ${otHours}h | ${loc}`;
    } else if (isSunday) {
      otHours = totalHours; overtime_hours = totalHours;
      notes = `SUNDAY OT: ${otHours}h | ${loc}`;
    } else {
      if (totalHours < t.minHoursForHalfDay) status = 'half-day';
      else if (todayRecord.status === 'late') status = 'late';
      if (totalHours > t.minHoursForFullDay) {
        otHours = Math.round((totalHours - t.minHoursForFullDay) * 100) / 100;
        overtime_hours = otHours;
        notes = `OT: ${otHours}h | ${loc}`;
      }
    }

    let wifiVerified = true;
    if (!isInsideOffice) { wifiVerified = false; notes += ' | ⚠️ OUTSIDE OFFICE (Unverified)'; }
    const localISOString = getPKTISOString();
    await updateAttendanceRecord(todayRecord.id, { checkOut: localISOString, totalHours, status, notes, wifiVerified, overtime_hours });
    await syncAll();
    setTodayRecord({ ...todayRecord, checkOut: localISOString, totalHours, status, notes, wifiVerified, overtime_hours });
    if (!isInsideOffice) setShowWarningModal(true);
    else showNotif('success', `Checked out! ${totalHours.toFixed(1)}h${otHours > 0 ? ` (OT: +${otHours}h)` : ''}`);
    loadTodayData();
  };

  const handleWFHRequest = () => {
    if (!wfhReason.trim()) { showNotif('error', 'Enter reason'); return; }
    const localDate = getPKTDateString();
    const localISOString = getPKTISOString();
    addWFHRequest({ id: `wfh-${currentUser.id}-${localDate}`, employeeId: currentUser.id, date: localDate, reason: wfhReason, status: 'pending', requestedAt: localISOString, reviewedBy: null, reviewedAt: null });
    setTodayWFHRequest({ id: '', employeeId: currentUser.id, date: '', reason: wfhReason, status: 'pending', requestedAt: '', reviewedBy: null, reviewedAt: null });
    setShowWFHModal(false); setWfhReason(''); showNotif('success', 'WFH request sent!');
  };

  const handleApproveWFH = (req: WFHRequest) => {
    const nowISO = getPKTISOString();
    updateWFHRequest(req.id, { status: 'approved', reviewedBy: currentUser.id, reviewedAt: nowISO });
    addAttendanceRecord({ id: `${req.employeeId}-${req.date}`, employeeId: req.employeeId, date: req.date, checkIn: nowISO, checkOut: null, status: 'work-from-home', totalHours: 0, wifiVerified: false, ipAddress: 'WFH', notes: `WFH: ${req.reason}` });
    loadTodayData(); showNotif('success', 'WFH approved');
  };

  const handleRejectWFH = (req: WFHRequest) => {
    updateWFHRequest(req.id, { status: 'rejected', reviewedBy: currentUser.id, reviewedAt: getPKTISOString() });
    loadTodayData(); showNotif('warning', 'WFH rejected');
  };

  const handleApproveAccount = (req: any, role: string) => {
    const avatar = req.name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    addEmployee({ id: `emp-${Date.now()}`, name: req.name, role: role as any, pin: req.pin, avatar });
    updateAccountRequest(req.id, { status: 'approved', approvedRole: role as any, reviewedBy: currentUser.id });
    loadTodayData(); showNotif('success', `${req.name} approved as ${role}`);
  };

  const handleRejectAccount = (req: any) => {
    updateAccountRequest(req.id, { status: 'rejected', reviewedBy: currentUser.id });
    loadTodayData(); showNotif('warning', 'Request rejected');
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  };

  const statusStyle = (s: string) => {
    const m: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      late: 'bg-amber-50 text-amber-700 border-amber-200',
      absent: 'bg-red-50 text-red-700 border-red-200',
      'half-day': 'bg-orange-50 text-orange-700 border-orange-200',
      'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
      'holiday-ot': 'bg-purple-50 text-purple-700 border-purple-200',
    };
    return m[s] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getLiveHours = () => {
    if (!todayRecord?.checkIn) return '0h 00m';
    try {
      const diff = (todayRecord.checkOut ? new Date(todayRecord.checkOut) : currentTime).getTime() - new Date(todayRecord.checkIn).getTime();
      if (isNaN(diff) || diff < 0) return '0h 00m';
      return `${Math.floor(diff / 3600000)}h ${String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')}m`;
    } catch { return '0h 00m'; }
  };

  const getLiveOT = () => {
    if (!todayRecord?.checkIn) return 0;
    try {
      const diff = (todayRecord.checkOut ? new Date(todayRecord.checkOut) : currentTime).getTime() - new Date(todayRecord.checkIn).getTime();
      if (isNaN(diff) || diff < 0) return 0;
      const hrs = diff / 3600000;
      const isSunday = new Date(todayRecord.date).getDay() === 0;
      if (isSunday) return Math.round(hrs * 100) / 100;
      const t = getEmployeeTiming(currentUser.id);
      return hrs > t.minHoursForFullDay ? Math.round((hrs - t.minHoursForFullDay) * 100) / 100 : 0;
    } catch { return 0; }
  };

  const safeFormatDate = (dateStr: string | null | undefined, formatStr: string) => {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), formatStr); } catch { return '—'; }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      present: '✓ Present', late: '⚠ Late', 'half-day': '½ Half Day',
      'work-from-home': '🏠 WFH', 'holiday-ot': '🌟 Holiday OT', absent: '✕ Absent',
    };
    return labels[s] || s.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* 🆕 Late Warning Modal */}
      <LateWarningModal
        isOpen={showLateModal}
        minutesLate={lateMinutes}
        onSubmit={handleLateReasonSubmit}
        onSkip={handleLateReasonSkip}
      />

      {/* 🆕 Early Checkout Modal */}
      <EarlyCheckoutModal
        isOpen={showEarlyCheckoutModal}
        hoursWorked={todayRecord?.checkIn ? (getPKTDate().getTime() - new Date(todayRecord.checkIn).getTime()) / 3600000 : 0}
        minHours={getEmployeeTiming(currentUser.id).minHoursForFullDay}
        onConfirm={() => { setShowEarlyCheckoutModal(false); handleCheckOut(true); }}
        onCancel={() => setShowEarlyCheckoutModal(false)}
      />

      {/* ===== NOTIFICATION TOAST ===== */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] px-5 py-3.5 rounded-2xl shadow-2xl animate-slide-down flex items-center gap-3 text-sm font-bold max-w-[92%] backdrop-blur-md border ${
          notification.type === 'success' ? 'bg-emerald-600/95 text-white border-emerald-500' :
          notification.type === 'error' ? 'bg-red-600/95 text-white border-red-500' :
          'bg-amber-500/95 text-white border-amber-400'
        }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white/20`}>
            {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : '⚠'}
          </div>
          <span className="flex-1">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ===== WFH MODAL ===== */}
      {showWFHModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-scale-up border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">Work From Home</h3>
                <p className="text-xs text-slate-400 font-medium">Submit your WFH request</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</label>
              <textarea
                value={wfhReason}
                onChange={e => setWfhReason(e.target.value || "")}
                placeholder="Why do you need to work from home?"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] bg-slate-50/50 placeholder-slate-400 transition-all"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowWFHModal(false); setWfhReason(''); }} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all active:scale-[0.98]">
                Cancel
              </button>
              <button onClick={handleWFHRequest} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98]">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== QUIT CONFIRM MODAL ===== */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-scale-up border border-slate-200 text-center">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-2xl flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1">Quit Attendify?</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">You will be logged out of your session.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitConfirm(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all active:scale-[0.98]">
                Stay
              </button>
              <button onClick={onLogout} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-600/20 transition-all active:scale-[0.98]">
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== WARNING MODAL ===== */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md animate-scale-up border-2 border-red-400">
            <div className="flex items-center justify-center w-20 h-20 mx-auto bg-red-100 rounded-3xl mb-5">
              <span className="text-4xl">🚨</span>
            </div>
            <h3 className="text-2xl font-black text-red-600 text-center mb-4">Security Violation</h3>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <p className="text-slate-700 text-sm text-center leading-relaxed font-medium">
                ⚠️ You are <span className="font-black text-red-600">not connected</span> to office WiFi. Your check-out has been marked as <span className="font-black">'Unverified / Outside Office'</span> and an alert has been sent to Admin.
              </p>
            </div>
            <button
              onClick={() => setShowWarningModal(false)}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-sm transition-all shadow-lg shadow-red-600/20"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* ===== MAIN LAYOUT ===== */}
      <div className={`max-w-5xl mx-auto p-4 md:p-6 space-y-5 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* ===== TOP HEADER BAR ===== */}
        <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 md:p-6 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center text-sm font-black border border-white/20 shadow-inner">
                {getInitials(currentUser.name)}
              </div>
              <div>
                <p className="text-blue-200 text-xs font-bold tracking-wide">{getGreeting()}</p>
                <h1 className="text-lg md:text-xl font-black tracking-tight leading-tight">{currentUser.name}</h1>
                {isAdmin && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest">
                      {isManagerOnly ? 'Manager' : 'Admin'} Panel
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <WeatherWidget />
              <div className="hidden sm:block text-right">
                <p className="text-white font-bold text-sm">{format(currentTime, 'EEEE')}</p>
                <p className="text-blue-200 text-xs font-medium">{format(currentTime, 'dd MMMM yyyy')}</p>
              </div>
              <button
                onClick={() => setShowQuitConfirm(true)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10 transition-all active:scale-95"
                aria-label="Quit"
              >
                <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ===== ACCOUNT REQUESTS ===== */}
        {canSeeAccountRequests && pendingAccounts.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                New Account Requests
                <span className="ml-auto bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingAccounts.length}</span>
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {pendingAccounts.map((req: any) => (
                <div key={req.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-blue-200 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-[10px] font-black shadow-md shadow-blue-500/20">
                        {getInitials(req.name)}
                      </div>
                      <div>
                        <p className="text-slate-800 font-bold text-sm">{req.name}</p>
                        <p className="text-slate-400 text-[10px] font-medium">{safeFormatDate(req.requestedAt, 'dd MMM hh:mm a')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleApproveAccount(req, 'employee')} className="px-3.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all active:scale-95">
                      ✓ Employee
                    </button>
                    <button onClick={() => handleApproveAccount(req, 'admin')} className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl text-xs font-bold transition-all active:scale-95">
                      ✓ Admin
                    </button>
                    <button onClick={() => handleApproveAccount(req, 'manager')} className="px-3.5 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-xs font-bold transition-all active:scale-95">
                      ✓ Manager
                    </button>
                    <button onClick={() => handleRejectAccount(req)} className="px-3.5 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all active:scale-95 ml-auto">
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== ATTENDANCE CARD ===== */}
        {canMarkAttendance && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-8 flex flex-col items-center">
              <AnalogClock size={190} />

              <div className="mt-5 text-center">
                <p className="text-4xl font-black text-slate-800 font-mono tracking-wider">
                  {format(currentTime, 'hh:mm:ss')}
                  <span className="text-base text-slate-400 ml-2 font-bold tracking-normal">{format(currentTime, 'a')}</span>
                </p>
                <p className="text-slate-400 text-xs font-bold mt-1 sm:hidden">{format(currentTime, 'EEEE, dd MMM yyyy')}</p>
                {currentTime.getDay() === 0 && (
                  <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full">
                    <span className="text-purple-600 text-xs font-bold">🌟 Sunday — Overtime Day</span>
                  </div>
                )}
              </div>

              {/* Location Badge */}
              <div className={`mt-5 flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-sm font-bold border transition-all ${
                officeLocation === null && !gpsOff
                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                  : displayLabel.includes('Office')
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : displayLabel === '📍 Location Off'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-red-50 text-red-600 border-red-200'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  officeLocation === null && !gpsOff
                    ? 'bg-slate-400 animate-pulse'
                    : displayLabel.includes('Office')
                      ? 'bg-emerald-500'
                      : displayLabel === '📍 Location Off'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                }`} />
                {officeLocation === null && !gpsOff ? 'Detecting Location...' : displayLabel}
              </div>

                            {/* 🆕 Office Distance — Role Based */}
              {isAdminOrManager(currentUser.role) ? (
                <div className="mt-3 w-full max-w-xs">
                  <AllOfficesDistance />
                </div>
              ) : (
                officeDistance !== null && (
                  <div className="mt-3 w-full max-w-xs">
                    <OfficeDistance
                      distance={officeDistance}
                      isInside={!!officeLocation}
                      locationName={officeLocation || undefined}
                    />
                  </div>
                )
              )}

              {/* Action Area */}
              <div className="mt-7 w-full max-w-xs">
                {!todayRecord ? (
                  <div className="space-y-3">
                    {todayWFHRequest && (
                      <div className={`p-4 rounded-2xl text-center text-sm font-bold border ${
                        todayWFHRequest.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : todayWFHRequest.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {todayWFHRequest.status === 'pending' ? '⏳ WFH Request Pending...' :
                         todayWFHRequest.status === 'approved' ? '✓ WFH Approved' : '✕ WFH Rejected'}
                      </div>
                    )}

                    {officeLocation ? (
                      <button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] disabled:from-slate-300 disabled:to-slate-400 text-white font-bold text-base transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/35 active:scale-[0.98] disabled:shadow-none"
                      >
                        {checkingIn ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Verifying...
                          </span>
                        ) : (
                          `Check In — ${officeLocation}`
                        )}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-bold cursor-not-allowed border border-slate-200">
                          {displayLabel === '📍 Location Off' ? '📍 Enable GPS to Check In' : officeLocation === null ? 'Detecting...' : 'Not in Office'}
                        </button>
                        {!todayWFHRequest && (
                          <button
                            onClick={() => setShowWFHModal(true)}
                            className="w-full py-3.5 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-bold hover:bg-blue-50 text-sm transition-all active:scale-[0.98]"
                          >
                            🏠 Request Work From Home
                          </button>
                        )}
                      </div>
                    )}
                    <button
                      onClick={checkOfficeStatus}
                      disabled={officeLocation === null && !gpsOff}
                      className="w-full py-2.5 text-xs text-slate-400 hover:text-[#1E40AF] disabled:opacity-40 font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                      Refresh Location
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* 🆕 Today's Check-in Prominent */}
                    {todayRecord.checkIn && (
                      <div className="bg-gradient-to-r from-[#1E40AF] to-[#2563EB] rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
                        <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Today's Check-in</p>
                        <p className="text-3xl font-black font-mono">{formatTime12hr(todayRecord.checkIn)}</p>
                        <p className="text-blue-100 text-xs font-bold mt-1">
                          📍 {getLocationFromIP(todayRecord.ipAddress)}
                        </p>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="text-center flex flex-wrap items-center justify-center gap-2">
                      <span className={`inline-flex items-center px-4 py-2 rounded-2xl text-sm font-black border ${statusStyle(todayRecord.status)}`}>
                        {statusLabel(todayRecord.status)}
                      </span>
                      {todayRecord.notes?.includes('SUNDAY') && (
                        <span className="px-3 py-2 bg-purple-50 text-purple-600 rounded-2xl text-xs font-bold border border-purple-200">
                          🌟 Sunday OT
                        </span>
                      )}
                    </div>

                    {/* Stats Card */}
                    <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Location</span>
                        <span className="text-[#1E40AF] font-bold">{getLocationFromIP(todayRecord.ipAddress)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Check In</span>
                        <span className="text-slate-800 font-bold font-mono">{formatTime12hr(todayRecord.checkIn)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Check Out</span>
                        <span className="text-slate-800 font-bold font-mono">{formatTime12hr(todayRecord.checkOut)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">Working Time</span>
                        <span className="text-[#1E40AF] font-black font-mono text-base">{getLiveHours()}</span>
                      </div>
                      {showOT && getLiveOT() > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">Overtime</span>
                          <span className="text-purple-600 font-black font-mono">+{getLiveOT()}h</span>
                        </div>
                      )}
                    </div>

                    {/* Check Out Button */}
                    {!todayRecord.checkOut ? (
                      <button
                        onClick={() => handleCheckOut()}
                        className="w-full py-4 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Check Out
                      </button>
                    ) : (
                      <div className="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <p className="text-emerald-700 text-sm font-black flex items-center justify-center gap-2">
                          ✓ Day Complete — {typeof todayRecord.totalHours === 'number' ? todayRecord.totalHours.toFixed(1) : '0.0'}h
                        </p>
                        {showOT && todayRecord.notes?.includes('OT') && (
                          <p className="text-purple-600 text-xs font-bold mt-1">Overtime recorded ✓</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== MANAGER ONLY HEADER ===== */}
        {isManagerOnly && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-lg shadow-blue-500/20">
                {getInitials(currentUser.name)}
              </div>
              <div className="flex-1">
                <p className="text-slate-400 text-xs font-bold">{getGreeting()}</p>
                <h1 className="text-lg font-black text-slate-800">{currentUser.name}</h1>
                <p className="text-[#1E40AF] text-[10px] font-black uppercase tracking-widest">Manager Panel</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-800 font-mono">{format(currentTime, 'hh:mm')}</p>
                <p className="text-slate-400 text-xs font-medium">{format(currentTime, 'EEEE, dd MMM yyyy')}</p>
              </div>
            </div>
          </div>
        )}

        {/* ===== PENDING WFH REQUESTS ===== */}
        {isAdmin && pendingWFHRequests.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                Pending WFH Requests
                <span className="ml-auto bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingWFHRequests.length}</span>
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {pendingWFHRequests.map(req => {
                const emp = getEmployees().find(e => e.id === req.employeeId);
                return (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-amber-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl flex items-center justify-center text-xs font-black shadow-md">
                        {emp ? getInitials(emp.name) : '?'}
                      </div>
                      <div>
                        <p className="text-slate-800 font-bold text-sm">{emp?.name || 'Unknown'}</p>
                        <p className="text-slate-500 text-xs font-medium">{req.reason}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveWFH(req)} className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all active:scale-95">
                        ✓ Approve
                      </button>
                      <button onClick={() => handleRejectWFH(req)} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all active:scale-95">
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== TODAY'S TEAM ===== */}
        {isAdmin && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  Today's Team
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(currentTime, 'dd MMM yyyy')}</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {getAttendanceEmployees().map(emp => {
                const rec = todayAllRecords.find(r => r.employeeId === emp.id);
                const wfhReq = getWFHRequests().find(r => r.employeeId === emp.id && r.date === getPKTDateString());
                const t = getEmployeeTiming(emp.id);
                const otHrs = rec && typeof rec.totalHours === 'number' && rec.totalHours > 0 ? Math.max(0, rec.totalHours - t.minHoursForFullDay) : 0;
                const isSunOT = rec?.notes?.includes('SUNDAY');
                return (
                  <div key={emp.id} className="flex items-center justify-between py-3.5 px-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border shadow-sm ${
                        rec ? 'bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white border-blue-300' : 'bg-white text-slate-500 border-slate-200'
                      }`}>
                        {getInitials(emp.name)}
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm font-bold">{emp.name}</p>
                        <p className="text-slate-400 text-[10px] font-medium flex flex-wrap items-center gap-1">
                          {rec && <span>{getLocationFromIP(rec.ipAddress)}</span>}
                          {isSunOT && <span className="text-purple-500">• Sunday OT</span>}
                          {rec?.notes?.includes('OUTSIDE OFFICE') && (
                            <span className="text-red-600 font-black animate-pulse">• ⚠️ Outside</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {rec ? (
                        <>
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black border ${statusStyle(rec.status)}`}>
                            {rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}
                          </span>
                          <p className="text-slate-400 text-[10px] font-medium mt-1">
                            {rec.checkIn ? formatTime12hr(rec.checkIn) : ''}
                            {showOT && otHrs > 0 ? ` • OT:+${otHrs.toFixed(1)}h` : ''}
                          </p>
                        </>
                      ) : wfhReq?.status === 'pending' ? (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                          WFH PENDING
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-400 border border-slate-200">
                          NOT IN
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== STATS GRID ===== */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Present', value: todayAllRecords.filter(r => r.status === 'present').length, color: 'text-emerald-600', bg: 'from-emerald-50 to-green-50', border: 'border-emerald-200', icon: '✓' },
              { label: 'Late', value: todayAllRecords.filter(r => r.status === 'late').length, color: 'text-amber-600', bg: 'from-amber-50 to-yellow-50', border: 'border-amber-200', icon: '⚠' },
              { label: 'WFH', value: todayAllRecords.filter(r => r.status === 'work-from-home').length, color: 'text-blue-600', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-200', icon: '🏠' },
              { label: 'Absent', value: getAttendanceEmployees().length - todayAllRecords.length, color: 'text-red-600', bg: 'from-red-50 to-rose-50', border: 'border-red-200', icon: '✕' },
              { label: 'Total', value: getAttendanceEmployees().length, color: 'text-slate-700', bg: 'from-slate-50 to-slate-100', border: 'border-slate-200', icon: '👥' },
            ].map(s => (
              <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-2xl p-4 text-center border ${s.border} shadow-sm hover:shadow-md transition-all`}>
                <p className="text-[10px] font-bold text-slate-400 mb-1">{s.icon}</p>
                <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ===== QUIT BUTTON ===== */}
        <div className="pt-2 pb-8">
          <button
            onClick={() => setShowQuitConfirm(true)}
            className="w-full py-3.5 rounded-2xl border border-red-200 text-red-500 hover:bg-red-50 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            Quit Attendify
          </button>
        </div>

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-[10px] font-bold text-slate-400 tracking-wide">© {new Date().getFullYear()} Attendify Inc. All rights reserved.</p>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-down { animation: slideDown 0.35s ease-out forwards; }
        .animate-scale-up { animation: scaleUp 0.25s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}