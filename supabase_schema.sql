-- ============================================
-- ATTENDIFY - Supabase Schema
-- Copy-paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================

-- 1. EMPLOYEES
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  pin TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE RECORDS
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  total_hours REAL NOT NULL DEFAULT 0,
  wifi_verified BOOLEAN DEFAULT TRUE,
  ip_address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WFH REQUESTS
CREATE TABLE wfh_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

-- 4. ACCOUNT REQUESTS
CREATE TABLE account_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_role TEXT,
  reviewed_by TEXT
);

-- 5. EMPLOYEE TIMINGS
CREATE TABLE employee_timings (
  employee_id TEXT PRIMARY KEY,
  office_start_time TEXT NOT NULL DEFAULT '09:00',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_hours_full_day INTEGER NOT NULL DEFAULT 8,
  min_hours_half_day INTEGER NOT NULL DEFAULT 4
);

-- 6. ACCESS CONTROL
CREATE TABLE access_control (
  feature TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  PRIMARY KEY (feature, employee_id)
);

-- 7. APP SETTINGS
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default Employees
INSERT INTO employees (id, name, role, pin, avatar) VALUES
  ('emp-001', 'Abdul Wahab', 'admin', '2687', 'AW'),
  ('emp-002', 'Hamza Saeed', 'employee', '2345', 'HS'),
  ('emp-003', 'Ishtiaq ur Rehman', 'employee', '3456', 'IR'),
  ('emp-004', 'Behzad Riaz', 'employee', '4567', 'BR'),
  ('emp-005', 'Albash Akhtar', 'manager', '8822', 'AA'),
  ('emp-006', 'Sohail', 'employee', '1122', 'SH');

-- Default Access Control
INSERT INTO access_control (feature, employee_id) VALUES
  ('ot','emp-001'),('ot','emp-005'),
  ('ai','emp-001'),('ai','emp-005'),
  ('analytics','emp-001'),('analytics','emp-005'),
  ('settings','emp-001'),('settings','emp-005'),
  ('pin_change','emp-001'),('pin_change','emp-005'),
  ('add_employee','emp-001'),('add_employee','emp-005'),
  ('remove_employee','emp-001'),('remove_employee','emp-005'),
  ('timings','emp-001'),
  ('wfh_approve','emp-001'),('wfh_approve','emp-005'),
  ('secret_override','emp-001'),
  ('view_all','emp-001'),('view_all','emp-005');

-- Enable RLS but secure table policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Secure policies: employees can only view/edit their own data, managers/admins can view/edit everything
CREATE POLICY "Employees can view own data, Admins/Managers can view all" ON employees FOR SELECT 
  USING (auth.uid()::text = id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Only admins/managers can insert or update employees" ON employees FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view own attendance, Admins/Managers can view all" ON attendance_records FOR SELECT 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can check-in/out, Admins/Managers can manage all" ON attendance_records FOR ALL 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view/create own WFH requests, Admins/Managers can view/update all" ON wfh_requests FOR ALL
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Anyone can submit account requests" ON account_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage account requests" ON account_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view timings, only admins can manage" ON employee_timings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view access control, only admins can manage" ON access_control FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view app settings, only admins can manage" ON app_settings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));
-- ============================================
-- ATTENDIFY - Supabase Schema
-- Copy-paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================

-- 1. EMPLOYEES
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  pin TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()-- ============================================
-- ATTENDIFY - Supabase Schema
-- Copy-paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================

-- 1. EMPLOYEES
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  pin TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE RECORDS
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  total_hours REAL NOT NULL DEFAULT 0,
  wifi_verified BOOLEAN DEFAULT TRUE,
  ip_address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WFH REQUESTS
CREATE TABLE wfh_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

-- 4. ACCOUNT REQUESTS
CREATE TABLE account_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_role TEXT,
  reviewed_by TEXT
);

-- 5. EMPLOYEE TIMINGS
CREATE TABLE employee_timings (
  employee_id TEXT PRIMARY KEY,
  office_start_time TEXT NOT NULL DEFAULT '09:00',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_hours_full_day INTEGER NOT NULL DEFAULT 8,
  min_hours_half_day INTEGER NOT NULL DEFAULT 4
);

-- 6. ACCESS CONTROL
CREATE TABLE access_control (
  feature TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  PRIMARY KEY (feature, employee_id)
);

-- 7. APP SETTINGS
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default Employees
INSERT INTO employees (id, name, role, pin, avatar) VALUES
  ('emp-001', 'Abdul Wahab', 'admin', '2687', 'AW'),
  ('emp-002', 'Hamza Saeed', 'employee', '2345', 'HS'),
  ('emp-003', 'Ishtiaq ur Rehman', 'employee', '3456', 'IR'),
  ('emp-004', 'Behzad Riaz', 'employee', '4567', 'BR'),
  ('emp-005', 'Albash Akhtar', 'manager', '8822', 'AA'),
  ('emp-006', 'Sohail', 'employee', '1122', 'SH');

-- Default Access Control
INSERT INTO access_control (feature, employee_id) VALUES
  ('ot','emp-001'),('ot','emp-005'),
  ('ai','emp-001'),('ai','emp-005'),
  ('analytics','emp-001'),('analytics','emp-005'),
  ('settings','emp-001'),('settings','emp-005'),
  ('pin_change','emp-001'),('pin_change','emp-005'),
  ('add_employee','emp-001'),('add_employee','emp-005'),
  ('remove_employee','emp-001'),('remove_employee','emp-005'),
  ('timings','emp-001'),
  ('wfh_approve','emp-001'),('wfh_approve','emp-005'),
  ('secret_override','emp-001'),
  ('view_all','emp-001'),('view_all','emp-005');

-- Enable RLS but secure table policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Secure policies: employees can only view/edit their own data, managers/admins can view/edit everything
CREATE POLICY "Employees can view own data, Admins/Managers can view all" ON employees FOR SELECT 
  USING (auth.uid()::text = id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Only admins/managers can insert or update employees" ON employees FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view own attendance, Admins/Managers can view all" ON attendance_records FOR SELECT 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can check-in/out, Admins/Managers can manage all" ON attendance_records FOR ALL 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view/create own WFH requests, Admins/Managers can view/update all" ON wfh_requests FOR ALL
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Anyone can submit account requests" ON account_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage account requests" ON account_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view timings, only admins can manage" ON employee_timings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view access control, only admins can manage" ON access_control FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'-- ============================================
-- ATTENDIFY - Supabase Schema
-- Copy-paste this ENTIRE file into Supabase SQL Editor and click RUN
-- ============================================

-- 1. EMPLOYEES
CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  pin TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTENDANCE RECORDS
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  total_hours REAL NOT NULL DEFAULT 0,
  wifi_verified BOOLEAN DEFAULT TRUE,
  ip_address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WFH REQUESTS
CREATE TABLE wfh_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

-- 4. ACCOUNT REQUESTS
CREATE TABLE account_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_role TEXT,
  reviewed_by TEXT
);

-- 5. EMPLOYEE TIMINGS
CREATE TABLE employee_timings (
  employee_id TEXT PRIMARY KEY,
  office_start_time TEXT NOT NULL DEFAULT '09:00',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_hours_full_day INTEGER NOT NULL DEFAULT 8,
  min_hours_half_day INTEGER NOT NULL DEFAULT 4
);

-- 6. ACCESS CONTROL
CREATE TABLE access_control (
  feature TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  PRIMARY KEY (feature, employee_id)
);

-- 7. APP SETTINGS
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default Employees
INSERT INTO employees (id, name, role, pin, avatar) VALUES
  ('emp-001', 'Abdul Wahab', 'admin', '2687', 'AW'),
  ('emp-002', 'Hamza Saeed', 'employee', '2345', 'HS'),
  ('emp-003', 'Ishtiaq ur Rehman', 'employee', '3456', 'IR'),
  ('emp-004', 'Behzad Riaz', 'employee', '4567', 'BR'),
  ('emp-005', 'Albash Akhtar', 'manager', '8822', 'AA'),
  ('emp-006', 'Sohail', 'employee', '1122', 'SH');

-- Default Access Control
INSERT INTO access_control (feature, employee_id) VALUES
  ('ot','emp-001'),('ot','emp-005'),
  ('ai','emp-001'),('ai','emp-005'),
  ('analytics','emp-001'),('analytics','emp-005'),
  ('settings','emp-001'),('settings','emp-005'),
  ('pin_change','emp-001'),('pin_change','emp-005'),
  ('add_employee','emp-001'),('add_employee','emp-005'),
  ('remove_employee','emp-001'),('remove_employee','emp-005'),
  ('timings','emp-001'),
  ('wfh_approve','emp-001'),('wfh_approve','emp-005'),
  ('secret_override','emp-001'),
  ('view_all','emp-001'),('view_all','emp-005');

-- Enable RLS but secure table policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Secure policies: employees can only view/edit their own data, managers/admins can view/edit everything
CREATE POLICY "Employees can view own data, Admins/Managers can view all" ON employees FOR SELECT 
  USING (auth.uid()::text = id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Only admins/managers can insert or update employees" ON employees FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view own attendance, Admins/Managers can view all" ON attendance_records FOR SELECT 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can check-in/out, Admins/Managers can manage all" ON attendance_records FOR ALL 
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Employees can view/create own WFH requests, Admins/Managers can view/update all" ON wfh_requests FOR ALL
  USING (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ))
  WITH CHECK (auth.uid()::text = employee_id OR EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role IN ('admin', 'manager')
  ));

CREATE POLICY "Anyone can submit account requests" ON account_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can manage account requests" ON account_requests FOR ALL
  USING (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view timings, only admins can manage" ON employee_timings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view access control, only admins can manage" ON access_control FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

CREATE POLICY "Anyone can view app settings, only admins can manage" ON app_settings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

  ));

CREATE POLICY "Anyone can view app settings, only admins can manage" ON app_settings FOR ALL
  USING (true)
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.id = auth.uid()::text AND e.role = 'admin'
  ));

);

-- 2. ATTENDANCE RECORDS
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  total_hours REAL NOT NULL DEFAULT 0,
  wifi_verified BOOLEAN DEFAULT TRUE,
  ip_address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WFH REQUESTS
CREATE TABLE wfh_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  date TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ
);

-- 4. ACCOUNT REQUESTS
CREATE TABLE account_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending',
  approved_role TEXT,
  reviewed_by TEXT
);

-- 5. EMPLOYEE TIMINGS
CREATE TABLE employee_timings (
  employee_id TEXT PRIMARY KEY,
  office_start_time TEXT NOT NULL DEFAULT '09:00',
  late_threshold_minutes INTEGER NOT NULL DEFAULT 15,
  min_hours_full_day INTEGER NOT NULL DEFAULT 8,
  min_hours_half_day INTEGER NOT NULL DEFAULT 4
);

-- 6. ACCESS CONTROL
CREATE TABLE access_control (
  feature TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  PRIMARY KEY (feature, employee_id)
);

-- 7. APP SETTINGS
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Default Employees
INSERT INTO employees (id, name, role, pin, avatar) VALUES
  ('emp-001', 'Abdul Wahab', 'admin', '2687', 'AW'),
  ('emp-002', 'Hamza Saeed', 'employee', '2345', 'HS'),
  ('emp-003', 'Ishtiaq ur Rehman', 'employee', '3456', 'IR'),
  ('emp-004', 'Behzad Riaz', 'employee', '4567', 'BR'),
  ('emp-005', 'Albash Akhtar', 'manager', '8822', 'AA'),
  ('emp-006', 'Sohail', 'employee', '1122', 'SH');

-- Default Access Control
INSERT INTO access_control (feature, employee_id) VALUES
  ('ot','emp-001'),('ot','emp-005'),
  ('ai','emp-001'),('ai','emp-005'),
  ('analytics','emp-001'),('analytics','emp-005'),
  ('settings','emp-001'),('settings','emp-005'),
  ('pin_change','emp-001'),('pin_change','emp-005'),
  ('add_employee','emp-001'),('add_employee','emp-005'),
  ('remove_employee','emp-001'),('remove_employee','emp-005'),
  ('timings','emp-001'),
  ('wfh_approve','emp-001'),('wfh_approve','emp-005'),
  ('secret_override','emp-001'),
  ('view_all','emp-001'),('view_all','emp-005');

-- Enable RLS but allow all (anon key)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wfh_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timings ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Open policies (since we use anon key + PIN auth)
CREATE POLICY "Allow all" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON wfh_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON account_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON employee_timings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON access_control FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
