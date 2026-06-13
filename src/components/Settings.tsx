import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { 
  getSettings, saveSettings, getEmployees, getAttendanceEmployees,
  getAllEmployeeTimings, saveAllEmployeeTimings, EmployeeTiming,
  updateEmployeePin, addEmployee, saveEmployees
} from '../store';

interface SettingsProps { currentUser: Employee; onLogout: () => void; }

export default function Settings({ currentUser, onLogout }: SettingsProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [settings, setSettingsState] = useState(getSettings());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'timings'|'security'|'general'|'employees'|'about'>('timings');
  const [empTimings, setEmpTimings] = useState<Record<string, EmployeeTiming>>({});
  
  // Security - PIN changes
  const [pinChanges, setPinChanges] = useState<Record<string, string>>({});
  const [pinSaved, setPinSaved] = useState(false);
  
  // Add employee form
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<'employee'|'admin'|'manager'>('employee');
  const [addMsg, setAddMsg] = useState('');

  useEffect(() => {
    const existing = getAllEmployeeTimings();
    const merged: Record<string, EmployeeTiming> = {};
    getAttendanceEmployees().forEach(emp => {
      merged[emp.id] = existing[emp.id] || {
        employeeId: emp.id, officeStartTime: settings.officeStartTime || '09:00',
        lateThresholdMinutes: settings.lateThresholdMinutes || 15,
        minHoursForFullDay: settings.minHoursForFullDay || 8, minHoursForHalfDay: settings.minHoursForHalfDay || 4,
      };
    });
    setEmpTimings(merged);
  }, []);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleSaveGlobal = () => { saveSettings(settings); flash(); };
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
    Object.entries(pinChanges).forEach(([empId, pin]) => {
      if (pin && pin.length === 4) updateEmployeePin(empId, pin);
    });
    setPinChanges({});
    setPinSaved(true);
    setTimeout(() => setPinSaved(false), 2000);
  };

  const handleAddEmployee = () => {
    if (!newName.trim()) { setAddMsg('Enter name'); return; }
    if (newPin.length !== 4) { setAddMsg('PIN must be 4 digits'); return; }
    const id = `emp-${Date.now()}`;
    const avatar = newName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    addEmployee({ id, name: newName.trim(), role: newRole, pin: newPin, avatar });
    setNewName(''); setNewPin(''); setNewRole('employee');
    setAddMsg('Employee added!');
    setTimeout(() => setAddMsg(''), 2000);
  };

  const employees = getEmployees();
  const attEmployees = getAttendanceEmployees();

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
          {isAdmin && <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium">Admin</span>}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          { key: 'timings', label: 'Employee Timings', admin: true },
          { key: 'security', label: 'Security', admin: true },
          { key: 'general', label: 'Global Settings', admin: true },
          { key: 'employees', label: 'Manage Employees', admin: true },
          { key: 'about', label: 'About', admin: false },
        ].filter(t => !t.admin || isAdmin).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
        ))}
      </div>

      {/* ===== EMPLOYEE TIMINGS ===== */}
      {activeTab === 'timings' && isAdmin && (
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

      {/* ===== SECURITY (PIN Management) ===== */}
      {activeTab === 'security' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-slate-700 font-medium">Change Employee PINs</h3>
          <p className="text-slate-400 text-xs">Set a new 4-digit PIN for any employee.</p>
          <div className="space-y-3">
            {employees.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">{emp.avatar}</div>
                <div className="flex-1">
                  <p className="text-slate-800 font-medium text-sm">{emp.name}</p>
                  <p className="text-slate-400 text-xs capitalize">{emp.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Current: {emp.pin}</span>
                  <input type="text" maxLength={4} placeholder="New PIN" value={pinChanges[emp.id] || ''}
                    onChange={e => setPinChanges(p => ({ ...p, [emp.id]: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    className="w-20 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            ))}
          </div>
          <button onClick={handleSavePins} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium text-sm">
            {pinSaved ? '✓ PINs Updated!' : 'Save PIN Changes'}
          </button>
        </div>
      )}

      {/* ===== GLOBAL SETTINGS ===== */}
      {activeTab === 'general' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium mb-1">Global Defaults</h3>
          <p className="text-slate-400 text-xs mb-4">Default values for new employees.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-slate-600 text-sm mb-2 block">Default Start Time</label>
              <input type="time" value={settings.officeStartTime} onChange={e => setSettingsState((p:any) => ({...p, officeStartTime: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-slate-600 text-sm mb-2 block">Late Threshold (min)</label>
              <input type="number" value={settings.lateThresholdMinutes} onChange={e => setSettingsState((p:any) => ({...p, lateThresholdMinutes: parseInt(e.target.value)}))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-slate-600 text-sm mb-2 block">Full Day Hours</label>
              <input type="number" value={settings.minHoursForFullDay} onChange={e => setSettingsState((p:any) => ({...p, minHoursForFullDay: parseInt(e.target.value)}))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-slate-600 text-sm mb-2 block">Half Day Hours</label>
              <input type="number" value={settings.minHoursForHalfDay} onChange={e => setSettingsState((p:any) => ({...p, minHoursForHalfDay: parseInt(e.target.value)}))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <button onClick={handleSaveGlobal} className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium text-sm">{saved ? '✓ Saved!' : 'Save Defaults'}</button>
        </div>
      )}

      {/* ===== MANAGE EMPLOYEES ===== */}
      {activeTab === 'employees' && isAdmin && (
        <div className="space-y-4">
          {/* Add new employee */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-slate-700 font-medium mb-4">Add New Employee</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input placeholder="Full Name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="4-digit PIN" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,'').slice(0,4))} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={newRole} onChange={e => setNewRole(e.target.value as any)} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="employee">Employee</option><option value="admin">Admin</option><option value="manager">Manager</option>
              </select>
              <button onClick={handleAddEmployee} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 font-medium text-sm">Add</button>
            </div>
            {addMsg && <p className="text-emerald-600 text-sm mt-2">{addMsg}</p>}
          </div>

          {/* List */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-slate-700 font-medium mb-4">Employee Directory</h3>
            <div className="space-y-2">
              {employees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-600">{emp.avatar}</div>
                    <div><p className="text-slate-700 font-medium text-sm">{emp.name}</p><p className="text-slate-400 text-xs">ID: {emp.id}</p></div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${emp.role === 'admin' ? 'bg-purple-50 text-purple-600' : emp.role === 'manager' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{emp.role.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== ABOUT ===== */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4"><span className="text-white text-lg font-bold">Af</span></div>
          <h3 className="text-slate-800 font-semibold text-lg">Attendify</h3>
          <p className="text-slate-500 text-sm mt-1">Version 3.0</p>
          <div className="mt-6 bg-slate-50 rounded-lg p-4 text-left max-w-sm mx-auto">
            <ul className="text-slate-500 text-sm space-y-1">
              <li>• Location-based tracking (PK Zone / QC Center)</li>
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
