export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  pin: string;
  avatar: string;
  device_id?: string | null; // 📱 Yeh line add karni hai
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  totalHours: number;
  overtime_hours?: number; // 🌟 Yeh line add karni hai
  wifiVerified: boolean;
  ipAddress: string;
  notes?: string;
}

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

export interface WiFiConfig {
  allowedIPs: string[];
  allowedGateways: string[];
  allowedDNS: string[];
  networkName: string;
}

export interface DailyStats {
  date: string;
  present: number;
  absent: number;
  late: number;
  onTime: number;
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  wfhDays?: number;
  totalHours: number;
  avgHoursPerDay: number;
  lateDates: string[];
  absentDates: string[];
  onTimePercentage: number;
  totalOT: number;
}
