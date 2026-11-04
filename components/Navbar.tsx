'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  ClipboardList,
  LogOut,
  Shield,
} from 'lucide-react';
import { Employee } from '@/types/attendance';

interface Props {
  activeTab: 'today' | 'calendar' | 'history';
  setActiveTab: (tab: 'today' | 'calendar' | 'history') => void;
  currentEmployee: Employee;
  onLogout: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  currentEmployee,
  onLogout,
}: Props) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top Header Row */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs font-bold text-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Hameem Textiles
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200/60">
                  Workforce Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                Workplace Attendance & Time Tracking
              </p>
            </div>
          </div>

          {/* Right: Live Clock & Employee Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Clock Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span className="font-semibold text-slate-800">{currentTime}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">{currentDate}</span>
            </div>

            {/* Employee Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
              {currentEmployee.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentEmployee.photo_url}
                  alt={currentEmployee.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                  {currentEmployee.name.charAt(0)}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentEmployee.name}
                </p>
                <p className="text-[10px] font-mono text-slate-500 leading-tight">
                  {currentEmployee.employee_id} • {currentEmployee.department || 'Staff'}
                </p>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Sign out of portal"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Bar Row - Middle Aligned */}
        <nav className="flex items-center justify-center gap-2 sm:gap-3 py-2.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
              activeTab === 'today'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Today&apos;s Shift</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
              activeTab === 'calendar'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Interactive Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
              activeTab === 'history'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Timesheet Logs</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
