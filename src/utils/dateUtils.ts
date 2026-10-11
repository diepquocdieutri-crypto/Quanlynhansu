/**
 * Tiện ích định dạng ngày tháng chuẩn Việt Nam: dd/mm/yyyy
 * Chi cục Chăn nuôi và Thú y TP.HCM
 */

/**
 * Định dạng chuỗi ngày tháng bất kỳ sang dạng chuẩn dd/mm/yyyy
 * Ví dụ: '1985-05-20' -> '20/05/1985'
 *        '2026-09-26T08:21:52.000Z' -> '26/09/2026'
 *        '20/05/1985' -> '20/05/1985'
 */
export function formatDateVN(dateStr?: string | number | Date | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // 1. Nếu đã là dd/mm/yyyy hoặc d/m/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }

  // 2. Nếu là YYYY-MM-DD hoặc YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const cleanDate = str.split('T')[0].split(' ')[0];
    const separator = cleanDate.includes('-') ? '-' : '/';
    const parts = cleanDate.split(separator);
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // 3. Thử parse qua Date object
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }
  } catch {
    // fallback
  }

  return str;
}

/**
 * Định dạng ngày giờ chuẩn dd/mm/yyyy HH:mm
 */
export function formatDateTimeVN(dateStr?: string | number | Date | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      const hh = String(parsed.getHours()).padStart(2, '0');
      const mm = String(parsed.getMinutes()).padStart(2, '0');
      return `${d}/${m}/${y} ${hh}:${mm}`;
    }
  } catch {}

  return formatDateVN(str);
}

/**
 * Lấy ngày hôm nay theo định dạng dd/mm/yyyy
 */
export function getTodayVN(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Chuyển từ dd/mm/yyyy sang YYYY-MM-DD để dùng cho <input type="date" />
 */
export function toISODate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    return str.split('T')[0];
  }

  return str;
}

/**
 * Phân tích chuỗi ngày tháng an toàn hỗ trợ chuẩn Việt Nam (DD/MM/YYYY), ISO (YYYY-MM-DD), Date object
 */
export function parseDateSafe(dateInput?: string | Date | number | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  const str = String(dateInput).trim();
  if (!str) return null;

  // 1. Chuẩn DD/MM/YYYY hoặc D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // 2. Chuẩn YYYY-MM-DD hoặc YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) {
    const cleanDate = str.split('T')[0].split(' ')[0];
    const separator = cleanDate.includes('-') ? '-' : '/';
    const parts = cleanDate.split(separator);
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // 3. Fallback standard Date constructor
  try {
    const dt = new Date(str);
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}
