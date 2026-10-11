/**
 * Các tiện ích xử lý và định dạng tiền lương, phụ cấp theo quy định
 * Mức lương cơ sở mặc định: 2.530.000 VNĐ/tháng
 */

export const DEFAULT_BASE_SALARY = 2530000;

/**
 * Phân tích và chuyển đổi giá trị mức lương cơ sở từ dữ liệu đầu vào (Google Sheets, Excel, Form, DB)
 * Loại bỏ toàn bộ ký tự phân cách hàng nghìn (dấu chấm, dấu phẩy) trước khi chuyển thành số nguyên (parseInt).
 * Đồng thời xử lý khử triệt để tình trạng số tiền bị nhân thừa số 0 thành hàng tỷ/hàng triệu do lỗi parse trước đó.
 */
export function parseBaseSalary(val: any, fallback: number = DEFAULT_BASE_SALARY): number {
  if (val === null || val === undefined) return fallback;

  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return fallback;

    let n = Math.round(val);
    
    // Nếu giá trị bị lưu nhầm dạng số thập phân rút gọn (ví dụ 2.34 hoặc 2.53)
    if (n > 0 && n < 100) {
      return Math.round(n * 1000000);
    }

    // Nếu giá trị bị nhân sai thành hàng trăm triệu/hàng tỷ/hàng nghìn tỷ (vd: 2.340.000.000.000)
    // Lương cơ sở chuẩn nằm trong khoảng từ 1.000.000 đến 30.000.000 VNĐ
    while (n > 50000000 && n % 10 === 0) {
      n = n / 10;
    }
    while (n > 50000000) {
      n = Math.round(n / 1000);
    }

    return n > 0 ? n : fallback;
  }

  let s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return fallback;
  }

  // 1. Loại bỏ các ký tự tiền tệ và khoảng trắng thừa
  s = s.replace(/[đvnđVNĐđồngdong\s]/gi, '').trim();

  // 2. Nếu chuỗi có phần thập phân xu/hào phía sau (vd: 2.340.000,00 hoặc 2,530,000.00)
  // Loại bỏ phần thập phân trước để không biến 2 số 0 thập phân thành hàng trăm
  s = s.replace(/,\d{1,2}$/, '');
  s = s.replace(/\.\d{1,2}$/, '');

  // 3. Loại bỏ toàn bộ dấu phân cách hàng nghìn (dấu chấm và dấu phẩy)
  s = s.replace(/[\.,]/g, '');

  // 4. Lọc sạch chỉ giữ chữ số
  s = s.replace(/[^0-9]/g, '');

  let n = parseInt(s, 10);
  if (isNaN(n) || n <= 0) return fallback;

  // Phục hồi nếu bị lưu dạng số nhỏ (< 100, vd: 2.34 hoặc 2.53)
  if (n > 0 && n < 100) {
    n = Math.round(n * 1000000);
  }

  // Nếu lưu dạng nghìn (vd: 2340 hoặc 2530)
  if (n >= 1000 && n <= 30000) {
    n = n * 1000;
  }

  // 5. Khử số bị nhân thừa số 0 thành hàng tỷ/hàng nghìn tỷ
  while (n > 50000000 && n % 10 === 0) {
    n = n / 10;
  }
  while (n > 50000000) {
    n = Math.round(n / 1000);
  }

  return n > 0 ? n : fallback;
}

/**
 * Định dạng mức lương cơ sở thành tiền VNĐ hiển thị đẹp mắt (VD: 2.530.000 đ hoặc 2.340.000 đ)
 */
export function formatBaseSalary(val: number | string | undefined | null): string {
  const num = parseBaseSalary(val, DEFAULT_BASE_SALARY);
  return `${num.toLocaleString('vi-VN')} đ`;
}

/**
 * Đọc số kiểu Decimal (hệ số lương, phụ cấp chức vụ, phụ cấp ưu đãi, phụ cấp công vụ...)
 * Sử dụng parseFloat() để bảo toàn nguyên vẹn giá trị thập phân (ví dụ: 0.25, 0.70, 2.34...)
 * Hỗ trợ dấu chấm (0.25) và dấu phẩy tiếng Việt (0,25)
 */
export function parseDecimalNumber(val: any, fallback: number = 0.0): number {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;

  let s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return fallback;
  }

  // Bỏ dấu % hoặc ký tự dấu +
  s = s.replace(/%/g, '').replace('+', '').trim();
  // Đổi dấu phẩy thành dấu chấm cho parseFloat()
  s = s.replace(',', '.');
  // Lọc chỉ giữ chữ số, dấu chấm và dấu trừ
  s = s.replace(/[^0-9.-]/g, '');

  const n = parseFloat(s);
  return isNaN(n) ? fallback : n;
}

/**
 * Định dạng số kiểu Decimal hiển thị chuẩn (mặc định 2 chữ số thập phân: 0.70, 0.25, 2.34, 0.00)
 */
export function formatDecimal(val: number | string | undefined | null, digits: number = 2): string {
  const n = parseDecimalNumber(val, 0.0);
  return n.toFixed(digits);
}

/**
 * Định dạng phụ cấp chức vụ lãnh đạo (PCCV) chuẩn định dạng DECIMAL (VD: 0.70, 0.25, 0.00)
 * Tuyệt đối không thêm tiền tố `+`
 */
export function formatPCCV(val: number | string | undefined | null): string {
  return formatDecimal(val, 2);
}

/**
 * Định dạng hiển thị phụ cấp phần trăm (%) lúc render:
 * Nếu dữ liệu gốc là kiểu thập phân (vd: 0.25, 0.10) thì nhân 100 + '%' (thành 25%, 10%)
 * Nếu dữ liệu gốc đã là số nguyên phần trăm (vd: 25, 10) thì hiển thị trực tiếp + '%' (thành 25%, 10%)
 * Giữ nguyên giá trị dữ liệu gốc, chỉ định dạng lúc render giao diện theo đúng yêu cầu
 */
export function formatPercentAllowance(val: number | string | undefined | null, fallback: number = 0): string {
  if (val === null || val === undefined || val === '') return `${fallback}%`;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.').replace('%', ''));
  if (isNaN(n)) return `${fallback}%`;
  
  if (n > 0 && n <= 1) {
    // Giá trị thập phân ví dụ 0.25 -> 25%, 0.1 -> 10%
    return `${Math.round(n * 100)}%`;
  }
  return `${n}%`;
}

/**
 * Đọc số tiền thành chữ tiếng Việt chuẩn kế toán hành chính (VD: "Một trăm hai mươi triệu ba trăm nghìn đồng chẵn.")
 */
export function readVietnameseCurrency(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return 'Không đồng';
  
  const defaultDigits = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readGroupOfThree(threeDigits: number, showZeroHundred: boolean = true): string {
    const h = Math.floor(threeDigits / 100);
    const t = Math.floor((threeDigits % 100) / 10);
    const u = threeDigits % 10;
    let res = '';

    if (h > 0 || showZeroHundred) {
      res += defaultDigits[h] + ' trăm ';
    }

    if (t === 0 && u > 0) {
      if (h > 0 || showZeroHundred) res += 'lẻ ';
      res += defaultDigits[u];
    } else if (t === 1) {
      res += 'mười ';
      if (u === 1) res += 'một';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += defaultDigits[u];
    } else if (t > 1) {
      res += defaultDigits[t] + ' mươi ';
      if (u === 1) res += 'mốt';
      else if (u === 4) res += 'tư';
      else if (u === 5) res += 'lăm';
      else if (u > 0) res += defaultDigits[u];
    }

    return res.trim();
  }

  let n = Math.round(amount);
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  let result = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp > 0) {
      const showZero = i < groups.length - 1;
      const grpText = readGroupOfThree(grp, showZero);
      result += grpText + ' ' + units[i] + ' ';
    }
  }

  result = result.trim();
  if (!result) return 'Không đồng';

  // Viết hoa chữ cái đầu và thêm đuôi "đồng chẵn."
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn.';
  return result.replace(/\s+/g, ' ');
}
