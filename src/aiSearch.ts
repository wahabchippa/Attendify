// src/aiSearch.ts

import {
  getEmployees, getAttendanceEmployees, getLocationFromIP,
  getEmployeeTiming, canSeeOT
} from './store';
import { AttendanceRecord, EmployeeSummary } from './types';
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, isWeekend, subDays,
  startOfWeek, endOfWeek, subWeeks
} from 'date-fns';

// =============================================
// 1. INTENT CLASSIFICATION
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

  if (q.includes('help') || q.includes('madad') || q.includes('kya pooch') || q.includes('guide'))
    return 'HELP';

  if (q.includes('ot') || q.includes('overtime') || q.includes('extra') || q.includes('additional'))
    return 'OT_REPORT';

  if (q.includes('late') || q.includes('der') || q.includes('dair') || q.includes('deri') || q.includes('tard') || q.includes('time par nahi'))
    return 'LATE_REPORT';

  if (q.includes('absent') || q.includes('chutti') || q.includes('leave') || q.includes('nahi aaya') || q.includes('nhi aya') || q.includes('gayab'))
    return 'ABSENT_REPORT';

  if (q.includes('early') || q.includes('jaldi') || q.includes('ontime') || q.includes('on time') || q.includes('time se pehle'))
    return 'EARLY_REPORT';

  if (q.includes('wfh') || q.includes('work from home') || q.includes('ghar se') || q.includes('home'))
    return 'WFH_REPORT';

  if (q.includes('location') || q.includes('kahan') || q.includes('kidhar') || q.includes('zone') || q.includes('center'))
    return 'LOCATION_REPORT';

  if (q.includes('best') || q.includes('top') || q.includes('behtareen') || q.includes('number one') || q.includes('topper'))
    return 'BEST_PERFORMER';

  if (q.includes('predict') || q.includes('forecast') || q.includes('future') || q.includes('next') || q.includes('warn') || q.includes('agla'))
    return 'PREDICTION';

  if (q.includes('anomaly') || q.includes('fraud') || q.includes('alert') || q.includes('suspicious') || q.includes('shak'))
    return 'ANOMALY';

  if (q.includes('export') || q.includes('pdf') || q.includes('excel') || q.includes('download') || q.includes('print'))
    return 'EXPORT';

  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('performance'))
    return 'COMPARISON';

  if (q.includes('team') || q.includes('sab') || q.includes('everyone') || q.includes('all') || q.includes('sabki') || q.includes('sabka'))
    return 'TEAM_SUMMARY';

  if (q.includes('hour') || q.includes('ghant') || q.includes('kitne') || q.includes('kaam') || q.includes('work') || q.includes('time'))
    return 'HOURS_REPORT';

  if (q.includes('summary') || q.includes('report') || q.includes('present') || q.includes('attendance'))
    return 'ATTENDANCE_SUMMARY';

  return 'ATTENDANCE_SUMMARY';
}

// =============================================
// 2. FUZZY SEARCH
// =============================================

function fuzzySearch(query: string, target: string): boolean {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (t.includes(q) || q.includes(t)) return true;

  const qWords = q.split(' ');
  const tWords = t.split(' ');

  for (const qw of qWords) {
    for (const tw of tWords) {
      if (qw.length >= 2 && tw.length >= 2) {
        if (tw.includes(qw) || qw.includes(tw)) return true;
        if (levenshtein(qw, tw) <= 2) return true;
      }
    }
  }
  return false;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, (_, i) =>
    Array.from({ length: a.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

// =============================================
// 3. DATE HANDLING
// =============================================

interface DateRange {
  start: string;
  end: string;
  label: string;
}

function detectDateRange(query: string): DateRange | null {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const q = query.toLowerCase();

  const checks: Array<{ keywords: string[]; getRange: () => DateRange }> = [
    {
      keywords: ['today', 'aaj', 'aj'],
      getRange: () => ({ start: today, end: today, label: 'Today' }),
    },
    {
      keywords: ['yesterday', 'kal'],
      getRange: () => {
        const d = format(subDays(now, 1), 'yyyy-MM-dd');
        return { start: d, end: d, label: 'Yesterday' };
      },
    },
    {
      keywords: ['this week', 'is hafte', 'is haftey'],
      getRange: () => ({
        start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: today,
        label: 'This Week',
      }),
    },
    {
      keywords: ['last week', 'pichle hafte', 'pichlay haftey'],
      getRange: () => ({
        start: format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        label: 'Last Week',
      }),
    },
    {
      keywords: ['7 din', '7 days', 'last 7'],
      getRange: () => ({ start: format(subDays(now, 7), 'yyyy-MM-dd'), end: today, label: 'Last 7 Days' }),
    },
    {
      keywords: ['15 din', '15 days'],
      getRange: () => ({ start: format(subDays(now, 15), 'yyyy-MM-dd'), end: today, label: 'Last 15 Days' }),
    },
    {
      keywords: ['30 din', '30 days', 'last 30'],
      getRange: () => ({ start: format(subDays(now, 30), 'yyyy-MM-dd'), end: today, label: 'Last 30 Days' }),
    },
    {
      keywords: ['this month', 'is mahine', 'is mahinay', 'current month'],
      getRange: () => ({
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: today,
        label: 'This Month',
      }),
    },
    {
      keywords: ['last month', 'pichle mahine', 'pichlay mahinay', 'previous month'],
      getRange: () => {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return {
          start: format(startOfMonth(d), 'yyyy-MM-dd'),
          end: format(endOfMonth(d), 'yyyy-MM-dd'),
          label: 'Last Month',
        };
      },
    },
  ];

  for (const check of checks) {
    if (check.keywords.some(kw => q.includes(kw))) {
      return check.getRange();
    }
  }
  return null;
}

function detectMonthYear(query: string): { month?: number; year: number } {
  const q = query.toLowerCase();
  const months: Record<string, number> = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6,
    july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9,
    october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  };

  let month: number | undefined;
  for (const [name, num] of Object.entries(months)) {
    if (q.includes(name)) { month = num; break; }
  }

  const ym = q.match(/20\d{2}/);
  const year = ym ? parseInt(ym[0]) : new Date().getFullYear();
  return { month, year };
}

// =============================================
// 4. FORMAT HELPERS
// =============================================

function fmtDate(d: string): string {
  try { return format(parseISO(d), 'dd MMM yyyy (EEEE)'); } catch { return d; }
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'hh:mm a'); } catch { return '—'; }
}

function fmtShortDate(d: string): string {
  try { return format(parseISO(d), 'dd MMM (EEE)'); } catch { return d; }
}

function roundH(n: number): number {
  return Math.round(n * 100) / 100;
}

// =============================================
// 5. PREDICTIVE INSIGHTS
// =============================================

function predictNextLate(employeeId: string, records: AttendanceRecord[], employeeName: string): string {
  const recs = records
    .filter(r => r.employeeId === employeeId && r.status === 'late')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recs.length < 3) {
    return `📊 **${employeeName}'s Late Pattern:**\n\nNot enough data yet. ${recs.length} late days recorded.`;
  }

  const dayFreq: Record<string, number> = {};
  recs.forEach(r => {
    const day = format(parseISO(r.date), 'EEEE');
    dayFreq[day] = (dayFreq[day] || 0) + 1;
  });
  const mostLikelyDay = Object.keys(dayFreq).sort((a, b) => dayFreq[b] - dayFreq[a])[0];

  const times = recs
    .filter(r => r.checkIn)
    .map(r => {
      try {
        const d = new Date(r.checkIn!);
        return d.getHours() * 60 + d.getMinutes();
      } catch { return 0; }
    });

  const avgTime = times.length > 0
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;
  const avgHour = Math.floor(avgTime / 60);
  const avgMin = avgTime % 60;

  const recent = recs.slice(-5).map(r => fmtShortDate(r.date));

  return `🔮 **${employeeName} — Late Pattern Analysis**\n\n` +
    `  ⚠️ Most likely late on: **${mostLikelyDay}**\n` +
    `  ⏰ Average check-in: **${String(avgHour).padStart(2, '0')}:${String(avgMin).padStart(2, '0')}**\n` +
    `  📊 Total late days: **${recs.length}**\n` +
    `  📅 Recent: ${recent.join(', ')}\n\n` +
    `  💡 Tip: Leave **15 min earlier** on ${mostLikelyDay}!`;
}

// =============================================
// 6. TEAM BENCHMARKING
// =============================================

function teamBenchmarking(records: AttendanceRecord[], dateRange: DateRange): string {
  const employees = getAttendanceEmployees();

  const stats = employees.map(emp => {
    const recs = records.filter(r =>
      r.employeeId === emp.id &&
      r.date >= dateRange.start &&
      r.date <= dateRange.end
    );
    const totalH = roundH(recs.reduce((s, r) => s + (r.totalHours || 0), 0));
    const present = recs.filter(r => ['present', 'late'].includes(r.status)).length;
    const late    = recs.filter(r => r.status === 'late').length;
    const absent  = recs.filter(r => r.status === 'absent').length;
    const onTime  = present > 0 ? Math.round(((present - late) / present) * 100) : 0;
    return { name: emp.name, hours: totalH, days: present, late, absent, onTime };
  });

  const byHours  = [...stats].sort((a, b) => b.hours - a.hours);
  const byOnTime = [...stats].sort((a, b) => b.onTime - a.onTime);
  const byAbsent = [...stats].filter(s => s.absent > 0).sort((a, b) => b.absent - a.absent);

  const medals = ['🥇', '🥈', '🥉'];

  let res = `📊 **Team Benchmark — ${dateRange.label}**\n\n`;

  res += `🔥 **Most Hours Worked:**\n`;
  byHours.slice(0, 3).forEach((s, i) =>
    res += `  ${medals[i] || `${i + 1}.`} ${s.name} — **${s.hours}h** (${s.days} days)\n`
  );

  res += `\n🎯 **Best On-Time:**\n`;
  byOnTime.slice(0, 3).forEach((s, i) =>
    res += `  ${medals[i] || `${i + 1}.`} ${s.name} — **${s.onTime}%** (${s.days - s.late}/${s.days})\n`
  );

  if (byAbsent.length > 0) {
    res += `\n📉 **Most Absences:**\n`;
    byAbsent.slice(0, 3).forEach((s, i) =>
      res += `  ${i + 1}. ${s.name} — ${s.absent} absent\n`
    );
  }

  return res;
}

// =============================================
// 7. ANOMALY DETECTION
// =============================================

function detectAnomalies(employeeId: string, records: AttendanceRecord[], employeeName: string): string {
  const recs = records.filter(r => r.employeeId === employeeId);
  if (recs.length < 5) return `⚠️ Not enough data for ${employeeName}.`;

  const avgHours = recs.reduce((s, r) => s + (r.totalHours || 0), 0) / recs.length;
  const today = format(new Date(), 'yyyy-MM-dd');
  const anomalies: string[] = [];

  recs.slice(-10).forEach(r => {
    if (r.totalHours > 0 && r.totalHours < avgHours * 0.4) {
      anomalies.push(`⚠️ ${fmtShortDate(r.date)}: Only ${r.totalHours}h (avg: ${Math.round(avgHours)}h)`);
    }
    if (r.date === today && r.status === 'absent') {
      anomalies.push(`🔴 **Absent today!**`);
    }
    if (r.date === today && r.status === 'late') {
      anomalies.push(`🟡 **Late today!**`);
    }
    if (r.notes?.includes('OUTSIDE OFFICE')) {
      anomalies.push(`🚨 ${fmtShortDate(r.date)}: Checked out **Outside Office**`);
    }
  });

  if (anomalies.length === 0) {
    return `✅ **${employeeName}** — No anomalies detected. All good!`;
  }

  return `🚨 **${employeeName} — Anomaly Report:**\n\n${anomalies.map(a => `  ${a}`).join('\n')}`;
}

// =============================================
// 8. MAIN PROCESSOR
// =============================================

export function processAIQuery(
  query: string,
  allRecords: AttendanceRecord[],
  askingEmployeeId: string,
  isAdmin: boolean
): string {
  const intent = classifyIntent(query);
  const q = query.toLowerCase();
  const EMPS = getEmployees();
  const showOT = canSeeOT(askingEmployeeId);

  // ── Find target employee via fuzzy search ──
  let targetEmployee = EMPS.find(emp => fuzzySearch(q, emp.name));

  // Block non-admin from seeing others
  if (!isAdmin && targetEmployee && targetEmployee.id !== askingEmployeeId) {
    return '❌ Aap sirf apni details dekh saktey hain.';
  }

  const effectiveTarget = isAdmin
    ? (targetEmployee ?? undefined)
    : EMPS.find(e => e.id === askingEmployeeId);
  const employeeName = effectiveTarget?.name || 'Unknown';

  // ── Date range detection ──
  const dateRange = detectDateRange(q);
  const { month: dMonth, year: dYear } = detectMonthYear(q);

  // ── Default month range ──
  const defaultRange: DateRange = {
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
    label: 'This Month',
  };
  const defaultLast30: DateRange = {
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
    label: 'Last 30 Days',
  };

  // ── Filter records by employee + date ──
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

  const periodLabel = dateRange?.label
    ?? (dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'All Time');

  // ── HELP ──
  if (intent === 'HELP') {
    return `🤖 **Attendify AI — Guide**\n\n` +
      `  👤 **Personal:**\n` +
      `  • "Meri attendance dikhao"\n` +
      `  • "Maine kitne ghante kaam kia?"\n` +
      `  • "Mera overtime kya hai?"\n\n` +
      `  📋 **Reports:**\n` +
      `  • "Hamza kis din late aaya?"\n` +
      `  • "Sohail ne is mahine kitne WFH liye?"\n` +
      `  • "Ishtiaq ki last week ki summary"\n\n` +
      `  👥 **Admin Only:**\n` +
      `  • "Aaj kaun absent hai?"\n` +
      `  • "Sabki attendance dikhao"\n` +
      `  • "Best performer kaun hai?"\n` +
      `  • "Team benchmarking karo"\n\n` +
      `  🔮 **Advanced:**\n` +
      `  • "Predict karo agla late kab hoga"\n` +
      `  • "Anomaly report dikhao"\n\n` +
      `  Urdu + English dono chalte hain! ✅`;
  }

  // ── TEAM SUMMARY / BENCHMARKING ──
  if (intent === 'TEAM_SUMMARY' || intent === 'COMPARISON') {
    if (!isAdmin) return '❌ Yeh feature sirf admin ke liye hai.';
    const range = dateRange ?? defaultLast30;
    return teamBenchmarking(allRecords, range);
  }

  // ── BEST PERFORMER ──
  if (intent === 'BEST_PERFORMER') {
    if (!isAdmin) return '❌ Yeh feature sirf admin ke liye hai.';
    const range = dateRange ?? defaultRange;
    const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);

    const stats = getAttendanceEmployees().map(emp => {
      const er = recs.filter(r => r.employeeId === emp.id);
      const present = er.filter(r => ['present', 'late'].includes(r.status)).length;
      const late = er.filter(r => r.status === 'late').length;
      const totalH = roundH(er.reduce((s, r) => s + (r.totalHours || 0), 0));
      const onTime = present > 0 ? Math.round(((present - late) / present) * 100) : 0;
      return { name: emp.name, onTime, present, late, totalH, days: er.length };
    }).filter(s => s.days > 0);

    if (stats.length === 0) return `📊 **${range.label}** — No data available yet.`;

    const best = [...stats].sort((a, b) => b.onTime - a.onTime)[0];
    return `🏆 **Best Performer — ${range.label}**\n\n` +
      `  👤 **${best.name}**\n` +
      `  🎯 On-Time: **${best.onTime}%**\n` +
      `  ✅ Present: **${best.present}** days\n` +
      `  ⚠️ Late: **${best.late}** days\n` +
      `  ⏱️ Total Hours: **${best.totalH}h**`;
  }

  // ── PREDICTION ──
  if (intent === 'PREDICTION') {
    if (!effectiveTarget) return 'Employee ka naam likhein prediction ke liye.';
    return predictNextLate(effectiveTarget.id, allRecords, employeeName);
  }

  // ── ANOMALY ──
  if (intent === 'ANOMALY') {
    if (!isAdmin) return '❌ Yeh feature sirf admin ke liye hai.';
    if (!effectiveTarget) return 'Employee ka naam likhein anomaly check ke liye.';
    return detectAnomalies(effectiveTarget.id, allRecords, employeeName);
  }

  // ── EXPORT ──
  if (intent === 'EXPORT') {
    if (!effectiveTarget) return 'Employee ka naam likhein export ke liye.';
    const recs = filterByDate(allRecords, effectiveTarget.id);
    if (recs.length === 0) return `${employeeName} ke liye koi record nahi mila.`;
    const totalH = roundH(recs.reduce((s, r) => s + (r.totalHours || 0), 0));
    return `📄 **Export Summary — ${employeeName} (${periodLabel})**\n\n` +
      `  📅 Records: **${recs.length}**\n` +
      `  ⏱️ Total Hours: **${totalH}h**\n` +
      `  ✅ Present: **${recs.filter(r => ['present', 'late'].includes(r.status)).length}**\n` +
      `  ⚠️ Late: **${recs.filter(r => r.status === 'late').length}**\n` +
      `  ❌ Absent: **${recs.filter(r => r.status === 'absent').length}**\n` +
      `  🏠 WFH: **${recs.filter(r => r.status === 'work-from-home').length}**\n\n` +
      `  📎 History tab se CSV download kar saktey hain!`;
  }

  // ── EARLY / ON-TIME ──
  if (intent === 'EARLY_REPORT') {
    if (!effectiveTarget) return 'Employee ka naam likhein.';
    const recs = filterByDate(allRecords, effectiveTarget.id)
      .filter(r => r.status === 'present' && r.checkIn);
    if (recs.length === 0) return `✅ ${employeeName} — ${periodLabel} mein koi on-time record nahi.`;

    const sorted = [...recs].sort((a, b) => {
      const tA = new Date(a.checkIn!).getHours() * 60 + new Date(a.checkIn!).getMinutes();
      const tB = new Date(b.checkIn!).getHours() * 60 + new Date(b.checkIn!).getMinutes();
      return tA - tB;
    });

    return `✅ **${employeeName} — On-Time Days (${periodLabel})**\n\n` +
      `Total: **${recs.length} days**\n\n` +
      sorted.slice(0, 10).map(r =>
        `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`
      ).join('\n') +
      (sorted.length > 10 ? `\n  ...and ${sorted.length - 10} more` : '');
  }

  // ── LATE REPORT ──
  if (intent === 'LATE_REPORT') {
    if (!effectiveTarget) {
      // Admin: show today's late entries
      if (isAdmin) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const lateToday = allRecords.filter(r => r.date === today && r.status === 'late');
        if (lateToday.length === 0) return `✅ Aaj koi late nahi aaya!`;
        return `⚠️ **Aaj Late Aaye (${lateToday.length}):**\n\n` +
          lateToday.map(r => {
            const emp = EMPS.find(e => e.id === r.employeeId);
            return `  • **${emp?.name || 'Unknown'}** — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`;
          }).join('\n');
      }
      return 'Employee ka naam likhein.';
    }

    const recs = filterByDate(allRecords, effectiveTarget.id).filter(r => r.status === 'late');
    if (recs.length === 0) return `✅ **${employeeName}** — ${periodLabel} mein koi late entry nahi!`;

    return `⚠️ **${employeeName} — Late Days (${periodLabel})**\n\n` +
      `Total: **${recs.length} days**\n\n` +
      recs.map(r => `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)} — ${getLocationFromIP(r.ipAddress)}`).join('\n');
  }

  // ── ABSENT REPORT ──
  if (intent === 'ABSENT_REPORT') {
    if (!effectiveTarget) {
      // Admin: show today's absents
      if (isAdmin) {
        const today = format(new Date(), 'yyyy-MM-dd');
        const attendees = getAttendanceEmployees();
        const checkedIn = allRecords.filter(r => r.date === today).map(r => r.employeeId);
        const absent = attendees.filter(e => !checkedIn.includes(e.id));
        if (absent.length === 0) return `✅ Aaj sab ne check-in kar liya!`;
        return `❌ **Aaj Check-in Nahi Kia (${absent.length}):**\n\n` +
          absent.map(e => `  • **${e.name}**`).join('\n');
      }
      return 'Employee ka naam likhein.';
    }

    const recs = filterByDate(allRecords, effectiveTarget.id).filter(r => r.status === 'absent');
    if (recs.length === 0) return `✅ **${employeeName}** — ${periodLabel} mein koi absent nahi!`;

    return `❌ **${employeeName} — Absent Days (${periodLabel})**\n\n` +
      `Total: **${recs.length} days**\n\n` +
      recs.map(r => `  • ${fmtDate(r.date)}`).join('\n');
  }

  // ── WFH REPORT ──
  if (intent === 'WFH_REPORT') {
    if (effectiveTarget) {
      const recs = filterByDate(allRecords, effectiveTarget.id).filter(r => r.status === 'work-from-home');
      if (recs.length === 0) return `🏠 **${employeeName}** ne ${periodLabel} mein koi WFH nahi li.`;
      return `🏠 **${employeeName} — WFH Days (${periodLabel})**\n\n` +
        `Total: **${recs.length} days**\n\n` +
        recs.map(r => `  • ${fmtDate(r.date)}`).join('\n');
    }

    if (!isAdmin) {
      const count = allRecords.filter(r => r.employeeId === askingEmployeeId && r.status === 'work-from-home').length;
      return `🏠 Aapne **${count}** WFH days liye hain.`;
    }

    const byEmp = getAttendanceEmployees().map(e => ({
      name: e.name,
      count: allRecords.filter(r => r.employeeId === e.id && r.status === 'work-from-home').length,
    })).filter(e => e.count > 0);

    if (byEmp.length === 0) return '🏠 Kisi ne WFH nahi li abhi tak.';
    return `🏠 **WFH Report**\n\n${byEmp.map(e => `  • ${e.name}: **${e.count} days**`).join('\n')}`;
  }

  // ── OT REPORT ──
  if (intent === 'OT_REPORT') {
    if (!showOT) return '❌ Overtime dekhne ki permission nahi hai.';

    if (effectiveTarget) {
      const t = getEmployeeTiming(effectiveTarget.id);
      const recs = filterByDate(allRecords, effectiveTarget.id)
        .filter(r => r.totalHours > t.minHoursForFullDay || r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY'));

      if (recs.length === 0) return `⏱️ **${employeeName}** — ${periodLabel} mein koi overtime nahi.`;

      const totalOT = roundH(recs.reduce((s, r) => {
        const isSun = r.notes?.includes('SUNDAY');
        const isHol = r.notes?.includes('HOLIDAY');
        return s + ((isSun || isHol) ? r.totalHours : Math.max(0, r.totalHours - t.minHoursForFullDay));
      }, 0));

      return `⏱️ **${employeeName} — Overtime (${periodLabel})**\n\n` +
        `Total OT: **${totalOT}h** | Days: **${recs.length}** | Duty: **${t.minHoursForFullDay}h/day**\n\n` +
        recs.map(r => {
          const isSun = r.notes?.includes('SUNDAY');
          const isHol = r.notes?.includes('HOLIDAY');
          const ot = (isSun || isHol) ? r.totalHours : roundH(r.totalHours - t.minHoursForFullDay);
          const tag = isSun ? '🌙 Sunday' : isHol ? '🎉 Holiday' : 'OT';
          return `  • ${fmtShortDate(r.date)} — ${r.totalHours}h — **+${ot}h ${tag}** — ${getLocationFromIP(r.ipAddress)}`;
        }).join('\n');
    }

    if (isAdmin) {
      const range = dateRange ?? defaultRange;
      const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);
      const withOT = getAttendanceEmployees().map(e => {
        const t = getEmployeeTiming(e.id);
        const er = recs.filter(r =>
          r.employeeId === e.id &&
          (r.totalHours > t.minHoursForFullDay || r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY'))
        );
        const total = roundH(er.reduce((s, r) => {
          const isSun = r.notes?.includes('SUNDAY');
          const isHol = r.notes?.includes('HOLIDAY');
          return s + ((isSun || isHol) ? r.totalHours : Math.max(0, r.totalHours - t.minHoursForFullDay));
        }, 0));
        return { name: e.name, totalOT: total, days: er.length };
      }).filter(e => e.totalOT > 0);

      if (withOT.length === 0) return `⏱️ Kisi ka overtime nahi (${range.label}).`;
      const grandTotal = roundH(withOT.reduce((a, b) => a + b.totalOT, 0));
      return `⏱️ **Team Overtime (${range.label})**\n\n` +
        withOT.map(s => `  • **${s.name}** — +${s.totalOT}h (${s.days} days)`).join('\n') +
        `\n\n  📊 Grand Total: **+${grandTotal}h**`;
    }
  }

  // ── LOCATION REPORT ──
  if (intent === 'LOCATION_REPORT') {
    const today = format(new Date(), 'yyyy-MM-dd');
    const recs = allRecords.filter(r => r.date === today && r.checkIn);
    if (recs.length === 0) return '📍 Aaj abhi tak kisi ne check-in nahi kia.';
    return `📍 **Today's Locations (${recs.length} checked in)**\n\n` +
      recs.map(r => {
        const e = EMPS.find(x => x.id === r.employeeId);
        return `  • **${e?.name || 'Unknown'}** — ${getLocationFromIP(r.ipAddress)} — ${fmtTime(r.checkIn)}`;
      }).join('\n');
  }

  // ── HOURS REPORT ──
  if (intent === 'HOURS_REPORT') {
    if (!effectiveTarget) return 'Employee ka naam likhein.';
    const recs = filterByDate(allRecords, effectiveTarget.id).filter(r => r.totalHours > 0);
    if (recs.length === 0) return `⏱️ **${employeeName}** — ${periodLabel} mein koi working hours record nahi.`;

    const total = roundH(recs.reduce((s, r) => s + r.totalHours, 0));
    const avg = roundH(total / recs.length);
    const recent = [...recs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

    return `⏱️ **${employeeName} — Working Hours (${periodLabel})**\n\n` +
      `  Total: **${total}h** | Days: **${recs.length}** | Avg/Day: **${avg}h**\n\n` +
      `Recent:\n` +
      recent.map(r =>
        `  • ${fmtShortDate(r.date)} — ${r.totalHours}h — ${fmtTime(r.checkIn)} → ${fmtTime(r.checkOut)} — ${getLocationFromIP(r.ipAddress)}`
      ).join('\n');
  }

  // ── ATTENDANCE SUMMARY (default) ──
  if (effectiveTarget) {
    const recs = filterByDate(allRecords, effectiveTarget.id);
    const present  = recs.filter(r => ['present', 'late'].includes(r.status)).length;
    const late     = recs.filter(r => r.status === 'late').length;
    const absent   = recs.filter(r => r.status === 'absent').length;
    const halfDay  = recs.filter(r => r.status === 'half-day').length;
    const wfh      = recs.filter(r => r.status === 'work-from-home').length;
    const totalH   = roundH(recs.reduce((s, r) => s + (r.totalHours || 0), 0));
    const worked   = present + halfDay + wfh;
    const avgH     = worked > 0 ? roundH(totalH / worked) : 0;
    const onTimePct = present > 0 ? Math.round(((present - late) / present) * 100) : 0;

    let res = `📊 **${employeeName} — ${periodLabel}**\n\n`;
    res += `  ✅ Present: **${present}** days\n`;
    if (late > 0) res += `  ⚠️ Late: **${late}** days\n`;
    if (absent > 0) res += `  ❌ Absent: **${absent}** days\n`;
    if (halfDay > 0) res += `  📋 Half Day: **${halfDay}**\n`;
    if (wfh > 0) res += `  🏠 WFH: **${wfh}**\n`;
    res += `  ⏱️ Total Hours: **${totalH}h**\n`;
    res += `  ⏰ Avg/Day: **${avgH}h**\n`;
    if (present > 0) res += `  🎯 On-Time: **${onTimePct}%**\n`;

    if (showOT) {
      const t = getEmployeeTiming(effectiveTarget.id);
      const otRecs = recs.filter(r =>
        r.totalHours > t.minHoursForFullDay || r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY')
      );
      const totalOT = roundH(otRecs.reduce((s, r) => {
        const special = r.notes?.includes('SUNDAY') || r.notes?.includes('HOLIDAY');
        return s + (special ? r.totalHours : Math.max(0, r.totalHours - t.minHoursForFullDay));
      }, 0));
      if (totalOT > 0) res += `  💪 Overtime: **+${totalOT}h**\n`;
    }

    const lateDays = recs.filter(r => r.status === 'late');
    if (lateDays.length > 0 && lateDays.length <= 10) {
      res += `\n⚠️ Late Days:\n` +
        lateDays.map(r => `  • ${fmtDate(r.date)} — ${fmtTime(r.checkIn)}`).join('\n');
    }

    const absDays = recs.filter(r => r.status === 'absent');
    if (absDays.length > 0 && absDays.length <= 10) {
      res += `\n\n❌ Absent Days:\n` +
        absDays.map(r => `  • ${fmtDate(r.date)}`).join('\n');
    }

    return res;
  }

  // ── NON-ADMIN FALLBACK ──
  if (!isAdmin) {
    const s = generateEmployeeSummary(askingEmployeeId, allRecords, dYear, dMonth);
    const label = dMonth ? format(new Date(dYear, dMonth - 1), 'MMMM yyyy') : 'This Month';
    return `📊 **${employeeName} — ${label}**\n\n` +
      `  ✅ Present: **${s.presentDays}**\n` +
      `  ⚠️ Late: **${s.lateDays}**\n` +
      `  ❌ Absent: **${s.absentDays}**\n` +
      `  ⏱️ Hours: **${s.totalHours}h**\n` +
      `  🎯 On-Time: **${s.onTimePercentage}%**`;
  }

  // ── ADMIN TEAM SUMMARY ──
  if (isAdmin) {
    const range = dateRange ?? defaultRange;
    const recs = allRecords.filter(r => r.date >= range.start && r.date <= range.end);
    let res = `📊 **Team Summary — ${range.label}**\n\n`;
    getAttendanceEmployees().forEach(emp => {
      const er = recs.filter(r => r.employeeId === emp.id);
      const present = er.filter(r => ['present', 'late'].includes(r.status)).length;
      const late = er.filter(r => r.status === 'late').length;
      const absent = er.filter(r => r.status === 'absent').length;
      const totalH = roundH(er.reduce((s, r) => s + (r.totalHours || 0), 0));
      const onTime = present > 0 ? Math.round(((present - late) / present) * 100) : 0;
      res += `**${emp.name}** — ✅${present} ⚠️${late} ❌${absent} — ${totalH}h — 🎯${onTime}%\n`;
    });
    return res;
  }

  // ── DEFAULT HELP ──
  return `🤖 **Yeh pooch sakte hain:**\n\n` +
    `  • "Hamza ki attendance dikhao"\n` +
    `  • "Aaj kaun late aaya?"\n` +
    `  • "Kaun absent hai?"\n` +
    `  • "Overtime report"\n` +
    `  • "WFH report"\n` +
    `  • "Team summary"\n` +
    `  • "Best performer kaun hai?"\n\n` +
    `  Urdu + English dono chalte hain!`;
}

// =============================================
// 9. SUMMARY GENERATOR
// =============================================

export function generateEmployeeSummary(
  employeeId: string,
  records: AttendanceRecord[],
  year?: number,
  month?: number
): EmployeeSummary {
  const emp = getEmployees().find(e => e.id === employeeId);
  let filtered = records.filter(r => r.employeeId === employeeId);

  if (year && month) {
    const pfx = `${year}-${String(month).padStart(2, '0')}`;
    filtered = filtered.filter(r => r.date.startsWith(pfx));
  }

  const presentDays = filtered.filter(r => ['present', 'late', 'half-day', 'work-from-home'].includes(r.status)).length;
  const absentDays  = filtered.filter(r => r.status === 'absent').length;
  const lateDays    = filtered.filter(r => r.status === 'late').length;
  const wfhDays     = filtered.filter(r => r.status === 'work-from-home').length;
  const totalHours  = roundH(filtered.reduce((s, r) => s + (r.totalHours || 0), 0));
  const lateDates   = filtered.filter(r => r.status === 'late').map(r => r.date);
  const absentDates = filtered.filter(r => r.status === 'absent').map(r => r.date);

  let totalWorkingDays = presentDays + absentDays;
  if (year && month) {
    const s = startOfMonth(new Date(year, month - 1));
    const e = endOfMonth(new Date(year, month - 1));
    totalWorkingDays = eachDayOfInterval({ start: s, end: e }).filter(d => !isWeekend(d)).length;
  }

  const timing = getEmployeeTiming(employeeId);
  const totalOT = roundH(
    filtered
      .filter(r => r.totalHours > timing.minHoursForFullDay)
      .reduce((s, r) => s + (r.totalHours - timing.minHoursForFullDay), 0)
  );

  return {
    employeeId,
    employeeName: emp?.name || 'Unknown',
    totalDays: totalWorkingDays || filtered.length,
    presentDays,
    absentDays,
    lateDays,
    wfhDays,
    totalHours,
    avgHoursPerDay: presentDays > 0 ? roundH(totalHours / presentDays) : 0,
    lateDates,
    absentDates,
    onTimePercentage: presentDays > 0
      ? Math.round(((presentDays - lateDays) / presentDays) * 100)
      : 0,
    totalOT,
  };
}