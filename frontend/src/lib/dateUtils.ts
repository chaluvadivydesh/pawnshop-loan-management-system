/**
 * Parses day, month, year components from various date string formats.
 */
export function parseDateComponents(dateStr?: string | null): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleanStr = dateStr.split('T')[0].trim();
  if (!cleanStr) return null;

  // 1. Dash-separated: YYYY-MM-DD or DD-MM-YYYY
  let parts = cleanStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return { year, month, day };
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return { year, month, day };
    }
  }

  // 2. Space, slash, or dot separated: DD MM YYYY, DD/MM/YYYY, YYYY/MM/DD, etc.
  parts = cleanStr.split(/[\/\s\.]+/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY/MM/DD or YYYY MM DD
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return { year, month, day };
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY or DD MM YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return { year, month, day };
    }
  }

  return null;
}

/**
 * Validates whether a date string represents a valid calendar date.
 * Validates days in month, leap years, and month range (1-12).
 */
export function isValidCalendarDate(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') return false;

  const parsed = parseDateComponents(dateStr);
  if (!parsed) return false;

  const { year, month, day } = parsed;

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Date formatting utility for Loan Management System.
 * Standard Display Format: DD MM YYYY (e.g. 05 07 2027)
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr || dateStr.trim() === '') return '-';

  // Extract YYYY-MM-DD from ISO string or standard YYYY-MM-DD
  const cleanStr = dateStr.split('T')[0].trim();

  // If format is YYYY-MM-DD
  const dashParts = cleanStr.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const [yyyy, mm, dd] = dashParts;
    return `${dd.padStart(2, '0')} ${mm.padStart(2, '0')} ${yyyy}`;
  }

  // If format is DD/MM/YYYY or YYYY/MM/DD
  const slashParts = cleanStr.split('/');
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      const [yyyy, mm, dd] = slashParts;
      return `${dd.padStart(2, '0')} ${mm.padStart(2, '0')} ${yyyy}`;
    } else {
      const [dd, mm, yyyy] = slashParts;
      return `${dd.padStart(2, '0')} ${mm.padStart(2, '0')} ${yyyy}`;
    }
  }

  // If format is already DD MM YYYY
  const spaceParts = cleanStr.split(' ');
  if (spaceParts.length === 3) {
    const [dd, mm, yyyy] = spaceParts;
    return `${dd.padStart(2, '0')} ${mm.padStart(2, '0')} ${yyyy}`;
  }

  return dateStr;
}

/**
 * Calculates due date given a loan date (YYYY-MM-DD) and loan period in months.
 */
export function calculateDueDate(loanDateStr: string, loanPeriodMonths: number): string {
  if (!loanDateStr || loanDateStr.trim() === '' || !loanPeriodMonths) return loanDateStr;
  const cleanStr = loanDateStr.split('T')[0].trim();
  const parts = cleanStr.split('-');
  if (parts.length !== 3) return loanDateStr;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return loanDateStr;

  const totalMonths = m + loanPeriodMonths;
  const newY = y + Math.floor((totalMonths - 1) / 12);
  const newM = ((totalMonths - 1) % 12) + 1;

  const strM = String(newM).padStart(2, '0');
  const strD = String(d).padStart(2, '0');

  return `${newY}-${strM}-${strD}`;
}

