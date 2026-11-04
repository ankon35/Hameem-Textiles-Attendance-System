'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Save,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Users,
  Compass,
  FileCode,
  Loader2,
} from 'lucide-react';
import {
  AttendanceLog,
  Employee,
  AttendanceStatus,
} from '@/types/attendance';
import {
  fetchOfficeLocation,
  saveOfficeLocation,
  fetchAttendanceLogs,
  getAllEmployees,
} from '@/lib/supabase';
import { getDeviceLocation } from '@/lib/geo';

interface Props {
  onOpenSqlModal: () => void;
}

export function AdminTab({ onOpenSqlModal }: Props) {
  // Office settings
  const [officeName, setOfficeName] = useState('Headquarters');
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [savingOffice, setSavingOffice] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Logs and Employees
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [officeData, logsData, empData] = await Promise.all([
          fetchOfficeLocation(),
          fetchAttendanceLogs(),
          getAllEmployees(),
        ]);

        if (!active) return;

        if (officeData) {
          setOfficeName(officeData.name);
          setLatitude(officeData.latitude);
          setLongitude(officeData.longitude);
          setRadiusMeters(officeData.radius_meters);
        }

        setLogs(logsData);
        setEmployees(empData);
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        if (active) setLoadingData(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setLoadingData(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Handle GPS detection for testing office setup
  const handleUseCurrentLocation = async () => {
    setDetectingGps(true);
    setGpsMessage(null);
    try {
      const coords = await getDeviceLocation();
      setLatitude(Number(coords.latitude.toFixed(6)));
      setLongitude(Number(coords.longitude.toFixed(6)));
      setGpsMessage('Updated to your device GPS coordinates! Remember to save.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve GPS coordinates.';
      setGpsMessage(msg);
    } finally {
      setDetectingGps(false);
    }
  };

  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOffice(true);
    setSaveSuccess(false);

    try {
      await saveOfficeLocation({
        name: officeName.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radiusMeters),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save office error:', err);
    } finally {
      setSavingOffice(false);
    }
  };

  // Filter today's logs
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLogs = logs.filter((log) => {
    const logDate = new Date(log.captured_at);
    return logDate >= todayStart;
  });

  const filteredLogs = todayLogs.filter((log) => {
    if (statusFilter === 'all') return true;
    return log.status === statusFilter;
  });

  const presentCount = todayLogs.filter((l) => l.status === 'present').length;
  const failedCount = todayLogs.filter((l) => l.status !== 'present').length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Enrolled Staff
          </span>
          <span className="text-2xl font-bold text-white mt-1 block">
            {employees.length}
          </span>
          <span className="text-[10px] text-emerald-400 mt-1 block">Registered faces</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Today Present
          </span>
          <span className="text-2xl font-bold text-emerald-400 mt-1 block">
            {presentCount}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Verified & Inside</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Rejected Attempts
          </span>
          <span className="text-2xl font-bold text-rose-400 mt-1 block">
            {failedCount}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Mismatch / Out of bounds</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Geofence Radius
          </span>
          <span className="text-2xl font-bold text-teal-300 mt-1 block">
            {radiusMeters}m
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">{officeName}</span>
        </div>
      </div>

      {/* Office Location Geofence Settings Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Office Location & Geofence Boundary
              </h3>
              <p className="text-xs text-slate-400">
                Configure latitude, longitude, and radius for attendance verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={detectingGps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              title="Detect your device GPS coordinates to easily calibrate office location"
            >
              {detectingGps ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Set to My Current Location</span>
            </button>

            <button
              type="button"
              onClick={onOpenSqlModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 border border-emerald-500/30 transition"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>SQL Schema</span>
            </button>
          </div>
        </div>

        {gpsMessage && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-700 text-xs text-emerald-300 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{gpsMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveOffice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Office Location Name
              </label>
              <input
                type="text"
                required
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Allowed Radius (meters)
              </label>
              <input
                type="number"
                min="10"
                max="5000"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Office Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Office Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Employees beyond {radiusMeters} meters will fail geofence verification.
            </span>
            <button
              type="submit"
              disabled={savingOffice}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-md shadow-emerald-950"
            >
              {savingOffice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Office Updated!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update Office Location</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Today's Attendance Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-white text-base">
              Today&apos;s Attendance Records
            </h3>
            <p className="text-xs text-slate-400">
              Live biometric logs with exact distance and status
            </p>
          </div>

          {/* Filter & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'all'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({todayLogs.length})
              </button>
              <button
                onClick={() => setStatusFilter('present')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'present'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Present ({presentCount})
              </button>
              <button
                onClick={() => setStatusFilter('face_mismatch')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'face_mismatch'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mismatch
              </button>
              <button
                onClick={() => setStatusFilter('location_failed')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  statusFilter === 'location_failed'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Location Failed
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loadingData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh logs"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Table View */}
        {loadingData ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span className="text-xs">Loading attendance records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
            <p className="text-sm">No attendance records for today matching filter.</p>
            <p className="text-xs text-slate-500 mt-1">
              Mark attendance on Page 2 to record attempts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Office Dist</th>
                  <th className="py-3 px-4">Face Distance</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                {filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">
                          {log.employee_name || 'Staff Member'}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400">
                          {log.employee_id}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-300">
                        {new Date(log.captured_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {log.distance_meters !== null ? (
                          <span>{Math.round(log.distance_meters)}m</span>
                        ) : (
                          <span className="text-slate-500">Denied</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {log.face_distance !== null ? (
                          <span
                            className={
                              log.face_distance < 0.5
                                ? 'text-emerald-400 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {log.face_distance}
                          </span>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {log.status === 'present' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Present
                          </span>
                        ) : log.status === 'face_mismatch' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            Face Mismatch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Location Failed
                          </span>
                        )}
                        {log.failure_reason && (
                          <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate">
                            {log.failure_reason}
                          </div>
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

      {/* Enrolled Staff Directory */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Enrolled Employees ({employees.length})
              </h3>
              <p className="text-xs text-slate-400">
                Staff registered with active face biometric descriptors
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center gap-3"
            >
              {emp.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={emp.photo_url}
                  alt={emp.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm">
                  {emp.name.charAt(0)}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">
                  {emp.name}
                </p>
                <p className="text-[11px] font-mono text-emerald-400">
                  {emp.employee_id}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  128-D descriptor stored
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
