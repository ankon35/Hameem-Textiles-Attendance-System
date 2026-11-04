'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { AuthPortal } from '@/components/AuthPortal';
import { TodayPunchTab } from '@/components/TodayPunchTab';
import { InteractiveCalendarTab } from '@/components/InteractiveCalendarTab';
import { TimesheetLogTab } from '@/components/TimesheetLogTab';
import { ManagerDashboard } from '@/components/ManagerDashboard';
import { Employee } from '@/types/attendance';
import { loadFaceApiModels } from '@/lib/faceApi';
import { Shield } from 'lucide-react';

const STORAGE_KEY_USER = 'hameem_active_user';

export default function Home() {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER) || localStorage.getItem('attendpulse_active_user');
      if (stored) return JSON.parse(stored);
      const legacy = localStorage.getItem('smart_attendance_active_employee');
      if (legacy) return JSON.parse(legacy);
      return null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<'today' | 'calendar' | 'history'>('today');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Background initialization of face recognition models
  useEffect(() => {
    let mounted = true;
    loadFaceApiModels()
      .then(() => {
        if (mounted) setModelsLoaded(true);
      })
      .catch((err) => {
        console.warn('Face models background load info:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = (employee: Employee) => {
    setCurrentEmployee(employee);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(employee));
    } catch (e) {
      console.warn('Storage save warning:', e);
    }
    setActiveTab('today');
  };

  const handleLogout = () => {
    setCurrentEmployee(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem('smart_attendance_active_employee');
    } catch (e) {
      console.warn('Storage remove warning:', e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* 1. If Not Signed In: Show Auth Portal */}
      {!currentEmployee ? (
        <main className="flex-1 flex flex-col justify-center items-center">
          <AuthPortal
            onEmployeeLoggedIn={handleLogin}
            modelsLoaded={modelsLoaded}
          />
        </main>
      ) : currentEmployee.is_manager ? (
        /* 2. If Signed In as Manager: Show Full Manager Dashboard */
        <ManagerDashboard
          currentEmployee={currentEmployee}
          onLogout={handleLogout}
        />
      ) : (
        /* 3. If Signed In as Employee: Show Employee Shift & Attendance Console */
        <>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentEmployee={currentEmployee}
            onLogout={handleLogout}
          />

          <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {activeTab === 'today' && (
              <TodayPunchTab
                currentEmployee={currentEmployee}
                onRefreshData={() => {}}
              />
            )}

            {activeTab === 'calendar' && (
              <InteractiveCalendarTab currentEmployee={currentEmployee} />
            )}

            {activeTab === 'history' && <TimesheetLogTab />}
          </main>
        </>
      )}

      {/* Corporate Soft Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-5 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-semibold text-slate-700">Hameem Textiles</span>
            <span>•</span>
            <span>Enterprise Workforce Attendance & Time Tracking</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Biometric Security Standard</span>
            <span>•</span>
            <span>All Data Encrypted</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
