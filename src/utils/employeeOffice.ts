// Per-employee office mapping
// Hamza (emp-002) & Sohail (emp-006) → PK Zone only
// Ishtiaq (emp-003) & Behzad (emp-004) → QC Center only
// Wahab (emp-001) & Albash (emp-005) → ALL 3 offices

export function getEmployeeDefaultOffice(empId: string): string {
  const pkZoneEmployees = ['emp-002', 'emp-006'];
  const qcCenterEmployees = ['emp-003', 'emp-004'];

  if (pkZoneEmployees.includes(empId)) return 'PK Zone';
  if (qcCenterEmployees.includes(empId)) return 'QC Center';
  return 'ALL'; // admin + manager
}

export function isAdminOrManager(role: string): boolean {
  return role === 'admin' || role === 'manager';
}