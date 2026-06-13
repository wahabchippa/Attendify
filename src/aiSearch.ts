import { getEmployees, getLocationFromIP } from './store';
import { AttendanceRecord, EmployeeSummary } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';

export function generateEmployeeSummary(employeeId: string, records: AttendanceRecord[], year?: number, month?: number): EmployeeSummary {
  const emp = getEmployees().find(e => e.id === employeeId);
  let filtered = records.filter(r => r.employeeId === employeeId);
  if (year && month) { const prefix = `${year}-${String(month).padStart(2, '0')}`; filtered = filtered.filter(r => r.date.startsWith(prefix)); }
  const presentDays = filtered.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'half-day' || r.status === 'work-from-home').length;
  const absentDays = filtered.filter(r => r.status === 'absent').length;
  const lateDays = filtered.filter(r => r.status === 'late').length;
  const wfhDays = filtered.filter(r => r.status === 'work-from-home').length;
  const totalHours = filtered.reduce((s, r) => s + (r.totalHours || 0), 0);
  const lateDates = filtered.filter(r => r.status === 'late').map(r => r.date);
  const absentDates = filtered.filter(r => r.status === 'absent').map(r => r.date);
  let totalWorkingDays = presentDays + absentDays;
  if (year && month) { const s = startOfMonth(new Date(year, month-1)); const e = endOfMonth(new Date(year, month-1)); totalWorkingDays = eachDayOfInterval({start:s,end:e}).filter(d => !isWeekend(d)).length; }
  return { employeeId, employeeName: emp?.name||'Unknown', totalDays: totalWorkingDays||filtered.length, presentDays, absentDays, lateDays, wfhDays, totalHours: Math.round(totalHours*100)/100, avgHoursPerDay: presentDays>0 ? Math.round((totalHours/presentDays)*100)/100 : 0, lateDates, absentDates, onTimePercentage: presentDays>0 ? Math.round(((presentDays-lateDays)/presentDays)*100) : 0 };
}

// isAdmin: true = show all employees, false = only show data about the asking employee
export function processAIQuery(query: string, allRecords: AttendanceRecord[], askingEmployeeId: string, isAdmin: boolean): string {
  const q = query.toLowerCase().trim();
  const EMPS = getEmployees();

  // Find target employee in query
  const targetEmployee = EMPS.find(emp => {
    const parts = emp.name.toLowerCase().split(' ');
    return parts.some(p => q.includes(p)) || q.includes(emp.name.toLowerCase());
  });

  // If employee (non-admin) asks about someone else, block it
  if (!isAdmin && targetEmployee && targetEmployee.id !== askingEmployeeId) {
    return `Sorry, aap sirf apni details dekh saktey hain. Kisi aur ke barey mein information nahi mil sakti.`;
  }

  // For non-admin, force target to self
  const effectiveTarget = isAdmin ? targetEmployee : EMPS.find(e => e.id === askingEmployeeId);

  // Detect month
  const months: Record<string,number> = { january:1,jan:1,february:2,feb:2,march:3,mar:3,april:4,apr:4,may:5,june:6,jun:6,july:7,jul:7,august:8,aug:8,september:9,sep:9,october:10,oct:10,november:11,nov:11,december:12,dec:12 };
  let detectedMonth: number|undefined;
  let detectedYear = new Date().getFullYear();
  for (const [mn, num] of Object.entries(months)) { if (q.includes(mn)) { detectedMonth = num; break; } }
  const ym = q.match(/20\d{2}/); if (ym) detectedYear = parseInt(ym[0]);
  if (q.includes('this month') || q.includes('is mahine') || q.includes('is mahinay')) detectedMonth = new Date().getMonth()+1;
  if (q.includes('last month') || q.includes('pichle mahine') || q.includes('pichlay mahinay')) { const d = new Date(); d.setMonth(d.getMonth()-1); detectedMonth = d.getMonth()+1; detectedYear = d.getFullYear(); }

  // Location query
  if (q.includes('location') || q.includes('kahan') || q.includes('pk zone') || q.includes('qc center') || q.includes('zone')) {
    const today = new Date().toISOString().split('T')[0];
    const todayRecs = allRecords.filter(r => r.date === today);
    if (todayRecs.length === 0) return 'Aaj abhi tak kisi ne check-in nahi kia.';
    const lines = todayRecs.map(r => {
      const emp = EMPS.find(e => e.id === r.employeeId);
      const loc = getLocationFromIP(r.ipAddress);
      return `• ${emp?.name} — ${loc} — ${r.checkIn ? format(parseISO(r.checkIn), 'hh:mm a') : '—'}`;
    });
    return `📍 **Today's Locations:**\n\n${lines.join('\n')}`;
  }

  // WFH query
  if (q.includes('wfh') || q.includes('work from home') || q.includes('ghar se') || q.includes('ghar sey')) {
    const wfhRecs = allRecords.filter(r => r.status === 'work-from-home');
    if (effectiveTarget) {
      const empWFH = wfhRecs.filter(r => r.employeeId === effectiveTarget.id);
      if (empWFH.length === 0) return `${effectiveTarget.name} ne abhi tak koi WFH nahi ki.`;
      return `🏠 **${effectiveTarget.name} - Work From Home:**\n\nTotal WFH Days: **${empWFH.length}**\nDates:\n${empWFH.map(r => `• ${format(parseISO(r.date), 'dd MMM yyyy')}`).join('\n')}`;
    }
    if (!isAdmin) return `Aapne abhi tak ${wfhRecs.filter(r => r.employeeId === askingEmployeeId).length} WFH days liye hain.`;
    const byEmp = EMPS.map(e => ({ name: e.name, count: wfhRecs.filter(r => r.employeeId === e.id).length })).filter(e => e.count > 0);
    return byEmp.length === 0 ? 'Abhi tak kisi ne WFH nahi ki.' : `🏠 **WFH Summary:**\n\n${byEmp.map(e => `• ${e.name}: ${e.count} days`).join('\n')}`;
  }

  // Today's attendance
  if (q.includes('today') || q.includes('aaj') || q.includes('aj')) {
    const today = new Date().toISOString().split('T')[0];
    const todayRecs = allRecords.filter(r => r.date === today);
    if (!isAdmin) {
      const myRec = todayRecs.find(r => r.employeeId === askingEmployeeId);
      if (!myRec) return 'Aaj aapne abhi check-in nahi kia.';
      const loc = getLocationFromIP(myRec.ipAddress);
      return `📋 **Today's Status:**\nStatus: **${myRec.status.toUpperCase()}**\nLocation: **${loc}**\nCheck-in: **${myRec.checkIn ? format(parseISO(myRec.checkIn),'hh:mm a') : '—'}**`;
    }
    if (q.includes('late')) { const late = todayRecs.filter(r => r.status==='late'); return late.length===0 ? '✅ No one is late today.' : `⚠️ Late today (${late.length}):\n${late.map(r => `• ${EMPS.find(e=>e.id===r.employeeId)?.name}`).join('\n')}`; }
    if (q.includes('absent') || q.includes('nahi aaya')) { const ids = todayRecs.map(r=>r.employeeId); const abs = EMPS.filter(e => !ids.includes(e.id) && e.role !== 'manager'); return abs.length===0 ? '✅ Everyone is present today.' : `❌ Absent today:\n${abs.map(e=>`• ${e.name}`).join('\n')}`; }
    if (todayRecs.length === 0) return 'No check-ins yet today.';
    return `📋 **Today (${format(new Date(),'dd MMM yyyy')}):**\n\n${todayRecs.map(r => { const e = EMPS.find(x=>x.id===r.employeeId); const loc = getLocationFromIP(r.ipAddress); return `• ${e?.name} — ${r.status.toUpperCase()} — ${loc} — ${r.checkIn ? format(parseISO(r.checkIn),'hh:mm a') : '—'}`; }).join('\n')}`;
  }

  // Specific employee query
  if (effectiveTarget) {
    const summary = generateEmployeeSummary(effectiveTarget.id, allRecords, detectedYear, detectedMonth);
    const mn = detectedMonth ? format(new Date(detectedYear, detectedMonth-1), 'MMMM yyyy') : 'All Time';

    if (q.includes('hour') || q.includes('ghant') || q.includes('kitne') || q.includes('kaam') || q.includes('work')) {
      return `📊 **${effectiveTarget.name} - Hours (${mn}):**\n\n⏱️ Total: **${summary.totalHours} hours**\n📅 Present: **${summary.presentDays} days**\n⏰ Average: **${summary.avgHoursPerDay} hrs/day**${summary.lateDays>0 ? `\n⚠️ Late: **${summary.lateDays} days**` : ''}`;
    }
    if (q.includes('late') || q.includes('der') || q.includes('dair')) {
      if (summary.lateDays === 0) return `✅ ${effectiveTarget.name} — No late entries in ${mn}!`;
      return `⚠️ **${effectiveTarget.name} - Late Report (${mn}):**\n\nLate Days: **${summary.lateDays}**\n\n${summary.lateDates.map(d => { const rec = allRecords.find(r=>r.employeeId===effectiveTarget.id&&r.date===d); return `• ${format(parseISO(d),'dd MMM (EEE)')} — ${rec?.checkIn ? format(parseISO(rec.checkIn),'hh:mm a') : '—'}`; }).join('\n')}`;
    }
    if (q.includes('absent') || q.includes('leave') || q.includes('chhutti')) {
      if (summary.absentDays === 0) return `✅ ${effectiveTarget.name} — Zero absences in ${mn}!`;
      return `❌ **${effectiveTarget.name} - Absent (${mn}):**\n\n${summary.absentDays} days\n${summary.absentDates.map(d => `• ${format(parseISO(d),'dd MMM (EEE)')}`).join('\n')}`;
    }
    // General summary
    return `📊 **${effectiveTarget.name} — ${mn}:**\n\n📅 Working Days: **${summary.totalDays}**\n✅ Present: **${summary.presentDays}**\n❌ Absent: **${summary.absentDays}**\n⚠️ Late: **${summary.lateDays}**\n⏱️ Total Hours: **${summary.totalHours}h**\n⏰ Avg/Day: **${summary.avgHoursPerDay}h**\n🎯 On-Time: **${summary.onTimePercentage}%**${summary.lateDates.length>0 ? `\n\n📋 Late Dates:\n${summary.lateDates.map(d=>`  • ${format(parseISO(d),'dd MMM')}`).join('\n')}` : ''}`;
  }

  // All employees (admin only)
  if (isAdmin && (q.includes('all') || q.includes('sab') || q.includes('everyone') || q.includes('sabki') || q.includes('team'))) {
    let res = `📊 **Team Summary (${detectedMonth ? format(new Date(detectedYear,detectedMonth-1),'MMMM yyyy') : 'All Time'}):**\n\n`;
    EMPS.filter(e=>e.role!=='manager').forEach(emp => {
      const s = generateEmployeeSummary(emp.id, allRecords, detectedYear, detectedMonth);
      res += `**${emp.name}**\n  ✅ ${s.presentDays} present | ❌ ${s.absentDays} absent | ⚠️ ${s.lateDays} late | ⏱️ ${s.totalHours}h\n\n`;
    });
    return res;
  }

  if (isAdmin && (q.includes('best') || q.includes('top') || q.includes('behtareen'))) {
    const sums = EMPS.filter(e=>e.role!=='manager').map(e => generateEmployeeSummary(e.id, allRecords, detectedYear, detectedMonth));
    const best = sums.sort((a,b)=>b.onTimePercentage-a.onTimePercentage)[0];
    return `🏆 **Best: ${best.employeeName}**\n🎯 On-Time: ${best.onTimePercentage}%\n⏱️ Hours: ${best.totalHours}h`;
  }

  // Non-admin: show their own summary by default
  if (!isAdmin) {
    const me = EMPS.find(e => e.id === askingEmployeeId);
    const summary = generateEmployeeSummary(askingEmployeeId, allRecords, detectedYear, detectedMonth);
    const mn = detectedMonth ? format(new Date(detectedYear, detectedMonth-1), 'MMMM yyyy') : 'This Month';
    return `📊 **${me?.name} — ${mn}:**\n\n✅ Present: **${summary.presentDays}**\n❌ Absent: **${summary.absentDays}**\n⚠️ Late: **${summary.lateDays}**\n⏱️ Hours: **${summary.totalHours}h**\n🎯 On-Time: **${summary.onTimePercentage}%**`;
  }

  return `🤖 **Attendify AI — Help:**\n\nYou can ask:\n• "Aaj kaun late aaya?"\n• "Hamza ki summary"\n• "Sabki summary dikhao"\n• "Best performer"\n• "Aaj kaun kahan hai?"\n• "WFH report"\n• Employee name + month\n\nUrdu aur English dono mein pooch saktey hain!`;
}
