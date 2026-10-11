/**
 * Tiện ích xử lý và chuẩn hóa Mã Nhân Viên kết hợp Ngày Tháng Năm Sinh
 * Định dạng chuẩn: NV-YYYYMMDD-XXXX (hoặc NV-DDMMYYYY-XXXX)
 * Ví dụ: Ngày sinh 14/08/1972 -> NV-19720814-0001
 */

export interface ParsedDob {
  year: string;
  month: string;
  day: string;
  formattedIso: string; // YYYY-MM-DD
}

export const parseDobComponents = (dob: string): ParsedDob => {
  let year = '1990';
  let month = '01';
  let day = '01';

  if (dob) {
    const trimmed = dob.trim();
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          year = parts[0];
          month = parts[1];
          day = parts[2];
        } else {
          // DD-MM-YYYY
          day = parts[0];
          month = parts[1];
          year = parts[2];
        }
      }
    } else if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD/MM/YYYY
          day = parts[0];
          month = parts[1];
          year = parts[2];
        } else {
          // YYYY/MM/DD
          year = parts[0];
          month = parts[1];
          day = parts[2];
        }
      }
    } else {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 8) {
        year = digits.slice(0, 4);
        month = digits.slice(4, 6);
        day = digits.slice(6, 8);
      }
    }
  }

  year = year.padStart(4, '0').slice(-4);
  month = month.padStart(2, '0').slice(-2);
  day = day.padStart(2, '0').slice(-2);

  return {
    year,
    month,
    day,
    formattedIso: `${year}-${month}-${day}`,
  };
};

/**
 * Tạo mã nhân viên kết hợp ngày tháng năm sinh tương ứng
 */
export const formatEmployeeCodeWithDob = (
  dob: string,
  existingCode?: string,
  seqIndex: number = 1,
  format: 'YYYYMMDD' | 'DDMMYYYY' = 'YYYYMMDD'
): string => {
  // Trích xuất số thứ tự 4 số hiện tại nếu có
  let seqStr = String(seqIndex).padStart(4, '0');
  if (existingCode) {
    const match = existingCode.match(/(\d{4})$/);
    if (match) {
      seqStr = match[1];
    } else {
      const numMatch = existingCode.match(/(\d+)/g);
      if (numMatch && numMatch.length > 0) {
        const lastNum = numMatch[numMatch.length - 1];
        if (lastNum.length <= 4) {
          seqStr = lastNum.padStart(4, '0');
        }
      }
    }
  }

  const { year, month, day } = parseDobComponents(dob);
  const dateSegment = format === 'DDMMYYYY' ? `${day}${month}${year}` : `${year}${month}${day}`;

  return `NV-${dateSegment}-${seqStr}`;
};

/**
 * Kiểm tra xem mã nhân viên có khớp với ngày tháng năm sinh hay không
 */
export const isCodeMatchingDob = (code: string, dob: string): boolean => {
  if (!code || !dob) return false;
  const { year, month, day } = parseDobComponents(dob);
  const ymd = `${year}${month}${day}`;
  const dmy = `${day}${month}${year}`;
  return code.includes(ymd) || code.includes(dmy);
};
