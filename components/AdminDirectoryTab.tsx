'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Building,
  Save,
  CheckCircle2,
  MapPin,
  Loader2,
  Shield,
  Briefcase,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { Employee, OfficeLocation } from '@/types/attendance';
import {
  getAllEmployees,
  fetchOfficeLocation,
  saveOfficeLocation,
} from '@/lib/supabase';

export function AdminDirectoryTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [loading, setLoading] = useState(true);

  // Office form state
  const [officeName, setOfficeName] = useState('Headquarters');
  const [latitude, setLatitude] = useState(37.7749);
  const [longitude, setLongitude] = useState(-122.4194);
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [savingOffice, setSavingOffice] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, offData] = await Promise.all([
        getAllEmployees(),
        fetchOfficeLocation(),
      ]);
      setEmployees(empList);
      if (offData) {
        setOffice(offData);
        setOfficeName(offData.name);
        setLatitude(offData.latitude);
        setLongitude(offData.longitude);
        setRadiusMeters(offData.radius_meters);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function initAdminData() {
      try {
        const [empList, offData] = await Promise.all([
          getAllEmployees(),
          fetchOfficeLocation(),
        ]);
        if (!active) return;
        setEmployees(empList);
        if (offData) {
          setOffice(offData);
          setOfficeName(offData.name);
          setLatitude(offData.latitude);
          setLongitude(offData.longitude);
          setRadiusMeters(offData.radius_meters);
        }
      } catch (err) {
        console.error('Failed to load admin data:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    initAdminData();

    return () => {
      active = false;
    };
  }, []);

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

  return (
    <div className="space-y-6">
      {/* Enrolled Workforce Directory */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Enrolled Workforce Directory ({employees.length})
              </h2>
              <p className="text-xs text-slate-500">
                Staff members with active biometric enrollment profiles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Loading staff directory...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-3.5 hover:bg-white hover:shadow-xs transition"
              >
                {emp.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emp.photo_url}
                    alt={emp.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm">
                    {emp.name.charAt(0)}
                  </div>
                )}

                <div className="overflow-hidden space-y-0.5">
                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {emp.name}
                  </h3>
                  <p className="text-[11px] font-mono font-medium text-teal-700">
                    {emp.employee_id}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {emp.role || 'Staff'} • {emp.department || 'Operations'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workplace Facility Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Workplace Campus Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Primary office facility coordinates and geofence parameters
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveOffice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Facility / Campus Name
              </label>
              <input
                type="text"
                required
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Allowed Facility Perimeter (Meters)
              </label>
              <input
                type="number"
                min="20"
                max="5000"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Campus Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Campus Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                required
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono focus:outline-none focus:border-teal-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              Biometric check-ins are verified and archived with high precision.
            </span>
            <button
              type="submit"
              disabled={savingOffice}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
            >
              {savingOffice ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Facility Updated</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Facility Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
