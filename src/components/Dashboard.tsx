import { useState, useEffect } from 'react';
import { Employee, AttendanceRecord, WFHRequest } from '../types';
import { 
  getEmployees, getAttendanceEmployees, getAttendanceRecords, 
  getTodayRecord, addAttendanceRecord, updateAttendanceRecord, 
  getEmployeeTiming, getLocationFromIP, canSeeOT,
  getWFHRequests, addWFHRequest, updateWFHRequest,
  getTodayWFHRequest, getPendingWFHRequests,
  getPendingAccountRequests, updateAccountRequest, addEmployee, syncAll
} from '../store';
import { verifyWiFiConnection } from '../wifiService';
import { format, parseISO } from 'date-fns';
import AnalogClock from './AnalogClock';

interface DashboardProps { currentUser: Employee; onLogout: () => void; }

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [officeLocation, setOfficeLocation] = useState<string | null>(null);
  const [detectedIP, setDetectedIP] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkingIn, setCheckingIn] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [todayAllRecords, setTodayAllRecords] = useState<AttendanceRecord[]>([]);
  const [showWFHModal, setShowWFHModal] = useState(false);
  const [wfhReason, setWfhReason] = useState('');
  const [todayWFHRequest, setTodayWFHRequest] = useState<WFHRequest | null>(null);
  const [pendingWFHRequests, setPendingWFHRequests] = useState<WFHRequest[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<any[]>([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isManagerOnly = currentUser.role === 'manager';
  const canMarkAttendance = !isManagerOnly;
  const showOT = canSeeOT(currentUser.id);
  const canSeeAccountRequests = currentUser.id === 'emp-001' || currentUser.id === 'emp-005';

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { syncAll().then(() => { if (canMarkAttendance) checkOfficeStatus(); loadTodayData(); }); }, []);

  const showNotif = (type: string, msg: string) => { setNotification({ type, message: msg }); setTimeout(() => setNotification(null), 3000); };

  const checkOfficeStatus = async () => {
    setOfficeLocation(null);
    const result = await verifyWiFiConnection();
    setDetectedIP(result.ipAddress);
    setOfficeLocation(result.isConnected ? getLocationFromIP(result.ipAddress) : '');
  };

  const loadTodayData = () => {
    if (canMarkAttendance) {
      setTodayRecord(getTodayRecord(currentUser.id) || null);
      setTodayWFHRequest(getTodayWFHRequest(currentUser.id) || null);
    }
    if (isAdmin) {
      const today = new Date().toISOString().split('T')[0];
      setTodayAllRecords(getAttendanceRecords().filter(r => r.date === today));
      setPendingWFHRequests(getPendingWFHRequests());
      if (canSeeAccountRequests) setPendingAccounts(getPendingAccountRequests());
    }
  };

  const handleCheckIn = async () => {
    if (!officeLocation) { showNotif('error', 'You must be in office!'); return; }
    setCheckingIn(true);
    const result = await verifyWiFiConnection();
    if (!result.isConnected) { setCheckingIn(false); setOfficeLocation(''); showNotif('error', 'Not in office!'); return; }
    const now = new Date();
    const isSunday = now.getDay() === 0;
    const t = getEmployeeTiming(currentUser.id);
    const [sH, sM] = t.officeStartTime.split(':').map(Number);
    const offStart = new Date(now); offStart.setHours(sH, sM, 0, 0);
    const lateThr = new Date(offStart); lateThr.setMinutes(lateThr.getMinutes() + t.lateThresholdMinutes);
    // Sunday = no late, it's all OT
    const isLate = isSunday ? false : now > lateThr;
    const loc = getLocationFromIP(result.ipAddress);
    const record: AttendanceRecord = {
      id: `${currentUser.id}-${now.toISOString().split('T')[0]}`, employeeId: currentUser.id,
      date: now.toISOString().split('T')[0], checkIn: now.toISOString(), checkOut: null,
      status: isLate ? 'late' : 'present', totalHours: 0, wifiVerified: true,
      ipAddress: result.ipAddress, notes: isSunday ? `SUNDAY OT | ${loc}` : loc,
    };
    addAttendanceRecord(record); setTodayRecord(record); setCheckingIn(false);
    const msg = isSunday ? `Sunday OT Check-in at ${loc}` : isLate ? `Checked in LATE at ${loc}` : `Checked in at ${loc}`;
    showNotif(isLate ? 'warning' : 'success', msg); loadTodayData();
  };

  const handleCheckOut = () => {
    if (!todayRecord) return;
    const now = new Date();
    const isSunday = new Date(todayRecord.date).getDay() === 0;
    const start = todayRecord.checkIn ? new Date(todayRecord.checkIn) : now;
    const totalHours = Math.round((now.getTime() - start.getTime()) / 3600000 * 100) / 100;
    const t = getEmployeeTiming(currentUser.id);
    let status = todayRecord.status;
    if (!isSunday && totalHours < t.minHoursForHalfDay) status = 'half-day';
    else if (todayRecord.status === 'late') status = 'late';
    // OT
    const otHours = isSunday ? totalHours : (totalHours > t.minHoursForFullDay ? Math.round((totalHours - t.minHoursForFullDay)*100)/100 : 0);
    const loc = getLocationFromIP(todayRecord.ipAddress);
    const notes = isSunday ? `SUNDAY OT: ${otHours}h | ${loc}` : (otHours > 0 ? `OT: ${otHours}h | ${loc}` : loc);
    updateAttendanceRecord(todayRecord.id, { checkOut: now.toISOString(), totalHours, status, notes });
    setTodayRecord({ ...todayRecord, checkOut: now.toISOString(), totalHours, status, notes });
    showNotif('success', `Checked out! ${totalHours.toFixed(1)}h${otHours > 0 ? ` (OT: +${otHours}h)` : ''}`);
  };

  const handleWFHRequest = () => {
    if (!wfhReason.trim()) { showNotif('error', 'Enter reason'); return; }
    const now = new Date();
    addWFHRequest({ id: `wfh-${currentUser.id}-${now.toISOString().split('T')[0]}`, employeeId: currentUser.id,
      date: now.toISOString().split('T')[0], reason: wfhReason, status: 'pending', requestedAt: now.toISOString(), reviewedBy: null, reviewedAt: null });
    setTodayWFHRequest({ id: '', employeeId: currentUser.id, date: '', reason: wfhReason, status: 'pending', requestedAt: '', reviewedBy: null, reviewedAt: null });
    setShowWFHModal(false); setWfhReason(''); showNotif('success', 'WFH request sent!');
  };

  const handleApproveWFH = (req: WFHRequest) => {
    updateWFHRequest(req.id, { status: 'approved', reviewedBy: currentUser.id, reviewedAt: new Date().toISOString() });
    addAttendanceRecord({ id: `${req.employeeId}-${req.date}`, employeeId: req.employeeId, date: req.date,
      checkIn: new Date().toISOString(), checkOut: null, status: 'work-from-home', totalHours: 0, wifiVerified: false, ipAddress: 'WFH', notes: `WFH: ${req.reason}` });
    loadTodayData(); showNotif('success', `WFH approved`);
  };
  const handleRejectWFH = (req: WFHRequest) => { updateWFHRequest(req.id, { status: 'rejected', reviewedBy: currentUser.id, reviewedAt: new Date().toISOString() }); loadTodayData(); showNotif('warning', 'WFH rejected'); };

  const handleApproveAccount = (req: any, role: string) => {
    const avatar = req.name.trim().split(' ').map((w:string) => w[0]).join('').toUpperCase().slice(0, 2);
    addEmployee({ id: `emp-${Date.now()}`, name: req.name, role: role as any, pin: req.pin, avatar });
    updateAccountRequest(req.id, { status: 'approved', approvedRole: role as any, reviewedBy: currentUser.id });
    loadTodayData(); showNotif('success', `${req.name} approved as ${role}`);
  };
  const handleRejectAccount = (req: any) => { updateAccountRequest(req.id, { status: 'rejected', reviewedBy: currentUser.id }); loadTodayData(); showNotif('warning', 'Request rejected'); };

  const getGreeting = () => { const h = currentTime.getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; };
  const ss = (s: string) => {
    const m: any = { present:'bg-emerald-50 text-emerald-700 border-emerald-200', late:'bg-amber-50 text-amber-700 border-amber-200',
      absent:'bg-red-50 text-red-700 border-red-200', 'half-day':'bg-orange-50 text-orange-700 border-orange-200', 'work-from-home':'bg-blue-50 text-blue-700 border-blue-200' };
    return m[s] || 'bg-slate-50 text-slate-600 border-slate-200';
  };
  const getLiveHours = () => {
    if (!todayRecord?.checkIn) return '0h 00m';
    const diff = (todayRecord.checkOut ? new Date(todayRecord.checkOut) : currentTime).getTime() - new Date(todayRecord.checkIn).getTime();
    return `${Math.floor(diff/3600000)}h ${String(Math.floor((diff%3600000)/60000)).padStart(2,'0')}m`;
  };
  const getLiveOT = () => {
    if (!todayRecord?.checkIn) return 0;
    const diff = (todayRecord.checkOut ? new Date(todayRecord.checkOut) : currentTime).getTime() - new Date(todayRecord.checkIn).getTime();
    const hrs = diff / 3600000;
    const isSunday = new Date(todayRecord.date).getDay() === 0;
    if (isSunday) return Math.round(hrs * 100) / 100;
    const t = getEmployeeTiming(currentUser.id);
    return hrs > t.minHoursForFullDay ? Math.round((hrs - t.minHoursForFullDay)*100)/100 : 0;
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg animate-slide-in flex items-center gap-2 text-sm font-medium ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' : notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
          {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : '⚠'} {notification.message}
        </div>
      )}

      {showWFHModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Work From Home</h3>
            <textarea value={wfhReason} onChange={e => setWfhReason(e.target.value)} placeholder="Reason"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mt-3 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowWFHModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={handleWFHRequest} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium">Submit</button>
            </div>
          </div>
        </div>
      )}

      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-in text-center">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Quit Attendify?</h3>
            <p className="text-slate-500 text-sm mb-5">You will be logged out.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">Cancel</button>
              <button onClick={onLogout} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium">Quit</button>
            </div>
          </div>
        </div>
      )}

      {/* PENDING ACCOUNT REQUESTS (Only Wahab & Albash) */}
      {canSeeAccountRequests && pendingAccounts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-blue-800 font-medium text-sm mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>New Account Requests ({pendingAccounts.length})</h3>
          <div className="space-y-2">{pendingAccounts.map((req: any) => (
            <div key={req.id} className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-800 font-medium text-sm">{req.name}</p>
                <span className="text-slate-400 text-xs">{format(parseISO(req.requestedAt), 'dd MMM hh:mm a')}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApproveAccount(req, 'employee')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200">Employee</button>
                <button onClick={() => handleApproveAccount(req, 'admin')} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200">Admin</button>
                <button onClick={() => handleApproveAccount(req, 'manager')} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200">Manager</button>
                <button onClick={() => handleRejectAccount(req)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 ml-auto">Reject</button>
              </div>
            </div>
          ))}</div>
        </div>
      )}

      {/* CHECK-IN CARD */}
      {canMarkAttendance && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 pt-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div><p className="text-slate-400 text-sm">{getGreeting()}</p><h1 className="text-lg font-semibold text-slate-800">{currentUser.name}</h1></div>
              <div className="text-right"><p className="text-slate-800 text-sm font-medium">{format(currentTime, 'EEEE')}</p><p className="text-slate-400 text-xs">{format(currentTime, 'dd MMMM yyyy')}</p></div>
            </div>
          </div>
          <div className="px-6 py-6">
            <div className="flex flex-col items-center">
              <AnalogClock size={200} />
              <div className="mt-4 text-center">
                <p className="text-3xl font-semibold text-slate-800 font-mono tracking-wide">{format(currentTime, 'hh:mm:ss')}<span className="text-sm text-slate-400 ml-2 font-normal">{format(currentTime, 'a')}</span></p>
                {currentTime.getDay() === 0 && <p className="text-purple-600 text-xs font-medium mt-1">Sunday — Overtime Day</p>}
              </div>
              <div className={`mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium ${
                officeLocation === null ? 'bg-slate-100 text-slate-500' : officeLocation ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${officeLocation === null ? 'bg-slate-400 animate-pulse' : officeLocation ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                {officeLocation === null ? 'Checking...' : officeLocation ? `In ${officeLocation}` : 'Not in Office'}
              </div>
              <div className="mt-6 w-full max-w-xs">
                {!todayRecord ? (
                  <>
                    {todayWFHRequest && <div className={`p-3 rounded-xl mb-4 text-center text-sm font-medium ${todayWFHRequest.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : todayWFHRequest.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{todayWFHRequest.status === 'pending' ? '⏳ WFH Pending' : todayWFHRequest.status === 'approved' ? '✓ WFH Approved' : '✕ WFH Rejected'}</div>}
                    {officeLocation ? (
                      <button onClick={handleCheckIn} disabled={checkingIn} className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-300 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/20">
                        {checkingIn ? 'Verifying...' : `Check In — ${officeLocation}`}
                      </button>
                    ) : officeLocation === '' ? (
                      <div className="space-y-3">
                        <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">Not in Office</button>
                        {!todayWFHRequest && <button onClick={() => setShowWFHModal(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 font-medium hover:bg-blue-50 text-sm">Request Work From Home</button>}
                      </div>
                    ) : <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">Checking...</button>}
                    <button onClick={checkOfficeStatus} disabled={officeLocation === null} className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-blue-600 disabled:opacity-50">↻ Refresh</button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="text-center">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold border ${ss(todayRecord.status)}`}>
                        {todayRecord.status === 'work-from-home' ? '🏠 WFH' : todayRecord.status === 'present' ? '✓ Present' : todayRecord.status === 'late' ? '⚠ Late' : todayRecord.status.toUpperCase()}
                      </span>
                      {todayRecord.notes?.includes('SUNDAY') && <span className="ml-2 px-2 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200">Sunday OT</span>}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Location</span><span className="text-blue-600 font-medium">{getLocationFromIP(todayRecord.ipAddress)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Check In</span><span className="text-slate-800 font-medium font-mono">{todayRecord.checkIn ? format(parseISO(todayRecord.checkIn),'hh:mm a') : '—'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Check Out</span><span className="text-slate-800 font-medium font-mono">{todayRecord.checkOut ? format(parseISO(todayRecord.checkOut),'hh:mm a') : '—'}</span></div>
                      <div className="flex justify-between text-sm border-t border-slate-200 pt-2"><span className="text-slate-500">Working Time</span><span className="text-blue-600 font-bold font-mono">{getLiveHours()}</span></div>
                      {showOT && getLiveOT() > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Overtime</span><span className="text-purple-600 font-bold font-mono">+{getLiveOT()}h</span></div>}
                    </div>
                    {!todayRecord.checkOut ? (
                      <button onClick={handleCheckOut} className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-semibold flex items-center justify-center gap-2">Check Out</button>
                    ) : (
                      <div className="text-center py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <p className="text-emerald-700 text-sm font-semibold">✓ Day Complete — {todayRecord.totalHours.toFixed(1)}h</p>
                        {showOT && todayRecord.notes?.includes('OT') && <p className="text-purple-600 text-xs mt-0.5">Overtime recorded</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager */}
      {isManagerOnly && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-lg font-bold text-blue-600">{currentUser.avatar}</div>
            <div><p className="text-slate-400 text-sm">{getGreeting()}</p><h1 className="text-lg font-semibold text-slate-800">{currentUser.name}</h1><p className="text-blue-600 text-xs font-medium">Manager Panel</p></div>
            <div className="ml-auto text-right"><p className="text-2xl font-semibold text-slate-800 font-mono">{format(currentTime, 'hh:mm')}</p><p className="text-slate-400 text-xs">{format(currentTime, 'EEEE, dd MMM yyyy')}</p></div>
          </div>
        </div>
      )}

      {/* WFH */}
      {isAdmin && pendingWFHRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-amber-800 font-medium text-sm mb-3">Pending WFH ({pendingWFHRequests.length})</h3>
          <div className="space-y-2">{pendingWFHRequests.map(req => {
            const emp = getEmployees().find(e => e.id === req.employeeId);
            return (<div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg p-3 border border-amber-100">
              <div className="flex items-center gap-3"><div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-semibold">{emp?.avatar}</div><div><p className="text-slate-800 font-medium text-sm">{emp?.name}</p><p className="text-slate-500 text-xs">{req.reason}</p></div></div>
              <div className="flex gap-2"><button onClick={() => handleApproveWFH(req)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium">Approve</button><button onClick={() => handleRejectWFH(req)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">Reject</button></div>
            </div>);
          })}</div>
        </div>
      )}

      {/* Team */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-slate-800 font-medium text-sm mb-4">Today's Team</h3>
          <div className="space-y-2">{getAttendanceEmployees().map(emp => {
            const rec = todayAllRecords.find(r => r.employeeId === emp.id);
            const wfhReq = getWFHRequests().find(r => r.employeeId === emp.id && r.date === new Date().toISOString().split('T')[0]);
            const t = getEmployeeTiming(emp.id);
            const otHrs = rec && rec.totalHours > 0 ? Math.max(0, rec.totalHours - t.minHoursForFullDay) : 0;
            const isSunOT = rec?.notes?.includes('SUNDAY');
            return (<div key={emp.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3"><div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-xs font-semibold text-slate-600">{emp.avatar}</div>
              <div><p className="text-slate-800 text-sm font-medium">{emp.name}</p><p className="text-slate-400 text-xs">{rec ? getLocationFromIP(rec.ipAddress) : ''}{isSunOT ? ' • Sunday OT' : ''}</p></div></div>
              <div className="text-right">{rec ? (<>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${ss(rec.status)}`}>{rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}</span>
                <p className="text-slate-400 text-xs mt-1">{rec.checkIn ? format(parseISO(rec.checkIn),'hh:mm a') : ''}{showOT && otHrs > 0 ? ` • OT:+${otHrs.toFixed(1)}h` : ''}</p>
              </>) : wfhReq?.status === 'pending' ? <span className="px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">WFH PENDING</span>
              : <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500">NOT CHECKED IN</span>}</div>
            </div>);
          })}</div>
        </div>
      )}

      {/* Stats */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Present', value: todayAllRecords.filter(r => r.status === 'present').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Late', value: todayAllRecords.filter(r => r.status === 'late').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'WFH', value: todayAllRecords.filter(r => r.status === 'work-from-home').length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Absent', value: getAttendanceEmployees().length - todayAllRecords.length, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Total', value: getAttendanceEmployees().length, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map(s => (<div key={s.label} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}><p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p><p className="text-slate-500 text-xs mt-1">{s.label}</p></div>))}
        </div>
      )}

      <div className="pt-4 pb-8"><button onClick={() => setShowQuitConfirm(true)} className="w-full py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 font-medium text-sm flex items-center justify-center gap-2">Quit</button></div>
    </div>
  );
}
