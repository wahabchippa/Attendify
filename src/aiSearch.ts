// src/aiSearch.ts

import { getEmployees, getAttendanceEmployees, getLocationFromIP, getEmployeeTiming, canSeeOT } from './store';  // ✅ './store'
import { AttendanceRecord, EmployeeSummary } from './types';  // ✅ './types'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subDays, startOfWeek, endOfWeek, subWeeks, differenceInDays } from 'date-fns';

// =============================================
// 1. INTENT CLASSIFICATION (NLP)
// =============================================

type Intent = 
  | 'ATTENDANCE_SUMMARY'
  | 'LATE_REPORT'
  | 'ABSENT_REPORT'
  | 'EARLY_REPORT'
  | 'HOURS_REPORT'
  | 'OT_REPORT'
  | 'WFH_REPORT'
  | 'LOCATION_REPORT'
  | 'TEAM_SUMMARY'
  | 'COMPARISON'
  | 'BEST_PERFORMER'
  | 'PREDICTION'
  | 'ANOMALY'
  | 'EXPORT'
  | 'HELP';

function classifyIntent(query: string): Intent {
  const q = query.toLowerCase();
  
  // Help
  if (q.includes('help') || q.includes('madad') || q.includes('kya pooch') || q.includes('guide')) {
    return 'HELP';
  }
  
  // Attendance summary
  if (q.includes('summary') || q.includes('report') || q.includes('check-in') || q.includes('present') || q.includes('attendance')) {
    return 'ATTENDANCE_SUMMARY';
  }
  
  // Late
  if (q.includes('late') || q.includes('der') || q.includes('dair') || q.includes('deri') || q.includes('tard') || q.includes('time par nahi')) {
    return 'LATE_REPORT';
  }
  
  // Absent
  if (q.includes('absent') || q.includes('chutti') || q.includes('leave') || q.includes('nahi aaya') || q.includes('nhi aya') || q.includes('gayab')) {
    return 'ABSENT_REPORT';
  }
  
  // Early / On-time
  if (q.includes('early') || q.includes('jaldi') || q.includes('time se pehle') || q.includes('ontime') || q.includes('on time')) {
    return 'EARLY_REPORT';
  }
  
  // Hours / Work
  if (q.includes('hour') || q.includes('ghant') || q.includes('kitne') || q.includes('kaam') || q.includes('work') || q.includes('kam') || q.includes('time')) {
    return 'HOURS_REPORT';
  }
  
  // OT / Overtime
  if (q.includes('ot') || q.includes('overtime') || q.includes('extra') || q.includes('additional')) {
    return 'OT_REPORT';
  }
  
  // WFH
  if (q.includes('wfh') || q.includes('work from home') || q.includes('ghar se') || q.includes('home')) {
    return 'WFH_REPORT';
  }
  
  // Location
  if (q.includes('location') || q.includes('kahan') || q.includes('kidhar') || q.includes('zone') || q.includes('office') || q.includes('center')) {
    return 'LOCATION_REPORT';
  }
  
  // Team / All
  if (q.includes('team') || q.includes('sab') || q.includes('everyone') || q.includes('all') || q.includes('sabki') || q.includes('sabka')) {
    return 'TEAM_SUMMARY';
  }
  
  // Comparison
  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('competition') || q.includes('performance')) {
    return 'COMPARISON';
  }
  
  // Best
  if (q.includes('best') || q.includes('top') || q.includes('behtareen') || q.includes('acha') || q.includes('number one') || q.includes('topper')) {
    return 'BEST_PERFORMER';
  }
  
  // Prediction
  if (q.includes('predict') || q.includes('forecast') || q.includes('future') || q.includes('coming') || q.includes('next') || q.includes('warn') || q.includes('agla')) {
    return 'PREDICTION';
  }
  
  // Anomaly
  if (q.includes('anomaly') || q.includes('fraud') || q.includes('alert') || q.includes('red flag') || q.includes('suspicious') || q.includes('shak')) {
    return 'ANOMALY';
  }
  
  // Export
  if (q.includes('export') || q.includes('pdf') || q.includes('excel') || q.includes('download') || q.includes('print')) {
    return 'EXPORT';
  }
  
  return 'ATTENDANCE_SUMMARY';
}

// =============================================
// 2. FUZZY + PHONETIC SEARCH
// =============================================

function fuzzySearch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  
  // Exact match
  if (t.includes(q)) return true;
  if (q.includes(t)) return true;
  
  // Word-by-word
  const qWords = q.split(' ');
  const tWords = t.split(' ');
  
  for (const qw of qWords) {
    for (const tw of tWords) {
      if (qw.length >= 2 && tw.length >= 2) {
        if (tw.includes(qw) || qw.includes(tw)) return true;
        // Close match (typo tolerance)
        if (getLevenshteinDistance(qw, tw) <= 2) return true;
      }
    }
  }
  return false;
}

function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j-1] === b[i-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// =============================================
// 3. DATE HANDLING
// =============================================

function detectDateRange(query: string): { start: string; end: string; label: string } | null {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const q = query.toLowerCase();

  // Today
  if (q.includes('today') || q.includes('aaj') || q.includes('aj') || q.includes('aaj ka') || q.includes('aj ka')) {
    return { start: today, end: today, label: 'Today' };
  }

  // Yesterday
  if (q.includes('yesterday') || q.includes('kal') || q.includes('guzishta')) {
    const d = format(subDays(now, 1), 'yyyy-MM-dd');
    return { start: d, end: d, label: 'Yesterday' };
  }

  // This week
  if (q.includes('this week') || q.includes('is hafte') || q.includes('is haftey') || q.includes('this hafta')) {
    const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start, end: today, label: 'This Week' };
  }

  // Last week
  if (q.includes('last week') || q.includes('pichle hafte') || q.includes('pichlay haftey') || q.includes('guzishta hafte')) {
    const start = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const end = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start, end, label: 'Last Week' };
  }

  // Last 7 days
  if (q.includes('7 din') || q.includes('7 days') || q.includes('7 dinon') || q.includes('last 7')) {
    return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: today, label: 'Last 7 Days' };
  }

  // Last 15 days
  if (q.includes('15 din') || q.includes('15 days') || q.includes('15 dinon')) {
    return { start: format(subDays(now, 15), 'yyyy-MM-dd'), end: today, label: 'Last 15 Days' };
  }

  // This month
  if (q.includes('this month') || q.includes('is mahine') || q.includes('is mahinay') || q.includes('is month') || q.includes('current month')) {
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    return { start, end: today, label: 'This Month' };
  }

  // Last month
  if (q.includes('last month') || q.includes('pichle mahine') || q.includes('pichlay mahinay') || q.includes('previous month')) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    return { start, end, label: 'Last Month' };
  }

  return null;
}

function detectMonthYear(query: string): { month?: number; year: number } {
  const q = query.toLowerCase();
  const months: Record<string, number> = {
    january: 1, jan: 1, 'جنوری': 1,
    february: 2, feb: 2, 'فروری': 2,
    march: 3, mar: 3, 'مارچ': 3,
    april: 4, apr: 4, 'اپریل': 4,
    may: 5, 'مئی': 5,
    june: 6, jun: 6, 'جون': 6,
    july: 7, jul: 7, 'جولائی': 7,
    august: 8, aug: 8, 'اگست': 8,
    september: 9, sep: 9, 'ستمبر': 9,
    october: 10, oct: 10, 'اکتوبر': 10,
    november: 11, nov: 11, 'نومبر': 11,
    december: 12, dec: 12, 'دسمبر': 12,
  };
  
  let month: number | undefined;
  let year = new Date().getFullYear();
  
  for (const [name, num] of Object.entries(months)) {
    if (q.includes(name)) { month = num; break; }
  }
  
  const ym = q.match(/20\d{2}/);
  if (ym) year = parseInt(ym[0]);
  
  return { month, year };
}

// =============================================
// 4. HELPERS
// =============================================

function fmtDate(d: string): string {
  return format(parseISO(d), 'dd MMM yyyy (EEEE)');
}

function fmtTime(iso: string | null): string {
  return iso ? format(parseISO(iso), 'hh:mm a') : '—';
}

function fmtShortDate(d: string): string {
  return format(parseISO(d), 'dd MMM (EEE)');
}

// =============================================
// 5. PREDICTIVE INSIGHTS
// =============================================

function predictNextLate(employeeId: string, records: AttendanceRecord[], employeeName: string): string {
  const recs = records
    .filter(r => r.employeeId === employeeId && r.status === 'late')
    .sort((a, b) => a.date.localeCompare(b.date));
  
  if (recs.length < 3) {
    return `📊 **${employeeName}'s Late Pattern:**\n\nNot enough data for prediction. ${recs.length} late days recorded.`;
  }
  
  // Day pattern
  const dayNames = recs.map(r => format(parseISO(r.date), 'EEEE'));
  const freq: Record<string, number> = {};
  dayNames.forEach(d => freq[d] = (freq[d] || 0) + 1);
  const mostLikelyDay = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
  
  // Time pattern
  const times = recs.map(r => {
    if (!r.checkIn) return 0;
    const d = new Date(r.checkIn);
    return d.getHours() * 60 + d.getMinutes();
  });
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const avgHour = Math.floor(avgTime / 60);
  const avgMin = avgTime % 60;
  
  // Weekly trend
  const recent = recs.slice(-5).map(r => format(parseISO(r.date), 'dd MMM'));
  
  return `🔮 **${employeeName} — Late Pattern Analysis:**\n\n` +
    `  ⚠️ Most likely to be late on: **${mostLikelyDay}**\n` +
    `  ⏰ Average late time: **${avgHour}:${String(avgMin).padStart(2, '0')}**\n` +
    `  📊 Total late days: **${recs.length}**\n` +
    `  📅 Recent lates: ${recent.join(', ')}\n\n` +
    `  💡 **Tip:** Plan to leave **10-15 mins earlier** on ${mostLikelyDay}!`;
}

// =============================================
// 6. TEAM BENCHMARKING
// =============================================

function teamBenchmarking(records: AttendanceRecord[], dateRange: { start: string; end: string; label: string }): string {
  const employees = getAttendanceEmployees();
  const stats = employees.map(emp => {
    const recs = records.filter(r => 
      r.employeeId === emp.id && 
      r.date >= dateRange.start && 
      r.date <= dateRange.end
    );
    const totalH = recs.reduce((s, r) => s + (r.totalHours || 0), 0);
    const present = recs.filter(r => ['present', 'late'].includes(r.status)).length;
    const late = recs.filter(r => r.status === 'late').length;
    const absent = recs.filter(r => r.status === 'absent').length;
    return {
      name: emp.name,
      hours: Math.round(totalH * 100) / 100,
      days: present,
      late: late,
      absent: absent,
      avg: present > 0 ? Math.round((totalH / present) * 100) / 100 : 0,
      onTime: present > 0 ? Math.round(((present - late) / present) * 100) : 0,
    };
  });

  const byHours = [...stats].sort((a, b) => b.hours - a.hours);
  const byOnTime = [...stats].sort((a, b) => b.onTime - a.onTime);
  const byPresent = [...stats].sort((a, b) => b.days - a.days);

  let res = `📊 **Team Benchmark — ${dateRange.label}**\n\n`;
  
  res += `🔥 **Most Hours Worked:**\n`;
  byHours.slice(0, 3).forEach((s, i) => {
    res += `  ${i+1}. ${s.name} — ${s.hours}h (${s.days} days)\n`;
  });
  
  res += `\n🎯 **Best On-Time Performance:**\n`;
  byOnTime.slice(0, 3).forEach((s, i) => {
    res += `  ${i+1}. ${s.name} — ${s.onTime}% (${s.days - s.late}/${s.days})\n`;
  });
  
  const bottom = byPresent.filter(s => s.days > 0).slice(-3).reverse();
  if (bottom.length > 0) {
    res += `\n📉 **Needs Improvement:**\n`;
    bottom.forEach((s, i) => {
      res += `  ${i+1}. ${s.name} — ${s.days} present, ${s.absent} absent\n`;
    });
  }
  
  return res;
}

// =============================================
// 7. ANOMALY DETECTION
// =============================================

function detectAnomalies(employeeId: string, records: AttendanceRecord[], employeeName: string): string {
  const recs = records.filter(r => r.employeeId === employeeId);
  if (recs.length < 5) {
    return `Not enough data for anomaly detection.`;
  }
  
  const avgHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0) / recs.length;
  const recent = recs.slice(-5);
  const anomalies: string[] = [];
  
  recent.forEach(r => {
    if (r.totalHours < avgHours * 0.4 && r.totalHours > 0) {
      anomalies.push(`⚠️ ${fmtShortDate(r.date)}: Only ${r.totalHours}h (Avg: ${Math.round(avgHours)}h)`);
    }
    if (r.status === 'absent' && r.date === new Date().toISOString().split('T')[0]) {
      anomalies.push(`🔴 ${employeeName} is **ABSENT** today!`);
    }
    if (r.status === 'late' && r.date === new Date().toISOString().split('T')[0]) {
      anomalies.push(`🟡 ${employeeName} was **LATE** today!`);
    }
    if (r.notes && r.notes.includes('OUTSIDE OFFICE')) {
      anomalies.push(`🚨 ${fmtShortDate(r.date)}: Checked out from **Outside Office**!`);
    }
  });
  
  if (anomalies.length === 0) {
    return `✅ **${employeeName}** — No anomalies detected.`;
  }
  
  return `🚨 **${employeeName} — Anomaly Report:**\n\n${anomalies.map(a => `  ${a}`).join('\n')}`;
}

// =============================================
// 8. MAIN PROCESSOR
// =============================================

export function processAIQuery(query: string, allRecords: AttendanceRecord[], askingEmployeeId: string, isAdmin: boolean): string {
  const intent = classifyIntent(query);
  const q = query.toLowerCase();
  const EMPS = getEmployees();
  const showOT = canSeeOT(askingEmployeeId);

  // --- Find target employee (with fuzzy search) ---
  let targetEmployee: { id: string; name: string; avatar: string; role: string; pin: string; device_id?: string } | undefined;

  for (const emp of EMPS) {
    if (fuzzySearch(q, emp.name)) {
      targetEmployee = emp;
      break;
    }
  }

  // Block non-admin from seeing others
  if (!isAdmin && targetEmployee && targetEmployee.id !== askingEmployeeId) {
    return '❌ Aap sirf apni details dekh saktey hain. Kisi aur ki information available nahi hai.';
  }

  const effectiveTarget = isAdmin ? targetEmployee : EMPS.find(e => e.id === askingEmployeeId);
  const employeeName = effectiveTarget?.name || 'Unknown';

  // --- Detect date range ---
  let dateRange = detectDateRange(q);
  let { month: dMonth, year: dYear } = detectMonthYear(q);
  
  if (q.includes('last month') && !dateRange) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    dateRange = { start, end, label: 'Last Month' };
  }

  // --- Filter records by date ---
  function filterByDate(records: AttendanceRecord[], empId: string): AttendanceRecord[] {
    let filtered = records.filter(r => r.employeeId === empId);
    if (dateRange) {
      filtered = filtered.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
    } else if (dMonth) {
      const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`;
      filtered = filtered.filter(r => r.date.startsWith(pfx));
    }
    return filtered;
  }

  // =============================================
  // INTENT HANDLING
  // =============================================

  // --- HELP ---
  if (intent === 'HELP') {
    return `🤖 **Attendify AI — Kya Pooch Sakte Hain?**\n\n` +
      `  👤 **Personal:**\n` +
      `  • "Meri attendance kya hai?"\n` +
      `  • "Maine kitne ghante kaam kia?"\n` +
      `  • "Mera overtime kya hai?"\n\n` +
      `  📋 **Reports:**\n` +
      `  • "Ishtiaq kis din late aaya?"\n` +
      `  • "Hamza ne is mahine kitne WFH liye?"\n` +
      `  • "Sohail ki last week ki report"\n\n` +
      `  👥 **Admin Only:**\n` +
      `  • "Aaj kaun absent hai?"\n` +
      `  • "Sabki attendance dikhao"\n` +
      `  • "Best performer kaun hai?"\n` +
      `  • "Team ke average hours kya hain?"\n\n` +
      `  🔮 **Advanced:**\n` +
      `  • "Predict karo agla late kab hoga"\n` +
      `  • "Kisi mein koi anomaly hai?"\n` +
      `  • "Team benchmarking karo"\n\n` +
      `  Urdu + English dono chalte hain! ✅`;
  }

  // --- TEAM BENCHMARKING (Admin Only) ---
  if (intent === 'TEAM_SUMMARY' || intent === 'BENCHMARKING') {
    if (!isAdmin) {
      return '❌ Admin ke liye yeh feature available hai.';
    }
    const range = dateRange || { start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), label: 'Last 30 Days' };
    return teamBenchmarking(allRecords, range);
  }

  // --- BEST PERFORMER (Admin Only) ---
  if (intent === 'BEST_PERFORMER') {
    if (!isAdmin) return '❌ Admin ke liye yeh feature hai.';
    const range = dateRange || { start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), label: 'This Month' };
    const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);
    const employees = getAttendanceEmployees();
    
    const stats = employees.map(emp => {
      const empRecs = recs.filter(r => r.employeeId === emp.id);
      const present = empRecs.filter(r => ['present', 'late'].includes(r.status)).length;
      const late = empRecs.filter(r => r.status === 'late').length;
      const onTime = present > 0 ? Math.round(((present - late) / present) * 100) : 0;
      const totalH = empRecs.reduce((s, r) => s + (r.totalHours || 0), 0);
      return { name: emp.name, onTime, present, late, totalH, days: empRecs.length };
    });

    const best = stats.sort((a, b) => b.onTime - a.onTime)[0];
    if (!best || best.days === 0) {
      return `📊 **${range.label}** — No data available yet.`;
    }

    return `🏆 **Best Performer — ${range.label}**\n\n` +
      `  👤 **${best.name}**\n` +
      `  🎯 On-Time: **${best.onTime}%**\n` +
      `  ✅ Present: ${best.present} days\n` +
      `  ⚠️ Late: ${best.late} days\n` +
      `  ⏱️ Total Hours: **${Math.round(best.totalH * 100) / 100}h**\n` +
      `  📅 Total Days: ${best.days}`;
  }

  // --- PREDICTION (Individual) ---
  if (intent === 'PREDICTION') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    const recs = allRecords.filter(r => r.employeeId === effectiveTarget.id);
    if (recs.length < 3) return `Not enough data for ${employeeName}.`;
    return predictNextLate(effectiveTarget.id, allRecords, employeeName);
  }

  // --- ANOMALY DETECTION ---
  if (intent === 'ANOMALY') {
    if (!isAdmin) return '❌ Admin ke liye yeh feature hai.';
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    const recs = allRecords.filter(r => r.employeeId === effectiveTarget.id);
    if (recs.length < 5) return `Not enough data for ${employeeName}.`;
    return detectAnomalies(effectiveTarget.id, allRecords, employeeName);
  }

  // --- EXPORT ---
  if (intent === 'EXPORT') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    const recs = filterByDate(allRecords, effectiveTarget.id);
    if (recs.length === 0) return `No records found for ${employeeName}.`;
    return `📄 **Export Report — ${employeeName}**\n\n` +
      `  📅 Total Days: ${recs.length}\n` +
      `  ⏱️ Total Hours: ${Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 100) / 100}h\n` +
      `  ✅ Present: ${recs.filter(r => ['present', 'late'].includes(r.status)).length}\n` +
      `  ⚠️ Late: ${recs.filter(r => r.status === 'late').length}\n` +
      `  ❌ Absent: ${recs.filter(r => r.status === 'absent').length}\n` +
      `  🏠 WFH: ${recs.filter(r => r.status === 'work-from-home').length}\n\n` +
      `  📎 Export to PDF/Excel coming soon!`;
  }

  // --- EARLY / ON-TIME ---
  if (intent === 'EARLY_REPORT') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    let recs = filterByDate(allRecords, effectiveTarget.id);
    recs = recs.filter(r => r.status === 'present' && r.checkIn);
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `✅ ${employeeName} — ${label} mein koi on-time record nahi.`;

    const sorted = recs.filter(r => r.checkIn).sort((a, b) => {
      const tA = new Date(a.checkIn!).getHours() * 60 + new Date(a.checkIn!).getMinutes();
      const tB = new Date(b.checkIn!).getHours() * 60 + new Date(b.checkIn!).getMinutes();
      return tA - tB;
    });

    const top = sorted.slice(0, 10);
    const result = `✅ **${employeeName} — On-Time Days (${label})**\n\nTotal: **${recs.length} days**\n\n` +
      top.map(r => `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`).join('\n') +
      (sorted.length > 10 ? `\n  ... and ${sorted.length - 10} more` : '');
    return result;
  }

  // --- LATE REPORT ---
  if (intent === 'LATE_REPORT') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    let recs = filterByDate(allRecords, effectiveTarget.id);
    recs = recs.filter(r => r.status === 'late');
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `✅ ${employeeName} — ${label} mein koi late entry nahi!`;

    const result = `⚠️ **${employeeName} — Late Days (${label})**\n\nTotal: **${recs.length} days**\n\n` +
      recs.map(r => `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`).join('\n');
    return result;
  }

  // --- ABSENT REPORT ---
  if (intent === 'ABSENT_REPORT') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    let recs = filterByDate(allRecords, effectiveTarget.id);
    recs = recs.filter(r => r.status === 'absent');
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `✅ ${employeeName} — ${label} mein koi absent nahi!`;

    const result = `❌ **${employeeName} — Absent (${label})**\n\nTotal: **${recs.length} days**\n\n` +
      recs.map(r => `  • ${fmtDate(r.date)}`).join('\n');
    return result;
  }

  // --- WFH REPORT ---
  if (intent === 'WFH_REPORT') {
    const wfhRecs = allRecords.filter(r => r.status === 'work-from-home');
    
    if (effectiveTarget) {
      const ew = wfhRecs.filter(r => r.employeeId === effectiveTarget.id);
      if (ew.length === 0) return `${employeeName} ne koi WFH nahi li.`;
      return `🏠 **${employeeName} — WFH Days**\n\nTotal: **${ew.length} days**\n\n` +
        ew.map(r => `  • ${fmtDate(r.date)}`).join('\n');
    }

    if (!isAdmin) {
      const c = wfhRecs.filter(r => r.employeeId === askingEmployeeId).length;
      return `🏠 Aapne **${c}** WFH days liye hain.`;
    }

    const byE = EMPS.map(e => ({ 
      name: e.name, 
      c: wfhRecs.filter(r => r.employeeId === e.id).length 
    })).filter(e => e.c > 0);

    if (byE.length === 0) return '🏠 Kisi ne WFH nahi li.';
    
    return `🏠 **WFH Report**\n\n${byE.map(e => `  • ${e.name}: **${e.c} days**`).join('\n')}`;
  }

  // --- OT REPORT ---
  if (intent === 'OT_REPORT') {
    if (!showOT) return '❌ Overtime dekhne ki permission nahi hai.';
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (effectiveTarget) {
      const t = getEmployeeTiming(effectiveTarget.id);
      let recs = filterByDate(allRecords, effectiveTarget.id);
      recs = recs.filter(r => r.totalHours > t.minHoursForFullDay);
      if (recs.length === 0) return `${employeeName} ka koi overtime nahi (${label}).`;

      const totalOT = Math.round(recs.reduce((s, r) => s + (r.totalHours - t.minHoursForFullDay), 0) * 100) / 100;
      let res = `⏱️ **${employeeName} — Overtime (${label})**\n\nTotal OT: **${totalOT}h**\nOT Days: **${recs.length}**\nDuty: **${t.minHoursForFullDay}h/day**\n\n`;
      recs.forEach(r => {
        const ot = Math.round((r.totalHours - t.minHoursForFullDay) * 100) / 100;
        res += `  • ${fmtShortDate(r.date)} — ${r.totalHours}h — **+${ot}h OT** — ${getLocationFromIP(r.ipAddress)}\n`;
      });
      return res;
    }

    if (isAdmin) {
      const range = dateRange || { start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), label: 'This Month' };
      const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);
      const employees = getAttendanceEmployees();
      const withOT = employees.map(e => {
        const t = getEmployeeTiming(e.id);
        const er = recs.filter(r => r.employeeId === e.id && r.totalHours > t.minHoursForFullDay);
        const total = er.reduce((s, r) => s + (r.totalHours - t.minHoursForFullDay), 0);
        return { name: e.name, totalOT: Math.round(total * 100) / 100, days: er.length };
      }).filter(e => e.totalOT > 0);

      if (withOT.length === 0) return `Kisi ka overtime nahi (${range.label}).`;
      
      return `⏱️ **Team OT (${range.label})**\n\n${withOT.map(s => `  • **${s.name}** — +${s.totalOT}h OT (${s.days} days)`).join('\n')}\n\nTotal: **${Math.round(withOT.reduce((a, b) => a + b.totalOT, 0) * 100) / 100}h**`;
    }
  }

  // --- LOCATION REPORT ---
  if (intent === 'LOCATION_REPORT') {
    const today = new Date().toISOString().split('T')[0];
    const recs = allRecords.filter(r => r.date === today && r.checkIn);
    if (recs.length === 0) return '📍 Aaj abhi tak kisi ne check-in nahi kia.';
    
    return `📍 **Today's Locations**\n\n${recs.map(r => {
      const e = EMPS.find(x => x.id === r.employeeId);
      return `  • ${e?.name || 'Unknown'} — **${getLocationFromIP(r.ipAddress)}** — ${fmtTime(r.checkIn)}`;
    }).join('\n')}`;
  }

  // --- HOURS / WORK ---
  if (intent === 'HOURS_REPORT') {
    if (!effectiveTarget) return 'Kisi employee ka naam likhein.';
    let recs = filterByDate(allRecords, effectiveTarget.id);
    recs = recs.filter(r => r.totalHours > 0);
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `${employeeName} ka koi working hours record nahi (${label}).`;

    const total = Math.round(recs.reduce((s, r) => s + r.totalHours, 0) * 100) / 100;
    const avg = recs.length > 0 ? Math.round((total / recs.length) * 100) / 100 : 0;

    let res = `📊 **${employeeName} — Working Hours (${label})**\n\n⏱️ Total: **${total}h**\n📅 Days: **${recs.length}**\n⏰ Avg/Day: **${avg}h**\n\nRecent:\n`;
    const recent = recs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    recent.forEach(r => {
      res += `  • ${fmtShortDate(r.date)} — ${r.totalHours}h — ${fmtTime(r.checkIn)} to ${fmtTime(r.checkOut)} — ${getLocationFromIP(r.ipAddress)}\n`;
    });
    return res;
  }

  // --- ATTENDANCE SUMMARY (DEFAULT) ---
  if (effectiveTarget) {
    let recs = filterByDate(allRecords, effectiveTarget.id);
    let label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    const present = recs.filter(r => ['present', 'late'].includes(r.status)).length;
    const late = recs.filter(r => r.status === 'late').length;
    const absent = recs.filter(r => r.status === 'absent').length;
    const halfDay = recs.filter(r => r.status === 'half-day').length;
    const wfh = recs.filter(r => r.status === 'work-from-home').length;
    const totalH = Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 100) / 100;
    const worked = present + halfDay + wfh;
    const avgH = worked > 0 ? Math.round((totalH / worked) * 100) / 100 : 0;

    let res = `📊 **${employeeName} — ${label}**\n\n`;
    res += `  ✅ Present: **${present}** days\n`;
    if (late > 0) res += `  ⚠️ Late: **${late}** days\n`;
    if (absent > 0) res += `  ❌ Absent: **${absent}** days\n`;
    if (halfDay > 0) res += `  📋 Half Day: **${halfDay}**\n`;
    if (wfh > 0) res += `  🏠 WFH: **${wfh}**\n`;
    res += `  ⏱️ Total Hours: **${totalH}h**\n`;
    res += `  ⏰ Avg/Day: **${avgH}h**\n`;
    if (present > 0) res += `  🎯 On-Time: **${Math.round(((present - late) / present) * 100)}%**\n`;

    if (showOT && recs.length > 0) {
      const t = getEmployeeTiming(effectiveTarget.id);
      const otRecs = recs.filter(r => r.totalHours > t.minHoursForFullDay);
      const totalOT = Math.round(otRecs.reduce((s, r) => s + (r.totalHours - t.minHoursForFullDay), 0) * 100) / 100;
      if (totalOT > 0) res += `  💪 Overtime: **+${totalOT}h**\n`;
    }

    // Late details
    const lateDays = recs.filter(r => r.status === 'late');
    if (lateDays.length > 0 && lateDays.length <= 10) {
      res += `\n⚠️ Late Days:\n${lateDays.map(r => `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)}`).join('\n')}`;
    }

    // Absent details
    const absDays = recs.filter(r => r.status === 'absent');
    if (absDays.length > 0 && absDays.length <= 10) {
      res += `\n\n❌ Absent Days:\n${absDays.map(r => `  • ${fmtDate(r.date)}`).join('\n')}`;
    }

    return res;
  }

  // --- NON-ADMIN FALLBACK ---
  if (!isAdmin) {
    const me = EMPS.find(e => e.id === askingEmployeeId);
    const s = generateEmployeeSummary(askingEmployeeId, allRecords, dYear, dMonth);
    const label = dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'This Month';
    return `📊 **${me?.name} — ${label}**\n\n  ✅ Present: **${s.presentDays}**\n  ⚠️ Late: **${s.lateDays}**\n  ❌ Absent: **${s.absentDays}**\n  ⏱️ Hours: **${s.totalHours}h**\n  🎯 On-Time: **${s.onTimePercentage}%**`;
  }

  // --- ADMIN TEAM SUMMARY (If no specific query matched) ---
  if (isAdmin && (q.includes('sab') || q.includes('team') || q.includes('everyone') || q.includes('all') || q.includes('summary'))) {
    const range = dateRange || { start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd'), label: 'This Month' };
    const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);
    const employees = getAttendanceEmployees();
    
    let res = `📊 **Team Summary — ${range.label}**\n\n`;
    employees.forEach(emp => {
      const er = recs.filter(r => r.employeeId === emp.id);
      const present = er.filter(r => ['present', 'late'].includes(r.status)).length;
      const late = er.filter(r => r.status === 'late').length;
      const absent = er.filter(r => r.status === 'absent').length;
      const totalH = er.reduce((s, r) => s + (r.totalHours || 0), 0);
      const onTime = present > 0 ? Math.round(((present - late) / present) * 100) : 0;
      res += `**${emp.name}** — ✅${present} ⚠️${late} ❌${absent} — ${Math.round(totalH * 100) / 100}h — 🎯${onTime}%\n`;
    });
    return res;
  }

  // --- DEFAULT HELP ---
  return `🤖 **Attendify AI — Yeh pooch sakte hain:**\n\n` +
    `  👤 "Ishtiaq ki attendance dikhao"\n` +
    `  ⚠️ "Hamza kis din late aaya?"\n` +
    `  ❌ "Aaj kaun absent hai?"\n` +
    `  ⏱️ "Sohail ne kitne ghante kaam kia?"\n` +
    `  💪 "Overtime report"\n` +
    `  🏠 "WFH report"\n` +
    `  📍 "Aaj kaun kahan hai?"\n` +
    `  🔮 "Predict karo agla late kab hoga"\n` +
    `  📊 "Team benchmarking karo"\n\n` +
    `  Urdu + English dono chalte hain!`;
}

// =============================================
// 9. SUMMARY GENERATOR (Existing)
// =============================================

export function generateEmployeeSummary(employeeId: string, records: AttendanceRecord[], year?: number, month?: number): EmployeeSummary {
  const emp = getEmployees().find(e => e.id === employeeId);
  let filtered = records.filter(r => r.employeeId === employeeId);
  if (year && month) {
    const pfx = `${year}-${String(month).padStart(2, '0')}`;
    filtered = filtered.filter(r => r.date.startsWith(pfx));
  }

  const presentDays = filtered.filter(r => ['present', 'late', 'half-day', 'work-from-home'].includes(r.status)).length;
  const absentDays = filtered.filter(r => r.status === 'absent').length;
  const lateDays = filtered.filter(r => r.status === 'late').length;
  const wfhDays = filtered.filter(r => r.status === 'work-from-home').length;
  const totalHours = filtered.reduce((s, r) => s + (r.totalHours || 0), 0);
  const lateDates = filtered.filter(r => r.status === 'late').map(r => r.date);
  const absentDates = filtered.filter(r => r.status === 'absent').map(r => r.date);

  let totalWorkingDays = presentDays + absentDays;
  if (year && month) {
    const s = startOfMonth(new Date(year, month - 1));
    const e = endOfMonth(new Date(year, month - 1));
    totalWorkingDays = eachDayOfInterval({ start: s, end: e }).filter(d => !isWeekend(d)).length;
  }

  const timing = getEmployeeTiming(employeeId);
  let totalOT = 0;
  filtered.forEach(r => {
    if (r.totalHours > timing.minHoursForFullDay) totalOT += r.totalHours - timing.minHoursForFullDay;
  });
  totalOT = Math.round(totalOT * 100) / 100;

  return {
    employeeId,
    employeeName: emp?.name || 'Unknown',
    totalDays: totalWorkingDays || filtered.length,
    presentDays,
    absentDays,
    lateDays,
    wfhDays,
    totalHours: Math.round(totalHours * 100) / 100,
    avgHoursPerDay: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0,
    lateDates,
    absentDates,
    onTimePercentage: presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 0,
    totalOT,
  };
}
