import { useState, useEffect } from 'react';
import { Employee } from '../types';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../store';
import { format, parseISO } from 'date-fns';

interface NotificationBellProps { currentUser: Employee; }

export default function NotificationBell({ currentUser }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const notifications = getNotifications(currentUser.id).slice(0, 20);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const interval = setInterval(() => setRefreshKey(k => k + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setRefreshKey(k => k + 1);
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(currentUser.id);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all">
        <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black text-white border border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
          <div className="absolute top-12 right-0 w-80 max-h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 z-[100] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs font-bold text-[#1E40AF]">Mark all read</button>
              )}
            </div>
            <div className="overflow-y-auto max-h-[400px]">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm font-bold">No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} onClick={() => !n.isRead && handleMarkRead(n.id)}
                    className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${!n.isRead ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start gap-2">
                      {!n.isRead && <div className="w-2 h-2 bg-[#1E40AF] rounded-full mt-1.5 shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">
                          {n.createdAt ? format(parseISO(n.createdAt), 'dd MMM, hh:mm a') : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}