import { getAccessToken } from './firebaseAuth';
import { Employee, WorkHistoryRecord, SalaryHistoryRecord, TrainingRecord, RewardDisciplineRecord, AuditLog, Department } from '../types/hrm';
import { formatDateVN, toISODate } from '../utils/dateUtils';
import { ExcelImportService } from './excelImportService';
import { INITIAL_DEPARTMENTS } from '../data/initialData';
import { parseBaseSalary, parseDecimalNumber, formatDecimal, DEFAULT_BASE_SALARY } from '../utils/salaryUtils';

export const SPREADSHEET_TITLE = 'Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự';

/**
 * Chuẩn hóa và đọc số từ ô dữ liệu bảng tính (hỗ trợ cả dấu phẩy 2,34 và dấu chấm 2.34)
 */
export function parseSalaryNumber(val: any, fallback = 0): number {
  return parseDecimalNumber(val, fallback);
}

function normalizeHeader(val: any): string {
  if (!val) return '';
  return String(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SyncDiagnosisReport {
  authOk: boolean;
  userEmail?: string;
  apiOk: boolean;
  sheetFound: boolean;
  sheetId?: string;
  sheetTitle?: string;
  sheetUrl?: string;
  availableTabs: string[];
  detectedDataTab?: string;
  rowCount: number;
  sampleRows?: string[];
  issues: string[];
  suggestions: string[];
}

export class GoogleSheetsService {
  private static readonly ACTIVE_SHEET_KEY = 'ccty_active_spreadsheet_id';

  /**
   * Lấy mã Spreadsheet ID đã lưu hoặc tùy chỉnh của người dùng
   */
  public static getSavedSpreadsheetId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.ACTIVE_SHEET_KEY) || null;
  }

  /**
   * Lưu mã Spreadsheet ID hoặc link Google Sheets do người dùng cung cấp
   */
  public static setSavedSpreadsheetId(idOrUrl: string): string {
    const extracted = this.extractSpreadsheetId(idOrUrl);
    if (typeof window !== 'undefined' && extracted) {
      localStorage.setItem(this.ACTIVE_SHEET_KEY, extracted);
    }
    return extracted;
  }

  /**
   * Trích xuất ID bảng tính từ URL đầy đủ hoặc chuỗi ID
   */
  public static extractSpreadsheetId(input: string): string {
    if (!input) return '';
    const trimmed = input.trim();
    // Khớp mẫu URL dạng /spreadsheets/d/ID hoặc /d/ID
    const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/) || trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Khớp mẫu id=ID hoặc key=ID
    const paramMatch = trimmed.match(/[?&](?:id|key)=([a-zA-Z0-9-_]+)/);
    if (paramMatch && paramMatch[1]) {
      return paramMatch[1];
    }
    // Hoặc chuỗi ID trực tiếp (chữ và số từ 15 ký tự trở lên)
    const idMatch = trimmed.match(/^([a-zA-Z0-9-_]{15,})/);
    if (idMatch && idMatch[1]) {
      return idMatch[1];
    }
    return trimmed;
  }

  /**
   * Liệt kê tất cả các file Google Sheets có trong Drive của tài khoản (bao gồm cả file được chia sẻ)
   */
  public static async listUserSpreadsheets(): Promise<Array<{ id: string; title: string; url: string; modifiedTime?: string }>> {
    try {
      const headers = await this.getHeaders();
      const q = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc&pageSize=25`;
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        title: f.name || 'Bảng tính Google Sheet',
        url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
        modifiedTime: f.modifiedTime,
      }));
    } catch (e) {
      console.warn('Lỗi liệt kê bảng tính Drive:', e);
      return [];
    }
  }

  private static async getHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn. Vui lòng kết nối tài khoản Google.');
    }
    const cleanToken = token.trim();
    const bearer = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
    return {
      Authorization: bearer,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Đảm bảo tất cả các tab cần thiết đều tồn tại trong bảng tính Google Sheets
   * (Chỉ dùng khi đẩy dữ liệu lên Sheets để tạo khung bảng tính chuẩn)
   */
  public static async ensureRequiredTabs(spreadsheetId: string): Promise<void> {
    const headers = await this.getHeaders();
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
    const res = await fetch(metaUrl, { headers });
    if (!res.ok) return;

    const data = await res.json();
    const existingTitles = new Set<string>((data.sheets || []).map((s: any) => s.properties?.title));

    const requiredTabs = [
      'DS_NhanSu',
      'QuaTrinhCongTac',
      'LichSuLuong',
      'DaoTaoBoiDuong',
      'KhenThuongKyLuat',
      'DanhMuc_PhongBan',
      'NhatKyAuditLog',
    ];

    const missingTabs = requiredTabs.filter(t => !existingTitles.has(t));
    if (missingTabs.length === 0) return;

    const requests = missingTabs.map(title => ({
      addSheet: {
        properties: {
          title,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    }));

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    await fetch(updateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
    });
  }

  /**
   * Tìm kiếm hoặc kết nối file Google Sheets trong Drive:
   * 1. Ưu tiên kiểm tra Spreadsheet ID đã lưu/tùy chỉnh của người dùng
   * 2. Tìm kiếm chính xác theo tiêu đề chuẩn
   * 3. Tìm kiếm mở rộng (Fuzzy Drive search) theo từ khóa liên quan
   * 4. Chỉ tạo mới khi không tìm thấy bất kỳ bảng tính nào
   */
  public static async getOrCreateSpreadsheet(preferredId?: string): Promise<{ id: string; url: string; title: string }> {
    const headers = await this.getHeaders();
    const targetId = preferredId || this.getSavedSpreadsheetId();

    // 1. Kiểm tra preferred ID nếu có
    if (targetId) {
      try {
        const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=properties(title,spreadsheetId)`;
        const checkRes = await fetch(checkUrl, { headers });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const title = checkData.properties?.title || SPREADSHEET_TITLE;
          this.setSavedSpreadsheetId(targetId);
          return {
            id: targetId,
            url: `https://docs.google.com/spreadsheets/d/${targetId}/edit`,
            title,
          };
        }
      } catch (e) {
        console.warn('Không thể mở Spreadsheet ID tùy chỉnh, chuyển sang tìm kiếm Drive:', e);
      }
    }
    
    // 2. Tìm kiếm chính xác theo tên qua Drive API v3
    try {
      const qExact = `name = '${SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const searchExactUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qExact)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc`;
      const searchRes = await fetch(searchExactUrl, { headers });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          const file = searchData.files[0];
          this.setSavedSpreadsheetId(file.id);
          return {
            id: file.id,
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
            title: file.name,
          };
        }
      }
    } catch (e) {
      console.warn('Lỗi tìm kiếm chính xác Drive:', e);
    }

    // 3. Tìm kiếm mở rộng (Fuzzy Search)
    try {
      const qFuzzy = `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and (name contains 'Chi Cục' or name contains 'Chăn Nuôi' or name contains 'Quản Lý Nhân Sự' or name contains 'Nhân Sự' or name contains 'Cơ Sở Dữ Liệu' or name contains 'BANG LUONG' or name contains 'Thú Y' or name contains 'Công Chức')`;
      const searchFuzzyUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qFuzzy)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc&pageSize=15`;
      const fuzzyRes = await fetch(searchFuzzyUrl, { headers });
      if (fuzzyRes.ok) {
        const fuzzyData = await fuzzyRes.json();
        if (fuzzyData.files && fuzzyData.files.length > 0) {
          const file = fuzzyData.files[0];
          this.setSavedSpreadsheetId(file.id);
          return {
            id: file.id,
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
            title: file.name,
          };
        }
      }
    } catch (e) {
      console.warn('Lỗi tìm kiếm mở rộng Drive:', e);
    }

    // 4. Tìm bất kỳ bảng tính Google Sheets nào trong Drive của người dùng
    try {
      const qAny = `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const searchAnyUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qAny)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc&pageSize=10`;
      const anyRes = await fetch(searchAnyUrl, { headers });
      if (anyRes.ok) {
        const anyData = await anyRes.json();
        if (anyData.files && anyData.files.length > 0) {
          const file = anyData.files[0];
          this.setSavedSpreadsheetId(file.id);
          return {
            id: file.id,
            url: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
            title: file.name,
          };
        }
      }
    } catch (e) {
      console.warn('Lỗi tìm kiếm bất kỳ bảng tính:', e);
    }

    // 5. Nếu hoàn toàn chưa có, tạo mới bảng tính Google Sheets với các tab chuẩn
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const payload = {
      properties: {
        title: SPREADSHEET_TITLE,
      },
      sheets: [
        { properties: { title: 'DS_NhanSu', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'QuaTrinhCongTac', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'LichSuLuong', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'DaoTaoBoiDuong', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'KhenThuongKyLuat', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'DanhMuc_PhongBan', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'NhatKyAuditLog', gridProperties: { frozenRowCount: 1 } } },
      ],
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Không thể tạo mới file Google Sheets trên tài khoản Google.');
    }

    const createdData = await createRes.json();
    const newId = createdData.spreadsheetId;
    this.setSavedSpreadsheetId(newId);
    return {
      id: newId,
      url: createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}/edit`,
      title: SPREADSHEET_TITLE,
    };
  }

  /**
   * Đẩy toàn bộ dữ liệu nhân sự lên Google Sheets (Sync to Google Sheets)
   */
  public static async syncAllDataToSheets(
    spreadsheetId: string,
    employees: Employee[],
    auditLogs: AuditLog[] = [],
    departments?: Department[],
    selectedTabs: string[] = ['DS_NhanSu', 'QuaTrinhCongTac', 'LichSuLuong', 'DaoTaoBoiDuong', 'NhatKyAuditLog']
  ): Promise<void> {
    const headers = await this.getHeaders();

    // Đảm bảo đủ 7 tab bảng tính
    try {
      await this.ensureRequiredTabs(spreadsheetId);
    } catch (e) {
      console.warn('Lỗi kiểm tra tab trước khi ghi dữ liệu:', e);
    }

    // 1. Tab DS_NhanSu
    const staffHeaders = [
      'Mã Nhân Viên', 'Họ Và Tên', 'Giới Tính', 'Ngày Sinh', 'Số CCCD', 'Ngày Cấp', 'Nơi Cấp',
      'Quê Quán', 'Nơi Ở Hiện Nay', 'Số Điện Thoại', 'Email', 'Tình Trạng Hôn Nhân', 'Dân Tộc', 'Tôn Giáo',
      'Đơn Vị / Phòng / Trạm', 'Chức Vụ', 'Ngạch Công Chức / Viên Chức', 'Loại Nhân Sự', 'Trạng Thái',
      'Ngày Nghỉ Thôi Việc / Nghỉ Hưu', 'Ngày Tuyển Dụng', 'Ngày Vào Biên Chế', 'Ngạch Lương', 'Bậc Lương', 'Hệ Số Lương', 'Lương Cơ Sở (VNĐ)', 'Phụ Cấp Chức Vụ',
      'Phụ Cấp Thâm Niên (%)', 'Phụ Cấp Ưu Đãi Ngành (%)', 'Phụ Cấp Công Vụ (%)', 'Ngày Nâng Lương Tiếp Theo', 'Trình Độ Chuyên Môn', 'Chuyên Ngành', 'Lý Luận Chính Trị',
      'Chứng Chỉ Thú Y', 'Link Hồ Sơ Drive', 'Ngày Cập Nhật'
    ];

    const staffRows = employees.map(emp => [
      emp.code,
      emp.fullName,
      emp.gender,
      formatDateVN(emp.dob),
      emp.cccd,
      formatDateVN(emp.cccdDate),
      emp.cccdPlace,
      emp.hometown,
      emp.address,
      emp.phone,
      emp.email,
      emp.maritalStatus,
      emp.ethnicity,
      emp.religion,
      emp.departmentName,
      emp.positionTitle,
      `${emp.jobRankCode} - ${emp.jobRankName}`,
      emp.staffType,
      emp.status,
      formatDateVN(emp.leaveDate),
      formatDateVN(emp.recruitmentDate),
      formatDateVN(emp.officialDate),
      emp.salary.rankName,
      emp.salary.step,
      parseDecimalNumber(emp.salary.coefficient, 2.34),
      parseBaseSalary(emp.salary.baseSalary, DEFAULT_BASE_SALARY),
      parseDecimalNumber(emp.salary.leadershipAllowance, 0.0),
      `${emp.salary.seniorityAllowancePercent}%`,
      `${emp.salary.industryAllowancePercent ?? 10}%`,
      `${emp.salary.publicServiceAllowancePercent ?? 25}%`,
      formatDateVN(emp.salary.nextSalaryIncreaseDate),
      emp.education.highestDegree,
      emp.education.major,
      emp.education.politicalTheory,
      emp.education.veterinaryCert || 'Không',
      emp.driveFolderLink || '',
      formatDateVN(emp.updatedAt)
    ]);

    // 2. Tab QuaTrinhCongTac
    const workHistoryHeaders = [
      'Mã Nhân Viên', 'Họ Và Tên', 'Đơn Vị Hiện Tại', 'Từ Ngày', 'Đến Ngày', 'Đơn Vị Công Tác', 'Chức Vụ', 'Số Quyết Định', 'Ngày Ký', 'Người Ký', 'Ghi Chú'
    ];
    const workHistoryRows: any[][] = [];
    employees.forEach(emp => {
      emp.workHistory.forEach(wh => {
        workHistoryRows.push([
          emp.code,
          emp.fullName,
          emp.departmentName,
          formatDateVN(wh.startDate),
          wh.endDate === 'Nay' ? 'Nay' : formatDateVN(wh.endDate),
          wh.unitName,
          wh.position,
          wh.decisionNumber || '',
          formatDateVN(wh.decisionDate),
          wh.signedBy || '',
          wh.notes || ''
        ]);
      });
    });

    // 3. Tab LichSuLuong
    const salaryHistoryHeaders = [
      'Mã Nhân Viên', 'Họ Và Tên', 'Bậc', 'Hệ Số', 'Ngày Hưởng', 'Loại Nâng Lương', 'Số Quyết Định', 'Ngày Quyết Định', 'Ghi Chú'
    ];
    const salaryRows: any[][] = [];
    employees.forEach(emp => {
      emp.salaryHistory.forEach(sh => {
        salaryRows.push([
          emp.code,
          emp.fullName,
          sh.step,
          sh.coefficient,
          formatDateVN(sh.effectiveDate),
          sh.type,
          sh.decisionNumber,
          formatDateVN(sh.decisionDate),
          sh.notes || ''
        ]);
      });
    });

    // 4. Tab DaoTaoBoiDuong
    const trainingHeaders = [
      'STT',
      'Mã Nhân Viên',
      'Họ Và Tên',
      'Đơn Vị / Phòng / Trạm',
      'Chức Vụ / Vị Trí',
      'Trình Độ Chuyên Môn',
      'Chuyên Ngành Đào Tạo',
      'Cơ Sở Đào Tạo (Trường)',
      'Năm Tốt Nghiệp',
      'Chứng Chỉ Hành Nghề Thú Y',
      'Lý Luận Chính Trị',
      'Bồi Dưỡng QLNN (Quản Lý Nhà Nước)',
      'Trình Độ Ngoại Ngữ',
      'Trình Độ Tin Học',
      'Tên Khóa Bồi Dưỡng / Tập Huấn',
      'Cơ Sở Tổ Chức Bồi Dưỡng',
      'Thời Gian Bắt Đầu',
      'Thời Gian Kết Thúc',
      'Hình Thức Bồi Dưỡng',
      'Văn Bằng / Chứng Chỉ Được Cấp',
      'Ghi Chú'
    ];

    const trainingRows: any[][] = [];
    let trainingStt = 1;
    employees.forEach(emp => {
      if (emp.trainingHistory && emp.trainingHistory.length > 0) {
        emp.trainingHistory.forEach(th => {
          trainingRows.push([
            trainingStt++,
            emp.code,
            emp.fullName,
            emp.departmentName,
            emp.positionTitle,
            emp.education.highestDegree,
            emp.education.major,
            emp.education.school,
            emp.education.gradYear,
            emp.education.veterinaryCert || 'Không',
            emp.education.politicalTheory,
            emp.stateManagementLevel || 'Đạt chuẩn ngạch chức danh',
            emp.education.foreignLanguage,
            emp.education.informatics,
            th.courseName,
            th.institution,
            formatDateVN(th.startDate),
            formatDateVN(th.endDate),
            th.form,
            th.certificateName || 'Chứng chỉ hoàn thành',
            'Đã hoàn thành khóa học'
          ]);
        });
      } else {
        // Dữ liệu đào tạo chuyên môn thú y của cán bộ
        trainingRows.push([
          trainingStt++,
          emp.code,
          emp.fullName,
          emp.departmentName,
          emp.positionTitle,
          emp.education.highestDegree,
          emp.education.major,
          emp.education.school,
          emp.education.gradYear,
          emp.education.veterinaryCert || 'Chứng chỉ hành nghề Thú y',
          emp.education.politicalTheory,
          emp.stateManagementLevel || 'Đạt chuẩn ngạch chức danh',
          emp.education.foreignLanguage,
          emp.education.informatics,
          `Bồi dưỡng nghiệp vụ chuyên ngành ${emp.education.major}`,
          emp.education.school,
          formatDateVN(emp.recruitmentDate || '2020-01-01'),
          'Đạt chuẩn chức danh',
          'Tập trung',
          `${emp.education.highestDegree} - ${emp.education.major}`,
          'Hồ sơ chuyên môn Thú y'
        ]);
      }
    });

    // 5. Tab KhenThuongKyLuat
    const rewardHeaders = [
      'Mã Nhân Viên', 'Họ Và Tên', 'Phân Loại', 'Hình Thức', 'Số Quyết Định', 'Ngày Quyết Định', 'Cấp Quyết Định', 'Lý Do / Nội Dung'
    ];
    const rewardRows: any[][] = [];
    employees.forEach(emp => {
      emp.rewardDiscipline.forEach(rd => {
        rewardRows.push([
          emp.code,
          emp.fullName,
          rd.type,
          rd.form,
          rd.decisionNumber,
          formatDateVN(rd.decisionDate),
          rd.signLevel,
          rd.reason
        ]);
      });
    });

    // 6. Tab NhatKyAuditLog
    const auditHeaders = [
      'Thời Gian', 'Người Thực Hiện', 'Email', 'Hành Động', 'Mã Nhân Sự', 'Tên Nhân Sự', 'Trường Thay Đổi', 'Giá Trị Cũ', 'Giá Trị Mới', 'Chi Tiết'
    ];
    const auditRows = auditLogs.slice(0, 100).map(log => [
      formatDateVN(log.timestamp),
      log.userName,
      log.userEmail,
      log.action,
      log.targetEmployeeCode,
      log.targetEmployeeName,
      log.fieldChanged || '',
      log.oldValue || '',
      log.newValue || '',
      log.details
    ]);

    // 7. Tab DanhMuc_PhongBan
    const deptHeaders = [
      'STT', 'Mã Đơn Vị', 'Tên Phòng / Đơn Vị', 'Phân Loại', 'Trưởng Đơn Vị', 'Phó Đơn Vị',
      'Chỉ Tiêu Biên Chế', 'Địa Chỉ', 'Số Điện Thoại', 'Email', 'Trạng Thái'
    ];
    const deptRows = (departments || []).map((d, i) => [
      i + 1,
      d.code,
      d.name,
      d.type,
      d.leaderName,
      d.deputyLeaderName || '',
      d.allocatedQuota,
      d.address,
      d.phone,
      d.email,
      d.status
    ]);

    // Theo yêu cầu người dùng: Tuyệt đối KHÔNG ghi đè/xóa dữ liệu tab DanhMuc_PhongBan và KhenThuongKyLuat
    // vì dữ liệu trên cơ sở dữ liệu đã hoàn chỉnh, tránh xóa thông tin đã có sẵn.
    const PROTECTED_TABS = ['DanhMuc_PhongBan', 'KhenThuongKyLuat'];
    const safeSelectedTabs = (selectedTabs || []).filter(tab => !PROTECTED_TABS.includes(tab));

    // Lọc danh sách tab cần đồng bộ theo lựa chọn của người dùng
    const allTabDatasets: { tab: string; range: string; values: any[][] }[] = [
      { tab: 'DS_NhanSu', range: 'DS_NhanSu!A1:AK', values: [staffHeaders, ...staffRows] },
      { tab: 'QuaTrinhCongTac', range: 'QuaTrinhCongTac!A1:K', values: [workHistoryHeaders, ...workHistoryRows] },
      { tab: 'LichSuLuong', range: 'LichSuLuong!A1:I', values: [salaryHistoryHeaders, ...salaryRows] },
      { tab: 'DaoTaoBoiDuong', range: 'DaoTaoBoiDuong!A1:U', values: [trainingHeaders, ...trainingRows] },
      { tab: 'NhatKyAuditLog', range: 'NhatKyAuditLog!A1:J', values: [auditHeaders, ...auditRows] },
    ];

    const filteredData = allTabDatasets
      .filter(item => safeSelectedTabs.includes(item.tab))
      .map(item => ({ range: item.range, values: item.values }));

    if (filteredData.length === 0) {
      return;
    }

    // Gửi cập nhật theo batch update Values
    const updatePayload = {
      valueInputOption: 'USER_ENTERED',
      data: filteredData,
    };

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const res = await fetch(updateUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(updatePayload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Không thể đồng bộ dữ liệu vào Google Sheets.');
    }
  }

  /**
   * Làm sạch toàn bộ dữ liệu trên Google Sheets (xóa toàn bộ các dòng từ hàng 2 trở đi trên các tab nhân sự, lương, công tác, giữ lại đúng dòng tiêu đề hàng 1 chuẩn)
   * Giúp người dùng có bảng tính hoàn toàn sạch sẽ để tự nạp/dán dữ liệu thực tế vào!
   */
  public static async clearDataRowsInSheets(spreadsheetId?: string): Promise<{ success: boolean; url: string }> {
    let sheetId = spreadsheetId;
    let sheetUrl = '';
    if (!sheetId) {
      const sheet = await this.getOrCreateSpreadsheet();
      sheetId = sheet.id;
      sheetUrl = sheet.url;
    } else {
      sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    }

    const headers = await this.getHeaders();
    try {
      await this.ensureRequiredTabs(sheetId);
    } catch (e) {
      console.warn('Lỗi kiểm tra tab:', e);
    }

    // Xóa các dòng từ hàng 2 trở đi trên các tab nhân sự, công tác, lương, đào tạo, nhật ký
    const tabsToClear = ['DS_NhanSu', 'QuaTrinhCongTac', 'LichSuLuong', 'DaoTaoBoiDuong', 'NhatKyAuditLog'];
    const ranges = tabsToClear.map(tab => `${tab}!A2:AZ2500`);

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchClear`;
    const res = await fetch(clearUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ranges }),
    });

    if (!res.ok) {
      for (const range of ranges) {
        try {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`, {
            method: 'POST',
            headers,
          });
        } catch (e) {
          console.warn(`Lỗi xóa dải ô ${range}:`, e);
        }
      }
    }

    return { success: true, url: sheetUrl };
  }

  /**
   * Tải toàn bộ danh sách nhân sự từ Google Sheets "Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự"
   * Tự động phát hiện tab chứa dữ liệu thực tế (DS_NhanSu, Trang tính1, Sheet1, CONG CHUC...), nhận diện hàng tiêu đề thông minh.
   */
  public static async loadEmployeesFromSheets(spreadsheetId?: string, preferredTab?: string): Promise<Employee[]> {
    let sheetId = spreadsheetId;
    if (!sheetId) {
      const sheet = await this.getOrCreateSpreadsheet();
      sheetId = sheet.id;
    }

    const headers = await this.getHeaders();

    // 1. Kiểm tra danh sách các sheet có trong spreadsheet để chọn đúng tab chứa dữ liệu
    let availableTabs: string[] = [];
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title,gridProperties))`, { headers });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        availableTabs = (meta.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra danh sách sheet:', e);
    }

    if (availableTabs.length === 0) {
      availableTabs = ['DS_NhanSu', 'Trang tính1', 'Sheet1'];
    }

    // 2. Chấm điểm các tab để tự động chọn tab chứa dữ liệu nhân sự thực tế nhiều nhất
    let tabsToTry: string[] = [];
    if (preferredTab && availableTabs.includes(preferredTab)) {
      tabsToTry = [preferredTab, ...availableTabs.filter(t => t !== preferredTab)];
    } else {
      const tabScores: { tab: string; score: number }[] = [];
      for (const tab of availableTabs) {
        let score = 0;
        const normTab = normalizeHeader(tab);
        if (normTab.includes('nhan su') || normTab.includes('cong chuc') || normTab.includes('can bo') || normTab.includes('167') || normTab.includes('ds nhansu') || normTab.includes('bang luong')) {
          score += 50;
        }
        try {
          const testRange = `'${tab.replace(/'/g, "''")}'!A1:AZ20`;
          const testUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(testRange)}`;
          const testRes = await fetch(testUrl, { headers });
          if (testRes.ok) {
            const testData = await testRes.json();
            const testRows: any[][] = testData.values || [];
            if (testRows.length > 1) {
              score += testRows.length; // Số dòng có dữ liệu
              const sampleText = testRows.flat().map(c => normalizeHeader(c)).join(' ');
              if (sampleText.includes('ho ten') || sampleText.includes('ho va ten') || sampleText.includes('ho va chu lot')) score += 100;
              if (sampleText.includes('chuc vu') || sampleText.includes('ngach') || sampleText.includes('bac')) score += 50;
              if (sampleText.includes('he so') || sampleText.includes('luong') || sampleText.includes('stt')) score += 30;
              if (sampleText.includes('cccd') || sampleText.includes('ngay sinh')) score += 30;
            }
          }
        } catch {}
        tabScores.push({ tab, score });
      }

      tabScores.sort((a, b) => b.score - a.score);
      tabsToTry = tabScores.map(t => t.tab);
    }

    if (tabsToTry.length === 0) {
      tabsToTry = availableTabs;
    }

    // 3. Thử đọc dữ liệu qua danh sách tab ưu tiên
    let allParsedEmployees: Employee[] = [];

    for (const mainTabName of tabsToTry) {
      try {
        const safeRange = `'${mainTabName.replace(/'/g, "''")}'!A1:AZ3500`;
        const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(safeRange)}`;
        const res = await fetch(readUrl, { headers });
        if (!res.ok) continue;

        const data = await res.json();
        const rows: any[][] = data.values || [];
        if (rows.length <= 1) continue;

        // Quét 20 hàng đầu tiên để tìm hàng có số lượng cột nhân sự khớp nhiều nhất làm Header Row
        const headerKeywords = [
          'ho va ten', 'ho ten', 'ten can bo', 'ten', 'ho va chu lot', 'ho va ten dem', 'ho dem',
          'ma nv', 'ma nhan vien', 'manv', 'stt',
          'chuc vu', 'ngach', 'ngach cong chuc', 'cccd', 'so cccd', 
          'ngay sinh', 'nam sinh', 'don vi', 'phong ban', 'he so luong', 'he so', 'bac luong',
          'nguoi huong luong', 'nguoi lao dong'
        ];

        let headerRowIdx = 0;
        let maxMatches = -1;

        for (let rIdx = 0; rIdx < Math.min(20, rows.length); rIdx++) {
          const rowNorm = (rows[rIdx] || []).map(c => normalizeHeader(c));
          let matches = 0;
          for (const kw of headerKeywords) {
            if (rowNorm.some(h => h.includes(kw))) {
              matches++;
            }
          }
          if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIdx = rIdx;
          }
        }

        const headerRow: string[] = rows[headerRowIdx] || [];
        const normHeaders = headerRow.map(h => normalizeHeader(h));

        const findCol = (aliases: string[], fallbackIdx: number = -1): number => {
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            const idx = normHeaders.findIndex(h => h === normAlias);
            if (idx !== -1) return idx;
          }
          for (const alias of aliases) {
            const normAlias = normalizeHeader(alias);
            if (normAlias.length < 3) continue;
            const idx = normHeaders.findIndex(h => h.includes(normAlias));
            if (idx !== -1) return idx;
          }
          return fallbackIdx;
        };

        // Nhận diện các cột
        const colCode = findCol(['ma nhan vien', 'ma nv', 'ma can bo', 'manv', 'ma cbcc', 'so hieu cbcc'], -1);
        const colStt = findCol(['stt', 'so tt', 'so thu tu'], 0);
        const colFullName = findCol(['ho va ten', 'ho ten', 'ho va ten can bo', 'ho va ten vien chuc', 'ten can bo', 'nguoi huong luong', 'nguoi lao dong', 'ho va ten nguoi lao dong', 'fullname'], -1);
        const colLastName = findCol(['ho va chu lot', 'ho va ten dem', 'ho dem', 'ho lot', 'ho chu lot', 'ho va lot', 'ho'], -1);
        const colFirstName = findCol(['ten', 'ten can bo', 'ten rieng', 'ten goi', 'firstname'], -1);
        const colGender = findCol(['gioi tinh', 'phai', 'nam nu'], -1);
        const colDob = findCol(['ngay sinh', 'nam sinh', 'ngay thang nam sinh', 'ns'], -1);
        const colCccd = findCol(['so cccd', 'cccd', 'so cmnd', 'cmnd', 'can cuoc'], -1);
        const colCccdDate = findCol(['ngay cap', 'ngay cap cccd'], -1);
        const colCccdPlace = findCol(['noi cap', 'noi cap cccd'], -1);
        const colHometown = findCol(['que quan', 'nguyen quan'], -1);
        const colAddress = findCol(['noi o hien nay', 'dia chi', 'ho khau'], -1);
        const colPhone = findCol(['so dien thoai', 'sdt', 'dien thoai'], -1);
        const colEmail = findCol(['email', 'thu dien tu'], -1);
        const colMarital = findCol(['tinh trang hon nhan', 'hon nhan'], -1);
        const colEthnicity = findCol(['dan toc'], -1);
        const colReligion = findCol(['ton giao'], -1);
        const colDept = findCol(['don vi phong tram', 'don vi', 'phong ban', 'don vi cong tac', 'phong tram', 'tram', 'phong', 'bo phan'], -1);
        const colPos = findCol(['chuc vu', 'vi tri', 'chuc danh', 'vi tri viec lam'], -1);
        const colRankRaw = findCol(['ngach cong chuc vien chuc', 'ngach cong chuc', 'ngach vien chuc', 'ma ngach', 'ngach', 'ma chuc danh'], -1);
        const colStaffType = findCol(['loai nhan su', 'loai can bo', 'loai hop dong', 'hinh thuc', 'bien che', 'phan loai', 'doi tuong', 'nhom nhan su', 'che do', 'loai vien chuc', 'loai cong chuc', 'hinh thuc lam viec'], -1);
        const colStatus = findCol(['trang thai', 'tinh trang cong tac', 'tinh trang', 'hien trang'], -1);
        const colLeaveDate = findCol(['ngay nghi thoi viec va nghi huu', 'ngay bat dau nghi', 'ngay nghi huu', 'ngay thoi viec', 'ngay nghi', 'ngay nghi viec', 'ngay thoi viec nghi huu', 'ngay bat dau nghi viec'], -1);
        const colRecruitmentDate = findCol(['ngay tuyen dung', 'ngay vao nganh', 'ngay vao co quan'], -1);
        const colOfficialDate = findCol(['ngay vao bien che', 'ngay chinh thuc'], -1);

        // CỘT LƯƠNG & PHỤ CẤP
        const colRankName = findCol(['ngach luong', 'ten ngach', 'chuc danh nghe nghiep'], -1);
        const colStep = findCol(['bac luong', 'bac', 'bac hien huong', 'bac luong hien huong'], -1);
        const colCoefficient = findCol(['he so luong', 'he so', 'hsl', 'he so hien huong', 'he so luong hien huong', 'hsl hien huong', 'he so luong cb'], -1);
        const colBaseSalary = findCol(['luong co so', 'muc luong co so', 'mlcs', 'luong co ban', 'luong toi thieu', 'luong cs', 'muc luong cs', 'tien luong co so', 'luong co so vnd', 'luong co so (vnd)'], -1);
        const colLeadershipAllowance = findCol(['phu cap chuc vu', 'phu cap cv', 'pccv', 'he so pccv', 'he so chuc vu', 'phu cap chuc danh', 'phu cap lanh dao', 'pc chuc vu', 'pc cv'], -1);
        const colSeniorityAllowance = findCol(['phu cap tham nien', 'tham nien', 'pctn', 'pctn vuot khung', 'tham nien nghe', 'pctn (%)'], -1);
        const colIndustryAllowance = findCol(['phu cap uu dai nganh', 'uu dai nganh', 'pc uu dai nganh', 'phu cap nganh', 'uu dai nghe'], -1);
        const colPublicServiceAllowance = findCol(['phu cap cong vu', 'cong vu', 'pc cong vu', 'phu cap cvu'], -1);
        const colNextSalaryIncreaseDate = findCol(['ngay nang luong tiep theo', 'ngay nang bac', 'du kien nang bac', 'nang luong lan sau', 'nang bac tiep theo'], -1);
        const colDegree = findCol(['trinh do chuyen mon', 'trinh do', 'bang cap', 'hoc vi'], -1);
        const colMajor = findCol(['chuyen nganh', 'nganh dao tao'], -1);
        const colPoliticalTheory = findCol(['ly luan chinh tri', 'llct'], -1);
        const colVeterinaryCert = findCol(['chung chi thu y', 'chung chi hanh nghe thu y'], -1);
        const colDriveFolderLink = findCol(['link ho so drive', 'drive', 'link ho so', 'thu muc'], -1);
        const colUpdatedAt = findCol(['ngay cap nhat', 'cap nhat'], -1);

        const dataRows = rows.slice(headerRowIdx + 1);
        const seenMap = new Map<string, Employee>();
        const tabNorm = normalizeHeader(mainTabName);
        const isCivilServantTab = tabNorm.includes('cong chuc') || tabNorm.includes('ds congchuc') || tabNorm.includes('167');

        for (let i = 0; i < dataRows.length; i++) {
          const r = dataRows[i];
          if (!r || r.length === 0) continue;

          // Xác định Họ Và Tên đầy đủ
          let fullName = '';
          if (colFullName !== -1 && r[colFullName]) {
            fullName = String(r[colFullName]).trim();
          }

          // Ghép "Họ và chữ lót" + "Tên" nếu có
          if ((!fullName || !fullName.includes(' ')) && colLastName !== -1 && colFirstName !== -1) {
            const last = String(r[colLastName] || '').trim();
            const first = String(r[colFirstName] || '').trim();
            if (last || first) {
              fullName = `${last} ${first}`.trim();
            }
          } else if (!fullName && colFullName === -1) {
            // Nếu không tìm thấy cột fullName, thử fallback sang cột 1 hoặc 2
            if (r[1] && String(r[1]).trim().length >= 3) {
              fullName = String(r[1]).trim();
            } else if (r[2] && String(r[2]).trim().length >= 3) {
              fullName = String(r[2]).trim();
            }
          }

          // Quét fallback tên nếu chưa có
          if (!fullName) {
            for (let c = 0; c < Math.min(r.length, 6); c++) {
              const val = String(r[c] || '').trim();
              if (val.length >= 4 && val.length <= 40 && val.includes(' ') && !/\d/.test(val)) {
                const norm = normalizeHeader(val);
                if (!norm.includes('tong') && !norm.includes('so') && !norm.includes('chi cuc') && !norm.includes('phong')) {
                  fullName = val;
                  break;
                }
              }
            }
          }

          if (!fullName) continue;

          // Bỏ qua các dòng tổng kết / chân trang
          const normName = normalizeHeader(fullName);
          if (
            normName.includes('tong cong') ||
            normName.includes('tong so') ||
            normName.includes('nguoi lap') ||
            normName.includes('thu truong') ||
            normName.includes('truong phong') ||
            normName.includes('ke toan') ||
            normName.startsWith('ghi chu')
          ) {
            continue;
          }

          // Mã Nhân Viên
          const rawCode = colCode !== -1 ? String(r[colCode] || '').trim() : '';
          const rawStt = colStt !== -1 ? String(r[colStt] || '').trim() : '';
          const isNumeric = /^\d+$/.test(rawCode);
          const code = (rawCode && !isNumeric) ? rawCode : (rawStt && isNumeric ? `CC-${rawStt.padStart(3, '0')}` : `CC-2026-${String(i + 1).padStart(3, '0')}`);
          const cccd = colCccd !== -1 ? String(r[colCccd] || '').trim() : '';

          // Tránh ghi đè trùng lặp
          if (code && seenMap.has(code)) {
            continue;
          }

          const gender = (colGender !== -1 && r[colGender] === 'Nữ' ? 'Nữ' : 'Nam') as any;
          const dob = colDob !== -1 ? String(r[colDob] || '1985-01-01').trim() : '1985-01-01';
          const cccdDate = colCccdDate !== -1 ? String(r[colCccdDate] || '2021-01-01').trim() : '2021-01-01';
          const cccdPlace = colCccdPlace !== -1 ? String(r[colCccdPlace] || 'Cục CSQLHC về TTXH').trim() : 'Cục Cảnh sát QLHC về TTXH';
          const hometown = colHometown !== -1 ? String(r[colHometown] || '').trim() : '';
          const address = colAddress !== -1 ? String(r[colAddress] || '').trim() : '';
          const phone = colPhone !== -1 ? String(r[colPhone] || '').trim() : '';
          const email = colEmail !== -1 ? String(r[colEmail] || '').trim() : '';
          const maritalStatus = (colMarital !== -1 ? (r[colMarital] || 'Đã kết hôn') : 'Đã kết hôn') as any;
          const ethnicity = colEthnicity !== -1 ? String(r[colEthnicity] || 'Kinh').trim() : 'Kinh';
          const religion = colReligion !== -1 ? String(r[colReligion] || 'Không').trim() : 'Không';

          const positionTitle = colPos !== -1 ? String(r[colPos] || 'Chuyên viên').trim() : 'Chuyên viên';
          const posNorm = normalizeHeader(positionTitle);

          // Ánh xạ đơn vị
          const rawDept = colDept !== -1 ? String(r[colDept] || '').trim() : '';
          let matchedDept = ExcelImportService.matchDepartment(rawDept, INITIAL_DEPARTMENTS);
          if (
            posNorm.includes('chi cuc truong') || posNorm.includes('chi cuc pho') ||
            posNorm.includes('pho chi cuc truong') || posNorm.includes('truong chi cuc') ||
            posNorm.includes('pho truong chi cuc') || posNorm.includes('quyen chi cuc truong') ||
            posNorm.includes('phu trach chi cuc') || posNorm === 'cct' || posNorm === 'pcct'
          ) {
            matchedDept = INITIAL_DEPARTMENTS.find(d => d.id === 'BAN_LANH_DAO') || matchedDept;
          }
          const departmentId = matchedDept.id;
          const departmentName = rawDept || matchedDept.name;

          const rankRaw = colRankRaw !== -1 ? String(r[colRankRaw] || '01.003 - Chuyên viên').trim() : '01.003 - Chuyên viên';
          const rankParts = rankRaw.split(' - ');
          const jobRankCode = rankParts[0]?.trim() || '01.003';
          const jobRankName = rankParts[1]?.trim() || 'Chuyên viên';

          // Loại nhân sự (mặc định Công chức nếu tab là Công chức)
          let staffType: any = isCivilServantTab ? 'Công chức' : 'Khác';
          const rawStaffType = colStaffType !== -1 ? String(r[colStaffType] || '').trim() : '';
          const normStaffType = rawStaffType.toLowerCase();

          if (normStaffType.includes('viên chức') || normStaffType.includes('vien chuc')) {
            staffType = 'Viên chức';
          } else if (normStaffType.includes('công chức') || normStaffType.includes('cong chuc')) {
            staffType = 'Công chức';
          } else if (normStaffType.includes('111') || normStaffType.includes('68') || normStaffType.includes('hđ 68') || normStaffType.includes('hd 68')) {
            staffType = 'Hợp đồng 68/111';
          } else if (normStaffType.includes('thú y px') || normStaffType.includes('phường xã') || normStaffType.includes('phuong xa')) {
            staffType = 'Nhân viên Thú y PX';
          } else if (normStaffType.includes('khoán') || normStaffType.includes('khoan')) {
            staffType = 'Khoán chuyên môn';
          } else if (normStaffType.includes('hợp đồng') || normStaffType.includes('hop dong') || normStaffType.includes('hđld') || normStaffType.includes('hdld')) {
            staffType = 'Hợp đồng lao động';
          } else if (rawStaffType) {
            staffType = rawStaffType;
          } else if (isCivilServantTab || jobRankCode.startsWith('01.')) {
            staffType = 'Công chức';
          } else if (jobRankCode.startsWith('V.') || jobRankCode.startsWith('09.')) {
            staffType = 'Viên chức';
          }

          const status = (colStatus !== -1 ? (r[colStatus] || 'Đang công tác') : 'Đang công tác') as any;
          const recruitmentDate = colRecruitmentDate !== -1 ? String(r[colRecruitmentDate] || '2015-01-01').trim() : '2015-01-01';
          const officialDate = colOfficialDate !== -1 ? String(r[colOfficialDate] || '2016-01-01').trim() : '2016-01-01';

          // Lương & Phụ cấp
          const rankName = colRankName !== -1 ? String(r[colRankName] || jobRankName).trim() : jobRankName;
          const step = colStep !== -1 ? (parseInt(String(r[colStep] || '1'), 10) || 1) : 1;
          const rawCoef = colCoefficient !== -1 ? r[colCoefficient] : undefined;
          const parsedCoef = parseDecimalNumber(rawCoef, 0);
          const coefficient = parsedCoef > 0 ? parsedCoef : 2.34;

          const rawBaseSalary = colBaseSalary !== -1 ? r[colBaseSalary] : undefined;
          const baseSalary = parseBaseSalary(rawBaseSalary, DEFAULT_BASE_SALARY);

          const rawPccv = colLeadershipAllowance !== -1 ? r[colLeadershipAllowance] : undefined;
          const leadershipAllowance = parseDecimalNumber(rawPccv, 0.0);

          const rawPctn = colSeniorityAllowance !== -1 ? r[colSeniorityAllowance] : undefined;
          const seniorityAllowancePercent = parseDecimalNumber(rawPctn, 0);

          const rawIndustry = colIndustryAllowance !== -1 ? r[colIndustryAllowance] : undefined;
          const industryAllowancePercent = parseDecimalNumber(rawIndustry, 10);

          const rawPublicService = colPublicServiceAllowance !== -1 ? r[colPublicServiceAllowance] : undefined;
          const publicServiceAllowancePercent = parseDecimalNumber(rawPublicService, 25);

          const nextSalaryIncreaseDate = colNextSalaryIncreaseDate !== -1 ? String(r[colNextSalaryIncreaseDate] || '2027-01-01').trim() : '2027-01-01';
          const highestDegree = (colDegree !== -1 ? (r[colDegree] || 'Đại học') : 'Đại học') as any;
          const major = colMajor !== -1 ? String(r[colMajor] || 'Bác sĩ Thú y').trim() : 'Bác sĩ Thú y';
          const politicalTheory = (colPoliticalTheory !== -1 ? (r[colPoliticalTheory] || 'Trung cấp') : 'Trung cấp') as any;
          const veterinaryCert = colVeterinaryCert !== -1 ? String(r[colVeterinaryCert] || '').trim() : '';
          const driveFolderLink = colDriveFolderLink !== -1 ? String(r[colDriveFolderLink] || '').trim() : '';
          const updatedAt = colUpdatedAt !== -1 ? String(r[colUpdatedAt] || new Date().toISOString().split('T')[0]).trim() : new Date().toISOString().split('T')[0];

          const rawLeaveDate = colLeaveDate !== -1 ? String(r[colLeaveDate] || '').trim() : '';
          const leaveDate = rawLeaveDate ? (toISODate(rawLeaveDate) || rawLeaveDate) : undefined;

          const employee: Employee = {
            id: `emp-sheet-${code.replace(/[^a-zA-Z0-9]/g, '_')}`,
            code,
            fullName,
            gender,
            dob,
            cccd,
            cccdDate,
            cccdPlace,
            hometown,
            birthplace: hometown,
            address,
            phone,
            email,
            maritalStatus,
            ethnicity,
            religion,
            departmentId,
            departmentName,
            positionTitle,
            jobRankCode,
            jobRankName,
            staffType,
            recruitmentDate,
            agencyJoinDate: recruitmentDate,
            industryDate: recruitmentDate,
            officialDate,
            status,
            leaveDate,
            salary: {
              rankCode: jobRankCode,
              rankName,
              step,
              maxStep: 12,
              coefficient,
              effectiveDate: recruitmentDate,
              leadershipAllowance,
              seniorityAllowancePercent,
              otherAllowance: 0,
              nextSalaryIncreaseDate,
              baseSalary,
              industryAllowancePercent,
              publicServiceAllowancePercent,
            },
            education: {
              highestDegree,
              major,
              school: 'Đại học Nông Lâm TP.HCM',
              gradYear: 2010,
              politicalTheory,
              foreignLanguage: 'B1',
              informatics: 'Cơ bản',
              veterinaryCert: veterinaryCert === 'Không' ? '' : veterinaryCert,
              otherCerts: [],
            },
            workHistory: [],
            salaryHistory: [],
            trainingHistory: [],
            rewardDiscipline: [],
            documents: [],
            driveFolderLink,
            updatedAt,
          };

          seenMap.set(code, employee);
        }

        const parsed = Array.from(seenMap.values());
        if (parsed.length > 0) {
          allParsedEmployees = parsed;
          console.log(`[GoogleSheetsService] Đã nạp thành công ${parsed.length} cán bộ từ tab "${mainTabName}"!`);
          break; // Đã tìm thấy và nạp thành công tab có dữ liệu!
        }
      } catch (err: any) {
        console.warn(`Lỗi khi đọc tab ${mainTabName}:`, err);
      }
    }

    return allParsedEmployees;
  }

  /**
   * Chẩn đoán toàn diện hệ thống đồng bộ và kiểm tra kết nối với Google Sheets
   */
  public static async diagnoseConnection(customSheetId?: string): Promise<SyncDiagnosisReport> {
    const report: SyncDiagnosisReport = {
      authOk: false,
      apiOk: false,
      sheetFound: false,
      availableTabs: [],
      rowCount: 0,
      issues: [],
      suggestions: [],
    };

    // 1. Kiểm tra xác thực Google OAuth
    const token = await getAccessToken();
    if (!token) {
      report.issues.push('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn.');
      report.suggestions.push('Bấm nút "Kết Nối Google" hoặc "Đăng nhập ngay" để cấp quyền Google Sheets.');
      return report;
    }
    report.authOk = true;

    // 2. Kiểm tra API kết nối
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let targetSheetId = customSheetId || this.getSavedSpreadsheetId();
    let sheetTitle = SPREADSHEET_TITLE;
    let sheetUrl = '';

    try {
      if (!targetSheetId) {
        const sheet = await this.getOrCreateSpreadsheet();
        targetSheetId = sheet.id;
        sheetTitle = sheet.title;
        sheetUrl = sheet.url;
      } else {
        sheetUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`;
      }

      report.sheetId = targetSheetId;
      report.sheetUrl = sheetUrl;
      report.sheetTitle = sheetTitle;

      // 3. Đọc metadata bảng tính
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}?fields=properties.title,sheets(properties(sheetId,title))`, { headers });
      if (!metaRes.ok) {
        const errJson = await metaRes.json().catch(() => ({}));
        report.issues.push(`Không thể truy cập Google Sheets (Mã lỗi ${metaRes.status}): ${errJson.error?.message || metaRes.statusText}`);
        report.suggestions.push('Kiểm tra quyền chia sẻ bảng tính hoặc dán link Google Sheets công vụ vào ô cấu hình.');
        return report;
      }

      report.apiOk = true;
      report.sheetFound = true;
      const metaData = await metaRes.json();
      report.sheetTitle = metaData.properties?.title || sheetTitle;
      report.availableTabs = (metaData.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);

      // 4. Kiểm tra dữ liệu trong các tab
      for (const tab of report.availableTabs) {
        try {
          const testRange = `'${tab.replace(/'/g, "''")}'!A1:AZ20`;
          const testRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(testRange)}`, { headers });
          if (testRes.ok) {
            const testData = await testRes.json();
            const rows = testData.values || [];
            if (rows.length > 1) {
              const textSample = rows.flat().map((c: any) => normalizeHeader(c)).join(' ');
              if (
                textSample.includes('ho ten') || 
                textSample.includes('ho va ten') || 
                textSample.includes('ho va chu lot') ||
                textSample.includes('chuc vu') || 
                textSample.includes('ngach') ||
                textSample.includes('cccd') ||
                textSample.includes('stt')
              ) {
                report.detectedDataTab = tab;
                break;
              }
            }
          }
        } catch (e) {
          // Bỏ qua
        }
      }

      if (!report.detectedDataTab && report.availableTabs.length > 0) {
        report.detectedDataTab = report.availableTabs[0];
      }

      // 5. Kiểm tra số lượng dòng và mẫu dữ liệu
      if (report.detectedDataTab) {
        const countRange = `'${report.detectedDataTab.replace(/'/g, "''")}'!A1:Z3500`;
        const countRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetSheetId}/values/${encodeURIComponent(countRange)}`, { headers });
        if (countRes.ok) {
          const countData = await countRes.json();
          const countRows = countData.values || [];
          report.rowCount = Math.max(0, countRows.length - 1);
          report.sampleRows = countRows.slice(1, 4).map((r: any[]) => r.filter(Boolean).slice(0, 5).join(' | '));
        }
      }

      if (report.rowCount === 0) {
        report.issues.push(`Bảng tính hiện tại (tab "${report.detectedDataTab || 'DS_NhanSu'}") chưa có dòng dữ liệu nào.`);
        report.suggestions.push(`Dán dữ liệu 167 Công chức vào tab "${report.detectedDataTab || 'DS_NhanSu'}", sau đó bấm "Bắt Đầu Nạp Từ Google Sheets".`);
      }

    } catch (err: any) {
      report.issues.push(`Lỗi kết nối kiểm tra: ${err.message}`);
      report.suggestions.push('Đăng nhập lại Google hoặc kiểm tra kết nối mạng.');
    }

    return report;
  }

  /**
   * Tải danh mục phòng ban và đơn vị trực thuộc từ Google Sheets tab "DanhMuc_PhongBan"
   */
  public static async loadDepartmentsFromSheets(spreadsheetId?: string): Promise<Department[]> {
    let sheetId = spreadsheetId;
    if (!sheetId) {
      const sheet = await this.getOrCreateSpreadsheet();
      sheetId = sheet.id;
    }

    const headers = await this.getHeaders();
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/DanhMuc_PhongBan!A1:K100`;
    const res = await fetch(readUrl, { headers });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const rows: any[][] = data.values || [];
    if (rows.length <= 1) {
      return [];
    }

    const dataRows = rows.slice(1);
    const depts: Department[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const code = String(r[1] || '').trim();
      const name = String(r[2] || '').trim();
      if (!name) continue;

      const id = code || `DEPT_${i + 1}`;
      const type = (r[3] || 'PHONG_CHUYEN_MON') as any;
      const leaderName = String(r[4] || '').trim();
      const deputyLeaderName = String(r[5] || '').trim();
      const allocatedQuota = parseInt(String(r[6] || '0'), 10) || 0;
      const address = String(r[7] || '').trim();
      const phone = String(r[8] || '').trim();
      const email = String(r[9] || '').trim();
      const status = (r[10] || 'Đang hoạt động') as any;

      depts.push({
        id,
        code,
        name,
        type,
        leaderName,
        deputyLeaderName,
        allocatedQuota,
        address,
        phone,
        email,
        status
      });
    }

    return depts;
  }
}
