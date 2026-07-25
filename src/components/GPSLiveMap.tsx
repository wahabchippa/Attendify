// src/components/GPSLiveMap.tsx — Admin-only GPS Live Map
import { useState, useEffect, useCallback, useRef } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getPKTDateString, getPKTDate, syncAll } from '../store';

interface GPSLiveMapProps { currentUser: Employee; }
interface OfficeMarker { name: string; lat: number; lng: number; radius: number; color: string; }
interface EmployeeLocation {
  empId: string; name: string; lat: number; lng: number;
  isInOffice: boolean; nearestOffice: string; distance: number;
}

const OFFICES: OfficeMarker[] = [
  { name: 'QC Center', lat: 24.856917, lng: 67.111833, radius: 150, color: '#2563EB' },
  { name: 'PK Zone',   lat: 24.825222, lng: 67.247472, radius: 800, color: '#10b981' },
  { name: 'Z House',   lat: 24.882889, lng: 67.073278, radius: 500, color: '#8b5cf6' },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const getInitials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const formatDist = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

export default function GPSLiveMap({ currentUser }: GPSLiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [empLocations, setEmpLocations] = useState<EmployeeLocation[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncAll();
      setEmployees(getAttendanceEmployees());
      setTodayRecords(getAttendanceRecords().filter(r => r.date === getPKTDateString()));
    } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;
    let cancelled = false;
    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });
        if (cancelled || !mapContainerRef.current) return;
        const map = L.map(mapContainerRef.current, { center: [24.855, 67.15], zoom: 12, zoomControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        OFFICES.forEach(office => {
          L.circle([office.lat, office.lng], { radius: office.radius, color: office.color, fillColor: office.color, fillOpacity: 0.1, weight: 2, dashArray: '5,5' }).addTo(map);
          L.marker([office.lat, office.lng], { icon: L.divIcon({ className: '', html: `<div style="background:${office.color};color:white;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);border:2px solid white;">🏢 ${office.name}</div>`, iconSize: [0, 0], iconAnchor: [50, 15] }) }).addTo(map);
        });
        mapRef.current = { map, L, markers: {} as Record<string, any> };
        setMapLoaded(true);
      } catch (err) { console.error('Map init failed:', err); }
    };
    initMap();
    return () => { cancelled = true; };
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !myLocation) return;
    const { map, L, markers } = mapRef.current;
    if (markers['me']) markers['me'].setLatLng([myLocation.lat, myLocation.lng]);
    else {
      markers['me'] = L.marker([myLocation.lat, myLocation.lng], { icon: L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:#2563EB;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.3);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map).bindPopup(`<b>📍 You (${currentUser.name})</b>`);
    }
    const nearest = OFFICES.map(o => ({ ...o, dist: haversine(myLocation.lat, myLocation.lng, o.lat, o.lng) })).sort((a, b) => a.dist - b.dist)[0];
    setEmpLocations(prev => {
      const filtered = prev.filter(l => l.empId !== currentUser.id);
      return [...filtered, { empId: currentUser.id, name: currentUser.name, lat: myLocation.lat, lng: myLocation.lng, isInOffice: nearest.dist <= nearest.radius, nearestOffice: nearest.name, distance: nearest.dist }];
    });
  }, [myLocation, mapLoaded, currentUser]);

  const presentCount = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
  const absentCount = employees.length - todayRecords.length;
  const lateCount = todayRecords.filter(r => r.status === 'late').length;
  const workingNow = todayRecords.filter(r => r.checkIn && !r.checkOut).length;
  const getStatusColor = (s: string) => ({ present: 'bg-emerald-500', late: 'bg-amber-500', absent: 'bg-red-500' }[s] || 'bg-slate-400');

  return (
    <div className={`space-y-4 font-sans transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-2xl p-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🗺️</div>
            <div><h2 className="text-base font-black">GPS Live Map</h2><p className="text-blue-200 text-[10px] font-bold">Office locations & employee tracking</p></div>
          </div>
          <button onClick={loadData} disabled={refreshing} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold border border-white/10 transition-all disabled:opacity-50">{refreshing ? '⟳ ...' : '🔄 Refresh'}</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[{l:'PRESENT',v:presentCount,c:'text-emerald-600',b:'bg-emerald-50 border-emerald-100'},{l:'LATE',v:lateCount,c:'text-amber-600',b:'bg-amber-50 border-amber-100'},{l:'ABSENT',v:absentCount,c:'text-red-600',b:'bg-red-50 border-red-100'},{l:'WORKING',v:workingNow,c:'text-blue-600',b:'bg-blue-50 border-blue-100'}].map(s=>(
          <div key={s.l} className={`${s.b} border rounded-xl p-2.5 text-center`}><p className={`text-lg font-black ${s.c} leading-none`}>{s.v}</p><p className="text-[10px] font-bold text-slate-400 mt-1">{s.l}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
          <div ref={mapContainerRef} className="w-full h-[400px] lg:h-[500px]" />
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
            {OFFICES.map(o=>(<span key={o.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><span className="w-2.5 h-2.5 rounded-full" style={{background:o.color}}/>{o.name} ({o.radius}m)</span>))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100"><h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Today's Attendance</h3></div>
          <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-50">
            {employees.map(emp => {
              const rec = todayRecords.find(r => r.employeeId === emp.id);
              const status = rec ? rec.status : 'absent';
              const checkIn = rec?.checkIn ? new Date(rec.checkIn).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) : null;
              const locInfo = empLocations.find(l => l.empId === emp.id);
              return (
                <div key={emp.id} className={`px-4 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedEmp===emp.id?'bg-blue-50':''}`} onClick={()=>setSelectedEmp(selectedEmp===emp.id?null:emp.id)}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white text-[9px] font-black">{getInitials(emp.name)}</div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(status)}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{emp.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold capitalize ${status==='present'?'text-emerald-600':status==='late'?'text-amber-600':'text-red-500'}`}>{status}</span>
                        {checkIn && <span className="text-[10px] text-slate-400">• In: {checkIn}</span>}
                      </div>
                    </div>
                    {rec && !rec.checkOut && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">LIVE</span>}
                  </div>
                  {selectedEmp===emp.id && (
                    <div className="mt-2 ml-10 space-y-1">
                      {rec && <>
                        <p className="text-[10px] text-slate-500">Check In: <span className="font-bold text-slate-700">{checkIn||'—'}</span></p>
                        {rec.checkOut && <p className="text-[10px] text-slate-500">Check Out: <span className="font-bold text-slate-700">{new Date(rec.checkOut).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></p>}
                        {rec.totalHours>0 && <p className="text-[10px] text-slate-500">Hours: <span className="font-bold text-blue-600">{rec.totalHours.toFixed(1)}h</span></p>}
                      </>}
                      {locInfo && <p className="text-[10px] text-slate-500">📍 {locInfo.isInOffice?`Inside ${locInfo.nearestOffice}`:`${formatDist(locInfo.distance)} from ${locInfo.nearestOffice}`}</p>}
                      {!rec && <p className="text-[10px] text-red-400 font-medium">Did not check in today</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {myLocation && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OFFICES.map(office => {
            const dist = haversine(myLocation.lat, myLocation.lng, office.lat, office.lng);
            const isInside = dist <= office.radius;
            return (
              <div key={office.name} className={`rounded-xl p-3 border ${isInside?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:office.color}}/><span className="text-xs font-black text-slate-800">{office.name}</span>{isInside&&<span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">INSIDE</span>}</div>
                <p className={`text-lg font-black mt-1 ${isInside?'text-emerald-600':'text-slate-600'}`}>{formatDist(dist)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
