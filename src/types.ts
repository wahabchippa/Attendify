// src/types.ts

// =============================================
// CORE ENTITIES
// =============================================

export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  pin: string;
  avatar: string;
  device_id?: string | null;
  device_info?: string | null;       // device model/brand
  last_login?: string | null;        // last login timestamp
  created_at?: string | null;
}

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'half-day'
  | 'work-from-home'
  | 'holiday-ot'
  | 'on-leave';                      // 🆕 Leave status

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;                      // 'YYYY-MM-DD'
  checkIn: string | null;            // ISO string +05:00
  checkOut: string | null;           // ISO string +05:00
  status: AttendanceStatus;
  totalHours: number;
  overtime_hours?: number;
  wifiVerified: boolean;
  ipAddress: string;
  notes?: string;
  selfie_url?: string | null;        // 🆕 Selfie proof
  verification_method?: string;      // 🆕 'gps' | 'ip' | 'manual'
}

// =============================================
// WFH & ACCOUNT REQUESTS (existing)
// =============================================

export interface WFHRequest {
  id: string;
  employeeId: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface AccountRequest {
  id: string;
  name: string;
  pin: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedRole?: 'employee' | 'admin' | 'manager';
  reviewedBy?: string;
}

// =============================================
// 🆕 LEAVE MANAGEMENT
// =============================================

export type LeaveType =
  | 'casual'
  | 'sick'
  | 'annual'
  | 'emergency'
  | 'unpaid'
  | 'maternity'
  | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  fromDate: string;                  // 'YYYY-MM-DD'
  toDate: string;                    // 'YYYY-MM-DD'
  totalDays: number;
  reason: string;
  attachmentUrl?: string | null;     // sick certificate etc
  status: LeaveStatus;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewerNote?: string | null;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  casual: number;                    // remaining
  sick: number;
  annual: number;
  emergency: number;
  unpaid: number;                    // unlimited usually
  casualUsed: number;
  sickUsed: number;
  annualUsed: number;
  emergencyUsed: number;
  unpaidUsed: number;
}

export interface LeavePolicy {
  casualPerYear: number;             // e.g. 10
  sickPerYear: number;               // e.g. 8
  annualPerYear: number;             // e.g. 15
  emergencyPerYear: number;          // e.g. 3
  maxConsecutiveDays: number;        // e.g. 10
  minAdvanceDays: number;            // e.g. 1 day before
  allowHalfDayLeave: boolean;
}

// =============================================
// 🆕 SALARY / PAYROLL
// =============================================

export interface SalaryConfig {
  employeeId: string;
  baseSalary: number;
  perDaySalary: number;
  lateDeductionPerIncident: number;  // e.g. 200 PKR per late
  absentDeductionPerDay: number;     // e.g. full day salary
  halfDayDeduction: number;          // e.g. half day salary
  otRatePerHour: number;             // e.g. 1.5x hourly
  sundayOtRate: number;              // e.g. 2x hourly
  holidayOtRate: number;             // e.g. 2x hourly
  allowances: number;                // transport, food etc
  deductions: number;                // tax, insurance etc
}

export interface MonthlySalaryReport {
  employeeId: string;
  employeeName: string;
  month: string;                     // 'YYYY-MM'
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  wfhDays: number;
  leaveDays: number;
  totalHoursWorked: number;
  regularOtHours: number;
  sundayOtHours: number;
  holidayOtHours: number;
  baseSalary: number;
  lateDeductions: number;
  absentDeductions: number;
  halfDayDeductions: number;
  totalDeductions: number;
  regularOtPay: number;
  sundayOtPay: number;
  holidayOtPay: number;
  totalOtPay: number;
  allowances: number;
  grossPay: number;
  netPay: number;
}

// =============================================
// 🆕 AUDIT LOG
// =============================================

export type AuditAction =
  | 'check_in'
  | 'check_out'
  | 'record_edit'
  | 'record_delete'
  | 'record_create'
  | 'pin_change'
  | 'employee_add'
  | 'employee_remove'
  | 'device_bind'
  | 'device_reset'
  | 'wfh_approve'
  | 'wfh_reject'
  | 'leave_approve'
  | 'leave_reject'
  | 'account_approve'
  | 'account_reject'
  | 'timing_change'
  | 'access_grant'
  | 'access_revoke'
  | 'holiday_add'
  | 'holiday_remove'
  | 'salary_update'
  | 'correction_approve'
  | 'correction_reject'
  | 'secret_override'
  | 'login_attempt'
  | 'login_success'
  | 'login_failed'
  | 'suspicious_activity';

export interface AuditLog {
  id: string;
  action: AuditAction;
  performedBy: string;               // employee ID
  performedByName: string;
  targetEmployeeId?: string | null;
  targetEmployeeName?: string | null;
  description: string;
  oldValue?: string | null;          // JSON string
  newValue?: string | null;          // JSON string
  ipAddress?: string | null;
  deviceInfo?: string | null;
  timestamp: string;                 // ISO string
  severity: 'info' | 'warning' | 'critical';
}

// =============================================
// 🆕 ADMIN ALERTS
// =============================================

export type AlertType =
  | 'late_pattern'
  | 'frequent_absent'
  | 'ot_excess'
  | 'wfh_excess'
  | 'outside_office'
  | 'gps_off'
  | 'unauthorized_device'
  | 'failed_login'
  | 'no_checkout'
  | 'correction_request'
  | 'leave_request'
  | 'suspicious_override'
  | 'consecutive_absent';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AdminAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  employeeId: string;
  employeeName: string;
  title: string;
  message: string;
  isRead: boolean;
  isDismissed: boolean;
  actionTaken?: string | null;
  createdAt: string;
  readAt?: string | null;
}

// =============================================
// 🆕 ATTENDANCE CORRECTION
// =============================================

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  date: string;                      // which date to correct
  currentStatus: AttendanceStatus;
  requestedStatus: AttendanceStatus;
  currentCheckIn?: string | null;
  requestedCheckIn?: string | null;
  currentCheckOut?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewerNote?: string | null;
}

// =============================================
// 🆕 MANAGER NOTES
// =============================================

export type NoteType = 'warning' | 'appreciation' | 'general' | 'disciplinary';

export interface ManagerNote {
  id: string;
  employeeId: string;
  note: string;
  type: NoteType;
  addedBy: string;                   // manager/admin ID
  addedByName: string;
  addedAt: string;
  isPrivate: boolean;                // employee ko dikhana hai ya nahi
}

// =============================================
// 🆕 DEVICE MANAGEMENT
// =============================================

export interface DeviceLog {
  id: string;
  employeeId: string;
  deviceId: string;
  deviceInfo: string;                // "Samsung Galaxy A54 / Android 14"
  action: 'bind' | 'reset' | 'login_attempt' | 'login_blocked';
  ipAddress?: string;
  timestamp: string;
  success: boolean;
}

// =============================================
// 🆕 NOTIFICATION
// =============================================

export type NotificationType =
  | 'check_in_reminder'
  | 'check_out_reminder'
  | 'late_warning'
  | 'wfh_approved'
  | 'wfh_rejected'
  | 'leave_approved'
  | 'leave_rejected'
  | 'correction_approved'
  | 'correction_rejected'
  | 'admin_alert'
  | 'update_available'
  | 'general';

export interface AppNotification {
  id: string;
  employeeId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  actionUrl?: string | null;         // deep link to specific page
}

// =============================================
// 🆕 KPI TARGETS
// =============================================

export interface EmployeeTarget {
  employeeId: string;
  month: string;                     // 'YYYY-MM'
  targetPresentDays: number;         // e.g. 22
  targetTotalHours: number;          // e.g. 176
  targetOnTimePercent: number;       // e.g. 95
  targetMaxLate: number;             // e.g. 2
  actualPresentDays?: number;
  actualTotalHours?: number;
  actualOnTimePercent?: number;
  actualLateDays?: number;
  achieved?: boolean;
}

// =============================================
// NETWORK / LOCATION (existing + improved)
// =============================================

export interface WiFiConfig {
  allowedIPs: string[];
  allowedGateways: string[];
  allowedDNS: string[];
  networkName: string;
}

export interface LocationResult {
  isConnected: boolean;
  ipAddress: string;
  locationLabel?: string;
  method?: string;
  distance?: number;                 // 🆕 distance from office
  accuracy?: number;                 // 🆕 GPS accuracy in meters
}

// =============================================
// ANALYTICS (existing + improved)
// =============================================

export interface DailyStats {
  date: string;
  present: number;
  absent: number;
  late: number;
  onTime: number;
  wfh: number;                       // 🆕
  onLeave: number;                   // 🆕
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  wfhDays: number;
  leaveDays?: number;                // 🆕
  totalHours: number;
  avgHoursPerDay: number;
  lateDates: string[];
  absentDates: string[];
  onTimePercentage: number;
  totalOT: number;
  sundayOT?: number;                 // 🆕
  holidayOT?: number;                // 🆕
  regularOT?: number;                // 🆕
}