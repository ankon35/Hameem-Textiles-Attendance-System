import { EmployeeRosterItem, Employee } from '@/types/attendance';

export const ROSTER_STORAGE_KEY = 'attendpulse_corporate_roster';

export const INITIAL_CORPORATE_ROSTER: EmployeeRosterItem[] = [
  {
    employee_id: 'EMP-101',
    name: 'Sarah Connor',
    department: 'Engineering',
    designation: 'Senior Lead Engineer',
    enrolled: false,
  },
  {
    employee_id: 'EMP-204',
    name: 'Ankon Roy',
    department: 'Product & Design',
    designation: 'Product Lead',
    enrolled: false,
  },
  {
    employee_id: 'EMP-102',
    name: 'John Connor',
    department: 'Security & Operations',
    designation: 'Systems Administrator',
    enrolled: false,
  },
  {
    employee_id: 'EMP-301',
    name: 'Emily Davis',
    department: 'Human Resources',
    designation: 'HR Specialist',
    enrolled: false,
  },
  {
    employee_id: 'EMP-302',
    name: 'Michael Scott',
    department: 'Operations',
    designation: 'Regional Director',
    enrolled: false,
  },
  {
    employee_id: 'EMP-303',
    name: 'Dwight Schrute',
    department: 'Sales',
    designation: 'Assistant to Regional Director',
    enrolled: false,
  },
  {
    employee_id: 'EMP-304',
    name: 'Jim Halpert',
    department: 'Sales',
    designation: 'Senior Account Executive',
    enrolled: false,
  },
];

export function getCorporateRoster(): EmployeeRosterItem[] {
  if (typeof window === 'undefined') return INITIAL_CORPORATE_ROSTER;
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(INITIAL_CORPORATE_ROSTER));
      return INITIAL_CORPORATE_ROSTER;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CORPORATE_ROSTER;
  } catch {
    return INITIAL_CORPORATE_ROSTER;
  }
}

export function saveCorporateRoster(roster: EmployeeRosterItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(roster));
  }
}

export function findRosterEmployee(employeeId: string): EmployeeRosterItem | null {
  const cleanId = employeeId.trim().toUpperCase();
  const roster = getCorporateRoster();
  return roster.find((item) => item.employee_id.toUpperCase() === cleanId) || null;
}

export function updateRosterEnrollment(
  employeeId: string,
  data: {
    password: string;
    photo_url: string;
    face_descriptor: number[];
    name?: string;
    department?: string;
    designation?: string;
  }
): EmployeeRosterItem {
  const cleanId = employeeId.trim().toUpperCase();
  const roster = getCorporateRoster();
  const existing = roster.find((item) => item.employee_id.toUpperCase() === cleanId);

  const updated: EmployeeRosterItem = {
    employee_id: cleanId,
    name: existing?.name || data.name || 'Employee',
    department: existing?.department || data.department || 'Operations',
    designation: existing?.designation || data.designation || 'Staff Member',
    enrolled: true,
    password: data.password,
    photo_url: data.photo_url,
    face_descriptor: data.face_descriptor,
  };

  const newRoster = existing
    ? roster.map((item) => (item.employee_id.toUpperCase() === cleanId ? updated : item))
    : [...roster, updated];

  saveCorporateRoster(newRoster);
  return updated;
}

/**
 * Parses CSV spreadsheet containing Employee ID, Full Name, Department, and Designation.
 * Tolerant of various column header names and whitespace.
 */
export function parseEmployeeSpreadsheet(csvText: string): {
  success: boolean;
  records: EmployeeRosterItem[];
  error?: string;
} {
  const cleanText = csvText.trim();
  if (!cleanText) {
    return { success: false, records: [], error: 'The uploaded file is empty.' };
  }

  const lines = cleanText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return {
      success: false,
      records: [],
      error: 'CSV must contain at least one header row and one employee row.',
    };
  }

  // Parse header line
  const headerTokens = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  // Find column indices
  let idIndex = headerTokens.findIndex((h) => h.includes('id') || h.includes('empid') || h.includes('code'));
  let nameIndex = headerTokens.findIndex((h) => h.includes('name') || h.includes('fullname') || h.includes('employee'));
  let deptIndex = headerTokens.findIndex((h) => h.includes('dept') || h.includes('department'));
  let desigIndex = headerTokens.findIndex((h) => h.includes('desig') || h.includes('designation') || h.includes('role') || h.includes('title') || h.includes('position'));

  // Fallbacks if headers didn't match standard names
  if (idIndex === -1 && headerTokens.length >= 1) idIndex = 0;
  if (nameIndex === -1 && headerTokens.length >= 2) nameIndex = 1;
  if (deptIndex === -1 && headerTokens.length >= 3) deptIndex = 2;
  if (desigIndex === -1 && headerTokens.length >= 4) desigIndex = 3;

  const currentRoster = getCorporateRoster();
  const existingMap = new Map(currentRoster.map((item) => [item.employee_id.toUpperCase(), item]));
  const parsedItems: EmployeeRosterItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowTokens = parseCsvLine(lines[i]);
    if (rowTokens.length === 0 || rowTokens.every((t) => !t.trim())) continue;

    const rawId = rowTokens[idIndex]?.trim();
    const rawName = rowTokens[nameIndex]?.trim() || 'Employee';
    const rawDept = deptIndex >= 0 ? rowTokens[deptIndex]?.trim() || 'Operations' : 'Operations';
    const rawDesig = desigIndex >= 0 ? rowTokens[desigIndex]?.trim() || 'Staff' : 'Staff';

    if (!rawId) continue;
    const cleanId = rawId.toUpperCase();

    const existing = existingMap.get(cleanId);

    parsedItems.push({
      employee_id: cleanId,
      name: rawName,
      department: rawDept,
      designation: rawDesig,
      enrolled: existing?.enrolled || false,
      password: existing?.password,
      photo_url: existing?.photo_url,
      face_descriptor: existing?.face_descriptor,
    });
  }

  if (parsedItems.length === 0) {
    return {
      success: false,
      records: [],
      error: 'Could not extract valid employee rows from the spreadsheet. Check columns format.',
    };
  }

  return { success: true, records: parsedItems };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
    } else if ((char === ',' || char === '\t') && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function generateSampleCsv(): string {
  return `Employee ID,Full Name,Department,Designation
EMP-101,Sarah Connor,Engineering,Senior Lead Engineer
EMP-204,Ankon Roy,Product & Design,Product Lead
EMP-102,John Connor,Security & Operations,Systems Administrator
EMP-301,Emily Davis,Human Resources,HR Specialist
EMP-302,Michael Scott,Operations,Regional Director
EMP-303,Dwight Schrute,Sales,Assistant to Regional Director
EMP-304,Jim Halpert,Sales,Senior Account Executive
EMP-305,Pam Beesly,Administration,Office Manager
EMP-306,Stanley Hudson,Sales,Sales Representative
EMP-307,Kevin Malone,Finance,Senior Accountant`;
}
