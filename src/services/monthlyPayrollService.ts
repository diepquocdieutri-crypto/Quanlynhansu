import { 
  Employee, 
  MonthlyPayrollRecord, 
  PayrollCategory, 
  StaffType,
  EmployeeCumulativeIncomeReport,
  EmployeeIncomeFluctuation
} from '../types/hrm';
import { 
  getAccessToken, 
  fetchWithGoogleAuth, 
  GoogleAuthError, 
  clearAccessToken, 
  notifyGoogleAuthExpired,
  db
} from './firebaseAuth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { sortEmployeesByPriority } from '../utils/leadershipUtils';
import { parseDateSafe } from '../utils/dateUtils';
import { INITIAL_EMPLOYEES } from '../data/initialData';
import * as XLSX from 'xlsx';

export const isWorkingEmployee = (emp: Employee): boolean => {
  if (!emp) return false;
  const status = (emp.status || '').trim().toLowerCase();
  if (!status) return true; // Mặc định đang công tác
  const inactiveKeywords = ['nghỉ hưu', 'đã nghỉ hưu', 'thôi việc', 'chuyển công tác', 'đã chuyển công tác', 'nghỉ việc'];
  return !inactiveKeywords.some(kw => status.includes(kw));
};

export const MONTHLY_PAYROLL_SPREADSHEET_TITLE = 'Chi Cục Chăn Nuôi & Thú Y TPHCM - Bảng Lương & Thu Nhập Hàng Tháng';
export const MONTHLY_PAYROLL_ALT_TITLE = 'Bản sao của Chi Cục Chăn Nuôi & Thú Y TPHCM - Bảng Lương & Thu Nhập Hàng Tháng';
export const MONTHLY_PAYROLL_CUSTOM_SHEET_KEY = 'ccty_payroll_spreadsheet_id';
export const MONTHLY_PAYROLL_APPS_SCRIPT_URL_KEY = 'ccty_payroll_apps_script_url';
export const PAYROLL_HISTORY_KEY = 'ccty_payroll_periods_history_v1';
export const PAYROLL_DATABASE_KEY = 'ccty_payroll_database_records_v1';

export interface CategorySummary {
  category: PayrollCategory;
  title: string;
  shortTitle: string;
  count: number;
  totalSalaryAmount: number;
  totalAllowanceAmount: number;
  totalGrossIncome: number;
  totalDeductions: number;
  totalNetSalary: number;
}

/**
 * Chi tiết lương của từng nhân viên theo yêu cầu cấu trúc CSDL
 */
export interface EmployeePayrollDetail {
  employeeCode: string;          // Mã NV
  fullName: string;              // Tên
  position: string;              // Chức vụ
  coefficient: number;           // Hệ số
  allowances: {                  // Các khoản phụ cấp
    leadership: number;          // Phụ cấp chức vụ
    seniorityBeyond: number;     // Thâm niên vượt khung
    responsibility: number;      // Trách nhiệm / khác
    travel: number;              // Lưu động
    total: number;               // Tổng phụ cấp
  };
  insuranceDeduction: number;     // Trừ BHXH (BHXH, BHYT, BHTN)
  netSalary: number;              // Thực nhận
  category?: PayrollCategory;    // Phân loại cán bộ
  staffType?: string;            // Loại nhân sự
  departmentName?: string;
  jobRankCode?: string;
  salaryAmount?: number;
  [key: string]: any;
}

export type PayrollStorageKey = 
  | 'LUONG_CONG_CHUC' 
  | 'LUONG_VIEN_CHUC' 
  | 'LUONG_HD_111' 
  | 'LUONG_THUY_PX' 
  | 'LUONG_KHOAN_CM';

export const PAYROLL_STORAGE_KEYS = {
  CONG_CHUC: 'LUONG_CONG_CHUC',
  VIEN_CHUC: 'LUONG_VIEN_CHUC',
  HOP_DONG_111: 'LUONG_HD_111',
  THU_Y_PX: 'LUONG_THUY_PX',
  KHOAN_CM: 'LUONG_KHOAN_CM',
} as const;

/**
 * Cấu trúc dữ liệu bản ghi bảng lương lưu trữ vào Cơ sở dữ liệu (Firestore / Local Storage)
 * Phân chia theo 5 nhóm nhân sự riêng biệt theo yêu cầu chuẩn xác
 */
export interface MonthlyPayrollDatabaseRecord {
  period: string;                // Kỳ lương (ví dụ: '10/2026')
  month: number;
  year: number;
  baseSalary: number;            // Mức lương cơ sở (ví dụ: 2530000)
  totalEmployees: number;        // Tổng số nhân sự
  totalAmount: number;           // Tổng tiền thực nhận của toàn cơ quan
  
  // 5 nhóm chuẩn xác theo yêu cầu lưu trữ CSDL:
  LUONG_CONG_CHUC: EmployeePayrollDetail[];   // Lọc các nhân sự là Công chức
  LUONG_VIEN_CHUC: EmployeePayrollDetail[];   // Lọc các nhân sự là Viên chức
  LUONG_HD_111: EmployeePayrollDetail[];      // Lọc các nhân sự là Hợp đồng 111 / 68
  LUONG_THUY_PX: EmployeePayrollDetail[];     // Lọc các nhân sự là Nhân viên Thú y Phường Xã
  LUONG_KHOAN_CM: EmployeePayrollDetail[];    // Lọc các nhân sự thuộc diện Khoán chuyên môn

  details: EmployeePayrollDetail[]; // Mảng tổng hợp chi tiết tất cả nhân viên (tương thích ngược)
  calculatedAt: string;          // Thời điểm lưu ISO
  data?: Record<PayrollCategory, MonthlyPayrollRecord[]>; // Dữ liệu phân nhóm cho giao diện
  updatedAt?: string;
  [key: string]: any;
}

export interface SavedPeriodRecord {
  periodKey: string; // "10/2026"
  month: number;
  year: number;
  baseSalary: number;
  calculatedAt: string;
  data: Record<PayrollCategory, MonthlyPayrollRecord[]>;
}

export const PAYROLL_CATEGORY_META: Record<PayrollCategory, { title: string; shortTitle: string; sheetName: string; badgeColor: string }> = {
  CONG_CHUC: {
    title: 'Bảng Lương Công Chức',
    shortTitle: 'Công chức',
    sheetName: 'LUONG_CONG_CHUC',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  VIEN_CHUC: {
    title: 'Bảng Lương Viên Chức',
    shortTitle: 'Viên chức',
    sheetName: 'LUONG_VIEN_CHUC',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  HOP_DONG_111: {
    title: 'Bảng Lương Hợp Đồng 111 & HĐ 68',
    shortTitle: 'Hợp đồng 111',
    sheetName: 'LUONG_HD_111',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  THU_Y_PX: {
    title: 'Bảng Lương Nhân Viên Thú Y Phường Xã',
    shortTitle: 'Thú y Phường Xã',
    sheetName: 'LUONG_THUY_PX',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  KHOAN_CM: {
    title: 'Bảng Lương Khoán Chuyên Môn',
    shortTitle: 'Khoán chuyên môn',
    sheetName: 'LUONG_KHOAN_CM',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
};

export class MonthlyPayrollService {
  /**
   * Phân loại nhân sự vào nhóm tính lương (5 nhóm)
   */
  public static getPayrollCategory(emp: Employee): PayrollCategory {
    const staffType = (emp.staffType || '').toLowerCase();
    const rankCode = (emp.jobRankCode || emp.salary?.rankCode || '').toLowerCase();

    // 1. Khoán chuyên môn
    if (
      staffType.includes('khoán') || 
      staffType.includes('khoan') ||
      staffType.includes('khoán chuyên môn')
    ) {
      return 'KHOAN_CM';
    }

    // 2. Thú y Phường Xã
    if (
      staffType.includes('thú y px') || 
      staffType.includes('thu y px') || 
      staffType.includes('phường xã') || 
      staffType.includes('phuong xa') ||
      staffType.includes('nhân viên thú y')
    ) {
      return 'THU_Y_PX';
    }

    // 2. Hợp đồng 111 / HĐ 68 / Hợp đồng lao động
    if (
      staffType.includes('111') || 
      staffType.includes('68') || 
      staffType.includes('hợp đồng') || 
      staffType.includes('hop dong') ||
      staffType.includes('hđld') ||
      staffType.includes('hdld')
    ) {
      return 'HOP_DONG_111';
    }

    // 3. Công chức (Ưu tiên theo đúng staffType trong DS nhân sự)
    if (
      staffType.includes('công chức') || 
      staffType.includes('cong chuc')
    ) {
      return 'CONG_CHUC';
    }

    // 4. Viên chức
    if (
      staffType.includes('viên chức') || 
      staffType.includes('vien chuc') ||
      rankCode.startsWith('v.') ||
      rankCode.startsWith('v ') ||
      emp.departmentId === 'TT_CDXN' ||
      emp.departmentName?.toLowerCase().includes('trung tâm')
    ) {
      return 'VIEN_CHUC';
    }

    // Nếu ngạch công chức hành chính 01.xxx hoặc công chức kiểm tra/kiểm dịch thú y 09.xxx
    if (rankCode.startsWith('01.') || rankCode.startsWith('09.')) {
      return 'CONG_CHUC';
    }

    // Mặc định là Công chức
    return 'CONG_CHUC';
  }

  /**
   * Phân loại trường 'Loại nhân sự' (hoặc category/jobRankCode) thành đúng 1 trong 5 key CSDL chuẩn xác:
   * LUONG_CONG_CHUC, LUONG_VIEN_CHUC, LUONG_HD_111, LUONG_THUY_PX, LUONG_KHOAN_CM
   */
  public static getPayrollStorageKey(
    staffType?: string,
    category?: PayrollCategory,
    jobRankCode?: string
  ): PayrollStorageKey {
    const sType = (staffType || '').toLowerCase().trim();
    const rank = (jobRankCode || '').toLowerCase().trim();

    // 1. LUONG_KHOAN_CM (Lọc các nhân sự thuộc diện Khoán chuyên môn)
    if (
      category === 'KHOAN_CM' ||
      sType.includes('khoán') ||
      sType.includes('khoan') ||
      sType === 'khoán chuyên môn'
    ) {
      return 'LUONG_KHOAN_CM';
    }

    // 2. LUONG_THUY_PX (Lọc các nhân sự là Nhân viên Thú y Phường Xã)
    if (
      category === 'THU_Y_PX' ||
      sType.includes('thú y px') ||
      sType.includes('thu y px') ||
      sType.includes('phường xã') ||
      sType.includes('phuong xa') ||
      sType.includes('nhân viên thú y')
    ) {
      return 'LUONG_THUY_PX';
    }

    // 3. LUONG_HD_111 (Lọc các nhân sự là Hợp đồng 111 / 68)
    if (
      category === 'HOP_DONG_111' ||
      sType.includes('111') ||
      sType.includes('68') ||
      sType.includes('hợp đồng') ||
      sType.includes('hop dong') ||
      sType.includes('hđld') ||
      sType.includes('hdld')
    ) {
      return 'LUONG_HD_111';
    }

    // 4. LUONG_VIEN_CHUC (Lọc các nhân sự là Viên chức)
    if (
      category === 'VIEN_CHUC' ||
      sType.includes('viên chức') ||
      sType.includes('vien chuc') ||
      rank.startsWith('v.') ||
      rank.startsWith('v ')
    ) {
      return 'LUONG_VIEN_CHUC';
    }

    // 5. LUONG_CONG_CHUC (Lọc các nhân sự là Công chức)
    return 'LUONG_CONG_CHUC';
  }

  /**
   * Phân nhóm dữ liệu bảng lương thành 5 nhóm chuẩn xác bằng hàm reduce
   */
  public static classifyPayrollDetails(details: EmployeePayrollDetail[]): {
    LUONG_CONG_CHUC: EmployeePayrollDetail[];
    LUONG_VIEN_CHUC: EmployeePayrollDetail[];
    LUONG_HD_111: EmployeePayrollDetail[];
    LUONG_THUY_PX: EmployeePayrollDetail[];
    LUONG_KHOAN_CM: EmployeePayrollDetail[];
  } {
    return (details || []).reduce(
      (acc, item) => {
        const key = this.getPayrollStorageKey(item.staffType, item.category, item.jobRankCode);
        acc[key].push(item);
        return acc;
      },
      {
        LUONG_CONG_CHUC: [] as EmployeePayrollDetail[],
        LUONG_VIEN_CHUC: [] as EmployeePayrollDetail[],
        LUONG_HD_111: [] as EmployeePayrollDetail[],
        LUONG_THUY_PX: [] as EmployeePayrollDetail[],
        LUONG_KHOAN_CM: [] as EmployeePayrollDetail[],
      }
    );
  }

  /**
   * Mức lương cơ sở chuẩn theo từng kỳ theo quy định pháp luật:
   * - Đến hết Tháng 09/2026: 2.340.000 đ (Nghị định 73/2024/NĐ-CP)
   * - Từ Tháng 10/2026 trở đi: 2.530.000 đ (Điều chỉnh mức lương cơ sở mới)
   */
  public static getBaseSalaryForPeriod(month: number, year: number): number {
    if (year > 2026 || (year === 2026 && month >= 10)) {
      return 2530000;
    }
    return 2340000;
  }

  /**
   * Xác định hệ số lương và phụ cấp của nhân sự tại một kỳ tháng/năm cụ thể
   * Tra cứu lịch sử nâng lương (salaryHistory) để lấy hệ số hiệu lực tương ứng với kỳ tính lương
   */
  public static resolveEmployeeSalaryForPeriod(
    emp: Employee,
    month: number,
    year: number
  ): {
    coefficient: number;
    step: number;
    leadershipAllowanceCoeff: number;
    beyondFramePercent: number;
    responsibilityAllowanceCoeff: number;
    travelAllowanceAmount: number;
    changeNote?: string;
  } {
    const periodDate = new Date(year, month - 1, 28);
    let coefficient = Number(emp.salary?.coefficient) || 2.34;
    let step = Number(emp.salary?.step) || 1;
    let changeNote = '';

    // Tra cứu trong salaryHistory
    if (emp.salaryHistory && emp.salaryHistory.length > 0) {
      // Lọc các bản ghi nâng lương có ngày hiệu lực <= ngày kết thúc kỳ tính lương
      const validHistory = emp.salaryHistory.filter(h => {
        if (!h.effectiveDate) return false;
        const eff = parseDateSafe(h.effectiveDate);
        return eff !== null && eff <= periodDate;
      });

      if (validHistory.length > 0) {
        // Sắp xếp giảm dần theo effectiveDate để lấy quyết định gần nhất đang áp dụng trong kỳ này
        validHistory.sort((a, b) => {
          const tA = parseDateSafe(a.effectiveDate)?.getTime() || 0;
          const tB = parseDateSafe(b.effectiveDate)?.getTime() || 0;
          return tB - tA;
        });
        const latest = validHistory[0];
        coefficient = Number(latest.coefficient) || coefficient;
        step = Number(latest.step) || step;
        changeNote = latest.decisionNumber 
          ? `QĐ số ${latest.decisionNumber} (${latest.type})` 
          : (latest.notes || '');
      } else {
        // Kỳ tính lương này trước ngày hiệu lực của bản ghi nâng lương đầu tiên
        const sortedAll = [...emp.salaryHistory].sort((a, b) => {
          const tA = parseDateSafe(a.effectiveDate)?.getTime() || 0;
          const tB = parseDateSafe(b.effectiveDate)?.getTime() || 0;
          return tA - tB;
        });
        if (sortedAll.length > 0) {
          const firstEff = parseDateSafe(sortedAll[0].effectiveDate);
          if (firstEff && firstEff > periodDate) {
            const firstStep = Number(sortedAll[0].step) || step;
            if (firstStep > 1) {
              step = firstStep - 1;
              const stepDiff = 0.33;
              coefficient = Math.max(1.86, Number((Number(sortedAll[0].coefficient) - stepDiff).toFixed(2)));
              changeNote = `Bậc ${step} (trước khi nâng bậc ${sortedAll[0].step})`;
            }
          }
        }
      }
    } else if (emp.salary?.effectiveDate) {
      const eff = parseDateSafe(emp.salary.effectiveDate);
      if (eff && eff > periodDate && (emp.salary.step || 1) > 1) {
        step = (emp.salary.step || 2) - 1;
        const stepDiff = 0.33;
        coefficient = Math.max(1.86, Number((coefficient - stepDiff).toFixed(2)));
        changeNote = `Bậc ${step} (trước khi nâng lương vào ${emp.salary.effectiveDate})`;
      }
    }

    const leadershipAllowanceCoeff = Number(emp.salary?.leadershipAllowance) || 0;
    const beyondFramePercent = Number(emp.salary?.beyondFramePercent) || 0;
    const responsibilityAllowanceCoeff = Number(emp.salary?.responsibilityAllowance ?? emp.salary?.otherAllowance) || 0;
    const travelAllowanceAmount = Number(emp.salary?.travelAllowance) || 0;

    return {
      coefficient,
      step,
      leadershipAllowanceCoeff,
      beyondFramePercent,
      responsibilityAllowanceCoeff,
      travelAllowanceAmount,
      changeNote,
    };
  }

  /**
   * Tính toán toàn diện bảng lương & các khoản thu nhập hàng tháng cho toàn bộ nhân sự
   * Tự động áp dụng mức lương cơ sở phù hợp với kỳ tính (Tháng 9: 2.340.000 đ, Tháng 10: 2.530.000 đ)
   * và tính toán đúng hệ số bậc lương theo quá trình biến động lương của từng cá nhân
   */
  public static calculatePayroll(
    employees: Employee[],
    month: number,
    year: number,
    baseSalary?: number
  ): Record<PayrollCategory, MonthlyPayrollRecord[]> {
    const periodKey = `${String(month).padStart(2, '0')}/${year}`;
    const calculatedAt = new Date().toISOString();
    const effectiveBaseSalary = (baseSalary && baseSalary > 0) 
      ? baseSalary 
      : this.getBaseSalaryForPeriod(month, year);

    // Fallback nếu danh sách truyền vào rỗng
    let sourceEmployees = employees;
    if (!sourceEmployees || sourceEmployees.length === 0) {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('ccty_employees') : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sourceEmployees = parsed;
          }
        }
      } catch {}
      if (!sourceEmployees || sourceEmployees.length === 0) {
        sourceEmployees = INITIAL_EMPLOYEES;
      }
    }

    const workingEmployees = (sourceEmployees || []).filter(e => isWorkingEmployee(e));
    const listToSort = workingEmployees.length > 0 ? workingEmployees : sourceEmployees;
    const sortedEmployees = sortEmployeesByPriority(listToSort);

    const result: Record<PayrollCategory, MonthlyPayrollRecord[]> = {
      CONG_CHUC: [],
      VIEN_CHUC: [],
      HOP_DONG_111: [],
      THU_Y_PX: [],
      KHOAN_CM: [],
    };

    sortedEmployees.forEach(emp => {
      const category = this.getPayrollCategory(emp);
      const isCongChuc = category === 'CONG_CHUC';

      // Tra cứu hệ số lương và phụ cấp tương ứng với kỳ tháng/năm này
      const resolvedSalary = this.resolveEmployeeSalaryForPeriod(emp, month, year);

      // 1. Hệ số lương & Thành tiền lương HSL
      const coefficient = resolvedSalary.coefficient;
      const salaryAmount = Math.round(coefficient * effectiveBaseSalary);

      // 2. Thâm niên vượt khung
      const beyondFramePercent = resolvedSalary.beyondFramePercent;
      const beyondFrameAmount = Math.round(salaryAmount * (beyondFramePercent / 100));

      // 3. Hệ số chức vụ lãnh đạo (PCCV)
      const leadershipAllowanceCoeff = resolvedSalary.leadershipAllowanceCoeff;
      const leadershipAllowanceAmount = Math.round(leadershipAllowanceCoeff * effectiveBaseSalary);

      // 4. Phụ cấp trách nhiệm
      const responsibilityAllowanceCoeff = resolvedSalary.responsibilityAllowanceCoeff;
      const responsibilityAllowanceAmount = Math.round(responsibilityAllowanceCoeff * effectiveBaseSalary);

      // 5. Phụ cấp ưu đãi ngành (UDN %)
      const industryAllowancePercent = Number(emp.salary?.industryAllowancePercent ?? 10);
      const baseForAllowances = salaryAmount + leadershipAllowanceAmount + beyondFrameAmount;
      const industryAllowanceAmount = Math.round(baseForAllowances * (industryAllowancePercent / 100));

      // 6. Phụ cấp công tác phí / lưu động (tiền mặt)
      const travelAllowanceAmount = resolvedSalary.travelAllowanceAmount;

      // 7. Phụ cấp công vụ (PCCVụ % - Chỉ áp dụng cho Công chức: 25%)
      const publicServiceAllowancePercent = isCongChuc 
        ? (Number(emp.salary?.publicServiceAllowancePercent) || 25) 
        : 0;
      const publicServiceAllowanceAmount = Math.round(baseForAllowances * (publicServiceAllowancePercent / 100));

      // 8. Tổng hệ số phụ cấp & Tổng tiền phụ cấp
      const totalAllowanceCoeff = leadershipAllowanceCoeff + responsibilityAllowanceCoeff + (coefficient * beyondFramePercent / 100);
      const totalAllowanceAmount = beyondFrameAmount + 
        leadershipAllowanceAmount + 
        responsibilityAllowanceAmount + 
        industryAllowanceAmount + 
        travelAllowanceAmount + 
        publicServiceAllowanceAmount;

      // 9. Tổng thu nhập trước trích nộp
      const totalGrossIncome = salaryAmount + totalAllowanceAmount;

      // 10. Các khoản trích nộp bảo hiểm xã hội theo quy định
      const insuranceSalaryBase = salaryAmount + leadershipAllowanceAmount + beyondFrameAmount + responsibilityAllowanceAmount;
      
      const socialInsuranceEmp = Math.round(insuranceSalaryBase * 0.08); // BHXH 8%
      const healthInsuranceEmp = Math.round(insuranceSalaryBase * 0.015); // BHYT 1.5%
      const unemploymentInsuranceEmp = isCongChuc ? 0 : Math.round(insuranceSalaryBase * 0.01); // BHTN 1% (Công chức: 0%)
      const totalDeductions = socialInsuranceEmp + healthInsuranceEmp + unemploymentInsuranceEmp;

      // 11. Tổng lương thực nhận
      const netSalary = Math.max(0, totalGrossIncome - totalDeductions);

      let note = `Kỳ lương: Tháng ${month}/${year} (MLCS: ${effectiveBaseSalary.toLocaleString('vi-VN')} đ)`;
      if (resolvedSalary.changeNote) {
        note += ` | ${resolvedSalary.changeNote}`;
      }

      result[category].push({
        employeeId: emp.id,
        code: emp.code,
        fullName: emp.fullName,
        departmentName: emp.departmentName || '',
        positionTitle: emp.positionTitle || 'Chuyên viên',
        leadershipTitle: leadershipAllowanceCoeff > 0 ? emp.positionTitle : '',
        jobRankCode: emp.jobRankCode || emp.salary?.rankCode || '01.003',
        jobRankName: emp.jobRankName || emp.salary?.rankName || 'Chuyên viên',
        staffType: emp.staffType,
        category,
        baseSalary: effectiveBaseSalary,
        coefficient,
        salaryAmount,
        beyondFramePercent,
        beyondFrameAmount,
        leadershipAllowanceCoeff,
        leadershipAllowanceAmount,
        responsibilityAllowanceCoeff,
        responsibilityAllowanceAmount,
        industryAllowancePercent,
        industryAllowanceAmount,
        travelAllowanceAmount,
        publicServiceAllowancePercent,
        publicServiceAllowanceAmount,
        totalAllowanceCoeff,
        totalAllowanceAmount,
        totalGrossIncome,
        insuranceSalaryBase,
        socialInsuranceEmp,
        healthInsuranceEmp,
        unemploymentInsuranceEmp,
        totalDeductions,
        netSalary,
        month,
        year,
        periodKey,
        calculatedAt,
        notes: note,
      });
    });

    return result;
  }

  /**
   * Lưu và cập nhật dữ liệu bảng lương hàng tháng vào Cơ sở dữ liệu (Firebase Firestore / Local Storage)
   * và đồng bộ lên Google Sheets theo cơ chế Upsert.
   * 
   * @param month Tháng cần lưu (ví dụ: 10)
   * @param year Năm cần lưu (ví dụ: 2026)
   * @param baseSalary Mức lương cơ sở (ví dụ: 2530000)
   * @param employees Danh sách nhân viên tính lương
   * @param customCalculatedData (Tùy chọn) Dữ liệu bảng lương đã tính sẵn để tối ưu hiệu năng
   * @param syncGoogleSheets (Tùy chọn) Có đồng bộ lên Google Sheets hay không (mặc định: true)
   */
  public static async saveAndSyncMonthlyPayroll(
    month: number,
    year: number,
    baseSalary: number,
    employees: Employee[],
    customCalculatedData?: Record<PayrollCategory, MonthlyPayrollRecord[]>,
    syncGoogleSheets: boolean = true,
    timeoutMs: number = 15000
  ): Promise<{
    success: boolean;
    message: string;
    period: string;
    isUpdate: boolean;
    record: MonthlyPayrollDatabaseRecord;
    savedPeriods: SavedPeriodRecord[];
    googleSheetsResult?: {
      spreadsheetUrl: string;
      totalSynced: number;
    };
    googleSheetsError?: string;
  }> {
    const period = `${String(month).padStart(2, '0')}/${year}`;

    // Tạo bộ hẹn giờ Timeout (mặc định 15 giây)
    let timeoutTimer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        const timeoutError = new Error('⏳ Quá thời gian kết nối (15 giây). Vui lòng kiểm tra mạng và thử lại!');
        timeoutError.name = 'TimeoutError';
        (timeoutError as any).isTimeout = true;
        reject(timeoutError);
      }, timeoutMs);
    });

    const executionPromise = (async () => {
      // 1. Tính toán bảng lương chi tiết nếu chưa truyền dữ liệu đã tính sẵn
      const payrollData = customCalculatedData || this.calculatePayroll(employees, month, year, baseSalary);

      // 2. Gộp danh sách nhân viên từ cả 5 loại hình để tạo mảng details
      const allRecords: MonthlyPayrollRecord[] = [
        ...(payrollData.CONG_CHUC || []),
        ...(payrollData.VIEN_CHUC || []),
        ...(payrollData.HOP_DONG_111 || []),
        ...(payrollData.THU_Y_PX || []),
        ...(payrollData.KHOAN_CM || []),
      ];

      const totalEmployees = allRecords.length;
      const totalAmount = allRecords.reduce((sum, r) => sum + (r.netSalary || 0), 0);

      // Chuẩn hóa mảng details theo đúng cấu trúc yêu cầu:
      // (Mã NV, Tên, Chức vụ, Hệ số, Các khoản phụ cấp, Trừ BHXH, Thực nhận)
      const details: EmployeePayrollDetail[] = allRecords.map(r => ({
        employeeCode: r.code || r.employeeId || '',
        fullName: r.fullName,
        position: r.positionTitle || r.leadershipTitle || '',
        coefficient: Number(r.coefficient) || 0,
        allowances: {
          leadership: Number(r.leadershipAllowanceAmount) || 0,
          seniorityBeyond: Number(r.beyondFrameAmount) || 0,
          responsibility: Number(r.responsibilityAllowanceAmount) || 0,
          travel: Number(r.travelAllowanceAmount) || 0,
          total: Number(r.totalAllowanceAmount) || 0,
        },
        insuranceDeduction: Number(r.totalDeductions) || 0,
        netSalary: Number(r.netSalary) || 0,
        category: r.category,
        staffType: r.staffType,
        departmentName: r.departmentName,
        jobRankCode: r.jobRankCode,
        salaryAmount: r.salaryAmount,
      }));

      // PHÂN NHÓM DỮ LIỆU: Phân loại danh sách nhân viên theo trường 'Loại nhân sự' (hoặc category)
      // bằng hàm reduce để tổ chức thành một Object chứa đúng 5 key chuẩn xác:
      // LUONG_CONG_CHUC, LUONG_VIEN_CHUC, LUONG_HD_111, LUONG_THUY_PX, LUONG_KHOAN_CM
      const groupedData = this.classifyPayrollDetails(details);

      // 3. LOGIC CẬP NHẬT (UPSERT):
      // Kiểm tra xem kỳ lương này đã tồn tại trong CSDL chưa
      const existingDbRecords = this.getDatabaseRecordsRaw();
      const existingIdx = existingDbRecords.findIndex(r => r.period === period);
      const isUpdate = existingIdx >= 0;

      const nowIso = new Date().toISOString();
      const dbRecord: MonthlyPayrollDatabaseRecord = {
        period,
        month,
        year,
        baseSalary,
        totalEmployees,
        totalAmount,
        // Cấu trúc 5 key chuẩn xác theo yêu cầu lưu trữ:
        LUONG_CONG_CHUC: groupedData.LUONG_CONG_CHUC,
        LUONG_VIEN_CHUC: groupedData.LUONG_VIEN_CHUC,
        LUONG_HD_111: groupedData.LUONG_HD_111,
        LUONG_THUY_PX: groupedData.LUONG_THUY_PX,
        LUONG_KHOAN_CM: groupedData.LUONG_KHOAN_CM,
        details,
        calculatedAt: nowIso,
        data: payrollData,
      };

      if (isUpdate) {
        // Nếu đã có: ghi đè/cập nhật dữ liệu mới
        existingDbRecords[existingIdx] = dbRecord;
      } else {
        // Nếu chưa có: tạo bản ghi mới
        existingDbRecords.push(dbRecord);
      }

      // Sắp xếp các kỳ lương theo trình tự thời gian
      existingDbRecords.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

      // Lưu trữ bền vững vào LocalStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(PAYROLL_DATABASE_KEY, JSON.stringify(existingDbRecords));
        } catch (storageErr) {
          console.warn('Lỗi lưu bản ghi CSDL vào LocalStorage:', storageErr);
        }
      }

      // Đồng bộ cập nhật bảng lịch sử SavedPeriodRecord để phục vụ các chip/nút bấm trên giao diện
      this.savePeriodPayroll(month, year, baseSalary, payrollData);

      // Lưu trữ vào Firebase Firestore nếu database instance khả dụng với cấu trúc 5 key
      if (db) {
        try {
          const docId = `payroll_${year}_${String(month).padStart(2, '0')}`;
          const docRef = doc(db, 'monthly_payrolls', docId);
          await setDoc(docRef, {
            period,
            month,
            year,
            baseSalary,
            totalEmployees,
            totalAmount,
            LUONG_CONG_CHUC: groupedData.LUONG_CONG_CHUC,
            LUONG_VIEN_CHUC: groupedData.LUONG_VIEN_CHUC,
            LUONG_HD_111: groupedData.LUONG_HD_111,
            LUONG_THUY_PX: groupedData.LUONG_THUY_PX,
            LUONG_KHOAN_CM: groupedData.LUONG_KHOAN_CM,
            details,
            updatedAt: nowIso,
          }, { merge: true });
        } catch (firestoreErr) {
          console.warn('Ghi chú lưu Firebase Firestore (tiếp tục với LocalStorage):', firestoreErr);
        }
      }

      // 4. ĐỒNG BỘ LÊN GOOGLE SHEETS
      let googleSheetsResult: { spreadsheetUrl: string; totalSynced: number } | undefined;
      let googleSheetsError: string | undefined;

      if (syncGoogleSheets) {
        try {
          const syncRes = await this.syncToGoogleSheets(month, year, baseSalary, payrollData);
          googleSheetsResult = {
            spreadsheetUrl: syncRes.spreadsheetUrl,
            totalSynced: syncRes.totalSynced,
          };
        } catch (syncErr: any) {
          // Bắt lỗi Token (Mã 401) hoặc invalid authentication credentials
          const is401 = 
            syncErr?.status === 401 ||
            syncErr?.name === 'GoogleAuthError' ||
            (typeof syncErr?.message === 'string' && (
              syncErr.message.includes('401') ||
              syncErr.message.toLowerCase().includes('invalid authentication credentials') ||
              syncErr.message.toLowerCase().includes('unauthenticated') ||
              syncErr.message.toLowerCase().includes('hết hạn')
            ));

          if (is401) {
            // Ném lỗi GoogleAuthError để UI mở hộp thoại yêu cầu cấp lại quyền
            throw new GoogleAuthError(
              syncErr.message || 'Mã lỗi 401 (Invalid authentication credentials): Phiên đăng nhập Google đã hết hạn. Vui lòng cấp lại quyền.',
              401
            );
          } else {
            console.error('Lỗi khi đồng bộ lên Google Sheets:', syncErr);
            // Ghi nhận lỗi chi tiết để hiển thị toast cho người dùng, không để thất bại ngầm
            googleSheetsError = syncErr?.message || 'Không thể đồng bộ lên Google Sheets do lỗi kết nối hoặc quyền truy cập';
          }
        }
      }

      const freshPeriods = this.getSavedPeriods(employees);

      return {
        success: true,
        message: isUpdate
          ? `Đã cập nhật kỳ lương Tháng ${period} (${totalEmployees} nhân sự, thực nhận ${totalAmount.toLocaleString('vi-VN')} đ) vào CSDL thành công!`
          : `Đã lưu mới kỳ lương Tháng ${period} (${totalEmployees} nhân sự, thực nhận ${totalAmount.toLocaleString('vi-VN')} đ) vào CSDL thành công!`,
        period,
        isUpdate,
        record: dbRecord,
        savedPeriods: freshPeriods,
        googleSheetsResult,
        googleSheetsError,
      };
    })();

    try {
      // Đua giữa tiến trình lưu/đồng bộ và bộ đếm thời gian Timeout 15s
      return await Promise.race([executionPromise, timeoutPromise]);
    } catch (err: any) {
      if (err instanceof GoogleAuthError || err?.isAuthError || err?.status === 401) {
        throw err;
      }
      if (err?.isTimeout || err?.name === 'TimeoutError' || (typeof err?.message === 'string' && err.message.includes('Quá thời gian kết nối'))) {
        console.warn(`[Timeout] Quá thời gian lưu và đồng bộ kỳ lương ${period}:`, err);
        throw err;
      }
      console.error(`Lỗi trong quá trình lưu và đồng bộ bảng lương kỳ ${period}:`, err);
      throw err;
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
    }
  }

  /**
   * Lấy danh sách các bản ghi CSDL từ LocalStorage (tự động chuẩn hóa 5 nhóm nhân sự)
   */
  public static getDatabaseRecordsRaw(): MonthlyPayrollDatabaseRecord[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const saved = localStorage.getItem(PAYROLL_DATABASE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(r => {
        const has5Groups = r.LUONG_CONG_CHUC && r.LUONG_VIEN_CHUC && r.LUONG_HD_111 && r.LUONG_THUY_PX && r.LUONG_KHOAN_CM;
        if (!has5Groups) {
          const rawDetails = r.details || [];
          const classified = this.classifyPayrollDetails(rawDetails);
          return {
            ...r,
            LUONG_CONG_CHUC: r.LUONG_CONG_CHUC || classified.LUONG_CONG_CHUC,
            LUONG_VIEN_CHUC: r.LUONG_VIEN_CHUC || classified.LUONG_VIEN_CHUC,
            LUONG_HD_111: r.LUONG_HD_111 || classified.LUONG_HD_111,
            LUONG_THUY_PX: r.LUONG_THUY_PX || classified.LUONG_THUY_PX,
            LUONG_KHOAN_CM: r.LUONG_KHOAN_CM || classified.LUONG_KHOAN_CM,
            details: rawDetails.length > 0 ? rawDetails : [
              ...(classified.LUONG_CONG_CHUC || []),
              ...(classified.LUONG_VIEN_CHUC || []),
              ...(classified.LUONG_HD_111 || []),
              ...(classified.LUONG_THUY_PX || []),
              ...(classified.LUONG_KHOAN_CM || []),
            ],
          };
        }
        return r;
      });
    } catch {
      return [];
    }
  }

  /**
   * Lấy chi tiết bản ghi CSDL theo kỳ lương (ví dụ: '10/2026')
   */
  public static getDatabaseRecord(period: string): MonthlyPayrollDatabaseRecord | undefined {
    const list = this.getDatabaseRecordsRaw();
    return list.find(r => r.period === period);
  }

  /**
   * Hàm đọc dữ liệu kỳ lương (getPayrollByPeriod) hiểu cấu trúc 5 nhóm mới
   * Đảm bảo khi đọc dữ liệu lên giao diện hoặc đẩy lên Sheets, hệ thống không bị lỗi trống dữ liệu
   */
  public static getPayrollByPeriod(
    monthOrPeriod: number | string,
    year?: number,
    fallbackEmployees?: Employee[]
  ): MonthlyPayrollDatabaseRecord | null {
    try {
      let m: number;
      let y: number;
      let periodKey: string;

      if (typeof monthOrPeriod === 'string') {
        const parts = monthOrPeriod.trim().split('/');
        if (parts.length === 2) {
          m = parseInt(parts[0], 10);
          y = parseInt(parts[1], 10);
          periodKey = `${String(m).padStart(2, '0')}/${y}`;
        } else {
          periodKey = monthOrPeriod.trim();
          const match = periodKey.match(/(\d{1,2})[\/\-_](\d{4})/);
          if (match) {
            m = parseInt(match[1], 10);
            y = parseInt(match[2], 10);
            periodKey = `${String(m).padStart(2, '0')}/${y}`;
          } else {
            m = 10;
            y = 2026;
            periodKey = '10/2026';
          }
        }
      } else {
        m = monthOrPeriod;
        y = year || 2026;
        periodKey = `${String(m).padStart(2, '0')}/${y}`;
      }

      // 1. Tìm trong cơ sở dữ liệu (PAYROLL_DATABASE_KEY)
      const dbRecord = this.getDatabaseRecord(periodKey) || 
        this.getDatabaseRecordsRaw().find(r => r.period === periodKey || (r.month === m && r.year === y));

      if (dbRecord) {
        // Đảm bảo cả 5 nhóm luôn tồn tại đầy đủ
        const has5Groups = dbRecord.LUONG_CONG_CHUC && dbRecord.LUONG_VIEN_CHUC && 
                           dbRecord.LUONG_HD_111 && dbRecord.LUONG_THUY_PX && dbRecord.LUONG_KHOAN_CM;
        if (!has5Groups) {
          const rawDetails = dbRecord.details || [];
          const classified = this.classifyPayrollDetails(rawDetails);
          dbRecord.LUONG_CONG_CHUC = dbRecord.LUONG_CONG_CHUC || classified.LUONG_CONG_CHUC;
          dbRecord.LUONG_VIEN_CHUC = dbRecord.LUONG_VIEN_CHUC || classified.LUONG_VIEN_CHUC;
          dbRecord.LUONG_HD_111 = dbRecord.LUONG_HD_111 || classified.LUONG_HD_111;
          dbRecord.LUONG_THUY_PX = dbRecord.LUONG_THUY_PX || classified.LUONG_THUY_PX;
          dbRecord.LUONG_KHOAN_CM = dbRecord.LUONG_KHOAN_CM || classified.LUONG_KHOAN_CM;
        }

        if (!dbRecord.details || dbRecord.details.length === 0) {
          dbRecord.details = [
            ...(dbRecord.LUONG_CONG_CHUC || []),
            ...(dbRecord.LUONG_VIEN_CHUC || []),
            ...(dbRecord.LUONG_HD_111 || []),
            ...(dbRecord.LUONG_THUY_PX || []),
            ...(dbRecord.LUONG_KHOAN_CM || []),
          ];
        }

        // Đảm bảo data cho giao diện có đầy đủ 5 key
        if (!dbRecord.data) {
          const emps = fallbackEmployees && fallbackEmployees.length > 0 ? fallbackEmployees : INITIAL_EMPLOYEES;
          dbRecord.data = this.calculatePayroll(emps, m, y, dbRecord.baseSalary);
        }

        return dbRecord;
      }

      // 2. Tìm trong danh sách các kỳ lưu SavedPeriodRecord
      const savedPeriods = this.getSavedPeriods(fallbackEmployees);
      const foundSaved = savedPeriods.find(p => p.periodKey === periodKey || (p.month === m && p.year === y));

      if (foundSaved && foundSaved.data) {
        const allRecs = Object.values(foundSaved.data).flat();
        const details: EmployeePayrollDetail[] = allRecs.map(r => ({
          employeeCode: r.code || r.employeeId || '',
          fullName: r.fullName,
          position: r.positionTitle || r.leadershipTitle || '',
          coefficient: Number(r.coefficient) || 0,
          allowances: {
            leadership: Number(r.leadershipAllowanceAmount) || 0,
            seniorityBeyond: Number(r.beyondFrameAmount) || 0,
            responsibility: Number(r.responsibilityAllowanceAmount) || 0,
            travel: Number(r.travelAllowanceAmount) || 0,
            total: Number(r.totalAllowanceAmount) || 0,
          },
          insuranceDeduction: Number(r.totalDeductions) || 0,
          netSalary: Number(r.netSalary) || 0,
          category: r.category,
          staffType: r.staffType,
          departmentName: r.departmentName,
          jobRankCode: r.jobRankCode,
          salaryAmount: r.salaryAmount,
        }));

        const classified = this.classifyPayrollDetails(details);
        return {
          period: periodKey,
          month: m,
          year: y,
          baseSalary: foundSaved.baseSalary,
          totalEmployees: details.length,
          totalAmount: details.reduce((sum, d) => sum + d.netSalary, 0),
          LUONG_CONG_CHUC: classified.LUONG_CONG_CHUC,
          LUONG_VIEN_CHUC: classified.LUONG_VIEN_CHUC,
          LUONG_HD_111: classified.LUONG_HD_111,
          LUONG_THUY_PX: classified.LUONG_THUY_PX,
          LUONG_KHOAN_CM: classified.LUONG_KHOAN_CM,
          details,
          calculatedAt: foundSaved.calculatedAt || new Date().toISOString(),
          data: foundSaved.data,
        };
      }

      // 3. Fallback: tính toán tự động nếu có danh sách nhân sự
      const emps = fallbackEmployees && fallbackEmployees.length > 0 ? fallbackEmployees : INITIAL_EMPLOYEES;
      if (emps && emps.length > 0) {
        const bSalary = this.getBaseSalaryForPeriod(m, y);
        const calculated = this.calculatePayroll(emps, m, y, bSalary);
        const allRecs = Object.values(calculated).flat();
        const details: EmployeePayrollDetail[] = allRecs.map(r => ({
          employeeCode: r.code || r.employeeId || '',
          fullName: r.fullName,
          position: r.positionTitle || r.leadershipTitle || '',
          coefficient: Number(r.coefficient) || 0,
          allowances: {
            leadership: Number(r.leadershipAllowanceAmount) || 0,
            seniorityBeyond: Number(r.beyondFrameAmount) || 0,
            responsibility: Number(r.responsibilityAllowanceAmount) || 0,
            travel: Number(r.travelAllowanceAmount) || 0,
            total: Number(r.totalAllowanceAmount) || 0,
          },
          insuranceDeduction: Number(r.totalDeductions) || 0,
          netSalary: Number(r.netSalary) || 0,
          category: r.category,
          staffType: r.staffType,
          departmentName: r.departmentName,
          jobRankCode: r.jobRankCode,
          salaryAmount: r.salaryAmount,
        }));
        const classified = this.classifyPayrollDetails(details);

        return {
          period: periodKey,
          month: m,
          year: y,
          baseSalary: bSalary,
          totalEmployees: details.length,
          totalAmount: details.reduce((sum, d) => sum + d.netSalary, 0),
          LUONG_CONG_CHUC: classified.LUONG_CONG_CHUC,
          LUONG_VIEN_CHUC: classified.LUONG_VIEN_CHUC,
          LUONG_HD_111: classified.LUONG_HD_111,
          LUONG_THUY_PX: classified.LUONG_THUY_PX,
          LUONG_KHOAN_CM: classified.LUONG_KHOAN_CM,
          details,
          calculatedAt: new Date().toISOString(),
          data: calculated,
        };
      }

      return null;
    } catch (err) {
      console.error('Lỗi khi đọc bảng lương theo kỳ (getPayrollByPeriod):', err);
      return null;
    }
  }

  /**
   * Kiểm tra xem kỳ lương (Tháng/Năm) đã tồn tại trong hệ thống (CSDL LocalStorage / Firestore) hay chưa
   */
  public static isPeriodExisting(month: number, year: number): boolean {
    const period = `${String(month).padStart(2, '0')}/${year}`;
    // 1. Kiểm tra trong danh sách bản ghi CSDL
    const dbRecords = this.getDatabaseRecordsRaw();
    if (dbRecords.some(r => r.period === period || (r.month === month && r.year === year))) {
      return true;
    }
    // 2. Kiểm tra trong danh sách các kỳ lương đã lưu trữ
    const savedPeriods = this.getSavedPeriodsRaw();
    return savedPeriods.some(p => p.periodKey === period || (p.month === month && p.year === year));
  }

  /**
   * Lưu trữ lịch sử bảng lương của một kỳ tính lương vào bộ nhớ lâu dài (LocalStorage)
   */
  public static savePeriodPayroll(
    month: number,
    year: number,
    baseSalary: number,
    data: Record<PayrollCategory, MonthlyPayrollRecord[]>
  ): void {
    const periodKey = `${String(month).padStart(2, '0')}/${year}`;
    const all = this.getSavedPeriodsRaw();

    const existingIdx = all.findIndex(p => p.periodKey === periodKey);
    const newRecord: SavedPeriodRecord = {
      periodKey,
      month,
      year,
      baseSalary,
      calculatedAt: new Date().toISOString(),
      data,
    };

    if (existingIdx >= 0) {
      all[existingIdx] = newRecord;
    } else {
      all.push(newRecord);
    }

    // Sắp xếp theo thứ tự thời gian tăng dần
    all.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    try {
      localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Lỗi lưu lịch sử bảng lương vào localStorage:', e);
    }
  }

  private static getSavedPeriodsRaw(): SavedPeriodRecord[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const saved = localStorage.getItem(PAYROLL_HISTORY_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Lấy toàn bộ các kỳ lương đã lưu trữ thực tế từ localStorage (nếu chưa có thì tự động khởi tạo kỳ chuẩn T9 và T10)
   */
  public static getSavedPeriods(fallbackEmployees?: Employee[]): SavedPeriodRecord[] {
    const raw = this.getSavedPeriodsRaw();
    const emps = fallbackEmployees && fallbackEmployees.length > 0 ? fallbackEmployees : INITIAL_EMPLOYEES;
    const expectedCongChucCount = emps.filter(e => this.getPayrollCategory(e) === 'CONG_CHUC').length;

    // Danh sách các kỳ chuẩn cần đảm bảo luôn có trong CSDL: 06/2026, 07/2026, 08/2026, 09/2026, 10/2026
    const standardPeriods = [
      { month: 6, year: 2026, baseSalary: 2340000 },
      { month: 7, year: 2026, baseSalary: 2340000 },
      { month: 8, year: 2026, baseSalary: 2340000 },
      { month: 9, year: 2026, baseSalary: 2340000 },
      { month: 10, year: 2026, baseSalary: 2530000 },
    ];

    if (raw.length > 0) {
      let needsRefresh = false;
      // 1. Kiểm tra và bổ sung các kỳ còn thiếu từ 06/2026 đến 10/2026
      standardPeriods.forEach(sp => {
        const pKey = `${String(sp.month).padStart(2, '0')}/${sp.year}`;
        const existingIdx = raw.findIndex(p => p.periodKey === pKey);
        if (existingIdx === -1) {
          if (emps && emps.length > 0) {
            const calculated = this.calculatePayroll(emps, sp.month, sp.year, sp.baseSalary);
            raw.push({
              periodKey: pKey,
              month: sp.month,
              year: sp.year,
              baseSalary: sp.baseSalary,
              calculatedAt: new Date().toISOString(),
              data: calculated,
            });
            needsRefresh = true;
          }
        } else {
          // Nếu kỳ đã có nhưng thiếu tab hoặc KHOAN_CM rỗng mà danh sách có cán bộ khoán
          const p = raw[existingIdx];
          const hasKhoanCM = (p.data?.KHOAN_CM?.length || 0) > 0;
          const empsHasKhoan = emps.some(e => this.getPayrollCategory(e) === 'KHOAN_CM');
          const isCongChucLow = (p.data?.CONG_CHUC?.length || 0) < Math.min(20, expectedCongChucCount);
          if ((!hasKhoanCM && empsHasKhoan) || isCongChucLow || !p.data) {
            p.data = this.calculatePayroll(emps, p.month, p.year, p.baseSalary);
            needsRefresh = true;
          }
        }
      });

      // Sắp xếp các kỳ theo thứ tự thời gian tăng dần
      raw.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

      if (needsRefresh) {
        try {
          localStorage.setItem(PAYROLL_HISTORY_KEY, JSON.stringify(raw));
          // Đồng bộ luôn vào PAYROLL_DATABASE_KEY để cơ sở dữ liệu có sẵn dữ liệu chuẩn
          this.syncSavedPeriodsToDatabaseRecords(raw);
        } catch {}
      }

      return raw;
    }

    // Tự động khởi tạo đầy đủ các kỳ chuẩn 06/2026; 07/2026; 08/2026; 09/2026; 10/2026 nếu hệ thống chưa có dữ liệu
    if (emps && emps.length > 0) {
      const initialPeriods: SavedPeriodRecord[] = [];
      standardPeriods.forEach(sp => {
        const calculated = this.calculatePayroll(emps, sp.month, sp.year, sp.baseSalary);
        const pKey = `${String(sp.month).padStart(2, '0')}/${sp.year}`;
        const rec: SavedPeriodRecord = {
          periodKey: pKey,
          month: sp.month,
          year: sp.year,
          baseSalary: sp.baseSalary,
          calculatedAt: new Date().toISOString(),
          data: calculated,
        };
        this.savePeriodPayroll(sp.month, sp.year, sp.baseSalary, calculated);
        initialPeriods.push(rec);
      });
      this.syncSavedPeriodsToDatabaseRecords(initialPeriods);
      return this.getSavedPeriodsRaw();
    }

    return [];
  }

  /**
   * Xóa toàn bộ lịch sử kỳ lương đã lưu
   */
  public static clearSavedPeriods(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(PAYROLL_HISTORY_KEY);
    }
  }

  /**
   * Đồng bộ các kỳ lương SavedPeriodRecord sang danh sách MonthlyPayrollDatabaseRecord (5 nhóm riêng biệt)
   */
  public static syncSavedPeriodsToDatabaseRecords(periods: SavedPeriodRecord[]): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const dbList = this.getDatabaseRecordsRaw();
      let changed = false;

      (periods || []).forEach(p => {
        if (!p.data) return;
        const pKey = p.periodKey;
        const existingIdx = dbList.findIndex(d => d.period === pKey);

        const allRecs: MonthlyPayrollRecord[] = [
          ...(p.data.CONG_CHUC || []),
          ...(p.data.VIEN_CHUC || []),
          ...(p.data.HOP_DONG_111 || []),
          ...(p.data.THU_Y_PX || []),
          ...(p.data.KHOAN_CM || []),
        ];

        const details: EmployeePayrollDetail[] = allRecs.map(r => ({
          employeeCode: r.code || r.employeeId || '',
          fullName: r.fullName,
          position: r.positionTitle || r.leadershipTitle || '',
          coefficient: Number(r.coefficient) || 0,
          allowances: {
            leadership: Number(r.leadershipAllowanceAmount) || 0,
            seniorityBeyond: Number(r.beyondFrameAmount) || 0,
            responsibility: Number(r.responsibilityAllowanceAmount) || 0,
            travel: Number(r.travelAllowanceAmount) || 0,
            total: Number(r.totalAllowanceAmount) || 0,
          },
          insuranceDeduction: Number(r.totalDeductions) || 0,
          netSalary: Number(r.netSalary) || 0,
          category: r.category,
          staffType: r.staffType,
          departmentName: r.departmentName,
          jobRankCode: r.jobRankCode,
          salaryAmount: r.salaryAmount,
        }));

        const classified = this.classifyPayrollDetails(details);

        const newDbRecord: MonthlyPayrollDatabaseRecord = {
          period: pKey,
          month: p.month,
          year: p.year,
          baseSalary: p.baseSalary,
          totalEmployees: details.length,
          totalAmount: details.reduce((sum, d) => sum + d.netSalary, 0),
          LUONG_CONG_CHUC: classified.LUONG_CONG_CHUC,
          LUONG_VIEN_CHUC: classified.LUONG_VIEN_CHUC,
          LUONG_HD_111: classified.LUONG_HD_111,
          LUONG_THUY_PX: classified.LUONG_THUY_PX,
          LUONG_KHOAN_CM: classified.LUONG_KHOAN_CM,
          details,
          calculatedAt: p.calculatedAt || new Date().toISOString(),
          data: p.data,
        };

        if (existingIdx >= 0) {
          // Cập nhật nếu thiếu nhóm KHOAN_CM hoặc số lượng chưa khớp
          const existing = dbList[existingIdx];
          if ((!existing.LUONG_KHOAN_CM || existing.LUONG_KHOAN_CM.length === 0) && classified.LUONG_KHOAN_CM.length > 0) {
            dbList[existingIdx] = newDbRecord;
            changed = true;
          }
        } else {
          dbList.push(newDbRecord);
          changed = true;
        }
      });

      if (changed) {
        dbList.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
        localStorage.setItem(PAYROLL_DATABASE_KEY, JSON.stringify(dbList));
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ SavedPeriods sang DatabaseRecords:', e);
    }
  }

  /**
   * Truy vấn Lũy kế thu nhập & Quá trình biến động lương của cá nhân hoặc toàn đơn vị từ tháng ... đến tháng ...
   */
  public static queryCumulativeAndFluctuation(options: {
    fromMonth: number;
    fromYear: number;
    toMonth: number;
    toYear: number;
    employeeCode?: string;
    category?: PayrollCategory | 'ALL';
    employees?: Employee[];
  }): EmployeeCumulativeIncomeReport[] {
    const { fromMonth, fromYear, toMonth, toYear, employeeCode, category = 'ALL', employees = [] } = options;
    const rawFromVal = fromYear * 12 + fromMonth;
    const rawToVal = toYear * 12 + toMonth;

    // Tự động chuẩn hóa cận thời gian [min, max] nếu người dùng chọn Từ tháng > Đến tháng
    const fromVal = Math.min(rawFromVal, rawToVal);
    const toVal = Math.max(rawFromVal, rawToVal);

    const actualFromMonth = ((fromVal - 1) % 12) + 1;
    const actualFromYear = Math.floor((fromVal - 1) / 12);
    const actualToMonth = ((toVal - 1) % 12) + 1;
    const actualToYear = Math.floor((toVal - 1) / 12);

    let allPeriods = this.getSavedPeriodsRaw();

    // Lọc các kỳ lương thực tế đã được lưu nằm trong khoảng [fromVal, toVal]
    let validPeriods = allPeriods.filter(p => {
      const v = p.year * 12 + p.month;
      return v >= fromVal && v <= toVal;
    });

    // Nếu khoảng thời gian được chọn chưa có dữ liệu lưu trữ hoặc thiếu tháng, tự động tính toán bổ sung
    const existingMonthKeys = new Set(validPeriods.map(p => p.year * 12 + p.month));
    const effectiveEmployees = employees && employees.length > 0 ? employees : INITIAL_EMPLOYEES;

    for (let v = fromVal; v <= toVal; v++) {
      if (!existingMonthKeys.has(v)) {
        const m = ((v - 1) % 12) + 1;
        const y = Math.floor((v - 1) / 12);
        const dynamicBaseSalary = this.getBaseSalaryForPeriod(m, y);
        const dynamicData = this.calculatePayroll(effectiveEmployees, m, y, dynamicBaseSalary);
        validPeriods.push({
          periodKey: `${String(m).padStart(2, '0')}/${y}`,
          month: m,
          year: y,
          baseSalary: dynamicBaseSalary,
          calculatedAt: new Date().toISOString(),
          data: dynamicData,
        });
      }
    }

    validPeriods.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    // Nhóm tất cả các bản ghi theo từng nhân sự
    const empMap = new Map<string, MonthlyPayrollRecord[]>();

    validPeriods.forEach(period => {
      const cats: PayrollCategory[] = category === 'ALL' 
        ? ['CONG_CHUC', 'VIEN_CHUC', 'HOP_DONG_111', 'THU_Y_PX', 'KHOAN_CM'] 
        : [category];

      cats.forEach(c => {
        const records = (period.data && period.data[c]) ? period.data[c] : [];
        records.forEach(r => {
          if (employeeCode && r.code !== employeeCode) return;
          const currentList = empMap.get(r.code) || [];
          currentList.push(r);
          empMap.set(r.code, currentList);
        });
      });
    });

    const reports: EmployeeCumulativeIncomeReport[] = [];
    const fromStr = `Tháng ${actualFromMonth}/${actualFromYear}`;
    const toStr = `Tháng ${actualToMonth}/${actualToYear}`;

    empMap.forEach((records, code) => {
      if (records.length === 0) return;
      // Sắp xếp các tháng theo thứ tự thời gian
      records.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
      const first = records[0];

      // Xây dựng biến động qua từng tháng
      const fluctuations: EmployeeIncomeFluctuation[] = [];
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const prev = i > 0 ? records[i - 1] : null;

        const baseSalaryChange = prev ? (r.baseSalary - prev.baseSalary) : 0;
        const coeffChange = prev ? Number((r.coefficient - prev.coefficient).toFixed(2)) : 0;
        const netSalaryChange = prev ? (r.netSalary - prev.netSalary) : 0;

        let changeDescription = 'Ổn định thu nhập';
        if (coeffChange !== 0 && baseSalaryChange !== 0) {
          changeDescription = `Nâng bậc (${coeffChange > 0 ? '+' : ''}${coeffChange} HSL) & Đổi MLCS (${baseSalaryChange > 0 ? '+' : ''}${baseSalaryChange.toLocaleString('vi-VN')} đ)`;
        } else if (coeffChange !== 0) {
          changeDescription = `Điều chỉnh bậc lương (${coeffChange > 0 ? '+' : ''}${coeffChange} HSL)`;
        } else if (baseSalaryChange !== 0) {
          changeDescription = `Điều chỉnh lương cơ sở (${prev!.baseSalary.toLocaleString('vi-VN')} ➔ ${r.baseSalary.toLocaleString('vi-VN')} đ)`;
        } else if (netSalaryChange !== 0) {
          changeDescription = `Biến động phụ cấp/trích nộp (${netSalaryChange > 0 ? '+' : ''}${netSalaryChange.toLocaleString('vi-VN')} đ)`;
        }

        fluctuations.push({
          periodKey: r.periodKey,
          month: r.month,
          year: r.year,
          baseSalary: r.baseSalary,
          baseSalaryChange,
          coefficient: r.coefficient,
          salaryAmount: r.salaryAmount,
          leadershipAllowanceCoeff: r.leadershipAllowanceCoeff,
          leadershipAllowanceAmount: r.leadershipAllowanceAmount,
          beyondFramePercent: r.beyondFramePercent,
          beyondFrameAmount: r.beyondFrameAmount,
          responsibilityAllowanceAmount: r.responsibilityAllowanceAmount,
          industryAllowancePercent: r.industryAllowancePercent,
          industryAllowanceAmount: r.industryAllowanceAmount,
          publicServiceAllowanceAmount: r.publicServiceAllowanceAmount,
          travelAllowanceAmount: r.travelAllowanceAmount,
          totalAllowanceAmount: r.totalAllowanceAmount,
          totalGrossIncome: r.totalGrossIncome,
          totalDeductions: r.totalDeductions,
          netSalary: r.netSalary,
          coefficientChange: coeffChange,
          netSalaryChange,
          changeDescription,
        });
      }

      const monthCount = records.length;
      const totalSalaryAmount = records.reduce((s, r) => s + r.salaryAmount, 0);
      const totalBeyondFrameAmount = records.reduce((s, r) => s + r.beyondFrameAmount, 0);
      const totalLeadershipAllowanceAmount = records.reduce((s, r) => s + r.leadershipAllowanceAmount, 0);
      const totalResponsibilityAllowanceAmount = records.reduce((s, r) => s + r.responsibilityAllowanceAmount, 0);
      const totalIndustryAllowanceAmount = records.reduce((s, r) => s + r.industryAllowanceAmount, 0);
      const totalTravelAllowanceAmount = records.reduce((s, r) => s + r.travelAllowanceAmount, 0);
      const totalPublicServiceAllowanceAmount = records.reduce((s, r) => s + r.publicServiceAllowanceAmount, 0);
      const totalAllowanceAmount = records.reduce((s, r) => s + r.totalAllowanceAmount, 0);
      const totalGrossIncome = records.reduce((s, r) => s + r.totalGrossIncome, 0);

      const totalSocialInsurance = records.reduce((s, r) => s + r.socialInsuranceEmp, 0);
      const totalHealthInsurance = records.reduce((s, r) => s + r.healthInsuranceEmp, 0);
      const totalUnemploymentInsurance = records.reduce((s, r) => s + r.unemploymentInsuranceEmp, 0);
      const totalDeductions = records.reduce((s, r) => s + r.totalDeductions, 0);
      const totalNetSalary = records.reduce((s, r) => s + r.netSalary, 0);
      const averageMonthlyNetSalary = monthCount > 0 ? Math.round(totalNetSalary / monthCount) : 0;

      reports.push({
        employeeId: first.employeeId,
        code,
        fullName: first.fullName,
        departmentName: first.departmentName,
        positionTitle: first.positionTitle,
        jobRankCode: first.jobRankCode,
        jobRankName: first.jobRankName,
        category: first.category,
        fromPeriod: fromStr,
        toPeriod: toStr,
        monthCount,
        totalSalaryAmount,
        totalBeyondFrameAmount,
        totalLeadershipAllowanceAmount,
        totalResponsibilityAllowanceAmount,
        totalIndustryAllowanceAmount,
        totalTravelAllowanceAmount,
        totalPublicServiceAllowanceAmount,
        totalAllowanceAmount,
        totalGrossIncome,
        totalSocialInsurance,
        totalHealthInsurance,
        totalUnemploymentInsurance,
        totalDeductions,
        totalNetSalary,
        averageMonthlyNetSalary,
        monthlyFluctuations: fluctuations,
      });
    });

    return reports;
  }

  /**
   * Tính số liệu tổng hợp cho từng danh mục bảng lương
   */
  public static getSummaries(payrollData: Record<PayrollCategory, MonthlyPayrollRecord[]>): CategorySummary[] {
    const categories: PayrollCategory[] = ['CONG_CHUC', 'VIEN_CHUC', 'HOP_DONG_111', 'THU_Y_PX', 'KHOAN_CM'];
    return categories.map(cat => {
      const records = payrollData[cat] || [];
      const meta = PAYROLL_CATEGORY_META[cat];
      return {
        category: cat,
        title: meta.title,
        shortTitle: meta.shortTitle,
        count: records.length,
        totalSalaryAmount: records.reduce((s, r) => s + r.salaryAmount, 0),
        totalAllowanceAmount: records.reduce((s, r) => s + r.totalAllowanceAmount, 0),
        totalGrossIncome: records.reduce((s, r) => s + r.totalGrossIncome, 0),
        totalDeductions: records.reduce((s, r) => s + r.totalDeductions, 0),
        totalNetSalary: records.reduce((s, r) => s + r.netSalary, 0),
      };
    });
  }

  /**
   * Tạo tiêu đề cột chuẩn theo đúng yêu cầu người dùng
   */
  public static getTableHeaders(): string[] {
    return [
      'STT',
      'Kỳ Lương',
      'Mức Lương Cơ Sở (VNĐ)',
      'Mã Nhân Viên',
      'Họ và Tên',
      'Phòng Ban / Đơn Vị',
      'Chức Danh, Vị Trí',
      'Chức Vụ Lãnh Đạo',
      'Ngạch Lương',
      'Hệ Số Lương (HSL)',
      'Thành Tiền Lương HSL (VNĐ)',
      'Tỷ Lệ TNVK (%)',
      'Thành Tiền TNVK (VNĐ)',
      'Hệ Số Chức Vụ (PCCV)',
      'Thành Tiền HSCV (VNĐ)',
      'Hệ Số PC Trách Nhiệm',
      'Thành Tiền PC Trách Nhiệm (VNĐ)',
      'Phụ Cấp Ưu Đãi Ngành (%)',
      'Thành Tiền UDN (VNĐ)',
      'Phụ Cấp Công Tác Phí (VNĐ)',
      'Phụ Cấp Công Vụ (%)',
      'Thành Tiền PCCV (VNĐ)',
      'Tổng HS Phụ Cấp',
      'Tổng Tiền Phụ Cấp (VNĐ)',
      'Tổng Thu Nhập Trước Trích (VNĐ)',
      'BHXH Trừ Lương (8%)',
      'BHYT Trừ Lương (1.5%)',
      'BHTN Trừ Lương (1%)',
      'Tổng Các Khoản Trích Nộp (VNĐ)',
      'Tổng Lương Thực Nhận (VNĐ)',
      'Ghi Chú & Biến Động Lương',
    ];
  }

  /**
   * Biến đổi 1 bản ghi bảng lương thành mảng giá trị theo thứ tự cột
   */
  public static recordToRow(r: MonthlyPayrollRecord, index: number): (string | number)[] {
    return [
      index + 1,
      r.periodKey,
      r.baseSalary,
      r.code,
      r.fullName,
      r.departmentName,
      r.positionTitle,
      r.leadershipTitle || '-',
      `${r.jobRankCode} - ${r.jobRankName}`,
      r.coefficient,
      r.salaryAmount,
      r.beyondFramePercent > 0 ? `${r.beyondFramePercent}%` : 0,
      r.beyondFrameAmount,
      r.leadershipAllowanceCoeff,
      r.leadershipAllowanceAmount,
      r.responsibilityAllowanceCoeff,
      r.responsibilityAllowanceAmount,
      `${r.industryAllowancePercent}%`,
      r.industryAllowanceAmount,
      r.travelAllowanceAmount,
      r.publicServiceAllowancePercent > 0 ? `${r.publicServiceAllowancePercent}%` : 0,
      r.publicServiceAllowanceAmount,
      Number(r.totalAllowanceCoeff.toFixed(2)),
      r.totalAllowanceAmount,
      r.totalGrossIncome,
      r.socialInsuranceEmp,
      r.healthInsuranceEmp,
      r.unemploymentInsuranceEmp,
      r.totalDeductions,
      r.netSalary,
      r.notes || '',
    ];
  }

  /**
   * Xuất toàn bộ 4 bảng lương ra file Excel (.xlsx) với 4 Sheet riêng biệt
   */
  public static exportToExcel(
    month: number,
    year: number,
    baseSalary: number,
    payrollData: Record<PayrollCategory, MonthlyPayrollRecord[]>
  ): void {
    const wb = XLSX.utils.book_new();
    const categories: PayrollCategory[] = ['CONG_CHUC', 'VIEN_CHUC', 'HOP_DONG_111', 'THU_Y_PX', 'KHOAN_CM'];
    const headers = this.getTableHeaders();

    categories.forEach(cat => {
      const records = payrollData[cat] || [];
      const meta = PAYROLL_CATEGORY_META[cat];
      const sheetRows: (string | number)[][] = [];

      sheetRows.push(['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH']);
      sheetRows.push([meta.title.toUpperCase()]);
      sheetRows.push([`Kỳ tính lương: Tháng ${month} năm ${year} | Mức lương cơ sở: ${baseSalary.toLocaleString('vi-VN')} đ/tháng`]);
      sheetRows.push([]);
      sheetRows.push(headers);

      records.forEach((r, idx) => {
        sheetRows.push(this.recordToRow(r, idx));
      });

      if (records.length > 0) {
        sheetRows.push([
          'TỔNG CỘNG',
          '',
          '',
          `${records.length} nhân sự`,
          '',
          '',
          '',
          '',
          Number(records.reduce((s, r) => s + r.coefficient, 0).toFixed(2)),
          records.reduce((s, r) => s + r.salaryAmount, 0),
          '',
          records.reduce((s, r) => s + r.beyondFrameAmount, 0),
          Number(records.reduce((s, r) => s + r.leadershipAllowanceCoeff, 0).toFixed(2)),
          records.reduce((s, r) => s + r.leadershipAllowanceAmount, 0),
          Number(records.reduce((s, r) => s + r.responsibilityAllowanceCoeff, 0).toFixed(2)),
          records.reduce((s, r) => s + r.responsibilityAllowanceAmount, 0),
          '',
          records.reduce((s, r) => s + r.industryAllowanceAmount, 0),
          records.reduce((s, r) => s + r.travelAllowanceAmount, 0),
          '',
          records.reduce((s, r) => s + r.publicServiceAllowanceAmount, 0),
          Number(records.reduce((s, r) => s + r.totalAllowanceCoeff, 0).toFixed(2)),
          records.reduce((s, r) => s + r.totalAllowanceAmount, 0),
          records.reduce((s, r) => s + r.totalGrossIncome, 0),
          records.reduce((s, r) => s + r.socialInsuranceEmp, 0),
          records.reduce((s, r) => s + r.healthInsuranceEmp, 0),
          records.reduce((s, r) => s + r.unemploymentInsuranceEmp, 0),
          records.reduce((s, r) => s + r.totalDeductions, 0),
          records.reduce((s, r) => s + r.netSalary, 0),
          '',
        ]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, meta.sheetName);
    });

    const fileName = `Bang_Luong_Thang_${String(month).padStart(2, '0')}_${year}_ChiCucThuY.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * Xuất báo cáo Lũy kế thu nhập & Biến động lương cá nhân ra Excel
   */
  public static exportCumulativeReportToExcel(
    reports: EmployeeCumulativeIncomeReport[],
    fromPeriod: string,
    toPeriod: string
  ): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Tổng hợp lũy kế
    const summaryRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG TỔNG HỢP LŨY KẾ THU NHẬP VÀ TRÍCH NỘP BẢO HIỂM`],
      [`Thời gian: Từ ${fromPeriod} đến ${toPeriod} | Tổng số cán bộ: ${reports.length}`],
      [],
      [
        'STT',
        'Mã Nhân Viên',
        'Họ và Tên',
        'Phòng Ban / Đơn Vị',
        'Chức Danh, Vị Trí',
        'Phân Loại',
        'Số Tháng Tính',
        'Tổng Lương HSL (VNĐ)',
        'Tổng Phụ Cấp (VNĐ)',
        'Tổng Thu Nhập Lũy Kế (VNĐ)',
        'Tổng BHXH (8%)',
        'Tổng BHYT (1.5%)',
        'Tổng BHTN (1%)',
        'Tổng Trích Nộp BH (VNĐ)',
        'Tổng Lương Thực Nhận Lũy Kế (VNĐ)',
        'Trung Bình Thu Nhập/Tháng (VNĐ)',
      ],
    ];

    reports.forEach((r, idx) => {
      summaryRows.push([
        idx + 1,
        r.code,
        r.fullName,
        r.departmentName,
        r.positionTitle,
        r.category,
        r.monthCount,
        r.totalSalaryAmount,
        r.totalAllowanceAmount,
        r.totalGrossIncome,
        r.totalSocialInsurance,
        r.totalHealthInsurance,
        r.totalUnemploymentInsurance,
        r.totalDeductions,
        r.totalNetSalary,
        r.averageMonthlyNetSalary,
      ]);
    });

    // Tổng cộng
    if (reports.length > 0) {
      summaryRows.push([
        'TỔNG CỘNG',
        '',
        `${reports.length} cán bộ`,
        '',
        '',
        '',
        '',
        reports.reduce((s, r) => s + r.totalSalaryAmount, 0),
        reports.reduce((s, r) => s + r.totalAllowanceAmount, 0),
        reports.reduce((s, r) => s + r.totalGrossIncome, 0),
        reports.reduce((s, r) => s + r.totalSocialInsurance, 0),
        reports.reduce((s, r) => s + r.totalHealthInsurance, 0),
        reports.reduce((s, r) => s + r.totalUnemploymentInsurance, 0),
        reports.reduce((s, r) => s + r.totalDeductions, 0),
        reports.reduce((s, r) => s + r.totalNetSalary, 0),
        Math.round(reports.reduce((s, r) => s + r.totalNetSalary, 0) / Math.max(1, reports.length)),
      ]);
    }

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHop_LuyKe');

    // Sheet 2: Chi tiết biến động từng tháng
    const fluctuationRows: (string | number)[][] = [
      ['CHI TIẾT DIỄN BIẾN LƯƠNG VÀ THU NHẬP QUA TỪNG THÁNG'],
      [`Từ ${fromPeriod} đến ${toPeriod}`],
      [],
      [
        'STT',
        'Mã Nhân Viên',
        'Họ và Tên',
        'Đơn Vị',
        'Kỳ Lương (Tháng/Năm)',
        'Hệ Số Lương (HSL)',
        'Biến Động HSL',
        'Lương HSL (VNĐ)',
        'HSCV (PCCV)',
        'Phụ Cấp Chức Vụ',
        'Thâm Niên VK',
        'Phụ Cấp Trách Nhiệm',
        'Ưu Đãi Ngành',
        'Công Vụ (25%)',
        'Tổng Phụ Cấp',
        'Tổng Thu Nhập',
        'Tổng Trích BH (10.5%)',
        'Thực Nhận (VNĐ)',
        'Biến Động Thực Nhận So Với Tháng Trước',
      ],
    ];

    let rowIdx = 1;
    reports.forEach(r => {
      r.monthlyFluctuations.forEach(f => {
        fluctuationRows.push([
          rowIdx++,
          r.code,
          r.fullName,
          r.departmentName,
          f.periodKey,
          f.coefficient,
          f.coefficientChange ? (f.coefficientChange > 0 ? `+${f.coefficientChange}` : f.coefficientChange) : 0,
          f.salaryAmount,
          f.leadershipAllowanceCoeff,
          f.leadershipAllowanceAmount,
          f.beyondFrameAmount,
          f.responsibilityAllowanceAmount,
          f.industryAllowanceAmount,
          f.publicServiceAllowanceAmount,
          f.totalAllowanceAmount,
          f.totalGrossIncome,
          f.totalDeductions,
          f.netSalary,
          f.netSalaryChange ? (f.netSalaryChange > 0 ? `+${f.netSalaryChange.toLocaleString('vi-VN')} đ` : `${f.netSalaryChange.toLocaleString('vi-VN')} đ`) : 0,
        ]);
      });
    });

    const wsFluctuation = XLSX.utils.aoa_to_sheet(fluctuationRows);
    XLSX.utils.book_append_sheet(wb, wsFluctuation, 'ChiTiet_BienDong_TungThang');

    const cleanFrom = fromPeriod.replace(/[^0-9]/g, '_');
    const cleanTo = toPeriod.replace(/[^0-9]/g, '_');
    XLSX.writeFile(wb, `BaoCao_LuyKe_BienDongLuong_${cleanFrom}_den_${cleanTo}.xlsx`);
  }

  /**
   * Xuất file Excel báo cáo thống kê thu nhập chi tiết của MỘT CÁ NHÂN từ tháng/năm này đến tháng/năm khác
   */
  public static exportIndividualIncomeReportToExcel(
    report: EmployeeCumulativeIncomeReport,
    fromPeriod: string,
    toPeriod: string
  ): void {
    const wb = XLSX.utils.book_new();

    const rows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['BẢNG TỔNG HỢP & THỐNG KÊ THU NHẬP CÁ NHÂN QUA CÁC KỲ TÍNH LƯƠNG'],
      [`Giai đoạn: Từ ${fromPeriod} đến ${toPeriod} (${report.monthCount} tháng tính lương)`],
      [],
      ['Họ và tên:', report.fullName, '', 'Mã nhân viên:', report.code],
      ['Đơn vị công tác:', report.departmentName, '', 'Chức danh / Vị trí:', report.positionTitle],
      ['Ngạch lương:', report.jobRankCode, '', 'Phân loại nhân sự:', PAYROLL_CATEGORY_META[report.category]?.title || report.category],
      [],
      ['TỔNG HỢP THU NHẬP LŨY KẾ TRONG GIAI ĐOẠN', '', ''],
      ['Tổng Lương Hệ Số (HSL):', report.totalSalaryAmount, 'VNĐ'],
      ['Tổng Các Khoản Phụ Cấp (PCCV, TNVK, UDN, PCCVụ...):', report.totalAllowanceAmount, 'VNĐ'],
      ['Tổng Thu Nhập Gross:', report.totalGrossIncome, 'VNĐ'],
      ['Tổng Trích Nộp BHXH (8%):', report.totalSocialInsurance, 'VNĐ'],
      ['Tổng Trích Nộp BHYT (1.5%):', report.totalHealthInsurance, 'VNĐ'],
      ['Tổng Trích Nộp BHTN (1%):', report.totalUnemploymentInsurance, 'VNĐ'],
      ['Tổng Các Khoản Trích Nộp Bảo Hiểm:', report.totalDeductions, 'VNĐ'],
      ['TỔNG THỰC LĨNH LŨY KẾ:', report.totalNetSalary, 'VNĐ'],
      ['Thu Nhập Thực Lĩnh Bình Quân / Tháng:', report.averageMonthlyNetSalary, 'VNĐ/tháng'],
      [],
      ['CHI TIẾT DIỄN BIẾN THU NHẬP QUA TỪNG THÁNG'],
      [
        'STT',
        'Kỳ Tháng',
        'Mức Lương Cơ Sở',
        'Hệ Số Lương (HSL)',
        'Biến Động HSL',
        'Lương HSL (VNĐ)',
        'HSCV (PCCV)',
        'Tiền PCCV',
        'Thâm Niên VK %',
        'Tiền TNVK',
        'Phụ Cấp Trách Nhiệm',
        'Ưu Đãi Ngành %',
        'Tiền UDN',
        'Công Vụ (25%)',
        'Tổng Phụ Cấp',
        'Tổng Thu Nhập Gross',
        'BHXH (8%)',
        'BHYT (1.5%)',
        'BHTN (1%)',
        'Tổng Trích Nộp',
        'LƯƠNG THỰC NHẬN (VNĐ)',
        'Biến Động Thực Nhận',
        'Căn Cứ / Diễn Giải Thay Đổi',
      ],
    ];

    report.monthlyFluctuations.forEach((f, idx) => {
      const insBase = f.salaryAmount + f.leadershipAllowanceAmount + f.beyondFrameAmount + f.responsibilityAllowanceAmount;
      const isCongChuc = report.category === 'CONG_CHUC';
      rows.push([
        idx + 1,
        f.periodKey,
        f.baseSalary,
        f.coefficient,
        f.coefficientChange ? (f.coefficientChange > 0 ? `+${f.coefficientChange}` : f.coefficientChange) : 0,
        f.salaryAmount,
        f.leadershipAllowanceCoeff,
        f.leadershipAllowanceAmount,
        f.beyondFramePercent > 0 ? `${f.beyondFramePercent}%` : '0%',
        f.beyondFrameAmount,
        f.responsibilityAllowanceAmount,
        (f.industryAllowancePercent || 0) > 0 ? `${f.industryAllowancePercent}%` : '10%',
        f.industryAllowanceAmount,
        f.publicServiceAllowanceAmount,
        f.totalAllowanceAmount,
        f.totalGrossIncome,
        Math.round(insBase * 0.08),
        Math.round(insBase * 0.015),
        isCongChuc ? 0 : Math.round(insBase * 0.01),
        f.totalDeductions,
        f.netSalary,
        f.netSalaryChange ? (f.netSalaryChange > 0 ? `+${f.netSalaryChange.toLocaleString('vi-VN')} đ` : `${f.netSalaryChange.toLocaleString('vi-VN')} đ`) : '0 đ',
        f.changeDescription || 'Ổn định',
      ]);
    });

    // Dòng tổng kết
    rows.push([
      'TỔNG CỘNG',
      `${report.monthCount} tháng`,
      '-',
      '-',
      '-',
      report.totalSalaryAmount,
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      '-',
      report.totalAllowanceAmount,
      report.totalGrossIncome,
      report.totalSocialInsurance,
      report.totalHealthInsurance,
      report.totalUnemploymentInsurance,
      report.totalDeductions,
      report.totalNetSalary,
      '-',
      `Bình quân: ${report.averageMonthlyNetSalary.toLocaleString('vi-VN')} đ/tháng`,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'BangKe_ThuNhap_CaNhan');

    const cleanFrom = fromPeriod.replace(/[^0-9]/g, '_');
    const cleanTo = toPeriod.replace(/[^0-9]/g, '_');
    const safeName = report.fullName.replace(/[^a-zA-Z0-9_]/g, '_');
    XLSX.writeFile(wb, `BaoCao_ThuNhap_CaNhan_${report.code}_${safeName}_${cleanFrom}_den_${cleanTo}.xlsx`);
  }

  /**
   * Lấy URL Google Apps Script Webhook nếu người dùng đã thiết lập
   */
  public static getAppsScriptUrl(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return localStorage.getItem(MONTHLY_PAYROLL_APPS_SCRIPT_URL_KEY) || null;
  }

  /**
   * Lưu hoặc xóa URL Google Apps Script Webhook
   */
  public static setAppsScriptUrl(url: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean = (url || '').trim();
    if (clean) {
      localStorage.setItem(MONTHLY_PAYROLL_APPS_SCRIPT_URL_KEY, clean);
    } else {
      localStorage.removeItem(MONTHLY_PAYROLL_APPS_SCRIPT_URL_KEY);
    }
  }

  /**
   * Đồng bộ dữ liệu bảng lương qua Google Apps Script Webhook (POST request)
   * Tránh hoàn toàn lỗi CORS và không phụ thuộc vào quyền OAuth token trên trình duyệt
   */
  public static async syncViaAppsScriptWebhook(
    webhookUrl: string,
    month: number,
    year: number,
    baseSalary: number,
    payrollData: Record<PayrollCategory, MonthlyPayrollRecord[]>
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; totalSynced: number }> {
    const cleanUrl = (webhookUrl || '').trim();
    if (!cleanUrl) {
      throw new Error('Chưa cung cấp đường dẫn Google Apps Script Webhook URL.');
    }

    const categories: PayrollCategory[] = ['CONG_CHUC', 'VIEN_CHUC', 'HOP_DONG_111', 'THU_Y_PX', 'KHOAN_CM'];
    const tableHeaders = this.getTableHeaders();
    const allSavedPeriods = this.getSavedPeriods();
    
    // Đảm bảo kỳ hiện tại có trong lịch sử
    const currentPeriodKey = `${String(month).padStart(2, '0')}/${year}`;
    const existingIdx = allSavedPeriods.findIndex(p => p.periodKey === currentPeriodKey);
    const currentPeriodObj: SavedPeriodRecord = {
      periodKey: currentPeriodKey,
      month,
      year,
      baseSalary,
      calculatedAt: new Date().toISOString(),
      data: payrollData,
    };
    if (existingIdx >= 0) {
      allSavedPeriods[existingIdx] = currentPeriodObj;
    } else {
      allSavedPeriods.push(currentPeriodObj);
    }
    allSavedPeriods.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    let totalSynced = 0;
    const sheetsData: Record<string, { title: string; rows: (string | number)[][] }> = {};

    categories.forEach(cat => {
      const meta = PAYROLL_CATEGORY_META[cat];
      const rows: (string | number)[][] = [
        ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
        [meta.title.toUpperCase()],
        [`Sổ theo dõi bảng lương & thu nhập nhiều kỳ | Cập nhật kỳ mới nhất: Tháng ${month}/${year} (MLCS: ${baseSalary.toLocaleString('vi-VN')} đ/tháng)`],
        tableHeaders,
      ];

      let rowCounter = 0;
      allSavedPeriods.forEach(p => {
        const pRecords = p.data[cat] || [];
        pRecords.forEach(r => {
          rows.push(this.recordToRow(r, rowCounter++));
        });
      });

      const currentCatRecords = payrollData[cat] || [];
      totalSynced += currentCatRecords.length;

      if (rows.length > 4) {
        rows.push([
          'TỔNG CỘNG LŨY KẾ CÁC KỲ',
          `Tổng ${allSavedPeriods.length} kỳ`,
          '-',
          '',
          `${rowCounter} lượt tính lương`,
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          `Đã lưu trữ dữ liệu các tháng từ ${allSavedPeriods[0]?.periodKey} đến ${allSavedPeriods[allSavedPeriods.length - 1]?.periodKey}`,
        ]);
      }

      sheetsData[meta.sheetName] = {
        title: meta.title,
        rows,
      };
    });

    // Sheet Lũy Kế
    const luyKeRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['BẢNG TỔNG HỢP LŨY KẾ TIỀN LƯƠNG & THU NHẬP HÀNG THÁNG TOÀN CHI CỤC'],
      [`Lưu trữ đầy đủ các kỳ tính lương | Cập nhật kỳ mới nhất: Tháng ${month}/${year} | Mức lương cơ sở: ${baseSalary.toLocaleString('vi-VN')} đ`],
      tableHeaders,
    ];
    let lkCounter = 0;
    allSavedPeriods.forEach(p => {
      categories.forEach(c => {
        (p.data[c] || []).forEach(r => {
          luyKeRows.push(this.recordToRow(r, lkCounter++));
        });
      });
    });
    sheetsData['LuyKe_ThuNhap_ToanDonVi'] = {
      title: 'Lũy Kế Thu Nhập Toàn Đơn Vị',
      rows: luyKeRows,
    };

    // Sheet Lịch Sử Các Kỳ Lương
    const historyRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH - DANH SÁCH CÁC KỲ LƯƠNG ĐÃ TÍNH & LƯU TRỮ'],
      ['STT', 'Kỳ Lương (Tháng/Năm)', 'Mức Lương Cơ Sở (VNĐ)', 'Số Lượng Cán Bộ', 'Tổng Lương HSL (VNĐ)', 'Tổng Tiền Phụ Cấp (VNĐ)', 'Tổng Thu Nhập (VNĐ)', 'Tổng Trích BHXH (VNĐ)', 'Tổng Thực Lĩnh (VNĐ)', 'Thời Gian Tính'],
    ];
    allSavedPeriods.forEach((p, idx) => {
      const allPRecords: MonthlyPayrollRecord[] = [];
      categories.forEach(c => allPRecords.push(...(p.data[c] || [])));
      historyRows.push([
        idx + 1,
        p.periodKey,
        p.baseSalary,
        allPRecords.length,
        allPRecords.reduce((s, r) => s + r.salaryAmount, 0),
        allPRecords.reduce((s, r) => s + r.totalAllowanceAmount, 0),
        allPRecords.reduce((s, r) => s + r.totalGrossIncome, 0),
        allPRecords.reduce((s, r) => s + r.totalDeductions, 0),
        allPRecords.reduce((s, r) => s + r.netSalary, 0),
        new Date(p.calculatedAt).toLocaleString('vi-VN'),
      ]);
    });
    sheetsData['LichSu_CacKyLuong'] = {
      title: 'Lịch Sử Các Kỳ Lương',
      rows: historyRows,
    };

    const payload = {
      action: 'sync_payroll',
      month,
      year,
      baseSalary,
      periodKey: currentPeriodKey,
      sheetsData,
      totalSynced,
      timestamp: new Date().toISOString(),
    };

    try {
      // Dùng Content-Type: text/plain để tránh CORS preflight OPTIONS block trên Google Apps Script redirects
      const resp = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Apps Script trả về mã lỗi HTTP ${resp.status}: ${text || resp.statusText}`);
      }

      let resJson: any;
      try {
        resJson = await resp.json();
      } catch (jsonErr) {
        throw new Error('Apps Script trả về phản hồi không đúng định dạng JSON.');
      }

      if (resJson.status === 'error') {
        throw new Error(`Apps Script báo lỗi: ${resJson.message || 'Lỗi xử lý bảng tính trên Google'}`);
      }

      return {
        spreadsheetId: resJson.spreadsheetId || '',
        spreadsheetUrl: resJson.spreadsheetUrl || '',
        totalSynced,
      };
    } catch (fetchErr: any) {
      if (fetchErr.message?.includes('Failed to fetch') || fetchErr.name === 'TypeError' || fetchErr.message?.includes('NetworkError')) {
        throw new Error('Lỗi CORS hoặc kết nối: Không thể gửi dữ liệu tới Google Apps Script Webhook. Vui lòng kiểm tra lại URL Webhook và đảm bảo đã cấp quyền "Anyone" (Bất kỳ ai).');
      }
      throw fetchErr;
    }
  }

  /**
   * Đồng bộ toàn bộ dữ liệu bảng lương hàng tháng lên Google Sheets với 4 trang tính riêng biệt
   * và trang tính Lũy kế thu nhập tổng hợp
   */
  public static async syncToGoogleSheets(
    month: number,
    year: number,
    baseSalary: number,
    payrollData: Record<PayrollCategory, MonthlyPayrollRecord[]>
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; totalSynced: number }> {
    // 0. Nếu người dùng cấu hình URL Google Apps Script Webhook, ưu tiên đồng bộ qua Webhook
    const savedAppsScriptUrl = this.getAppsScriptUrl();
    if (savedAppsScriptUrl && savedAppsScriptUrl.trim().startsWith('http')) {
      try {
        return await this.syncViaAppsScriptWebhook(savedAppsScriptUrl.trim(), month, year, baseSalary, payrollData);
      } catch (webhookErr: any) {
        console.warn('Lỗi đồng bộ qua Apps Script Webhook, thử tiếp tục qua Google Sheets REST API:', webhookErr);
        const hasToken = !!(await getAccessToken());
        if (!hasToken) {
          throw webhookErr;
        }
      }
    }

    const token = await getAccessToken();
    if (!token) {
      clearAccessToken();
      notifyGoogleAuthExpired('Mã lỗi 401 (Invalid authentication credentials): Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn.');
      throw new GoogleAuthError(
        'Mã lỗi 401 (Invalid authentication credentials): Chưa kết nối tài khoản Google hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập lại Google để đồng bộ bảng tính.',
        401
      );
    }

    // Hàm tiện ích bóc tách lỗi chi tiết từ Google API Response
    const parseGoogleError = async (res: Response, fallback: string): Promise<string> => {
      try {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data?.error?.message) {
            return `${data.error.message} (HTTP ${res.status})`;
          }
        } catch {
          // not json
        }
        return text ? `${text.slice(0, 200)} (HTTP ${res.status})` : `${fallback} (HTTP ${res.status})`;
      } catch {
        return `${fallback} (HTTP ${res.status})`;
      }
    };

    try {
      let spreadsheetId = '';
      let spreadsheetUrl = '';

      // 1. Kiểm tra nếu có id trang tính đã lưu trước đó trong bộ nhớ
      const cachedPayrollId = typeof window !== 'undefined' ? localStorage.getItem(MONTHLY_PAYROLL_CUSTOM_SHEET_KEY) : null;
      const activeStaffSheetId = typeof window !== 'undefined' ? localStorage.getItem('ccty_active_spreadsheet_id') : null;
      const candidateIds = [cachedPayrollId, activeStaffSheetId].filter(Boolean) as string[];

      for (const testId of candidateIds) {
        try {
          const checkRes = await fetchWithGoogleAuth(`https://sheets.googleapis.com/v4/spreadsheets/${testId}?fields=properties(title)`);
          if (checkRes.ok) {
            spreadsheetId = testId;
            spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${testId}/edit`;
            if (typeof window !== 'undefined') {
              localStorage.setItem(MONTHLY_PAYROLL_CUSTOM_SHEET_KEY, testId);
            }
            break;
          }
        } catch (e: any) {
          if (e instanceof GoogleAuthError || e.status === 401) {
            throw e;
          }
          console.warn(`Không thể truy cập Spreadsheet ID ${testId}:`, e);
        }
      }

      // 2. Tìm kiếm trên Google Drive nếu chưa có spreadsheetId:
      if (!spreadsheetId) {
        const searchQ = `(name contains 'Bảng Lương & Thu Nhập Hàng Tháng' or name contains 'Bang Luong & Thu Nhap Hang Thang' or name contains 'Bảng Lương' or name contains 'Bang Luong') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`;

        try {
          const searchRes = await fetchWithGoogleAuth(searchUrl);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.files && searchData.files.length > 0) {
              const matchedFile = searchData.files.find((f: any) => 
                f.name?.includes('Bản sao') || f.name?.includes('Copy of')
              ) || searchData.files[0];

              spreadsheetId = matchedFile.id;
              spreadsheetUrl = matchedFile.webViewLink;
              if (typeof window !== 'undefined') {
                localStorage.setItem(MONTHLY_PAYROLL_CUSTOM_SHEET_KEY, spreadsheetId);
              }
            }
          }
        } catch (searchErr: any) {
          if (searchErr instanceof GoogleAuthError || searchErr.status === 401) {
            throw searchErr;
          }
          console.warn('Lỗi tìm kiếm Google Drive cho bảng lương:', searchErr);
        }
      }

      // 3. Nếu chưa có trên Drive, khởi tạo file Google Spreadsheet mới mang tên chuẩn
      if (!spreadsheetId) {
        const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
        let createRes: Response;
        try {
          createRes = await fetchWithGoogleAuth(createUrl, {
            method: 'POST',
            body: JSON.stringify({
              properties: {
                title: MONTHLY_PAYROLL_ALT_TITLE,
              },
              sheets: [
                { properties: { title: PAYROLL_CATEGORY_META.CONG_CHUC.sheetName, gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: PAYROLL_CATEGORY_META.VIEN_CHUC.sheetName, gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: PAYROLL_CATEGORY_META.HOP_DONG_111.sheetName, gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: PAYROLL_CATEGORY_META.THU_Y_PX.sheetName, gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: PAYROLL_CATEGORY_META.KHOAN_CM.sheetName, gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: 'LuyKe_ThuNhap_ToanDonVi', gridProperties: { frozenRowCount: 4 } } },
                { properties: { title: 'LichSu_CacKyLuong', gridProperties: { frozenRowCount: 4 } } },
              ],
            }),
          });
        } catch (netCreateErr: any) {
          if (netCreateErr instanceof GoogleAuthError || netCreateErr.status === 401) throw netCreateErr;
          throw new Error(`Lỗi kết nối / CORS khi khởi tạo Google Spreadsheet mới: ${netCreateErr.message || 'Mạng bị gián đoạn'}`);
        }

        if (!createRes.ok) {
          const errDetail = await parseGoogleError(createRes, 'Không thể khởi tạo Google Spreadsheet');
          throw new Error(`Không thể khởi tạo Google Spreadsheet bảng lương: ${errDetail}`);
        }

        const createData = await createRes.json();
        spreadsheetId = createData.spreadsheetId;
        spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        if (typeof window !== 'undefined') {
          localStorage.setItem(MONTHLY_PAYROLL_CUSTOM_SHEET_KEY, spreadsheetId);
        }
      }

      // 4. Đảm bảo đủ các sheet tương ứng
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
      let metaRes: Response;
      try {
        metaRes = await fetchWithGoogleAuth(metaUrl);
      } catch (netMetaErr: any) {
        if (netMetaErr instanceof GoogleAuthError || netMetaErr.status === 401) throw netMetaErr;
        throw new Error(`Lỗi kết nối / CORS khi đọc cấu trúc Spreadsheet: ${netMetaErr.message || 'Mạng bị gián đoạn'}`);
      }

      if (!metaRes.ok) {
        const errDetail = await parseGoogleError(metaRes, 'Lỗi kết nối đến Google Sheets');
        throw new Error(`Không thể kết nối đến Google Sheets (ID: ${spreadsheetId}): ${errDetail}`);
      }

      const metaData = await metaRes.json();
      const existingTitles = new Set<string>((metaData.sheets || []).map((s: any) => s.properties?.title));
      const requiredSheets = [
        PAYROLL_CATEGORY_META.CONG_CHUC.sheetName,
        PAYROLL_CATEGORY_META.VIEN_CHUC.sheetName,
        PAYROLL_CATEGORY_META.HOP_DONG_111.sheetName,
        PAYROLL_CATEGORY_META.THU_Y_PX.sheetName,
        PAYROLL_CATEGORY_META.KHOAN_CM.sheetName,
        'LuyKe_ThuNhap_ToanDonVi',
        'LichSu_CacKyLuong',
      ];

      const missing = requiredSheets.filter(t => !existingTitles.has(t));
      if (missing.length > 0) {
        const addRequests = missing.map(title => ({
          addSheet: {
            properties: {
              title,
              gridProperties: { frozenRowCount: 4 },
            },
          },
        }));

        const batchRes = await fetchWithGoogleAuth(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          body: JSON.stringify({ requests: addRequests }),
        });
        if (!batchRes.ok) {
          const batchErr = await parseGoogleError(batchRes, 'Lỗi tạo tab thiếu');
          console.warn('Lỗi tạo thêm tab thiếu trong spreadsheet:', batchErr);
        }
      }

      // 5. Chuẩn bị dữ liệu lưu trữ nhiều kỳ vào từng Sheet theo 4 loại hình
      const currentPeriodKey = `${String(month).padStart(2, '0')}/${year}`;
      const allSavedPeriods = this.getSavedPeriods();
      const existingPeriodIdx = allSavedPeriods.findIndex(p => p.periodKey === currentPeriodKey);
      const currentPeriodObj: SavedPeriodRecord = {
        periodKey: currentPeriodKey,
        month,
        year,
        baseSalary,
        calculatedAt: new Date().toISOString(),
        data: payrollData,
      };
      if (existingPeriodIdx >= 0) {
        allSavedPeriods[existingPeriodIdx] = currentPeriodObj;
      } else {
        allSavedPeriods.push(currentPeriodObj);
      }
      allSavedPeriods.sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

      const tableHeaders = this.getTableHeaders();
      const categories: PayrollCategory[] = ['CONG_CHUC', 'VIEN_CHUC', 'HOP_DONG_111', 'THU_Y_PX', 'KHOAN_CM'];
      let totalSynced = 0;

      for (const cat of categories) {
        const meta = PAYROLL_CATEGORY_META[cat];
        const rows: (string | number)[][] = [
          ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
          [meta.title.toUpperCase()],
          [`Sổ theo dõi bảng lương & thu nhập nhiều kỳ | Cập nhật kỳ mới nhất: Tháng ${month}/${year} (MLCS: ${baseSalary.toLocaleString('vi-VN')} đ/tháng)`],
          tableHeaders,
        ];

        let rowCounter = 0;
        allSavedPeriods.forEach(period => {
          const pRecords = period.data[cat] || [];
          pRecords.forEach(r => {
            rows.push(this.recordToRow(r, rowCounter++));
          });
        });

        const currentCatRecords = payrollData[cat] || [];
        totalSynced += currentCatRecords.length;

        if (rows.length > 4) {
          rows.push([
            'TỔNG CỘNG LŨY KẾ CÁC KỲ',
            `Tổng ${allSavedPeriods.length} kỳ`,
            '-',
            '',
            `${rowCounter} lượt tính lương`,
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            `Đã lưu trữ dữ liệu các tháng từ ${allSavedPeriods[0]?.periodKey} đến ${allSavedPeriods[allSavedPeriods.length - 1]?.periodKey}`,
          ]);
        }

        // Xóa vùng dữ liệu cũ trước khi ghi mới
        try {
          const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${meta.sheetName}'!A1:AE5000:clear`;
          const clearRes = await fetchWithGoogleAuth(clearUrl, {
            method: 'POST',
          });
          if (!clearRes.ok) {
            const clearErr = await parseGoogleError(clearRes, 'Lỗi dọn sạch dữ liệu cũ');
            console.warn(`Lưu ý khi xóa dữ liệu cũ tab ${meta.sheetName}:`, clearErr);
          }
        } catch (clearErr: any) {
          if (clearErr instanceof GoogleAuthError || clearErr.status === 401) throw clearErr;
          console.warn(`Bỏ qua lỗi xóa sheet ${meta.sheetName}:`, clearErr);
        }

        // Ghi dữ liệu bảng lương vào Google Sheet
        const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${meta.sheetName}'!A1?valueInputOption=USER_ENTERED`;
        let writeRes: Response;
        try {
          writeRes = await fetchWithGoogleAuth(writeUrl, {
            method: 'PUT',
            body: JSON.stringify({
              values: rows,
            }),
          });
        } catch (netWriteErr: any) {
          if (netWriteErr instanceof GoogleAuthError || netWriteErr.status === 401) throw netWriteErr;
          throw new Error(`Lỗi kết nối / CORS khi ghi dữ liệu vào tab "${meta.sheetName}": ${netWriteErr.message || 'Mạng bị ngắt'}`);
        }

        if (!writeRes.ok) {
          const writeErrText = await parseGoogleError(writeRes, 'Lỗi ghi dữ liệu');
          console.error(`Lỗi ghi dữ liệu sheet ${meta.sheetName}:`, writeErrText);
          throw new Error(`Lỗi ghi dữ liệu vào tab "${meta.sheetName}": ${writeErrText}`);
        }
      }

      // 6. Cập nhật sheet tích lũy tổng hợp: LuyKe_ThuNhap_ToanDonVi
      try {
        const luyKeRows: (string | number)[][] = [
          ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
          ['BẢNG TỔNG HỢP LŨY KẾ TIỀN LƯƠNG & THU NHẬP HÀNG THÁNG TOÀN CHI CỤC'],
          [`Lưu trữ đầy đủ các kỳ tính lương | Cập nhật kỳ mới nhất: Tháng ${month}/${year} | Mức lương cơ sở: ${baseSalary.toLocaleString('vi-VN')} đ`],
          tableHeaders,
        ];

        let lkCounter = 0;
        allSavedPeriods.forEach(p => {
          categories.forEach(c => {
            const recs = p.data[c] || [];
            recs.forEach(r => {
              luyKeRows.push(this.recordToRow(r, lkCounter++));
            });
          });
        });

        const clearLuyKe = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'LuyKe_ThuNhap_ToanDonVi'!A1:AE5000:clear`;
        await fetchWithGoogleAuth(clearLuyKe, { method: 'POST' });

        const writeLuyKe = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'LuyKe_ThuNhap_ToanDonVi'!A1?valueInputOption=USER_ENTERED`;
        const lkRes = await fetchWithGoogleAuth(writeLuyKe, {
          method: 'PUT',
          body: JSON.stringify({ values: luyKeRows }),
        });
        if (!lkRes.ok) {
          const lkErr = await parseGoogleError(lkRes, 'Lỗi ghi sheet LuyKe');
          console.warn('Lỗi ghi sheet LuyKe_ThuNhap_ToanDonVi:', lkErr);
          throw new Error(`Lỗi cập nhật tab "LuyKe_ThuNhap_ToanDonVi": ${lkErr}`);
        }
      } catch (e: any) {
        if (e instanceof GoogleAuthError || e.status === 401) throw e;
        if (e.message?.includes('Lỗi cập nhật tab')) throw e;
        console.warn('Lỗi ngoại lệ ghi sheet LuyKe_ThuNhap_ToanDonVi:', e);
      }

      // 7. Cập nhật sheet danh mục các kỳ tính lương: LichSu_CacKyLuong
      try {
        const historyRows: (string | number)[][] = [
          ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH - DANH SÁCH CÁC KỲ LƯƠNG ĐÃ TÍNH & LƯU TRỮ'],
          ['STT', 'Kỳ Lương (Tháng/Năm)', 'Mức Lương Cơ Sở (VNĐ)', 'Số Lượng Cán Bộ', 'Tổng Lương HSL (VNĐ)', 'Tổng Tiền Phụ Cấp (VNĐ)', 'Tổng Thu Nhập (VNĐ)', 'Tổng Trích BHXH (VNĐ)', 'Tổng Thực Lĩnh (VNĐ)', 'Thời Gian Tính'],
        ];

        allSavedPeriods.forEach((p, idx) => {
          const allPRecords: MonthlyPayrollRecord[] = [];
          categories.forEach(c => allPRecords.push(...(p.data[c] || [])));

          historyRows.push([
            idx + 1,
            p.periodKey,
            p.baseSalary,
            allPRecords.length,
            allPRecords.reduce((s, r) => s + r.salaryAmount, 0),
            allPRecords.reduce((s, r) => s + r.totalAllowanceAmount, 0),
            allPRecords.reduce((s, r) => s + r.totalGrossIncome, 0),
            allPRecords.reduce((s, r) => s + r.totalDeductions, 0),
            allPRecords.reduce((s, r) => s + r.netSalary, 0),
            new Date(p.calculatedAt).toLocaleString('vi-VN'),
          ]);
        });

        const clearHistory = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'LichSu_CacKyLuong'!A1:J100:clear`;
        await fetchWithGoogleAuth(clearHistory, { method: 'POST' });

        const writeHistory = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'LichSu_CacKyLuong'!A1?valueInputOption=USER_ENTERED`;
        const histRes = await fetchWithGoogleAuth(writeHistory, {
          method: 'PUT',
          body: JSON.stringify({ values: historyRows }),
        });
        if (!histRes.ok) {
          const histErr = await parseGoogleError(histRes, 'Lỗi ghi sheet LichSu');
          console.warn('Lỗi ghi sheet LichSu_CacKyLuong:', histErr);
          throw new Error(`Lỗi cập nhật tab "LichSu_CacKyLuong": ${histErr}`);
        }
      } catch (e: any) {
        if (e instanceof GoogleAuthError || e.status === 401) throw e;
        if (e.message?.includes('Lỗi cập nhật tab')) throw e;
        console.warn('Lỗi ngoại lệ ghi sheet LichSu_CacKyLuong:', e);
      }

      return {
        spreadsheetId,
        spreadsheetUrl,
        totalSynced,
      };
    } catch (err: any) {
      if (err instanceof GoogleAuthError || err?.status === 401) {
        throw err;
      }
      const msg = typeof err?.message === 'string' ? err.message : String(err);
      if (msg.includes('Failed to fetch') || err?.name === 'TypeError' || msg.includes('NetworkError') || msg.includes('Load failed')) {
        throw new Error('Lỗi CORS hoặc đường truyền mạng: Trình duyệt chặn kết nối hoặc mạng bị gián đoạn khi kết nối Google Sheets API.');
      }
      throw err;
    }
  }
}

