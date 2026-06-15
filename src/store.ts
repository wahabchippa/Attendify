import { supabase } from './supabaseClient';
import { Employee, AttendanceRecord, WFHRequest, AccountRequest } from './types';

// ========== SAFE SUPABASE HELPER ==========
const db = {
  from: (table: string) => {
    if (!supabase) return null;
    try { return supabase.from(table); } catch { return null; }
  }
};

// ========== LOCATION MAPPING ==========
export const LOCATION_MAP: Record<string, string> = {
  '103.93.13.182': 'Zone', '103.93.13.18': 'Zone',
  '202.141.254.126': 'QC Center', '157.10.30.235': 'QC Center',
};
export const ALL_ALLOWED_IPS = ['202.141.254.126', '157.10.30.235', '103.93.13.182', '103.93.13.18'];
export function getLocationFromIP(ip: string): string { return LOCATION_MAP[ip] || 'Office'; }

// ========== LOCAL CACHE ==========
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

export function getEmployees(): Employee[] { return cacheGet('c_emp', DEFAULT_EMPLOYEES); }
export function getAttendanceEmployees(): Employee[] { return getEmployees().filter(e => e.role !== 'manager'); }
export function saveEmployees(e: Employee[]) { cacheSet('c_emp', e); }

async function syncEmployees() {
  try {
    const q = db.from('employees'); if (!q) return;
    const { data } = await q.select('*');
    if (data && data.length > 0) cacheSet('c_emp', data);
  } catch {}
}

export async function addEmployee(emp: Employee) {
  const all = getEmployees(); all.push(emp); cacheSet('c_emp', all);
  try { const q = db.from('employees'); if (q) { await q.upsert({ id: emp.id, name: emp.name, role: emp.role, pin: emp.pin, avatar: emp.avatar }); await syncEmployees(); } } catch {}
}

export async function updateEmployeePin(empId: string, newPin: string) {
  const all = getEmployees(); const idx = all.findIndex(e => e.id === empId);
  if (idx !== -1) { all[idx].pin = newPin; cacheSet('c_emp', all); }
  try { const q = db.from('employees'); if (q) { await q.update({ pin: newPin }).eq('id', empId); await syncEmployees(); } } catch {}
}

export async function removeEmployee(empId: string) {
  cacheSet('c_emp', getEmployees().filter(e => e.id !== empId));
  try { const q = db.from('employees'); if (q) { await q.delete().eq('id', empId); await syncEmployees(); } } catch {}
}

// ========== ATTENDANCE RECORDS ==========
export function getAttendanceRecords(): AttendanceRecord[] { return cacheGet('c_rec', []); }
export function saveAttendanceRecords(r: AttendanceRecord[]) { cacheSet('c_rec', r); }

async function syncRecords() {
  try {
    const q = db.from('attendance_records'); if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      cacheSet('c_rec', data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, date: r.date, checkIn: r.check_in, checkOut: r.check_out,
        status: r.status, totalHours: r.total_hours, wifiVerified: r.wifi_verified, ipAddress: r.ip_address, notes: r.notes,
      })));
    }
  } catch {}
}

export async function addAttendanceRecord(record: AttendanceRecord) {
  const records = getAttendanceRecords();
  if (records.find(r => r.employeeId === record.employeeId && r.date === record.date)) return;
  records.push(record); cacheSet('c_rec', records);
  try { const q = db.from('attendance_records'); if (q) await q.upsert({
    id: record.id, employee_id: record.employeeId, date: record.date, check_in: record.checkIn,
    check_out: record.checkOut, status: record.status, total_hours: record.totalHours,
    wifi_verified: record.wifiVerified, ip_address: record.ipAddress, notes: record.notes,
  }); await syncRecords(); } catch {}
}

export async function updateAttendanceRecord(id: string, updates: Partial<AttendanceRecord>) {
  const records = getAttendanceRecords(); const idx = records.findIndex(r => r.id === id);
  if (idx !== -1) { records[idx] = { ...records[idx], ...updates }; cacheSet('c_rec', records); }
  try {
    const q = db.from('attendance_records'); if (!q) return;
    const d: any = {};
    if (updates.checkOut !== undefined) d.check_out = updates.checkOut;
    if (updates.totalHours !== undefined) d.total_hours = updates.totalHours;
    if (updates.status !== undefined) d.status = updates.status;
    if (updates.notes !== undefined) d.notes = updates.notes;
    if (updates.checkIn !== undefined) d.check_in = updates.checkIn;
    if (updates.ipAddress !== undefined) d.ip_address = updates.ipAddress;
    await q.update(d).eq('id', id);
    await syncRecords();
  } catch {}
}

export function getTodayRecord(empId: string): AttendanceRecord | undefined {
  return getAttendanceRecords().find(r => r.employeeId === empId && r.date === new Date().toISOString().split('T')[0]);
}

// ========== WFH REQUESTS ==========
export function getWFHRequests(): WFHRequest[] { return cacheGet('c_wfh', []); }

async function syncWFH() {
  try {
    const q = db.from('wfh_requests'); if (!q) return;
    const { data } = await q.select('*');
    if (data) cacheSet('c_wfh', data.map((r: any) => ({
      id: r.id, employeeId: r.employee_id, date: r.date, reason: r.reason, status: r.status,
      requestedAt: r.requested_at, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at,
    })));
  } catch {}
}

export async function addWFHRequest(r: WFHRequest) {
  const all = getWFHRequests(); all.push(r); cacheSet('c_wfh', all);
  try { const q = db.from('wfh_requests'); if (q) await q.upsert({
    id: r.id, employee_id: r.employeeId, date: r.date, reason: r.reason, status: r.status,
    requested_at: r.requestedAt, reviewed_by: r.reviewedBy, reviewed_at: r.reviewedAt,
  }); } catch {}
}

export async function updateWFHRequest(id: string, updates: Partial<WFHRequest>) {
  const all = getWFHRequests(); const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_wfh', all); }
  try {
    const q = db.from('wfh_requests'); if (!q) return;
    const d: any = {};
    if (updates.status) d.status = updates.status;
    if (updates.reviewedBy) d.reviewed_by = updates.reviewedBy;
    if (updates.reviewedAt) d.reviewed_at = updates.reviewedAt;
    await q.update(d).eq('id', id);
  } catch {}
}

export function getTodayWFHRequest(empId: string): WFHRequest | undefined {
  return getWFHRequests().find(r => r.employeeId === empId && r.date === new Date().toISOString().split('T')[0]);
}
export function getPendingWFHRequests(): WFHRequest[] { return getWFHRequests().filter(r => r.status === 'pending'); }

// ========== ACCOUNT REQUESTS ==========
export function getAccountRequests(): AccountRequest[] { return cacheGet('c_acct', []); }
export function getPendingAccountRequests(): AccountRequest[] { return getAccountRequests().filter(r => r.status === 'pending'); }

async function syncAccountRequests() {
  try {
    const q = db.from('account_requests'); if (!q) return;
    const { data } = await q.select('*');
    if (data) cacheSet('c_acct', data.map((r: any) => ({
      id: r.id, name: r.name, pin: r.pin, requestedAt: r.requested_at,
      status: r.status, approvedRole: r.approved_role, reviewedBy: r.reviewed_by,
    })));
  } catch {}
}

export async function addAccountRequest(r: AccountRequest) {
  const all = getAccountRequests(); all.push(r); cacheSet('c_acct', all);
  try { const q = db.from('account_requests'); if (q) await q.upsert({ id: r.id, name: r.name, pin: r.pin, requested_at: r.requestedAt, status: r.status }); } catch {}
}

export async function updateAccountRequest(id: string, updates: Partial<AccountRequest>) {
  const all = getAccountRequests(); const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_acct', all); }
  try {
    const q = db.from('account_requests'); if (!q) return;
    const d: any = {};
    if (updates.status) d.status = updates.status;
    if (updates.approvedRole) d.approved_role = updates.approvedRole;
    if (updates.reviewedBy) d.reviewed_by = updates.reviewedBy;
    await q.update(d).eq('id', id);
  } catch {}
}

// ========== SETTINGS ==========
export function getSettings() {
  return cacheGet('c_settings', { officeStartTime: '09:00', lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4 });
}
export function saveSettings(s: any) { cacheSet('c_settings', s); }

// ========== PER-EMPLOYEE TIMING ==========
export interface EmployeeTiming {
  employeeId: string; officeStartTime: string; lateThresholdMinutes: number;
  minHoursForFullDay: number; minHoursForHalfDay: number;
}

export function getAllEmployeeTimings(): Record<string, EmployeeTiming> { return cacheGet('c_timings', {}); }

async function syncTimings() {
  try {
    const q = db.from('employee_timings'); if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      const map: Record<string, EmployeeTiming> = {};
      data.forEach((r: any) => { map[r.employee_id] = { employeeId: r.employee_id, officeStartTime: r.office_start_time, lateThresholdMinutes: r.late_threshold_minutes, minHoursForFullDay: r.min_hours_full_day, minHoursForHalfDay: r.min_hours_half_day }; });
      cacheSet('c_timings', map);
    }
  } catch {}
}

export async function saveAllEmployeeTimings(t: Record<string, EmployeeTiming>) {
  cacheSet('c_timings', t);
  try {
    const q = db.from('employee_timings'); if (!q) return;
    const rows = Object.values(t).map(v => ({ employee_id: v.employeeId, office_start_time: v.officeStartTime, late_threshold_minutes: v.lateThresholdMinutes, min_hours_full_day: v.minHoursForFullDay, min_hours_half_day: v.minHoursForHalfDay }));
    await q.upsert(rows);
  } catch {}
}

export function getEmployeeTiming(empId: string): EmployeeTiming {
  const all = getAllEmployeeTimings(); if (all[empId]) return all[empId];
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

export function getAccessControl(): Record<string, string[]> { return cacheGet('c_access', DEFAULT_ACCESS); }
export function saveAccessControl(ac: Record<string, string[]>) { cacheSet('c_access', ac); }

async function syncAccess() {
  try {
    const q = db.from('access_control'); if (!q) return;
    const { data } = await q.select('*');
    if (data && data.length > 0) {
      const map: Record<string, string[]> = {};
      data.forEach((r: any) => { if (!map[r.feature]) map[r.feature] = []; map[r.feature].push(r.employee_id); });
      cacheSet('c_access', map);
    }
  } catch {}
}

export async function grantAccess(empId: string, feature: string) {
  const ac = getAccessControl(); if (!ac[feature]) ac[feature] = [];
  if (!ac[feature].includes(empId)) ac[feature].push(empId); cacheSet('c_access', ac);
  try { const q = db.from('access_control'); if (q) await q.upsert({ feature, employee_id: empId }); } catch {}
}

export async function revokeAccess(empId: string, feature: string) {
  const ac = getAccessControl(); if (ac[feature]) ac[feature] = ac[feature].filter(id => id !== empId); cacheSet('c_access', ac);
  try { const q = db.from('access_control'); if (q) await q.delete().eq('feature', feature).eq('employee_id', empId); } catch {}
}

export function hasAccess(empId: string, feature: string): boolean { return getAccessControl()[feature]?.includes(empId) || false; }
export function canSeeOT(empId: string): boolean { return hasAccess(empId, 'ot'); }

// ========== SYNC ALL (call after any write) ==========
export async function syncAll() {
  try {
    await Promise.all([syncEmployees(), syncRecords(), syncWFH(), syncAccountRequests(), syncTimings(), syncAccess()]);
  } catch {}
}

// ========== INIT ==========
export async function initializeApp() {
  try {
    await syncAll();
  } catch (e) {
    console.warn('Sync failed, using local cache:', e);
  }
}
