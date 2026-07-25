import { useState, useEffect, useCallback, useRef } from 'react';
import { Employee, AttendanceRecord } from '../types';
import { getEmployees, getAttendanceEmployees, getAttendanceRecords, getPKTDateString, syncAll, getEmployeeLocations, getOfficeLocations, EmployeeLocationData } from '../store';

interface GPSLiveMapProps { currentUser: Employee; }

const COLORS = ['#2563EB', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
function getOffices() {
  try {
    const locs = getOfficeLocations();
    if (locs && locs.length > 0 && locs[0].lat) {
      return locs.filter(l => l.is_active && l.lat && l.lng).map((l, i) => ({
        name: l.name, lat: l.lat!, lng: l.lng!, radius: l.radius || 200, color: COLORS[i % COLORS.length],
      }));
    }
  } catch {}
  return [
    { name: 'QC Center', lat: 24.856917, lng: 67.111833, radius: 150, color: '#2563EB' },
    { name: 'PK Zone',   lat: 24.825222, lng: 67.247472, radius: 800, color: '#10b981' },
    { name: 'Z House',   lat: 24.882889, lng: 67.073278, radius: 500, color: '#8b5cf6' },
  ];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; const dLat = (lat2-lat1)*Math.PI/180; const dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const getInitials = (n: string) => n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const formatDist = (m: number) => m<1000 ? `${Math.round(m)}m` : `${(m/1000).toFixed(1)}km`;

export default function GPSLiveMap({ currentUser }: GPSLiveMapProps) {
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [empLocations, setEmpLocations] = useState<EmployeeLocationData[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string|null>(null);
  const [myLocation, setMyLocation] = useState<{lat:number;lng:number}|null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTimeout(()=>setMounted(true),50); }, []);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try { await syncAll(); setEmployees(getAttendanceEmployees()); setTodayRecords(getAttendanceRecords().filter(r=>r.date===getPKTDateString())); setEmpLocations(getEmployeeLocations()); } catch {}
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); const i=setInterval(loadData,30000); return ()=>clearInterval(i); }, [loadData]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const wid = navigator.geolocation.watchPosition(pos=>setMyLocation({lat:pos.coords.latitude,lng:pos.coords.longitude}),()=>{},{enableHighAccuracy:true,maximumAge:30000,timeout:10000});
    return ()=>navigator.geolocation.clearWatch(wid);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        // @ts-ignore
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({ iconRetinaUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png', iconUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png' });
        if (cancelled||!mapContainerRef.current) return;
        const map = L.map(mapContainerRef.current, {center:[24.855,67.15],zoom:12,zoomControl:false});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
        L.control.zoom({position:'topright'}).addTo(map);
        getOffices().forEach(o => {
          L.circle([o.lat,o.lng],{radius:o.radius,color:o.color,fillColor:o.color,fillOpacity:0.08,weight:2,dashArray:'6,4'}).addTo(map);
          L.marker([o.lat,o.lng],{icon:L.divIcon({className:'',html:`<div style="background:${o.color};color:white;padding:3px 8px;border-radius:6px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid white">🏢 ${o.name}</div>`,iconSize:[0,0],iconAnchor:[40,12]})}).addTo(map);
        });
        mapRef.current = {map,L,markers:{} as Record<string,any>};
        setMapLoaded(true);
      } catch(err) { console.error('Map init failed:',err); }
    })();
    return ()=>{cancelled=true;};
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapRef.current||!mapLoaded) return;
    const {map,L,markers} = mapRef.current;
    if (myLocation) {
      if (markers['me']) markers['me'].setLatLng([myLocation.lat,myLocation.lng]);
      else markers['me'] = L.marker([myLocation.lat,myLocation.lng],{icon:L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#2563EB;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.3)"></div>`,iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map).bindPopup(`<b>📍 You (${currentUser.name})</b>`);
    }
    empLocations.forEach(loc => {
      if (loc.empId===currentUser.id&&myLocation) return;
      const key=`emp-${loc.empId}`;
      const isWorking = loc.status!=='checked-out'&&loc.status!=='absent';
      const dotColor = isWorking?'#10b981':'#94a3b8';
      const ini = getInitials(loc.name);
      const html = `<div style="display:flex;align-items:center;gap:4px"><div style="width:28px;height:28px;background:linear-gradient(135deg,#1E40AF,#2563EB);border:2px solid white;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${ini}</div><div style="background:white;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;color:#1e293b;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap;border:1px solid #e2e8f0"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:3px"></span>${loc.name.split(' ')[0]}</div></div>`;
      if (markers[key]) markers[key].setLatLng([loc.latitude,loc.longitude]);
      else markers[key] = L.marker([loc.latitude,loc.longitude],{icon:L.divIcon({className:'',html,iconSize:[0,0],iconAnchor:[14,14]})}).addTo(map).bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>${loc.name}</b><br/>Status: ${loc.status}<br/>Since: ${new Date(loc.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>`);
    });
    Object.keys(markers).forEach(key=>{if(key.startsWith('emp-')&&!empLocations.find(l=>l.empId===key.replace('emp-',''))){markers[key].remove();delete markers[key];}});
  }, [empLocations,myLocation,mapLoaded,currentUser]);

  const presentCount=todayRecords.filter(r=>r.status==='present'||r.status==='late').length;
  const absentCount=employees.length-todayRecords.length;
  const lateCount=todayRecords.filter(r=>r.status==='late').length;
  const workingNow=todayRecords.filter(r=>r.checkIn&&!r.checkOut).length;
  const trackedCount=empLocations.filter(l=>l.status!=='checked-out'&&l.status!=='absent').length;
  const getStatusColor=(s:string)=>({present:'bg-emerald-500',late:'bg-amber-500',absent:'bg-red-500','checked-out':'bg-slate-400'}[s]||'bg-slate-400');
  const getStatusText=(s:string)=>({present:'text-emerald-600',late:'text-amber-600',absent:'text-red-500','checked-out':'text-slate-500'}[s]||'text-slate-500');

  return (
    <div className={`space-y-4 font-sans transition-all duration-500 ${mounted?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}>
      <div className="bg-gradient-to-r from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] rounded-2xl p-4 text-white relative overflow-hidden shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"/>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">🗺️</div><div><h2 className="text-base font-black">GPS Live Map</h2><p className="text-blue-200 text-[10px] font-bold">{trackedCount>0?`📡 ${trackedCount} employee${trackedCount>1?'s':''} tracked live`:'Office locations & tracking'}</p></div></div>
          <button onClick={loadData} disabled={refreshing} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold border border-white/10 transition-all disabled:opacity-50">{refreshing?'⟳ ...':'🔄 Refresh'}</button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[{l:'PRESENT',v:presentCount,c:'text-emerald-600',b:'bg-emerald-50 border-emerald-100'},{l:'LATE',v:lateCount,c:'text-amber-600',b:'bg-amber-50 border-amber-100'},{l:'ABSENT',v:absentCount,c:'text-red-600',b:'bg-red-50 border-red-100'},{l:'WORKING',v:workingNow,c:'text-blue-600',b:'bg-blue-50 border-blue-100'},{l:'TRACKED',v:trackedCount,c:'text-purple-600',b:'bg-purple-50 border-purple-100'}].map(s=>(
          <div key={s.l} className={`${s.b} border rounded-xl p-2 text-center`}><p className={`text-lg font-black ${s.c} leading-none`}>{s.v}</p><p className="text-[9px] font-bold text-slate-400 mt-0.5">{s.l}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
          <div ref={mapContainerRef} className="w-full h-[400px] lg:h-[500px]"/>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3">
            {getOffices().map(o=>(<span key={o.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><span className="w-2 h-2 rounded-full" style={{background:o.color}}/>{o.name}</span>))}
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500 ring-2 ring-blue-200"/>You</span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500"/>Employee</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100"><h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Team Status</h3></div>
          <div className="flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-50">
            {employees.map(emp=>{
              const rec=todayRecords.find(r=>r.employeeId===emp.id);
              const status=rec?(rec.checkOut?'checked-out':rec.status):'absent';
              const checkIn=rec?.checkIn?new Date(rec.checkIn).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}):null;
              const loc=empLocations.find(l=>l.empId===emp.id);
              const nearest=loc?getOffices().map(o=>({...o,dist:haversine(loc.latitude,loc.longitude,o.lat,o.lng)})).sort((a,b)=>a.dist-b.dist)[0]:null;
              return (
                <div key={emp.id} className={`px-4 py-2.5 hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedEmp===emp.id?'bg-blue-50':''}`}
                  onClick={()=>{setSelectedEmp(selectedEmp===emp.id?null:emp.id);if(loc&&mapRef.current)mapRef.current.map.flyTo([loc.latitude,loc.longitude],15,{duration:0.5});}}>
                  <div className="flex items-center gap-2.5">
                    <div className="relative"><div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center text-white text-[9px] font-black">{getInitials(emp.name)}</div><span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(status)}`}/></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{emp.name}</p><div className="flex items-center gap-1.5"><span className={`text-[10px] font-bold capitalize ${getStatusText(status)}`}>{status==='checked-out'?'Done':status}</span>{checkIn&&<span className="text-[10px] text-slate-400">• {checkIn}</span>}</div></div>
                    <div className="flex items-center gap-1 shrink-0">
                      {loc&&status!=='absent'&&<span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">📍</span>}
                      {rec&&!rec.checkOut&&<span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">LIVE</span>}
                    </div>
                  </div>
                  {selectedEmp===emp.id&&(
                    <div className="mt-2 ml-10 space-y-1 pb-1">
                      {rec&&<><p className="text-[10px] text-slate-500">In: <span className="font-bold text-slate-700">{checkIn||'—'}</span></p>{rec.checkOut&&<p className="text-[10px] text-slate-500">Out: <span className="font-bold text-slate-700">{new Date(rec.checkOut).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span></p>}{rec.totalHours>0&&<p className="text-[10px] text-slate-500">Hours: <span className="font-bold text-blue-600">{rec.totalHours.toFixed(1)}h</span></p>}</>}
                      {loc&&nearest?<p className="text-[10px] text-slate-500">📍 {nearest.dist<=nearest.radius?<span className="text-emerald-600 font-bold">Inside {nearest.name}</span>:<span>{formatDist(nearest.dist)} from {nearest.name}</span>}</p>:status!=='absent'?<p className="text-[10px] text-slate-400 italic">No GPS data</p>:null}
                      {!rec&&<p className="text-[10px] text-red-400 font-medium">Absent today</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {myLocation&&(
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {getOffices().map(o=>{const dist=haversine(myLocation.lat,myLocation.lng,o.lat,o.lng);const inside=dist<=o.radius;return(
            <div key={o.name} className={`rounded-xl p-3 border ${inside?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:o.color}}/><span className="text-xs font-black text-slate-800">{o.name}</span>{inside&&<span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">INSIDE</span>}</div>
              <p className={`text-lg font-black mt-1 ${inside?'text-emerald-600':'text-slate-600'}`}>{formatDist(dist)}</p>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
