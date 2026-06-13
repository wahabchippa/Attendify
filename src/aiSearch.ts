import { EMPLOYEES } from './store';
import { AttendanceRecord, EmployeeSummary } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';

// Generate employee summary for a given period
export function generateEmployeeSummary(
  employeeId: string,
  records: AttendanceRecord[],
  year?: number,
  month?: number
): EmployeeSummary {
  const emp = EMPLOYEES.find(e => e.id === employeeId);
  let filtered = records.filter(r => r.employeeId === employeeId);

  if (year && month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    filtered = filtered.filter(r => r.date.startsWith(prefix));
  }

  const presentDays = filtered.filter(r => r.status === 'present' || r.status === 'late' || r.status === 'half-day' || r.status === 'work-from-home').length;
  const absentDays = filtered.filter(r => r.status === 'absent').length;
  const lateDays = filtered.filter(r => r.status === 'late').length;
  const wfhDays = filtered.filter(r => r.status === 'work-from-home').length;
  const totalHours = filtered.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const lateDates = filtered.filter(r => r.status === 'late').map(r => r.date);
  const absentDates = filtered.filter(r => r.status === 'absent').map(r => r.date);

  // Calculate working days in period
  let totalWorkingDays = presentDays + absentDays;
  if (year && month) {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    const allDays = eachDayOfInterval({ start, end });
    totalWorkingDays = allDays.filter(d => !isWeekend(d)).length;
  }

  return {
    employeeId,
    employeeName: emp?.name || 'Unknown',
    totalDays: totalWorkingDays || filtered.length,
    presentDays,
    absentDays,
    lateDays,
    totalHours: Math.round(totalHours * 100) / 100,
    avgHoursPerDay: presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0,
    lateDates,
    absentDates,
    onTimePercentage: presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : 0,
    wfhDays,
  };
}

// Parse natural language query
export function processAIQuery(query: string, allRecords: AttendanceRecord[]): string {
  const q = query.toLowerCase().trim();

  // Find employee being asked about
  const targetEmployee = EMPLOYEES.find(emp => {
    const nameParts = emp.name.toLowerCase().split(' ');
    return nameParts.some(part => q.includes(part)) || q.includes(emp.name.toLowerCase());
  });

  // Detect month
  const months: Record<string, number> = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12,
  };

  let detectedMonth: number | undefined;
  let detectedYear = new Date().getFullYear();

  for (const [monthName, monthNum] of Object.entries(months)) {
    if (q.includes(monthName)) {
      detectedMonth = monthNum;
      break;
    }
  }

  // Detect year
  const yearMatch = q.match(/20\d{2}/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[0]);
  }

  // Check if "this month" or "is mahine"
  if (q.includes('this month') || q.includes('is mahine') || q.includes('is mahinay') || q.includes('current month')) {
    detectedMonth = new Date().getMonth() + 1;
  }

  // Check for "last month" or "pichle mahine"
  if (q.includes('last month') || q.includes('pichle mahine') || q.includes('pichlay mahinay')) {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    detectedMonth = d.getMonth() + 1;
    detectedYear = d.getFullYear();
  }

  // ======= RESPONSE GENERATION =======

  // Query: WFH / Work from home (check this first)
  if (q.includes('wfh') || q.includes('work from home') || q.includes('ghar se') || q.includes('ghar sey')) {
    const wfhRecords = allRecords.filter(r => r.status === 'work-from-home');
    
    if (targetEmployee) {
      const empWFH = wfhRecords.filter(r => r.employeeId === targetEmployee.id);
      if (empWFH.length === 0) {
        return `🏠 ${targetEmployee.name} ne abhi tak koi WFH nahi ki.`;
      }
      return `🏠 **${targetEmployee.name} - Work From Home:**\n\nTotal WFH Days: **${empWFH.length}**\n\nDates:\n${empWFH.map(r => `• ${format(parseISO(r.date), 'dd MMM yyyy (EEEE)')}`).join('\n')}`;
    }
    
    // Today's WFH
    const today = new Date().toISOString().split('T')[0];
    const todayWFH = wfhRecords.filter(r => r.date === today);
    if (todayWFH.length > 0) {
      const names = todayWFH.map(r => {
        const emp = EMPLOYEES.find(e => e.id === r.employeeId);
        return `• ${emp?.name}`;
      }).join('\n');
      return `🏠 Aaj WFH pe hain (${todayWFH.length}):\n${names}`;
    }
    
    // Overall WFH stats
    const wfhByEmp = EMPLOYEES.map(emp => ({
      name: emp.name,
      count: wfhRecords.filter(r => r.employeeId === emp.id).length
    })).filter(e => e.count > 0);
    
    if (wfhByEmp.length === 0) {
      return '🏠 Abhi tak kisi ne bhi WFH nahi ki.';
    }
    
    return `🏠 **Work From Home Summary:**\n\n${wfhByEmp.map(e => `• ${e.name}: ${e.count} days`).join('\n')}`;
  }

  // Query: Who is late today / today's attendance
  if (q.includes('today') || q.includes('aaj') || q.includes('aj')) {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = allRecords.filter(r => r.date === today);

    if (q.includes('late') || q.includes('der') || q.includes('dair')) {
      const lateOnes = todayRecords.filter(r => r.status === 'late');
      if (lateOnes.length === 0) return '✅ Aaj koi bhi late nahi aaya! Sab on-time hain.';
      const names = lateOnes.map(r => {
        const emp = EMPLOYEES.find(e => e.id === r.employeeId);
        const time = r.checkIn ? format(parseISO(r.checkIn), 'hh:mm a') : 'N/A';
        return `• ${emp?.name} - Check-in: ${time}`;
      }).join('\n');
      return `⚠️ Aaj ${lateOnes.length} log late aaye:\n${names}`;
    }

    if (q.includes('absent') || q.includes('ghair hazir') || q.includes('nahi aaya')) {
      const presentIds = todayRecords.map(r => r.employeeId);
      const absent = EMPLOYEES.filter(e => !presentIds.includes(e.id));
      if (absent.length === 0) return '✅ Aaj sab present hain!';
      return `❌ Aaj ye log absent hain:\n${absent.map(e => `• ${e.name}`).join('\n')}`;
    }

    if (todayRecords.length === 0) return '📋 Aaj abhi tak kisi ne bhi attendance mark nahi ki.';

    const summary = todayRecords.map(r => {
      const emp = EMPLOYEES.find(e => e.id === r.employeeId);
      const time = r.checkIn ? format(parseISO(r.checkIn), 'hh:mm a') : '—';
      const statusEmoji = r.status === 'present' ? '✅' : r.status === 'late' ? '⚠️' : r.status === 'absent' ? '❌' : r.status === 'work-from-home' ? '🏠' : '📋';
      return `${statusEmoji} ${emp?.name} — ${r.status === 'work-from-home' ? 'WFH' : r.status.toUpperCase()} — ${time}`;
    }).join('\n');

    return `📋 **Aaj ki Attendance (${format(new Date(), 'dd MMM yyyy')}):**\n\n${summary}`;
  }

  // Query about specific employee
  if (targetEmployee) {
    const summary = generateEmployeeSummary(
      targetEmployee.id,
      allRecords,
      detectedYear,
      detectedMonth
    );

    const monthName = detectedMonth
      ? format(new Date(detectedYear, detectedMonth - 1), 'MMMM yyyy')
      : 'All Time';

    // Hours query
    if (q.includes('hour') || q.includes('ghant') || q.includes('kitne') || q.includes('kaam') || q.includes('work')) {
      let response = `📊 **${targetEmployee.name} - Work Hours (${monthName}):**\n\n`;
      response += `⏱️ Total Hours Worked: **${summary.totalHours} hours**\n`;
      response += `📅 Days Present: **${summary.presentDays} days**\n`;
      response += `⏰ Average Hours/Day: **${summary.avgHoursPerDay} hours**\n`;

      if (summary.lateDays > 0) {
        response += `\n⚠️ Late Days: **${summary.lateDays}**\n`;
        response += `Late Dates: ${summary.lateDates.map(d => format(parseISO(d), 'dd MMM')).join(', ')}\n`;
      }

      return response;
    }

    // Late query
    if (q.includes('late') || q.includes('der') || q.includes('dair')) {
      if (summary.lateDays === 0) {
        return `✅ ${targetEmployee.name} ${monthName} mein kabhi late nahi aaya/aayi!`;
      }
      let response = `⚠️ **${targetEmployee.name} - Late Report (${monthName}):**\n\n`;
      response += `Late Days: **${summary.lateDays}**\n`;
      response += `Late Dates:\n`;
      
      summary.lateDates.forEach(d => {
        const rec = allRecords.find(r => r.employeeId === targetEmployee.id && r.date === d);
        const time = rec?.checkIn ? format(parseISO(rec.checkIn), 'hh:mm a') : 'N/A';
        response += `• ${format(parseISO(d), 'dd MMM yyyy (EEEE)')} — Check-in: ${time}\n`;
      });

      return response;
    }

    // Absent query
    if (q.includes('absent') || q.includes('chhutti') || q.includes('leave') || q.includes('nahi aaya')) {
      if (summary.absentDays === 0) {
        return `✅ ${targetEmployee.name} ${monthName} mein ek din bhi absent nahi raha/rahi!`;
      }
      let response = `❌ **${targetEmployee.name} - Absent Report (${monthName}):**\n\n`;
      response += `Absent Days: **${summary.absentDays}**\n`;
      response += `Absent Dates:\n`;
      summary.absentDates.forEach(d => {
        response += `• ${format(parseISO(d), 'dd MMM yyyy (EEEE)')}\n`;
      });
      return response;
    }

    // General summary
    let response = `📊 **${targetEmployee.name} - Complete Summary (${monthName}):**\n\n`;
    response += `👤 Role: **${targetEmployee.role.charAt(0).toUpperCase() + targetEmployee.role.slice(1)}**\n`;
    response += `📅 Total Working Days: **${summary.totalDays}**\n`;
    response += `✅ Present: **${summary.presentDays} days**\n`;
    response += `❌ Absent: **${summary.absentDays} days**\n`;
    response += `⚠️ Late: **${summary.lateDays} days**\n`;
    response += `⏱️ Total Hours: **${summary.totalHours} hrs**\n`;
    response += `⏰ Avg Hours/Day: **${summary.avgHoursPerDay} hrs**\n`;
    response += `🎯 On-Time Rate: **${summary.onTimePercentage}%**\n`;

    if (summary.lateDates.length > 0) {
      response += `\n📋 **Late Dates:**\n`;
      summary.lateDates.forEach(d => {
        response += `  • ${format(parseISO(d), 'dd MMM (EEE)')}\n`;
      });
    }
    if (summary.absentDates.length > 0) {
      response += `\n📋 **Absent Dates:**\n`;
      summary.absentDates.forEach(d => {
        response += `  • ${format(parseISO(d), 'dd MMM (EEE)')}\n`;
      });
    }

    return response;
  }

  // Query: All employees summary
  if (q.includes('all') || q.includes('sab') || q.includes('everyone') || q.includes('team') || q.includes('sabki')) {
    let response = `📊 **Team Summary (${detectedMonth ? format(new Date(detectedYear, detectedMonth - 1), 'MMMM yyyy') : 'All Time'}):**\n\n`;

    EMPLOYEES.forEach(emp => {
      const summary = generateEmployeeSummary(emp.id, allRecords, detectedYear, detectedMonth);
      response += `**${emp.name}** (${emp.role})\n`;
      response += `  ✅ Present: ${summary.presentDays} | ❌ Absent: ${summary.absentDays} | ⚠️ Late: ${summary.lateDays}\n`;
      response += `  ⏱️ Total Hours: ${summary.totalHours} | 🎯 On-Time: ${summary.onTimePercentage}%\n\n`;
    });

    return response;
  }

  // Query: Best/worst performer
  if (q.includes('best') || q.includes('top') || q.includes('sabse acha') || q.includes('behtareen')) {
    const summaries = EMPLOYEES.map(emp =>
      generateEmployeeSummary(emp.id, allRecords, detectedYear, detectedMonth)
    );
    const sorted = summaries.sort((a, b) => b.onTimePercentage - a.onTimePercentage);
    const best = sorted[0];
    return `🏆 **Best Performer: ${best.employeeName}**\n\n🎯 On-Time: ${best.onTimePercentage}%\n⏱️ Total Hours: ${best.totalHours}\n✅ Present: ${best.presentDays} days\n⚠️ Late: ${best.lateDays} days`;
  }

  if (q.includes('worst') || q.includes('sabse bura') || q.includes('problem')) {
    const summaries = EMPLOYEES.map(emp =>
      generateEmployeeSummary(emp.id, allRecords, detectedYear, detectedMonth)
    );
    const sorted = summaries.sort((a, b) => a.onTimePercentage - b.onTimePercentage);
    const worst = sorted[0];
    return `⚠️ **Needs Improvement: ${worst.employeeName}**\n\n🎯 On-Time: ${worst.onTimePercentage}%\n⏱️ Total Hours: ${worst.totalHours}\n❌ Absent: ${worst.absentDays} days\n⚠️ Late: ${worst.lateDays} days`;
  }

  // Help / default
  return `🤖 **AI Attendance Assistant - Help:**\n\nMujh se ye sawalaat pooch saktey ho:\n\n` +
    `• "Abdul Wahab ne is mahine kitne ghante kaam kia?"\n` +
    `• "Hamza Saeed kitni baar late aaya?"\n` +
    `• "Aaj kaun late aaya?"\n` +
    `• "Aaj kaun absent hai?"\n` +
    `• "Aaj kaun WFH pe hai?"\n` +
    `• "Ghar se kaun kaam kar raha hai?"\n` +
    `• "Sabki attendance summary dikhao"\n` +
    `• "Behzad ki January report"\n` +
    `• "Best performer kaun hai?"\n` +
    `• "Ishtiaq ne last month kitne din kaam kia?"\n\n` +
    `Employee names: ${EMPLOYEES.map(e => e.name).join(', ')}`;
}
