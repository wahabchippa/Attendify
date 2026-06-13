import { supabase } from './supabaseClient';
import { Employee, AttendanceRecord, WFHRequest, AccountRequest } from './types';

// ========== LOCATION MAPPING ==========
export const LOCATION_MAP: Record<string, string> = {
  '103.93.13.182': 'Zone', '103.93.13.18': 'Zone',
  '202.141.254.126': 'QC Center', '157.10.30.235': 'QC Center',
};
export const ALL_ALLOWED_IPS = ['202.141.254.126', '157.10.30.235', '103.93.13.182', '103.93.13.18'];
export function getLocationFromIP(ip: string): string { return LOCATION_MAP[ip] || 'Office'; }

// ========== LOCAL CACHE LAYER ==========
// We cache in localStorage for speed, but Supabase is the source of truth
const CACHE = {
  employees: 'cache_employees',
  records: 'cache_records',
  wfh: 'cache_wfh',
  accountReq: 'cache_account_requests',
  timings: 'cache_emp_timings',
  access: 'cache_access_control',
};

function cacheSet(key: string, data: any) { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }
function cacheGet<T>(key: string, fallback: T): T { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; } }

// ========== EMPLOYEES ==========
const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp-001', name: 'Abdul Wahab', role: 'admin', pin: '2687', avatar: 'AW' },
  { id: 'emp-002', name: 'Hamza Saeed', role: 'employee', pin: '2345', avatar: 'HS' },
  { id: 'emp-003', name: 'Ishtiaq ur Rehman', role: 'employee', pin: '3456', avatar: 'IR' },
  { id: 'emp-004', name: 'Behzad Riaz', role: 'employee', pin: '4567', avatar: 'BR' },
  { id: 'emp-005', name: 'Albash Akhtar', role: 'manager', pin: '8822', avatar: 'AA' },
  { id: 'emp-006', name: 'Sohail', role: 'employee', pin: '1122', avatar: 'SH' },
];

export function getEmployees(): Employee[] { return cacheGet(CACHE.employees, DEFAULT_EMPLOYEES); }
export function getAttendanceEmployees(): Employee[] { return getEmployees().filter(e => e.role !== 'manager'); }

export async function syncEmployees() {
  const { data } = await supabase.from('employees').select('*');
  if (data && data.length > 0) { cacheSet(CACHE.employees, data); return data; }
  return getEmployees();
}

export function saveEmployees(employees: Employee[]) {
  cacheSet(CACHE.employees, employees);
}

export async function addEmployee(emp: Employee) {
  const all = getEmployees(); all.push(emp); cacheSet(CACHE.employees, all);
  await supabase.from('employees').upsert({ id: emp.id, name: emp.name, role: emp.role, pin: emp.pin, avatar: emp.avatar });
}

export async function updateEmployeePin(empId: string, newPin: string) {
  const all = getEmployees(); const idx = all.findIndex(e => e.id === empId);
  if (idx !== -1) { all[idx].pin = newPin; cacheSet(CACHE.employees, all); }
  await supabase.from('employees').update({ pin: newPin }).eq('id', empId);
}

export async function removeEmployee(empId: string) {
  const all = getEmployees().filter(e => e.id !== empId); cacheSet(CACHE.employees, all);
  await supabase.from('employees').delete().eq('id', empId);
}

// ========== ATTENDANCE RECORDS ==========
export function getAttendanceRecords(): AttendanceRecord[] { return cacheGet(CACHE.records, []); }

export async function syncRecords() {
  const { data } = await supabase.from('attendance_records').select('*');
  if (data) {
    const mapped = data.map((r: any) => ({
      id: r.id, employeeId: r.employee_id, date: r.date, checkIn: r.check_in, checkOut: r.check_out,
      status: r.status, totalHours: r.total_hours, wifiVerified: r.wifi_verified, ipAddress: r.ip_address, notes: r.notes,
    }));
    cacheSet(CACHE.records, mapped); return mapped;
  }
  return getAttendanceRecords();
}

export function saveAttendanceRecords(records: AttendanceRecord[]) { cacheSet(CACHE.records, records); }

export async function addAttendanceRecord(record: AttendanceRecord) {
  const records = getAttendanceRecords();
  if (records.find(r => r.employeeId === record.employeeId && r.date === record.date)) return;
  records.push(record); cacheSet(CACHE.records, records);
  await supabase.from('attendance_records').upsert({
    id: record.id, employee_id: record.employeeId, date: record.date, check_in: record.checkIn,
    check_out: record.checkOut, status: record.status, total_hours: record.totalHours,
    wifi_verified: record.wifiVerified, ip_address: record.ipAddress, notes: record.notes,
  });
}

export async function updateAttendanceRecord(id: string, updates: Partial<AttendanceRecord>) {
  const records = getAttendanceRecords(); const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) { records[idx] = { ...records[idx], ...updates }; cacheSet(CACHE.records, records); }
  const dbUpdates: any = {};
  if (updates.checkOut !== undefined) dbUpdates.check_out = updates.checkOut;
  if (updates.totalHours !== undefined) dbUpdates.total_hours = updates.totalHours;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.checkIn !== undefined) dbUpdates.check_in = updates.checkIn;
  if (updates.ipAddress !== undefined) dbUpdates.ip_address = updates.ipAddress;
  await supabase.from('attendance_records').update(dbUpdates).eq('id', id);
}

export function getTodayRecord(employeeId: string): AttendanceRecord | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getAttendanceRecords().find(r => r.employeeId === employeeId && r.date === today);
}

// ========== WFH REQUESTS ==========
export function getWFHRequests(): WFHRequest[] { return cacheGet(CACHE.wfh, []); }

export async function syncWFH() {
  const { data } = await supabase.from('wfh_requests').select('*');
  if (data) {
    const mapped = data.map((r: any) => ({
      id: r.id, employeeId: r.employee_id, date: r.date, reason: r.reason, status: r.status,
      requestedAt: r.requested_at, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at,
    }));
    cacheSet(CACHE.wfh, mapped); return mapped;
  }
  return getWFHRequests();
}

export async function addWFHRequest(r: WFHRequest) {
  const all = getWFHRequests(); all.push(r); cacheSet(CACHE.wfh, all);
  await supabase.from('wfh_requests').upsert({
    id: r.id, employee_id: r.employeeId, date: r.date, reason: r.reason, status: r.status,
    requested_at: r.requestedAt, reviewed_by: r.reviewedBy, reviewed_at: r.reviewedAt,
  });
}

export async function updateWFHRequest(id: string, updates: Partial<WFHRequest>) {
  const all = getWFHRequests(); const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet(CACHE.wfh, all); }
  const db: any = {};
  if (updates.status) db.status = updates.status;
  if (updates.reviewedBy) db.reviewed_by = updates.reviewedBy;
  if (updates.reviewedAt) db.reviewed_at = updates.reviewedAt;
  await supabase.from('wfh_requests').update(db).eq('id', id);
}

export function getTodayWFHRequest(empId: string): WFHRequest | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getWFHRequests().find(r => r.employeeId === empId && r.date === today);
}
export function getPendingWFHRequests(): WFHRequest[] { return getWFHRequests().filter(r => r.status === 'pending'); }

// ========== ACCOUNT REQUESTS ==========
export function getAccountRequests(): AccountRequest[] { return cacheGet(CACHE.accountReq, []); }

export async function syncAccountRequests() {
  const { data } = await supabase.from('account_requests').select('*');
  if (data) {
    const mapped = data.map((r: any) => ({
      id: r.id, name: r.name, pin: r.pin, requestedAt: r.requested_at,
      status: r.status, approvedRole: r.approved_role, reviewedBy: r.reviewed_by,
    }));
    cacheSet(CACHE.accountReq, mapped); return mapped;
  }
  return getAccountRequests();
}

export async function addAccountRequest(r: AccountRequest) {
  const all = getAccountRequests(); all.push(r); cacheSet(CACHE.accountReq, all);
  await supabase.from('account_requests').upsert({
    id: r.id, name: r.name, pin: r.pin, requested_at: r.requestedAt, status: r.status,
  });
}

export function getPendingAccountRequests(): AccountRequest[] { return getAccountRequests().filter(r => r.status === 'pending'); }

export async function updateAccountRequest(id: string, updates: Partial<AccountRequest>) {
  const all = getAccountRequests(); const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet(CACHE.accountReq, all); }
  const db: any = {};
  if (updates.status) db.status = updates.status;
  if (updates.approvedRole) db.approved_role = updates.approvedRole;
  if (updates.reviewedBy) db.reviewed_by = updates.reviewedBy;
  await supabase.from('account_requests').update(db).eq('id', id);
}

// ========== SETTINGS ==========
export function getSettings() {
  return cacheGet('cache_settings', { officeStartTime: '09:00', lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4 });
}
export function saveSettings(s: any) { cacheSet('cache_settings', s); }

// ========== PER-EMPLOYEE TIMING ==========
export interface EmployeeTiming {
  employeeId: string; officeStartTime: string; lateThresholdMinutes: number;
  minHoursForFullDay: number; minHoursForHalfDay: number;
}

export function getAllEmployeeTimings(): Record<string, EmployeeTiming> { return cacheGet(CACHE.timings, {}); }

export async function syncTimings() {
  const { data } = await supabase.from('employee_timings').select('*');
  if (data) {
    const map: Record<string, EmployeeTiming> = {};
    data.forEach((r: any) => {
      map[r.employee_id] = { employeeId: r.employee_id, officeStartTime: r.office_start_time,
        lateThresholdMinutes: r.late_threshold_minutes, minHoursForFullDay: r.min_hours_full_day, minHoursForHalfDay: r.min_hours_half_day };
    });
    cacheSet(CACHE.timings, map); return map;
  }
  return getAllEmployeeTimings();
}

export async function saveAllEmployeeTimings(t: Record<string, EmployeeTiming>) {
  cacheSet(CACHE.timings, t);
  const rows = Object.values(t).map(v => ({
    employee_id: v.employeeId, office_start_time: v.officeStartTime,
    late_threshold_minutes: v.lateThresholdMinutes, min_hours_full_day: v.minHoursForFullDay, min_hours_half_day: v.minHoursForHalfDay,
  }));
  await supabase.from('employee_timings').upsert(rows);
}

export function getEmployeeTiming(empId: string): EmployeeTiming {
  const all = getAllEmployeeTimings();
  if (all[empId]) return all[empId];
  const g = getSettings();
  return { employeeId: empId, officeStartTime: g.officeStartTime, lateThresholdMinutes: g.lateThresholdMinutes, minHoursForFullDay: g.minHoursForFullDay, minHoursForHalfDay: g.minHoursForHalfDay };
}

// ========== ACCESS CONTROL ==========
const DEFAULT_ACCESS: Record<string, string[]> = {
  ot:['emp-001','emp-005'], ai:['emp-001','emp-005'], analytics:['emp-001','emp-005'],
  settings:['emp-001','emp-005'], pin_change:['emp-001','emp-005'],
  add_employee:['emp-001','emp-005'], remove_employee:['emp-001','emp-005'],
  timings:['emp-001'], wfh_approve:['emp-001','emp-005'],
  secret_override:['emp-001'], view_all:['emp-001','emp-005'],
};

export function getAccessControl(): Record<string, string[]> { return cacheGet(CACHE.access, DEFAULT_ACCESS); }

export async function syncAccessControl() {
  const { data } = await supabase.from('access_control').select('*');
  if (data && data.length > 0) {
    const map: Record<string, string[]> = {};
    data.forEach((r: any) => { if (!map[r.feature]) map[r.feature] = []; map[r.feature].push(r.employee_id); });
    cacheSet(CACHE.access, map); return map;
  }
  return getAccessControl();
}

export function saveAccessControl(ac: Record<string, string[]>) { cacheSet(CACHE.access, ac); }

export async function grantAccess(empId: string, feature: string) {
  const ac = getAccessControl();
  if (!ac[feature]) ac[feature] = [];
  if (!ac[feature].includes(empId)) ac[feature].push(empId);
  cacheSet(CACHE.access, ac);
  await supabase.from('access_control').upsert({ feature, employee_id: empId });
}

export async function revokeAccess(empId: string, feature: string) {
  const ac = getAccessControl();
  if (ac[feature]) ac[feature] = ac[feature].filter(id => id !== empId);
  cacheSet(CACHE.access, ac);
  await supabase.from('access_control').delete().eq('feature', feature).eq('employee_id', empId);
}

export function hasAccess(empId: string, feature: string): boolean {
  return getAccessControl()[feature]?.includes(empId) || false;
}

export function canSeeOT(empId: string): boolean { return hasAccess(empId, 'ot'); }

// ========== SYNC ALL ON APP START ==========
export async function initializeApp() {
  try {
    await Promise.all([
      syncEmployees(), syncRecords(), syncWFH(),
      syncAccountRequests(), syncTimings(), syncAccessControl(),
    ]);
  } catch (e) {
    console.warn('Supabase sync failed, using cache:', e);
  }
}
