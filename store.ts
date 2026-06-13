import { Employee, AttendanceRecord, WFHRequest, WiFiConfig } from './types';

// Employee data
export const EMPLOYEES: Employee[] = [
  {
    id: 'emp-001',
    name: 'Abdul Wahab',
    role: 'admin',
    pin: '2687',
    avatar: 'AW',
  },
  {
    id: 'emp-002',
    name: 'Hamza Saeed',
    role: 'employee',
    pin: '2345',
    avatar: 'HS',
  },
  {
    id: 'emp-003',
    name: 'Ishtiaq ur Rehman',
    role: 'employee',
    pin: '3456',
    avatar: 'IR',
  },
  {
    id: 'emp-004',
    name: 'Behzad Riaz',
    role: 'employee',
    pin: '4567',
    avatar: 'BR',
  },
  {
    id: 'emp-005',
    name: 'Albash Akhtar',
    role: 'manager',
    pin: '8822',
    avatar: 'AA',
  },
  {
    id: 'emp-006',
    name: 'Sohail',
    role: 'employee',
    pin: '1122',
    avatar: 'SH',
  },
];

// Employees who mark attendance (excludes manager Albash)
export const ATTENDANCE_EMPLOYEES = EMPLOYEES.filter(e => e.id !== 'emp-005');

// WiFi configuration - Final Public IPs only
export const WIFI_CONFIG: WiFiConfig = {
  allowedIPs: [
    '202.141.254.126',
    '157.10.30.235',
    '103.93.13.182',
    '103.93.13.18',
  ],
  allowedGateways: [],
  allowedDNS: [],
  networkName: 'Office WiFi Network',
};

// All allowed Public IPs for verification
export const ALL_ALLOWED_IPS = [
  '202.141.254.126',
  '157.10.30.235',
  '103.93.13.182',
  '103.93.13.18',
];

// LocalStorage keys
const ATTENDANCE_KEY = 'wifi_attendance_records';
const SETTINGS_KEY = 'wifi_attendance_settings';
const WFH_REQUESTS_KEY = 'wifi_wfh_requests';

// WFH Request functions
export function getWFHRequests(): WFHRequest[] {
  try {
    const data = localStorage.getItem(WFH_REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveWFHRequests(requests: WFHRequest[]): void {
  localStorage.setItem(WFH_REQUESTS_KEY, JSON.stringify(requests));
}

export function addWFHRequest(request: WFHRequest): void {
  const requests = getWFHRequests();
  requests.push(request);
  saveWFHRequests(requests);
}

export function updateWFHRequest(id: string, updates: Partial<WFHRequest>): void {
  const requests = getWFHRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx !== -1) {
    requests[idx] = { ...requests[idx], ...updates };
    saveWFHRequests(requests);
  }
}

export function getTodayWFHRequest(employeeId: string): WFHRequest | undefined {
  const today = new Date().toISOString().split('T')[0];
  return getWFHRequests().find(r => r.employeeId === employeeId && r.date === today);
}

export function getPendingWFHRequests(): WFHRequest[] {
  return getWFHRequests().filter(r => r.status === 'pending');
}

// Helper functions for localStorage
export function getAttendanceRecords(): AttendanceRecord[] {
  try {
    const data = localStorage.getItem(ATTENDANCE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
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
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...updates };
    saveAttendanceRecords(records);
  }
}

export function getTodayRecord(employeeId: string): AttendanceRecord | undefined {
  const today = new Date().toISOString().split('T')[0];
  const records = getAttendanceRecords();
  return records.find(r => r.employeeId === employeeId && r.date === today);
}

export function getEmployeeRecords(employeeId: string): AttendanceRecord[] {
  return getAttendanceRecords().filter(r => r.employeeId === employeeId);
}

export function getRecordsByDate(date: string): AttendanceRecord[] {
  return getAttendanceRecords().filter(r => r.date === date);
}

export function getRecordsByMonth(year: number, month: number): AttendanceRecord[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return getAttendanceRecords().filter(r => r.date.startsWith(prefix));
}

// Default global settings
const DEFAULT_SETTINGS = {
  officeStartTime: '09:00',
  lateThresholdMinutes: 15,
  minHoursForFullDay: 8,
  minHoursForHalfDay: 4,
};

export function getSettings() {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: any): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ========== PER-EMPLOYEE TIMING ==========
const EMP_TIMING_KEY = 'wifi_employee_timings';

export interface EmployeeTiming {
  employeeId: string;
  officeStartTime: string;
  lateThresholdMinutes: number;
  minHoursForFullDay: number;
  minHoursForHalfDay: number;
}

// Get all employee timings
export function getAllEmployeeTimings(): Record<string, EmployeeTiming> {
  try {
    const data = localStorage.getItem(EMP_TIMING_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

// Save all employee timings
export function saveAllEmployeeTimings(timings: Record<string, EmployeeTiming>): void {
  localStorage.setItem(EMP_TIMING_KEY, JSON.stringify(timings));
}

// Get timing for specific employee (falls back to global if not set)
export function getEmployeeTiming(employeeId: string): EmployeeTiming {
  const allTimings = getAllEmployeeTimings();
  if (allTimings[employeeId]) {
    return allTimings[employeeId];
  }
  // Fallback to global settings
  const global = getSettings();
  return {
    employeeId,
    officeStartTime: global.officeStartTime,
    lateThresholdMinutes: global.lateThresholdMinutes,
    minHoursForFullDay: global.minHoursForFullDay,
    minHoursForHalfDay: global.minHoursForHalfDay,
  };
}

// Save timing for a single employee
export function saveEmployeeTiming(timing: EmployeeTiming): void {
  const all = getAllEmployeeTimings();
  all[timing.employeeId] = timing;
  saveAllEmployeeTimings(all);
}

// Generate demo data for past 30 days
export function generateDemoData(): void {
  const existing = getAttendanceRecords();
  if (existing.length > 0) return; // Don't overwrite

  const records: AttendanceRecord[] = [];
  const now = new Date();

  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateStr = date.toISOString().split('T')[0];

    // Only generate for attendance employees (not manager Albash)
    ATTENDANCE_EMPLOYEES.forEach(emp => {
      const random = Math.random();
      let status: AttendanceRecord['status'];
      let checkInHour: number;
      let checkInMin: number;
      let totalHours: number;

      if (random < 0.08) {
        // Absent
        records.push({
          id: `${emp.id}-${dateStr}`,
          employeeId: emp.id,
          date: dateStr,
          checkIn: null,
          checkOut: null,
          status: 'absent',
          totalHours: 0,
          wifiVerified: false,
          ipAddress: '',
          notes: '',
        });
        return;
      } else if (random < 0.25) {
        // Late
        status = 'late';
        checkInHour = 9 + Math.floor(Math.random() * 2);
        checkInMin = 15 + Math.floor(Math.random() * 45);
        totalHours = 6 + Math.random() * 3;
      } else if (random < 0.3) {
        // Half day
        status = 'half-day';
        checkInHour = 9;
        checkInMin = Math.floor(Math.random() * 15);
        totalHours = 4 + Math.random() * 1;
      } else {
        // On time
        status = 'present';
        checkInHour = 8 + Math.floor(Math.random() * 1);
        checkInMin = 30 + Math.floor(Math.random() * 30);
        totalHours = 8 + Math.random() * 2;
      }

      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, checkInMin, 0);
      
      const checkOut = new Date(checkIn);
      checkOut.setHours(checkIn.getHours() + Math.floor(totalHours), Math.floor((totalHours % 1) * 60));

      records.push({
        id: `${emp.id}-${dateStr}`,
        employeeId: emp.id,
        date: dateStr,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        status,
        totalHours: Math.round(totalHours * 100) / 100,
        wifiVerified: true,
        ipAddress: ALL_ALLOWED_IPS[Math.floor(Math.random() * ALL_ALLOWED_IPS.length)],
        notes: '',
      });
    });
  }

  saveAttendanceRecords(records);
}
