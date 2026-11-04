'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Upload,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Plus,
  Shield,
  Layers,
  Calendar,
  Building,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Employee, EmployeeRosterItem } from '@/types/attendance';
import {
  getManagerDashboardData,
  ManagerRosterRow,
  fetchAttendanceLogs,
} from '@/lib/supabase';
import {
  getCorporateRoster,
  saveCorporateRoster,
  parseEmployeeSpreadsheet,
  generateSampleCsv,
} from '@/lib/roster';

interface Props {
  currentEmployee: Employee;
  onLogout: () => void;
}

export function ManagerDashboard({ currentEmployee, onLogout }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState({
    totalEmployees: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    enrolledCount: 0,
  });
  const [rosterRows, setRosterRows] = useState<ManagerRosterRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Spreadsheet upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedRecords, setUploadedRecords] = useState<EmployeeRosterItem[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manual Add Modal
  const [showAddSingleModal, setShowAddSingleModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('Engineering');
  const [newDesig, setNewDesig] = useState('Associate');

  const loadData = async () => {
    try {
      const data = await getManagerDashboardData();
      setInsights(data.insights);
      setRosterRows(data.rosterRows);
    } catch (err) {
      console.error('Failed to load manager dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await getManagerDashboardData();
        if (isMounted) {
          setInsights(data.insights);
          setRosterRows(data.rosterRows);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load manager dashboard data:', err);
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Download sample CSV template
  const handleDownloadSampleCsv = () => {
    const csvContent = generateSampleCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'hameem_textiles_employees_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process uploaded CSV file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseEmployeeSpreadsheet(content);
      if (!parsed.success) {
        setUploadError(parsed.error || 'Failed to parse file.');
        setUploadedRecords(null);
      } else {
        setUploadedRecords(parsed.records);
        setUploadSuccess(`Found ${parsed.records.length} employee records in spreadsheet.`);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  };

  // Commit uploaded records to corporate roster
  const handleSaveUploadedRoster = () => {
    if (!uploadedRecords || uploadedRecords.length === 0) return;

    const currentRoster = getCorporateRoster();
    const rosterMap = new Map<string, EmployeeRosterItem>();

    // Put current roster items into map
    currentRoster.forEach((item) => {
      rosterMap.set(item.employee_id.toUpperCase(), item);
    });

    // Merge or insert new records
    uploadedRecords.forEach((item) => {
      const cleanId = item.employee_id.toUpperCase();
      const existing = rosterMap.get(cleanId);
      rosterMap.set(cleanId, {
        ...item,
        enrolled: existing?.enrolled || false,
        password: existing?.password,
        photo_url: existing?.photo_url,
        face_descriptor: existing?.face_descriptor,
      });
    });

    const newRoster = Array.from(rosterMap.values());
    saveCorporateRoster(newRoster);

    setShowUploadModal(false);
    setUploadedRecords(null);
    setUploadSuccess(null);
    setUploadError(null);
    loadData();
  };

  // Add single employee manually
  const handleAddSingleEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newId.trim().toUpperCase();
    const cleanName = newName.trim();
    if (!cleanId || !cleanName) return;

    const currentRoster = getCorporateRoster();
    if (currentRoster.some((r) => r.employee_id.toUpperCase() === cleanId)) {
      alert(`Employee ID ${cleanId} already exists in database.`);
      return;
    }

    const updatedRoster: EmployeeRosterItem[] = [
      ...currentRoster,
      {
        employee_id: cleanId,
        name: cleanName,
        department: newDept,
        designation: newDesig,
        enrolled: false,
      },
    ];

    saveCorporateRoster(updatedRoster);
    setShowAddSingleModal(false);
    setNewId('');
    setNewName('');
    loadData();
  };

  // Filter rows
  const departments = Array.from(new Set(rosterRows.map((r) => r.department))).filter(Boolean);

  const filteredRows = rosterRows.filter((row) => {
    const matchesSearch =
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'present' && (row.status === 'present' || row.status === 'late')) ||
      (statusFilter === 'late' && row.status === 'late') ||
      (statusFilter === 'absent' && row.status === 'absent');

    const matchesDept = deptFilter === 'all' || row.department === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Corporate Manager Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                  Hameem Textiles
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                  Manager Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Workforce Intelligence & Real-time Attendance Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900">{currentEmployee.name}</p>
              <p className="text-[11px] text-slate-500 font-mono">ID: {currentEmployee.employee_id}</p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/80 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Action Bar with Upload and Template Buttons */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Corporate Employee Roster</h2>
              <span className="text-xs text-slate-400">({insights.totalEmployees} Registered)</span>
            </div>
            <p className="text-xs text-slate-500">
              Upload spreadsheets with Employee ID, Full Name, Department & Designation to grant sign-up eligibility.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Sample CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddSingleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100/80 border border-teal-200 transition"
            >
              <Plus className="w-3.5 h-3.5 text-teal-600" />
              <span>Add Employee</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowUploadModal(true);
                setUploadedRecords(null);
                setUploadError(null);
                setUploadSuccess(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Employee Spreadsheet</span>
            </button>
          </div>
        </div>

        {/* 4 Metric / KPI Insights Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Employees */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Employees</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                {insights.totalEmployees}
              </p>
              <p className="text-[11px] text-teal-600 font-medium mt-1">
                {insights.enrolledCount} biometrically enrolled
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Today's Present */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today Present</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 mt-1">
                {insights.presentCount}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                {insights.totalEmployees > 0
                  ? `${Math.round((insights.presentCount / insights.totalEmployees) * 100)}% attendance rate`
                  : 'No records'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Today's Absents */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today Absents</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 mt-1">
                {insights.absentCount}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Awaiting check-in today
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Late Arrivals */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Late Arrivals</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">
                {insights.lateCount}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Punched in after 09:15 AM
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Live Attendance & Check-in / Check-out Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Controls */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Employee ID, Name, or Role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {/* Status Filter Buttons */}
              <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({rosterRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('present')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === 'present'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Present ({insights.presentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('late')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === 'late'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Late ({insights.lateCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('absent')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === 'absent'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Absent ({insights.absentCount})
                </button>
              </div>

              {/* Department Dropdown Filter */}
              {departments.length > 0 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-teal-500"
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Roster & Punch Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Employee</th>
                  <th className="py-3.5 px-4">Department & Role</th>
                  <th className="py-3.5 px-4">Biometrics</th>
                  <th className="py-3.5 px-4">Check In</th>
                  <th className="py-3.5 px-4">Check Out</th>
                  <th className="py-3.5 px-4">Hours</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((emp) => (
                    <tr key={emp.employee_id} className="hover:bg-slate-50/60 transition">
                      {/* Employee details */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={emp.photo_url || `https://picsum.photos/seed/${emp.employee_id}/80/80`}
                            alt={emp.name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm leading-tight">
                              {emp.name}
                            </p>
                            <p className="text-[11px] font-mono font-medium text-slate-500">
                              {emp.employee_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 text-xs">{emp.department}</p>
                        <p className="text-[11px] text-slate-500">{emp.designation}</p>
                      </td>

                      {/* Biometrics */}
                      <td className="py-3.5 px-4">
                        {emp.enrolled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            <Check className="w-3 h-3 text-teal-600" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Check In */}
                      <td className="py-3.5 px-4">
                        {emp.checkInTime ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 text-xs font-mono">
                              {emp.checkInTime}
                            </span>
                            {emp.status === 'late' && (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Late
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Check Out */}
                      <td className="py-3.5 px-4">
                        {emp.checkOutTime ? (
                          <span className="font-semibold text-slate-800 text-xs font-mono">
                            {emp.checkOutTime}
                          </span>
                        ) : emp.checkInTime ? (
                          <span className="text-teal-600 font-medium text-xs">On Duty</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Hours */}
                      <td className="py-3.5 px-4">
                        {emp.checkInTime ? (
                          <span className="text-slate-700 font-medium text-xs font-mono">
                            {emp.formattedHours}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0h</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        {emp.status === 'present' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Present
                          </span>
                        )}
                        {emp.status === 'late' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            Late
                          </span>
                        )}
                        {emp.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            Absent
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/50 p-3.5 px-4 sm:px-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing {filteredRows.length} of {rosterRows.length} corporate employees
            </span>
            <span className="text-[11px] text-slate-400">
              Cutoff for late arrival: 09:15 AM
            </span>
          </div>
        </div>
      </main>

      {/* Spreadsheet Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl w-full p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold mb-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                  <span>Roster Importer</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Upload Employee Spreadsheet
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload a CSV file containing Employee ID, Full Name, Department, and Designation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {uploadSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/30 hover:bg-teal-50/60 rounded-2xl p-6 text-center cursor-pointer transition space-y-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv, text/csv, text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-white border border-teal-100 shadow-xs flex items-center justify-center mx-auto text-teal-600">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Click or drag & drop CSV spreadsheet here
              </p>
              <p className="text-[11px] text-slate-400">
                Columns required: Employee ID, Full Name, Department, Designation
              </p>
            </div>

            {/* Preview of Parsed Items */}
            {uploadedRecords && uploadedRecords.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  Preview ({uploadedRecords.length} staff records to import):
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                  {uploadedRecords.map((rec, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <span className="font-mono font-bold text-slate-900 mr-2">
                          {rec.employee_id}
                        </span>
                        <span className="text-slate-800 font-medium">{rec.name}</span>
                      </div>
                      <div className="text-right text-[11px] text-slate-500">
                        <span>{rec.department}</span> • <span>{rec.designation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!uploadedRecords || uploadedRecords.length === 0}
                onClick={handleSaveUploadedRoster}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                Save & Update Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Employee Modal */}
      {showAddSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Employee to Roster</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register them in the corporate database so they can sign up with their face.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSingleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSingleEmployee} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Employee ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-401"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Green"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marketing"
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Manager"
                    value={newDesig}
                    onChange={(e) => setNewDesig(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSingleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
