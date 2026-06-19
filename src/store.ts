// src/store.ts — COMPLETE FILE (Part 1 of 1)

import { createClient } from '@supabase/supabase-js';
import {
  Employee, AttendanceRecord, AttendanceStatus,
  WFHRequest, AccountRequest,
  LeaveRequest, LeaveBalance, LeavePolicy,
  SalaryConfig, MonthlySalaryReport,
  AuditLog, AuditAction,
  AdminAlert, AlertType, AlertSeverity,
  CorrectionRequest,
  ManagerNote,
  DeviceLog,
  AppNotification,
  EmployeeTarget,
} from './types';

// =============================================
// SUPABASE CLIENT
// =============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || 'https://gefkpawkljalbevkxytn.supabase.co';

const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZmtwYXdrbGphbGJldmt4eXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjQ5ODgsImV4cCI6MjA5Njk0MDk4OH0.2MC8c4HpKYbBfO_0FCE53_nnwkN7nhqjYIAbvKGHSZE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function table(name: string) {
  try { return supabase.from(name); } catch { return null; }
}

// =============================================
// PKT TIME HELPERS
// =============================================

export function getPKTDate(): Date {
  const now = new Date();
  const pktOffset = 5 * 60;
  const localOffset = now.getTimezoneOffset();
  return new Date(now.getTime() + (pktOffset + localOffset) * 60 * 1000);
}

export function getPKTDateString(): string {
  const pkt = getPKTDate();
  return [
    pkt.getFullYear(),
    String(pkt.getMonth() + 1).padStart(2, '0'),
    String(pkt.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getPKTISOString(): string {
  const pkt = getPKTDate();
  const date = [
    pkt.getFullYear(),
    String(pkt.getMonth() + 1).padStart(2, '0'),
    String(pkt.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [
    String(pkt.getHours()).padStart(2, '0'),
    String(pkt.getMinutes()).padStart(2, '0'),
    String(pkt.getSeconds()).padStart(2, '0'),
  ].join(':');
  return `${date}T${time}+05:00`;
}

// =============================================
// LOCAL CACHE HELPERS
// =============================================

function cacheSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

function cacheGet<T>(key: string, fallback: T): T {
  try {
    const d = localStorage.getItem(key);
    return d ? (JSON.parse(d) as T) : fallback;
  } catch { return fallback; }
}

// =============================================
// OFFICE LOCATIONS
// =============================================

export interface OfficeLocation {
  id: number;
  name: string;
  ip_address: string;
  is_active: boolean;
}

const DEFAULT_LOCATIONS: OfficeLocation[] = [
  { id: 1, name: 'PK Zone',   ip_address: '103.93.12.229',   is_active: true },
  { id: 2, name: 'QC Center', ip_address: '202.141.254.126', is_active: true },
  { id: 3, name: 'QC Center', ip_address: '157.10.30.235',   is_active: true },
];

export function getOfficeLocations(): OfficeLocation[] {
  return cacheGet('c_locations', DEFAULT_LOCATIONS);
}

export function getLocationFromIP(ip: string): string {
  if (!ip || ip === 'WFH') return 'WFH';
  const found = getOfficeLocations().find(l => l.ip_address === ip);
  return found ? found.name : 'Office';
}

function resolveIPFromNotes(notes: string | null): string {
  if (!notes) return DEFAULT_LOCATIONS[0].ip_address;
  const locs = getOfficeLocations();
  const found = locs.find(l => notes.includes(l.name));
  return found ? found.ip_address : DEFAULT_LOCATIONS[0].ip_address;
}

async function syncLocations(): Promise<void> {
  try {
    const q = table('office_locations');
    if (!q) return;
    const { data } = await q.select('*').eq('is_active', true);
    if (data && data.length > 0) cacheSet('c_locations', data);
  } catch {}
}

// =============================================
// EMPLOYEES
// =============================================

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 'emp-001', name: 'Abdul Wahab',      role: 'admin',    pin: '2687', avatar: 'AW' },
  { id: 'emp-002', name: 'Hamza Saeed',       role: 'employee', pin: '2345', avatar: 'HS' },
  { id: 'emp-003', name: 'Ishtiaq ur Rehman', role: 'employee', pin: '3456', avatar: 'IR' },
  { id: 'emp-004', name: 'Behzad Riaz',       role: 'employee', pin: '4567', avatar: 'BR' },
  { id: 'emp-005', name: 'Albash Akhtar',     role: 'manager',  pin: '8822', avatar: 'AA' },
  { id: 'emp-006', name: 'Sohail',            role: 'employee', pin: '1122', avatar: 'SH' },
];

export function getEmployees(): Employee[] {
  return cacheGet('c_emp', DEFAULT_EMPLOYEES);
}

export function getAttendanceEmployees(): Employee[] {
  return getEmployees().filter(e => e.role !== 'manager');
}

export function saveEmployees(emps: Employee[]): void {
  cacheSet('c_emp', emps);
}

async function syncEmployees(): Promise<void> {
  try {
    const q = table('employees');
    if (!q) return;
    const { data } = await q.select('*');
    if (data && data.length > 0) cacheSet('c_emp', data);
  } catch {}
}

export async function addEmployee(emp: Employee): Promise<void> {
  const all = getEmployees();
  all.push(emp);
  cacheSet('c_emp', all);

  // 🆕 Audit log
  await addAuditLog('employee_add', emp.id, `Added employee: ${emp.name}`, null, emp.name);

  try {
    const q = table('employees');
    if (q) {
      await q.upsert({ id: emp.id, name: emp.name, role: emp.role, pin: emp.pin, avatar: emp.avatar });
      await syncEmployees();
    }
  } catch {}
}

export async function updateEmployeePin(empId: string, newPin: string): Promise<void> {
  const all = getEmployees();
  const idx = all.findIndex(e => e.id === empId);
  const oldPin = idx !== -1 ? all[idx].pin : '';
  if (idx !== -1) { all[idx].pin = newPin; cacheSet('c_emp', all); }

  // 🆕 Audit log
  await addAuditLog('pin_change', empId, `PIN changed for ${all[idx]?.name || empId}`,
    JSON.stringify({ oldPin: '****' }), JSON.stringify({ newPin: '****' }), 'warning');

  try {
    const q = table('employees');
    if (q) {
      await q.update({ pin: newPin }).eq('id', empId);
      await syncEmployees();
    }
  } catch {}
}

export async function removeEmployee(empId: string): Promise<void> {
  const emp = getEmployees().find(e => e.id === empId);
  cacheSet('c_emp', getEmployees().filter(e => e.id !== empId));

  // 🆕 Audit log
  await addAuditLog('employee_remove', empId, `Removed employee: ${emp?.name || empId}`,
    null, null, 'critical');

  try {
    const q = table('employees');
    if (q) {
      await q.delete().eq('id', empId);
      await syncEmployees();
    }
  } catch {}
}

export async function bindEmployeeDevice(empId: string, deviceId: string | null): Promise<void> {
  const all = getEmployees();
  const idx = all.findIndex(e => e.id === empId);
  const empName = idx !== -1 ? all[idx].name : empId;

  if (idx !== -1) {
    (all[idx] as any).device_id = deviceId;
    cacheSet('c_emp', all);
  }

  // 🆕 Audit log
  const action = deviceId ? 'device_bind' : 'device_reset';
  await addAuditLog(action, empId,
    deviceId ? `Device bound for ${empName}` : `Device reset for ${empName}`,
    null, deviceId ? JSON.stringify({ device_id: deviceId }) : null,
    'warning');

  // 🆕 Device log
  await addDeviceLog(empId, deviceId || 'reset', deviceId ? 'bind' : 'reset', true);

  try {
    const q = table('employees');
    if (q) {
      await q.update({ device_id: deviceId }).eq('id', empId);
      await syncEmployees();
    }
  } catch (e) {
    console.error('bindEmployeeDevice failed:', e);
  }
}

// =============================================
// ATTENDANCE RECORDS
// =============================================

export function getAttendanceRecords(): AttendanceRecord[] {
  return cacheGet('c_rec', []);
}

export function saveAttendanceRecords(records: AttendanceRecord[]): void {
  cacheSet('c_rec', records);
}

async function syncRecords(): Promise<void> {
  try {
    const q = table('attendance_logs');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      cacheSet('c_rec', data.map((r: any) => ({
        id:                String(r.id),
        employeeId:        r.user_id ? `emp-${String(r.user_id).padStart(3, '0')}` : 'emp-001',
        date:              r.date,
        checkIn:           r.login_time ?? null,
        checkOut:          (r.logout_time && r.logout_time !== r.login_time) ? r.logout_time : null,
        status:            r.status || 'present',
        totalHours:        r.total_hours || 0,
        overtime_hours:    r.overtime_hours || 0,
        wifiVerified:      r.wifi_connected === 'true' || r.wifi_connected === true,
        ipAddress:         resolveIPFromNotes(r.notes),
        notes:             r.notes || '',
        verification_method: r.verification_method || null,
      })));
    }
  } catch {}
}

export function getTodayRecord(empId: string): AttendanceRecord | undefined {
  const today = getPKTDateString();
  return getAttendanceRecords().find(r => r.employeeId === empId && r.date === today);
}

export function getActiveRecord(empId: string): AttendanceRecord | undefined {
  const records = getAttendanceRecords()
    .filter(r => r.employeeId === empId && r.checkIn)
    .sort((a, b) => new Date(b.checkIn!).getTime() - new Date(a.checkIn!).getTime());
  return records.length > 0 && !records[0].checkOut ? records[0] : undefined;
}

export async function addAttendanceRecord(record: AttendanceRecord): Promise<void> {
  const records = getAttendanceRecords();
  const exists = records.find(
    r => r.id === record.id || (r.employeeId === record.employeeId && r.date === record.date)
  );
  if (exists) return;
  records.push(record);
  cacheSet('c_rec', records);

  // 🆕 Audit log
  await addAuditLog('check_in', record.employeeId,
    `Checked in at ${getLocationFromIP(record.ipAddress)}`,
    null, JSON.stringify({ time: record.checkIn, location: getLocationFromIP(record.ipAddress) }));

  const numericUserId = parseInt(record.employeeId.replace(/^\D+/g, ''), 10) || 1;
  const emp = getEmployees().find(e => e.id === record.employeeId);

  try {
    const q = table('attendance_logs');
    if (q) {
      await q.upsert({
        user_id:            numericUserId,
        user_name:          emp?.name ?? 'Unknown',
        date:               record.date,
        status:             record.status,
        login_time:         record.checkIn,
        logout_time:        record.checkOut,
        total_hours:        record.totalHours,
        overtime_hours:     record.overtime_hours || 0,
        wifi_connected:     record.wifiVerified ? 'true' : 'false',
        notes:              record.notes || getLocationFromIP(record.ipAddress),
        verification_method: record.verification_method || 'gps',
      });
      await syncRecords();
    }
  } catch {}
}

export async function updateAttendanceRecord(
  id: string,
  updates: Partial<AttendanceRecord>
): Promise<boolean> {
  const records = getAttendanceRecords();
  const idx = records.findIndex(r => String(r.id) === String(id));

  if (idx === -1) {
    console.error('updateAttendanceRecord: not found —', id);
    return false;
  }

  const oldRecord = { ...records[idx] };
  const updated: AttendanceRecord = { ...oldRecord, ...updates };
  records[idx] = updated;
  cacheSet('c_rec', records);

  // 🆕 Audit log for checkout
  if (updates.checkOut) {
    await addAuditLog('check_out', updated.employeeId,
      `Checked out — ${updated.totalHours?.toFixed(1)}h${updated.wifiVerified === false ? ' [OUTSIDE OFFICE]' : ''}`,
      null, JSON.stringify({ time: updates.checkOut, hours: updated.totalHours }),
      updated.wifiVerified === false ? 'warning' : 'info');
  }

  const numericUserId = parseInt(updated.employeeId.replace(/^\D+/g, ''), 10) || 1;

  try {
    const q = table('attendance_logs');
    if (!q) throw new Error('Supabase unavailable');

    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined)         payload.status          = updated.status;
    if (updates.checkIn !== undefined)        payload.login_time      = updated.checkIn;
    if (updates.checkOut !== undefined)       payload.logout_time     = updated.checkOut;
    if (updates.totalHours !== undefined)     payload.total_hours     = updated.totalHours;
    if (updates.overtime_hours !== undefined) payload.overtime_hours  = updated.overtime_hours;
    if (updates.date !== undefined)           payload.date            = updated.date;
    if (updates.wifiVerified !== undefined)   payload.wifi_connected  = updated.wifiVerified ? 'true' : 'false';
    if (updates.notes !== undefined)          payload.notes           = updates.notes;
    else if (updates.ipAddress !== undefined) payload.notes           = getLocationFromIP(updates.ipAddress);

    let result: any;
    if (/^\d+$/.test(String(oldRecord.id))) {
      result = await q.update(payload).eq('id', Number(oldRecord.id)).select('*');
    } else {
      result = await q.update(payload).eq('user_id', numericUserId).eq('date', oldRecord.date).select('*');
    }

    if (result?.error) throw result.error;

    if (!result?.data || result.data.length === 0) {
      const emp = getEmployees().find(e => e.id === updated.employeeId);
      const upsertResult = await q.upsert({
        user_id:        numericUserId,
        user_name:      emp?.name ?? 'Unknown',
        date:           updated.date,
        status:         updated.status,
        login_time:     updated.checkIn,
        logout_time:    updated.checkOut,
        total_hours:    updated.totalHours,
        overtime_hours: updated.overtime_hours || 0,
        wifi_connected: updated.wifiVerified ? 'true' : 'false',
        notes:          (payload.notes as string) || getLocationFromIP(updated.ipAddress),
      });
      if (upsertResult?.error) throw upsertResult.error;
    }

    await syncRecords();
    return true;
  } catch (error) {
    console.error('updateAttendanceRecord failed:', error);
    records[idx] = oldRecord;
    cacheSet('c_rec', records);
    return false;
  }
}

// =============================================
// WFH REQUESTS
// =============================================

export function getWFHRequests(): WFHRequest[] { return cacheGet('c_wfh', []); }

export function getTodayWFHRequest(empId: string): WFHRequest | undefined {
  const today = getPKTDateString();
  return getWFHRequests().find(r => r.employeeId === empId && r.date === today);
}

export function getPendingWFHRequests(): WFHRequest[] {
  return getWFHRequests().filter(r => r.status === 'pending');
}

async function syncWFH(): Promise<void> {
  try {
    const q = table('wfh_requests');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) cacheSet('c_wfh', data.map((r: any) => ({
      id: r.id, employeeId: r.employee_id, date: r.date, reason: r.reason,
      status: r.status, requestedAt: r.requested_at,
      reviewedBy: r.reviewed_by ?? null, reviewedAt: r.reviewed_at ?? null,
    })));
  } catch {}
}

export async function addWFHRequest(r: WFHRequest): Promise<void> {
  const all = getWFHRequests(); all.push(r); cacheSet('c_wfh', all);
  try {
    const q = table('wfh_requests');
    if (q) await q.upsert({
      id: r.id, employee_id: r.employeeId, date: r.date, reason: r.reason,
      status: r.status, requested_at: r.requestedAt,
      reviewed_by: r.reviewedBy, reviewed_at: r.reviewedAt,
    });
  } catch {}
}

export async function updateWFHRequest(id: string, updates: Partial<WFHRequest>): Promise<void> {
  const all = getWFHRequests();
  const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_wfh', all); }

  // 🆕 Audit log
  if (updates.status === 'approved' || updates.status === 'rejected') {
    const emp = getEmployees().find(e => e.id === all[i]?.employeeId);
    await addAuditLog(
      updates.status === 'approved' ? 'wfh_approve' : 'wfh_reject',
      all[i]?.employeeId || '', `WFH ${updates.status} for ${emp?.name || 'Unknown'}`
    );
  }

  try {
    const q = table('wfh_requests');
    if (!q) return;
    const payload: Record<string, unknown> = {};
    if (updates.status)     payload.status      = updates.status;
    if (updates.reviewedBy) payload.reviewed_by = updates.reviewedBy;
    if (updates.reviewedAt) payload.reviewed_at = updates.reviewedAt;
    await q.update(payload).eq('id', id);
  } catch {}
}

// =============================================
// ACCOUNT REQUESTS
// =============================================

export function getAccountRequests(): AccountRequest[] { return cacheGet('c_acct', []); }
export function getPendingAccountRequests(): AccountRequest[] { return getAccountRequests().filter(r => r.status === 'pending'); }

async function syncAccountRequests(): Promise<void> {
  try {
    const q = table('account_requests');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) cacheSet('c_acct', data.map((r: any) => ({
      id: r.id, name: r.name, pin: r.pin, requestedAt: r.requested_at,
      status: r.status, approvedRole: r.approved_role ?? null, reviewedBy: r.reviewed_by ?? null,
    })));
  } catch {}
}

export async function addAccountRequest(r: AccountRequest): Promise<void> {
  const all = getAccountRequests(); all.push(r); cacheSet('c_acct', all);
  try {
    const q = table('account_requests');
    if (q) await q.upsert({ id: r.id, name: r.name, pin: r.pin, requested_at: r.requestedAt, status: r.status });
  } catch {}
}

export async function updateAccountRequest(id: string, updates: Partial<AccountRequest>): Promise<void> {
  const all = getAccountRequests();
  const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_acct', all); }

  // 🆕 Audit log
  if (updates.status) {
    await addAuditLog(
      updates.status === 'approved' ? 'account_approve' : 'account_reject',
      '', `Account ${updates.status}: ${all[i]?.name || 'Unknown'} as ${updates.approvedRole || 'N/A'}`
    );
  }

  try {
    const q = table('account_requests');
    if (!q) return;
    const payload: Record<string, unknown> = {};
    if (updates.status) payload.status = updates.status;
    if (updates.approvedRole) payload.approved_role = updates.approvedRole;
    if (updates.reviewedBy) payload.reviewed_by = updates.reviewedBy;
    await q.update(payload).eq('id', id);
  } catch {}
}

// =============================================
// SETTINGS & TIMINGS
// =============================================

export function getSettings() {
  return cacheGet('c_settings', {
    officeStartTime: '09:00', lateThresholdMinutes: 15,
    minHoursForFullDay: 8, minHoursForHalfDay: 4,
  });
}

export function saveSettings(s: unknown): void { cacheSet('c_settings', s); }

export interface EmployeeTiming {
  employeeId: string;
  officeStartTime: string;
  lateThresholdMinutes: number;
  minHoursForFullDay: number;
  minHoursForHalfDay: number;
}

export function getAllEmployeeTimings(): Record<string, EmployeeTiming> { return cacheGet('c_timings', {}); }

async function syncTimings(): Promise<void> {
  try {
    const q = table('employee_timings');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      const map: Record<string, EmployeeTiming> = {};
      data.forEach((r: any) => {
        map[r.employee_id] = {
          employeeId: r.employee_id, officeStartTime: r.office_start_time,
          lateThresholdMinutes: r.late_threshold_minutes,
          minHoursForFullDay: r.min_hours_full_day, minHoursForHalfDay: r.min_hours_half_day,
        };
      });
      cacheSet('c_timings', map);
    }
  } catch {}
}

export async function saveAllEmployeeTimings(t: Record<string, EmployeeTiming>): Promise<void> {
  cacheSet('c_timings', t);

  // 🆕 Audit
  await addAuditLog('timing_change', '', 'Employee timings updated');

  try {
    const q = table('employee_timings');
    if (!q) return;
    const rows = Object.values(t).map(v => ({
      employee_id: v.employeeId, office_start_time: v.officeStartTime,
      late_threshold_minutes: v.lateThresholdMinutes,
      min_hours_full_day: v.minHoursForFullDay, min_hours_half_day: v.minHoursForHalfDay,
    }));
    await q.upsert(rows);
  } catch {}
}

export function getEmployeeTiming(empId: string): EmployeeTiming {
  const all = getAllEmployeeTimings();
  if (all[empId]) return all[empId];
  const g = getSettings();
  return {
    employeeId: empId, officeStartTime: g.officeStartTime,
    lateThresholdMinutes: g.lateThresholdMinutes,
    minHoursForFullDay: g.minHoursForFullDay, minHoursForHalfDay: g.minHoursForHalfDay,
  };
}

// =============================================
// ACCESS CONTROL
// =============================================

const DEFAULT_ACCESS: Record<string, string[]> = {
  ot: ['emp-001', 'emp-005'], ai: ['emp-001', 'emp-005'],
  analytics: ['emp-001', 'emp-005'], settings: ['emp-001', 'emp-005'],
  pin_change: ['emp-001', 'emp-005'], add_employee: ['emp-001', 'emp-005'],
  remove_employee: ['emp-001', 'emp-005'], timings: ['emp-001'],
  wfh_approve: ['emp-001', 'emp-005'], secret_override: ['emp-001'],
  view_all: ['emp-001', 'emp-005'],
  leave_manage: ['emp-001', 'emp-005'],       // 🆕
  salary_view: ['emp-001'],                    // 🆕
  audit_view: ['emp-001'],                     // 🆕
  alerts_view: ['emp-001', 'emp-005'],         // 🆕
  device_manage: ['emp-001', 'emp-005'],       // 🆕
  corrections_manage: ['emp-001', 'emp-005'],  // 🆕
  notes_manage: ['emp-001', 'emp-005'],        // 🆕
};

export function getAccessControl(): Record<string, string[]> {
  const cached = cacheGet<Record<string, string[]>>('c_access', {});

  // Saare features ensure karo — missing ones DEFAULT se lo
  const ALL_FEATURES = [
    'ot', 'ai', 'analytics', 'settings', 'pin_change',
    'add_employee', 'remove_employee', 'timings', 'wfh_approve',
    'secret_override', 'view_all', 'leave_manage', 'salary_view',
    'audit_view', 'alerts_view', 'device_manage',
    'corrections_manage', 'notes_manage',
  ];

  const merged: Record<string, string[]> = { ...cached };

  ALL_FEATURES.forEach(feat => {
    if (!merged[feat]) {
      // Cache mein nahi hai toh DEFAULT se lo
      merged[feat] = DEFAULT_ACCESS[feat] || [];
    }
  });

  return merged;
}
export function saveAccessControl(ac: Record<string, string[]>): void { cacheSet('c_access', ac); }

async function syncAccess(): Promise<void> {
  try {
    const q = table('access_control');
    if (!q) return;
    const { data } = await q.select('*');

    // Pehle DEFAULT se start karo taake saare features hon
    const map: Record<string, string[]> = {};

    // Saare features pehle empty array ke sath set karo
    const ALL_FEATURES = [
      'ot', 'ai', 'analytics', 'settings', 'pin_change',
      'add_employee', 'remove_employee', 'timings', 'wfh_approve',
      'secret_override', 'view_all', 'leave_manage', 'salary_view',
      'audit_view', 'alerts_view', 'device_manage',
      'corrections_manage', 'notes_manage',
    ];

    ALL_FEATURES.forEach(feat => { map[feat] = []; });

    // Ab Supabase ka data merge karo
    if (data && data.length > 0) {
      data.forEach((r: any) => {
        if (!map[r.feature]) map[r.feature] = [];
        if (!map[r.feature].includes(r.employee_id)) {
          map[r.feature].push(r.employee_id);
        }
      });
    }

    cacheSet('c_access', map);
  } catch {}
}

export async function grantAccess(empId: string, feature: string): Promise<void> {
  const ac = getAccessControl();
  if (!ac[feature]) ac[feature] = [];
  if (!ac[feature].includes(empId)) ac[feature].push(empId);
  cacheSet('c_access', ac);

  await addAuditLog('access_grant', empId, `Access granted: ${feature}`, null, null, 'warning');

  try { const q = table('access_control'); if (q) await q.upsert({ feature, employee_id: empId }); } catch {}
}

export async function revokeAccess(empId: string, feature: string): Promise<void> {
  const ac = getAccessControl();
  if (ac[feature]) ac[feature] = ac[feature].filter(id => id !== empId);
  cacheSet('c_access', ac);

  await addAuditLog('access_revoke', empId, `Access revoked: ${feature}`, null, null, 'warning');

  try { const q = table('access_control'); if (q) await q.delete().eq('feature', feature).eq('employee_id', empId); } catch {}
}

export function hasAccess(empId: string, feature: string): boolean {
  return getAccessControl()[feature]?.includes(empId) ?? false;
}

export function canSeeOT(empId: string): boolean { return hasAccess(empId, 'ot'); }

// =============================================
// HOLIDAYS
// =============================================

export interface Holiday { date: string; name: string; }

export function getHolidays(): Holiday[] { return cacheGet('c_holidays', []); }
export function isHoliday(dateStr: string): boolean { return getHolidays().some(h => h.date === dateStr); }

export async function addHoliday(date: string, name: string): Promise<void> {
  const all = getHolidays();
  if (!all.find(h => h.date === date)) { all.push({ date, name }); cacheSet('c_holidays', all); }

  await addAuditLog('holiday_add', '', `Holiday added: ${name} (${date})`);

  try {
    const q = table('holidays');
    if (q) { await q.upsert({ date, name }); await syncHolidays(); }
  } catch {}
}

export async function removeHoliday(date: string): Promise<void> {
  const h = getHolidays().find(h => h.date === date);
  cacheSet('c_holidays', getHolidays().filter(h => h.date !== date));

  await addAuditLog('holiday_remove', '', `Holiday removed: ${h?.name || date}`, null, null, 'warning');

  try {
    const q = table('holidays');
    if (q) { await q.delete().eq('date', date); await syncHolidays(); }
  } catch {}
}

async function syncHolidays(): Promise<void> {
  try {
    const q = table('holidays');
    if (!q) return;
    const { data } = await q.select('date, name');
    if (data) cacheSet('c_holidays', data);
  } catch {}
}

// =============================================
// 🆕 AUDIT LOG SYSTEM
// =============================================

let _currentUserId = '';
let _currentUserName = '';

export function setCurrentAuditUser(empId: string, empName: string): void {
  _currentUserId = empId;
  _currentUserName = empName;
}

export function getAuditLogs(): AuditLog[] {
  return cacheGet('c_audit', []);
}

export async function addAuditLog(
  action: AuditAction,
  targetEmployeeId: string,
  description: string,
  oldValue?: string | null,
  newValue?: string | null,
  severity: 'info' | 'warning' | 'critical' = 'info'
): Promise<void> {
  const log: AuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    performedBy: _currentUserId,
    performedByName: _currentUserName,
    targetEmployeeId: targetEmployeeId || null,
    targetEmployeeName: targetEmployeeId
      ? (getEmployees().find(e => e.id === targetEmployeeId)?.name || null)
      : null,
    description,
    oldValue: oldValue || null,
    newValue: newValue || null,
    ipAddress: null,
    deviceInfo: navigator.userAgent?.slice(0, 100) || null,
    timestamp: getPKTISOString(),
    severity,
  };

  const all = getAuditLogs();
  all.push(log);
  // Keep last 500 only locally
  if (all.length > 500) all.splice(0, all.length - 500);
  cacheSet('c_audit', all);

  try {
    const q = table('audit_logs');
    if (q) {
      await q.insert({
        action:               log.action,
        performed_by:         log.performedBy,
        performed_by_name:    log.performedByName,
        target_employee_id:   log.targetEmployeeId,
        target_employee_name: log.targetEmployeeName,
        description:          log.description,
        old_value:            log.oldValue,
        new_value:            log.newValue,
        ip_address:           log.ipAddress,
        device_info:          log.deviceInfo,
        severity:             log.severity,
        timestamp:            log.timestamp,
      });
    }
  } catch {}
}

async function syncAuditLogs(): Promise<void> {
  try {
    const q = table('audit_logs');
    if (!q) return;
    const { data } = await q.select('*').order('timestamp', { ascending: false }).limit(200);
    if (data) {
      cacheSet('c_audit', data.map((r: any) => ({
        id:                  r.id?.toString() || `audit-${Date.now()}`,
        action:              r.action,
        performedBy:         r.performed_by,
        performedByName:     r.performed_by_name,
        targetEmployeeId:    r.target_employee_id,
        targetEmployeeName:  r.target_employee_name,
        description:         r.description,
        oldValue:            r.old_value,
        newValue:            r.new_value,
        ipAddress:           r.ip_address,
        deviceInfo:          r.device_info,
        timestamp:           r.timestamp,
        severity:            r.severity || 'info',
      })));
    }
  } catch {}
}

// =============================================
// 🆕 ADMIN ALERTS SYSTEM
// =============================================

export function getAdminAlerts(): AdminAlert[] {
  return cacheGet('c_alerts', []);
}

export function getUnreadAlerts(): AdminAlert[] {
  return getAdminAlerts().filter(a => !a.isRead && !a.isDismissed);
}

export async function createAlert(
  type: AlertType,
  severity: AlertSeverity,
  employeeId: string,
  title: string,
  message: string,
): Promise<void> {
  const empName = getEmployees().find(e => e.id === employeeId)?.name || 'Unknown';

  const alert: AdminAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type, severity,
    employeeId, employeeName: empName,
    title, message,
    isRead: false, isDismissed: false,
    actionTaken: null,
    createdAt: getPKTISOString(),
    readAt: null,
  };

  const all = getAdminAlerts();
  all.unshift(alert);
  if (all.length > 200) all.splice(200);
  cacheSet('c_alerts', all);

  try {
    const q = table('admin_alerts');
    if (q) {
      await q.insert({
        type: alert.type, severity: alert.severity,
        employee_id: alert.employeeId, employee_name: alert.employeeName,
        title: alert.title, message: alert.message,
        is_read: false, is_dismissed: false,
        created_at: alert.createdAt,
      });
    }
  } catch {}
}

export async function markAlertRead(alertId: string): Promise<void> {
  const all = getAdminAlerts();
  const idx = all.findIndex(a => a.id === alertId);
  if (idx !== -1) { all[idx].isRead = true; all[idx].readAt = getPKTISOString(); cacheSet('c_alerts', all); }
  try {
    const q = table('admin_alerts');
    if (q) await q.update({ is_read: true, read_at: getPKTISOString() }).eq('id', alertId);
  } catch {}
}

export async function dismissAlert(alertId: string): Promise<void> {
  const all = getAdminAlerts();
  const idx = all.findIndex(a => a.id === alertId);
  if (idx !== -1) { all[idx].isDismissed = true; cacheSet('c_alerts', all); }
  try {
    const q = table('admin_alerts');
    if (q) await q.update({ is_dismissed: true }).eq('id', alertId);
  } catch {}
}

async function syncAlerts(): Promise<void> {
  try {
    const q = table('admin_alerts');
    if (!q) return;
    const { data } = await q.select('*').order('created_at', { ascending: false }).limit(100);
    if (data) {
      cacheSet('c_alerts', data.map((r: any) => ({
        id:           r.id?.toString() || `alert-${Date.now()}`,
        type:         r.type,
        severity:     r.severity,
        employeeId:   r.employee_id,
        employeeName: r.employee_name,
        title:        r.title,
        message:      r.message,
        isRead:       r.is_read || false,
        isDismissed:  r.is_dismissed || false,
        actionTaken:  r.action_taken,
        createdAt:    r.created_at,
        readAt:       r.read_at,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 LEAVE MANAGEMENT
// =============================================

export function getLeaveRequests(): LeaveRequest[] { return cacheGet('c_leaves', []); }

export function getPendingLeaves(): LeaveRequest[] {
  return getLeaveRequests().filter(r => r.status === 'pending');
}

export function getEmployeeLeaves(empId: string): LeaveRequest[] {
  return getLeaveRequests().filter(r => r.employeeId === empId);
}

export function getLeaveBalance(empId: string, year?: number): LeaveBalance {
  const y = year || getPKTDate().getFullYear();
  const balances = cacheGet<LeaveBalance[]>('c_leave_balances', []);
  const existing = balances.find(b => b.employeeId === empId && b.year === y);
  return existing || {
    employeeId: empId, year: y,
    casual: 10, sick: 8, annual: 15, emergency: 3, unpaid: 999,
    casualUsed: 0, sickUsed: 0, annualUsed: 0, emergencyUsed: 0, unpaidUsed: 0,
  };
}

export function getLeavePolicy(): LeavePolicy {
  return cacheGet('c_leave_policy', {
    casualPerYear: 10, sickPerYear: 8, annualPerYear: 15,
    emergencyPerYear: 3, maxConsecutiveDays: 10,
    minAdvanceDays: 1, allowHalfDayLeave: false,
  });
}

export function saveLeavePolicy(policy: LeavePolicy): void {
  cacheSet('c_leave_policy', policy);
}

export async function addLeaveRequest(leave: LeaveRequest): Promise<void> {
  const all = getLeaveRequests();
  all.push(leave);
  cacheSet('c_leaves', all);

  // Create alert for admin
  const emp = getEmployees().find(e => e.id === leave.employeeId);
  await createAlert(
    'leave_request', 'medium', leave.employeeId,
    `Leave Request — ${emp?.name || 'Unknown'}`,
    `${leave.type} leave: ${leave.fromDate} to ${leave.toDate} (${leave.totalDays} days). Reason: ${leave.reason}`
  );

  try {
    const q = table('leave_requests');
    if (q) {
      await q.upsert({
        id: leave.id, employee_id: leave.employeeId, type: leave.type,
        from_date: leave.fromDate, to_date: leave.toDate,
        total_days: leave.totalDays, reason: leave.reason,
        attachment_url: leave.attachmentUrl, status: leave.status,
        requested_at: leave.requestedAt, reviewed_by: leave.reviewedBy,
        reviewed_at: leave.reviewedAt, reviewer_note: leave.reviewerNote,
      });
    }
  } catch {}
}

export async function updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): Promise<void> {
  const all = getLeaveRequests();
  const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_leaves', all); }

  // Update balance if approved
  if (updates.status === 'approved' && i !== -1) {
    const leave = all[i];
    await updateLeaveBalance(leave.employeeId, leave.type, leave.totalDays);

    // Mark attendance as 'on-leave'
    // This will be done in the component
  }

  // Audit log
  if (updates.status) {
    const leave = all[i];
    const emp = getEmployees().find(e => e.id === leave?.employeeId);
    await addAuditLog(
      updates.status === 'approved' ? 'leave_approve' : 'leave_reject',
      leave?.employeeId || '', `Leave ${updates.status}: ${emp?.name || ''} — ${leave?.type} (${leave?.totalDays} days)`,
      null, null, 'warning'
    );
  }

  try {
    const q = table('leave_requests');
    if (!q) return;
    const payload: Record<string, unknown> = {};
    if (updates.status)       payload.status        = updates.status;
    if (updates.reviewedBy)   payload.reviewed_by   = updates.reviewedBy;
    if (updates.reviewedAt)   payload.reviewed_at   = updates.reviewedAt;
    if (updates.reviewerNote) payload.reviewer_note = updates.reviewerNote;
    await q.update(payload).eq('id', id);
  } catch {}
}

async function updateLeaveBalance(empId: string, type: string, days: number): Promise<void> {
  const balance = getLeaveBalance(empId);
  const key = `${type}Used` as keyof LeaveBalance;
  if (typeof balance[key] === 'number') {
    (balance as any)[key] = (balance[key] as number) + days;
    const remaining = `${type}` as keyof LeaveBalance;
    if (typeof balance[remaining] === 'number') {
      (balance as any)[remaining] = Math.max(0, (balance[remaining] as number) - days);
    }
  }

  const allBalances = cacheGet<LeaveBalance[]>('c_leave_balances', []);
  const idx = allBalances.findIndex(b => b.employeeId === empId && b.year === balance.year);
  if (idx !== -1) allBalances[idx] = balance;
  else allBalances.push(balance);
  cacheSet('c_leave_balances', allBalances);

  try {
    const q = table('leave_balance');
    if (q) await q.upsert({
      employee_id: balance.employeeId, year: balance.year,
      casual: balance.casual, sick: balance.sick, annual: balance.annual,
      emergency: balance.emergency, unpaid: balance.unpaid,
      casual_used: balance.casualUsed, sick_used: balance.sickUsed,
      annual_used: balance.annualUsed, emergency_used: balance.emergencyUsed,
      unpaid_used: balance.unpaidUsed,
    });
  } catch {}
}

async function syncLeaves(): Promise<void> {
  try {
    const q = table('leave_requests');
    if (!q) return;
    const { data } = await q.select('*').order('requested_at', { ascending: false });
    if (data) {
      cacheSet('c_leaves', data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, type: r.type,
        fromDate: r.from_date, toDate: r.to_date, totalDays: r.total_days,
        reason: r.reason, attachmentUrl: r.attachment_url,
        status: r.status, requestedAt: r.requested_at,
        reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at,
        reviewerNote: r.reviewer_note,
      })));
    }
  } catch {}
}

async function syncLeaveBalances(): Promise<void> {
  try {
    const q = table('leave_balance');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      cacheSet('c_leave_balances', data.map((r: any) => ({
        employeeId: r.employee_id, year: r.year,
        casual: r.casual, sick: r.sick, annual: r.annual,
        emergency: r.emergency, unpaid: r.unpaid,
        casualUsed: r.casual_used, sickUsed: r.sick_used,
        annualUsed: r.annual_used, emergencyUsed: r.emergency_used,
        unpaidUsed: r.unpaid_used,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 ATTENDANCE CORRECTION
// =============================================

export function getCorrectionRequests(): CorrectionRequest[] { return cacheGet('c_corrections', []); }
export function getPendingCorrections(): CorrectionRequest[] { return getCorrectionRequests().filter(r => r.status === 'pending'); }

export async function addCorrectionRequest(req: CorrectionRequest): Promise<void> {
  const all = getCorrectionRequests();
  all.push(req);
  cacheSet('c_corrections', all);

  const emp = getEmployees().find(e => e.id === req.employeeId);
  await createAlert(
    'correction_request', 'medium', req.employeeId,
    `Correction Request — ${emp?.name || 'Unknown'}`,
    `Date: ${req.date} | ${req.currentStatus} → ${req.requestedStatus} | Reason: ${req.reason}`
  );

  try {
    const q = table('correction_requests');
    if (q) await q.upsert({
      id: req.id, employee_id: req.employeeId, date: req.date,
      current_status: req.currentStatus, requested_status: req.requestedStatus,
      current_check_in: req.currentCheckIn, requested_check_in: req.requestedCheckIn,
      current_check_out: req.currentCheckOut, requested_check_out: req.requestedCheckOut,
      reason: req.reason, status: req.status, requested_at: req.requestedAt,
      reviewed_by: req.reviewedBy, reviewed_at: req.reviewedAt,
      reviewer_note: req.reviewerNote,
    });
  } catch {}
}

export async function updateCorrectionRequest(id: string, updates: Partial<CorrectionRequest>): Promise<void> {
  const all = getCorrectionRequests();
  const i = all.findIndex(r => r.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; cacheSet('c_corrections', all); }

  if (updates.status) {
    const req = all[i];
    await addAuditLog(
      updates.status === 'approved' ? 'correction_approve' : 'correction_reject',
      req?.employeeId || '', `Correction ${updates.status} for ${req?.date}`,
      null, null, 'warning'
    );
  }

  try {
    const q = table('correction_requests');
    if (!q) return;
    const payload: Record<string, unknown> = {};
    if (updates.status)       payload.status        = updates.status;
    if (updates.reviewedBy)   payload.reviewed_by   = updates.reviewedBy;
    if (updates.reviewedAt)   payload.reviewed_at   = updates.reviewedAt;
    if (updates.reviewerNote) payload.reviewer_note = updates.reviewerNote;
    await q.update(payload).eq('id', id);
  } catch {}
}

async function syncCorrections(): Promise<void> {
  try {
    const q = table('correction_requests');
    if (!q) return;
    const { data } = await q.select('*').order('requested_at', { ascending: false });
    if (data) {
      cacheSet('c_corrections', data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, date: r.date,
        currentStatus: r.current_status, requestedStatus: r.requested_status,
        currentCheckIn: r.current_check_in, requestedCheckIn: r.requested_check_in,
        currentCheckOut: r.current_check_out, requestedCheckOut: r.requested_check_out,
        reason: r.reason, status: r.status, requestedAt: r.requested_at,
        reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at,
        reviewerNote: r.reviewer_note,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 MANAGER NOTES
// =============================================

export function getManagerNotes(empId?: string): ManagerNote[] {
  const all = cacheGet<ManagerNote[]>('c_notes', []);
  return empId ? all.filter(n => n.employeeId === empId) : all;
}

export async function addManagerNote(note: ManagerNote): Promise<void> {
  const all = cacheGet<ManagerNote[]>('c_notes', []);
  all.unshift(note);
  cacheSet('c_notes', all);

  try {
    const q = table('manager_notes');
    if (q) await q.insert({
      id: note.id, employee_id: note.employeeId, note: note.note,
      type: note.type, added_by: note.addedBy, added_by_name: note.addedByName,
      added_at: note.addedAt, is_private: note.isPrivate,
    });
  } catch {}
}

export async function deleteManagerNote(noteId: string): Promise<void> {
  cacheSet('c_notes', cacheGet<ManagerNote[]>('c_notes', []).filter(n => n.id !== noteId));
  try {
    const q = table('manager_notes');
    if (q) await q.delete().eq('id', noteId);
  } catch {}
}

async function syncManagerNotes(): Promise<void> {
  try {
    const q = table('manager_notes');
    if (!q) return;
    const { data } = await q.select('*').order('added_at', { ascending: false });
    if (data) {
      cacheSet('c_notes', data.map((r: any) => ({
        id: r.id, employeeId: r.employee_id, note: r.note, type: r.type,
        addedBy: r.added_by, addedByName: r.added_by_name,
        addedAt: r.added_at, isPrivate: r.is_private || false,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 DEVICE LOG
// =============================================

export function getDeviceLogs(empId?: string): DeviceLog[] {
  const all = cacheGet<DeviceLog[]>('c_device_logs', []);
  return empId ? all.filter(d => d.employeeId === empId) : all;
}

export async function addDeviceLog(
  empId: string, deviceId: string,
  action: 'bind' | 'reset' | 'login_attempt' | 'login_blocked',
  success: boolean
): Promise<void> {
  const log: DeviceLog = {
    id: `dev-${Date.now()}`,
    employeeId: empId, deviceId,
    deviceInfo: navigator.userAgent?.slice(0, 150) || 'Unknown',
    action, timestamp: getPKTISOString(), success,
  };

  const all = cacheGet<DeviceLog[]>('c_device_logs', []);
  all.unshift(log);
  if (all.length > 300) all.splice(300);
  cacheSet('c_device_logs', all);

  // Create alert for blocked attempts
  if (action === 'login_blocked') {
    await createAlert(
      'unauthorized_device', 'high', empId,
      '🚫 Unauthorized Device Login',
      `Employee tried to login from unregistered device.`
    );
  }

  try {
    const q = table('device_logs');
    if (q) await q.insert({
      employee_id: log.employeeId, device_id: log.deviceId,
      device_info: log.deviceInfo, action: log.action,
      timestamp: log.timestamp, success: log.success,
    });
  } catch {}
}

async function syncDeviceLogs(): Promise<void> {
  try {
    const q = table('device_logs');
    if (!q) return;
    const { data } = await q.select('*').order('timestamp', { ascending: false }).limit(200);
    if (data) {
      cacheSet('c_device_logs', data.map((r: any) => ({
        id: r.id?.toString() || `dev-${Date.now()}`,
        employeeId: r.employee_id, deviceId: r.device_id,
        deviceInfo: r.device_info, action: r.action,
        ipAddress: r.ip_address, timestamp: r.timestamp, success: r.success,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 SALARY CONFIG
// =============================================

export function getSalaryConfig(empId: string): SalaryConfig {
  const all = cacheGet<SalaryConfig[]>('c_salary_config', []);
  return all.find(s => s.employeeId === empId) || {
    employeeId: empId, baseSalary: 0, perDaySalary: 0,
    lateDeductionPerIncident: 0, absentDeductionPerDay: 0,
    halfDayDeduction: 0, otRatePerHour: 0,
    sundayOtRate: 0, holidayOtRate: 0,
    allowances: 0, deductions: 0,
  };
}

export function getAllSalaryConfigs(): SalaryConfig[] {
  return cacheGet('c_salary_config', []);
}

export async function saveSalaryConfig(config: SalaryConfig): Promise<void> {
  const all = cacheGet<SalaryConfig[]>('c_salary_config', []);
  const idx = all.findIndex(s => s.employeeId === config.employeeId);
  if (idx !== -1) all[idx] = config;
  else all.push(config);
  cacheSet('c_salary_config', all);

  await addAuditLog('salary_update', config.employeeId,
    `Salary config updated — Base: ${config.baseSalary}`, null, null, 'warning');

  try {
    const q = table('salary_config');
    if (q) await q.upsert({
      employee_id: config.employeeId, base_salary: config.baseSalary,
      per_day_salary: config.perDaySalary,
      late_deduction_per_incident: config.lateDeductionPerIncident,
      absent_deduction_per_day: config.absentDeductionPerDay,
      half_day_deduction: config.halfDayDeduction,
      ot_rate_per_hour: config.otRatePerHour,
      sunday_ot_rate: config.sundayOtRate,
      holiday_ot_rate: config.holidayOtRate,
      allowances: config.allowances, deductions: config.deductions,
    });
  } catch {}
}

async function syncSalaryConfigs(): Promise<void> {
  try {
    const q = table('salary_config');
    if (!q) return;
    const { data } = await q.select('*');
    if (data) {
      cacheSet('c_salary_config', data.map((r: any) => ({
        employeeId: r.employee_id, baseSalary: r.base_salary,
        perDaySalary: r.per_day_salary,
        lateDeductionPerIncident: r.late_deduction_per_incident,
        absentDeductionPerDay: r.absent_deduction_per_day,
        halfDayDeduction: r.half_day_deduction,
        otRatePerHour: r.ot_rate_per_hour,
        sundayOtRate: r.sunday_ot_rate, holidayOtRate: r.holiday_ot_rate,
        allowances: r.allowances, deductions: r.deductions,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 NOTIFICATIONS
// =============================================

export function getNotifications(empId?: string): AppNotification[] {
  const all = cacheGet<AppNotification[]>('c_notifications', []);
  return empId ? all.filter(n => n.employeeId === empId) : all;
}

export function getUnreadNotifications(empId: string): AppNotification[] {
  return getNotifications(empId).filter(n => !n.isRead);
}

export async function addNotification(notif: AppNotification): Promise<void> {
  const all = cacheGet<AppNotification[]>('c_notifications', []);
  all.unshift(notif);
  if (all.length > 300) all.splice(300);
  cacheSet('c_notifications', all);

  try {
    const q = table('notifications');
    if (q) await q.insert({
      id: notif.id, employee_id: notif.employeeId, type: notif.type,
      title: notif.title, message: notif.message,
      is_read: false, created_at: notif.createdAt,
    });
  } catch {}
}

export async function markNotificationRead(notifId: string): Promise<void> {
  const all = cacheGet<AppNotification[]>('c_notifications', []);
  const idx = all.findIndex(n => n.id === notifId);
  if (idx !== -1) { all[idx].isRead = true; all[idx].readAt = getPKTISOString(); cacheSet('c_notifications', all); }
  try {
    const q = table('notifications');
    if (q) await q.update({ is_read: true, read_at: getPKTISOString() }).eq('id', notifId);
  } catch {}
}

export async function markAllNotificationsRead(empId: string): Promise<void> {
  const all = cacheGet<AppNotification[]>('c_notifications', []);
  all.forEach(n => { if (n.employeeId === empId) { n.isRead = true; n.readAt = getPKTISOString(); }});
  cacheSet('c_notifications', all);
  try {
    const q = table('notifications');
    if (q) await q.update({ is_read: true, read_at: getPKTISOString() }).eq('employee_id', empId);
  } catch {}
}

async function syncNotifications(): Promise<void> {
  try {
    const q = table('notifications');
    if (!q) return;
    const { data } = await q.select('*').order('created_at', { ascending: false }).limit(200);
    if (data) {
      cacheSet('c_notifications', data.map((r: any) => ({
        id: r.id?.toString(), employeeId: r.employee_id, type: r.type,
        title: r.title, message: r.message,
        isRead: r.is_read || false, createdAt: r.created_at,
        readAt: r.read_at, actionUrl: r.action_url,
      })));
    }
  } catch {}
}

// =============================================
// 🆕 SMART ALERT GENERATOR
// =============================================

export async function generateSmartAlerts(): Promise<void> {
  const records = getAttendanceRecords();
  const employees = getAttendanceEmployees();
  const today = getPKTDateString();
  const existingAlerts = getAdminAlerts();

  const activeAlerts = existingAlerts.filter(a => !a.isDismissed);

  const alertExists = (type: string, empId: string): boolean => {
    return activeAlerts.some(a =>
      a.type === type &&
      a.employeeId === empId &&
      a.createdAt?.startsWith(today)
    );
  };

  for (const emp of employees) {
    const empRecs = records.filter(r => r.employeeId === emp.id);
    const last30 = empRecs.filter(r => {
      const d = new Date(r.date);
      const ago = new Date();
      ago.setDate(ago.getDate() - 30);
      return d >= ago;
    });

    // 1. Late pattern (5+ lates in 30 days)
    const lateDays = last30.filter(r => r.status === 'late');
    if (lateDays.length >= 5 && !alertExists('late_pattern', emp.id)) {
      await createAlert('late_pattern', 'high', emp.id,
        `⚠️ Late Pattern — ${emp.name}`,
        `${emp.name} ${lateDays.length} times late in last 30 days.`);
    }

    // 2. Frequent absent (3+ in 30 days)
    const absentDays = last30.filter(r => r.status === 'absent');
    if (absentDays.length >= 3 && !alertExists('frequent_absent', emp.id)) {
      await createAlert('frequent_absent', 'high', emp.id,
        `❌ Frequent Absences — ${emp.name}`,
        `${emp.name} ${absentDays.length} absences in last 30 days.`);
    }

    // 3. Consecutive absent (2+ days in a row)
    const sorted = empRecs.sort((a, b) => b.date.localeCompare(a.date));
    let consec = 0;
    for (const r of sorted) {
      if (r.status === 'absent') consec++;
      else break;
    }
    if (consec >= 2 && !alertExists('consecutive_absent', emp.id)) {
      await createAlert('consecutive_absent', 'critical', emp.id,
        `🚨 ${consec} Consecutive Absences — ${emp.name}`,
        `${emp.name} has been absent for ${consec} consecutive days.`);
    }

    // 4. No checkout yesterday
    const yesterday = new Date(getPKTDate());
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0')
    ].join('-');
    const yRec = empRecs.find(r => r.date === yesterdayStr);
    if (yRec && yRec.checkIn && !yRec.checkOut && !alertExists('no_checkout', emp.id)) {
      await createAlert('no_checkout', 'medium', emp.id,
        `⚠️ No Checkout — ${emp.name}`,
        `${emp.name} didn't check out on ${yesterdayStr}.`);
    }

    // ✅ FIX: Sirf AAJ ka outside office checkout check karo (purane nahi)
    const todayOutside = empRecs.find(r =>
      r.date === today &&
      r.notes?.includes('OUTSIDE OFFICE') &&
      r.checkOut
    );
    if (todayOutside && !alertExists('outside_office', emp.id)) {
      await createAlert('outside_office', 'high', emp.id,
        `🚨 Outside Office Checkout — ${emp.name}`,
        `${emp.name} checked out from outside office today.`);
    }
  }
}

// =============================================
// SYNC ALL + INIT
// =============================================

export async function syncAll(): Promise<void> {
  try {
    await Promise.all([
      syncEmployees(),
      syncRecords(),
      syncWFH(),
      syncAccountRequests(),
      syncTimings(),
      syncAccess(),
      syncLocations(),
      syncHolidays(),
      // 🆕 New syncs
      syncAuditLogs(),
      syncAlerts(),
      syncLeaves(),
      syncLeaveBalances(),
      syncCorrections(),
      syncManagerNotes(),
      syncDeviceLogs(),
      syncSalaryConfigs(),
      syncNotifications(),
    ]);
  } catch {}
}

export async function initializeApp(): Promise<void> {
  try {
    await syncAll();
    // Sirf ek baar app start pe alerts generate karo
    await generateSmartAlerts();
  } catch (e) {
    console.warn('Sync failed — using local cache:', e);
  }
}

// Naya function — manual scan ke liye
export async function manualScanAlerts(): Promise<void> {
  try {
    await syncAll();
    await generateSmartAlerts();
  } catch {}
}