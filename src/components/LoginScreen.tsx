// src/components/LoginScreen.tsx

import { useState, useEffect, useRef } from 'react';
import { Employee } from '../types';
import { getEmployees, addAccountRequest, bindEmployeeDevice } from '../store';

interface LoginScreenProps { onLogin: (employee: Employee) => void; }

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  // Yeh poori file ab waisi hi hai jaisi aapne pehle di thi, bina kisi update/debug logic ke
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'select' | 'pin'>('select');
  const searchRef = useRef<HTMLInputElement>(null);
  const employees = getEmployees();
  const filtered = search ? employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : employees;

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const selectEmp = (emp: Employee) => {
    setSelectedEmployee(emp); setShowList(false); setSearch(''); setPin(''); setError('');
    setTimeout(() => setPhase('pin'), 50);
  };

  const getDeviceUUID = () => {
    let uuid = localStorage.getItem('attendify_device_uuid');
    if (!uuid) {
      uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('attendify_device_uuid', uuid);
    }
    return uuid;
  };

  const handleLogin = async () => {
    if (!selectedEmployee) return;
    const latest = getEmployees().find(e => e.id === selectedEmployee.id);
    if (!latest || pin !== latest.pin) {
      setError('Incorrect PIN'); 
      setPin(''); 
      return;
    }
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      onLogin(latest);
      return;
    }
    const currentDeviceUUID = getDeviceUUID();
    if (!latest.device_id) {
      try {
        await bindEmployeeDevice(latest.id, currentDeviceUUID);
        const updatedEmployee = { ...latest, device_id: currentDeviceUUID };
        onLogin(updatedEmployee);
      } catch (err) {
        setError('Device binding failed. Please try again.');
        setPin('');
      }
    } else if (latest.device_id === currentDeviceUUID) {
      onLogin(latest);
    } else {
      setError("🚫 Access Denied! Aap kisi doosre mobile se login kar rahe hain. Kripya apne registered device ka istemal karein ya Admin se device reset karwayein.");
      setPin('');
    }
  };

  const handlePinInput = (d: string) => { if (pin.length < 4) { setPin(pin + d); setError(''); } };
  const goBack = () => { setPhase('select'); setTimeout(() => setSelectedEmployee(null), 300); setPin(''); setError(''); };
  const handleCreate = () => {
    if (!newName.trim()) { setCreateMsg('Enter your name'); return; }
    if (newPin.length !== 4) { setCreateMsg('PIN must be 4 digits'); return; }
    addAccountRequest({ id: `req-${Date.now()}`, name: newName.trim(), pin: newPin, requestedAt: new Date().toISOString(), status: 'pending' });
    setCreateMsg('Request sent! Wait for admin approval.');
    setNewName(''); setNewPin('');
    setTimeout(() => { setCreateMsg(''); setShowCreate(false); }, 3000);
  };

  // ... baaki poora JSX waisa hi rahega, bina kisi debug box ke ...
  if (showCreate) { return ( <div>...</div> ) }
  return ( <div>...</div> )
}
