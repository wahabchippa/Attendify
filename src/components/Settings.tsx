// src/components/Settings.tsx

import { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import {
  getEmployees, getAttendanceEmployees,
  getAllEmployeeTimings, saveAllEmployeeTimings, EmployeeTiming,
  updateEmployeePin, addEmployee, removeEmployee, getAttendanceRecords,
  saveAttendanceRecords, updateAttendanceRecord, getLocationFromIP,
  hasAccess, getAccessControl, grantAccess, revokeAccess, getOfficeLocations,
  bindEmployeeDevice, getHolidays, addHoliday, removeHoliday, Holiday
} from '../store';
import { format, parseISO } from 'date-fns';
import AuditLog from './AuditLog';
import AdminAlerts from './AdminAlerts';
import SalaryCalculator from './SalaryCalculator';

interface SettingsProps { currentUser: Employee; onLogout: () => void; }

const getInitials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export default function Settings({ currentUser, onLogout }: SettingsProps) {
  const ha = (f: string) => hasAccess(currentUser.id, f);
  const canViewAll    = ha('view_all');
  const canEdit       = ha('timings');
  const canChangePins = ha('pin_change');
  const canAddEmp     = ha('add_employee');
  const canRemoveEmp  = ha('remove_employee');
  const canSecret     = ha('secret_override');
  const canViewAudit  = ha('audit_view');

  const [saved, setSaved]           = useState(false);
  const [mounted, setMounted]       = useState(false);
  const [activeTab, setActiveTab]   = useState<'timings'|'security'|'employees'|'audit'|'alerts'|'salary'|'about'>(
    canEdit ? 'timings' : canChangePins ? 'security' : 'about'
  );
  const [empTimings, setEmpTimings]         = useState<Record<string, EmployeeTiming>>({});
  const [pinChanges, setPinChanges]         = useState<Record<string, string>>({});
  const [pinSaved, setPinSaved]             = useState(false);
  const [newName, setNewName]               = useState('');
  const [newPin, setNewPin]                 = useState('');
  const [newRole, setNewRole]               = useState<'employee'|'admin'|'manager'>('employee');
  const [addMsg, setAddMsg]                 = useState('');
  const [deviceResetMsg, setDeviceResetMsg] = useState('');
  const [empRefresh, setEmpRefresh]         = useState(0);

  const [hDate, setHDate]       = useState('');
  const [hName, setHName]       = useState('');
  const [hMsg, setHMsg]         = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const [secretUnlocked, setSecretUnlocked]     = useState(false);
  const tapCountRef  = useRef(0);
  const tapTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [secretEditRecord, setSecretEditRecord] = useState<any>(null);
  const [secretFilter, setSecretFilter]         = useState('');
  const [secretSaved, setSecretSaved]           = useState(false);
  const [secretError, setSecretError]           = useState('');

  const employees    = getEmployees();
  const attEmployees = getAttendanceEmployees();
  const refreshEmps  = () => setEmpRefresh(p => p + 1);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { setHolidays(getHolidays()); }, []);

  useEffect(() => {
    const existing = getAllEmployeeTimings();
    const merged: Record<string, EmployeeTiming> = {};
    attEmployees.forEach(emp => {
      merged[emp.id] = existing[emp.id] || {
        employeeId: emp.id, officeStartTime: '09:00',
        lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4,
      };
    });
    setEmpTimings(merged);
  }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleSaveTimings = () => { saveAllEmployeeTimings(empTimings); flash(); };
  const updateEmpTiming = (id: string, key: string, val: string | number) =>
    setEmpTimings(p => ({ ...p, [id]: { ...p[id], [key]: val } }));

  const applyToAll = (srcId: string) => {
    const src = empTimings[srcId]; if (!src) return;
    const u: Record<string, EmployeeTiming> = {};
    attEmployees.forEach(e => { u[e.id] = { ...src, employeeId: e.id }; });
    setEmpTimings(u);
  };

  const handleSavePins = () => {
    Object.entries(pinChanges).forEach(([empId, pin]) => {
      if (pin && pin.length === 4) updateEmployeePin(empId, pin);
    });
    setPinChanges({}); setPinSaved(true); setTimeout(() => setPinSaved(false), 2000);
  };

  const handleAddEmployee = () => {
    if (!newName.trim()) { setAddMsg('Enter name'); return; }
    if (newPin.length !== 4) { setAddMsg('PIN must be 4 digits'); return; }
    const id = `emp-${Date.now()}`;
    const avatar = newName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    addEmployee({ id, name: newName.trim(), role: newRole, pin: newPin, avatar });
    setNewName(''); setNewPin(''); setNewRole('employee');
    setAddMsg('Employee added!'); setTimeout(() => setAddMsg(''), 2000);
  };

  const handleResetDevice = async (empId: string, empName: string) => {
    if (!confirm(`Reset device lock for ${empName}?`)) return;
    await bindEmployeeDevice(empId, null);
    refreshEmps();
    setDeviceResetMsg(`Device lock removed for ${empName}!`);
    setTimeout(() => setDeviceResetMsg(''), 3000);
  };

  const handleAddHoliday = async () => {
    if (!hDate || !hName.trim()) { setHMsg('Date and Name required!'); return; }
    await addHoliday(hDate, hName.trim());
    setHolidays(getHolidays());
    setHDate(''); setHName('');
    setHMsg('Holiday marked!'); setTimeout(() => setHMsg(''), 2000);
  };

  const handleRemoveHoliday = async (date: string) => {
    if (!confirm('Remove this holiday?')) return;
    await removeHoliday(date);
    setHolidays(getHolidays());
  };

  const handleSecretTap = () => {
    if (!canSecret) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    if (tapCountRef.current >= 7) { setSecretUnlocked(true); tapCountRef.current = 0; }
  };

  const safeFormatTime = (isoString: string | null | undefined) => {
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
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      let h = date.getUTCHours() + 5;
      if (h >= 24) h -= 24;
      return `${String(h).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
    } catch { return ''; }
  };

  const handleSecretSave = async () => {
    if (!secretEditRecord) return;
    setSecretError('');
    const baseDate = secretEditRecord.date.split('T')[0];
    const finalCheckIn  = secretEditRecord.checkInTime  ? `${baseDate}T${secretEditRecord.checkInTime}:00+05:00`  : null;
    const finalCheckOut = secretEditRecord.checkOutTime ? `${baseDate}T${secretEditRecord.checkOutTime}:00+05:00` : null;
    const selectedIp = secretEditRecord.ipAddress || getOfficeLocations()[0]?.ip_address;
    const ok = await updateAttendanceRecord(secretEditRecord.id, {
      status: secretEditRecord.status, totalHours: secretEditRecord.totalHours || 0,
      checkIn: finalCheckIn, checkOut: finalCheckOut,
      ipAddress: selectedIp, date: baseDate,
      notes: getLocationFromIP(selectedIp), wifiVerified: true,
    });
    if (!ok) { setSecretError('Save failed.'); return; }
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
    setSecretEditRecord(null);
  };

  const handleSecretAddRecord = async () => {
    setSecretError('');
    const d = (secretEditRecord?.date || new Date().toISOString()).split('T')[0];
    const finalCheckIn  = secretEditRecord?.checkInTime  ? `${d}T${secretEditRecord.checkInTime}:00+05:00`  : null;
    const finalCheckOut = secretEditRecord?.checkOutTime ? `${d}T${secretEditRecord.checkOutTime}:00+05:00` : null;
    if (!secretEditRecord?.employeeId) { setSecretError('Select an employee'); return; }
    const rec = {
      id: `manual-${Date.now()}`,
      employeeId: secretEditRecord.employeeId,
      date: d, checkIn: finalCheckIn, checkOut: finalCheckOut,
      status: secretEditRecord?.status || 'present',
      totalHours: secretEditRecord?.totalHours || 0,
      wifiVerified: true,
      ipAddress: secretEditRecord?.ipAddress || getOfficeLocations()[0]?.ip_address,
      notes: secretEditRecord?.notes || getLocationFromIP(secretEditRecord?.ipAddress || ''),
    };
    const records = getAttendanceRecords();
    records.push(rec);
    saveAttendanceRecords(records);
    try {
      const { supabase } = await import('../supabaseClient');
      const numericUserId = parseInt(rec.employeeId.replace(/^\D+/g, ''), 10) || 1;
      const currentEmp = employees.find(e => e.id === rec.employeeId);
      if (supabase) {
        const { error } = await supabase.from('attendance_logs').upsert({
          user_id: numericUserId, user_name: currentEmp?.name || 'Unknown',
          date: rec.date, login_time: rec.checkIn, logout_time: rec.checkOut,
          status: rec.status, total_hours: rec.totalHours,
          wifi_connected: 'true', notes: rec.notes,
        });
        if (error) { setSecretError('DB save failed: ' + error.message); return; }
      }
    } catch (err: any) { setSecretError('Error: ' + err.message); return; }
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
    setSecretEditRecord(null);
  };

  const handleSecretDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    const records = getAttendanceRecords().filter(r => r.id !== id);
    saveAttendanceRecords(records);
    try {
      const { supabase } = await import('../supabaseClient');
      if (supabase && /^\d+$/.test(id)) await supabase.from('attendance_logs').delete().eq('id', Number(id));
    } catch {}
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
  };

  const SectionHeader = ({
    icon, title, subtitle, badge
  }: {
    icon: React.ReactNode; title: string; subtitle?: string; badge?: React.ReactNode
  }) => (
    <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800">{title}</h3>
            {subtitle && <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
    </div>
  );

  const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );

  const inputCls  = "w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all placeholder-slate-400";
  const selectCls = "w-full appearance-none bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all cursor-pointer";

  // ── SECRET PANEL ──────────────────────────────────────────
  if (secretUnlocked) {
    const allRecords = getAttendanceRecords();
    const filtered = secretFilter
      ? allRecords.filter(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return emp?.name.toLowerCase().includes(secretFilter.toLowerCase()) || r.date.includes(secretFilter);
        })
      : allRecords.slice(-50);

    return (
      <div className="space-y-5 font-sans">
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 rounded-3xl p-5 text-white relative overflow-hidden shadow-xl">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/5 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Override Panel</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Full Record Control</p>
              </div>
            </div>
            <button
              onClick={() => { setSecretUnlocked(false); setSecretEditRecord(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white/80 text-xs font-bold border border-white/10 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>

        {secretSaved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-700 text-sm font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Saved successfully
          </div>
        )}
        {secretError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm font-bold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {secretError}
          </div>
        )}

        {/* Create Record */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>}
            title="Create New Record"
            subtitle="Manually add attendance entry"
          />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={secretEditRecord?.employeeId || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, employeeId: e.target.value }))} className={selectCls}>
                <option value="">Select Employee</option>
                {attEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <input type="date" value={secretEditRecord?.date || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, date: e.target.value }))} className={inputCls} />
              <select value={secretEditRecord?.status || 'present'} onChange={e => setSecretEditRecord((p: any) => ({ ...p, status: e.target.value }))} className={selectCls}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half-day">Half Day</option>
                <option value="holiday-ot">🌟 Holiday OT</option>
              </select>
              <input type="number" step="0.5" placeholder="Hours" value={secretEditRecord?.totalHours || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, totalHours: parseFloat(e.target.value) || 0 }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InputField label="Check In">
                <input type="time" value={secretEditRecord?.checkInTime || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, checkInTime: e.target.value || '' }))} className={inputCls} />
              </InputField>
              <InputField label="Check Out">
                <input type="time" value={secretEditRecord?.checkOutTime || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, checkOutTime: e.target.value || '' }))} className={inputCls} />
              </InputField>
              <InputField label="Location">
                <select value={secretEditRecord?.ipAddress || getOfficeLocations()[0]?.ip_address} onChange={e => setSecretEditRecord((p: any) => ({ ...p, ipAddress: e.target.value }))} className={selectCls}>
                  {getOfficeLocations().map(loc => <option key={loc.id} value={loc.ip_address}>{loc.name} ({loc.ip_address})</option>)}
                </select>
              </InputField>
              <InputField label=" ">
                <button onClick={handleSecretAddRecord} className="w-full py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                  Add Record
                </button>
              </InputField>
            </div>
          </div>
        </div>

        {/* Edit Records */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>}
            title="Edit Existing Records"
            subtitle="Search and modify attendance data"
          />
          <div className="p-5">
            <div className="relative mb-4">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input placeholder="Search by name or date..." value={secretFilter} onChange={e => setSecretFilter(e.target.value)} className={`${inputCls} pl-10`} />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
              {filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(rec => {
                const emp = employees.find(e => e.id === rec.employeeId);
                const statusColors: Record<string, string> = {
                  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  late: 'bg-amber-50 text-amber-700 border-amber-200',
                  absent: 'bg-red-50 text-red-700 border-red-200',
                  'work-from-home': 'bg-blue-50 text-blue-700 border-blue-200',
                };
                return (
                  <div key={rec.id} className="flex flex-wrap items-center gap-2 py-3 px-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs hover:border-slate-200 transition-all">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-lg flex items-center justify-center text-[9px] font-black shrink-0">
                      {getInitials(emp?.name || '?')}
                    </div>
                    <span className="font-bold text-slate-700 w-24 truncate">{emp?.name || rec.employeeId}</span>
                    <span className="text-slate-400 font-medium w-20">{rec.date}</span>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${statusColors[rec.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}
                    </span>
                    <span className="text-slate-500 font-medium">{rec.totalHours || 0}h</span>
                    <span className="text-[#1E40AF] font-bold">{getLocationFromIP(rec.ipAddress)}</span>
                    <div className="flex gap-1.5 ml-auto">
                      <button onClick={() => setSecretEditRecord({ ...rec, checkInTime: safeFormatTime(rec.checkIn), checkOutTime: safeFormatTime(rec.checkOut), _editing: true })}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-bold hover:bg-blue-100 border border-blue-200 transition-all active:scale-95">
                        Edit
                      </button>
                      <button onClick={() => handleSecretDelete(rec.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold hover:bg-red-100 border border-red-200 transition-all active:scale-95">
                        Del
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Access Control */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
            title="Access Control"
            subtitle="Grant or revoke feature access per employee"
          />
          <div className="p-5 space-y-3">
            {(() => {
              const ac = getAccessControl();
              const labels: Record<string, string> = {
                ot: 'View Overtime', ai: 'AI Search', analytics: 'Analytics',
                settings: 'Settings', pin_change: 'Change PINs', add_employee: 'Add Employee',
                remove_employee: 'Remove Employee', timings: 'Employee Timings',
                wfh_approve: 'Approve WFH', secret_override: 'Secret Override',
                view_all: 'View All Data', leave_manage: 'Manage Leaves',
                salary_view: 'View Salary', audit_view: 'View Audit Log',
                alerts_view: 'View Alerts', device_manage: 'Device Management',
                corrections_manage: 'Manage Corrections', notes_manage: 'Manager Notes',
              };
              return Object.keys(ac).map(feat => (
                <div key={feat} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <h4 className="text-slate-700 text-xs font-black uppercase tracking-wider mb-3">{labels[feat] || feat}</h4>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(ac[feat] || []).map(eid => {
                      const emp = employees.find(e => e.id === eid);
                      return (
                        <span key={eid} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-200">
                          {emp?.name || eid}
                          <button onClick={() => { revokeAccess(eid, feat); refreshEmps(); }} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
                        </span>
                      );
                    })}
                    {!(ac[feat] || []).length && <span className="text-slate-400 text-xs font-medium">No access granted</span>}
                  </div>
                  <select onChange={e => { if (e.target.value) { grantAccess(e.target.value, feat); refreshEmps(); e.target.value = ''; }}}
                    className={`${selectCls} text-xs`} defaultValue="">
                    <option value="">+ Grant access...</option>
                    {employees.filter(e => !(ac[feat] || []).includes(e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Edit Modal */}
        {secretEditRecord?._editing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 animate-scale-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/20">
                  {getInitials(employees.find(e => e.id === secretEditRecord.employeeId)?.name || '?')}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{employees.find(e => e.id === secretEditRecord.employeeId)?.name}</h3>
                  <p className="text-slate-400 text-xs font-medium">{secretEditRecord.date}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Status">
                  <select value={secretEditRecord.status} onChange={e => setSecretEditRecord((p: any) => ({ ...p, status: e.target.value }))} className={selectCls}>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="half-day">Half Day</option>
                    <option value="holiday-ot">🌟 Holiday OT</option>
                  </select>
                </InputField>
                <InputField label="Total Hours">
                  <input type="number" step="0.5" value={secretEditRecord.totalHours || 0} onChange={e => setSecretEditRecord((p: any) => ({ ...p, totalHours: parseFloat(e.target.value) || 0 }))} className={inputCls} />
                </InputField>
                <InputField label="Check In">
                  <input type="time" value={secretEditRecord.checkInTime || ''} onChange={e => {
                    const val = e.target.value || '';
                    setSecretEditRecord((p: any) => {
                      let nextHours = p.totalHours;
                      if (val && p.checkOutTime) {
                        const start = new Date(`2000-01-01T${val}:00`);
                        const end   = new Date(`2000-01-01T${p.checkOutTime}:00`);
                        nextHours = Math.max(0, Math.round((end.getTime() - start.getTime()) / 3600000 * 100) / 100);
                      }
                      return { ...p, checkInTime: val, totalHours: nextHours };
                    });
                  }} className={inputCls} />
                </InputField>
                <InputField label="Check Out">
                  <input type="time" value={secretEditRecord.checkOutTime || ''} onChange={e => {
                    const val = e.target.value || '';
                    setSecretEditRecord((p: any) => {
                      let nextHours = p.totalHours;
                      if (p.checkInTime && val) {
                        const start = new Date(`2000-01-01T${p.checkInTime}:00`);
                        const end   = new Date(`2000-01-01T${val}:00`);
                        nextHours = Math.max(0, Math.round((end.getTime() - start.getTime()) / 3600000 * 100) / 100);
                      } else if (!val) { nextHours = 0; }
                      return { ...p, checkOutTime: val, totalHours: nextHours };
                    });
                  }} className={inputCls} />
                </InputField>
                <InputField label="Location">
                  <select value={secretEditRecord.ipAddress || getOfficeLocations()[0]?.ip_address} onChange={e => setSecretEditRecord((p: any) => ({ ...p, ipAddress: e.target.value }))} className={selectCls}>
                    {getOfficeLocations().map(loc => <option key={loc.id} value={loc.ip_address}>{loc.ip_address} ({loc.name})</option>)}
                  </select>
                </InputField>
                <InputField label="Date">
                  <input type="date" value={secretEditRecord.date || ''} onChange={e => setSecretEditRecord((p: any) => ({ ...p, date: e.target.value || '' }))} className={inputCls} />
                </InputField>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setSecretEditRecord(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all active:scale-95">Cancel</button>
                <button onClick={handleSecretSave} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes scaleUp { from { opacity:0; transform:scale(0.93); } to { opacity:1; transform:scale(1); } }
          .animate-scale-up { animation: scaleUp 0.25s ease-out forwards; }
          .scrollbar-thin::-webkit-scrollbar { width: 4px; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:999px; }
        `}</style>
      </div>
    );
  }

  // ── NORMAL SETTINGS ───────────────────────────────────────
  const tabs = [
    { key: 'timings',   label: 'Timings',   icon: '⏰', show: canEdit },
    { key: 'security',  label: 'Security',  icon: '🔒', show: canChangePins },
    { key: 'employees', label: 'Employees', icon: '👥', show: canViewAll },
    { key: 'audit',     label: 'Audit Log', icon: '📋', show: canViewAudit },
    { key: 'alerts',    label: 'Alerts',    icon: '🔔', show: ha('alerts_view') },
    { key: 'salary',    label: 'Salary',    icon: '💰', show: ha('salary_view') },
    { key: 'about',     label: 'About',     icon: 'ℹ️', show: true },
  ].filter(t => t.show);

  return (
    <div className={`space-y-5 font-sans transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-3xl p-5 md:p-6 text-white relative overflow-hidden shadow-xl shadow-blue-900/20">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-indigo-400/20 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-inner text-sm font-black">
              {getInitials(currentUser.name)}
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Settings</h2>
              <p className="text-blue-200 text-xs font-bold capitalize">{currentUser.name} · {currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-red-500/30 backdrop-blur-sm rounded-2xl text-white/80 hover:text-white text-xs font-bold border border-white/10 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* ===== TABS ===== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-2">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex-1 justify-center ${
                activeTab === t.key
                  ? 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== TIMINGS ===== */}
      {activeTab === 'timings' && canEdit && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-[#1E40AF] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-blue-700 text-sm font-medium">Set individual office timing for each employee.</p>
          </div>
          {attEmployees.map(emp => {
            const t = empTimings[emp.id]; if (!t) return null;
            return (
              <div key={emp.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <SectionHeader
                  icon={
                    <div className="w-7 h-7 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-lg flex items-center justify-center text-[9px] font-black">
                      {getInitials(emp.name)}
                    </div>
                  }
                  title={emp.name}
                  subtitle={emp.role}
                  badge={
                    <button onClick={() => applyToAll(emp.id)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E40AF] rounded-xl text-[10px] font-bold border border-blue-200 transition-all active:scale-95">
                      Apply to All
                    </button>
                  }
                />
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InputField label="Start Time">
                    <input type="time" value={t.officeStartTime || ''} onChange={e => updateEmpTiming(emp.id, 'officeStartTime', e.target.value || '09:00')} className={inputCls} />
                  </InputField>
                  <InputField label="Late After (min)">
                    <input type="number" value={t.lateThresholdMinutes} onChange={e => updateEmpTiming(emp.id, 'lateThresholdMinutes', parseInt(e.target.value) || 0)} className={inputCls} />
                  </InputField>
                  <InputField label="Full Day (hrs)">
                    <input type="number" value={t.minHoursForFullDay} onChange={e => updateEmpTiming(emp.id, 'minHoursForFullDay', parseInt(e.target.value) || 0)} className={inputCls} />
                  </InputField>
                  <InputField label="Half Day (hrs)">
                    <input type="number" value={t.minHoursForHalfDay} onChange={e => updateEmpTiming(emp.id, 'minHoursForHalfDay', parseInt(e.target.value) || 0)} className={inputCls} />
                  </InputField>
                </div>
              </div>
            );
          })}
          <button
            onClick={handleSaveTimings}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg ${
              saved
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-blue-500/20'
            }`}
          >
            {saved ? '✓ Saved!' : 'Save All Timings'}
          </button>
        </div>
      )}

      {/* ===== SECURITY ===== */}
      {activeTab === 'security' && canChangePins && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>}
            title="Change Employee PINs"
            subtitle="Update individual security codes"
          />
          <div className="p-5 space-y-3">
            {employees.map(emp => {
              if (currentUser.role !== 'admin' && emp.role === 'admin') return null;
              return (
                <div key={emp.id} className="flex items-center gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-all">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] text-white rounded-xl flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/20 shrink-0">
                    {getInitials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 font-bold text-sm truncate">{emp.name}</p>
                    <p className="text-slate-400 text-[10px] font-medium capitalize">{emp.role}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 text-xs font-mono hidden sm:block">Current: {emp.pin}</span>
                    <input
                      type="text" maxLength={4} placeholder="New PIN"
                      value={pinChanges[emp.id] || ''}
                      onChange={e => setPinChanges(p => ({ ...p, [emp.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-center font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#1E40AF] transition-all"
                    />
                  </div>
                </div>
              );
            })}
            <button
              onClick={handleSavePins}
              className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg ${
                pinSaved
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white shadow-blue-500/20'
              }`}
            >
              {pinSaved ? '✓ PINs Updated!' : 'Save PINs'}
            </button>
          </div>
        </div>
      )}

      {/* ===== EMPLOYEES ===== */}
      {activeTab === 'employees' && canViewAll && (
        <div className="space-y-4">
          {canAddEmp && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <SectionHeader
                icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" /></svg>}
                title="Add New Employee"
                subtitle="Create a new account"
              />
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} />
                  <input placeholder="4-digit PIN" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className={`${inputCls} font-mono tracking-widest`} />
                  <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className={selectCls}>
                    <option value="employee">Employee</option>
                    {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                    <option value="manager">Manager</option>
                  </select>
                  <button onClick={handleAddEmployee} className="py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95">
                    Add Employee
                  </button>
                </div>
                {addMsg && (
                  <p className={`text-sm font-bold ${addMsg.includes('!') && !addMsg.includes('Enter') && !addMsg.includes('must') ? 'text-emerald-600' : 'text-red-500'}`}>
                    {addMsg}
                  </p>
                )}
                {deviceResetMsg && (
                  <p className="text-amber-600 text-sm font-bold">🔓 {deviceResetMsg}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader
              icon={<svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
              title="Employee Directory"
              subtitle={`${employees.length} total members`}
            />
            <div className="p-4 space-y-2">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between bg-slate-50 rounded-2xl p-3.5 border border-slate-100 hover:border-slate-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md ${
                      emp.role === 'admin'   ? 'bg-gradient-to-br from-purple-500 to-purple-700 shadow-purple-500/20' :
                      emp.role === 'manager' ? 'bg-gradient-to-br from-[#1E40AF] to-[#2563EB] shadow-blue-500/20' :
                                              'bg-gradient-to-br from-slate-400 to-slate-600 shadow-slate-500/20'
                    }`}>
                      {getInitials(emp.name)}
                    </div>
                    <div>
                      <p className="text-slate-800 font-bold text-sm">{emp.name}</p>
                      <p className="text-slate-400 text-[10px] font-medium capitalize">
                        {emp.role}{emp.device_id ? ' · 📱 Device Bound' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${
                      emp.role === 'admin'   ? 'bg-purple-50 text-purple-600 border-purple-200' :
                      emp.role === 'manager' ? 'bg-blue-50 text-[#1E40AF] border-blue-200' :
                                              'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>{emp.role.toUpperCase()}</span>
                    {emp.device_id && emp.role !== 'admin' && currentUser.role !== 'employee' && (
                      <button onClick={() => handleResetDevice(emp.id, emp.name)}
                        className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold hover:bg-amber-100 border border-amber-200 transition-all active:scale-95">
                        🔄 Reset Device
                      </button>
                    )}
                    {canRemoveEmp && (
                      ((currentUser.id === 'emp-001' && emp.id !== currentUser.id) ||
                       (currentUser.id === 'emp-005' && emp.role === 'employee')) && (
                        <button onClick={() => { if (confirm(`Remove ${emp.name}?`)) { removeEmployee(emp.id); refreshEmps(); }}}
                          className="px-2.5 py-1 bg-red-50 text-red-500 rounded-xl text-[10px] font-bold hover:bg-red-100 border border-red-200 transition-all active:scale-95">
                          Remove
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== AUDIT LOG ===== */}
      {activeTab === 'audit' && canViewAudit && (
        <AuditLog currentUser={currentUser} />
      )}

      {/* ===== ALERTS ===== */}
      {activeTab === 'alerts' && ha('alerts_view') && (
        <AdminAlerts currentUser={currentUser} />
      )}

      {/* ===== SALARY ===== */}
      {activeTab === 'salary' && ha('salary_view') && (
        <SalaryCalculator currentUser={currentUser} />
      )}

      {/* ===== ABOUT ===== */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1E40AF] to-[#2563EB] rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-blue-500/30">
              <img src="/icon.png" alt="Attendify" className="w-16 h-16 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <h3 className="text-slate-900 font-black text-2xl tracking-tight">Attendify</h3>
            <p className="text-slate-400 text-sm mt-1 cursor-default select-none font-bold" onClick={handleSecretTap}>
              Version 3.0
            </p>
            {canSecret && <p className="text-slate-200 text-[10px] mt-1 select-none">Tap 7× to unlock</p>}
            <div className="mt-8 bg-slate-50 rounded-2xl p-5 text-left max-w-sm mx-auto border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Features</p>
              <ul className="space-y-2">
                {[
                  'Location-based tracking',
                  'Per-employee timing config',
                  'AI-powered queries',
                  'Work From Home requests',
                  'Leave management system',
                  'PIN-based authentication',
                  'Role-based access control',
                  'Holiday OT management',
                  'Device binding & security',
                  'Complete audit trail',
                  'Smart admin alerts',
                  'Salary calculator',
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-slate-600 text-sm font-medium">
                    <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 bg-[#1E40AF] rounded-full" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-slate-300 text-[10px] font-bold mt-8">© {new Date().getFullYear()} Attendify Inc.</p>
          </div>
        </div>
      )}

      {/* ===== HOLIDAYS ===== */}
      {(currentUser.role === 'admin' || currentUser.role === 'manager') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <SectionHeader
            icon={<svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
            title="Manage Holidays"
            subtitle="Mark official holidays for automatic OT calculation"
            badge={
              <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-[10px] font-black rounded-xl border border-purple-200">
                {holidays.length} marked
              </span>
            }
          />
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="date" value={hDate} onChange={e => setHDate(e.target.value)} className={inputCls} />
                <input type="text" placeholder="Holiday name (e.g. Independence Day)" value={hName} onChange={e => setHName(e.target.value)} className={`${inputCls} md:col-span-2`} />
                <button onClick={handleAddHoliday} className="py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 transition-all active:scale-95">
                  Mark Holiday
                </button>
              </div>
              {hMsg && (
                <p className={`text-sm font-bold mt-3 ${hMsg.includes('required') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {hMsg.includes('required') ? '⚠️' : '✓'} {hMsg}
                </p>
              )}
            </div>
            {holidays.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {holidays.sort((a, b) => b.date.localeCompare(a.date)).map(h => (
                  <div key={h.date} className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-purple-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-purple-500/20">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm font-bold">{h.name}</p>
                        <p className="text-slate-400 text-[10px] font-medium">
                          {new Date(h.date + 'T00:00:00').toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveHoliday(h.date)}
                      className="px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-[10px] font-bold hover:bg-red-100 border border-red-200 transition-all active:scale-95">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-slate-400 font-bold text-sm">No holidays marked</p>
                <p className="text-slate-300 text-xs mt-1">Add holidays above for auto OT calculation</p>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
      `}</style>
    </div>
  );
}