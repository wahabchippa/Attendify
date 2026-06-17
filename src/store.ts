import { createClient } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, WFHRequest, AccountRequest } from './types';

const url = 'https://gefkpawkljalbevkxytn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZmtwYXdrbGphbGJldmt4eXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjQ5ODgsImV4cCI6MjA5Njk0MDk4OH0.2MC8c4HpKYbBfO_0FCE53_nnwkN7nhqjYIAbvKGHSZE';

export const supabase = createClient(url, key);

const db = {
  from: (table: string) => {
    if (!supabase) return null;
    try { return supabase.from(table); } catch { return null; }
  }
};

// PKT (Pakistan/Karachi) time helpers
export function getPKTDate(): Date {
  const now = new Date();
  const pktOffset = 5 * 60;
  const localOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (pktOffset + localOffset) * 60 * 1000);
}

export function getPKTDateString(): string {
  const pkt = getPKTDate();
  const year = pkt.getFullYear();
  const month = String(pkt.getMonth() + 1).padStart(2, '0');
  const day = String(pkt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPKTISOString(): string {
  const pkt = getPKTDate();
  const year = pkt.getFullYear();
  const month = String(pkt.getMonth() + 1).padStart(2, '0');
  const day = String(pkt.getDate()).padStart(2, '0');
  const hours = String(pkt.getHours()).padStart(2, '0');
  const minutes = String(pkt.getMinutes()).padStart(2, '0');
  const seconds = String(pkt.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:00`;
}

export interface OfficeLocation {
  id: number;
  name: string;
  ip_address: string;
  is_active: boolean;
}

const DEFAULT_LOCATIONS: OfficeLocation[] = [
  { id: 1, name: 'Zone', ip_address: '103.93.12.229', is_active: true },
  { id: 2, name: 'QC Center', ip_address: '202.141.254.126', is_active: true },
  { id: 3, name: 'QC Center', ip_address: '157.10.30.235', is_active: true }
];

export function getOfficeLocations(): OfficeLocation[] { 
  return cacheGet('c_locations', DEFAULT_LOCATIONS); 
}

export function getLocationFromIP(ip: string): string { 
  const locs = getOfficeLocations();
  const found = locs.find(l => l.ip_address === ip);
  return found ? found.name : 'Office'; 
}

async function syncLocations() {
  try {
    const q = db.from('office_locations'); if (!q) return;
    const { data } = await q.select('*').eq('is_active', true);
    if (data && data.length > 0) cacheSet('c_locations', data);
  } catch {}
}

function cacheSet(key: string, data: any) { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} }
function cacheGet<T>(key: string, fallback: T): T { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; } catch { return fallback; } }

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

// 👇 YEH NAYA FUNCTION HAI JO DEVICE KO LOCK/RESET KAREGA 👇
export async function bindEmployeeDevice(empId: string, deviceId: string | null) {
  const all = getEmployees(); 
  const idx = all.findIndex(e => e.id === empId);
  
  // Local cache update
  if (idx !== -1) { 
    (all[idx] as any).device_id = deviceId; 
    cacheSet('c_emp', all); 
  }
  
  // Supabase database update
  try { 
    const q = db.from('employees'); 
    if (q) { 
      await q.update({ device_id: deviceId }).eq('id', empId); 
      await syncEmployees(); 
    } 
  } catch (e) {
    console.error('bindEmployeeDevice failed:', e);
  }
}

export function getAttendanceRecords(): AttendanceRecord[] { return cacheGet('c_rec', []); }
export function saveAttendanceRecords(r: AttendanceRecord[]) { cacheSet('c_rec', r); }

async function syncRecords() {
  try {
    const q = db.from('attendance_logs'); if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      cacheSet('c_rec', data.map((r: any) => ({
        id: String(r.id),
        employeeId: r.user_id ? `emp-${String(r.user_id).padStart(3, '0')}` : 'emp-001',
        date: r.date,
        checkIn: r.login_time,
        checkOut: (r.logout_time && r.logout_time !== r.login_time) ? r.logout_time : null,
        status: r.status || 'present',
                totalHours: r.total_hours || 0,
        overtime_hours: r.overtime_hours || 0, // 🌟 Yeh add karein
        wifiVerified: r.wifi_connected === 'true' || r.wifi_connected === true,
                ipAddress: r.notes && r.notes.includes('QC') ? '202.141.254.126' : '103.93.12.229',
        notes: r.notes || '',
      })));
    }
  } catch {}
}

export function getTodayRecord(empId: string): AttendanceRecord | undefined {
  const todayStr = getPKTDateString();
  return getAttendanceRecords().find(r => r.employeeId === empId && r.date === todayStr);
}
export function getActiveRecord(empId: string): AttendanceRecord | undefined {
  // Employee ke saare records nikalein aur latest ko upar layein
  const records = getAttendanceRecords()
    .filter(r => r.employeeId === empId)
    .sort((a, b) => new Date(b.checkIn || 0).getTime() - new Date(a.checkIn || 0).getTime());
  
  // Agar sab se latest record mein checkOut nahi hai, toh wo abhi bhi active hai
  if (records.length > 0 && !records[0].checkOut) {
    return records[0];
  }
  return undefined;
}
export async function addAttendanceRecord(record: AttendanceRecord) {
  const records = getAttendanceRecords();
  if (records.find(r => r.employeeId === record.employeeId && r.date === record.date)) return;
  records.push(record); cacheSet('c_rec', records);

  const numericUserId = parseInt(record.employeeId.replace(/^\D+/g, ''), 10) || 1;
  const employees = getEmployees();
  const currentEmp = employees.find(e => e.id === record.employeeId);

  try {
    const q = db.from('attendance_logs');
    if (q) await q.upsert({
      user_id: numericUserId,
      user_name: currentEmp ? currentEmp.name : 'Unknown',
      date: record.date,
      status: record.status,
      login_time: record.checkIn,
      logout_time: record.checkOut,
      total_hours: record.totalHours,
      overtime_hours: record.overtime_hours || 0, // 🌟 Yeh add karein
      wifi_connected: record.wifiVerified ? 'true' : 'false',
      notes: record.notes || getLocationFromIP(record.ipAddress),
    });
    await syncRecords();
  } catch {}
}

// ✅ FIXED: Override save with proper id/date handling
export async function updateAttendanceRecord(id: string, updates: Partial<AttendanceRecord>) {
  const records = getAttendanceRecords();
  const idx = records.findIndex(r => String(r.id) === String(id));

  if (idx === -1) {
    console.error('updateAttendanceRecord: record not found', id);
    return false;
  }

  const oldRecord = { ...records[idx] };
  const updatedRecord: AttendanceRecord = { ...oldRecord, ...updates };

  // local cache update
  records[idx] = updatedRecord;
  cacheSet('c_rec', records);

  const numericUserId =
    parseInt(updatedRecord.employeeId.replace(/^\D+/g, ''), 10) || 1;

  try {
    const q = db.from('attendance_logs');
    if (!q) throw new Error('Supabase table not available');

    const payload: any = {};

    if (updates.status !== undefined) payload.status = updatedRecord.status;
    if (updates.checkIn !== undefined) payload.login_time = updatedRecord.checkIn;
    if (updates.checkOut !== undefined) payload.logout_time = updatedRecord.checkOut;
    if (updates.totalHours !== undefined) payload.total_hours = updatedRecord.totalHours;
    if (updates.overtime_hours !== undefined) payload.overtime_hours = updatedRecord.overtime_hours; // 🌟 Yeh add karein
    if (updates.date !== undefined) payload.date = updatedRecord.date;
    if (updates.wifiVerified !== undefined) {
      payload.wifi_connected = updatedRecord.wifiVerified ? 'true' : 'false';
    }

    if (updates.notes !== undefined) {
      payload.notes = updates.notes;
    } else if (updates.ipAddress !== undefined) {
      payload.notes = getLocationFromIP(updates.ipAddress);
    }

    let result: any = null;

    // 1) Pehle exact DB row ko id se update karne ki koshish
    if (/^\d+$/.test(String(oldRecord.id))) {
      result = await q
        .update(payload)
        .eq('id', Number(oldRecord.id))
        .select('*');
    } else {
      // 2) Fallback: old date use karo, new date nahi
      result = await q
        .update(payload)
        .eq('user_id', numericUserId)
        .eq('date', oldRecord.date)
        .select('*');
    }

    if (result?.error) {
      throw result.error;
    }

    // Agar koi row update na hui to upsert kar do
    if (!result?.data || result.data.length === 0) {
      const employees = getEmployees();
      const currentEmp = employees.find(e => e.id === updatedRecord.employeeId);

      const upsertResult = await q.upsert({
        user_id: numericUserId,
        user_name: currentEmp?.name || 'Unknown',
        date: updatedRecord.date,
        status: updatedRecord.status,
        login_time: updatedRecord.checkIn,
        logout_time: updatedRecord.checkOut,
        total_hours: updatedRecord.totalHours,
        overtime_hours: updatedRecord.overtime_hours || 0, // 🌟 Yeh line add karni hai
        wifi_connected: updatedRecord.wifiVerified ? 'true' : 'false',
        notes: payload.notes || getLocationFromIP(updatedRecord.ipAddress),
      });

      if (upsertResult?.error) throw upsertResult.error;
    }

    await syncRecords();
    return true;
  } catch (error) {
    console.error('updateAttendanceRecord failed:', error);

    // rollback
    records[idx] = oldRecord;
    cacheSet('c_rec', records);

    return false;
  }
}

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
  const todayStr = getPKTDateString();
  return getWFHRequests().find(r => r.employeeId === empId && r.date === todayStr);
}
export function getPendingWFHRequests(): WFHRequest[] { return getWFHRequests().filter(r => r.status === 'pending'); }

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

export function getSettings() {
  return cacheGet('c_settings', { officeStartTime: '09:00', lateThresholdMinutes: 15, minHoursForFullDay: 8, minHoursForHalfDay: 4 });
}
export function saveSettings(s: any) { cacheSet('c_settings', s); }

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
    const rows = Object.values(t).map(v => ({
      employee_id: v.employeeId,
      office_start_time: v.officeStartTime,
      late_threshold_minutes: v.lateThresholdMinutes,
      min_hours_full_day: v.minHoursForFullDay,
      min_hours_half_day: v.minHoursForHalfDay
    }));
    await q.upsert(rows);
  } catch {}
}

export function getEmployeeTiming(empId: string): EmployeeTiming {
  const all = getAllEmployeeTimings(); if (all[empId]) return all[empId];
  const g = getSettings();
  return { employeeId: empId, officeStartTime: g.officeStartTime, lateThresholdMinutes: g.lateThresholdMinutes, minHoursForFullDay: g.minHoursForFullDay, minHoursForHalfDay: g.minHoursForHalfDay };
}

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
// 🌟 Holidays Logic
export interface Holiday { date: string; name: string; }
export function getHolidays(): Holiday[] { return cacheGet('c_holidays', []); }
export function isHoliday(dateStr: string): boolean { return getHolidays().some(h => h.date === dateStr); }

export async function addHoliday(date: string, name: string) {
  try {
    const q = db.from('holidays');
    if (q) {
      await q.upsert({ date, name });
      await syncHolidays();
    }
  } catch {}
}

export async function removeHoliday(date: string) {
  try {
    const q = db.from('holidays');
    if (q) {
      await q.delete().eq('date', date);
      await syncHolidays();
    }
  } catch {}
}

async function syncHolidays() {
  try {
    const q = db.from('holidays'); if (!q) return;
    const { data } = await q.select('date, name');
    if (data) cacheSet('c_holidays', data);
  } catch {}
}
export async function syncAll() {
  try {
    await Promise.all([syncEmployees(), syncRecords(), syncWFH(), syncAccountRequests(), syncTimings(), syncAccess(), syncLocations(), syncHolidays()]); // 🌟 syncHolidays add karein
  } catch {}
}

export async function initializeApp() {
  try {
    await syncAll();
  } catch (e) {
    console.warn('Sync failed, using local cache:', e);
  }
}
