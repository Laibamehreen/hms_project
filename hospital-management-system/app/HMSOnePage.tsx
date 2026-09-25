"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Users, Plus, X, CheckCircle2, AlertCircle, 
  Thermometer, HeartPulse, Wind, Edit3, Trash2, ShieldAlert, Hotel,
  Search, Filter, Stethoscope, Pill, Printer, FileText, Clock, Bed,
  ArrowUpDown, RefreshCw, AlertTriangle, UserCheck, ChevronRight
} from 'lucide-react';
import { IPatient } from '@/lib/db';

// --- MODAL WRAPPER ---
const Modal = ({ title, children, onClose, maxWidth = "max-w-3xl" }: { 
  title: string; 
  children: React.ReactNode; 
  onClose: () => void;
  maxWidth?: string;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
    <div className={`bg-white rounded-[2.5rem] shadow-2xl w-full ${maxWidth} max-h-[92vh] overflow-hidden flex flex-col border-4 border-slate-900`}>
      <div className="flex justify-between items-center px-8 py-6 border-b-2 border-slate-100 bg-slate-50/80">
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
          {title}
        </h2>
        <button 
          onClick={onClose} 
          className="p-2.5 hover:bg-slate-200 rounded-full transition-colors border border-transparent hover:border-slate-300 cursor-pointer"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <div className="p-8 overflow-y-auto flex-1">{children}</div>
    </div>
  </div>
);

// Ward Capacities for Live Bed Occupancy Widget
const WARD_CAPACITIES: Record<string, { max: number; label: string; icon: string }> = {
  'Ward A (ICU)': { max: 10, label: 'Intensive Care Unit (ICU)', icon: '🚨' },
  'Ward B (General)': { max: 30, label: 'General Medicine Ward', icon: '🏥' },
  'Ward C (Pediatrics)': { max: 15, label: 'Pediatrics Department', icon: '🧸' },
  'ER Cabin 1': { max: 6, label: 'Emergency Trauma Bay', icon: '⚡' },
};

export default function HMSOnePage() {
  const [activeModal, setActiveModal] = useState<'intake' | 'details' | 'quick-vitals' | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<IPatient | null>(null);
  const [activeDossierTab, setActiveDossierTab] = useState<'overview' | 'clinical' | 'discharge'>('overview');
  const [notification, setNotification] = useState<{ message: string; isError?: boolean } | null>(null);
  const [patientsList, setPatientsList] = useState<IPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'mongodb' | 'in-memory'>('in-memory');

  // Search & Filter Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'All' | 'In-Patient' | 'Critical' | 'Discharged'>('In-Patient');
  const [wardFilter, setWardFilter] = useState<string>('All');
  const [triageFilter, setTriageFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'risk' | 'name' | 'age'>('risk');

  // Form State
  const initialFormData = {
    name: "",
    age: "",
    gender: "Male",
    bloodGroup: "O+",
    triage: "Level 3 - Routine",
    ward: "Ward B (General)",
    diagnosis: "",
    attendingDoctor: "Dr. Sarah Chen, MD",
    temp: "98.6",
    bp: "120/80",
    pulse: "72",
    spO2: "98",
    allergies: "",
    medications: "",
    pastConditions: ""
  };

  const [formData, setFormData] = useState(initialFormData);

  // Quick Vitals State
  const [quickVitals, setQuickVitals] = useState({ temp: "", bp: "", pulse: "", spO2: "" });

  // Clock
  const [timeString, setTimeString] = useState<string>("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerNotification = (message: string, isError = false) => {
    setNotification({ message, isError });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/patients');
      const data = await res.json();
      const source = (res.headers.get('X-Data-Source') as 'mongodb' | 'in-memory') || 'in-memory';
      setDataSource(source);

      if (res.ok && Array.isArray(data)) {
        setPatientsList(data);
      } else {
        setPatientsList([]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setPatientsList([]);
      triggerNotification("Unable to reach patient service", true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- STATS & ANALYTICS ---
  const analytics = useMemo(() => {
    const list = Array.isArray(patientsList) ? patientsList : [];
    const inPatients = list.filter(p => p.status !== 'Discharged');
    const discharged = list.filter(p => p.status === 'Discharged');

    const criticalList = inPatients.filter(p => {
      const spO2 = parseInt(p.vitals?.spO2 || "100", 10);
      const bpSys = parseInt(p.vitals?.bp?.split('/')[0] || "120", 10);
      return spO2 < 92 || bpSys >= 140;
    });

    // Ward counts for active patients
    const wardCounts: Record<string, number> = {};
    inPatients.forEach(p => {
      if (p.ward) wardCounts[p.ward] = (wardCounts[p.ward] || 0) + 1;
    });

    const totalBeds = Object.values(WARD_CAPACITIES).reduce((acc, w) => acc + w.max, 0);
    const occupiedBeds = inPatients.length;
    const occupancyRate = Math.min(100, Math.round((occupiedBeds / totalBeds) * 100));

    return {
      total: list.length,
      active: inPatients.length,
      critical: criticalList.length,
      discharged: discharged.length,
      occupancyRate,
      occupiedBeds,
      totalBeds,
      wardCounts
    };
  }, [patientsList]);

  // --- FILTERED & SORTED PATIENTS ---
  const filteredPatients = useMemo(() => {
    let list = [...patientsList];

    // Status filter
    if (statusFilter === 'In-Patient') {
      list = list.filter(p => p.status !== 'Discharged');
    } else if (statusFilter === 'Discharged') {
      list = list.filter(p => p.status === 'Discharged');
    } else if (statusFilter === 'Critical') {
      list = list.filter(p => {
        if (p.status === 'Discharged') return false;
        const spO2 = parseInt(p.vitals?.spO2 || "100", 10);
        const bpSys = parseInt(p.vitals?.bp?.split('/')[0] || "120", 10);
        return spO2 < 92 || bpSys >= 140;
      });
    }

    // Ward filter
    if (wardFilter !== 'All') {
      list = list.filter(p => p.ward === wardFilter);
    }

    // Triage filter
    if (triageFilter !== 'All') {
      list = list.filter(p => p.admissionType === triageFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name?.toLowerCase().includes(q) ||
        p.ward?.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.attendingDoctor?.toLowerCase().includes(q) ||
        p.bloodGroup?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'risk') {
        const getRiskScore = (p: IPatient) => {
          let score = 0;
          const spO2 = parseInt(p.vitals?.spO2 || "100", 10);
          const bpSys = parseInt(p.vitals?.bp?.split('/')[0] || "120", 10);
          if (spO2 < 90) score += 5;
          else if (spO2 < 93) score += 3;
          if (bpSys > 160) score += 4;
          else if (bpSys > 140) score += 2;
          if (p.admissionType?.includes('Level 1')) score += 5;
          if (p.admissionType?.includes('Level 2')) score += 3;
          return score;
        };
        return getRiskScore(b) - getRiskScore(a);
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'name') {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === 'age') {
        return (b.age || 0) - (a.age || 0);
      }
      return 0;
    });

    return list;
  }, [patientsList, statusFilter, wardFilter, triageFilter, searchQuery, sortBy]);

  // --- ACTIONS ---
  const openIntakeModal = (preset?: Partial<typeof initialFormData>) => {
    setFormData({ ...initialFormData, ...(preset || {}) });
    setEditingId(null);
    setActiveModal('intake');
  };

  const startEdit = (patient: IPatient) => {
    setFormData({
      name: patient.name || "",
      age: patient.age !== undefined ? String(patient.age) : "",
      gender: patient.gender || "Male",
      bloodGroup: patient.bloodGroup || "O+",
      triage: patient.admissionType || "Level 3 - Routine",
      ward: patient.ward || "Ward B (General)",
      diagnosis: patient.diagnosis || "",
      attendingDoctor: patient.attendingDoctor || "Dr. Sarah Chen, MD",
      temp: patient.vitals?.temp || "98.6",
      bp: patient.vitals?.bp || "120/80",
      pulse: patient.vitals?.pulse || "72",
      spO2: patient.vitals?.spO2 || "98",
      allergies: patient.medicalHistory?.allergies?.join(', ') || "",
      medications: patient.medicalHistory?.currentMedications?.join(', ') || "",
      pastConditions: patient.medicalHistory?.pastConditions?.join(', ') || ""
    });
    setEditingId(patient._id);
    setActiveModal('intake');
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.age) {
      alert("Please provide at least a Patient Name and Age.");
      return;
    }

    const payload: Partial<IPatient> & { id?: string } = {
      name: formData.name.trim(),
      age: parseInt(formData.age, 10) || 0,
      gender: formData.gender,
      bloodGroup: formData.bloodGroup,
      admissionType: formData.triage,
      ward: formData.ward,
      diagnosis: formData.diagnosis || "Under Observation",
      attendingDoctor: formData.attendingDoctor,
      status: 'In-Patient',
      vitals: {
        temp: formData.temp,
        bp: formData.bp,
        pulse: formData.pulse,
        spO2: formData.spO2
      },
      medicalHistory: {
        allergies: formData.allergies ? formData.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
        currentMedications: formData.medications ? formData.medications.split(',').map(s => s.trim()).filter(Boolean) : [],
        pastConditions: formData.pastConditions ? formData.pastConditions.split(',').map(s => s.trim()).filter(Boolean) : []
      }
    };

    if (editingId) payload.id = editingId;

    try {
      const res = await fetch('/api/patients', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        setFormData(initialFormData);
        setEditingId(null);
        await fetchData();
        setActiveModal(null);
        triggerNotification(editingId ? "Patient Clinical Record Updated" : "Admission Confirmed & Synced");
      } else {
        alert(result.error || "Failed to save record");
      }
    } catch (err) {
      console.error(err);
      alert("Network communication error.");
    }
  };

  // Quick Vitals Save
  const openQuickVitals = (patient: IPatient) => {
    setSelectedPatient(patient);
    setQuickVitals({
      temp: patient.vitals?.temp || "98.6",
      bp: patient.vitals?.bp || "120/80",
      pulse: patient.vitals?.pulse || "72",
      spO2: patient.vitals?.spO2 || "98"
    });
    setActiveModal('quick-vitals');
  };

  const handleSaveQuickVitals = async () => {
    if (!selectedPatient) return;
    try {
      const res = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPatient._id,
          vitals: quickVitals
        })
      });
      if (res.ok) {
        await fetchData();
        setActiveModal(null);
        triggerNotification(`Vitals updated for ${selectedPatient.name}`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update vitals");
    }
  };

  // Discharge / Status Change
  const handleToggleDischarge = async (patient: IPatient) => {
    const isDischarging = patient.status !== 'Discharged';
    const confirmMsg = isDischarging 
      ? `Discharge ${patient.name} from ${patient.ward}?`
      : `Re-admit ${patient.name} to active In-Patient registry?`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: patient._id,
          status: isDischarging ? 'Discharged' : 'In-Patient',
          dischargedAt: isDischarging ? new Date().toISOString() : null,
          dischargeNotes: isDischarging ? "Patient clinically stabilized. Released per protocol." : undefined
        })
      });

      if (res.ok) {
        await fetchData();
        if (selectedPatient?._id === patient._id) {
          const updated = await res.json();
          setSelectedPatient(updated);
        }
        triggerNotification(isDischarging ? `${patient.name} Discharged` : `${patient.name} Re-admitted`);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to update discharge status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently purge this clinical record from the database?")) return;
    try {
      const res = await fetch('/api/patients', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchData();
        if (selectedPatient?._id === id) setSelectedPatient(null);
        triggerNotification("Clinical Record Deleted");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete record");
    }
  };

  // Print clinical summary
  const handlePrintRecord = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 font-sans selection:bg-indigo-100">
      
      {/* --- LIVE TOAST NOTIFICATION --- */}
      {notification && (
        <div className={`fixed top-24 right-8 z-[70] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce border-4 ${
          notification.isError ? 'bg-rose-600 border-rose-400' : 'bg-indigo-600 border-indigo-400'
        }`}>
          {notification.isError ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          <span className="font-black uppercase tracking-tight text-sm">{notification.message}</span>
        </div>
      )}

      {/* --- TOP COMMAND NAVIGATION --- */}
      <nav className="bg-white/90 backdrop-blur-md border-b-4 border-slate-100 sticky top-0 z-40 px-6 lg:px-12 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-tr from-indigo-700 to-indigo-500 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
            <Activity className="text-white w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-indigo-950 uppercase">MEDIFLOW</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">HMS v2.4</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Clinical Operations & Oversight</p>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l-2 border-slate-200">
            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1.5 ${
              dataSource === 'mongodb'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-amber-50 text-amber-700 border-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${dataSource === 'mongodb' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {dataSource === 'mongodb' ? 'MongoDB Atlas Connected' : '⚡ In-Memory Demo Mode'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
            <Clock size={14} className="text-slate-500" />
            <span className="font-mono">{timeString || "12:00:00"}</span>
          </div>

          {/* Quick Emergency Code Red Admission */}
          <button
            onClick={() => openIntakeModal({
              ward: 'ER Cabin 1',
              triage: 'Level 1 - Resuscitation',
              diagnosis: 'Trauma / Acute Critical Arrival',
              bp: '160/95',
              pulse: '110',
              spO2: '91'
            })}
            title="Fast Emergency Intake"
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-300 hover:border-rose-400 px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" />
            <span className="hidden sm:inline">CODE RED ER</span>
          </button>

          {/* Standard Admission */}
          <button
            onClick={() => openIntakeModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 border-b-4 border-indigo-900 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> NEW ADMISSION
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto mt-8 px-4 sm:px-6 lg:px-8">
        
        {/* --- HEADER --- */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">Clinical Dashboard</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.25em] text-xs mt-2">
              Real-time In-Patient Census, Vital Alerts & Ward Management
            </p>
          </div>
          <button 
            onClick={fetchData} 
            className="self-start md:self-auto flex items-center gap-2 text-xs font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-all border border-indigo-200 cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Sync Data
          </button>
        </header>

        {/* --- REAL-TIME ANALYTICS GRID --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          <div className="bg-white p-6 rounded-[2rem] border-4 border-slate-100 shadow-xs hover:border-indigo-400 transition-all">
            <div className="p-3 rounded-2xl w-fit bg-indigo-50 text-indigo-600 mb-4">
              <Users size={24} />
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Active In-Patients</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{isLoading ? "..." : analytics.active}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Registry Total: {analytics.total}</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border-4 border-rose-100 shadow-xs hover:border-rose-400 transition-all bg-gradient-to-b from-white to-rose-50/20">
            <div className="p-3 rounded-2xl w-fit bg-rose-50 text-rose-600 mb-4 flex items-center gap-2">
              <ShieldAlert size={24} />
              {analytics.critical > 0 && <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />}
            </div>
            <p className="text-rose-500 font-black text-[10px] uppercase tracking-widest">Critical Alerts</p>
            <p className="text-3xl font-black text-rose-700 mt-1">{isLoading ? "..." : analytics.critical}</p>
            <p className="text-[10px] font-bold text-rose-400 mt-1">SpO2 &lt; 92% or BP &gt; 140</p>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border-4 border-slate-100 shadow-xs hover:border-indigo-400 transition-all">
            <div className="p-3 rounded-2xl w-fit bg-emerald-50 text-emerald-600 mb-4">
              <Bed size={24} />
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Hospital Occupancy</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-black text-slate-900">{isLoading ? "..." : `${analytics.occupancyRate}%`}</p>
              <span className="text-xs font-bold text-slate-400">({analytics.occupiedBeds}/{analytics.totalBeds} beds)</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  analytics.occupancyRate > 85 ? 'bg-rose-500' : analytics.occupancyRate > 65 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${analytics.occupancyRate}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border-4 border-slate-100 shadow-xs hover:border-indigo-400 transition-all">
            <div className="p-3 rounded-2xl w-fit bg-amber-50 text-amber-600 mb-4">
              <UserCheck size={24} />
            </div>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Discharged Records</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{isLoading ? "..." : analytics.discharged}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">Successfully Stabilized</p>
          </div>

        </div>

        {/* --- LIVE WARD CAPACITY BREAKDOWN BAR --- */}
        <div className="bg-white rounded-[2rem] p-6 border-4 border-slate-100 shadow-xs mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Hotel className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Live Ward Census & Bed Allocation</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Click a ward to filter list</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(WARD_CAPACITIES).map(([wardKey, info]) => {
              const count = analytics.wardCounts[wardKey] || 0;
              const pct = Math.min(100, Math.round((count / info.max) * 100));
              const isSelected = wardFilter === wardKey;

              return (
                <button
                  key={wardKey}
                  onClick={() => setWardFilter(isSelected ? 'All' : wardKey)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-300' 
                      : 'border-slate-100 hover:border-slate-300 bg-slate-50/40 hover:bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm font-black text-slate-800 block">{wardKey}</span>
                      <span className="text-[10px] font-bold text-slate-400">{info.label}</span>
                    </div>
                    <span className="text-lg">{info.icon}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs font-black mt-3">
                    <span className="text-slate-700">{count} / {info.max} Beds</span>
                    <span className={pct > 80 ? 'text-rose-600' : pct > 60 ? 'text-amber-600' : 'text-emerald-600'}>
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        pct > 80 ? 'bg-rose-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- SEARCH, FILTER & TAB CONTROLS --- */}
        <div className="bg-white rounded-[2.5rem] border-4 border-slate-100 shadow-xl overflow-hidden mb-12">
          
          <div className="p-6 border-b-2 border-slate-100 space-y-4">
            
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
                {(['In-Patient', 'Critical', 'Discharged', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      statusFilter === tab 
                        ? 'bg-white text-indigo-950 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'In-Patient' && `In-Patients (${analytics.active})`}
                    {tab === 'Critical' && `Critical (${analytics.critical})`}
                    {tab === 'Discharged' && `Discharged (${analytics.discharged})`}
                    {tab === 'All' && `All Records (${analytics.total})`}
                  </button>
                ))}
              </div>

              {/* Reset filter button if active */}
              {(wardFilter !== 'All' || triageFilter !== 'All' || searchQuery) && (
                <button
                  onClick={() => { setWardFilter('All'); setTriageFilter('All'); setSearchQuery(""); }}
                  className="text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 cursor-pointer"
                >
                  Clear Active Filters ✕
                </button>
              )}
            </div>

            {/* Search Bar & Dropdown Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5 relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, diagnosis, doctor, or blood group..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xs font-bold focus:border-indigo-500 focus:bg-white outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={wardFilter}
                  onChange={(e) => setWardFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All">All Wards / Locations</option>
                  {Object.keys(WARD_CAPACITIES).map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={triageFilter}
                  onChange={(e) => setTriageFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="All">All Triage Levels</option>
                  <option value="Level 1 - Resuscitation">Level 1 - Resuscitation</option>
                  <option value="Level 2 - Emergency">Level 2 - Emergency</option>
                  <option value="Level 3 - Routine">Level 3 - Routine</option>
                  <option value="Level 4 - Minor">Level 4 - Minor</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="risk">Sort: Critical Risk</option>
                  <option value="newest">Sort: Newest Arrival</option>
                  <option value="name">Sort: Name (A-Z)</option>
                  <option value="age">Sort: Oldest Age</option>
                </select>
              </div>
            </div>

          </div>

          {/* --- PATIENT REGISTRY TABLE --- */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5">Patient Profile</th>
                  <th className="px-8 py-5">Diagnosis & Attending</th>
                  <th className="px-8 py-5">Ward Location</th>
                  <th className="px-8 py-5">Current Vitals</th>
                  <th className="px-8 py-5">Triage Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-bold text-sm">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading synchronized clinical registry...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-slate-400 font-bold text-sm">
                      No patient records match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p, i) => {
                    const spO2 = parseInt(p.vitals?.spO2 || "100", 10);
                    const bpSys = parseInt(p.vitals?.bp?.split('/')[0] || "120", 10);
                    const isCritical = spO2 < 92 || bpSys >= 140;

                    return (
                      <tr key={p._id || `patient-${i}`} className={`hover:bg-indigo-50/40 transition-colors group ${isCritical && p.status !== 'Discharged' ? 'bg-rose-50/20' : ''}`}>
                        
                        {/* Patient Profile */}
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all border-2 ${
                              isCritical && p.status !== 'Discharged'
                                ? 'bg-rose-100 text-rose-700 border-rose-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200 group-hover:bg-indigo-600 group-hover:text-white'
                            }`}>
                              {p.name ? p.name.charAt(0).toUpperCase() : 'P'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-black text-slate-900 leading-tight">{p.name || 'Unknown'}</p>
                                {p.status === 'Discharged' && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Discharged</span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                {p.age ?? '--'} Yrs • {p.gender || '--'} • <span className="text-rose-600 font-black">{p.bloodGroup || '--'}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Diagnosis */}
                        <td className="px-8 py-5 max-w-xs">
                          <p className="text-xs font-black text-slate-800 truncate">{p.diagnosis || "Observation"}</p>
                          <p className="text-[10px] font-bold text-indigo-600 truncate mt-0.5 flex items-center gap-1">
                            <Stethoscope size={10} /> {p.attendingDoctor || "Unassigned"}
                          </p>
                        </td>

                        {/* Ward */}
                        <td className="px-8 py-5 font-bold text-slate-700 text-xs">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 inline-block">
                            {p.ward || 'General'}
                          </span>
                        </td>

                        {/* Vitals */}
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span 
                              title="Blood Pressure"
                              className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                                bpSys >= 140 
                                  ? 'bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-400' 
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {p.vitals?.bp || '--'}
                            </span>
                            <span 
                              title="Blood Oxygen (SpO2)"
                              className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                                spO2 < 92 
                                  ? 'bg-rose-100 text-rose-700 border-rose-300 ring-1 ring-rose-400 animate-pulse' 
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {p.vitals?.spO2 ? `${p.vitals.spO2}%` : '--'}
                            </span>
                            <span title="Heart Pulse" className="text-[10px] font-bold text-slate-400 hidden xl:inline">
                              {p.vitals?.pulse ? `${p.vitals.pulse} bpm` : ''}
                            </span>
                          </div>
                        </td>

                        {/* Triage */}
                        <td className="px-8 py-5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            p.admissionType?.includes('Level 1')
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : p.admissionType?.includes('Level 2')
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}>
                            {p.admissionType || 'Routine'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end items-center gap-1.5">
                            
                            {/* Quick Vitals Log */}
                            <button
                              onClick={() => openQuickVitals(p)}
                              title="Quick Chart Vitals"
                              className="p-2 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-xl transition-all cursor-pointer"
                            >
                              <HeartPulse size={15} />
                            </button>

                            {/* Edit Admission */}
                            <button
                              onClick={() => startEdit(p)}
                              title="Edit Record"
                              className="p-2 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-xl transition-all cursor-pointer"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Discharge / Readmit toggle */}
                            <button
                              onClick={() => handleToggleDischarge(p)}
                              title={p.status === 'Discharged' ? "Re-admit" : "Discharge Patient"}
                              className={`p-2 rounded-xl transition-all cursor-pointer ${
                                p.status === 'Discharged'
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700'
                              }`}
                            >
                              <UserCheck size={15} />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(p._id)}
                              title="Purge Record"
                              className="p-2 bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>

                            {/* Open Full File */}
                            <button
                              onClick={() => { setSelectedPatient(p); setActiveDossierTab('overview'); }}
                              className="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-600 transition-all uppercase tracking-widest shadow-sm cursor-pointer ml-1"
                            >
                              File
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

      </main>

      {/* ========================================================================= */}
      {/* --- MODAL 1: NEW / EDIT PATIENT INTAKE --- */}
      {/* ========================================================================= */}
      {activeModal === 'intake' && (
        <Modal
          title={editingId ? "Modify Clinical Dossier" : "Patient Intake & Admission Protocol"}
          onClose={() => { setActiveModal(null); setEditingId(null); }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Identity */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Legal Name</label>
              <input
                type="text"
                placeholder="e.g. Margaret Holloway"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none font-bold text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Age (Years)</label>
              <input
                type="number"
                placeholder="e.g. 52"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm cursor-pointer"
              >
                {['Male', 'Female', 'Other'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Blood Group</label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm cursor-pointer"
              >
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => <option key={bg}>{bg}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Triage / Priority</label>
              <select
                value={formData.triage}
                onChange={(e) => setFormData({ ...formData, triage: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm cursor-pointer"
              >
                {['Level 1 - Resuscitation', 'Level 2 - Emergency', 'Level 3 - Routine', 'Level 4 - Minor'].map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Ward & Doctor */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Ward Location</label>
              <select
                value={formData.ward}
                onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm cursor-pointer"
              >
                {Object.keys(WARD_CAPACITIES).map(w => <option key={w}>{w}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attending Physician</label>
              <input
                type="text"
                placeholder="e.g. Dr. Sarah Chen, MD"
                value={formData.attendingDoctor}
                onChange={(e) => setFormData({ ...formData, attendingDoctor: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm"
              />
            </div>

            {/* Primary Diagnosis */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chief Complaint / Primary Diagnosis</label>
              <input
                type="text"
                placeholder="e.g. Acute Respiratory Infection with Fever"
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm"
              />
            </div>

            {/* Medical History */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allergies (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Penicillin, Peanuts"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Medications (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                className="w-full bg-slate-50 p-3.5 rounded-2xl border-2 border-slate-100 outline-none font-bold text-sm"
              />
            </div>

            {/* Initial Vitals Synchronized */}
            <div className="md:col-span-2 pt-4 border-t-2 border-slate-100">
              <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <HeartPulse size={14} /> Intake Vital Signs
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: 'Temp (°F)', k: 'temp', placeholder: '98.6' },
                  { l: 'BP (mmHg)', k: 'bp', placeholder: '120/80' },
                  { l: 'Pulse (bpm)', k: 'pulse', placeholder: '72' },
                  { l: 'SpO2 (%)', k: 'spO2', placeholder: '98' }
                ].map((v) => (
                  <div key={v.k} className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">{v.l}</label>
                    <input
                      className="w-full bg-slate-50 p-3 rounded-xl border-2 border-slate-100 font-black text-xs"
                      placeholder={v.placeholder}
                      value={(formData as any)[v.k]}
                      onChange={(e) => setFormData({ ...formData, [v.k]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="md:col-span-2 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-base border-b-4 border-indigo-900 shadow-xl transition-all cursor-pointer active:scale-[0.99]"
            >
              {editingId ? "Update Clinical Dossier" : "Confirm Admission & Synchronize"}
            </button>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 2: QUICK VITALS LOGGING --- */}
      {/* ========================================================================= */}
      {activeModal === 'quick-vitals' && selectedPatient && (
        <Modal
          title={`Quick Vitals Entry: ${selectedPatient.name}`}
          onClose={() => setActiveModal(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs font-bold text-slate-500">
              Update bedside vitals for {selectedPatient.name} in {selectedPatient.ward}.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Temp (°F)</label>
                <input
                  type="text"
                  value={quickVitals.temp}
                  onChange={(e) => setQuickVitals({ ...quickVitals, temp: e.target.value })}
                  className="w-full bg-slate-50 p-3 rounded-xl border-2 border-slate-100 font-black text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Blood Pressure (mmHg)</label>
                <input
                  type="text"
                  value={quickVitals.bp}
                  onChange={(e) => setQuickVitals({ ...quickVitals, bp: e.target.value })}
                  className="w-full bg-slate-50 p-3 rounded-xl border-2 border-slate-100 font-black text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">Pulse (bpm)</label>
                <input
                  type="text"
                  value={quickVitals.pulse}
                  onChange={(e) => setQuickVitals({ ...quickVitals, pulse: e.target.value })}
                  className="w-full bg-slate-50 p-3 rounded-xl border-2 border-slate-100 font-black text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase">SpO2 Oxygen (%)</label>
                <input
                  type="text"
                  value={quickVitals.spO2}
                  onChange={(e) => setQuickVitals({ ...quickVitals, spO2: e.target.value })}
                  className="w-full bg-slate-50 p-3 rounded-xl border-2 border-slate-100 font-black text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleSaveQuickVitals}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-black text-sm border-b-4 border-indigo-900 cursor-pointer"
            >
              Update Vitals Chart
            </button>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 3: COMPREHENSIVE PATIENT DOSSIER --- */}
      {/* ========================================================================= */}
      {selectedPatient && activeModal !== 'quick-vitals' && (
        <Modal
          title={`Clinical File: ${selectedPatient.name}`}
          onClose={() => setSelectedPatient(null)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            
            {/* Dossier Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900">{selectedPatient.name}</h3>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    selectedPatient.status === 'Discharged' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedPatient.status || 'In-Patient'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Record ID: <span className="font-mono">{selectedPatient._id}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintRecord}
                  className="flex items-center gap-1.5 text-xs font-black bg-white hover:bg-slate-100 text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs cursor-pointer"
                >
                  <Printer size={14} /> Print Summary
                </button>
                <button
                  onClick={() => handleToggleDischarge(selectedPatient)}
                  className={`text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer ${
                    selectedPatient.status === 'Discharged'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {selectedPatient.status === 'Discharged' ? 'Re-admit Patient' : 'Discharge Patient'}
                </button>
              </div>
            </div>

            {/* Dossier Tabs */}
            <div className="flex border-b-2 border-slate-100 gap-6">
              {[
                { id: 'overview', label: 'Vitals & Overview' },
                { id: 'clinical', label: 'Medical History & Rx' },
                { id: 'discharge', label: 'Discharge & Notes' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveDossierTab(t.id as any)}
                  className={`pb-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 -mb-0.5 ${
                    activeDossierTab === t.id 
                      ? 'border-indigo-600 text-indigo-600' 
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW & VITALS */}
            {activeDossierTab === 'overview' && (
              <div className="space-y-6">
                
                {/* 4 Interactive Vitals Cards with Clinical Interpretations */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Body Temp',
                      val: selectedPatient.vitals?.temp ? `${selectedPatient.vitals.temp}°F` : '--',
                      icon: <Thermometer size={16} />,
                      status: parseFloat(selectedPatient.vitals?.temp || "98.6") > 100.4 ? 'Fever Spike' : 'Normal',
                      bg: 'bg-amber-50/50', border: 'border-amber-200', text: 'text-amber-700'
                    },
                    {
                      label: 'Blood Pressure',
                      val: selectedPatient.vitals?.bp || '--',
                      icon: <Activity size={16} />,
                      status: parseInt(selectedPatient.vitals?.bp?.split('/')[0] || "120") >= 140 ? 'Hypertensive' : 'Optimal',
                      bg: 'bg-rose-50/50', border: 'border-rose-200', text: 'text-rose-700'
                    },
                    {
                      label: 'Heart Rate',
                      val: selectedPatient.vitals?.pulse ? `${selectedPatient.vitals.pulse} bpm` : '--',
                      icon: <HeartPulse size={16} />,
                      status: parseInt(selectedPatient.vitals?.pulse || "72") > 100 ? 'Tachycardia' : 'Stable',
                      bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-700'
                    },
                    {
                      label: 'SpO2 Oxygen',
                      val: selectedPatient.vitals?.spO2 ? `${selectedPatient.vitals.spO2}%` : '--',
                      icon: <Wind size={16} />,
                      status: parseInt(selectedPatient.vitals?.spO2 || "100") < 92 ? 'Hypoxia Alert' : 'Saturated',
                      bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-700'
                    }
                  ].map((v, i) => (
                    <div key={i} className={`${v.bg} p-4 rounded-3xl border-2 ${v.border}`}>
                      <div className={`flex items-center justify-between mb-1 ${v.text}`}>
                        <div className="flex items-center gap-1.5 font-black text-[10px] uppercase">
                          {v.icon} {v.label}
                        </div>
                      </div>
                      <p className="text-2xl font-black text-slate-900 mt-1">{v.val}</p>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-2 ${
                        v.status.includes('Alert') || v.status.includes('Fever') || v.status.includes('Hypertensive')
                          ? 'bg-rose-200 text-rose-800'
                          : 'bg-slate-200/60 text-slate-700'
                      }`}>
                        {v.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demographic Profile</h4>
                    <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Age & Gender</span> <span>{selectedPatient.age} Yrs / {selectedPatient.gender}</span></div>
                    <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Blood Group</span> <span className="text-rose-600 font-black">{selectedPatient.bloodGroup}</span></div>
                    <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Ward & Bed</span> <span className="text-slate-800">{selectedPatient.ward}</span></div>
                    <div className="flex justify-between text-xs font-bold"><span className="text-slate-500">Triage Priority</span> <span className="text-indigo-600">{selectedPatient.admissionType}</span></div>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100 space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Care Team & Diagnosis</h4>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Primary Diagnosis</span>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{selectedPatient.diagnosis || "Under Evaluation"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500">Attending Physician</span>
                      <p className="text-xs font-black text-indigo-700 mt-0.5">{selectedPatient.attendingDoctor || "Unassigned"}</p>
                    </div>
                  </div>
                </div>

                {/* Clinical Alert */}
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-900">Safety & Monitoring Protocol</p>
                    <p className="text-[11px] font-bold text-amber-800/80 leading-relaxed mt-0.5">
                      Standard protocol: Re-check telemetry and vital signs every 4 hours. Keep telemetry synced with hospital central station.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: MEDICAL HISTORY & PRESCRIPTIONS */}
            {activeDossierTab === 'clinical' && (
              <div className="space-y-5">
                
                {/* Allergies */}
                <div className="bg-rose-50/60 p-5 rounded-3xl border border-rose-200">
                  <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Documented Allergies
                  </h4>
                  {selectedPatient.medicalHistory?.allergies && selectedPatient.medicalHistory.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.medicalHistory.allergies.map((allergy, i) => (
                        <span key={i} className="px-3 py-1 bg-white text-rose-800 text-xs font-black rounded-xl border border-rose-200 shadow-2xs">
                          ⚠️ {allergy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-500 italic">No drug or food allergies on record (NKDA).</p>
                  )}
                </div>

                {/* Current Medications / Rx */}
                <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Pill size={14} /> Active Prescriptions & Medications
                  </h4>
                  {selectedPatient.medicalHistory?.currentMedications && selectedPatient.medicalHistory.currentMedications.length > 0 ? (
                    <div className="divide-y divide-slate-200/60">
                      {selectedPatient.medicalHistory.currentMedications.map((med, i) => (
                        <div key={i} className="py-2.5 flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800">{med}</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">Active</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-500 italic">No active pharmacological orders entered.</p>
                  )}
                </div>

                {/* Past Medical History */}
                <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                    Past Medical Conditions
                  </h4>
                  {selectedPatient.medicalHistory?.pastConditions && selectedPatient.medicalHistory.pastConditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedPatient.medicalHistory.pastConditions.map((cond, i) => (
                        <span key={i} className="px-3 py-1 bg-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200">
                          {cond}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-500 italic">No significant past history noted.</p>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: DISCHARGE & NOTES */}
            {activeDossierTab === 'discharge' && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-5 rounded-3xl border-2 border-slate-100 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Discharge Summary & Instructions
                  </h4>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">
                    {selectedPatient.dischargeNotes || "Patient is currently undergoing active treatment. No discharge summary generated yet."}
                  </p>
                  {selectedPatient.dischargedAt && (
                    <p className="text-[10px] font-bold text-slate-400">
                      Discharged on: {new Date(selectedPatient.dischargedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black text-indigo-950">Discharge Workflow</p>
                    <p className="text-[11px] font-bold text-indigo-700">
                      Toggle active admission status or finalize patient checkout.
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleDischarge(selectedPatient)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    {selectedPatient.status === 'Discharged' ? 'Re-admit Patient' : 'Discharge Patient'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}

    </div>
  );
}