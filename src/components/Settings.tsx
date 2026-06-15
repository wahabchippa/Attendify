import { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { 
  getEmployees, getAttendanceEmployees,
  getAllEmployeeTimings, saveAllEmployeeTimings, EmployeeTiming,
  updateEmployeePin, addEmployee, removeEmployee, getAttendanceRecords, saveAttendanceRecords, updateAttendanceRecord, getLocationFromIP,
  hasAccess, getAccessControl, grantAccess, revokeAccess
} from '../store';
import { format, parseISO } from 'date-fns';

interface SettingsProps { currentUser: Employee; onLogout: () => void; }

export default function Settings({ currentUser, onLogout }: SettingsProps) {
  const ha = (f: string) => hasAccess(currentUser.id, f);
  const canViewAll = ha('view_all');
  const canEdit = ha('timings');
  const canChangePins = ha('pin_change');
  const canAddEmp = ha('add_employee');
  const canRemoveEmp = ha('remove_employee');
  const canSecret = ha('secret_override');
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'timings'|'security'|'employees'|'access'|'about'>(canEdit ? 'timings' : canChangePins ? 'security' : 'about');
  const [empTimings, setEmpTimings] = useState<Record<string, EmployeeTiming>>({});
  const [pinChanges, setPinChanges] = useState<Record<string, string>>({});
  const [pinSaved, setPinSaved] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<'employee'|'admin'|'manager'>('employee');
  const [addMsg, setAddMsg] = useState('');

  // ======= SECRET PANEL (only for emp-001 Abdul Wahab) =======
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const [secretEditRecord, setSecretEditRecord] = useState<any>(null);
  const [secretFilter, setSecretFilter] = useState('');
  const [secretSaved, setSecretSaved] = useState(false);

  // Secret: Tap version number "3.0" 7 times fast to unlock
  const handleSecretTap = () => {
    if (!canSecret) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 2000);
    if (tapCountRef.current >= 7) {
      setSecretUnlocked(true);
      tapCountRef.current = 0;
    }
  };

  const handleSecretSave = async () => {
    if (!secretEditRecord) return;
    const clean = { ...secretEditRecord };
    delete clean._editing; delete clean.checkInTime; delete clean.checkOutTime;
    await updateAttendanceRecord(clean.id, {
      status: clean.status, totalHours: clean.totalHours,
      checkIn: clean.checkIn, checkOut: clean.checkOut,
      ipAddress: clean.ipAddress, notes: clean.notes, date: clean.date,
    });
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
    setSecretEditRecord(null);
  };

  const handleSecretAddRecord = async () => {
    const rec = {
      id: `manual-${Date.now()}`,
      employeeId: secretEditRecord?.employeeId || '',
      date: secretEditRecord?.date || new Date().toISOString().split('T')[0],
      checkIn: secretEditRecord?.checkIn || null,
      checkOut: secretEditRecord?.checkOut || null,
      status: secretEditRecord?.status || 'present',
      totalHours: secretEditRecord?.totalHours || 8,
      wifiVerified: true,
      ipAddress: secretEditRecord?.ipAddress || '103.93.13.182',
      notes: secretEditRecord?.notes || '',
    };
    // Bypass duplicate check — manual override
    const records = getAttendanceRecords();
    records.push(rec); saveAttendanceRecords(records);
    try {
      const { supabase } = await import('../supabaseClient');
      if (supabase) await supabase.from('attendance_records').upsert({
        id: rec.id, employee_id: rec.employeeId, date: rec.date, check_in: rec.checkIn,
        check_out: rec.checkOut, status: rec.status, total_hours: rec.totalHours,
        wifi_verified: true, ip_address: rec.ipAddress, notes: rec.notes,
      });
    } catch {}
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
    setSecretEditRecord(null);
  };

  const handleSecretDelete = async (id: string) => {
    const records = getAttendanceRecords().filter(r => r.id !== id);
    saveAttendanceRecords(records);
    try {
      const { supabase } = await import('../supabaseClient');
      if (supabase) await supabase.from('attendance_records').delete().eq('id', id);
    } catch {}
    setSecretSaved(true); setTimeout(() => setSecretSaved(false), 2000);
  };
  // ======= END SECRET =======

  useEffect(() => {
    const existing = getAllEmployeeTimings();
    const merged: Record<string, EmployeeTiming> = {};
    getAttendanceEmployees().forEach(emp => {
      merged[emp.id] = existing[emp.id] || {
        employeeId: emp.id, officeStartTime: '09:00',
        lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4,
      };
    });
    setEmpTimings(merged);
  }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleSaveTimings = () => { saveAllEmployeeTimings(empTimings); flash(); };
  const updateEmpTiming = (id: string, key: string, val: string|number) => {
    setEmpTimings(p => ({ ...p, [id]: { ...p[id], [key]: val } }));
  };
  const applyToAll = (srcId: string) => {
    const src = empTimings[srcId]; if (!src) return;
    const u: Record<string, EmployeeTiming> = {};
    getAttendanceEmployees().forEach(e => { u[e.id] = { ...src, employeeId: e.id }; });
    setEmpTimings(u);
  };
  const handleSavePins = () => {
    Object.entries(pinChanges).forEach(([empId, pin]) => { if (pin && pin.length === 4) updateEmployeePin(empId, pin); });
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

  const [empRefresh, setEmpRefresh] = useState(0);
  const employees = getEmployees();
  const attEmployees = getAttendanceEmployees();
  const refreshEmps = () => setEmpRefresh(p => p + 1);

  // ======= SECRET PANEL RENDER =======
  if (secretUnlocked) {
    const allRecords = getAttendanceRecords();
    const filtered = secretFilter 
      ? allRecords.filter(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return emp?.name.toLowerCase().includes(secretFilter.toLowerCase()) || r.date.includes(secretFilter);
        })
      : allRecords.slice(-50);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Override Panel</h2>
            <p className="text-slate-400 text-xs">Full record control</p>
          </div>
          <button onClick={() => { setSecretUnlocked(false); setSecretEditRecord(null); }}
            className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-200">Close</button>
        </div>

        {secretSaved && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-700 text-sm font-medium">✓ Saved successfully</div>}

        {/* Create new record */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 font-medium text-sm mb-3">Create New Record</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={secretEditRecord?.employeeId || ''} onChange={e => setSecretEditRecord((p:any) => ({...p, employeeId: e.target.value}))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Employee</option>
              {attEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <input type="date" value={secretEditRecord?.date || ''} onChange={e => setSecretEditRecord((p:any) => ({...p, date: e.target.value}))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <select value={secretEditRecord?.status || 'present'} onChange={e => setSecretEditRecord((p:any) => ({...p, status: e.target.value}))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
              <option value="half-day">Half Day</option><option value="work-from-home">WFH</option>
            </select>
            <input type="number" step="0.5" placeholder="Hours" value={secretEditRecord?.totalHours || ''} 
              onChange={e => setSecretEditRecord((p:any) => ({...p, totalHours: parseFloat(e.target.value)||0}))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div><label className="text-xs text-slate-500 mb-1 block">Check In</label>
                  <input type="time" value={secretEditRecord.checkInTime||''} 
                    onChange={e => setSecretEditRecord((p:any) => ({...p, checkInTime: e.target.value, checkIn: new Date(`${p.date}T${e.target.value}:00`).toISOString()}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                    
                <div><label className="text-xs text-slate-500 mb-1 block">Check Out</label>
                  <input type="time" value={secretEditRecord.checkOutTime||''} 
                    onChange={e => setSecretEditRecord((p:any) => ({...p, checkOutTime: e.target.value, checkOut: new Date(`${p.date}T${e.target.value}:00`).toISOString()}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
            <select value={secretEditRecord?.ipAddress || '103.93.13.182'} onChange={e => setSecretEditRecord((p:any) => ({...p, ipAddress: e.target.value}))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="103.93.13.182">Zone</option><option value="103.93.13.18">Zone</option>
              <option value="202.141.254.126">QC Center</option><option value="157.10.30.235">QC Center</option>
            </select>
            <button onClick={handleSecretAddRecord} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium">Add Record</button>
          </div>
        </div>

        {/* Search & Edit existing */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-slate-700 font-medium text-sm">Edit Records</h3>
            <input placeholder="Search name or date..." value={secretFilter} onChange={e => setSecretFilter(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filtered.sort((a,b) => b.date.localeCompare(a.date)).map(rec => {
              const emp = employees.find(e => e.id === rec.employeeId);
              return (
                <div key={rec.id} className="flex flex-wrap items-center gap-2 py-2 px-3 bg-slate-50 rounded-lg text-xs">
                  <span className="font-medium text-slate-700 w-28 truncate">{emp?.name || rec.employeeId}</span>
                  <span className="text-slate-500 w-20">{rec.date}</span>
                  <span className={`px-1.5 py-0.5 rounded w-16 text-center font-medium ${
                    rec.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                    rec.status === 'late' ? 'bg-amber-100 text-amber-700' :
                    rec.status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>{rec.status === 'work-from-home' ? 'WFH' : rec.status.toUpperCase()}</span>
                  <span className="text-slate-500 w-14">{rec.totalHours}h</span>
                  <span className="text-blue-600 w-16">{getLocationFromIP(rec.ipAddress)}</span>
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => {
                      const ciTime = rec.checkIn ? format(parseISO(rec.checkIn), 'HH:mm') : '';
                      const coTime = rec.checkOut ? format(parseISO(rec.checkOut), 'HH:mm') : '';
                      setSecretEditRecord({...rec, checkInTime: ciTime, checkOutTime: coTime, _editing: true});
                    }} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">Edit</button>
                    <button onClick={() => handleSecretDelete(rec.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit modal */}
        {/* ACCESS CONTROL inside override */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-slate-700 font-medium text-sm mb-3">Access Control</h3>
          <p className="text-slate-400 text-xs mb-3">Grant or revoke feature access for any employee.</p>
          {(() => {
            const ac = getAccessControl();
            const allE = employees;
            const labels: Record<string, string> = {
              ot:'View Overtime', ai:'AI Search', analytics:'Analytics', settings:'Settings',
              pin_change:'Change PINs', add_employee:'Add Employee', remove_employee:'Remove Employee',
              timings:'Employee Timings', wfh_approve:'Approve WFH', secret_override:'Secret Override', view_all:'View All Data',
            };
            return Object.keys(ac).map(feat => (
              <div key={feat} className="mb-3 bg-slate-50 rounded-lg p-3">
                <h4 className="text-slate-600 text-xs font-medium mb-2">{labels[feat]||feat}</h4>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(ac[feat]||[]).map(eid => {
                    const emp = allE.find(e => e.id === eid);
                    return <span key={eid} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
                      {emp?.name||eid}<button onClick={() => { revokeAccess(eid, feat); refreshEmps(); }} className="text-red-400 hover:text-red-600">✕</button>
                    </span>;
                  })}
                </div>
                <select onChange={e => { if(e.target.value) { grantAccess(e.target.value, feat); refreshEmps(); e.target.value=''; }}}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs w-full" defaultValue="">
                  <option value="">+ Add...</option>
                  {allE.filter(e => !(ac[feat]||[]).includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            ));
          })()}
        </div>

        {secretEditRecord?._editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
            <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg">
              <h3 className="font-semibold text-slate-800 mb-4">Edit Record — {employees.find(e=>e.id===secretEditRecord.employeeId)?.name} — {secretEditRecord.date}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-500 mb-1 block">Status</label>
                  <select value={secretEditRecord.status} onChange={e => setSecretEditRecord((p:any) => ({...p, status: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option>
                    <option value="half-day">Half Day</option><option value="work-from-home">WFH</option>
                  </select></div>
                <div><label className="text-xs text-slate-500 mb-1 block">Total Hours</label>
                  <input type="number" step="0.5" value={secretEditRecord.totalHours} onChange={e => setSecretEditRecord((p:any) => ({...p, totalHours: parseFloat(e.target.value)||0}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">Check In</label>
                  <input type="time" value={secretEditRecord.checkInTime||''} onChange={e => setSecretEditRecord((p:any) => ({...p, checkInTime: e.target.value, checkIn: `${p.date}T${e.target.value}:00.000Z`}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">Check Out</label>
                  <input type="time" value={secretEditRecord.checkOutTime||''} onChange={e => setSecretEditRecord((p:any) => ({...p, checkOutTime: e.target.value, checkOut: `${p.date}T${e.target.value}:00.000Z`}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-slate-500 mb-1 block">Location</label>
                  <select value={secretEditRecord.ipAddress} onChange={e => setSecretEditRecord((p:any) => ({...p, ipAddress: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="103.93.13.182">Zone</option><option value="103.93.13.18">Zone</option>
                    <option value="202.141.254.126">QC Center</option><option value="157.10.30.235">QC Center (2)</option>
                  </select></div>
                <div><label className="text-xs text-slate-500 mb-1 block">Date</label>
                  <input type="date" value={secretEditRecord.date} onChange={e => setSecretEditRecord((p:any) => ({...p, date: e.target.value}))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setSecretEditRecord(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium">Cancel</button>
                <button onClick={handleSecretSave} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======= NORMAL SETTINGS =======
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold text-slate-800">Settings</h2><p className="text-slate-500 text-sm mt-1">System Configuration</p></div>
        <button onClick={onLogout} className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 text-sm font-medium">Logout</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-lg font-bold text-blue-600">{currentUser.avatar}</div>
          <div className="flex-1"><h3 className="text-slate-800 font-semibold">{currentUser.name}</h3><p className="text-slate-500 text-sm capitalize">{currentUser.role}</p></div>
          {canViewAll && <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium capitalize">{currentUser.role}</span>}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          { key: 'timings', label: 'Employee Timings', show: canEdit },
          { key: 'security', label: 'Security', show: canChangePins },
          { key: 'employees', label: 'Employees', show: canViewAll },

          { key: 'about', label: 'About', show: true },
        ].filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
        ))}
      </div>

      {/* EMPLOYEE TIMINGS */}
      {activeTab === 'timings' && canEdit && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><p className="text-blue-700 text-sm"><strong>Employee Timings:</strong> Set individual office timing for each employee.</p></div>
          {attEmployees.map(emp => {
            const t = empTimings[emp.id]; if (!t) return null;
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">{emp.avatar}</div>
                    <div><p className="text-slate-800 font-semibold text-sm">{emp.name}</p><p className="text-slate-400 text-xs capitalize">{emp.role}</p></div>
                  </div>
                  <button onClick={() => applyToAll(emp.id)} className="px-2.5 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-200">Apply to All</button>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><label className="text-slate-500 text-xs mb-1.5 block font-medium">Start Time</label>
                    <input type="time" value={t.officeStartTime} onChange={e => updateEmpTiming(emp.id, 'officeStartTime', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="text-slate-500 text-xs mb-1.5 block font-medium">Late After (min)</label>
                    <input type="number" value={t.lateThresholdMinutes} onChange={e => updateEmpTiming(emp.id, 'lateThresholdMinutes', parseInt(e.target.value)||0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="text-slate-500 text-xs mb-1.5 block font-medium">Full Day (hrs)</label>
                    <input type="number" value={t.minHoursForFullDay} onChange={e => updateEmpTiming(emp.id, 'minHoursForFullDay', parseInt(e.target.value)||0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                  <div><label className="text-slate-500 text-xs mb-1.5 block font-medium">Half Day (hrs)</label>
                    <input type="number" value={t.minHoursForHalfDay} onChange={e => updateEmpTiming(emp.id, 'minHoursForHalfDay', parseInt(e.target.value)||0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                </div>
              </div>
            );
          })}
          <button onClick={handleSaveTimings} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium text-sm">{saved ? '✓ Saved!' : 'Save All Timings'}</button>
        </div>
      )}

      {/* SECURITY */}
      {activeTab === 'security' && canChangePins && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-slate-700 font-medium">Change Employee PINs</h3>
          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">{emp.avatar}</div>
                <div className="flex-1"><p className="text-slate-800 font-medium text-sm">{emp.name}</p><p className="text-slate-400 text-xs capitalize">{emp.role}</p></div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Current: {emp.pin}</span>
                  <input type="text" maxLength={4} placeholder="New" value={pinChanges[emp.id] || ''}
                    onChange={e => setPinChanges(p => ({ ...p, [emp.id]: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleSavePins} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium text-sm">{pinSaved ? '✓ Updated!' : 'Save PINs'}</button>
        </div>
      )}

      {/* MANAGE EMPLOYEES */}
      {activeTab === 'employees' && canViewAll && (
        <div className="space-y-4">
          {canAddEmp && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-slate-700 font-medium mb-4">Add New Employee</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input placeholder="4-digit PIN" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="employee">Employee</option>
                  {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                  <option value="manager">Manager</option>
                </select>
                <button onClick={handleAddEmployee} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 font-medium text-sm">Add</button>
              </div>
              {addMsg && <p className="text-emerald-600 text-sm mt-2">{addMsg}</p>}
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-slate-700 font-medium mb-4">Employee Directory</h3>
            <div className="space-y-2">
              {employees.map(emp => (
                 <div key={emp.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-600">{emp.avatar}</div>
                    <div><p className="text-slate-700 font-medium text-sm">{emp.name}</p><p className="text-slate-400 text-xs capitalize">{emp.role}</p></div>
                  </div>
                   <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-50 text-purple-600' : emp.role === 'manager' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{emp.role.toUpperCase()}</span>
                    {canRemoveEmp && (
                      ((currentUser.id === 'emp-001' && emp.id !== currentUser.id) ||
                        (currentUser.id === 'emp-005' && emp.role === 'employee')) && (
                        <button onClick={() => { if(confirm(`Remove ${emp.name}?`)) { removeEmployee(emp.id); refreshEmps(); } }}
                          className="px-2 py-1 bg-red-50 text-red-500 rounded text-xs font-medium hover:bg-red-100 border border-red-200">Remove</button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}



      {/* ABOUT - with secret tap on version */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4"><span className="text-white text-lg font-bold">Af</span></div>
          <h3 className="text-slate-800 font-semibold text-lg">Attendify</h3>
          <p className="text-slate-500 text-sm mt-1 cursor-default select-none" onClick={handleSecretTap}>Version 3.0</p>
          <div className="mt-6 bg-slate-50 rounded-lg p-4 text-left max-w-sm mx-auto">
            <ul className="text-slate-500 text-sm space-y-1">
              <li>• Location-based tracking (Zone / QC Center)</li>
              <li>• Per-employee timing configuration</li>
              <li>• AI-powered queries</li>
              <li>• Work from home requests</li>
              <li>• PIN-based security</li>
              <li>• Role-based access control</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
