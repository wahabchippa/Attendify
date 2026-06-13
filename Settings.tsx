import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { 
  getSettings, saveSettings, 
  ALL_ALLOWED_IPS, EMPLOYEES, ATTENDANCE_EMPLOYEES,
  getAllEmployeeTimings, saveAllEmployeeTimings, EmployeeTiming
} from '../store';

interface SettingsProps {
  currentUser: Employee;
  onLogout: () => void;
}

export default function Settings({ currentUser, onLogout }: SettingsProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';
  const [settings, setSettingsState] = useState(getSettings());
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'timings' | 'general' | 'wifi' | 'employees' | 'about'>('timings');
  
  // Per-employee timings
  const [empTimings, setEmpTimings] = useState<Record<string, EmployeeTiming>>({});

  useEffect(() => {
    // Load existing timings or create defaults from global
    const existing = getAllEmployeeTimings();
    const merged: Record<string, EmployeeTiming> = {};
    ATTENDANCE_EMPLOYEES.forEach(emp => {
      if (existing[emp.id]) {
        merged[emp.id] = existing[emp.id];
      } else {
        merged[emp.id] = {
          employeeId: emp.id,
          officeStartTime: settings.officeStartTime || '09:00',
          lateThresholdMinutes: settings.lateThresholdMinutes || 15,
          minHoursForFullDay: settings.minHoursForFullDay || 8,
          minHoursForHalfDay: settings.minHoursForHalfDay || 4,
        };
      }
    });
    setEmpTimings(merged);
  }, []);

  const handleSaveGlobal = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateGlobalSetting = (key: string, value: string | number) => {
    setSettingsState((prev: any) => ({ ...prev, [key]: value }));
  };

  const updateEmpTiming = (empId: string, key: string, value: string | number) => {
    setEmpTimings(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [key]: value },
    }));
  };

  const handleSaveTimings = () => {
    saveAllEmployeeTimings(empTimings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Apply same timing to all employees
  const applyToAll = (sourceEmpId: string) => {
    const source = empTimings[sourceEmpId];
    if (!source) return;
    const updated: Record<string, EmployeeTiming> = {};
    ATTENDANCE_EMPLOYEES.forEach(emp => {
      updated[emp.id] = {
        ...source,
        employeeId: emp.id,
      };
    });
    setEmpTimings(updated);
  };

  // Reset employee to global defaults
  const resetToGlobal = (empId: string) => {
    setEmpTimings(prev => ({
      ...prev,
      [empId]: {
        employeeId: empId,
        officeStartTime: settings.officeStartTime || '09:00',
        lateThresholdMinutes: settings.lateThresholdMinutes || 15,
        minHoursForFullDay: settings.minHoursForFullDay || 8,
        minHoursForHalfDay: settings.minHoursForHalfDay || 4,
      },
    }));
  };

  const getEmpName = (id: string) => EMPLOYEES.find(e => e.id === id)?.name || '';
  const getEmpAvatar = (id: string) => EMPLOYEES.find(e => e.id === id)?.avatar || '?';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Settings</h2>
          <p className="text-slate-500 text-sm mt-1">System configuration & employee timings</p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 text-sm font-medium transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center text-lg font-bold text-blue-600">
            {currentUser.avatar}
          </div>
          <div className="flex-1">
            <h3 className="text-slate-800 font-semibold">{currentUser.name}</h3>
            <p className="text-slate-500 text-sm capitalize">{currentUser.role}</p>
          </div>
          {isAdmin && (
            <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium">
              Admin Access
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {[
          { key: 'timings', label: 'Employee Timings', adminOnly: true },
          { key: 'general', label: 'Global Settings', adminOnly: true },
          { key: 'wifi', label: 'WiFi Config', adminOnly: false },
          { key: 'employees', label: 'Employees', adminOnly: true },
          { key: 'about', label: 'About', adminOnly: false },
        ].filter(tab => !tab.adminOnly || isAdmin).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======= EMPLOYEE TIMINGS TAB ======= */}
      {activeTab === 'timings' && isAdmin && (
        <div className="space-y-4">
          {/* Header */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-700 text-sm">
              <strong>Employee Timings:</strong> Har employee ki alag office timing, late threshold aur working hours yahan set karein.
            </p>
          </div>

          {/* Employee Timing Cards */}
          {ATTENDANCE_EMPLOYEES.map(emp => {
            const timing = empTimings[emp.id];
            if (!timing) return null;
            return (
              <div key={emp.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Employee Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600">
                      {getEmpAvatar(emp.id)}
                    </div>
                    <div>
                      <p className="text-slate-800 font-semibold text-sm">{getEmpName(emp.id)}</p>
                      <p className="text-slate-400 text-xs capitalize">{emp.role}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyToAll(emp.id)}
                      title="Apply this timing to all employees"
                      className="px-2.5 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      Apply to All
                    </button>
                    <button
                      onClick={() => resetToGlobal(emp.id)}
                      title="Reset to global defaults"
                      className="px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Timing Fields */}
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-slate-500 text-xs mb-1.5 block font-medium">Start Time</label>
                      <input
                        type="time"
                        value={timing.officeStartTime}
                        onChange={e => updateEmpTiming(emp.id, 'officeStartTime', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1.5 block font-medium">Late After (min)</label>
                      <input
                        type="number"
                        value={timing.lateThresholdMinutes}
                        onChange={e => updateEmpTiming(emp.id, 'lateThresholdMinutes', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1.5 block font-medium">Full Day (hrs)</label>
                      <input
                        type="number"
                        value={timing.minHoursForFullDay}
                        onChange={e => updateEmpTiming(emp.id, 'minHoursForFullDay', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1.5 block font-medium">Half Day (hrs)</label>
                      <input
                        type="number"
                        value={timing.minHoursForHalfDay}
                        onChange={e => updateEmpTiming(emp.id, 'minHoursForHalfDay', parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Visual summary */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-slate-50 rounded-md text-xs text-slate-500 border border-slate-100">
                      Office: <strong className="text-slate-700">{timing.officeStartTime}</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-amber-50 rounded-md text-xs text-amber-600 border border-amber-100">
                      Late after: <strong>{timing.lateThresholdMinutes} min</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-50 rounded-md text-xs text-emerald-600 border border-emerald-100">
                      Full Day: <strong>{timing.minHoursForFullDay}h</strong>
                    </span>
                    <span className="px-2.5 py-1 bg-orange-50 rounded-md text-xs text-orange-600 border border-orange-100">
                      Half Day: <strong>{timing.minHoursForHalfDay}h</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveTimings}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium text-sm transition-colors"
            >
              {saved ? '✓ All Timings Saved!' : 'Save All Employee Timings'}
            </button>
            <p className="text-slate-400 text-xs">Changes will apply on next check-in</p>
          </div>
        </div>
      )}

      {/* ======= GLOBAL SETTINGS TAB ======= */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {isAdmin ? (
            <>
              <h3 className="text-slate-700 font-medium mb-1">Global Defaults</h3>
              <p className="text-slate-400 text-xs mb-4">New employees will get these defaults. Use "Employee Timings" tab for individual settings.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-600 text-sm mb-2 block">Default Start Time</label>
                  <input
                    type="time"
                    value={settings.officeStartTime}
                    onChange={e => updateGlobalSetting('officeStartTime', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm mb-2 block">Default Late Threshold (min)</label>
                  <input
                    type="number"
                    value={settings.lateThresholdMinutes}
                    onChange={e => updateGlobalSetting('lateThresholdMinutes', parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm mb-2 block">Default Full Day Hours</label>
                  <input
                    type="number"
                    value={settings.minHoursForFullDay}
                    onChange={e => updateGlobalSetting('minHoursForFullDay', parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-600 text-sm mb-2 block">Default Half Day Hours</label>
                  <input
                    type="number"
                    value={settings.minHoursForHalfDay}
                    onChange={e => updateGlobalSetting('minHoursForHalfDay', parseInt(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveGlobal}
                className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium text-sm transition-colors"
              >
                {saved ? '✓ Saved!' : 'Save Global Defaults'}
              </button>
            </>
          ) : (
            <div>
              <p className="text-slate-500 text-sm mb-4">Only admins can modify settings.</p>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 text-sm">Office Start Time</span>
                  <span className="text-slate-700 text-sm font-medium">{settings.officeStartTime}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 text-sm">Late After</span>
                  <span className="text-slate-700 text-sm font-medium">{settings.lateThresholdMinutes} minutes</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 text-sm">Full Day</span>
                  <span className="text-slate-700 text-sm font-medium">{settings.minHoursForFullDay} hours</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= WIFI TAB ======= */}
      {activeTab === 'wifi' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium mb-4">Allowed Public IPs</h3>
          <p className="text-slate-500 text-sm mb-4">
            Attendance can only be marked when connected to WiFi with these public IPs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_ALLOWED_IPS.map((ip, idx) => (
              <div key={ip} className="bg-slate-50 rounded-lg p-3 flex items-center gap-3 border border-slate-100">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-sm font-semibold">
                  {idx + 1}
                </div>
                <div>
                  <span className="text-slate-700 font-mono text-sm">{ip}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    <span className="text-emerald-600 text-xs">Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm">
              <strong>Note:</strong> Attendance will only work when your public IP matches one of these addresses (Office WiFi only).
            </p>
          </div>
        </div>
      )}

      {/* ======= EMPLOYEES TAB ======= */}
      {activeTab === 'employees' && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-slate-700 font-medium mb-4">Employee Directory</h3>
          <div className="space-y-2">
            {EMPLOYEES.map(emp => {
              const marksAttendance = ATTENDANCE_EMPLOYEES.find(e => e.id === emp.id);
              return (
                <div key={emp.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-sm font-semibold text-slate-600">
                      {emp.avatar}
                    </div>
                    <div>
                      <p className="text-slate-700 font-medium text-sm">{emp.name}</p>
                      <p className="text-slate-400 text-xs">ID: {emp.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      emp.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-200' :
                      emp.role === 'manager' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {emp.role.toUpperCase()}
                    </span>
                    {!marksAttendance && (
                      <p className="text-slate-400 text-xs mt-1">Admin Only</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======= ABOUT TAB ======= */}
      {activeTab === 'about' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 className="text-slate-800 font-semibold text-lg">WiFi Attendance System</h3>
            <p className="text-slate-500 text-sm mt-1">Version 2.0</p>
          </div>
          <div className="space-y-4 mt-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="text-slate-700 text-sm font-medium mb-2">Features</h4>
              <ul className="text-slate-500 text-sm space-y-1">
                <li>• WiFi-based attendance verification</li>
                <li>• Per-employee timing configuration</li>
                <li>• Work from home requests</li>
                <li>• AI-powered attendance queries</li>
                <li>• Detailed analytics & reports</li>
                <li>• Role-based access control</li>
                <li>• Mobile responsive design</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
