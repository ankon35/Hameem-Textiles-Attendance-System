export interface Employee {
  id: string;
  name: string;
  employee_id: string;
  department?: string;
  role?: string;
  photo_url: string;
  face_descriptor: number[];
  password?: string;
  is_manager?: boolean;
  created_at?: string;
}

export interface EmployeeRosterItem {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  enrolled?: boolean;
  password?: string;
  photo_url?: string;
  face_descriptor?: number[];
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  created_at?: string;
}

export type AttendanceStatus = 'present' | 'face_mismatch' | 'location_failed';
export type PunchType = 'check_in' | 'check_out';

export interface AttendanceLog {
  id: string;
  employee_id: string;
  employee_name?: string;
  captured_at: string;
  punch_type?: PunchType;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  face_distance: number | null;
  status: AttendanceStatus;
  failure_reason?: string;
}

export interface DayAttendanceSummary {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
  status: 'present' | 'half_day' | 'in_progress' | 'absent' | 'weekend';
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInIso: string | null;
  checkOutIso: string | null;
  hoursWorked: number;
  formattedHours: string;
  faceDistance: number | null;
}

export interface ManagerInsights {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  enrolledCount: number;
}
