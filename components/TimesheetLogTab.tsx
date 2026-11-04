'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LogIn,
  LogOut,
  Clock,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { AttendanceLog } from '@/types/attendance';
import { fetchAttendanceLogs } from '@/lib/supabase';

export function TimesheetLogTab() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'face_mismatch'>('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAttendanceLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function fetchAllLogs() {
      try {
        const data = await fetchAttendanceLogs();
        if (!active) return;
        setLogs(data);
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAllLogs();

    return () => {
      active = false;
    };
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      log.employee_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Employee ID', 'Employee Name', 'Punch Type', 'Status', 'Biometric Score'];
    const rows = logs.map((l) => [
      l.captured_at,
      l.employee_id,
      `"${l.employee_name || 'Staff'}"`,
      l.punch_type || 'check_in',
      l.status,
      l.face_distance ?? 'N/A',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hameem_Textiles_Timesheet_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Workforce Timesheet Records
          </h2>
          <p className="text-xs text-slate-500">
            Audit logs of biometric check-ins, check-outs, and shift records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Logs ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('present')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              statusFilter === 'present'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Verified Only
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('face_mismatch')}
            className={`px-3 py-1 rounded-lg transition font-medium ${
              statusFilter === 'face_mismatch'
                ? 'bg-rose-600 text-white font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Mismatches
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="text-xs">Loading timesheet records...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p className="text-sm font-medium text-slate-600">No records found matching your filter</p>
          <p className="text-xs text-slate-400 mt-1">Check-in and check-out punches will be recorded here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Punch Type</th>
                <th className="py-3 px-4">Biometric Status</th>
                <th className="py-3 px-4">Similarity Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const isCheckIn = log.punch_type === 'check_in';
                const isPresent = log.status === 'present';

                return (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {new Date(log.captured_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      <span className="text-slate-400">at</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {new Date(log.captured_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {log.employee_name || 'Staff Member'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {log.employee_id}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                          isCheckIn
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {isCheckIn ? <LogIn className="w-3 h-3 text-teal-600" /> : <LogOut className="w-3 h-3 text-rose-500" />}
                        <span>{isCheckIn ? 'Check In' : 'Check Out'}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Mismatch</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600">
                      {log.face_distance !== null ? (
                        <span
                          className={
                            log.face_distance < 0.5
                              ? 'text-emerald-700 font-semibold'
                              : 'text-rose-700 font-semibold'
                          }
                        >
                          {log.face_distance} (Threshold: 0.50)
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
