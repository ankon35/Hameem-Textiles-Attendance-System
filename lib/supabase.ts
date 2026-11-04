import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Employee,
  OfficeLocation,
  AttendanceLog,
  PunchType,
  DayAttendanceSummary,
} from '@/types/attendance';

export const DEFAULT_OFFICE: OfficeLocation = {
  id: 'default-office',
  name: 'Headquarters (Main Campus)',
  latitude: 37.7749,
  longitude: -122.4194,
  radius_meters: 200,
  created_at: new Date().toISOString(),
};

const STORAGE_KEYS = {
  CUSTOM_URL: 'smart_attendance_supabase_url',
  CUSTOM_KEY: 'smart_attendance_supabase_key',
  LOCAL_EMPLOYEES: 'attendpulse_live_employees',
  LOCAL_OFFICE: 'attendpulse_live_office',
  LOCAL_LOGS: 'attendpulse_live_logs',
};

const INITIAL_DEMO_EMPLOYEES: Employee[] = [];

export function getSupabaseCredentials(): { url: string; key: string; isConfigured: boolean } {
  if (typeof window === 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    return { url: envUrl, key: envKey, isConfigured: Boolean(envUrl && envKey && !envUrl.includes('your-project')) };
  }

  const customUrl = localStorage.getItem(STORAGE_KEYS.CUSTOM_URL);
  const customKey = localStorage.getItem(STORAGE_KEYS.CUSTOM_KEY);

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  const activeUrl = customUrl || envUrl;
  const activeKey = customKey || envKey;

  const isConfigured = Boolean(
    activeUrl &&
    activeKey &&
    !activeUrl.includes('your-project') &&
    activeUrl.startsWith('http')
  );

  return { url: activeUrl, key: activeKey, isConfigured };
}

export function saveCustomSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEYS.CUSTOM_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEYS.CUSTOM_URL);

    if (key) localStorage.setItem(STORAGE_KEYS.CUSTOM_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEYS.CUSTOM_KEY);
  }
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) return null;

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false },
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

// ---------------- LOCAL STORAGE FALLBACK ----------------
function getLocalEmployees(): Employee[] {
  if (typeof window === 'undefined') return INITIAL_DEMO_EMPLOYEES;
  const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_EMPLOYEES);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.LOCAL_EMPLOYEES, JSON.stringify(INITIAL_DEMO_EMPLOYEES));
    return INITIAL_DEMO_EMPLOYEES;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEMO_EMPLOYEES;
  }
}

function saveLocalEmployees(list: Employee[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.LOCAL_EMPLOYEES, JSON.stringify(list));
  }
}

function getLocalOffice(): OfficeLocation {
  if (typeof window === 'undefined') return DEFAULT_OFFICE;
  const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_OFFICE);
  if (!raw) {
    localStorage.setItem(STORAGE_KEYS.LOCAL_OFFICE, JSON.stringify(DEFAULT_OFFICE));
    return DEFAULT_OFFICE;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return DEFAULT_OFFICE;
  }
}

function saveLocalOffice(office: OfficeLocation) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.LOCAL_OFFICE, JSON.stringify(office));
  }
}

function getLocalLogs(): AttendanceLog[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_LOGS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalLogs(logs: AttendanceLog[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.LOCAL_LOGS, JSON.stringify(logs));
  }
}

// ---------------- DATA ACCESS METHODS ----------------

export async function fetchOfficeLocation(): Promise<OfficeLocation> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('office_locations')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name || 'Headquarters',
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          radius_meters: Number(data.radius_meters) || 200,
          created_at: data.created_at,
        };
      }
    } catch (e) {
      console.warn('Supabase office exception, using local:', e);
    }
  }

  return getLocalOffice();
}

export async function saveOfficeLocation(location: Partial<OfficeLocation>): Promise<OfficeLocation> {
  const client = getSupabaseClient();
  const current = await fetchOfficeLocation();
  const updated: OfficeLocation = {
    ...current,
    ...location,
    latitude: Number(location.latitude ?? current.latitude),
    longitude: Number(location.longitude ?? current.longitude),
    radius_meters: Number(location.radius_meters ?? current.radius_meters),
  };

  if (client) {
    try {
      await client
        .from('office_locations')
        .upsert({
          id: current.id === 'default-office' ? undefined : current.id,
          name: updated.name,
          latitude: updated.latitude,
          longitude: updated.longitude,
          radius_meters: updated.radius_meters,
        });
    } catch (e) {
      console.warn('Supabase save office exception:', e);
    }
  }

  saveLocalOffice(updated);
  return updated;
}

export async function findEmployeeById(employeeId: string): Promise<Employee | null> {
  const cleanId = employeeId.trim().toUpperCase();

  // Manager account check
  if (cleanId === 'MANAGER101') {
    return {
      id: 'manager-101-account',
      name: 'System Administrator & Manager',
      employee_id: 'manager101',
      department: 'Corporate Administration',
      role: 'Operations Manager',
      photo_url: 'https://picsum.photos/seed/manager101/300/300',
      face_descriptor: [],
      password: 'manager',
      is_manager: true,
      created_at: new Date().toISOString(),
    };
  }

  // Check corporate roster first
  const { findRosterEmployee } = await import('@/lib/roster');
  const rosterItem = findRosterEmployee(cleanId);
  if (rosterItem && rosterItem.enrolled) {
    return {
      id: `emp-${rosterItem.employee_id}`,
      name: rosterItem.name,
      employee_id: rosterItem.employee_id,
      department: rosterItem.department,
      role: rosterItem.designation,
      photo_url: rosterItem.photo_url || 'https://picsum.photos/seed/' + rosterItem.employee_id + '/300/300',
      face_descriptor: rosterItem.face_descriptor || [],
      password: rosterItem.password || 'password123',
      created_at: new Date().toISOString(),
    };
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .ilike('employee_id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          employee_id: data.employee_id,
          department: data.department || 'Operations',
          role: data.role || 'Team Member',
          photo_url: data.photo_url,
          face_descriptor: Array.isArray(data.face_descriptor)
            ? data.face_descriptor.map(Number)
            : typeof data.face_descriptor === 'string'
            ? JSON.parse(data.face_descriptor)
            : [],
          password: data.password || 'password123',
          created_at: data.created_at,
        };
      }
    } catch (e) {
      console.warn('Supabase find employee error:', e);
    }
  }

  const localList = getLocalEmployees();
  const found = localList.find((e) => e.employee_id.toUpperCase() === cleanId);
  return found || null;
}

export async function getAllEmployees(): Promise<Employee[]> {
  const { getCorporateRoster } = await import('@/lib/roster');
  const roster = getCorporateRoster();
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((item) => ({
          id: item.id,
          name: item.name,
          employee_id: item.employee_id,
          department: item.department || 'General',
          role: item.role || 'Staff Member',
          photo_url: item.photo_url,
          face_descriptor: Array.isArray(item.face_descriptor)
            ? item.face_descriptor.map(Number)
            : [],
          created_at: item.created_at,
        }));
      }
    } catch (e) {
      console.warn('Supabase getAllEmployees error:', e);
    }
  }

  const localList = getLocalEmployees();
  const enrolledFromRoster: Employee[] = roster
    .filter((r) => r.enrolled)
    .map((r) => ({
      id: `emp-${r.employee_id}`,
      name: r.name,
      employee_id: r.employee_id,
      department: r.department,
      role: r.designation,
      photo_url: r.photo_url || 'https://picsum.photos/seed/' + r.employee_id + '/300/300',
      face_descriptor: r.face_descriptor || [],
      password: r.password,
    }));

  const map = new Map<string, Employee>();
  [...localList, ...enrolledFromRoster].forEach((emp) => {
    map.set(emp.employee_id.toUpperCase(), emp);
  });

  return Array.from(map.values());
}

export async function uploadEmployeePhoto(
  fileOrBlob: Blob,
  employeeId: string
): Promise<string> {
  const cleanId = employeeId.trim().toUpperCase();
  const client = getSupabaseClient();
  const fileName = `${cleanId}_${Date.now()}.jpg`;

  if (client) {
    try {
      const { data, error } = await client.storage
        .from('employee_photos')
        .upload(fileName, fileOrBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!error && data) {
        const { data: urlData } = client.storage
          .from('employee_photos')
          .getPublicUrl(data.path);
        if (urlData?.publicUrl) {
          return urlData.publicUrl;
        }
      }
    } catch (e) {
      console.warn('Supabase upload exception:', e);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

export async function registerEmployee(data: {
  name: string;
  employee_id: string;
  department?: string;
  role?: string;
  photo_url: string;
  face_descriptor: number[];
  password?: string;
}): Promise<Employee> {
  const cleanId = data.employee_id.trim().toUpperCase();
  const { updateRosterEnrollment, findRosterEmployee } = await import('@/lib/roster');
  const client = getSupabaseClient();

  // Verify in corporate roster or Supabase table
  let rosterCheck = findRosterEmployee(cleanId);
  if (!rosterCheck && client) {
    try {
      const { data: supaEmp } = await client
        .from('employees')
        .select('*')
        .ilike('employee_id', cleanId)
        .maybeSingle();

      if (supaEmp) {
        rosterCheck = {
          employee_id: supaEmp.employee_id,
          name: supaEmp.name,
          department: supaEmp.department || 'Operations',
          designation: supaEmp.designation || supaEmp.role || 'Staff Member',
          enrolled: supaEmp.enrolled || false,
          password: supaEmp.password,
          photo_url: supaEmp.photo_url,
        };
      }
    } catch (e) {
      console.warn('Supabase roster check in register:', e);
    }
  }

  if (!rosterCheck) {
    throw new Error('Your employee id is not registered in our database.');
  }

  // Update roster record with credentials and biometric data
  updateRosterEnrollment(cleanId, {
    password: data.password || 'password123',
    photo_url: data.photo_url,
    face_descriptor: data.face_descriptor,
    name: rosterCheck.name,
    department: rosterCheck.department,
    designation: rosterCheck.designation,
  });

  const newEmployee: Employee = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `emp-${Date.now()}`,
    name: rosterCheck.name,
    employee_id: cleanId,
    department: rosterCheck.department,
    role: rosterCheck.designation,
    photo_url: data.photo_url,
    face_descriptor: data.face_descriptor,
    password: data.password || 'password123',
    created_at: new Date().toISOString(),
  };

  if (client) {
    try {
      const { data: upserted, error } = await client
        .from('employees')
        .upsert(
          {
            name: newEmployee.name,
            employee_id: newEmployee.employee_id,
            photo_url: newEmployee.photo_url,
            face_descriptor: newEmployee.face_descriptor,
            department: newEmployee.department,
            designation: newEmployee.role,
            password: newEmployee.password,
            enrolled: true,
          },
          { onConflict: 'employee_id' }
        )
        .select()
        .maybeSingle();

      if (!error && upserted) {
        const result: Employee = {
          ...newEmployee,
          id: upserted.id,
        };
        const currentLocal = getLocalEmployees().filter((e) => e.employee_id !== cleanId);
        saveLocalEmployees([result, ...currentLocal]);
        return result;
      }
    } catch (e) {
      console.warn('Supabase register error, using local fallback:', e);
    }
  }

  const currentLocal = getLocalEmployees().filter((e) => e.employee_id !== cleanId);
  saveLocalEmployees([newEmployee, ...currentLocal]);
  return newEmployee;
}

export async function checkTodayPunches(employeeId: string): Promise<{
  checkIn: AttendanceLog | null;
  checkOut: AttendanceLog | null;
}> {
  const cleanId = employeeId.trim().toUpperCase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startIso = startOfDay.toISOString();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('attendance_logs')
        .select('*')
        .ilike('employee_id', cleanId)
        .gte('captured_at', startIso)
        .order('captured_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const presentLogs = data.filter((l) => l.status === 'present');
        const checkIn = presentLogs.find((l) => l.punch_type === 'check_in') || presentLogs[0] || null;
        const checkOut =
          presentLogs.find((l) => l.punch_type === 'check_out') ||
          (presentLogs.length > 1 ? presentLogs[presentLogs.length - 1] : null);
        return { checkIn, checkOut };
      }
    } catch (e) {
      console.warn('Supabase checkTodayPunches error:', e);
    }
  }

  const localLogs = getLocalLogs();
  const todayLogs = localLogs.filter((l) => {
    if (l.employee_id.toUpperCase() !== cleanId || l.status !== 'present') return false;
    const logDate = new Date(l.captured_at);
    return logDate >= startOfDay;
  });

  const checkIn = todayLogs.find((l) => l.punch_type === 'check_in') || todayLogs[todayLogs.length - 1] || null;
  const checkOut = todayLogs.find((l) => l.punch_type === 'check_out') || null;

  return { checkIn, checkOut };
}

export async function checkTodayAttendance(employeeId: string): Promise<AttendanceLog | null> {
  const { checkIn } = await checkTodayPunches(employeeId);
  return checkIn;
}

export async function recordAttendanceLog(logData: {
  employee_id: string;
  punch_type?: PunchType;
  latitude: number | null;
  longitude: number | null;
  distance_meters: number | null;
  face_distance: number | null;
  status: 'present' | 'face_mismatch' | 'location_failed';
  failure_reason?: string;
}): Promise<AttendanceLog> {
  const cleanId = logData.employee_id.trim().toUpperCase();
  const client = getSupabaseClient();
  const now = new Date().toISOString();

  const newLog: AttendanceLog = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
    employee_id: cleanId,
    captured_at: now,
    punch_type: logData.punch_type || 'check_in',
    latitude: logData.latitude,
    longitude: logData.longitude,
    distance_meters: logData.distance_meters,
    face_distance: logData.face_distance,
    status: logData.status,
    failure_reason: logData.failure_reason,
  };

  if (client) {
    try {
      const { data, error } = await client
        .from('attendance_logs')
        .insert({
          employee_id: cleanId,
          captured_at: now,
          punch_type: logData.punch_type || 'check_in',
          latitude: logData.latitude,
          longitude: logData.longitude,
          distance_meters: logData.distance_meters,
          face_distance: logData.face_distance,
          status: logData.status,
          failure_reason: logData.failure_reason,
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        newLog.id = data.id;
      }
    } catch (e) {
      console.warn('Supabase log insert exception:', e);
    }
  }

  const currentLogs = getLocalLogs();
  saveLocalLogs([newLog, ...currentLogs.slice(0, 500)]);
  return newLog;
}

export async function fetchAttendanceLogs(): Promise<AttendanceLog[]> {
  const employees = await getAllEmployees();
  const employeeMap = new Map(employees.map((e) => [e.employee_id.toUpperCase(), e.name]));
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('attendance_logs')
        .select('*')
        .order('captured_at', { ascending: false });

      if (!error && data) {
        return data.map((l) => ({
          id: l.id,
          employee_id: l.employee_id,
          employee_name: employeeMap.get(l.employee_id?.toUpperCase()) || 'Staff Member',
          captured_at: l.captured_at,
          punch_type: l.punch_type || 'check_in',
          latitude: l.latitude,
          longitude: l.longitude,
          distance_meters: l.distance_meters,
          face_distance: l.face_distance,
          status: l.status,
          failure_reason: l.failure_reason,
        }));
      }
    } catch (e) {
      console.warn('Supabase fetch logs error, using local:', e);
    }
  }

  const localLogs = getLocalLogs();
  return localLogs.map((l) => ({
    ...l,
    employee_name: employeeMap.get(l.employee_id.toUpperCase()) || 'Staff Member',
  }));
}

/**
 * Builds monthly calendar attendance data for an employee directly from actual database records.
 * ZERO dummy data: Days without real punches are marked as Absent or Weekend.
 */
export async function getMonthAttendanceSummaries(
  employeeId: string,
  year: number,
  month: number // 0-indexed (0 = Jan, 10 = Nov)
): Promise<DayAttendanceSummary[]> {
  const cleanId = employeeId.trim().toUpperCase();
  const client = getSupabaseClient();

  const startDate = new Date(year, month, 1, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  let monthLogs: AttendanceLog[] = [];

  if (client) {
    try {
      const { data, error } = await client
        .from('attendance_logs')
        .select('*')
        .ilike('employee_id', cleanId)
        .gte('captured_at', startIso)
        .lte('captured_at', endIso)
        .order('captured_at', { ascending: true });

      if (!error && data) {
        monthLogs = data.map((d) => ({
          id: d.id,
          employee_id: d.employee_id,
          captured_at: d.captured_at,
          punch_type: d.punch_type || 'check_in',
          latitude: d.latitude,
          longitude: d.longitude,
          distance_meters: d.distance_meters,
          face_distance: d.face_distance,
          status: d.status,
          failure_reason: d.failure_reason,
        }));
      }
    } catch (e) {
      console.warn('Supabase getMonthAttendanceSummaries error, checking local logs:', e);
    }
  }

  // Also include any local logs matching this month & employee (fallback / offline sync)
  const localLogs = getLocalLogs().filter((l) => {
    if (l.employee_id.toUpperCase() !== cleanId) return false;
    const d = new Date(l.captured_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Merge unique logs
  const seenIds = new Set(monthLogs.map((l) => l.id));
  localLogs.forEach((l) => {
    if (!seenIds.has(l.id)) {
      monthLogs.push(l);
      seenIds.add(l.id);
    }
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const currentDayNumber = today.getDate();

  const summaries: DayAttendanceSummary[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const dayOfWeekIndex = dateObj.getDay();
    const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
    const isFuture = isCurrentMonth && day > currentDayNumber;
    const isCurrentDay = isCurrentMonth && day === currentDayNumber;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    // Look for actual logs on this date
    const dayLogs = monthLogs.filter((l) => {
      const d = new Date(l.captured_at);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

    const presentLogs = dayLogs.filter((l) => l.status === 'present');

    if (presentLogs.length > 0) {
      const checkInLog = presentLogs.find((l) => l.punch_type === 'check_in') || presentLogs[0];
      const checkOutLog = presentLogs.find((l) => l.punch_type === 'check_out');

      const inDate = new Date(checkInLog.captured_at);
      let hoursWorked = 0;
      let outTimeStr: string | null = null;
      let checkOutIso: string | null = null;

      if (checkOutLog) {
        const outDate = new Date(checkOutLog.captured_at);
        const diffMs = Math.max(0, outDate.getTime() - inDate.getTime());
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        outTimeStr = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        checkOutIso = checkOutLog.captured_at;
      } else if (isCurrentDay) {
        // Today's shift in progress
        const diffMs = Math.max(0, Date.now() - inDate.getTime());
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      }

      const hoursInt = Math.floor(hoursWorked);
      const minsInt = Math.round((hoursWorked - hoursInt) * 60);

      summaries.push({
        dateStr,
        dayOfWeek,
        dayNumber: day,
        isToday: isCurrentDay,
        isWeekend,
        status: checkOutLog ? (hoursWorked >= 6 ? 'present' : 'half_day') : isCurrentDay ? 'in_progress' : 'present',
        checkInTime: inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkOutTime: outTimeStr,
        checkInIso: checkInLog.captured_at,
        checkOutIso,
        hoursWorked,
        formattedHours: checkOutLog || isCurrentDay ? `${hoursInt}h ${minsInt}m` : 'Checked In',
        faceDistance: checkInLog.face_distance,
      });
      continue;
    }

    // Weekend
    if (isWeekend) {
      summaries.push({
        dateStr,
        dayOfWeek,
        dayNumber: day,
        isToday: isCurrentDay,
        isWeekend: true,
        status: 'weekend',
        checkInTime: null,
        checkOutTime: null,
        checkInIso: null,
        checkOutIso: null,
        hoursWorked: 0,
        formattedHours: 'Off',
        faceDistance: null,
      });
      continue;
    }

    // Past or future working day with NO punches in database:
    // Purely real data - No dummy shifts generated
    summaries.push({
      dateStr,
      dayOfWeek,
      dayNumber: day,
      isToday: isCurrentDay,
      isWeekend: false,
      status: 'absent',
      checkInTime: null,
      checkOutTime: null,
      checkInIso: null,
      checkOutIso: null,
      hoursWorked: 0,
      formattedHours: isFuture ? 'Upcoming' : 'No Record',
      faceDistance: null,
    });
  }

  return summaries;
}

export interface ManagerRosterRow {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  enrolled: boolean;
  photo_url?: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInIso: string | null;
  checkOutIso: string | null;
  hoursWorked: number;
  formattedHours: string;
  status: 'present' | 'late' | 'absent';
}

export async function getManagerDashboardData(): Promise<{
  insights: {
    totalEmployees: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    enrolledCount: number;
  };
  rosterRows: ManagerRosterRow[];
  recentLogs: AttendanceLog[];
}> {
  const { getCorporateRoster } = await import('@/lib/roster');
  const roster = getCorporateRoster();
  const client = getSupabaseClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let allLogs: AttendanceLog[] = [];
  let dbEmployees: Employee[] = [];

  if (client) {
    try {
      const [logsRes, empRes] = await Promise.all([
        client
          .from('attendance_logs')
          .select('*')
          .order('captured_at', { ascending: false }),
        client
          .from('employees')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      if (!logsRes.error && logsRes.data) {
        allLogs = logsRes.data.map((l) => ({
          id: l.id,
          employee_id: l.employee_id,
          captured_at: l.captured_at,
          punch_type: l.punch_type || 'check_in',
          latitude: l.latitude,
          longitude: l.longitude,
          distance_meters: l.distance_meters,
          face_distance: l.face_distance,
          status: l.status,
          failure_reason: l.failure_reason,
        }));
      }

      if (!empRes.error && empRes.data) {
        dbEmployees = empRes.data.map((e) => ({
          id: e.id,
          name: e.name,
          employee_id: e.employee_id,
          department: e.department || 'Operations',
          role: e.designation || e.role || 'Staff Member',
          photo_url: e.photo_url || '',
          face_descriptor: Array.isArray(e.face_descriptor) ? e.face_descriptor.map(Number) : [],
          password: e.password,
          enrolled: Boolean(e.enrolled || (e.face_descriptor && e.face_descriptor.length > 0)),
        }));
      }
    } catch (e) {
      console.warn('Supabase manager data error:', e);
    }
  }

  // Merge with local logs if any
  const localLogs = getLocalLogs();
  const seenLogIds = new Set(allLogs.map((l) => l.id));
  localLogs.forEach((l) => {
    if (!seenLogIds.has(l.id)) {
      allLogs.push(l);
      seenLogIds.add(l.id);
    }
  });

  // Group today's present logs by employee_id
  const todayLogsByEmp = new Map<string, AttendanceLog[]>();
  allLogs.forEach((log) => {
    if (log.status !== 'present') return;
    const logDate = new Date(log.captured_at);
    if (logDate >= startOfDay) {
      const id = log.employee_id.toUpperCase();
      const list = todayLogsByEmp.get(id) || [];
      list.push(log);
      todayLogsByEmp.set(id, list);
    }
  });

  // Combine roster items with database employees
  const dbEmpMap = new Map(dbEmployees.map((e) => [e.employee_id.toUpperCase(), e]));
  const fullRosterList = [...roster];
  dbEmployees.forEach((dbEmp) => {
    if (!fullRosterList.some((r) => r.employee_id.toUpperCase() === dbEmp.employee_id.toUpperCase())) {
      fullRosterList.push({
        employee_id: dbEmp.employee_id,
        name: dbEmp.name,
        department: dbEmp.department || 'Operations',
        designation: dbEmp.role || 'Staff Member',
        enrolled: true,
        photo_url: dbEmp.photo_url,
      });
    }
  });

  let presentCount = 0;
  let lateCount = 0;
  let enrolledCount = 0;

  const rosterRows: ManagerRosterRow[] = fullRosterList.map((item) => {
    const cleanId = item.employee_id.toUpperCase();
    const dbMatch = dbEmpMap.get(cleanId);
    const isEnrolled = Boolean(item.enrolled || dbMatch);
    if (isEnrolled) enrolledCount++;

    const todayEmpLogs = todayLogsByEmp.get(cleanId) || [];
    const checkInLog = todayEmpLogs.find((l) => l.punch_type === 'check_in') || todayEmpLogs[0];
    const checkOutLog = todayEmpLogs.find((l) => l.punch_type === 'check_out');

    let checkInIso: string | null = null;
    let checkOutIso: string | null = null;
    let checkInTime: string | null = null;
    let checkOutTime: string | null = null;
    let hoursWorked = 0;
    let formattedHours = '0h 0m';
    let status: 'present' | 'late' | 'absent' = 'absent';

    if (checkInLog) {
      const inDate = new Date(checkInLog.captured_at);
      checkInIso = checkInLog.captured_at;
      checkInTime = inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Late rule: punched in after 09:15 AM
      const punchHour = inDate.getHours();
      const punchMin = inDate.getMinutes();
      const isLate = punchHour > 9 || (punchHour === 9 && punchMin > 15);

      if (isLate) {
        status = 'late';
        lateCount++;
      } else {
        status = 'present';
      }
      presentCount++;

      if (checkOutLog) {
        const outDate = new Date(checkOutLog.captured_at);
        checkOutIso = checkOutLog.captured_at;
        checkOutTime = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const diffMs = Math.max(0, outDate.getTime() - inDate.getTime());
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      } else {
        const diffMs = Math.max(0, Date.now() - inDate.getTime());
        hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      }

      const h = Math.floor(hoursWorked);
      const m = Math.round((hoursWorked - h) * 60);
      formattedHours = `${h}h ${m}m`;
    }

    return {
      employee_id: item.employee_id,
      name: dbMatch?.name || item.name,
      department: dbMatch?.department || item.department,
      designation: dbMatch?.role || item.designation,
      enrolled: isEnrolled,
      photo_url: dbMatch?.photo_url || item.photo_url,
      checkInTime,
      checkOutTime,
      checkInIso,
      checkOutIso,
      hoursWorked,
      formattedHours,
      status,
    };
  });

  const totalEmployees = fullRosterList.length;
  const absentCount = Math.max(0, totalEmployees - presentCount);

  return {
    insights: {
      totalEmployees,
      presentCount,
      absentCount,
      lateCount,
      enrolledCount,
    },
    rosterRows,
    recentLogs: allLogs.slice(0, 50),
  };
}

