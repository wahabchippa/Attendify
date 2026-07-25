import { useState, useEffect, useCallback } from 'react';
import { Employee } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getPKTDateString } from '../store';

interface PushNotificationsProps { currentUser: Employee; }
interface NotifLog { id: string; title: string; body: string; sentTo: string; sentAt: Date; }

const getInitials = (name: string) => name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');

export default function PushNotifications({ currentUser }: PushNotificationsProps) {
  const [mounted, setMounted] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default'|'granted'|'denied'>('default');
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('all');
  const [showComposer, setShowComposer] = useState(false);
  const [toast, setToast] = useState<{type:string;msg:string}|null>(null);
  const employees = getAttendanceEmployees();
  const allEmployees = getEmployees();
  const todayRecs = getAttendanceRecords().filter(r => r.date === getPKTDateString());

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);
  useEffect(() => { if ('Notification' in window) setPermissionStatus(Notification.permission as any); }, []);

  const showToast = (type:string, msg:string) => { setToast({type,msg}); setTimeout(()=>setToast(null), 3000); };

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) { showToast('error','Browser does not support notifications'); return; }
    const perm = await Notification.requestPermission();
    setPermissionStatus(perm as any);
    if (perm==='granted') showToast('success','Notifications enabled! ✅');
    else showToast('error','Permission denied');
  }, []);

  const sendNotification = useCallback((title:string, body:string, targetName:string) => {
    if (permissionStatus !== 'granted') { showToast('error','Enable notifications first!'); return; }
    try {
      new Notification(title, { body, icon: '/icon.png', tag: `attendify-${Date.now()}` });
      setLogs(prev => [{ id:`n-${Date.now()}`, title, body, sentTo: targetName, sentAt: new Date() }, ...prev].slice(0,50));
      showToast('success', `Notification sent to ${targetName}`);
    } catch { showToast('error','Failed to send notification'); }
  }, [permissionStatus]);

  const sendCheckInReminder = useCallback(() => {
    const absent = employees.filter(e => !todayRecs.some(r => r.employeeId === e.id));
    if (!absent.length) { showToast('success','Everyone checked in! ✅'); return; }
    sendNotification('⏰ Check-In Reminder', `${absent.length} not checked in: ${absent.map(e=>e.name).join(', ')}`, 'Absent employees');
  }, [employees, todayRecs, sendNotification]);

  const sendLateWarning = useCallback(() => {
    const late = todayRecs.filter(r => r.status === 'late');
    if (!late.length) { showToast('success','No one is late! ✅'); return; }
    sendNotification('⚠️ Late Arrivals', `${late.length} late: ${late.map(r=>allEmployees.find(e=>e.id===r.employeeId)?.name||'?').join(', ')}`, 'Late employees');
  }, [todayRecs, allEmployees, sendNotification]);

  const sendCheckOutReminder = useCallback(() => {
    const working = todayRecs.filter(r => r.checkIn && !r.checkOut);
    if (!working.length) { showToast('success','No one still working!'); return; }
    sendNotification('🚪 Check-Out Reminder', `${working.length} still working: ${working.map(r=>allEmployees.find(e=>e.id===r.employeeId)?.name||'?').join(', ')}`, 'Working employees');
  }, [todayRecs, allEmployees, sendNotification]);

  const sendDaySummary = useCallback(() => {
    const p = todayRecs.filter(r=>r.status==='present').length, l = todayRecs.filter(r=>r.status==='late').length, a = employees.length-todayRecs.length;
    sendNotification('📊 Daily Summary', `Present: ${p} | Late: ${l} | Absent: ${a} | Total: ${employees.length}`, 'Admin');
  }, [todayRecs, employees, sendNotification]);

  const handleCustomSend = () => {
    if (!customTitle.trim()||!customBody.trim()) { showToast('error','Fill title and message'); return; }
    const target = selectedTarget==='all' ? 'All Employees' : (allEmployees.find(e=>e.id===selectedTarget)?.name||'Unknown');
    sendNotification(customTitle.trim(), customBody.trim(), target);
    setCustomTitle(''); setCustomBody(''); setShowComposer(false);
  };

  return (
    <div className={`space-y-4 font-sans transition-all duration-500 ${mounted?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}>
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-xl text-sm font-bold text-white animate-slide-in ${toast.type==='success'?'bg-emerald-500':'bg-red-500'}`}>{toast.msg}</div>}
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-2xl p-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🔔</div><div><h2 className="text-base font-black">Push Notifications</h2><p className="text-blue-200 text-[10px] font-bold">Send alerts & reminders</p></div></div>
          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${permissionStatus==='granted'?'bg-emerald-400/20 text-emerald-200':permissionStatus==='denied'?'bg-red-400/20 text-red-200':'bg-amber-400/20 text-amber-200'}`}>{permissionStatus==='granted'?'✅ Enabled':permissionStatus==='denied'?'❌ Blocked':'⚠️ Not Set'}</span>
        </div>
      </div>
      {permissionStatus!=='granted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔔</span><div className="flex-1"><p className="text-sm font-bold text-slate-800">Enable Browser Notifications</p><p className="text-xs text-slate-500">Allow notifications to send alerts</p></div>
          <button onClick={requestPermission} className="px-4 py-2 bg-[#1E40AF] text-white rounded-xl text-xs font-bold">Enable</button>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{fn:sendCheckInReminder,icon:'⏰',t:'Check-In Reminder',d:'Alert absent employees'},{fn:sendLateWarning,icon:'⚠️',t:'Late Warning',d:'Alert late arrivals'},{fn:sendCheckOutReminder,icon:'🚪',t:'Check-Out Reminder',d:'Remind still working'},{fn:sendDaySummary,icon:'📊',t:'Day Summary',d:'Full day report'}].map(b=>(
            <button key={b.t} onClick={b.fn} className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-all text-left group">
              <span className="text-xl block mb-1">{b.icon}</span><p className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700">{b.t}</p><p className="text-[9px] text-slate-400">{b.d}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">✏️ Custom Notification</h3><button onClick={()=>setShowComposer(!showComposer)} className="text-xs font-bold text-blue-600">{showComposer?'Hide':'Compose'}</button></div>
        {showComposer && (
          <div className="space-y-3">
            <select value={selectedTarget} onChange={e=>setSelectedTarget(e.target.value)} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"><option value="all">📢 All Employees</option>{allEmployees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
            <input value={customTitle} onChange={e=>setCustomTitle(e.target.value)} placeholder="Notification Title" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"/>
            <textarea value={customBody} onChange={e=>setCustomBody(e.target.value)} placeholder="Message body..." rows={3} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none resize-none"/>
            <button onClick={handleCustomSend} disabled={permissionStatus!=='granted'} className="w-full py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] text-white rounded-xl text-sm font-bold disabled:opacity-50">🔔 Send Notification</button>
          </div>
        )}
      </div>
      {logs.length>0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between"><h3 className="text-xs font-black text-slate-700 uppercase">📜 Recent</h3><button onClick={()=>setLogs([])} className="text-[10px] font-bold text-red-500">Clear</button></div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {logs.map(log=>(
              <div key={log.id} className="px-4 py-3"><div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-800">{log.title}</p><span className="text-[10px] text-slate-400">{log.sentAt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></div><p className="text-[11px] text-slate-500 mt-0.5">{log.body}</p><p className="text-[10px] text-blue-500 font-bold mt-0.5">→ {log.sentTo}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
