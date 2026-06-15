import { getEmployees, getAttendanceEmployees, getLocationFromIP, getEmployeeTiming, canSeeOT } from './store';
import { AttendanceRecord, EmployeeSummary } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

// ========== SUMMARY GENERATOR ==========
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

// ========== HELPERS ==========
function getDateRange(q: string): { start: string; end: string; label: string } | null {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');

  // Today
  if (q.includes('today') || q.includes('aaj') || q.includes('aj'))
    return { start: today, end: today, label: 'Today' };

  // Yesterday
  if (q.includes('yesterday') || q.includes('kal') || q.includes('guzishta'))
    { const d = format(subDays(now, 1), 'yyyy-MM-dd'); return { start: d, end: d, label: 'Yesterday' }; }

  // Last week / pichle hafte
  if (q.includes('last week') || q.includes('pichle hafte') || q.includes('pichlay haftey') || q.includes('pichle haftey')) {
    const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start: lastWeekStart, end: lastWeekEnd, label: 'Last Week' };
  }

  // This week / is hafte
  if (q.includes('this week') || q.includes('is hafte') || q.includes('is haftey')) {
    const thisWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return { start: thisWeekStart, end: today, label: 'This Week' };
  }

  // Last 7 days
  if (q.includes('7 din') || q.includes('7 days'))
    return { start: format(subDays(now, 7), 'yyyy-MM-dd'), end: today, label: 'Last 7 Days' };

  return null;
}

function detectMonthYear(q: string): { month?: number; year: number } {
  const months: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
    may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
    september: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  };
  let month: number | undefined;
  let year = new Date().getFullYear();
  for (const [name, num] of Object.entries(months)) {
    if (q.includes(name)) { month = num; break; }
  }
  const ym = q.match(/20\d{2}/);
  if (ym) year = parseInt(ym[0]);
  if (q.includes('this month') || q.includes('is mahine') || q.includes('is mahinay')) month = new Date().getMonth() + 1;
  if (q.includes('last month') || q.includes('pichle mahine') || q.includes('pichlay mahinay'))
    { const d = new Date(); d.setMonth(d.getMonth() - 1); month = d.getMonth() + 1; year = d.getFullYear(); }
  return { month, year };
}

function filterByRange(records: AttendanceRecord[], empId: string, start: string, end: string): AttendanceRecord[] {
  return records.filter(r => r.employeeId === empId && r.date >= start && r.date <= end);
}

function fmtDate(d: string): string { return format(parseISO(d), 'dd MMM yyyy (EEEE)'); }
function fmtTime(iso: string | null): string { return iso ? format(parseISO(iso), 'hh:mm a') : '—'; }

// ========== MAIN AI QUERY ==========
export function processAIQuery(query: string, allRecords: AttendanceRecord[], askingEmployeeId: string, isAdmin: boolean): string {
  const showOT = canSeeOT(askingEmployeeId);
  const q = query.toLowerCase().trim();
  const EMPS = getEmployees();

  // Find target employee
  const targetEmployee = EMPS.find(emp => {
    const parts = emp.name.toLowerCase().split(' ');
    return parts.some(p => p.length > 2 && q.includes(p)) || q.includes(emp.name.toLowerCase());
  });

  // Block non-admin from seeing others
  if (!isAdmin && targetEmployee && targetEmployee.id !== askingEmployeeId) {
    return 'Aap sirf apni details dekh saktey hain. Kisi aur ki information available nahi hai.';
  }

  const effectiveTarget = isAdmin ? targetEmployee : EMPS.find(e => e.id === askingEmployeeId);
  const { month: dMonth, year: dYear } = detectMonthYear(q);
  const dateRange = getDateRange(q);

  // ========== EARLY CHECK-IN / JALDI ==========
  if (effectiveTarget && (q.includes('jaldi') || q.includes('early') || q.includes('on time') || q.includes('ontime') || q.includes('time pe'))) {
    let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id && r.status === 'present');
    if (dateRange) recs = recs.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
    else if (dMonth) { const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`; recs = recs.filter(r => r.date.startsWith(pfx)); }
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `${effectiveTarget.name} ka koi on-time record nahi mila (${label}).`;

    // Sort by check-in time (earliest first)
    const sorted = recs.filter(r => r.checkIn).sort((a, b) => {
      const tA = new Date(a.checkIn!).getHours() * 60 + new Date(a.checkIn!).getMinutes();
      const tB = new Date(b.checkIn!).getHours() * 60 + new Date(b.checkIn!).getMinutes();
      return tA - tB;
    });

    const lines = sorted.slice(0, 10).map(r =>
      `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`
    );

    return `✅ **${effectiveTarget.name} — On-Time Days (${label}):**\n\nTotal: **${recs.length} days**\n\n${lines.join('\n')}${sorted.length > 10 ? `\n  ... and ${sorted.length - 10} more` : ''}`;
  }

  // ========== LATE QUERY ==========
  if (effectiveTarget && (q.includes('late') || q.includes('der') || q.includes('dair') || q.includes('deri'))) {
    let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id && r.status === 'late');
    if (dateRange) recs = recs.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
    else if (dMonth) { const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`; recs = recs.filter(r => r.date.startsWith(pfx)); }
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `✅ ${effectiveTarget.name} — ${label} mein koi late entry nahi!`;

    const lines = recs.map(r =>
      `  • ${fmtDate(r.date)} — Check-in: ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`
    );

    return `⚠️ **${effectiveTarget.name} — Late Days (${label}):**\n\nTotal Late: **${recs.length} days**\n\n${lines.join('\n')}`;
  }

  // ========== ABSENT ==========
  if (effectiveTarget && (q.includes('absent') || q.includes('chutti') || q.includes('chhutti') || q.includes('leave') || q.includes('nahi aaya') || q.includes('nhi aya'))) {
    let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id && r.status === 'absent');
    if (dateRange) recs = recs.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
    else if (dMonth) { const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`; recs = recs.filter(r => r.date.startsWith(pfx)); }
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    if (recs.length === 0) return `✅ ${effectiveTarget.name} — ${label} mein ek bhi absent nahi!`;

    return `❌ **${effectiveTarget.name} — Absent (${label}):**\n\nTotal: **${recs.length} days**\n\n${recs.map(r => `  • ${fmtDate(r.date)}`).join('\n')}`;
  }

  // ========== HOURS / KAAM ==========
  if (effectiveTarget && (q.includes('hour') || q.includes('ghant') || q.includes('kitne') || q.includes('kaam') || q.includes('work') || q.includes('kam'))) {
    let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id && r.totalHours > 0);
    if (dateRange) recs = recs.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
    else if (dMonth) { const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`; recs = recs.filter(r => r.date.startsWith(pfx)); }
    const label = dateRange?.label || (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

    const total = Math.round(recs.reduce((s, r) => s + r.totalHours, 0) * 100) / 100;
    const avg = recs.length > 0 ? Math.round((total / recs.length) * 100) / 100 : 0;

    let res = `📊 **${effectiveTarget.name} — Working Hours (${label}):**\n\n`;
    res += `⏱️ Total Hours: **${total}h**\n`;
    res += `📅 Days Worked: **${recs.length}**\n`;
    res += `⏰ Average/Day: **${avg}h**\n`;

    // Day-by-day breakdown (last 10)
    const recent = recs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    if (recent.length > 0) {
      res += `\nRecent:\n`;
      recent.forEach(r => {
        res += `  • ${format(parseISO(r.date), 'dd MMM (EEE)')} — ${r.totalHours}h — ${fmtTime(r.checkIn)} to ${fmtTime(r.checkOut)} — ${getLocationFromIP(r.ipAddress)}\n`;
      });
    }
    return res;
  }

  // ========== OT / OVERTIME ==========
  if ((q.includes('ot') || q.includes('overtime') || q.includes('extra')) && showOT) {
    const label = dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time';

    if (effectiveTarget) {
      const t = getEmployeeTiming(effectiveTarget.id);
      let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id && r.totalHours > t.minHoursForFullDay);
      if (dMonth) { const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`; recs = recs.filter(r => r.date.startsWith(pfx)); }

      if (recs.length === 0) return `${effectiveTarget.name} ka koi overtime nahi (${label}).`;

      const totalOT = Math.round(recs.reduce((s, r) => s + (r.totalHours - t.minHoursForFullDay), 0) * 100) / 100;

      let res = `⏱️ **${effectiveTarget.name} — Overtime (${label}):**\n\nTotal OT: **${totalOT}h**\nOT Days: **${recs.length}**\nDuty: **${t.minHoursForFullDay}h/day**\n\n`;
      recs.forEach(r => {
        const ot = Math.round((r.totalHours - t.minHoursForFullDay) * 100) / 100;
        res += `  • ${format(parseISO(r.date), 'dd MMM (EEE)')} — ${r.totalHours}h — **+${ot}h OT** — ${getLocationFromIP(r.ipAddress)}\n`;
      });
      return res;
    }

    if (isAdmin) {
      const sums = getAttendanceEmployees().map(e => generateEmployeeSummary(e.id, allRecords, dYear, dMonth));
      const withOT = sums.filter(s => s.totalOT > 0);
      if (withOT.length === 0) return `Kisi ka overtime nahi (${label}).`;
      return `⏱️ **Team OT (${label}):**\n\n${withOT.map(s => `  • **${s.employeeName}** — +${s.totalOT}h OT`).join('\n')}\n\nTotal: **${Math.round(withOT.reduce((a, b) => a + b.totalOT, 0) * 100) / 100}h**`;
    }
  }

  // ========== LOCATION ==========
  if (q.includes('location') || q.includes('kahan') || q.includes('kidhar') || q.includes('zone') || q.includes('qc center')) {
    const today = new Date().toISOString().split('T')[0];
    const recs = allRecords.filter(r => r.date === today);
    if (recs.length === 0) return 'Aaj abhi tak kisi ne check-in nahi kia.';
    return `📍 **Today's Locations:**\n\n${recs.map(r => `  • ${EMPS.find(e => e.id === r.employeeId)?.name} — **${getLocationFromIP(r.ipAddress)}** — ${fmtTime(r.checkIn)}`).join('\n')}`;
  }

  // ========== WFH ==========
  if (q.includes('wfh') || q.includes('work from home') || q.includes('ghar se') || q.includes('ghar sey')) {
    const wfhRecs = allRecords.filter(r => r.status === 'work-from-home');
    if (effectiveTarget) {
      const ew = wfhRecs.filter(r => r.employeeId === effectiveTarget.id);
      if (ew.length === 0) return `${effectiveTarget.name} ne koi WFH nahi li.`;
      return `🏠 **${effectiveTarget.name} — WFH:**\n\nTotal: **${ew.length} days**\n\n${ew.map(r => `  • ${fmtDate(r.date)}`).join('\n')}`;
    }
    if (!isAdmin) { const c = wfhRecs.filter(r => r.employeeId === askingEmployeeId).length; return `Aapne **${c}** WFH days liye hain.`; }
    const byE = EMPS.map(e => ({ name: e.name, c: wfhRecs.filter(r => r.employeeId === e.id).length })).filter(e => e.c > 0);
    return byE.length === 0 ? 'Kisi ne WFH nahi li.' : `🏠 **WFH Report:**\n\n${byE.map(e => `  • ${e.name}: **${e.c} days**`).join('\n')}`;
  }

  // ========== TODAY ==========
  if (q.includes('today') || q.includes('aaj') || q.includes('aj')) {
    const today = new Date().toISOString().split('T')[0];
    const recs = allRecords.filter(r => r.date === today);

    if (!isAdmin) {
      const my = recs.find(r => r.employeeId === askingEmployeeId);
      if (!my) return 'Aaj aapne abhi check-in nahi kia.';
      return `📋 **Today:**\n\n  Status: **${my.status.toUpperCase()}**\n  Location: **${getLocationFromIP(my.ipAddress)}**\n  Check-in: **${fmtTime(my.checkIn)}**\n  Hours: **${my.totalHours}h**`;
    }

    if (q.includes('late')) {
      const late = recs.filter(r => r.status === 'late');
      if (late.length === 0) return '✅ Aaj koi late nahi aaya!';
      return `⚠️ **Late Today (${late.length}):**\n\n${late.map(r => `  • ${EMPS.find(e => e.id === r.employeeId)?.name} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`).join('\n')}`;
    }
    if (q.includes('absent') || q.includes('nahi aaya') || q.includes('nhi aya')) {
      const ids = recs.map(r => r.employeeId);
      const abs = getAttendanceEmployees().filter(e => !ids.includes(e.id));
      if (abs.length === 0) return '✅ Aaj sab present hain!';
      return `❌ **Absent Today (${abs.length}):**\n\n${abs.map(e => `  • ${e.name}`).join('\n')}`;
    }
    if (recs.length === 0) return 'Aaj abhi tak kisi ne check-in nahi kia.';

    return `📋 **Today (${format(new Date(), 'dd MMM yyyy')}):**\n\n${recs.map(r => {
      const e = EMPS.find(x => x.id === r.employeeId);
      return `  • ${e?.name} — **${r.status.toUpperCase()}** — ${getLocationFromIP(r.ipAddress)} — ${fmtTime(r.checkIn)}${r.totalHours > 0 ? ` — ${r.totalHours}h` : ''}`;
    }).join('\n')}`;
  }

  // ========== SPECIFIC EMPLOYEE SUMMARY ==========
  if (effectiveTarget) {
    let recs = allRecords.filter(r => r.employeeId === effectiveTarget.id);
    let label = 'All Time';

    if (dateRange) {
      recs = recs.filter(r => r.date >= dateRange.start && r.date <= dateRange.end);
      label = dateRange.label;
    } else if (dMonth) {
      const pfx = `${dYear}-${String(dMonth).padStart(2, '0')}`;
      recs = recs.filter(r => r.date.startsWith(pfx));
      label = format(new Date(dYear, dMonth - 1), 'MMMM yyyy');
    }

    const present = recs.filter(r => r.status === 'present').length;
    const late = recs.filter(r => r.status === 'late').length;
    const absent = recs.filter(r => r.status === 'absent').length;
    const halfDay = recs.filter(r => r.status === 'half-day').length;
    const wfh = recs.filter(r => r.status === 'work-from-home').length;
    const totalH = Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 100) / 100;
    const worked = present + late + halfDay + wfh;
    const avgH = worked > 0 ? Math.round((totalH / worked) * 100) / 100 : 0;

    let res = `📊 **${effectiveTarget.name} — ${label}:**\n\n`;
    res += `  ✅ Present: **${present}** days\n`;
    if (late > 0) res += `  ⚠️ Late: **${late}** days\n`;
    if (absent > 0) res += `  ❌ Absent: **${absent}** days\n`;
    if (halfDay > 0) res += `  📋 Half Day: **${halfDay}** days\n`;
    if (wfh > 0) res += `  🏠 WFH: **${wfh}** days\n`;
    res += `  ⏱️ Total Hours: **${totalH}h**\n`;
    res += `  ⏰ Avg/Day: **${avgH}h**\n`;
    if (worked > 0) res += `  🎯 On-Time: **${Math.round(((worked - late) / worked) * 100)}%**\n`;

    if (showOT) {
      const t = getEmployeeTiming(effectiveTarget.id);
      const otRecs = recs.filter(r => r.totalHours > t.minHoursForFullDay);
      const totalOT = Math.round(otRecs.reduce((s, r) => s + (r.totalHours - t.minHoursForFullDay), 0) * 100) / 100;
      if (totalOT > 0) res += `  💪 Overtime: **+${totalOT}h**\n`;
    }

    // Late details
    const lateDays = recs.filter(r => r.status === 'late');
    if (lateDays.length > 0 && lateDays.length <= 10) {
      res += `\nLate Days:\n`;
      lateDays.forEach(r => { res += `  • ${format(parseISO(r.date), 'dd MMM (EEE)')} — ${fmtTime(r.checkIn)}\n`; });
    }

    // Absent details
    const absDays = recs.filter(r => r.status === 'absent');
    if (absDays.length > 0 && absDays.length <= 10) {
      res += `\nAbsent Days:\n`;
      absDays.forEach(r => { res += `  • ${format(parseISO(r.date), 'dd MMM (EEE)')}\n`; });
    }

    return res;
  }

  // ========== ALL / TEAM SUMMARY ==========
  if (isAdmin && (q.includes('all') || q.includes('sab') || q.includes('everyone') || q.includes('sabki') || q.includes('team') || q.includes('summary') || q.includes('summery') || q.includes('smmary'))) {
    const label = dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time';
    let res = `📊 **Team Summary (${label}):**\n\n`;

    getAttendanceEmployees().forEach(emp => {
      const s = generateEmployeeSummary(emp.id, allRecords, dYear, dMonth);
      res += `**${emp.name}**\n`;
      res += `  ✅ Present: ${s.presentDays} | ⚠️ Late: ${s.lateDays} | ❌ Absent: ${s.absentDays}\n`;
      res += `  ⏱️ Hours: ${s.totalHours}h | Avg: ${s.avgHoursPerDay}h/day | 🎯 ${s.onTimePercentage}%\n`;
      if (showOT && s.totalOT > 0) res += `  💪 OT: +${s.totalOT}h\n`;
      res += `\n`;
    });

    return res;
  }

  // ========== BEST PERFORMER ==========
  if (isAdmin && (q.includes('best') || q.includes('top') || q.includes('behtareen') || q.includes('acha'))) {
    const sums = getAttendanceEmployees().map(e => generateEmployeeSummary(e.id, allRecords, dYear, dMonth));
    const best = sums.sort((a, b) => b.onTimePercentage - a.onTimePercentage)[0];
    if (!best) return 'Abhi data nahi hai.';
    return `🏆 **Best Performer: ${best.employeeName}**\n\n  🎯 On-Time: **${best.onTimePercentage}%**\n  ⏱️ Hours: **${best.totalHours}h**\n  ✅ Present: **${best.presentDays}**\n  ⚠️ Late: **${best.lateDays}**`;
  }

  // ========== NON-ADMIN FALLBACK: Show own summary ==========
  if (!isAdmin) {
    const me = EMPS.find(e => e.id === askingEmployeeId);
    const s = generateEmployeeSummary(askingEmployeeId, allRecords, dYear, dMonth);
    const label = dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'This Month';
    return `📊 **${me?.name} — ${label}:**\n\n  ✅ Present: **${s.presentDays}**\n  ⚠️ Late: **${s.lateDays}**\n  ❌ Absent: **${s.absentDays}**\n  ⏱️ Hours: **${s.totalHours}h**\n  🎯 On-Time: **${s.onTimePercentage}%**`;
  }

  // ========== HELP ==========
  return `🤖 **Attendify AI — Yeh pooch saktey hain:**\n\n` +
    `  • "Ishtiaq pichle hafte kis din late aaya?"\n` +
    `  • "Hamza ne is mahine kitne ghante kaam kia?"\n` +
    `  • "Behzad kis din jaldi aaya?"\n` +
    `  • "Aaj kaun absent hai?"\n` +
    `  • "Sabki summary dikhao"\n` +
    `  • "Sohail ki last week ki report"\n` +
    `  • "Aaj kaun kahan hai?"\n` +
    `  • "Overtime report"\n` +
    `  • "WFH report"\n\n` +
    `  Urdu + English dono chalti hai!`;
}
