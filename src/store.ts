import { Employee, AttendanceRecord, WFHRequest } from './types';

// ========== LOCATION MAPPING ==========
export const LOCATION_MAP: Record<string, string> = {
  '103.93.13.182': 'PK Zone',
  '103.93.13.18': 'PK Zone',
  '202.141.254.126': 'QC Center',
  '157.10.30.235': 'QC Center',
};

export const ALL_ALLOWED_IPS = ['202.141.254.126', '157.10.30.235', '103.93.13.182', '103.93.13.18'];

export function getLocationFromIP(ip: string): string {
  return LOCATION_MAP[ip] || 'Office';
}

// ========== EMPLOYEES (Dynamic - stored in localStorage) ==========
const EMPLOYEES_KEY = 'att_employees';

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp-001', name: 'Abdul Wahab', role: 'admin', pin: '2687', avatar: 'AW' },
  { id: 'emp-002', name: 'Hamza Saeed', role: 'employee', pin: '2345', avatar: 'HS' },
  { id: 'emp-003', name: 'Ishtiaq ur Rehman', role: 'employee', pin: '3456', avatar: 'IR' },
  { id: 'emp-004', name: 'Behzad Riaz', role: 'employee', pin: '4567', avatar: 'BR' },
  { id: 'emp-005', name: 'Albash Akhtar', role: 'manager', pin: '8822', avatar: 'AA' },
  { id: 'emp-006', name: 'Sohail', role: 'employee', pin: '1122', avatar: 'SH' },
];

export function getEmployees(): Employee[] {
  try {
    const data = localStorage.getItem(EMPLOYEES_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(DEFAULT_EMPLOYEES));
    return DEFAULT_EMPLOYEES;
  } catch { return DEFAULT_EMPLOYEES; }
}

export function saveEmployees(employees: Employee[]): void {
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
}

export function getAttendanceEmployees(): Employee[] {
  return getEmployees().filter(e => e.id !== 'emp-005'); // exclude manager Albash
}

export function addEmployee(emp: Employee): void {
  const all = getEmployees();
  all.push(emp);
  saveEmployees(all);
}

export function updateEmployeePin(empId: string, newPin: string): void {
  const all = getEmployees();
  const idx = all.findIndex(e => e.id === empId);
  if (idx !== -1) { all[idx].pin = newPin; saveEmployees(all); }
}

export function removeEmployee(empId: string): void {
  const all = getEmployees().filter(e => e.id !== empId);
  saveEmployees(all);
}

// ========== ATTENDANCE RECORDS ==========
const ATTENDANCE_KEY = 'att_records';

export function getAttendanceRecords(): AttendanceRecord[] {
  try {
    const data = localStorage.getItem(ATTENDANCE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
}

export function addAttendanceRecord(record: AttendanceRecord): void {
  const records = getAttendanceRecords();
  records.push(record);
  saveAttendanceRecords(records);
}

export function updateAttendanceRecord(id: string, updates: Partial<AttendanceRecord>): void {
  const records = getAttendanceRecords();
  const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) { records[idx] = { ...records[idx], ...updates }; saveAttendanceRecords(records); }
}

export function getTodayRecord(employeeId: string): AttendanceRecord | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getAttendanceRecords().find(r => r.employeeId === employeeId && r.date === today);
}

// ========== WFH REQUESTS ==========
const WFH_KEY = 'att_wfh';

export function getWFHRequests(): WFHRequest[] {
  try { const d = localStorage.getItem(WFH_KEY); return d ? JSON.parse(d) : []; } catch { return []; }
}
export function saveWFHRequests(r: WFHRequest[]): void { localStorage.setItem(WFH_KEY, JSON.stringify(r)); }
export function addWFHRequest(r: WFHRequest): void { const all = getWFHRequests(); all.push(r); saveWFHRequests(all); }
export function updateWFHRequest(id: string, updates: Partial<WFHRequest>): void {
  const all = getWFHRequests(); const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; saveWFHRequests(all); }
}
export function getTodayWFHRequest(empId: string): WFHRequest | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getWFHRequests().find(r => r.employeeId === empId && r.date === today);
}
export function getPendingWFHRequests(): WFHRequest[] { return getWFHRequests().filter(r => r.status === 'pending'); }

// ========== SETTINGS ==========
const SETTINGS_KEY = 'att_settings';

export function getSettings() {
  try {
    const d = localStorage.getItem(SETTINGS_KEY);
    return d ? JSON.parse(d) : { officeStartTime: '09:00', lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4 };
  } catch { return { officeStartTime: '09:00', lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4 }; }
}
export function saveSettings(s: any): void { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ========== PER-EMPLOYEE TIMING ==========
const EMP_TIMING_KEY = 'att_emp_timings';

export interface EmployeeTiming {
  employeeId: string;
  officeStartTime: string;
  lateThresholdMinutes: number;
  minHoursForFullDay: number;
  minHoursForHalfDay: number;
}

export function getAllEmployeeTimings(): Record<string, EmployeeTiming> {
  try { const d = localStorage.getItem(EMP_TIMING_KEY); return d ? JSON.parse(d) : {}; } catch { return {}; }
}
export function saveAllEmployeeTimings(t: Record<string, EmployeeTiming>): void { localStorage.setItem(EMP_TIMING_KEY, JSON.stringify(t)); }
export function getEmployeeTiming(empId: string): EmployeeTiming {
  const all = getAllEmployeeTimings();
  if (all[empId]) return all[empId];
  const g = getSettings();
  return { employeeId: empId, officeStartTime: g.officeStartTime, lateThresholdMinutes: g.lateThresholdMinutes, minHoursForFullDay: g.minHoursForFullDay, minHoursForHalfDay: g.minHoursForHalfDay };
}

// ========== CLEAR OLD DATA (before June 15 2025) ==========
export function clearOldData(): void {
  const cutoff = '2025-06-15';
  const records = getAttendanceRecords().filter(r => r.date >= cutoff);
  saveAttendanceRecords(records);
  const wfh = getWFHRequests().filter(r => r.date >= cutoff);
  saveWFHRequests(wfh);
}

// Run on app start
export function initializeApp(): void {
  getEmployees(); // ensure employees exist
  clearOldData(); // remove anything before June 15
}
