import { useState, useEffect } from 'react';
import { Employee, AttendanceRecord, WFHRequest } from '../types';
import { 
  getEmployees,
  getAttendanceEmployees,
  getAttendanceRecords, 
  getTodayRecord, 
  addAttendanceRecord, 
  updateAttendanceRecord, 
  getEmployeeTiming,
  getLocationFromIP,
  getWFHRequests,
  addWFHRequest,
  updateWFHRequest,
  getTodayWFHRequest,
  getPendingWFHRequests
} from '../store';
import { verifyWiFiConnection } from '../wifiService';
import { format, parseISO } from 'date-fns';
import AnalogClock from './AnalogClock';

interface DashboardProps {
  currentUser: Employee;
  onLogout: () => void;
}

export default function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isInOffice, setIsInOffice] = useState<boolean | null>(null); // null = checking
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkingIn, setCheckingIn] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [todayAllRecords, setTodayAllRecords] = useState<AttendanceRecord[]>([]);
  const [showWFHModal, setShowWFHModal] = useState(false);
  const [wfhReason, setWfhReason] = useState('');
  const [todayWFHRequest, setTodayWFHRequest] = useState<WFHRequest | null>(null);
  const [pendingWFHRequests, setPendingWFHRequests] = useState<WFHRequest[]>([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const isManagerOnly = currentUser.role === 'manager';
  const canMarkAttendance = !isManagerOnly;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (canMarkAttendance) checkOfficeStatus();
    loadTodayData();
  }, []);

  const showNotif = (type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const checkOfficeStatus = async () => {
    setIsInOffice(null); // checking
    const result = await verifyWiFiConnection();
    setIsInOffice(result.isConnected);
  };

  const loadTodayData = () => {
    if (canMarkAttendance) {
      const record = getTodayRecord(currentUser.id);
      setTodayRecord(record || null);
      const wfhReq = getTodayWFHRequest(currentUser.id);
      setTodayWFHRequest(wfhReq || null);
    }
    if (isAdmin) {
      const today = new Date().toISOString().split('T')[0];
      const allRecords = getAttendanceRecords().filter(r => r.date === today);
      setTodayAllRecords(allRecords);
      setPendingWFHRequests(getPendingWFHRequests());
    }
  };

  const handleCheckIn = async () => {
    if (!isInOffice) {
      showNotif('error', 'You must be in office to check in!');
      return;
    }
    setCheckingIn(true);
    const result = await verifyWiFiConnection();
    if (!result.isConnected) {
      setCheckingIn(false);
      setIsInOffice(false);
      showNotif('error', 'Verification failed! You are not in office.');
      return;
    }
    const now = new Date();
    const myTiming = getEmployeeTiming(currentUser.id);
    const [startH, startM] = myTiming.officeStartTime.split(':').map(Number);
    const officeStart = new Date(now);
    officeStart.setHours(startH, startM, 0, 0);
    const lateThreshold = new Date(officeStart);
    lateThreshold.setMinutes(lateThreshold.getMinutes() + myTiming.lateThresholdMinutes);
    const isLate = now > lateThreshold;
    const record: AttendanceRecord = {
      id: `${currentUser.id}-${now.toISOString().split('T')[0]}`,
      employeeId: currentUser.id,
      date: now.toISOString().split('T')[0],
      checkIn: now.toISOString(),
      checkOut: null,
      status: isLate ? 'late' : 'present',
      totalHours: 0,
      wifiVerified: true,
      ipAddress: result.ipAddress,
      notes: '',
    };
    addAttendanceRecord(record);
    setTodayRecord(record);
    setCheckingIn(false);
    showNotif(isLate ? 'warning' : 'success', isLate ? 'Checked in (LATE)' : 'Checked in successfully!');
    loadTodayData();
  };

  const handleCheckOut = () => {
    if (!todayRecord) return;
    const now = new Date();
    const checkInTime = todayRecord.checkIn ? new Date(todayRecord.checkIn) : now;
    const diffMs = now.getTime() - checkInTime.getTime();
    const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    const myTiming = getEmployeeTiming(currentUser.id);
    let status = todayRecord.status;
    if (totalHours < myTiming.minHoursForHalfDay) status = 'half-day';
    else if (todayRecord.status === 'late') status = 'late';
    updateAttendanceRecord(todayRecord.id, { checkOut: now.toISOString(), totalHours, status });
    setTodayRecord({ ...todayRecord, checkOut: now.toISOString(), totalHours, status });
    showNotif('success', `Checked out! Total: ${totalHours.toFixed(1)} hours`);
  };

  const handleWFHRequest = () => {
    if (!wfhReason.trim()) { showNotif('error', 'Please enter a reason'); return; }
    const now = new Date();
    const request: WFHRequest = {
      id: `wfh-${currentUser.id}-${now.toISOString().split('T')[0]}`,
      employeeId: currentUser.id,
      date: now.toISOString().split('T')[0],
      reason: wfhReason,
      status: 'pending',
      requestedAt: now.toISOString(),
      reviewedBy: null,
      reviewedAt: null,
    };
    addWFHRequest(request);
    setTodayWFHRequest(request);
    setShowWFHModal(false);
    setWfhReason('');
    showNotif('success', 'WFH request submitted!');
  };

  const handleApproveWFH = (request: WFHRequest) => {
    updateWFHRequest(request.id, { status: 'approved', reviewedBy: currentUser.id, reviewedAt: new Date().toISOString() });
    const now = new Date();
    addAttendanceRecord({
      id: `${request.employeeId}-${request.date}`,
      employeeId: request.employeeId,
      date: request.date,
      checkIn: now.toISOString(),
      checkOut: null,
      status: 'work-from-home',
      totalHours: 0,
      wifiVerified: false,
      ipAddress: 'WFH',
      notes: `WFH: ${request.reason}`,
    });
    loadTodayData();
    showNotif('success', `WFH approved for ${getEmployees().find(e => e.id === request.employeeId)?.name}`);
  };

  const handleRejectWFH = (request: WFHRequest) => {
    updateWFHRequest(request.id, { status: 'rejected', reviewedBy: currentUser.id, reviewedAt: new Date().toISOString() });
    loadTodayData();
    showNotif('warning', 'WFH rejected');
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getStatusStyle = (s: string) => {
    const map: Record<string, string> = {
      present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      late: 'bg-amber-50 text-amber-700 border-amber-200',
      absent: 'bg-red-50 text-red-700 border-red-200',
      'half-day': 'bg-orange-50 text-orange-700 border-orange-200',
      'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return map[s] || 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const getLiveHours = () => {
    if (!todayRecord?.checkIn) return '0h 00m';
    const start = new Date(todayRecord.checkIn);
    const end = todayRecord.checkOut ? new Date(todayRecord.checkOut) : currentTime;
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg animate-slide-in flex items-center gap-2 text-sm font-medium ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
        }`}>
          {notification.type === 'success' ? '✓' : notification.type === 'error' ? '✕' : '⚠'} {notification.message}
        </div>
      )}

      {/* WFH Modal */}
      {showWFHModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Work From Home</h3>
            <p className="text-slate-500 text-sm mb-4">Submit a request for admin approval.</p>
            <textarea value={wfhReason} onChange={e => setWfhReason(e.target.value)}
              placeholder="Reason (e.g., Not feeling well)" 
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-700 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowWFHModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm">Cancel</button>
              <button onClick={handleWFHRequest} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Quit Confirm */}
      {showQuitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-in text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Quit Attendify?</h3>
            <p className="text-slate-500 text-sm mb-5">You will be logged out.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowQuitConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm">Cancel</button>
              <button onClick={onLogout} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 font-medium text-sm">Quit</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MAIN ATTENDANCE CARD WITH CLOCK ===== */}
      {canMarkAttendance && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Top section: Greeting + Date */}
          <div className="px-6 pt-5 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{getGreeting()}</p>
                <h1 className="text-lg font-semibold text-slate-800">{currentUser.name}</h1>
              </div>
              <div className="text-right">
                <p className="text-slate-800 text-sm font-medium">{format(currentTime, 'EEEE')}</p>
                <p className="text-slate-400 text-xs">{format(currentTime, 'dd MMMM yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Clock + Check In Area */}
          <div className="px-6 py-6">
            <div className="flex flex-col items-center">
              {/* Analog Clock */}
              <AnalogClock size={200} />
              
              {/* Digital Time */}
              <div className="mt-4 text-center">
                <p className="text-3xl font-semibold text-slate-800 font-mono tracking-wide">
                  {format(currentTime, 'hh:mm:ss')}
                  <span className="text-sm text-slate-400 ml-2 font-normal">{format(currentTime, 'a')}</span>
                </p>
              </div>

              {/* Office Status - Simple In Office / Not in Office */}
              <div className={`mt-4 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium ${
                isInOffice === null ? 'bg-slate-100 text-slate-500' :
                isInOffice ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                'bg-red-50 text-red-600 border border-red-200'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isInOffice === null ? 'bg-slate-400 animate-pulse' :
                  isInOffice ? 'bg-emerald-500' : 'bg-red-500'
                }`}></span>
                {isInOffice === null ? 'Checking...' : isInOffice ? 'In Office' : 'Not in Office'}
              </div>

              {/* Action Area */}
              <div className="mt-6 w-full max-w-xs">
                {!todayRecord ? (
                  <>
                    {/* WFH Request Status */}
                    {todayWFHRequest && (
                      <div className={`p-3 rounded-xl mb-4 text-center text-sm font-medium ${
                        todayWFHRequest.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        todayWFHRequest.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {todayWFHRequest.status === 'pending' ? '⏳ WFH Request Pending' :
                         todayWFHRequest.status === 'approved' ? '✓ WFH Approved!' : '✕ WFH Rejected'}
                      </div>
                    )}

                    {isInOffice ? (
                      <button
                        onClick={handleCheckIn}
                        disabled={checkingIn}
                        className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-300 text-white font-semibold text-base transition-all shadow-lg shadow-blue-600/20"
                      >
                        {checkingIn ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                            Verifying...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                            Check In
                          </span>
                        )}
                      </button>
                    ) : isInOffice === false ? (
                      <div className="space-y-3">
                        <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">
                          Check In (In Office Only)
                        </button>
                        {!todayWFHRequest && (
                          <button onClick={() => setShowWFHModal(true)}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 font-medium hover:bg-blue-50 transition-colors text-sm">
                            Request Work From Home
                          </button>
                        )}
                      </div>
                    ) : (
                      <button disabled className="w-full py-4 rounded-2xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">
                        Checking Location...
                      </button>
                    )}
                    
                    <button onClick={checkOfficeStatus} disabled={isInOffice === null}
                      className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50">
                      ↻ Refresh Status
                    </button>
                  </>
                ) : (
                  /* CHECKED IN STATE */
                  <div className="space-y-4">
                    {/* Status Badge */}
                    <div className="text-center">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold border ${getStatusStyle(todayRecord.status)}`}>
                        {todayRecord.status === 'work-from-home' ? '🏠 Work From Home' : 
                         todayRecord.status === 'present' ? '✓ Present' :
                         todayRecord.status === 'late' ? '⚠ Late' : todayRecord.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Time Details */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Location</span>
                        <span className="text-blue-600 font-medium">{getLocationFromIP(todayRecord.ipAddress)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Check In</span>
                        <span className="text-slate-800 font-medium font-mono">
                          {todayRecord.checkIn ? format(parseISO(todayRecord.checkIn), 'hh:mm a') : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Check Out</span>
                        <span className="text-slate-800 font-medium font-mono">
                          {todayRecord.checkOut ? format(parseISO(todayRecord.checkOut), 'hh:mm a') : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
                        <span className="text-slate-500">Working Time</span>
                        <span className="text-blue-600 font-bold font-mono">{getLiveHours()}</span>
                      </div>
                    </div>

                    {/* Check Out / Complete */}
                    {!todayRecord.checkOut ? (
                      <button onClick={handleCheckOut}
                        className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white font-semibold transition-all flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Check Out
                      </button>
                    ) : (
                      <div className="text-center py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <p className="text-emerald-700 text-sm font-semibold">✓ Day Complete</p>
                        <p className="text-emerald-600 text-xs mt-0.5">{todayRecord.totalHours.toFixed(1)} hours worked</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Dashboard */}
      {isManagerOnly && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-lg font-bold text-blue-600">
              {currentUser.avatar}
            </div>
            <div>
              <p className="text-slate-400 text-sm">{getGreeting()}</p>
              <h1 className="text-lg font-semibold text-slate-800">{currentUser.name}</h1>
              <p className="text-blue-600 text-xs font-medium">Manager Panel</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-semibold text-slate-800 font-mono">{format(currentTime, 'hh:mm')}</p>
              <p className="text-slate-400 text-xs">{format(currentTime, 'EEEE, dd MMM yyyy')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pending WFH Requests (Admin) */}
      {isAdmin && pendingWFHRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-amber-800 font-medium text-sm mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            Pending WFH Requests ({pendingWFHRequests.length})
          </h3>
          <div className="space-y-2">
            {pendingWFHRequests.map(req => {
              const emp = getEmployees().find(e => e.id === req.employeeId);
              return (
                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-semibold text-slate-600">{emp?.avatar}</div>
                    <div>
                      <p className="text-slate-800 font-medium text-sm">{emp?.name}</p>
                      <p className="text-slate-500 text-xs">{req.reason}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveWFH(req)} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200">Approve</button>
                    <button onClick={() => handleRejectWFH(req)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's Team Status (Admin) */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-slate-800 font-medium text-sm mb-4">Today's Team Status</h3>
          <div className="space-y-2">
            {getAttendanceEmployees().map(emp => {
              const rec = todayAllRecords.find(r => r.employeeId === emp.id);
              const wfhReq = getWFHRequests().find(r => r.employeeId === emp.id && r.date === new Date().toISOString().split('T')[0]);
              return (
                <div key={emp.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-xs font-semibold text-slate-600">{emp.avatar}</div>
                    <div>
                      <p className="text-slate-800 text-sm font-medium">{emp.name}</p>
                      <p className="text-slate-400 text-xs capitalize">{emp.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {rec ? (
                      <>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusStyle(rec.status)}`}>
                          {rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}
                        </span>
                        <p className="text-slate-400 text-xs mt-1">{rec.checkIn ? format(parseISO(rec.checkIn), 'hh:mm a') : ''}</p>
                      </>
                    ) : wfhReq?.status === 'pending' ? (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">WFH PENDING</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-500">NOT CHECKED IN</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Stats (Admin) */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Present', value: todayAllRecords.filter(r => r.status === 'present').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Late', value: todayAllRecords.filter(r => r.status === 'late').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'WFH', value: todayAllRecords.filter(r => r.status === 'work-from-home').length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Absent', value: getAttendanceEmployees().length - todayAllRecords.length, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Total', value: getAttendanceEmployees().length, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.bg} rounded-xl p-4 text-center border border-slate-100`}>
              <p className={`text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
              <p className="text-slate-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* QUIT BUTTON */}
      <div className="pt-4 pb-8">
        <button
          onClick={() => setShowQuitConfirm(true)}
          className="w-full py-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-medium text-sm transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Quit Application
        </button>
      </div>
    </div>
  );
}
