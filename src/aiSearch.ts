// src/aiSearch.ts — Professional AI Engine

import {
  getEmployees, getAttendanceEmployees, getLocationFromIP,
  getEmployeeTiming, canSeeOT, getPKTDate, getPKTDateString,
} from './store';
import { AttendanceRecord } from './types';
import {
  format, subDays, startOfMonth, endOfMonth,
  eachDayOfInterval, startOfWeek, endOfWeek, subWeeks, subMonths,
} from 'date-fns';

// ── Types ──
interface EmployeeSummary {
  id: string; name: string;
  present: number; late: number; absent: number; halfDay: number; wfh: number;
  totalHours: number; avgHours: number; totalDays: number;
  onTimePercent: number;
}

// ── Intent Classification ──
type Intent =
  | 'TODAY_SUMMARY' | 'ATTENDANCE_SUMMARY' | 'LATE_REPORT' | 'ABSENT_REPORT'
  | 'HOURS_REPORT' | 'OT_REPORT' | 'WFH_REPORT' | 'BEST_PERFORMER'
  | 'TEAM_SUMMARY' | 'COMPARISON' | 'EMPLOYEE_DETAIL' | 'PREDICTION'
  | 'EXPORT' | 'HELP' | 'GENERAL';

type DateRange = 'today' | 'yesterday' | 'week' | 'last_week' | 'month' | 'last_month' | '7d' | '30d' | 'all';

function classifyIntent(q: string): Intent {
  const l = q.toLowerCase();
  if (/^(hi|hello|salam|hey|sup|kya hal|kaise ho|assalam)/.test(l)) return 'GENERAL';
  if (/help|madad|guide|kya pooch|kya kar sakt/.test(l)) return 'HELP';
  if (/export|pdf|download|print|whatsapp|share|bhej|send/.test(l)) return 'EXPORT';
  if (/aaj|today|abhi|right now|is waqt/.test(l)) return 'TODAY_SUMMARY';
  if (/late|der|dair|deri|tard|time par nahi|늦/.test(l)) return 'LATE_REPORT';
  if (/absent|chutti|gayab|nahi aaya|nhi aya|missing|غیر حاضر/.test(l)) return 'ABSENT_REPORT';
  if (/ot |overtime|extra hour|zyada|over time/.test(l)) return 'OT_REPORT';
  if (/wfh|work from home|ghar se|remote/.test(l)) return 'WFH_REPORT';
  if (/best|top|behtareen|number.?one|topper|star|champion|award/.test(l)) return 'BEST_PERFORMER';
  if (/compare|vs|versus|mukabla|difference|farq/.test(l)) return 'COMPARISON';
  if (/predict|forecast|future|agla|next month|warning|risk/.test(l)) return 'PREDICTION';
  if (/team|sab|everyone|all|sabki|sabka|poori|puri|staff|complete/.test(l)) return 'TEAM_SUMMARY';
  if (/hour|ghant|kitne|kaam|work|time|waqt|total/.test(l)) return 'HOURS_REPORT';
  // Check if asking about specific employee
  const emps = getAttendanceEmployees();
  for (const emp of emps) {
    const names = emp.name.toLowerCase().split(' ');
    if (names.some(n => n.length > 2 && l.includes(n))) return 'EMPLOYEE_DETAIL';
  }
  if (/summary|report|present|attendance|hazri|حاضری/.test(l)) return 'ATTENDANCE_SUMMARY';
  return 'GENERAL';
}

function detectDateRange(q: string): DateRange {
  const l = q.toLowerCase();
  if (/aaj|today|abhi/.test(l)) return 'today';
  if (/kal|yesterday|guzashta/.test(l)) return 'yesterday';
  if (/is haftey|this week|current week/.test(l)) return 'week';
  if (/pichle hafte|last week|guzashta hafta/.test(l)) return 'last_week';
  if (/is mahine|this month|current month|is mah/.test(l)) return 'month';
  if (/pichle mahine|last month|guzashta mah/.test(l)) return 'last_month';
  if (/7 din|7 day|week|haft/.test(l)) return '7d';
  if (/30 din|30 day|month|mahina|mah/.test(l)) return '30d';
  if (/all|sab|total|poora|pura|complete|overall/.test(l)) return 'all';
  return '30d'; // default
}

function getDateRangeFilter(range: DateRange): { start: string; end: string; label: string } {
  const today = getPKTDateString();
  const now = getPKTDate();
  switch (range) {
    case 'today': return { start: today, end: today, label: 'Today' };
    case 'yesterday': { const y = format(subDays(now, 1), 'yyyy-MM-dd'); return { start: y, end: y, label: 'Yesterday' }; }
    case 'week': { const s = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'); return { start: s, end: today, label: 'This Week' }; }
    case 'last_week': { const lw = subWeeks(now, 1); const s = format(startOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'); const e = format(endOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'); return { start: s, end: e, label: 'Last Week' }; }
    case 'month': { const s = format(startOfMonth(now), 'yyyy-MM-dd'); return { start: s, end: today, label: format(now, 'MMMM yyyy') }; }
    case 'last_month': { const lm = subMonths(now, 1); const s = format(startOfMonth(lm), 'yyyy-MM-dd'); const e = format(endOfMonth(lm), 'yyyy-MM-dd'); return { start: s, end: e, label: format(lm, 'MMMM yyyy') }; }
    case '7d': { const s = format(subDays(now, 7), 'yyyy-MM-dd'); return { start: s, end: today, label: 'Last 7 Days' }; }
    case '30d': { const s = format(subDays(now, 30), 'yyyy-MM-dd'); return { start: s, end: today, label: 'Last 30 Days' }; }
    default: return { start: '2000-01-01', end: today, label: 'All Time' };
  }
}

function filterRecords(records: AttendanceRecord[], range: DateRange, empId?: string): AttendanceRecord[] {
  const { start, end } = getDateRangeFilter(range);
  let filtered = records.filter(r => r.date >= start && r.date <= end);
  if (empId) filtered = filtered.filter(r => r.employeeId === empId);
  return filtered;
}

function findEmployee(query: string): string | null {
  const l = query.toLowerCase();
  const emps = getAttendanceEmployees();
  for (const emp of emps) {
    const names = emp.name.toLowerCase().split(' ');
    if (names.some(n => n.length > 2 && l.includes(n))) return emp.id;
  }
  return null;
}

function buildSummary(records: AttendanceRecord[], empId: string): EmployeeSummary {
  const emp = getEmployees().find(e => e.id === empId);
  const recs = records.filter(r => r.employeeId === empId);
  const present = recs.filter(r => r.status === 'present').length;
  const late = recs.filter(r => r.status === 'late').length;
  const absent = recs.filter(r => r.status === 'absent').length;
  const halfDay = recs.filter(r => r.status === 'half-day').length;
  const wfh = recs.filter(r => r.status === 'work-from-home').length;
  const totalHours = Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 10) / 10;
  const totalDays = recs.length;
  const avgHours = totalDays > 0 ? Math.round((totalHours / Math.max(present + late, 1)) * 10) / 10 : 0;
  const onTimePercent = totalDays > 0 ? Math.round((present / Math.max(present + late + absent, 1)) * 100) : 0;
  return { id: empId, name: emp?.name || 'Unknown', present, late, absent, halfDay, wfh, totalHours, avgHours, totalDays, onTimePercent };
}

// ── Response Generators ──

function todaySummary(records: AttendanceRecord[], isAdmin: boolean, userId: string): string {
  const today = getPKTDateString();
  const dayName = format(getPKTDate(), 'EEEE, dd MMMM yyyy');
  const todayRecs = records.filter(r => r.date === today);
  const emps = getAttendanceEmployees();

  if (!isAdmin) {
    const myRec = todayRecs.find(r => r.employeeId === userId);
    if (!myRec) return `📅 **${dayName}**\n\n❌ You have **not checked in** today yet.`;
    const checkIn = myRec.checkIn ? format(new Date(myRec.checkIn), 'hh:mm a') : '—';
    const checkOut = myRec.checkOut ? format(new Date(myRec.checkOut), 'hh:mm a') : 'Still working';
    return `📅 **${dayName}**\n\n• **Status:** ${myRec.status.toUpperCase()}\n• **Check In:** ${checkIn}\n• **Check Out:** ${checkOut}\n• **Hours:** ${myRec.totalHours.toFixed(1)}h`;
  }

  const present = todayRecs.filter(r => r.status === 'present').length;
  const late = todayRecs.filter(r => r.status === 'late').length;
  const absent = emps.length - todayRecs.length;
  const checkedIn = todayRecs.filter(r => r.checkIn && !r.checkOut);
  const completed = todayRecs.filter(r => r.checkOut);

  let response = `📅 **Today's Report — ${dayName}**\n\n`;
  response += `✅ **Present:** ${present}  |  ⚠️ **Late:** ${late}  |  ❌ **Absent:** ${absent}\n`;
  response += `🔄 **Working now:** ${checkedIn.length}  |  ✓ **Completed:** ${completed.length}\n\n`;

  if (todayRecs.length > 0) {
    response += `**Employee Details:**\n`;
    todayRecs.forEach(r => {
      const name = getEmployees().find(e => e.id === r.employeeId)?.name || 'Unknown';
      const statusIcon = r.status === 'present' ? '✅' : r.status === 'late' ? '⚠️' : '❌';
      const time = r.checkIn ? format(new Date(r.checkIn), 'hh:mm a') : '—';
      response += `• ${statusIcon} **${name}** — ${r.status.toUpperCase()} (In: ${time})\n`;
    });
  }

  if (absent > 0) {
    const absentEmps = emps.filter(e => !todayRecs.some(r => r.employeeId === e.id));
    response += `\n**Absent Today:**\n`;
    absentEmps.forEach(e => { response += `• ❌ ${e.name}\n`; });
  }

  return response;
}

function lateReport(records: AttendanceRecord[], range: DateRange): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range);
  const lateRecs = filtered.filter(r => r.status === 'late');

  if (lateRecs.length === 0) return `⏰ **Late Report — ${label}**\n\n✅ No one was late! Great discipline! 👏`;

  // Group by employee
  const byEmp: Record<string, number> = {};
  lateRecs.forEach(r => { byEmp[r.employeeId] = (byEmp[r.employeeId] || 0) + 1; });
  const sorted = Object.entries(byEmp).sort((a, b) => b[1] - a[1]);

  let response = `⏰ **Late Report — ${label}**\n\n`;
  response += `Total late entries: **${lateRecs.length}**\n\n`;
  sorted.forEach(([empId, count], i) => {
    const name = getEmployees().find(e => e.id === empId)?.name || 'Unknown';
    const bar = '█'.repeat(Math.min(count, 10));
    response += `• **${name}** — ${count} time${count > 1 ? 's' : ''} late ${bar}\n`;
  });

  if (sorted.length > 0) {
    response += `\n⚠️ **Most Late:** ${getEmployees().find(e => e.id === sorted[0][0])?.name} (${sorted[0][1]} times)`;
  }
  return response;
}

function absentReport(records: AttendanceRecord[], range: DateRange): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range);
  const absentRecs = filtered.filter(r => r.status === 'absent');

  if (absentRecs.length === 0) return `📋 **Absent Report — ${label}**\n\n✅ Zero absences! Everyone showed up! 🎉`;

  const byEmp: Record<string, number> = {};
  absentRecs.forEach(r => { byEmp[r.employeeId] = (byEmp[r.employeeId] || 0) + 1; });
  const sorted = Object.entries(byEmp).sort((a, b) => b[1] - a[1]);

  let response = `📋 **Absent Report — ${label}**\n\n`;
  response += `Total absent days: **${absentRecs.length}**\n\n`;
  sorted.forEach(([empId, count]) => {
    const name = getEmployees().find(e => e.id === empId)?.name || 'Unknown';
    response += `• ❌ **${name}** — ${count} day${count > 1 ? 's' : ''} absent\n`;
  });
  return response;
}

function hoursReport(records: AttendanceRecord[], range: DateRange, targetEmpId?: string): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range, targetEmpId || undefined);

  if (targetEmpId) {
    const sum = buildSummary(filtered, targetEmpId);
    return `⏱️ **Hours Report — ${sum.name} (${label})**\n\n• **Total Hours:** ${sum.totalHours}h\n• **Avg Hours/Day:** ${sum.avgHours}h\n• **Days Present:** ${sum.present + sum.late}\n• **Days Absent:** ${sum.absent}\n• **On-Time Rate:** ${sum.onTimePercent}%`;
  }

  const emps = getAttendanceEmployees();
  const summaries = emps.map(e => buildSummary(filtered, e.id)).sort((a, b) => b.totalHours - a.totalHours);

  let response = `⏱️ **Hours Report — ${label}**\n\n`;
  summaries.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    response += `${medal} **${s.name}** — ${s.totalHours}h (avg ${s.avgHours}h/day)\n`;
  });
  return response;
}

function bestPerformer(records: AttendanceRecord[], range: DateRange): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range);
  const emps = getAttendanceEmployees();
  const summaries = emps.map(e => buildSummary(filtered, e.id))
    .filter(s => s.totalDays > 0)
    .sort((a, b) => {
      const scoreA = a.onTimePercent * 0.4 + (a.avgHours / 9 * 100) * 0.3 + ((a.totalDays - a.absent) / Math.max(a.totalDays, 1) * 100) * 0.3;
      const scoreB = b.onTimePercent * 0.4 + (b.avgHours / 9 * 100) * 0.3 + ((b.totalDays - b.absent) / Math.max(b.totalDays, 1) * 100) * 0.3;
      return scoreB - scoreA;
    });

  if (summaries.length === 0) return `🏆 **Best Performer — ${label}**\n\nNot enough data to determine.`;

  let response = `🏆 **Performance Rankings — ${label}**\n\n`;
  summaries.forEach((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const score = Math.round(s.onTimePercent * 0.4 + (s.avgHours / 9 * 100) * 0.3 + ((s.totalDays - s.absent) / Math.max(s.totalDays, 1) * 100) * 0.3);
    response += `${medal} **${s.name}** — Score: ${score}/100\n`;
    response += `   ✅ ${s.present} present | ⚠️ ${s.late} late | ❌ ${s.absent} absent | ⏱️ ${s.avgHours}h avg\n\n`;
  });
  return response;
}

function teamSummary(records: AttendanceRecord[], range: DateRange): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range);
  const emps = getAttendanceEmployees();
  const summaries = emps.map(e => buildSummary(filtered, e.id)).sort((a, b) => b.onTimePercent - a.onTimePercent);

  const totalP = summaries.reduce((s, e) => s + e.present, 0);
  const totalL = summaries.reduce((s, e) => s + e.late, 0);
  const totalA = summaries.reduce((s, e) => s + e.absent, 0);
  const totalH = Math.round(summaries.reduce((s, e) => s + e.totalHours, 0) * 10) / 10;

  let response = `📊 **Team Summary — ${label}**\n\n`;
  response += `**Overall:**\n`;
  response += `• ✅ Present: **${totalP}** days\n`;
  response += `• ⚠️ Late: **${totalL}** days\n`;
  response += `• ❌ Absent: **${totalA}** days\n`;
  response += `• ⏱️ Total Hours: **${totalH}h**\n\n`;
  response += `**Per Employee:**\n`;
  summaries.forEach(s => {
    const statusBar = s.onTimePercent >= 80 ? '🟢' : s.onTimePercent >= 50 ? '🟡' : '🔴';
    response += `• ${statusBar} **${s.name}** — ${s.onTimePercent}% on-time | ${s.totalHours}h | ${s.absent} absent\n`;
  });
  return response;
}

function employeeDetail(records: AttendanceRecord[], query: string, range: DateRange): string {
  const empId = findEmployee(query);
  if (!empId) return `❓ Employee not found. Try using their exact name.`;

  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range, empId);
  const s = buildSummary(filtered, empId);

  let response = `👤 **${s.name} — ${label}**\n\n`;
  response += `**Attendance:**\n`;
  response += `• ✅ Present: **${s.present}** days\n`;
  response += `• ⚠️ Late: **${s.late}** days\n`;
  response += `• ❌ Absent: **${s.absent}** days\n`;
  response += `• 🏠 WFH: **${s.wfh}** days\n\n`;
  response += `**Performance:**\n`;
  response += `• ⏱️ Total Hours: **${s.totalHours}h**\n`;
  response += `• 📊 Avg Hours/Day: **${s.avgHours}h**\n`;
  response += `• 🎯 On-Time Rate: **${s.onTimePercent}%**\n`;

  // Recent 5 records
  const recent = filtered.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (recent.length > 0) {
    response += `\n**Recent Activity:**\n`;
    recent.forEach(r => {
      const icon = r.status === 'present' ? '✅' : r.status === 'late' ? '⚠️' : r.status === 'absent' ? '❌' : '📋';
      const dateStr = format(new Date(r.date + 'T00:00:00'), 'dd MMM, EEE');
      response += `• ${icon} ${dateStr} — ${r.status.toUpperCase()} (${r.totalHours.toFixed(1)}h)\n`;
    });
  }
  return response;
}

function generateExportText(records: AttendanceRecord[], range: DateRange, forWhatsApp: boolean): string {
  const { label } = getDateRangeFilter(range);
  const filtered = filterRecords(records, range);
  const emps = getAttendanceEmployees();
  const summaries = emps.map(e => buildSummary(filtered, e.id));

  const totalP = summaries.reduce((s, e) => s + e.present, 0);
  const totalL = summaries.reduce((s, e) => s + e.late, 0);
  const totalA = summaries.reduce((s, e) => s + e.absent, 0);
  const totalH = Math.round(summaries.reduce((s, e) => s + e.totalHours, 0) * 10) / 10;

  if (forWhatsApp) {
    let txt = `📋 *ATTENDIFY REPORT*\n📅 ${label}\n${'─'.repeat(25)}\n\n`;
    txt += `✅ Present: ${totalP}\n⚠️ Late: ${totalL}\n❌ Absent: ${totalA}\n⏱️ Hours: ${totalH}h\n\n`;
    summaries.forEach(s => {
      txt += `👤 *${s.name}*\n   P:${s.present} L:${s.late} A:${s.absent} | ${s.totalHours}h\n`;
    });
    txt += `\n_Generated by Attendify_`;
    return txt;
  }

  // Plain text for PDF
  let txt = `ATTENDIFY ATTENDANCE REPORT\n${label}\n${'='.repeat(40)}\n\n`;
  txt += `SUMMARY\nPresent: ${totalP} | Late: ${totalL} | Absent: ${totalA} | Hours: ${totalH}h\n\n`;
  txt += `EMPLOYEE DETAILS\n${'-'.repeat(40)}\n`;
  summaries.forEach(s => {
    txt += `${s.name}\n  Present: ${s.present} | Late: ${s.late} | Absent: ${s.absent} | Hours: ${s.totalHours}h | Avg: ${s.avgHours}h/day\n\n`;
  });
  return txt;
}

function helpText(): string {
  return `🤖 **Attendify AI Assistant — Help Guide**

**Ask me anything! Here are some examples:**

📅 **Today's Report:**
• "Aaj ki report dikhao"
• "Today's summary"
• "Kaun present hai?"

⏰ **Late Reports:**
• "Kaun late aaya?"
• "Late report this month"
• "Is hafte kaun late tha?"

❌ **Absent Reports:**
• "Kaun absent hai?"
• "Absent report last month"

👤 **Employee Details:**
• "Hamza ki attendance"
• "Ishtiaq ka record dikhao"
• "Behzad ne kitne ghante kaam kia?"

🏆 **Performance:**
• "Best performer kaun hai?"
• "Team summary dikhao"
• "Sabki performance compare karo"

📊 **Reports & Export:**
• "PDF report banao"
• "WhatsApp ke liye report"
• "Monthly report download karo"

💡 **Tips:**
• You can ask in **English** or **Urdu**
• Specify time: "this week", "last month", "today"
• Ask about specific people by name`;
}

// ── Main Entry Point ──

export function processAIQuery(query: string, records: AttendanceRecord[], userId: string, isAdmin: boolean): string {
  try {
    if (!query || query.trim().length === 0) return 'Please type a question or type **"help"** for guidance.';

    const intent = classifyIntent(query);
    const range = detectDateRange(query);

    // Non-admin can only see their own data
    const viewRecords = isAdmin ? records : records.filter(r => r.employeeId === userId);

    switch (intent) {
      case 'HELP': return helpText();
      case 'TODAY_SUMMARY': return todaySummary(viewRecords, isAdmin, userId);
      case 'LATE_REPORT': return lateReport(viewRecords, range);
      case 'ABSENT_REPORT': return absentReport(viewRecords, range);
      case 'HOURS_REPORT': {
        const targetEmp = findEmployee(query);
        return hoursReport(viewRecords, range, isAdmin ? (targetEmp || undefined) : userId);
      }
      case 'OT_REPORT': return hoursReport(viewRecords, range); // OT same as hours for now
      case 'WFH_REPORT': {
        const { label } = getDateRangeFilter(range);
        const filtered = filterRecords(viewRecords, range);
        const wfhRecs = filtered.filter(r => r.status === 'work-from-home');
        if (wfhRecs.length === 0) return `🏠 **WFH Report — ${label}**\n\nNo WFH records found.`;
        const byEmp: Record<string, number> = {};
        wfhRecs.forEach(r => { byEmp[r.employeeId] = (byEmp[r.employeeId] || 0) + 1; });
        let res = `🏠 **WFH Report — ${label}**\n\nTotal WFH days: **${wfhRecs.length}**\n\n`;
        Object.entries(byEmp).sort((a, b) => b[1] - a[1]).forEach(([id, c]) => {
          res += `• **${getEmployees().find(e => e.id === id)?.name}** — ${c} day${c > 1 ? 's' : ''}\n`;
        });
        return res;
      }
      case 'BEST_PERFORMER': return bestPerformer(viewRecords, range);
      case 'TEAM_SUMMARY': return teamSummary(viewRecords, range);
      case 'COMPARISON': return bestPerformer(viewRecords, range);
      case 'EMPLOYEE_DETAIL': return employeeDetail(viewRecords, query, range);
      case 'PREDICTION': {
        const filtered = filterRecords(viewRecords, '30d');
        const emps = getAttendanceEmployees();
        const risks = emps.map(e => {
          const s = buildSummary(filtered, e.id);
          const riskScore = s.late * 2 + s.absent * 5;
          return { ...s, riskScore };
        }).filter(s => s.riskScore > 5).sort((a, b) => b.riskScore - a.riskScore);

        let res = `🔮 **Prediction & Warnings (Last 30 Days)**\n\n`;
        if (risks.length === 0) { res += '✅ No employees at risk. Everyone is performing well!'; }
        else {
          risks.forEach(r => {
            const level = r.riskScore > 20 ? '🔴 HIGH' : r.riskScore > 10 ? '🟡 MEDIUM' : '🟢 LOW';
            res += `• ${level} **${r.name}** — ${r.late} late, ${r.absent} absent (Risk: ${r.riskScore})\n`;
          });
        }
        return res;
      }
      case 'EXPORT': {
        const isWA = /whatsapp|wa|share|bhej|send/.test(query.toLowerCase());
        return generateExportText(viewRecords, range, isWA);
      }
      case 'GENERAL': {
        const name = getEmployees().find(e => e.id === userId)?.name || 'there';
        return `👋 **Hello ${name}!**\n\nI'm your Attendify AI Assistant. I can help you with:\n\n• 📅 Today's attendance report\n• ⏰ Late/Absent reports\n• 👤 Employee details\n• 🏆 Performance rankings\n• 📊 Team summaries\n• 📄 PDF/WhatsApp reports\n\nJust ask me anything! Type **"help"** for full guide.`;
      }
      default: return teamSummary(viewRecords, range);
    }
  } catch (error) {
    console.error('AI Query Error:', error);
    return `⚠️ **Oops!** Something went wrong. Please try again.\n\nTip: Type **"help"** to see what I can do.`;
  }
}

// Keep backward compatibility — returns EmployeeSummary from types.ts
export function generateEmployeeSummary(
  empId: string,
  records: AttendanceRecord[],
  _startDate?: string | number,
  _endDate?: string | number,
): import('./types').EmployeeSummary {
  const emp = getEmployees().find(e => e.id === empId);
  const recs = records.filter(r => r.employeeId === empId);
  const present = recs.filter(r => r.status === 'present').length;
  const late = recs.filter(r => r.status === 'late').length;
  const absent = recs.filter(r => r.status === 'absent').length;
  const wfh = recs.filter(r => r.status === 'work-from-home').length;
  const totalHours = Math.round(recs.reduce((s, r) => s + (r.totalHours || 0), 0) * 10) / 10;
  const workDays = Math.max(present + late, 1);
  const avgHours = Math.round((totalHours / workDays) * 10) / 10;
  const totalDays = recs.length;
  const onTime = totalDays > 0 ? Math.round((present / Math.max(present + late + absent, 1)) * 100) : 0;
  const lateDates = recs.filter(r => r.status === 'late').map(r => r.date);
  const absentDates = recs.filter(r => r.status === 'absent').map(r => r.date);
  const otHours = Math.round(recs.reduce((s, r) => s + (r.overtime_hours || 0), 0) * 10) / 10;

  return {
    employeeId: empId,
    employeeName: emp?.name || 'Unknown',
    totalDays,
    presentDays: present,
    absentDays: absent,
    lateDays: late,
    wfhDays: wfh,
    totalHours,
    avgHoursPerDay: avgHours,
    lateDates,
    absentDates,
    onTimePercentage: onTime,
    totalOT: otHours,
  };
}
