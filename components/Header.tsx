'use client';

import React from 'react';
import {
  ShieldCheck,
  UserCheck,
  MapPin,
  Database,
  Camera,
  Users,
  Settings,
  LogOut,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Employee } from '@/types/attendance';

interface Props {
  activeTab: 'register' | 'attendance' | 'admin';
  setActiveTab: (tab: 'register' | 'attendance' | 'admin') => void;
  currentEmployee: Employee | null;
  onLogout: () => void;
  onOpenSupabaseConfig: () => void;
  isSupabaseConfigured: boolean;
  modelsLoaded: boolean;
  modelLoadingMessage?: string;
}

export function Header({
  activeTab,
  setActiveTab,
  currentEmployee,
  onLogout,
  onOpenSupabaseConfig,
  isSupabaseConfigured,
  modelsLoaded,
  modelLoadingMessage,
}: Props) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between py-3 gap-3 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  Smart Attendance
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Biometric + Geo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Face Verification & Geofence Authorization
              </p>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Engine Status */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-950 border border-slate-800">
              {modelsLoaded ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-medium">Face AI Ready</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-amber-300 text-[11px]">
                    {modelLoadingMessage || 'Loading AI...'}
                  </span>
                </>
              )}
            </div>

            {/* Supabase connection pill */}
            <button
              onClick={onOpenSupabaseConfig}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                isSupabaseConfigured
                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
              title="Click to configure Supabase or view SQL schema"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {isSupabaseConfigured ? 'Supabase Active' : 'Local Storage Mode'}
              </span>
              <span className="sm:hidden">DB</span>
            </button>

            {/* User Profile / Logout */}
            {currentEmployee ? (
              <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
                <div className="flex items-center gap-2 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  {currentEmployee.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentEmployee.photo_url}
                      alt={currentEmployee.name}
                      className="w-6 h-6 rounded-full object-cover border border-emerald-500/50"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-bold">
                      {currentEmployee.name.charAt(0)}
                    </div>
                  )}
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-medium text-slate-200 leading-none">
                      {currentEmployee.name}
                    </p>
                    <p className="text-[10px] font-mono text-emerald-400 leading-none mt-0.5">
                      {currentEmployee.employee_id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 transition"
                  title="Log out employee"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 pt-2 pb-2.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'register'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>1. Register / Sign In</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>2. Mark Attendance</span>
            {currentEmployee && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping hidden sm:inline-block" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition whitespace-nowrap ml-auto ${
              activeTab === 'admin'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>3. Admin</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
