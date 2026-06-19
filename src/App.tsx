// src/App.tsx

import { useState, useEffect } from 'react';
import { Employee } from './types';
import { initializeApp, hasAccess } from './store';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import History from './components/History';
import AISearch from './components/AISearch';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import UpdateModal from './components/UpdateModal';
import { useAppUpdate } from './hooks/useAppUpdate';
import { useLocationPermission } from './hooks/useLocationPermission'; // ✅ Location permission hook
import LocationPermissionDialog from './components/LocationPermissionDialog'; // ✅ Dialog component

type Page = 'dashboard' | 'history' | 'ai-search' | 'analytics' | 'settings';

const NAV_ITEMS: { key: Page; label: string; icon: React.ReactNode }[] = [
  { 
    key: 'dashboard', 
    label: 'Dashboard', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
  },
  { 
    key: 'history', 
    label: 'History', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
  },
  { 
    key: 'ai-search', 
    label: 'AI Search', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
  },
  { 
    key: 'analytics', 
    label: 'Analytics', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  { 
    key: 'settings', 
    label: 'Settings', 
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  },
];

export default function App() {
  const { updateRequired, updateInfo } = useAppUpdate();
  const { status, showSettingsDialog, checkPermission, openAppSettings } = useLocationPermission(); // ✅ Hook call
  
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(true); // ✅ Local state to hide dialog temporarily

  useEffect(() => {
    initializeApp().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('current_user_session');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch {}
    }
  }, []);

  const handleLogin = (employee: Employee) => {
    setCurrentUser(employee);
    localStorage.setItem('current_user_session', JSON.stringify(employee));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('dashboard');
    localStorage.removeItem('current_user_session');
  };

  // --- Update Check ---
  if (updateRequired && updateInfo?.force_update) {
    return <UpdateModal />;
  }

  // --- Loading Screen ---
  if (loading) {
    return (
      <>
        {updateRequired && <UpdateModal />}
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold">Af</span>
            </div>
            <p className="text-slate-500 text-sm">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  // --- Login Screen ---
  if (!currentUser) {
    return (
      <>
        {updateRequired && <UpdateModal />}
        <LoginScreen onLogin={handleLogin} />
      </>
    );
  }

  // --- Main App ---
  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.key === 'dashboard' || item.key === 'history') return true;
    if (item.key === 'ai-search') return hasAccess(currentUser.id, 'ai');
    if (item.key === 'analytics') return hasAccess(currentUser.id, 'analytics');
    if (item.key === 'settings') return hasAccess(currentUser.id, 'settings');
    return false;
  });

  return (
    <>
      {updateRequired && <UpdateModal />}

      {/* ✅ Location Permission Dialog */}
      {status === 'denied' && showSettingsDialog && showDialog && (
        <LocationPermissionDialog
          onOpenSettings={openAppSettings}
          onRetry={checkPermission}
          onClose={() => setShowDialog(false)}
        />
      )}

      <div className="min-h-screen bg-slate-50">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <span className="text-slate-800 font-semibold text-sm">Attendify</span>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-xs font-semibold text-blue-600">
              {currentUser.avatar}
            </div>
          </div>
        </header>

        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-800 transform transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="flex flex-col h-full">
            <div className="p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-white font-semibold">Attendify</h1>
                  <p className="text-slate-400 text-xs">Employee Tracking</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {visibleNav.map(item => (
                <button
                  key={item.key}
                  onClick={() => {
                    setCurrentPage(item.key);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    currentPage === item.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-sm font-semibold text-white">
                  {currentUser.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{currentUser.name}</p>
                  <p className="text-slate-400 text-xs capitalize">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:ml-64 min-h-screen">
          <div className="p-4 lg:p-6 pt-20 lg:pt-6 pb-24 lg:pb-6 max-w-6xl mx-auto">
            {currentPage === 'dashboard' && <Dashboard currentUser={currentUser} onLogout={handleLogout} />}
            {currentPage === 'history' && <History currentUser={currentUser} />}
            {currentPage === 'ai-search' && <AISearch currentUser={currentUser} />}
            {currentPage === 'analytics' && <Analytics currentUser={currentUser} />}
            {currentPage === 'settings' && <Settings currentUser={currentUser} onLogout={handleLogout} />}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2 mobile-safe">
          <div className="flex justify-around">
            {visibleNav.map(item => (
              <button
                key={item.key}
                onClick={() => setCurrentPage(item.key)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-all ${
                  currentPage === item.key
                    ? 'text-blue-600'
                    : 'text-slate-400'
                }`}
              >
                {item.icon}
                <span className="text-[10px]">{item.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
