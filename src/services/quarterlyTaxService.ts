import { 
  Employee, 
  TaxDependent, 
  MonthlyTaxDetail, 
  QuarterlyTaxRecord, 
  AnnualTaxRecord,
  OtherIncomeItem
} from '../types/hrm';
import { MonthlyPayrollService, isWorkingEmployee } from './monthlyPayrollService';
import { getAccessToken } from './firebaseAuth';
import { sortEmployeesByPriority } from '../utils/leadershipUtils';
import { INITIAL_EMPLOYEES } from '../data/initialData';
import * as XLSX from 'xlsx';

export const TAX_SPREADSHEET_TITLE = 'Chi Cục Chăn Nuôi & Thú Y TPHCM - Quản Lý Thuế TNCN Theo Quý & Năm';
export const DEPENDENTS_STORAGE_KEY = 'ccty_tax_dependents_v1';
export const OTHER_INCOMES_STORAGE_KEY = 'ccty_tax_other_incomes_v1';
export const TAX_SAVED_QUARTERS_KEY = 'ccty_tax_saved_quarters_v1';

// Mức giảm trừ gia cảnh quy định tại Nghị quyết số 954/2020/UBTVQH14
export const PERSONAL_DEDUCTION_MONTHLY = 11_000_000; // 11 triệu đồng/tháng
export const DEPENDENT_DEDUCTION_MONTHLY = 4_400_000; // 4.4 triệu đồng/người/tháng

export const PERSONAL_DEDUCTION_QUARTERLY = 33_000_000; // 33 triệu đồng/quý
export const DEPENDENT_DEDUCTION_QUARTERLY = 13_200_000; // 13.2 triệu đồng/người/quý

export const PERSONAL_DEDUCTION_ANNUAL = 132_000_000; // 132 triệu đồng/năm
export const DEPENDENT_DEDUCTION_ANNUAL = 52_800_000; // 52.8 triệu đồng/người/năm

/**
 * Biểu thuế lũy tiến từng phần theo tháng (Thông tư 111/2013/TT-BTC)
 */
export function calculateMonthlyPIT(assessable: number): number {
  if (assessable <= 0) return 0;
  if (assessable <= 5_000_000) return Math.round(assessable * 0.05);
  if (assessable <= 10_000_000) return Math.round(assessable * 0.10 - 250_000);
  if (assessable <= 18_000_000) return Math.round(assessable * 0.15 - 750_000);
  if (assessable <= 32_000_000) return Math.round(assessable * 0.20 - 1_650_000);
  if (assessable <= 52_000_000) return Math.round(assessable * 0.25 - 3_250_000);
  if (assessable <= 80_000_000) return Math.round(assessable * 0.30 - 5_850_000);
  return Math.round(assessable * 0.35 - 9_850_000);
}

/**
 * Biểu thuế lũy tiến từng phần theo quý (3 tháng quy đổi)
 */
export function calculateQuarterlyPIT(assessable: number): number {
  if (assessable <= 0) return 0;
  if (assessable <= 15_000_000) return Math.round(assessable * 0.05);
  if (assessable <= 30_000_000) return Math.round(assessable * 0.10 - 750_000);
  if (assessable <= 54_000_000) return Math.round(assessable * 0.15 - 2_250_000);
  if (assessable <= 96_000_000) return Math.round(assessable * 0.20 - 4_950_000);
  if (assessable <= 156_000_000) return Math.round(assessable * 0.25 - 9_750_000);
  if (assessable <= 240_000_000) return Math.round(assessable * 0.30 - 17_550_000);
  return Math.round(assessable * 0.35 - 29_550_000);
}

/**
 * Biểu thuế lũy tiến từng phần theo năm (12 tháng quy đổi)
 */
export function calculateAnnualPIT(assessable: number): number {
  if (assessable <= 0) return 0;
  if (assessable <= 60_000_000) return Math.round(assessable * 0.05);
  if (assessable <= 120_000_000) return Math.round(assessable * 0.10 - 3_000_000);
  if (assessable <= 216_000_000) return Math.round(assessable * 0.15 - 9_000_000);
  if (assessable <= 384_000_000) return Math.round(assessable * 0.20 - 19_800_000);
  if (assessable <= 624_000_000) return Math.round(assessable * 0.25 - 39_000_000);
  if (assessable <= 960_000_000) return Math.round(assessable * 0.30 - 70_200_000);
  return Math.round(assessable * 0.35 - 118_200_000);
}

export class QuarterlyTaxService {
  /**
   * Danh sách người phụ thuộc khởi tạo mẫu thực tế
   */
  public static getInitialDependents(): TaxDependent[] {
    return [
      {
        id: 'dep-1',
        employeeId: 'emp-ccty-NV-19750312-0001',
        employeeCode: 'NV-19750312-0001',
        employeeName: 'Trần Phú Cường',
        dependentName: 'Trần Minh Quân',
        relationship: 'Con dưới 18 tuổi',
        dob: '2012-05-18',
        idCardOrTaxCode: '079212001122',
        startDate: '2020-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Giảm trừ người phụ thuộc theo quy định',
      },
      {
        id: 'dep-2',
        employeeId: 'emp-ccty-NV-19750312-0001',
        employeeCode: 'NV-19750312-0001',
        employeeName: 'Trần Phú Cường',
        dependentName: 'Trần Thảo My',
        relationship: 'Con dưới 18 tuổi',
        dob: '2016-11-20',
        idCardOrTaxCode: '079216002233',
        startDate: '2020-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Con thứ hai',
      },
      {
        id: 'dep-3',
        employeeId: 'emp-ccty-NV-19780820-0002',
        employeeCode: 'NV-19780820-0002',
        employeeName: 'Nguyễn Trường Giang',
        dependentName: 'Nguyễn Hoàng Khang',
        relationship: 'Con dưới 18 tuổi',
        dob: '2014-08-15',
        idCardOrTaxCode: '079214003344',
        startDate: '2021-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Giảm trừ gia cảnh',
      },
      {
        id: 'dep-4',
        employeeId: 'emp-ccty-NV-19811105-0003',
        employeeCode: 'NV-19811105-0003',
        employeeName: 'Huỳnh Thanh Sử',
        dependentName: 'Huỳnh Gia Hân',
        relationship: 'Con dưới 18 tuổi',
        dob: '2015-03-22',
        idCardOrTaxCode: '079215004455',
        startDate: '2020-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Con ruột',
      },
      {
        id: 'dep-5',
        employeeId: 'emp-ccty-NV-19830415-0004',
        employeeCode: 'NV-19830415-0004',
        employeeName: 'Trần Văn Hoàng',
        dependentName: 'Trần Bảo Ngọc',
        relationship: 'Con dưới 18 tuổi',
        dob: '2013-09-10',
        idCardOrTaxCode: '079213005566',
        startDate: '2021-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Giảm trừ gia cảnh con',
      },
      {
        id: 'dep-6',
        employeeId: 'emp-ccty-NV-19841203-0007',
        employeeCode: 'NV-19841203-0007',
        employeeName: 'Nguyễn Tấn Đạt',
        dependentName: 'Nguyễn Minh Đăng',
        relationship: 'Con dưới 18 tuổi',
        dob: '2017-06-12',
        idCardOrTaxCode: '079217006677',
        startDate: '2022-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Giảm trừ người phụ thuộc',
      },
      {
        id: 'dep-7',
        employeeId: 'emp-ccty-NV-19880310-0009',
        employeeCode: 'NV-19880310-0009',
        employeeName: 'Võ Thị Hồng Loan',
        dependentName: 'Lê Hoàng Yến',
        relationship: 'Con dưới 18 tuổi',
        dob: '2018-04-05',
        idCardOrTaxCode: '079218007788',
        startDate: '2023-01',
        deductionMonthlyAmount: 4_400_000,
        notes: 'Con ruột',
      },
    ];
  }

  /**
   * Lấy toàn bộ danh sách người phụ thuộc từ localStorage
   */
  public static getDependents(): TaxDependent[] {
    const saved = localStorage.getItem(DEPENDENTS_STORAGE_KEY);
    if (!saved) {
      const initial = this.getInitialDependents();
      try {
        localStorage.setItem(DEPENDENTS_STORAGE_KEY, JSON.stringify(initial));
      } catch (e) {
        console.warn('Lỗi lưu NPT mẫu:', e);
      }
      return initial;
    }
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Lưu hoặc cập nhật người phụ thuộc
   */
  public static saveDependent(dep: TaxDependent): void {
    const list = this.getDependents();
    const idx = list.findIndex(d => d.id === dep.id);
    if (idx >= 0) {
      list[idx] = dep;
    } else {
      list.push(dep);
    }
    try {
      localStorage.setItem(DEPENDENTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Lỗi lưu NPT:', e);
    }
  }

  /**
   * Xóa người phụ thuộc
   */
  public static deleteDependent(id: string): void {
    const list = this.getDependents().filter(d => d.id !== id);
    try {
      localStorage.setItem(DEPENDENTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Lỗi xóa NPT:', e);
    }
  }

  /**
   * Lấy danh sách người phụ thuộc hợp lệ của 1 nhân sự tại tháng/năm cụ thể
   */
  public static getActiveDependentsForMonth(empCode: string, month: number, year: number): TaxDependent[] {
    const all = this.getDependents();
    const targetKey = `${year}-${String(month).padStart(2, '0')}`;

    return all.filter(d => {
      if (d.employeeCode !== empCode) return false;
      if (d.startDate && d.startDate > targetKey) return false;
      if (d.endDate && d.endDate < targetKey) return false;
      return true;
    });
  }

  /**
   * Danh sách các khoản thu nhập khác khởi tạo mẫu thực tế (Nghị quyết 98, trực kiểm dịch, thưởng lễ...)
   */
  public static getInitialOtherIncomes(): OtherIncomeItem[] {
    return [];
  }

  /**
   * Lấy toàn bộ danh sách các khoản thu nhập khác từ localStorage
   * Tuyệt đối không tự sinh dữ liệu giả lập, chỉ lấy dữ liệu người dùng nhập hoặc tải lên
   */
  public static getOtherIncomes(): OtherIncomeItem[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const saved = localStorage.getItem(OTHER_INCOMES_STORAGE_KEY);
    if (!saved) {
      return [];
    }
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static saveOtherIncome(item: OtherIncomeItem): void {
    const list = this.getOtherIncomes();
    const idx = list.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    try {
      localStorage.setItem(OTHER_INCOMES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Lỗi lưu thu nhập khác:', e);
    }
  }

  /**
   * Xóa một khoản thu nhập khác
   */
  public static deleteOtherIncome(id: string): void {
    const list = this.getOtherIncomes().filter(i => i.id !== id);
    try {
      localStorage.setItem(OTHER_INCOMES_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Lỗi xóa thu nhập khác:', e);
    }
  }

  /**
   * Xóa toàn bộ danh sách thu nhập khác
   */
  public static clearOtherIncomes(): void {
    try {
      localStorage.setItem(OTHER_INCOMES_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('Lỗi làm rỗng thu nhập khác:', e);
    }
  }

  /**
   * Lấy tổng thu nhập khác của 1 cán bộ tại 1 tháng/năm cụ thể
   * Khớp thông minh theo cả mã nhân viên (không phân biệt chữ hoa/thường, khoảng trắng) và họ tên
   */
  public static getOtherIncomeTotal(empCode: string, month: number, year: number, empName?: string): number {
    const list = this.getOtherIncomes();
    const upperCode = (empCode || '').trim().toUpperCase();
    const normName = (empName || '').trim().toLowerCase();

    return list
      .filter(i => {
        if (Number(i.month) !== month || Number(i.year) !== year) return false;
        const iCode = (i.employeeCode || '').trim().toUpperCase();
        const iName = (i.employeeName || '').trim().toLowerCase();
        return iCode === upperCode || (normName && iName === normName);
      })
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  /**
   * Tạo bản đồ tổng hợp nhanh [empCode_month_year -> tổng tiền] để tối ưu hiệu năng tính toán
   * Hỗ trợ truyền mảng items trực tiếp (từ React state) và lập chỉ mục đa năng (Mã NV hoa/thường, Họ Tên)
   */
  public static getOtherIncomesMap(items?: OtherIncomeItem[]): Map<string, number> {
    const list = items || this.getOtherIncomes();
    const map = new Map<string, number>();
    for (const item of list) {
      const amt = Number(item.amount) || 0;
      if (!amt) continue;

      const m = Number(item.month);
      const y = Number(item.year);

      // Key bằng mã nhân viên (chuẩn hóa uppercase và trim)
      if (item.employeeCode) {
        const rawCode = String(item.employeeCode).trim();
        const upperCode = rawCode.toUpperCase();
        
        const kUpper = `${upperCode}_${m}_${y}`;
        map.set(kUpper, (map.get(kUpper) || 0) + amt);

        if (rawCode !== upperCode) {
          const kRaw = `${rawCode}_${m}_${y}`;
          map.set(kRaw, (map.get(kRaw) || 0) + amt);
        }
      }

      // Key bằng họ tên nhân viên để hỗ trợ trường hợp file Excel chỉ có tên hoặc mã nhập lệch
      if (item.employeeName) {
        const normName = String(item.employeeName).trim().toLowerCase();
        const kName = `NAME_${normName}_${m}_${y}`;
        map.set(kName, (map.get(kName) || 0) + amt);
      }
    }
    return map;
  }

  /**
   * Gom dữ liệu thu nhập khác theo Quý cho toàn bộ cán bộ
   * Trả về bảng tổng hợp: Cán bộ -> Tổng thu nhập khác trong 3 tháng của Quý
   */
  public static aggregateOtherIncomesForQuarter(
    quarter: 1 | 2 | 3 | 4,
    year: number,
    items?: OtherIncomeItem[]
  ): Map<string, { totalQuarter: number; m1: number; m2: number; m3: number; itemsCount: number }> {
    const qMonths: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9],
      4: [10, 11, 12],
    };
    const months = qMonths[quarter];
    const list = items || this.getOtherIncomes();
    const result = new Map<string, { totalQuarter: number; m1: number; m2: number; m3: number; itemsCount: number }>();

    for (const item of list) {
      if (Number(item.year) === year && months.includes(Number(item.month))) {
        const empCode = (item.employeeCode || '').trim().toUpperCase();
        if (!empCode) continue;
        if (!result.has(empCode)) {
          result.set(empCode, { totalQuarter: 0, m1: 0, m2: 0, m3: 0, itemsCount: 0 });
        }
        const data = result.get(empCode)!;
        const amt = Number(item.amount) || 0;
        data.totalQuarter += amt;
        data.itemsCount += 1;
        if (Number(item.month) === months[0]) data.m1 += amt;
        else if (Number(item.month) === months[1]) data.m2 += amt;
        else if (Number(item.month) === months[2]) data.m3 += amt;
      }
    }
    return result;
  }

  /**
   * Xuất file Excel mẫu để người dùng nhập liệu thu nhập khác và tải lên
   */
  public static exportSampleOtherIncomeTemplate(employees: Employee[]): void {
    const wb = XLSX.utils.book_new();
    const rows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['BIỂU MẪU NHẬP CHI TIẾT CÁC KHOẢN THU NHẬP KHÁC'],
      ['(Dùng để tải lên hệ thống tính thuế TNCN theo Quý và đối chiếu lũy kế)'],
      [],
      [
        'Tháng',
        'Năm',
        'Mã Nhân Viên',
        'Họ và Tên Nhân Viên',
        'Nội Dung Thu Nhập',
        'Số Tiền (VNĐ)',
        'Ghi Chú',
      ],
      [
        7,
        2026,
        'NV-19750312-0001',
        'Trần Phú Cường',
        'Thu nhập tăng thêm theo Nghị quyết 98/2023/QH15',
        12000000,
        'Hoàn thành xuất sắc nhiệm vụ Quý II',
      ],
      [
        7,
        2026,
        'NV-19841203-0007',
        'Nguyễn Tấn Đạt',
        'Thu nhập tăng thêm theo Nghị quyết 98/2023/QH15',
        5500000,
        'Hệ số hoàn thành tốt nhiệm vụ',
      ],
      [
        8,
        2026,
        'NV-19841203-0007',
        'Nguyễn Tấn Đạt',
        'Tiền làm thêm giờ trực chốt kiểm dịch ban đêm',
        3200000,
        'Trực chốt kiểm dịch động vật đầu mối',
      ],
      [
        9,
        2026,
        'NV-19880310-0009',
        'Võ Thị Hồng Loan',
        'Tiền thưởng ngày Lễ Quốc khánh 02/9',
        3000000,
        'Khen thưởng ngày lễ',
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_ThuNhap_Khac');
    XLSX.writeFile(wb, 'Mau_Nhap_Thu_Nhap_Khac_ChiCucThuY.xlsx');
  }

  /**
   * Đọc dữ liệu từ file Excel tải lên, kiểm tra và chuyển đổi thành danh sách OtherIncomeItem
   */
  public static parseOtherIncomesFromExcel(
    data: ArrayBuffer | Uint8Array,
    employees: Employee[],
    fallbackYear: number = 2026
  ): { imported: OtherIncomeItem[]; errors: string[] } {
    const wb = XLSX.read(data, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      return { imported: [], errors: ['Tệp Excel không chứa trang tính (sheet) nào!'] };
    }

    const ws = wb.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
    if (!rawData || rawData.length < 2) {
      return { imported: [], errors: ['Tệp Excel không có dữ liệu!'] };
    }

    // Tìm dòng header
    let headerRowIdx = -1;
    let colMonth = -1;
    let colYear = -1;
    let colEmpCode = -1;
    let colEmpName = -1;
    let colDescription = -1;
    let colAmount = -1;
    let colNotes = -1;

    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] || '').toLowerCase().trim();
        if (val.includes('tháng') || val.includes('thang') || val === 'month' || val.includes('kỳ') || val.includes('ky')) {
          colMonth = j;
        } else if (val.includes('năm') || val.includes('nam') || val === 'year') {
          colYear = j;
        } else if (val.includes('mã nv') || val.includes('ma nv') || val.includes('mã nhân viên') || val.includes('manhanvien')) {
          colEmpCode = j;
        } else if (val.includes('họ') || val.includes('tên') || val.includes('ho va ten') || val.includes('hovaten') || val.includes('cán bộ')) {
          colEmpName = j;
        } else if (val.includes('nội dung') || val.includes('noi dung') || val.includes('khoản') || val.includes('description') || val.includes('lý do')) {
          colDescription = j;
        } else if (val.includes('tiền') || val.includes('tien') || val.includes('số tiền') || val.includes('amount') || val.includes('sotien')) {
          colAmount = j;
        } else if (val.includes('ghi chú') || val.includes('ghi chu') || val.includes('notes')) {
          colNotes = j;
        }
      }
      if (colMonth >= 0 && (colEmpCode >= 0 || colEmpName >= 0) && colAmount >= 0) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return {
        imported: [],
        errors: [
          'Không tìm thấy dòng tiêu đề hợp lệ trong file Excel. Vui lòng đảm bảo các cột: Tháng, Mã Nhân Viên (hoặc Họ Tên), Nội Dung Thu Nhập, Số Tiền.',
        ],
      };
    }

    const imported: OtherIncomeItem[] = [];
    const errors: string[] = [];

    // Duyệt qua các dòng dữ liệu sau tiêu đề
    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawMonth = row[colMonth];
      const rawYear = colYear >= 0 ? row[colYear] : undefined;
      const rawCode = colEmpCode >= 0 ? String(row[colEmpCode] || '').trim() : '';
      const rawName = colEmpName >= 0 ? String(row[colEmpName] || '').trim() : '';
      const rawDesc = colDescription >= 0 ? String(row[colDescription] || '').trim() : 'Thu nhập khác';
      const rawAmt = colAmount >= 0 ? row[colAmount] : 0;
      const rawNotes = colNotes >= 0 ? String(row[colNotes] || '').trim() : '';

      // Kiểm tra dòng trống
      if (!rawMonth && !rawCode && !rawName && !rawAmt) continue;

      // Xử lý tháng & năm
      let month = Number(rawMonth);
      let year = Number(rawYear) || fallbackYear;

      // Nếu ô tháng có định dạng "07/2026" hoặc "2026-07"
      if (isNaN(month) || month < 1 || month > 12) {
        const strM = String(rawMonth || '');
        if (strM.includes('/')) {
          const parts = strM.split('/');
          month = Number(parts[0]);
          year = Number(parts[1]) || year;
        } else if (strM.includes('-')) {
          const parts = strM.split('-');
          year = Number(parts[0]) || year;
          month = Number(parts[1]);
        }
      }

      if (isNaN(month) || month < 1 || month > 12) {
        errors.push(`Dòng ${r + 1}: Tháng không hợp lệ (${rawMonth}). Phải từ 1 đến 12.`);
        continue;
      }

      // Xử lý số tiền
      const cleanAmtStr = String(rawAmt).replace(/[^0-9.-]/g, '');
      const amount = Math.round(Number(cleanAmtStr) || 0);
      if (amount <= 0) {
        errors.push(`Dòng ${r + 1}: Số tiền không hợp lệ hoặc <= 0 (${rawAmt}).`);
        continue;
      }

      // Đối chiếu nhân viên
      let matchedEmp = employees.find(
        e => e.code.toLowerCase() === rawCode.toLowerCase()
      );
      if (!matchedEmp && rawName) {
        matchedEmp = employees.find(
          e => e.fullName.toLowerCase().trim() === rawName.toLowerCase().trim()
        );
      }

      if (!matchedEmp) {
        errors.push(`Dòng ${r + 1}: Không tìm thấy cán bộ với Mã "${rawCode}" hoặc Tên "${rawName}" trong danh sách.`);
        continue;
      }

      const item: OtherIncomeItem = {
        id: `inc-${Date.now()}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        month,
        year,
        periodKey: `${String(month).padStart(2, '0')}/${year}`,
        employeeCode: matchedEmp.code,
        employeeName: matchedEmp.fullName,
        departmentName: matchedEmp.departmentName || '',
        description: rawDesc || 'Thu nhập khác',
        amount,
        taxable: true,
        source: 'IMPORT_EXCEL',
        notes: rawNotes,
        createdAt: new Date().toISOString(),
      };

      imported.push(item);
    }

    return { imported, errors };
  }

  /**
   * TẦNG 1: TÍNH THUẾ TNCN CHI TIẾT THEO TỪNG THÁNG CHO MỘT CÁN BỘ
   * Tự động lấy hệ số lương, mức lương cơ sở (T9: 2.34M, T10: 2.53M) và bảo hiểm bắt buộc
   */
  public static calculateMonthlyTaxDetail(
    emp: Employee,
    month: number,
    year: number,
    otherIncomesMap?: Map<string, number>
  ): MonthlyTaxDetail {
    const periodKey = `${String(month).padStart(2, '0')}/${year}`;
    const baseSalary = MonthlyPayrollService.getBaseSalaryForPeriod(month, year);
    const resolvedSalary = MonthlyPayrollService.resolveEmployeeSalaryForPeriod(emp, month, year);

    // 1. Các khoản thu nhập từ lương
    const coefficient = resolvedSalary.coefficient;
    const salaryAmount = Math.round(coefficient * baseSalary);

    const beyondFramePercent = resolvedSalary.beyondFramePercent;
    const beyondFrameAmount = Math.round(salaryAmount * (beyondFramePercent / 100));

    const leadershipAllowanceCoeff = resolvedSalary.leadershipAllowanceCoeff;
    const leadershipAllowanceAmount = Math.round(leadershipAllowanceCoeff * baseSalary);

    const category = MonthlyPayrollService.getPayrollCategory(emp);
    const isCongChuc = category === 'CONG_CHUC';
    const baseForAllowances = salaryAmount + leadershipAllowanceAmount + beyondFrameAmount;

    // Phụ cấp công vụ: 25% đối với công chức
    const publicServicePercent = isCongChuc ? (Number(emp.salary?.publicServiceAllowancePercent) || 25) : 0;
    const publicServiceAllowanceAmount = Math.round(baseForAllowances * (publicServicePercent / 100));

    // Thu nhập khác: Phụ cấp trách nhiệm + Chi tiết các khoản thu nhập khác (NQ98, làm thêm, thưởng lễ...)
    const responsibilityAmount = Math.round(resolvedSalary.responsibilityAllowanceCoeff * baseSalary);
    let dynamicOtherIncome = 0;
    if (otherIncomesMap) {
      const upperCode = (emp.code || '').trim().toUpperCase();
      const normName = (emp.fullName || '').trim().toLowerCase();
      dynamicOtherIncome =
        otherIncomesMap.get(`${upperCode}_${month}_${year}`) ??
        otherIncomesMap.get(`${emp.code}_${month}_${year}`) ??
        otherIncomesMap.get(`NAME_${normName}_${month}_${year}`) ??
        0;
    } else {
      dynamicOtherIncome = this.getOtherIncomeTotal(emp.code, month, year, emp.fullName);
    }
    const otherIncomeAmount = responsibilityAmount + dynamicOtherIncome + (Number(emp.salary?.otherAllowance) || 0);

    // Tổng thu nhập
    const totalGrossIncome = salaryAmount + beyondFrameAmount + leadershipAllowanceAmount + publicServiceAllowanceAmount + otherIncomeAmount;

    // Khoản không chịu thuế / được miễn thuế theo điều kiện (phụ cấp công tác phí, trang phục, ưu đãi nghề thú y)
    const travelAllowance = resolvedSalary.travelAllowanceAmount || 0;
    const nonTaxableIncome = travelAllowance + Math.round(salaryAmount * 0.05); // Miễn phụ cấp lưu động và khoản trang phục quy định
    const taxableIncome = Math.max(0, totalGrossIncome - nonTaxableIncome);

    // 2. Các khoản giảm trừ theo quy định
    // Bảo hiểm bắt buộc: BHXH 8%, BHYT 1.5%, BHTN 1% (Công chức 0% BHTN)
    const insuranceBase = salaryAmount + leadershipAllowanceAmount + beyondFrameAmount + responsibilityAmount;
    const socialInsurance = Math.round(insuranceBase * 0.08);
    const healthInsurance = Math.round(insuranceBase * 0.015);
    const unemploymentInsurance = isCongChuc ? 0 : Math.round(insuranceBase * 0.01);
    const compulsoryInsurance = socialInsurance + healthInsurance + unemploymentInsurance;

    // Giảm trừ bản thân: 11.000.000 đ/tháng
    const personalDeduction = PERSONAL_DEDUCTION_MONTHLY;

    // Giảm trừ người phụ thuộc: 4.400.000 đ/tháng/người
    const activeDependents = this.getActiveDependentsForMonth(emp.code, month, year);
    const dependentCount = activeDependents.length;
    const dependentDeduction = dependentCount * DEPENDENT_DEDUCTION_MONTHLY;

    const otherDeduction = 0; // Từ thiện, nhân đạo nếu có

    const totalDeductions = compulsoryInsurance + personalDeduction + dependentDeduction + otherDeduction;

    // 3. Thu nhập tính thuế = Thu nhập chịu thuế - Tổng các khoản giảm trừ
    const assessableIncome = Math.max(0, taxableIncome - totalDeductions);

    // 4. Thuế TNCN phát sinh / tạm khấu trừ trong tháng theo biểu thuế lũy tiến từng phần
    const monthlyTaxWithheld = calculateMonthlyPIT(assessableIncome);

    return {
      month,
      year,
      periodKey,
      baseSalary,
      salaryAmount,
      beyondFrameAmount,
      leadershipAllowanceAmount,
      publicServiceAllowanceAmount,
      otherIncomeAmount,
      totalGrossIncome,
      nonTaxableIncome,
      taxableIncome,
      compulsoryInsurance,
      personalDeduction,
      dependentCount,
      dependentDeduction,
      otherDeduction,
      totalDeductions,
      assessableIncome,
      monthlyTaxWithheld,
    };
  }

  /**
   * TẦNG 2: TÍNH THUẾ TNCN THEO QUÝ (3 THÁNG / LẦN)
   * Quý I: Tháng 1, 2, 3
   * Quý II: Tháng 4, 5, 6
   * Quý III: Tháng 7, 8, 9 (Tháng 9: MLCS 2.340.000 đ)
   * Quý IV: Tháng 10, 11, 12 (Tháng 10: MLCS 2.530.000 đ + biến động nâng bậc lương cá nhân)
   */
  public static calculateQuarterlyTax(
    employees: Employee[],
    quarter: 1 | 2 | 3 | 4,
    year: number,
    otherIncomesMap?: Map<string, number>
  ): QuarterlyTaxRecord[] {
    const incomesMap = otherIncomesMap || this.getOtherIncomesMap();
    const quarterMonths: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9],
      4: [10, 11, 12],
    };

    const months = quarterMonths[quarter];
    const quarterKey = `Quý ${['I', 'II', 'III', 'IV'][quarter - 1]}/${year}`;

    let sourceEmployees = employees;
    if (!sourceEmployees || sourceEmployees.length === 0) {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('ccty_employees') : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) sourceEmployees = parsed;
        }
      } catch {}
      if (!sourceEmployees || sourceEmployees.length === 0) sourceEmployees = INITIAL_EMPLOYEES;
    }

    const workingStaff = (sourceEmployees || []).filter(e => isWorkingEmployee(e));
    const sortedStaff = sortEmployeesByPriority(
      workingStaff.length > 0 ? workingStaff : sourceEmployees
    );

    return sortedStaff.map(emp => {
      // Tính toán chi tiết từng tháng trong quý (T1, T2, T3) có tích hợp thu nhập khác
      const monthlyDetails = months.map(m => this.calculateMonthlyTaxDetail(emp, m, year, incomesMap));

      // Tổng hợp quý
      const qSalaryAmount = monthlyDetails.reduce((s, m) => s + m.salaryAmount, 0);
      const qBeyondFrameAmount = monthlyDetails.reduce((s, m) => s + m.beyondFrameAmount, 0);
      const qLeadershipAllowanceAmount = monthlyDetails.reduce((s, m) => s + m.leadershipAllowanceAmount, 0);
      const qPublicServiceAllowanceAmount = monthlyDetails.reduce((s, m) => s + m.publicServiceAllowanceAmount, 0);
      const qOtherIncomeAmount = monthlyDetails.reduce((s, m) => s + m.otherIncomeAmount, 0);
      const qTotalGrossIncome = monthlyDetails.reduce((s, m) => s + m.totalGrossIncome, 0);
      const qNonTaxableIncome = monthlyDetails.reduce((s, m) => s + m.nonTaxableIncome, 0);
      const qTaxableIncome = monthlyDetails.reduce((s, m) => s + m.taxableIncome, 0);

      const qCompulsoryInsurance = monthlyDetails.reduce((s, m) => s + m.compulsoryInsurance, 0);
      const qPersonalDeduction = PERSONAL_DEDUCTION_QUARTERLY; // 33.000.000 đ

      // Số người phụ thuộc lớn nhất ghi nhận trong quý
      const maxDependents = Math.max(...monthlyDetails.map(m => m.dependentCount), 0);
      const qDependentDeduction = monthlyDetails.reduce((s, m) => s + m.dependentDeduction, 0);
      const qOtherDeduction = monthlyDetails.reduce((s, m) => s + m.otherDeduction, 0);

      const qTotalDeductions = qCompulsoryInsurance + qPersonalDeduction + qDependentDeduction + qOtherDeduction;
      const qAssessableIncome = Math.max(0, qTaxableIncome - qTotalDeductions);

      // Số thuế đã khấu trừ trong quý = Tổng số thuế 3 tháng
      const qTaxWithheld = monthlyDetails.reduce((s, m) => s + m.monthlyTaxWithheld, 0);

      // Số thuế tính lại theo biểu lũy tiến quý để phục vụ đối soát
      const qQuarterlyTaxPayable = calculateQuarterlyPIT(qAssessableIncome);
      const qTaxDifference = qQuarterlyTaxPayable - qTaxWithheld;

      return {
        employeeId: emp.id,
        employeeCode: emp.code,
        fullName: emp.fullName,
        departmentName: emp.departmentName || '',
        positionTitle: emp.positionTitle || 'Chuyên viên',
        jobRankCode: emp.jobRankCode || emp.salary?.rankCode || '01.003',
        quarter,
        year,
        quarterKey,
        months: monthlyDetails,
        qSalaryAmount,
        qBeyondFrameAmount,
        qLeadershipAllowanceAmount,
        qPublicServiceAllowanceAmount,
        qOtherIncomeAmount,
        qTotalGrossIncome,
        qNonTaxableIncome,
        qTaxableIncome,
        qCompulsoryInsurance,
        qPersonalDeduction,
        dependentCount: maxDependents,
        qDependentDeduction,
        qOtherDeduction,
        qTotalDeductions,
        qAssessableIncome,
        qTaxWithheld,
        qQuarterlyTaxPayable,
        qTaxDifference,
      };
    });
  }

  /**
   * TẦNG 3: TỔNG HỢP QUYẾT TOÁN THUẾ NĂM (QUÝ I + QUÝ II + QUÝ III + QUÝ IV)
   */
  public static calculateAnnualTax(
    employees: Employee[], 
    year: number,
    otherIncomesMap?: Map<string, number>
  ): AnnualTaxRecord[] {
    const incomesMap = otherIncomesMap || this.getOtherIncomesMap();
    const q1List = this.calculateQuarterlyTax(employees, 1, year, incomesMap);
    const q2List = this.calculateQuarterlyTax(employees, 2, year, incomesMap);
    const q3List = this.calculateQuarterlyTax(employees, 3, year, incomesMap);
    const q4List = this.calculateQuarterlyTax(employees, 4, year, incomesMap);

    const qMap1 = new Map(q1List.map(r => [r.employeeCode, r]));
    const qMap2 = new Map(q2List.map(r => [r.employeeCode, r]));
    const qMap3 = new Map(q3List.map(r => [r.employeeCode, r]));
    const qMap4 = new Map(q4List.map(r => [r.employeeCode, r]));

    let sourceEmployees = employees;
    if (!sourceEmployees || sourceEmployees.length === 0) {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('ccty_employees') : null;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) sourceEmployees = parsed;
        }
      } catch {}
      if (!sourceEmployees || sourceEmployees.length === 0) sourceEmployees = INITIAL_EMPLOYEES;
    }

    const workingStaff = (sourceEmployees || []).filter(e => isWorkingEmployee(e));
    const sortedStaff = sortEmployeesByPriority(
      workingStaff.length > 0 ? workingStaff : sourceEmployees
    );

    return sortedStaff.map(emp => {
      const q1 = qMap1.get(emp.code);
      const q2 = qMap2.get(emp.code);
      const q3 = qMap3.get(emp.code);
      const q4 = qMap4.get(emp.code);

      const q1Tax = q1?.qTaxWithheld || 0;
      const q2Tax = q2?.qTaxWithheld || 0;
      const q3Tax = q3?.qTaxWithheld || 0;
      const q4Tax = q4?.qTaxWithheld || 0;

      const annualGrossIncome = (q1?.qTotalGrossIncome || 0) + (q2?.qTotalGrossIncome || 0) + (q3?.qTotalGrossIncome || 0) + (q4?.qTotalGrossIncome || 0);
      const annualTaxableIncome = (q1?.qTaxableIncome || 0) + (q2?.qTaxableIncome || 0) + (q3?.qTaxableIncome || 0) + (q4?.qTaxableIncome || 0);
      const annualInsuranceDeduction = (q1?.qCompulsoryInsurance || 0) + (q2?.qCompulsoryInsurance || 0) + (q3?.qCompulsoryInsurance || 0) + (q4?.qCompulsoryInsurance || 0);

      const maxDep = Math.max(q1?.dependentCount || 0, q2?.dependentCount || 0, q3?.dependentCount || 0, q4?.dependentCount || 0);
      const annualPersonalDeduction = PERSONAL_DEDUCTION_ANNUAL; // 132 triệu
      const annualDependentDeduction = (q1?.qDependentDeduction || 0) + (q2?.qDependentDeduction || 0) + (q3?.qDependentDeduction || 0) + (q4?.qDependentDeduction || 0);

      const annualTotalDeductions = annualInsuranceDeduction + annualPersonalDeduction + annualDependentDeduction;
      const annualAssessableIncome = Math.max(0, annualTaxableIncome - annualTotalDeductions);

      // Thuế tính theo biểu quyết toán năm
      const annualTaxPayable = calculateAnnualPIT(annualAssessableIncome);
      const annualTaxWithheld = q1Tax + q2Tax + q3Tax + q4Tax;
      const annualTaxBalance = annualTaxPayable - annualTaxWithheld;

      return {
        employeeId: emp.id,
        employeeCode: emp.code,
        fullName: emp.fullName,
        departmentName: emp.departmentName || '',
        positionTitle: emp.positionTitle || 'Chuyên viên',
        year,
        dependentCount: maxDep,
        q1TaxWithheld: q1Tax,
        q2TaxWithheld: q2Tax,
        q3TaxWithheld: q3Tax,
        q4TaxWithheld: q4Tax,
        annualGrossIncome,
        annualTaxableIncome,
        annualInsuranceDeduction,
        annualPersonalDeduction,
        annualDependentDeduction,
        annualTotalDeductions,
        annualAssessableIncome,
        annualTaxPayable,
        annualTaxWithheld,
        annualTaxBalance,
      };
    });
  }

  /**
   * Xuất toàn bộ hồ sơ thuế ra file Excel 6 Sheet chuyên nghiệp
   */
  public static exportTaxToExcel(
    quarter: 1 | 2 | 3 | 4,
    year: number,
    quarterlyRecords: QuarterlyTaxRecord[],
    annualRecords: AnnualTaxRecord[],
    dependents: TaxDependent[],
    otherIncomes?: OtherIncomeItem[]
  ): void {
    const wb = XLSX.utils.book_new();
    const qStr = `Quý ${['I', 'II', 'III', 'IV'][quarter - 1]} năm ${year}`;

    // ==========================================
    // Sheet 1: NguoiPhuThuoc
    // ==========================================
    const depRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['DANH SÁCH ĐĂNG KÝ NGƯỜI PHỤ THUỘC GIẢM TRỪ GIA CẢNH'],
      [`Cập nhật đến: ${qStr} | Tổng số người phụ thuộc: ${dependents.length}`],
      [],
      [
        'STT',
        'Mã Nhân Viên',
        'Họ và Tên Cán Bộ',
        'Họ và Tên Người Phụ Thuộc',
        'Mối Quan Hệ',
        'Ngày Sinh NPT',
        'Số CCCD / MST NPT',
        'Thời Điểm Bắt Đầu',
        'Thời Điểm Kết Thúc',
        'Mức Giảm Trừ / Tháng (VNĐ)',
        'Ghi Chú',
      ],
    ];

    dependents.forEach((d, idx) => {
      depRows.push([
        idx + 1,
        d.employeeCode,
        d.employeeName,
        d.dependentName,
        d.relationship,
        d.dob,
        d.idCardOrTaxCode,
        d.startDate,
        d.endDate || 'Đang hiệu lực',
        d.deductionMonthlyAmount,
        d.notes || '',
      ]);
    });

    const wsDep = XLSX.utils.aoa_to_sheet(depRows);
    XLSX.utils.book_append_sheet(wb, wsDep, 'NguoiPhuThuoc');

    // ==========================================
    // Sheet 2: ThuNhap_Khac (MỚI)
    // ==========================================
    const otherIncs = otherIncomes || this.getOtherIncomes();
    const otherIncomeRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['DANH SÁCH CHI TIẾT CÁC KHOẢN THU NHẬP KHÁC (THEO THÁNG & LŨY KẾ)'],
      [`Tổng số khoản thu nhập: ${otherIncs.length} mục | Dùng gom theo Quý & Năm`],
      [],
      [
        'STT',
        'Tháng',
        'Năm',
        'Kỳ (MM/YYYY)',
        'Mã Nhân Viên',
        'Họ và Tên Nhân Viên',
        'Phòng Ban / Đơn Vị',
        'Nội Dung Thu Nhập',
        'Số Tiền (VNĐ)',
        'Tính Thuế TNCN',
        'Nguồn Dữ Liệu',
        'Ghi Chú',
      ],
    ];

    otherIncs.forEach((item, idx) => {
      otherIncomeRows.push([
        idx + 1,
        item.month,
        item.year,
        item.periodKey || `${String(item.month).padStart(2, '0')}/${item.year}`,
        item.employeeCode,
        item.employeeName,
        item.departmentName || '',
        item.description,
        item.amount,
        item.taxable !== false ? 'Có' : 'Miễn',
        item.source === 'IMPORT_EXCEL' ? 'Tải từ Excel' : 'Nhập tay',
        item.notes || '',
      ]);
    });

    const wsOtherInc = XLSX.utils.aoa_to_sheet(otherIncomeRows);
    XLSX.utils.book_append_sheet(wb, wsOtherInc, 'ThuNhap_Khac');

    // ==========================================
    // Sheet 3: ThongKe_ThuNhap_Quy
    // ==========================================
    const qMonths = quarter === 1 ? [1, 2, 3] : quarter === 2 ? [4, 5, 6] : quarter === 3 ? [7, 8, 9] : [10, 11, 12];
    const incomeRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG THỐNG KÊ CHI TIẾT CÁC KHOẢN THU NHẬP - ${qStr.toUpperCase()}`],
      [`Mức lương cơ sở: Tháng ${qMonths[0]} (${quarterlyRecords[0]?.months[0]?.baseSalary.toLocaleString('vi-VN')} đ), Tháng ${qMonths[1]} (${quarterlyRecords[0]?.months[1]?.baseSalary.toLocaleString('vi-VN')} đ), Tháng ${qMonths[2]} (${quarterlyRecords[0]?.months[2]?.baseSalary.toLocaleString('vi-VN')} đ)`],
      [],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban / Đơn Vị',
        'Chức Danh',
        `Thu Nhập Tháng ${qMonths[0]} (VNĐ)`,
        `Thu Nhập Tháng ${qMonths[1]} (VNĐ)`,
        `Thu Nhập Tháng ${qMonths[2]} (VNĐ)`,
        'Tổng Lương HSL Cả Quý (VNĐ)',
        'Phụ Cấp Thâm Niên VK (VNĐ)',
        'Phụ Cấp Chức Vụ (VNĐ)',
        'Phụ Cấp Công Vụ (VNĐ)',
        'Thu Nhập Khác (VNĐ)',
        'Khoản Miễn / Không Chịu Thuế (VNĐ)',
        'TỔNG THU NHẬP QUÝ (VNĐ)',
        'THU NHẬP CHỊU THUẾ QUÝ (VNĐ)',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      incomeRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.positionTitle,
        r.months[0]?.totalGrossIncome || 0,
        r.months[1]?.totalGrossIncome || 0,
        r.months[2]?.totalGrossIncome || 0,
        r.qSalaryAmount,
        r.qBeyondFrameAmount,
        r.qLeadershipAllowanceAmount,
        r.qPublicServiceAllowanceAmount,
        r.qOtherIncomeAmount,
        r.qNonTaxableIncome,
        r.qTotalGrossIncome,
        r.qTaxableIncome,
      ]);
    });

    if (quarterlyRecords.length > 0) {
      incomeRows.push([
        'TỔNG CỘNG',
        '',
        `${quarterlyRecords.length} cán bộ`,
        '',
        '',
        quarterlyRecords.reduce((s, r) => s + (r.months[0]?.totalGrossIncome || 0), 0),
        quarterlyRecords.reduce((s, r) => s + (r.months[1]?.totalGrossIncome || 0), 0),
        quarterlyRecords.reduce((s, r) => s + (r.months[2]?.totalGrossIncome || 0), 0),
        quarterlyRecords.reduce((s, r) => s + r.qSalaryAmount, 0),
        quarterlyRecords.reduce((s, r) => s + r.qBeyondFrameAmount, 0),
        quarterlyRecords.reduce((s, r) => s + r.qLeadershipAllowanceAmount, 0),
        quarterlyRecords.reduce((s, r) => s + r.qPublicServiceAllowanceAmount, 0),
        quarterlyRecords.reduce((s, r) => s + r.qOtherIncomeAmount, 0),
        quarterlyRecords.reduce((s, r) => s + r.qNonTaxableIncome, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTotalGrossIncome, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTaxableIncome, 0),
      ]);
    }

    const wsIncome = XLSX.utils.aoa_to_sheet(incomeRows);
    XLSX.utils.book_append_sheet(wb, wsIncome, 'ThongKe_ThuNhap_Quy');

    // ==========================================
    // Sheet 3: TinhThue_TNCN_Quy
    // ==========================================
    const taxRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN THEO QUÝ - ${qStr.toUpperCase()}`],
      [`Giảm trừ bản thân: 33.000.000 đ/quý | Giảm trừ NPT: 13.200.000 đ/người/quý`],
      [],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Tổng Thu Nhập Quý (VNĐ)',
        'Thu Nhập Chịu Thuế (VNĐ)',
        'Bảo Hiểm Bắt Buộc (VNĐ)',
        'Giảm Trừ Bản Thân (VNĐ)',
        'Số NPT',
        'Giảm Trừ NPT (VNĐ)',
        'Tổng Các Khoản Giảm Trừ (VNĐ)',
        'Thu Nhập Tính Thuế Quý (VNĐ)',
        'Số Thuế Đã Khấu Trừ Trong Quý (VNĐ)',
        'Số Thuế Tính Theo Quý (VNĐ)',
        'Chênh Lệch Đối Soát (VNĐ)',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      taxRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.qTotalGrossIncome,
        r.qTaxableIncome,
        r.qCompulsoryInsurance,
        r.qPersonalDeduction,
        r.dependentCount,
        r.qDependentDeduction,
        r.qTotalDeductions,
        r.qAssessableIncome,
        r.qTaxWithheld,
        r.qQuarterlyTaxPayable,
        r.qTaxDifference,
      ]);
    });

    if (quarterlyRecords.length > 0) {
      taxRows.push([
        'TỔNG CỘNG',
        '',
        `${quarterlyRecords.length} cán bộ`,
        '',
        quarterlyRecords.reduce((s, r) => s + r.qTotalGrossIncome, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTaxableIncome, 0),
        quarterlyRecords.reduce((s, r) => s + r.qCompulsoryInsurance, 0),
        quarterlyRecords.reduce((s, r) => s + r.qPersonalDeduction, 0),
        '',
        quarterlyRecords.reduce((s, r) => s + r.qDependentDeduction, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTotalDeductions, 0),
        quarterlyRecords.reduce((s, r) => s + r.qAssessableIncome, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTaxWithheld, 0),
        quarterlyRecords.reduce((s, r) => s + r.qQuarterlyTaxPayable, 0),
        quarterlyRecords.reduce((s, r) => s + r.qTaxDifference, 0),
      ]);
    }

    const wsTax = XLSX.utils.aoa_to_sheet(taxRows);
    XLSX.utils.book_append_sheet(wb, wsTax, 'TinhThue_TNCN_Quy');

    // ==========================================
    // Sheet 4: BangKe_ChiTiet_3Thang
    // ==========================================
    const detailRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG KÊ CHI TIẾT THU NHẬP VÀ THUẾ KHẤU TRỪ TỪNG THÁNG - ${qStr.toUpperCase()}`],
      [`Mô hình đối chiếu: T${qMonths[0]} + T${qMonths[1]} + T${qMonths[2]} = Tổng Quý`],
      [],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        `Thu Nhập T${qMonths[0]}`,
        `Thuế KT T${qMonths[0]}`,
        `Thu Nhập T${qMonths[1]}`,
        `Thuế KT T${qMonths[1]}`,
        `Thu Nhập T${qMonths[2]}`,
        `Thuế KT T${qMonths[2]}`,
        'Tổng Thu Nhập Quý (VNĐ)',
        'TỔNG THUẾ ĐÃ KHẤU TRỪ QUÝ (VNĐ)',
        'Ghi Chú Biến Động Lương / Thuế',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      detailRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.months[0]?.totalGrossIncome || 0,
        r.months[0]?.monthlyTaxWithheld || 0,
        r.months[1]?.totalGrossIncome || 0,
        r.months[1]?.monthlyTaxWithheld || 0,
        r.months[2]?.totalGrossIncome || 0,
        r.months[2]?.monthlyTaxWithheld || 0,
        r.qTotalGrossIncome,
        r.qTaxWithheld,
        r.months[0]?.baseSalary !== r.months[2]?.baseSalary ? `Đổi MLCS (${r.months[0]?.baseSalary.toLocaleString('vi-VN')} -> ${r.months[2]?.baseSalary.toLocaleString('vi-VN')} đ)` : 'Ổn định',
      ]);
    });

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'BangKe_ChiTiet_3Thang');

    // ==========================================
    // Sheet 5: QuyetToan_Nam
    // ==========================================
    const annualRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`TỔNG HỢP QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN CẢ NĂM ${year}`],
      [`Mô hình tổng hợp: Quý I + Quý II + Quý III + Quý IV -> Quyết toán năm`],
      [],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Số NPT',
        'Thuế TNCN Quý I',
        'Thuế TNCN Quý II',
        'Thuế TNCN Quý III',
        'Thuế TNCN Quý IV',
        'Tổng Thuế Đã Tạm Nộp (VNĐ)',
        'Tổng Thu Nhập Cả Năm (VNĐ)',
        'Thu Nhập Chịu Thuế Năm (VNĐ)',
        'Tổng Các Khoản Giảm Trừ Năm (VNĐ)',
        'Thu Nhập Tính Thuế Năm (VNĐ)',
        'Thuế Phải Nộp Theo Quyết Toán Năm (VNĐ)',
        'Chênh Lệch (+ Nộp thêm, - Nộp thừa)',
      ],
    ];

    annualRecords.forEach((a, idx) => {
      annualRows.push([
        idx + 1,
        a.employeeCode,
        a.fullName,
        a.departmentName,
        a.dependentCount,
        a.q1TaxWithheld,
        a.q2TaxWithheld,
        a.q3TaxWithheld,
        a.q4TaxWithheld,
        a.annualTaxWithheld,
        a.annualGrossIncome,
        a.annualTaxableIncome,
        a.annualTotalDeductions,
        a.annualAssessableIncome,
        a.annualTaxPayable,
        a.annualTaxBalance,
      ]);
    });

    const wsAnnual = XLSX.utils.aoa_to_sheet(annualRows);
    XLSX.utils.book_append_sheet(wb, wsAnnual, 'QuyetToan_Nam');

    const fileName = `Ho_So_Thue_TNCN_${qStr.replace(/[^a-zA-Z0-9]/g, '_')}_ChiCucThuY.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  /**
   * ĐỒNG BỘ TOÀN BỘ HỆ THỐNG THUẾ TNCN LÊN GOOGLE SHEETS
   * Tạo 6 Sheet riêng biệt theo đúng yêu cầu:
   * 1. NguoiPhuThuoc
   * 2. ThuNhap_Khac (Mới)
   * 3. ThongKe_ThuNhap_Quy
   * 4. TinhThue_TNCN_Quy
   * 5. BangKe_ChiTiet_3Thang
   * 6. QuyetToan_Nam
   */
  public static async syncTaxToGoogleSheets(
    quarter: 1 | 2 | 3 | 4,
    year: number,
    quarterlyRecords: QuarterlyTaxRecord[],
    annualRecords: AnnualTaxRecord[],
    dependents: TaxDependent[],
    otherIncomes?: OtherIncomeItem[]
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string; totalSynced: number }> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập Google để đồng bộ.');
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Tìm hoặc tạo file Spreadsheet chuyên biệt cho Quản lý Thuế TNCN
    const searchQ = `name = '${TAX_SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQ)}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc`;

    let spreadsheetId = '';
    let spreadsheetUrl = '';

    const searchRes = await fetch(searchUrl, { headers });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        spreadsheetId = searchData.files[0].id;
        spreadsheetUrl = searchData.files[0].webViewLink;
      }
    }

    const requiredSheets = [
      'NguoiPhuThuoc',
      'ThuNhap_Khac',
      'ThongKe_ThuNhap_Quy',
      'TinhThue_TNCN_Quy',
      'BangKe_ChiTiet_3Thang',
      'QuyetToan_Nam',
    ];

    if (!spreadsheetId) {
      const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: {
            title: TAX_SPREADSHEET_TITLE,
          },
          sheets: requiredSheets.map(title => ({
            properties: { title, gridProperties: { frozenRowCount: 4 } },
          })),
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Không thể khởi tạo Google Spreadsheet thuế TNCN: ${errText}`);
      }

      const createData = await createRes.json();
      spreadsheetId = createData.spreadsheetId;
      spreadsheetUrl = createData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    }

    // Đảm bảo đủ các sheet
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, { headers });
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const existingTitles = new Set<string>((metaData.sheets || []).map((s: any) => s.properties?.title));
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

        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ requests: addRequests }),
        });
      }
    }

    const qStr = `Quý ${['I', 'II', 'III', 'IV'][quarter - 1]} năm ${year}`;
    const qMonths = quarter === 1 ? [1, 2, 3] : quarter === 2 ? [4, 5, 6] : quarter === 3 ? [7, 8, 9] : [10, 11, 12];

    // Ghi dữ liệu vào từng Sheet riêng biệt
    // ==========================================
    // 1. Sheet NguoiPhuThuoc
    // ==========================================
    const depRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['DANH SÁCH ĐĂNG KÝ NGƯỜI PHỤ THUỘC GIẢM TRỪ GIA CẢNH'],
      [`Cập nhật đến: ${qStr} | Tổng số người phụ thuộc: ${dependents.length}`],
      [
        'STT',
        'Mã Nhân Viên',
        'Họ và Tên Cán Bộ',
        'Họ và Tên Người Phụ Thuộc',
        'Mối Quan Hệ',
        'Ngày Sinh NPT',
        'Số CCCD / MST NPT',
        'Thời Điểm Bắt Đầu',
        'Thời Điểm Kết Thúc',
        'Mức Giảm Trừ / Tháng (VNĐ)',
        'Ghi Chú',
      ],
    ];
    dependents.forEach((d, idx) => {
      depRows.push([
        idx + 1,
        d.employeeCode,
        d.employeeName,
        d.dependentName,
        d.relationship,
        d.dob,
        d.idCardOrTaxCode,
        d.startDate,
        d.endDate || 'Đang hiệu lực',
        d.deductionMonthlyAmount,
        d.notes || '',
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'NguoiPhuThuoc'!A1:K1000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'NguoiPhuThuoc'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: depRows }),
    });

    // ==========================================
    // 2. Sheet ThuNhap_Khac (MỚI)
    // ==========================================
    const otherIncs = otherIncomes || this.getOtherIncomes();
    const otherIncomeRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      ['DANH SÁCH CHI TIẾT CÁC KHOẢN THU NHẬP KHÁC (THEO THÁNG & LŨY KẾ)'],
      [`Tổng số khoản thu nhập: ${otherIncs.length} mục | Dùng gom theo Quý & Năm`],
      [
        'STT',
        'Tháng',
        'Năm',
        'Kỳ (MM/YYYY)',
        'Mã Nhân Viên',
        'Họ và Tên Nhân Viên',
        'Phòng Ban / Đơn Vị',
        'Nội Dung Thu Nhập',
        'Số Tiền (VNĐ)',
        'Tính Thuế TNCN',
        'Nguồn Dữ Liệu',
        'Ghi Chú',
      ],
    ];

    otherIncs.forEach((item, idx) => {
      otherIncomeRows.push([
        idx + 1,
        item.month,
        item.year,
        item.periodKey || `${String(item.month).padStart(2, '0')}/${item.year}`,
        item.employeeCode,
        item.employeeName,
        item.departmentName || '',
        item.description,
        item.amount,
        item.taxable !== false ? 'Có' : 'Miễn',
        item.source === 'IMPORT_EXCEL' ? 'Tải từ Excel' : 'Nhập tay',
        item.notes || '',
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'ThuNhap_Khac'!A1:L3000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'ThuNhap_Khac'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: otherIncomeRows }),
    });

    // ==========================================
    // 2. Sheet ThongKe_ThuNhap_Quy
    // ==========================================
    const incomeRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG THỐNG KÊ CHI TIẾT CÁC KHOẢN THU NHẬP - ${qStr.toUpperCase()}`],
      [`Mức lương cơ sở: Tháng ${qMonths[0]} (${quarterlyRecords[0]?.months[0]?.baseSalary.toLocaleString('vi-VN')} đ), Tháng ${qMonths[1]} (${quarterlyRecords[0]?.months[1]?.baseSalary.toLocaleString('vi-VN')} đ), Tháng ${qMonths[2]} (${quarterlyRecords[0]?.months[2]?.baseSalary.toLocaleString('vi-VN')} đ)`],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban / Đơn Vị',
        'Chức Danh',
        `Thu Nhập Tháng ${qMonths[0]} (VNĐ)`,
        `Thu Nhập Tháng ${qMonths[1]} (VNĐ)`,
        `Thu Nhập Tháng ${qMonths[2]} (VNĐ)`,
        'Tổng Lương HSL Cả Quý (VNĐ)',
        'Phụ Cấp Thâm Niên VK (VNĐ)',
        'Phụ Cấp Chức Vụ (VNĐ)',
        'Phụ Cấp Công Vụ (VNĐ)',
        'Thu Nhập Khác (VNĐ)',
        'Khoản Miễn / Không Chịu Thuế (VNĐ)',
        'TỔNG THU NHẬP QUÝ (VNĐ)',
        'THU NHẬP CHỊU THUẾ QUÝ (VNĐ)',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      incomeRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.positionTitle,
        r.months[0]?.totalGrossIncome || 0,
        r.months[1]?.totalGrossIncome || 0,
        r.months[2]?.totalGrossIncome || 0,
        r.qSalaryAmount,
        r.qBeyondFrameAmount,
        r.qLeadershipAllowanceAmount,
        r.qPublicServiceAllowanceAmount,
        r.qOtherIncomeAmount,
        r.qNonTaxableIncome,
        r.qTotalGrossIncome,
        r.qTaxableIncome,
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'ThongKe_ThuNhap_Quy'!A1:P2000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'ThongKe_ThuNhap_Quy'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: incomeRows }),
    });

    // ==========================================
    // 3. Sheet TinhThue_TNCN_Quy
    // ==========================================
    const taxRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN THEO QUÝ - ${qStr.toUpperCase()}`],
      [`Giảm trừ bản thân: 33.000.000 đ/quý | Giảm trừ NPT: 13.200.000 đ/người/quý`],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Tổng Thu Nhập Quý (VNĐ)',
        'Thu Nhập Chịu Thuế (VNĐ)',
        'Bảo Hiểm Bắt Buộc (VNĐ)',
        'Giảm Trừ Bản Thân (VNĐ)',
        'Số NPT',
        'Giảm Trừ NPT (VNĐ)',
        'Tổng Các Khoản Giảm Trừ (VNĐ)',
        'Thu Nhập Tính Thuế Quý (VNĐ)',
        'Số Thuế Đã Khấu Trừ Trong Quý (VNĐ)',
        'Số Thuế Tính Theo Quý (VNĐ)',
        'Chênh Lệch Đối Soát (VNĐ)',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      taxRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.qTotalGrossIncome,
        r.qTaxableIncome,
        r.qCompulsoryInsurance,
        r.qPersonalDeduction,
        r.dependentCount,
        r.qDependentDeduction,
        r.qTotalDeductions,
        r.qAssessableIncome,
        r.qTaxWithheld,
        r.qQuarterlyTaxPayable,
        r.qTaxDifference,
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TinhThue_TNCN_Quy'!A1:O2000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'TinhThue_TNCN_Quy'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: taxRows }),
    });

    // ==========================================
    // 4. Sheet BangKe_ChiTiet_3Thang
    // ==========================================
    const detailRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`BẢNG KÊ CHI TIẾT THU NHẬP VÀ THUẾ KHẤU TRỪ TỪNG THÁNG - ${qStr.toUpperCase()}`],
      [`Mô hình đối chiếu: T${qMonths[0]} + T${qMonths[1]} + T${qMonths[2]} = Tổng Quý`],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        `Thu Nhập T${qMonths[0]}`,
        `Thuế KT T${qMonths[0]}`,
        `Thu Nhập T${qMonths[1]}`,
        `Thuế KT T${qMonths[1]}`,
        `Thu Nhập T${qMonths[2]}`,
        `Thuế KT T${qMonths[2]}`,
        'Tổng Thu Nhập Quý (VNĐ)',
        'TỔNG THUẾ ĐÃ KHẤU TRỪ QUÝ (VNĐ)',
        'Ghi Chú Biến Động Lương / Thuế',
      ],
    ];

    quarterlyRecords.forEach((r, idx) => {
      detailRows.push([
        idx + 1,
        r.employeeCode,
        r.fullName,
        r.departmentName,
        r.months[0]?.totalGrossIncome || 0,
        r.months[0]?.monthlyTaxWithheld || 0,
        r.months[1]?.totalGrossIncome || 0,
        r.months[1]?.monthlyTaxWithheld || 0,
        r.months[2]?.totalGrossIncome || 0,
        r.months[2]?.monthlyTaxWithheld || 0,
        r.qTotalGrossIncome,
        r.qTaxWithheld,
        r.months[0]?.baseSalary !== r.months[2]?.baseSalary ? `Đổi MLCS (${r.months[0]?.baseSalary.toLocaleString('vi-VN')} -> ${r.months[2]?.baseSalary.toLocaleString('vi-VN')} đ)` : 'Ổn định',
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'BangKe_ChiTiet_3Thang'!A1:M2000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'BangKe_ChiTiet_3Thang'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: detailRows }),
    });

    // ==========================================
    // 5. Sheet QuyetToan_Nam
    // ==========================================
    const annualRows: (string | number)[][] = [
      ['CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH'],
      [`TỔNG HỢP QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN CẢ NĂM ${year}`],
      [`Mô hình tổng hợp: Quý I + Quý II + Quý III + Quý IV -> Quyết toán năm`],
      [
        'STT',
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Số NPT',
        'Thuế TNCN Quý I',
        'Thuế TNCN Quý II',
        'Thuế TNCN Quý III',
        'Thuế TNCN Quý IV',
        'Tổng Thuế Đã Tạm Nộp (VNĐ)',
        'Tổng Thu Nhập Cả Năm (VNĐ)',
        'Thu Nhập Chịu Thuế Năm (VNĐ)',
        'Tổng Các Khoản Giảm Trừ Năm (VNĐ)',
        'Thu Nhập Tính Thuế Năm (VNĐ)',
        'Thuế Phải Nộp Theo Quyết Toán Năm (VNĐ)',
        'Chênh Lệch (+ Nộp thêm, - Nộp thừa)',
      ],
    ];

    annualRecords.forEach((a, idx) => {
      annualRows.push([
        idx + 1,
        a.employeeCode,
        a.fullName,
        a.departmentName,
        a.dependentCount,
        a.q1TaxWithheld,
        a.q2TaxWithheld,
        a.q3TaxWithheld,
        a.q4TaxWithheld,
        a.annualTaxWithheld,
        a.annualGrossIncome,
        a.annualTaxableIncome,
        a.annualTotalDeductions,
        a.annualAssessableIncome,
        a.annualTaxPayable,
        a.annualTaxBalance,
      ]);
    });

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'QuyetToan_Nam'!A1:P2000:clear`, { method: 'POST', headers });
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'QuyetToan_Nam'!A1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: annualRows }),
    });

    return {
      spreadsheetId,
      spreadsheetUrl,
      totalSynced: quarterlyRecords.length,
    };
  }
}
