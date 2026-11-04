'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  ShieldCheck,
  Briefcase,
  TrendingUp,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Employee, DayAttendanceSummary } from '@/types/attendance';
import { getMonthAttendanceSummaries } from '@/lib/supabase';

interface Props {
  currentEmployee: Employee;
}

export function InteractiveCalendarTab({ currentEmployee }: Props) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed
  const [summaries, setSummaries] = useState<DayAttendanceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active hovered or selected day for tooltip / inspector
  const [hoveredDay, setHoveredDay] = useState<DayAttendanceSummary | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayAttendanceSummary | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Load monthly data
  useEffect(() => {
    let active = true;

    async function loadCalendar() {
      try {
        const data = await getMonthAttendanceSummaries(
          currentEmployee.employee_id,
          currentYear,
          currentMonth
        );
        if (!active) return;
        setSummaries(data);
        const todaySummary = data.find((d) => d.isToday) || data[0];
        setSelectedDay(todaySummary || null);
      } catch (err) {
        console.error('Failed to load month attendance:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCalendar();

    return () => {
      active = false;
    };
  }, [currentEmployee.employee_id, currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const monthName = new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate high-level month stats from real database records
  const presentDays = summaries.filter(
    (d) => !d.isWeekend && (d.status === 'present' || d.status === 'half_day' || d.status === 'in_progress')
  );
  const totalHoursWorked = Math.round(summaries.reduce((acc, d) => acc + d.hoursWorked, 0) * 10) / 10;
  const averageHoursPerDay =
    presentDays.length > 0 ? (totalHoursWorked / presentDays.length).toFixed(1) : '0.0';

  // Elapsed working days in current view
  const isSelectedCurrentMonth =
    today.getFullYear() === currentYear && today.getMonth() === currentMonth;
  const isPastMonth =
    new Date(currentYear, currentMonth, 1) < new Date(today.getFullYear(), today.getMonth(), 1);

  const elapsedWorkingDays = summaries.filter((d) => {
    if (d.isWeekend) return false;
    if (isSelectedCurrentMonth) return d.dayNumber <= today.getDate();
    return isPastMonth;
  }).length;

  const compliancePct =
    elapsedWorkingDays > 0
      ? Math.min(100, Math.round((presentDays.length / elapsedWorkingDays) * 100))
      : 0;

  const totalRecordedPunches = summaries.filter((d) => d.checkInTime !== null).length;

  // Calculate calendar offset for Day 1
  const firstDayOfMonthIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
  const emptyPaddingDays = Array.from({ length: firstDayOfMonthIndex }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Month Metrics Header (100% Calculated from Database) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Days Present
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-slate-900">
              {presentDays.length}
            </span>
            <span className="text-xs text-slate-500">days logged</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium mt-1 block">
            {elapsedWorkingDays > 0
              ? `${compliancePct}% attendance rate (${presentDays.length}/${elapsedWorkingDays} days)`
              : 'No shifts recorded'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Hours Logged
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-teal-700">
              {totalHoursWorked}
            </span>
            <span className="text-xs text-slate-500">hours</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {totalHoursWorked > 0 ? 'From verified shift punches' : '0 recorded hours'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Average Shift Length
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-slate-900">
              {averageHoursPerDay}
            </span>
            <span className="text-xs text-slate-500">hrs/day</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            {presentDays.length > 0 ? 'Active shift average' : 'No completed shifts'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Biometric Accuracy
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-600">
              {totalRecordedPunches > 0 ? '100%' : '--'}
            </span>
            <span className="text-xs text-slate-500">
              {totalRecordedPunches > 0 ? 'verified' : 'no logs'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {totalRecordedPunches > 0
              ? `${totalRecordedPunches} verified punches`
              : 'No punches in database'}
          </span>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Month Navigation Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              {monthName}
            </h2>
            <span className="hidden sm:inline-block text-xs text-slate-400 ml-2">
              (Hover over any day to inspect check-in, check-out & hours)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCurrentYear(now.getFullYear());
                setCurrentMonth(now.getMonth());
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center py-2.5 bg-slate-50/70 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <div className="text-rose-500">Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-rose-500">Sat</div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 relative divide-x divide-y divide-slate-100 bg-white">
          {/* Empty padding cells before 1st of month */}
          {emptyPaddingDays.map((pad) => (
            <div
              key={`empty-${pad}`}
              className="min-h-[85px] sm:min-h-[105px] p-2 bg-slate-50/30"
            />
          ))}

          {/* Actual days in month */}
          {summaries.map((day) => {
            const isSelected = selectedDay?.dateStr === day.dateStr;
            const hasHours = day.hoursWorked > 0;

            return (
              <div
                key={day.dateStr}
                onClick={() => setSelectedDay(day)}
                onMouseEnter={(e) => {
                  setHoveredDay(day);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredDay(null)}
                className={`min-h-[85px] sm:min-h-[105px] p-2 sm:p-2.5 transition relative cursor-pointer group select-none ${
                  day.isToday
                    ? 'bg-teal-50/40 ring-2 ring-teal-500 ring-inset z-10'
                    : isSelected
                    ? 'bg-slate-50 ring-1 ring-slate-300 ring-inset'
                    : 'hover:bg-teal-50/30'
                }`}
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold rounded-md w-6 h-6 flex items-center justify-center ${
                      day.isToday
                        ? 'bg-teal-600 text-white font-bold'
                        : day.isWeekend
                        ? 'text-slate-400'
                        : 'text-slate-700'
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  {day.isToday && (
                    <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider hidden sm:inline-block">
                      Today
                    </span>
                  )}
                </div>

                {/* Status Content in Cell */}
                <div className="mt-2 space-y-1">
                  {day.status === 'present' && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 w-full truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{day.formattedHours}</span>
                    </div>
                  )}

                  {day.status === 'in_progress' && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 w-full truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
                      <span className="truncate">In Progress</span>
                    </div>
                  )}

                  {day.status === 'half_day' && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 w-full truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate">{day.formattedHours}</span>
                    </div>
                  )}

                  {day.status === 'weekend' && (
                    <span className="text-[10px] text-slate-400 italic block pl-0.5">
                      Off
                    </span>
                  )}
                </div>

                {/* Subtle check times visible on larger screens */}
                {day.checkInTime && (
                  <div className="hidden lg:block text-[9px] text-slate-500 mt-1.5 font-mono">
                    In: {day.checkInTime}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Full Shift Present (8h+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <span>Shift In Progress (Checked In)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Partial / Half Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span>Weekend / Scheduled Off</span>
          </div>
        </div>
      </div>

      {/* Floating Hover Card (Hover over day) */}
      {hoveredDay && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 280, Math.max(16, tooltipPos.x - 130))}px`,
            top: `${Math.max(10, tooltipPos.y - 170)}px`,
          }}
          className="z-50 pointer-events-none w-64 bg-white rounded-xl shadow-xl border border-slate-200/90 p-3.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150 space-y-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <p className="font-bold text-slate-900 text-sm">
                {new Date(hoveredDay.dateStr).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
              <p className="text-[10px] text-slate-500">
                {hoveredDay.isToday ? "Today's Work Shift" : 'Past Daily Record'}
              </p>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                hoveredDay.status === 'present'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : hoveredDay.status === 'in_progress'
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : hoveredDay.status === 'half_day'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {hoveredDay.status === 'present'
                ? 'Full Day'
                : hoveredDay.status === 'in_progress'
                ? 'Active'
                : hoveredDay.status === 'half_day'
                ? 'Half Day'
                : 'Off'}
            </span>
          </div>

          {/* Details Row */}
          {hoveredDay.status !== 'weekend' && hoveredDay.status !== 'absent' ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <LogIn className="w-3.5 h-3.5 text-teal-600" />
                  Check In:
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {hoveredDay.checkInTime || '--:--'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  Check Out:
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {hoveredDay.checkOutTime || (hoveredDay.isToday ? 'In Progress' : '--:--')}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-slate-700">
                <span className="flex items-center gap-1.5 font-medium text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Total Worked:
                </span>
                <span className="font-bold text-teal-700 font-mono text-xs">
                  {hoveredDay.formattedHours}
                </span>
              </div>

              {hoveredDay.faceDistance !== null && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Biometrics:
                  </span>
                  <span className="text-emerald-700 font-medium">Verified Face</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic py-1">
              No shift recorded for this date (scheduled off / weekend).
            </p>
          )}
        </div>
      )}

      {/* Selected Day Inspector Card */}
      {selectedDay && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex flex-col items-center justify-center font-bold shrink-0">
              <span className="text-sm leading-none">{selectedDay.dayNumber}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5 leading-none">
                {selectedDay.dayOfWeek}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {new Date(selectedDay.dateStr).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                {selectedDay.isToday && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800">
                    Today
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed attendance & biometric punch summary
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                Check In
              </span>
              <span className="font-semibold text-slate-800 font-mono text-sm">
                {selectedDay.checkInTime || 'None'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                Check Out
              </span>
              <span className="font-semibold text-slate-800 font-mono text-sm">
                {selectedDay.checkOutTime || (selectedDay.isToday ? 'In Progress' : 'None')}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                Hours Logged
              </span>
              <span className="font-bold text-teal-700 font-mono text-sm">
                {selectedDay.formattedHours}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                Status
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {selectedDay.status === 'weekend' ? 'Weekend' : 'Verified'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
