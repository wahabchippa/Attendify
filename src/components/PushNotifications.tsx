// src/components/PushNotifications.tsx — Admin Push Notification Manager

import { useState, useEffect, useCallback } from 'react';
import { Employee } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getPKTDateString, getPKTDate } from '../store';

interface PushNotificationsProps { currentUser: Employee; }

interface NotifLog {
  id: string; type: string; title: string; body: string; sentTo: string; sentAt: Date;
}

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

export default function PushNotifications({ currentUser }: PushNotificationsProps) {
  const [mounted, setMounted] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('all');
  const [showComposer, setShowComposer] = useState(false);
  const [notification, setNotification] = useState<{ type: string; msg: string } | null>(null);

  const employees = getAttendanceEmployees();
  const allEmployees = getEmployees();
  const todayRecs = getAttendanceRecords().filter(r => r.date === getPKTDateString());

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  // Check notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission as 'default' | 'granted' | 'denied');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      showNotif('error', 'Browser does not support notifications');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermissionStatus(perm as 'default' | 'granted' | 'denied');
      if (perm === 'granted') showNotif('success', 'Notifications enabled! ✅');
      else showNotif('error', 'Permission denied');
    } catch {
      showNotif('error', 'Failed to request permission');
    }
  }, []);

  const showNotif = (type: string, msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  const sendNotification = useCallback((title: string, body: string, targetName: string) => {
    if (permissionStatus !== 'granted') {
      showNotif('error', 'Enable notifications first!');
      return;
    }
    try {
      new Notification(title, {
        body,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: `attendify-${Date.now()}`,
      });
      const log: NotifLog = {
        id: `n-${Date.now()}`, type: 'manual', title, body,
        sentTo: targetName, sentAt: new Date(),
      };
      setLogs(prev => [log, ...prev].slice(0, 50));
      showNotif('success', `Notification sent to ${targetName}`);
    } catch {
      showNotif('error', 'Failed to send notification');
    }
  }, [permissionStatus]);

  // Quick actions
  const sendCheckInReminder = useCallback(() => {
    const absent = employees.filter(e => !todayRecs.some(r => r.employeeId === e.id));
    if (absent.length === 0) { showNotif('success', 'Everyone checked in! ✅'); return; }
    const names = absent.map(e => e.name).join(', ');
    sendNotification('⏰ Check-In Reminder', `${absent.length} employees not checked in: ${names}`, 'Absent employees');
  }, [employees, todayRecs, sendNotification]);

  const sendLateWarning = useCallback(() => {
    const late = todayRecs.filter(r => r.status === 'late');
    if (late.length === 0) { showNotif('success', 'No one is late today! ✅'); return; }
    const names = late.map(r => allEmployees.find(e => e.id === r.employeeId)?.name || 'Unknown').join(', ');
    sendNotification('⚠️ Late Arrivals Today', `${late.length} employees arrived late: ${names}`, 'Late employees');
  }, [todayRecs, allEmployees, sendNotification]);

  const sendCheckOutReminder = useCallback(() => {
    const working = todayRecs.filter(r => r.checkIn && !r.checkOut);
    if (working.length === 0) { showNotif('success', 'No one is still working!'); return; }
    const names = working.map(r => allEmployees.find(e => e.id === r.employeeId)?.name || 'Unknown').join(', ');
    sendNotification('🚪 Check-Out Reminder', `${working.length} employees still working: ${names}`, 'Working employees');
  }, [todayRecs, allEmployees, sendNotification]);

  const sendDaySummary = useCallback(() => {
    const present = todayRecs.filter(r => r.status === 'present').length;
    const late = todayRecs.filter(r => r.status === 'late').length;
    const absent = employees.length - todayRecs.length;
    sendNotification(
      '📊 Daily Summary',
      `Present: ${present} | Late: ${late} | Absent: ${absent} | Total: ${employees.length}`,
      'Admin'
    );
  }, [todayRecs, employees, sendNotification]);

  const handleCustomSend = () => {
    if (!customTitle.trim() || !customBody.trim()) { showNotif('error', 'Fill title and message'); return; }
    const target = selectedTarget === 'all' ? 'All Employees' : (allEmployees.find(e => e.id === selectedTarget)?.name || 'Unknown');
    sendNotification(customTitle.trim(), customBody.trim(), target);
    setCustomTitle(''); setCustomBody(''); setShowComposer(false);
  };

  return (
    <div className={`space-y-3 font-sans transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {/* Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded shadow-md text-sm font-bold text-white animate-slide-in ${
          notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>{notification.msg}</div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-md p-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-8 -right-10 w-32 h-32 bg-white/10 rounded-full blur-lg" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded flex items-center justify-center text-xl">🔔</div>
            <div>
              <h2 className="text-base font-bold">Push Notifications</h2>
              <p className="text-slate-400 text-xs font-medium">Send alerts & reminders to team</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
              permissionStatus === 'granted' ? 'bg-emerald-400/20 text-emerald-200' :
              permissionStatus === 'denied' ? 'bg-red-400/20 text-red-200' : 'bg-amber-400/20 text-amber-200'
            }`}>
              {permissionStatus === 'granted' ? '✅ Enabled' : permissionStatus === 'denied' ? '❌ Blocked' : '⚠️ Not Set'}
            </span>
          </div>
        </div>
      </div>

      {/* Permission Banner */}
      {permissionStatus !== 'granted' && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800">Enable Browser Notifications</p>
            <p className="text-xs text-slate-500">Allow notifications to send alerts to your team</p>
          </div>
          <button onClick={requestPermission} className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-all">
            Enable
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
        <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={sendCheckInReminder} className="p-3 bg-slate-50 hover:bg-slate-50 border border-slate-200 hover:border-slate-200 rounded transition-all text-left group">
            <span className="text-xl block mb-1">⏰</span>
            <p className="text-[11px] font-bold text-slate-700 group-hover:text-slate-900">Check-In Reminder</p>
            <p className="text-[11px] text-slate-400">Alert absent employees</p>
          </button>
          <button onClick={sendLateWarning} className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-200 rounded transition-all text-left group">
            <span className="text-xl block mb-1">⚠️</span>
            <p className="text-[11px] font-bold text-slate-700 group-hover:text-amber-700">Late Warning</p>
            <p className="text-[11px] text-slate-400">Alert late arrivals</p>
          </button>
          <button onClick={sendCheckOutReminder} className="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded transition-all text-left group">
            <span className="text-xl block mb-1">🚪</span>
            <p className="text-[11px] font-bold text-slate-700 group-hover:text-emerald-700">Check-Out Reminder</p>
            <p className="text-[11px] text-slate-400">Remind still working</p>
          </button>
          <button onClick={sendDaySummary} className="p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-200 rounded transition-all text-left group">
            <span className="text-xl block mb-1">📊</span>
            <p className="text-[11px] font-bold text-slate-700 group-hover:text-purple-700">Day Summary</p>
            <p className="text-[11px] text-slate-400">Full day report</p>
          </button>
        </div>
      </div>

      {/* Custom Notification Composer */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">✏️ Custom Notification</h3>
          <button onClick={() => setShowComposer(!showComposer)}
            className="text-xs font-bold text-slate-800 hover:text-slate-900">{showComposer ? 'Hide' : 'Compose'}</button>
        </div>

        {showComposer && (
          <div className="space-y-3">
            <select value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold focus:outline-none">
              <option value="all">📢 All Employees</option>
              {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Notification Title"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
            <textarea value={customBody} onChange={e => setCustomBody(e.target.value)} placeholder="Message body..." rows={3}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
            <button onClick={handleCustomSend} disabled={permissionStatus !== 'granted'}
              className="w-full py-2.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50">
              🔔 Send Notification
            </button>
          </div>
        )}
      </div>

      {/* Notification Log */}
      {logs.length > 0 && (
        <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">📜 Recent Notifications</h3>
            <button onClick={() => setLogs([])} className="text-xs font-medium text-red-500 hover:text-red-700">Clear</button>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="px-4 py-3 hover:bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800">{log.title}</p>
                  <span className="text-[11px] text-slate-400">{log.sentAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{log.body}</p>
                <p className="text-[11px] text-slate-700 font-bold mt-0.5">→ {log.sentTo}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
