import * as XLSX from 'xlsx';
import { Employee, Department, StaffType, WorkStatus, DegreeLevel, PoliticalTheoryLevel } from '../types/hrm';
import { INITIAL_DEPARTMENTS } from '../data/initialData';
import { JobRankService } from './jobRankService';
import { parseBaseSalary, parseDecimalNumber, DEFAULT_BASE_SALARY } from '../utils/salaryUtils';

export interface ColumnMapping {
  excelColumn: string;
  excelColumnIndex: number;
  sampleValue: string;
  targetField: string;
  targetFieldLabel: string;
  isMatched: boolean;
  matchConfidence: 'EXACT' | 'HIGH' | 'FUZZY' | 'NONE';
}

export interface ParseResult {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  totalRawRows: number;
  columnMappings: ColumnMapping[];
  unmappedColumns: string[];
  parsedEmployees: Employee[];
  departmentsFound: { deptName: string; count: number; matchedId: string }[];
  errors: string[];
  rawRows?: any[][];
}

export const TARGET_FIELD_DEFINITIONS: { field: string; label: string; aliases: string[]; category: string }[] = [
  {
    field: 'code',
    label: 'Mã Nhân Viên',
    aliases: [
      'mã nv', 'mã nhân viên', 'manv', 'ma_nv', 'mã số', 'mã cbcc', 'mã công chức', 'số hiệu cbcc', 
      'stt', 'số tt', 'số thứ tự', 'ma nv', 'ma cbcc', 'so hieu cbcc', 'id'
    ],
    category: 'Thông tin chung',
  },
  {
    field: 'fullName',
    label: 'Họ Và Tên (Đầy Đủ)',
    aliases: [
      'họ và tên', 'họ tên', 'họ tên nhân viên', 'họ và tên đệm và tên', 'họ và tên cán bộ', 
      'họ và tên nhân sự', 'tên cán bộ', 'tên nhân viên', 'họ và tên cbcc', 'họ tên cbcc',
      'người hưởng lương', 'người lao động', 'cán bộ', 'nhân sự', 'nhân viên', 'họ và tên người lao động',
      'ho va ten', 'ho ten', 'ho ten can bo', 'ten can bo', 'fullname', 'name'
    ],
    category: 'Thông tin chung',
  },
  {
    field: 'lastName',
    label: 'Họ & Tên Đệm (Chữ Lót)',
    aliases: ['họ và tên đệm', 'họ và chữ lót', 'họ đệm', 'họ lót', 'họ', 'ho va chu lot', 'ho va ten dem', 'ho dem', 'ho lot'],
    category: 'Thông tin chung',
  },
  {
    field: 'firstName',
    label: 'Tên (Riêng)',
    aliases: ['tên', 'tên gọi', 'ten', 'firstname'],
    category: 'Thông tin chung',
  },
  {
    field: 'gender',
    label: 'Giới Tính',
    aliases: ['giới tính', 'nam/nữ', 'phái', 'giới'],
    category: 'Thông tin chung',
  },
  {
    field: 'dob',
    label: 'Ngày Sinh',
    aliases: ['ngày sinh', 'năm sinh', 'ngày tháng năm sinh', 'ns', 'ngày sinh (dd/mm/yyyy)'],
    category: 'Thông tin chung',
  },
  {
    field: 'cccd',
    label: 'Số CCCD / CMND',
    aliases: ['cccd', 'số cccd', 'cmnd', 'số cmnd', 'số định danh', 'căn cước công dân', 'cmnd/cccd'],
    category: 'Thông tin chung',
  },
  {
    field: 'cccdDate',
    label: 'Ngày Cấp CCCD',
    aliases: ['ngày cấp', 'ngày cấp cccd', 'ngày cấp cmnd'],
    category: 'Thông tin chung',
  },
  {
    field: 'cccdPlace',
    label: 'Nơi Cấp CCCD',
    aliases: ['nơi cấp', 'nơi cấp cccd', 'cục csqlhc về ttxh', 'nơi cấp cmnd'],
    category: 'Thông tin chung',
  },
  {
    field: 'departmentName',
    label: 'Đơn Vị / Phòng / Trạm',
    aliases: [
      'đơn vị', 'phòng ban', 'phòng / trạm', 'trạm / phòng', 'đơn vị công tác', 'bộ phận',
      'đơn vị / phòng / trạm', 'nơi làm việc', 'đơn vị làm việc', 'phòng', 'trạm'
    ],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'positionTitle',
    label: 'Chức Vụ / Chức Danh',
    aliases: ['chức vụ', 'chức danh', 'vị trí việc làm', 'chức vụ hiện tại', 'chức vụ công tác', 'nhiệm vụ'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'jobRankCode',
    label: 'Mã Ngạch Công Chức / Viên Chức',
    aliases: ['mã ngạch', 'ngạch công chức', 'ngạch viên chức', 'mã chức danh', 'ngạch'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'jobRankName',
    label: 'Tên Ngạch',
    aliases: ['tên ngạch', 'ngạch chức danh', 'tên ngạch chức danh'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'staffType',
    label: 'Loại Nhân Sự',
    aliases: ['loại nhân sự', 'loại cán bộ', 'đối tượng', 'biên chế / hợp đồng', 'loại hợp đồng', 'hình thức tuyển dụng'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'recruitmentDate',
    label: 'Ngày Tuyển Dụng',
    aliases: ['ngày tuyển dụng', 'ngày vào ngành', 'ngày ký hợp đồng', 'ngày nhận việc', 'ngày công tác'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'officialDate',
    label: 'Ngày Vào Biên Chế',
    aliases: ['ngày biên chế', 'ngày chính thức', 'ngày vào biên chế chính thức'],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'leaveDate',
    label: 'Ngày Bắt Đầu Nghỉ (Nghỉ Hưu / Thôi Việc)',
    aliases: [
      'ngày bắt đầu nghỉ', 'ngày nghỉ thôi việc và nghỉ hưu', 'ngày nghỉ hưu', 'ngày thôi việc',
      'ngày nghỉ', 'ngày nghỉ việc', 'ngày bắt đầu nghỉ việc', 'ngày về hưu', 'ngay nghi thoi viec va nghi huu',
      'ngay bat dau nghi', 'ngay thoi viec', 'ngay nghi huu'
    ],
    category: 'Công tác & Vị trí',
  },
  {
    field: 'salary.step',
    label: 'Bậc Lương',
    aliases: ['bậc', 'bậc lương', 'bậc hiện hưởng', 'bậc l', 'bậc lương hiện hưởng'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.coefficient',
    label: 'Hệ Số Lương',
    aliases: ['hệ số', 'hệ số lương', 'hsl', 'hệ số hiện hưởng', 'hệ số lương hiện hưởng', 'hsl hiện hưởng', 'he so luong', 'he so', 'he so hien huong'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.baseSalary',
    label: 'Mức Lương Cơ Sở (VNĐ)',
    aliases: ['lương cơ sở', 'mức lương cơ sở', 'mlcs', 'luong co so', 'muc luong co so', 'lương cơ bản', 'luong co ban'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.leadershipAllowance',
    label: 'Phụ Cấp Chức Vụ',
    aliases: ['pccv', 'phụ cấp chức vụ', 'phụ cấp cv', 'pc cv', 'phụ cấp lãnh đạo', 'pc chức vụ', 'hệ số pccv', 'phu cap cv', 'phu cap chuc vu', 'he so chuc vu', 'phụ cấp chức danh'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.seniorityAllowancePercent',
    label: 'Phụ Cấp Thâm Niên (%)',
    aliases: ['pctn', 'phụ cấp thâm niên', 'thâm niên %', 'pctn (%)', 'thâm niên nghề', 'pctn vượt khung', 'thâm niên'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.industryAllowancePercent',
    label: 'Phụ Cấp Ưu Đãi Ngành (%)',
    aliases: ['phụ cấp ưu đãi ngành', 'ưu đãi ngành', 'pc ưu đãi ngành', 'phụ cấp ngành', 'ưu đãi nghề', 'pc nganh', 'ưu đãi ngành %'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.publicServiceAllowancePercent',
    label: 'Phụ Cấp Công Vụ (%)',
    aliases: ['phụ cấp công vụ', 'công vụ', 'pc công vụ', 'phụ cấp cvu', 'công vụ %', 'pc cong vu'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.otherAllowance',
    label: 'Phụ Cấp Khác / Ưu Đãi Nghề',
    aliases: ['phụ cấp khác', 'pc khác', 'pc ưu đãi nghề', 'ưu đãi nghề', 'phụ cấp độc hại'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'salary.nextSalaryIncreaseDate',
    label: 'Ngày Nâng Lương Tiếp Theo',
    aliases: ['ngày nâng lương', 'ngày nâng bậc', 'kỳ nâng lương', 'hạn nâng lương tiếp theo'],
    category: 'Lương & Phụ cấp',
  },
  {
    field: 'education.highestDegree',
    label: 'Trình Độ Chuyên Môn',
    aliases: ['trình độ', 'trình độ chuyên môn', 'trình độ đào tạo', 'bằng cấp', 'học vị', 'trình độ cao nhất'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.major',
    label: 'Chuyên Ngành Đào Tạo',
    aliases: ['chuyên ngành', 'chuyên ngành đào tạo', 'ngành học', 'chuyên môn'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.school',
    label: 'Cơ Sở Đào Tạo (Trường)',
    aliases: ['trường', 'cơ sở đào tạo', 'trường đào tạo', 'nơi đào tạo'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.gradYear',
    label: 'Năm Tốt Nghiệp',
    aliases: ['năm tốt nghiệp', 'năm tn'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.veterinaryCert',
    label: 'Chứng Chỉ Hành Nghề Thú Y',
    aliases: ['chứng chỉ thú y', 'chứng chỉ hành nghề thú y', 'cchn thú y', 'chứng chỉ kiểm dịch', 'chứng chỉ'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.politicalTheory',
    label: 'Lý Luận Chính Trị',
    aliases: ['lý luận chính trị', 'llct', 'chính trị'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.foreignLanguage',
    label: 'Trình Độ Ngoại Ngữ',
    aliases: ['ngoại ngữ', 'trình độ ngoại ngữ', 'tiếng anh'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'education.informatics',
    label: 'Trình Độ Tin Học',
    aliases: ['tin học', 'trình độ tin học', 'cntt'],
    category: 'Chuyên môn & Đào tạo',
  },
  {
    field: 'phone',
    label: 'Số Điện Thoại',
    aliases: ['số điện thoại', 'điện thoại', 'sđt', 'di động', 'số đt', 'phone'],
    category: 'Liên hệ & Thường trú',
  },
  {
    field: 'email',
    label: 'Email',
    aliases: ['email', 'thư điện tử', 'hòm thư', 'email công vụ'],
    category: 'Liên hệ & Thường trú',
  },
  {
    field: 'hometown',
    label: 'Quê Quán',
    aliases: ['quê quán', 'nguyên quán'],
    category: 'Liên hệ & Thường trú',
  },
  {
    field: 'address',
    label: 'Nơi Ở Hiện Nay',
    aliases: ['nơi ở hiện nay', 'địa chỉ', 'địa chỉ thường trú', 'thường trú', 'chỗ ở'],
    category: 'Liên hệ & Thường trú',
  },
  {
    field: 'socialInsuranceNumber',
    label: 'Số Sổ BHXH',
    aliases: ['số sổ bhxh', 'số bhxh', 'mã bhxh', 'bhxh'],
    category: 'Hồ sơ pháp lý',
  },
  {
    field: 'healthInsuranceNumber',
    label: 'Mã Thẻ BHYT',
    aliases: ['mã thẻ bhyt', 'số bhyt', 'bhyt'],
    category: 'Hồ sơ pháp lý',
  },
  {
    field: 'partyJoinDate',
    label: 'Ngày Vào Đảng',
    aliases: ['ngày vào đảng', 'ngày kết nạp đảng', 'vào đảng'],
    category: 'Hồ sơ pháp lý',
  },
  {
    field: 'status',
    label: 'Trạng Thái Công Tác',
    aliases: ['trạng thái', 'tình trạng', 'hiện trạng'],
    category: 'Công tác & Vị trí',
  },
];

export class ExcelImportService {
  /**
   * Chuẩn hóa chuỗi để so sánh linh hoạt (bỏ dấu, thường hóa, bỏ ký tự đặc biệt)
   */
  public static normalizeString(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Khớp tên đơn vị trong Excel với danh sách 23 đơn vị chuẩn của Chi Cục
   */
  public static matchDepartment(rawDept: string, departments: Department[] = INITIAL_DEPARTMENTS): Department {
    if (!rawDept || !rawDept.trim()) {
      return departments[0]; // Mặc định Ban Lãnh đạo hoặc Đơn vị đầu tiên
    }

    const normRaw = this.normalizeString(rawDept);

    // 1. Khớp theo mã hoặc từ khóa đặc trưng của 23 đơn vị
    if (
      normRaw.includes('lanh dao') || normRaw.includes('bld') || normRaw.includes('ban giam doc') ||
      normRaw.includes('chi cuc truong') || normRaw.includes('chi cuc pho') || normRaw.includes('pho chi cuc truong')
    ) {
      return departments.find(d => d.id === 'BAN_LANH_DAO') || departments[0];
    }
    if (normRaw.includes('hanh chinh') || normRaw.includes('hcth') || normRaw.includes('tong hop')) {
      return departments.find(d => d.id === 'P_HCTH') || departments[1];
    }
    if (normRaw.includes('kiem tra chuyen nganh') || normRaw.includes('ktcn') || normRaw.includes('thanh tra')) {
      return departments.find(d => d.id === 'P_KTCN') || departments[2];
    }
    if (normRaw.includes('quan ly chan nuoi') || normRaw.includes('qlcn')) {
      return departments.find(d => d.id === 'P_QLCN') || departments[3];
    }
    if (normRaw.includes('quan ly dich benh') || normRaw.includes('qldb') || normRaw.includes('dich benh')) {
      return departments.find(d => d.id === 'P_QLDB') || departments[4];
    }
    if (normRaw.includes('thu y cong dong') || normRaw.includes('tycd') || normRaw.includes('cong dong')) {
      return departments.find(d => d.id === 'P_TYCD') || departments[5];
    }
    if (normRaw.includes('chan doan') || normRaw.includes('xet nghiem') || normRaw.includes('tt cdxn') || normRaw.includes('cdxn')) {
      return departments.find(d => d.id === 'TT_CDXN') || departments[22];
    }

    // Các trạm kiểm dịch
    if (normRaw.includes('an lac')) {
      return departments.find(d => d.id === 'T_KD_ANLAC') || departments[15];
    }
    if (normRaw.includes('hoc mon') && normRaw.includes('kiem dich')) {
      return departments.find(d => d.id === 'T_KD_HOCMON') || departments[16];
    }
    if (normRaw.includes('thu duc') && normRaw.includes('kiem dich')) {
      return departments.find(d => d.id === 'T_KD_THUDUC') || departments[17];
    }
    if (normRaw.includes('bac tan uyen') || normRaw.includes('tan uyen')) {
      return departments.find(d => d.id === 'T_KD_BTU') || departments[18];
    }
    if (normRaw.includes('chau duc')) {
      return departments.find(d => d.id === 'T_KD_CD') || departments[19];
    }
    if (normRaw.includes('binh chau')) {
      return departments.find(d => d.id === 'T_KD_BC') || departments[20];
    }
    if (normRaw.includes('phu my')) {
      return departments.find(d => d.id === 'T_KD_PM') || departments[21];
    }

    // 9 Trạm Khu Vực
    for (let i = 1; i <= 9; i++) {
      if (
        normRaw.includes(`khu vuc ${i}`) || 
        normRaw.includes(`kv ${i}`) || 
        normRaw.includes(`kv${i}`) || 
        normRaw.includes(`khuvuc ${i}`)
      ) {
        const found = departments.find(d => d.id === `T_KV${i}`);
        if (found) return found;
      }
    }

    // Khớp theo tên địa danh đặc thù huyện/quận
    if (normRaw.includes('cu chi')) {
      return departments.find(d => d.id === 'T_KV2') || departments[7];
    }
    if (normRaw.includes('hoc mon')) {
      return departments.find(d => d.id === 'T_KV3') || departments[8];
    }
    if (normRaw.includes('binh chanh') || normRaw.includes('nha be')) {
      return departments.find(d => d.id === 'T_KV4') || departments[9];
    }
    if (normRaw.includes('can gio')) {
      return departments.find(d => d.id === 'T_KV5') || departments[10];
    }
    if (normRaw.includes('thu duc')) {
      return departments.find(d => d.id === 'T_KV6') || departments[11];
    }

    // Thử khớp theo tên đơn vị gốc
    for (const dept of departments) {
      const normDeptName = this.normalizeString(dept.name);
      if (normDeptName.includes(normRaw) || normRaw.includes(normDeptName)) {
        return dept;
      }
    }

    // Mặc định trả về đơn vị đầu tiên nếu không khớp
    return departments[0];
  }

  /**
   * Tìm sheet phù hợp nhất trong danh sách sheet của workbook
   * Ưu tiên sheet "DM NHAN VIEN"
   */
  public static findBestSheet(sheetNames: string[]): string {
    // 1. Tìm chính xác "DM NHAN VIEN" hoặc các biến thể
    const exactMatch = sheetNames.find(name => {
      const norm = this.normalizeString(name);
      return norm === 'dm nhan vien' || norm === 'dm_nhan_vien' || norm === 'dmnhanvien';
    });
    if (exactMatch) return exactMatch;

    // 2. Tìm chứa "dm" và "nhan vien"
    const partialMatch = sheetNames.find(name => {
      const norm = this.normalizeString(name);
      return (norm.includes('dm') || norm.includes('danh muc')) && (norm.includes('nhan vien') || norm.includes('nhan su') || norm.includes('cbcc'));
    });
    if (partialMatch) return partialMatch;

    // 3. Tìm chứa "nhan vien" hoặc "nhan su" hoặc "ds"
    const generalMatch = sheetNames.find(name => {
      const norm = this.normalizeString(name);
      return norm.includes('nhan vien') || norm.includes('nhan su') || norm.includes('ds');
    });
    if (generalMatch) return generalMatch;

    return sheetNames[0];
  }

  /**
   * Phân tích tệp Excel từ ArrayBuffer và khớp các cột với dữ liệu hệ thống
   */
  public static parseExcelBuffer(
    buffer: ArrayBuffer,
    fileName: string = 'BANG LUONG TOAN CHI CUC .xlsx',
    targetSheetName?: string,
    departments: Department[] = INITIAL_DEPARTMENTS
  ): ParseResult {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetNames = workbook.SheetNames;

    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('Tệp Excel không có bất kỳ sheet nào.');
    }

    const selectedSheet = targetSheetName && sheetNames.includes(targetSheetName)
      ? targetSheetName
      : this.findBestSheet(sheetNames);

    const worksheet = workbook.Sheets[selectedSheet];
    if (!worksheet) {
      throw new Error(`Không tìm thấy sheet "${selectedSheet}" trong tệp.`);
    }

    // Chuyển worksheet thành mảng 2 chiều để phát hiện header row chính xác
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (!rawData || rawData.length === 0) {
      throw new Error(`Sheet "${selectedSheet}" không có dữ liệu.`);
    }

    // Tìm dòng chứa tiêu đề cột (Header Row)
    // Thường dòng tiêu đề có chứa các từ khóa như: 'Họ và tên', 'Họ tên', 'Mã NV', 'STT', 'Hệ số', 'Chức vụ'
    let headerRowIndex = 0;
    let maxMatchCount = 0;

    for (let r = 0; r < Math.min(25, rawData.length); r++) {
      const row = rawData[r];
      if (!Array.isArray(row)) continue;

      let matchCount = 0;
      row.forEach(cell => {
        if (!cell) return;
        const normCell = this.normalizeString(String(cell));
        if (!normCell) return;
        const hasHeaderKeyword = TARGET_FIELD_DEFINITIONS.some(def => 
          def.aliases.some(alias => {
            const normAlias = this.normalizeString(alias);
            return normCell === normAlias || normCell.includes(normAlias) || (normAlias.length >= 3 && normAlias.includes(normCell));
          })
        );
        if (hasHeaderKeyword) matchCount++;
      });

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        headerRowIndex = r;
      }
    }

    const rawHeaders: string[] = (rawData[headerRowIndex] || []).map((h: any) => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1).filter(row => {
      // Lọc bỏ hàng trống hoặc hàng tổng cộng
      if (!Array.isArray(row) || row.length === 0) return false;
      const rowText = row.join(' ').trim().toLowerCase();
      if (!rowText) return false;
      if (
        rowText.startsWith('tổng cộng') || 
        rowText.startsWith('tong cong') || 
        rowText.startsWith('người lập') || 
        rowText.startsWith('chi cục trưởng') ||
        rowText.startsWith('kế toán trưởng')
      ) {
        return false;
      }
      // Ít nhất phải có một ô dữ liệu
      return row.some(c => String(c || '').trim() !== '');
    });

    // Đối chiếu từng cột của Excel với trường của Hệ thống
    const columnMappings: ColumnMapping[] = [];
    const usedTargetFields = new Set<string>();

    rawHeaders.forEach((colName, colIdx) => {
      if (!colName) return;
      const normColName = this.normalizeString(colName);
      
      // Lấy giá trị mẫu từ hàng dữ liệu đầu tiên
      const sampleValue = dataRows.length > 0 && dataRows[0][colIdx] !== undefined 
        ? String(dataRows[0][colIdx]).trim() 
        : '';

      // Tìm trường mục tiêu phù hợp nhất
      let bestMatch: { field: string; label: string; confidence: 'EXACT' | 'HIGH' | 'FUZZY' } | null = null;

      // 1. Khớp tuyệt đối (Exact match sau khi chuẩn hóa không dấu)
      for (const def of TARGET_FIELD_DEFINITIONS) {
        if (usedTargetFields.has(def.field)) continue;

        for (const alias of def.aliases) {
          const normAlias = this.normalizeString(alias);
          if (normColName === normAlias) {
            bestMatch = { field: def.field, label: def.label, confidence: 'EXACT' };
            break;
          }
        }
        if (bestMatch) break;
      }

      // 2. Khớp cao (High: chứa cụm từ hoặc cụm từ chứa tên cột)
      if (!bestMatch) {
        for (const def of TARGET_FIELD_DEFINITIONS) {
          if (usedTargetFields.has(def.field)) continue;

          for (const alias of def.aliases) {
            const normAlias = this.normalizeString(alias);
            if (normAlias.length >= 3 && (normColName.includes(normAlias) || (normColName.length >= 3 && normAlias.includes(normColName)))) {
              bestMatch = { field: def.field, label: def.label, confidence: 'HIGH' };
              break;
            }
          }
          if (bestMatch) break;
        }
      }

      if (bestMatch) {
        usedTargetFields.add(bestMatch.field);
        columnMappings.push({
          excelColumn: colName,
          excelColumnIndex: colIdx,
          sampleValue,
          targetField: bestMatch.field,
          targetFieldLabel: bestMatch.label,
          isMatched: true,
          matchConfidence: bestMatch.confidence,
        });
      } else {
        columnMappings.push({
          excelColumn: colName,
          excelColumnIndex: colIdx,
          sampleValue,
          targetField: '',
          targetFieldLabel: 'Chưa ghép (Bỏ qua)',
          isMatched: false,
          matchConfidence: 'NONE',
        });
      }
    });

    // Tự động nhận diện cột Họ & Tên nếu chưa cột nào khớp fullName hoặc firstName
    const hasNameMatched = columnMappings.some(m => m.isMatched && (m.targetField === 'fullName' || m.targetField === 'firstName'));
    if (!hasNameMatched && dataRows.length > 0) {
      for (const mapping of columnMappings) {
        if (!mapping.isMatched) {
          let nameLikeCount = 0;
          const checkCount = Math.min(6, dataRows.length);
          for (let r = 0; r < checkCount; r++) {
            const val = String(dataRows[r][mapping.excelColumnIndex] || '').trim();
            const words = val.split(/\s+/);
            if (words.length >= 2 && words.length <= 6 && !/^\d+$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val) && !val.includes('/') && !val.includes('@')) {
              nameLikeCount++;
            }
          }
          if (nameLikeCount >= Math.min(2, checkCount)) {
            mapping.targetField = 'fullName';
            mapping.targetFieldLabel = 'Họ Và Tên (Đầy Đủ)';
            mapping.isMatched = true;
            mapping.matchConfidence = 'FUZZY';
            usedTargetFields.add('fullName');
            break;
          }
        }
      }
    }

    const unmappedColumns = columnMappings.filter(m => !m.isMatched).map(m => m.excelColumn);

    // Chuyển đổi dữ liệu các hàng thành đối tượng Employee chuẩn
    const { parsedEmployees, departmentsFound } = this.extractEmployeesFromData(dataRows, columnMappings, departments);

    return {
      fileName,
      sheetNames,
      selectedSheet,
      totalRawRows: dataRows.length,
      columnMappings,
      unmappedColumns,
      parsedEmployees,
      departmentsFound,
      errors: [],
      rawRows: dataRows,
    };
  }

  /**
   * Trích xuất danh sách nhân sự từ các hàng dữ liệu dựa trên bảng ghép cột (ColumnMapping[])
   * Hàm này cho phép giao diện tính toán lại danh sách nhân sự ngay tức thì khi người dùng thay đổi cột ghép!
   */
  public static extractEmployeesFromData(
    dataRows: any[][],
    columnMappings: ColumnMapping[],
    departments: Department[] = INITIAL_DEPARTMENTS
  ): {
    parsedEmployees: Employee[];
    departmentsFound: { deptName: string; count: number; matchedId: string }[];
  } {
    const parsedEmployees: Employee[] = [];
    const deptStatsMap = new Map<string, { count: number; dept: Department }>();
    let currentSectionDept: Department | null = null;

    dataRows.forEach((row, rowIdx) => {
      if (!Array.isArray(row) || row.length === 0) return;

      const getVal = (targetField: string): string => {
        const mapping = columnMappings.find(m => m.targetField === targetField);
        if (!mapping || mapping.excelColumnIndex === undefined) return '';
        const val = row[mapping.excelColumnIndex];
        return val !== undefined && val !== null ? String(val).trim() : '';
      };

      // 1. Kiểm tra dòng phân mục đơn vị (ví dụ: "I. PHÒNG HÀNH CHÍNH - TỔNG HỢP")
      const nonBlankCells = row.map(c => String(c || '').trim()).filter(Boolean);
      if (nonBlankCells.length === 1 || (nonBlankCells.length <= 2 && /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+)\./i.test(nonBlankCells[0]))) {
        const text = nonBlankCells[0];
        const matched = this.matchDepartment(text, departments);
        if (matched) {
          currentSectionDept = matched;
          return; // Dòng phân mục, không tính vào hồ sơ nhân sự
        }
      }

      // 2. Tìm họ tên: ưu tiên trường fullName, nếu không có thì ghép lastName + firstName
      let fullName = getVal('fullName');
      if (!fullName) {
        const last = getVal('lastName');
        const first = getVal('firstName');
        if (last || first) {
          fullName = `${last} ${first}`.trim();
        }
      }

      // Nếu người dùng chưa chọn cột Họ và Tên, thử tìm ô có họ tên người
      if (!fullName) {
        const hasNameMapping = columnMappings.some(m => m.targetField === 'fullName' || m.targetField === 'firstName');
        if (!hasNameMapping) {
          for (let i = 0; i < row.length; i++) {
            const cell = String(row[i] || '').trim();
            const words = cell.split(/\s+/);
            if (words.length >= 2 && words.length <= 5 && !/^\d+$/.test(cell) && !cell.toLowerCase().startsWith('tổng cộng') && !cell.toLowerCase().startsWith('tong cong')) {
              fullName = cell;
              break;
            }
          }
        }
      }

      // Bỏ qua nếu không có họ tên hoặc là dòng tổng cộng / người lập biểu
      if (!fullName) return;
      const lowerName = fullName.toLowerCase();
      if (
        lowerName.startsWith('tổng cộng') || 
        lowerName.startsWith('tong cong') || 
        lowerName.startsWith('cộng') ||
        lowerName.startsWith('người lập') ||
        lowerName.startsWith('chi cục trưởng') ||
        lowerName.startsWith('kế toán')
      ) {
        return;
      }

      let code = getVal('code');
      if (!code || code === '' || !isNaN(Number(code))) {
        // Tự tạo mã chuẩn NV-YYYYMMDD-XXXX nếu không có hoặc là số thứ tự
        const year = 1980 + (rowIdx % 20);
        const codeNum = String(rowIdx + 1).padStart(4, '0');
        code = `NV-${year}0101-${codeNum}`;
      }

      const positionTitle = getVal('positionTitle') || 'Chuyên viên';
      const posNorm = this.normalizeString(positionTitle);

      const rawDept = getVal('departmentName');
      let dept = rawDept ? this.matchDepartment(rawDept, departments) : (currentSectionDept || departments[0]);
      if (
        posNorm.includes('chi cuc truong') || posNorm.includes('chi cuc pho') ||
        posNorm.includes('pho chi cuc truong') || posNorm.includes('truong chi cuc') ||
        posNorm.includes('pho truong chi cuc') || posNorm.includes('quyen chi cuc truong') ||
        posNorm.includes('phu trach chi cuc') || posNorm === 'cct' || posNorm === 'pcct'
      ) {
        dept = departments.find(d => d.id === 'BAN_LANH_DAO') || departments[0];
      }

      // Thống kê đơn vị
      const currentStats = deptStatsMap.get(dept.id) || { count: 0, dept };
      currentStats.count++;
      deptStatsMap.set(dept.id, currentStats);

      const rawGender = getVal('gender').toLowerCase();
      const gender = rawGender.includes('nữ') || rawGender === 'f' || rawGender === 'female' ? 'Nữ' : 'Nam';

      const dob = this.formatDateString(getVal('dob')) || '1985-05-15';
      const cccd = getVal('cccd') || `079${String(100000000 + rowIdx)}`;
      const jobRankCode = getVal('jobRankCode') || '01.003';
      const jobRankName = getVal('jobRankName') || 'Chuyên viên';
      const staffTypeRaw = (getVal('staffType') || '').trim();
      const normStaff = staffTypeRaw.toLowerCase();
      let staffType: StaffType = 'Khác' as any;

      if (normStaff.includes('viên chức') || normStaff.includes('vien chuc')) {
        staffType = 'Viên chức';
      } else if (normStaff.includes('công chức') || normStaff.includes('cong chuc')) {
        staffType = 'Công chức';
      } else if (normStaff.includes('68') || normStaff.includes('111') || normStaff.includes('hđ 68') || normStaff.includes('hd 68')) {
        staffType = 'Hợp đồng 68/111';
      } else if (normStaff.includes('thú y px') || normStaff.includes('phường xã') || normStaff.includes('phuong xa')) {
        staffType = 'Nhân viên Thú y PX' as any;
      } else if (normStaff.includes('khoán') || normStaff.includes('khoan')) {
        staffType = 'Khoán chuyên môn' as any;
      } else if (normStaff.includes('hợp đồng') || normStaff.includes('hop dong') || normStaff.includes('hđld') || normStaff.includes('hdld')) {
        staffType = 'Hợp đồng lao động';
      } else if (staffTypeRaw) {
        staffType = staffTypeRaw as any;
      } else {
        // Nếu không có dữ liệu cột Loại nhân sự, phân loại thận trọng:
        if (jobRankCode.startsWith('01.') && !jobRankName.toLowerCase().includes('khoán')) {
          staffType = 'Công chức';
        } else if (jobRankCode.startsWith('V.') || jobRankCode.startsWith('09.')) {
          staffType = 'Viên chức';
        } else {
          staffType = 'Khác' as any;
        }
      }

      // Xử lý lương & phụ cấp (Hệ số thập phân Decimal & Mức lương cơ sở)
      const stepRaw = parseFloat(getVal('salary.step'));
      const step = !isNaN(stepRaw) && stepRaw > 0 ? Math.round(stepRaw) : 3;

      const coefRaw = parseDecimalNumber(getVal('salary.coefficient'), 0);
      const defaultCoeff = JobRankService.getRankByCode(jobRankCode)?.defaultCoefficient || 2.34;
      const coefficient = coefRaw > 0 ? coefRaw : defaultCoeff;

      const leadershipAllowance = parseDecimalNumber(getVal('salary.leadershipAllowance'), 0.0);

      const seniorityAllowancePercent = parseDecimalNumber(getVal('salary.seniorityAllowancePercent'), 0);

      const baseSalary = parseBaseSalary(getVal('salary.baseSalary'), DEFAULT_BASE_SALARY);

      const industryAllowancePercent = parseDecimalNumber(getVal('salary.industryAllowancePercent'), 10);

      const publicServiceAllowancePercent = parseDecimalNumber(getVal('salary.publicServiceAllowancePercent'), 25);

      // Xử lý trình độ chuyên môn
      const highestDegreeRaw = getVal('education.highestDegree');
      let highestDegree: DegreeLevel = 'Đại học';
      if (highestDegreeRaw.includes('Tiến sĩ')) highestDegree = 'Tiến sĩ';
      else if (highestDegreeRaw.includes('Thạc sĩ')) highestDegree = 'Thạc sĩ';
      else if (highestDegreeRaw.includes('Cao đẳng')) highestDegree = 'Cao đẳng';
      else if (highestDegreeRaw.includes('Trung cấp')) highestDegree = 'Trung cấp';
      else if (highestDegreeRaw.includes('Sơ cấp')) highestDegree = 'Sơ cấp';
      else if (highestDegreeRaw.includes('Khác')) highestDegree = 'Khác';

      const major = getVal('education.major') || 'Bác sĩ Thú y';
      const school = getVal('education.school') || 'Đại học Nông Lâm TP.HCM';
      const gradYearRaw = parseInt(getVal('education.gradYear'), 10);
      const gradYear = !isNaN(gradYearRaw) && gradYearRaw > 1970 ? gradYearRaw : 2010;

      const politicalTheoryRaw = getVal('education.politicalTheory');
      let politicalTheory: PoliticalTheoryLevel = 'Sơ cấp';
      if (politicalTheoryRaw.includes('Cao cấp')) politicalTheory = 'Cao cấp';
      else if (politicalTheoryRaw.includes('Trung cấp')) politicalTheory = 'Trung cấp';

      const veterinaryCert = getVal('education.veterinaryCert') || 'Chứng chỉ hành nghề Thú y & Kiểm dịch động vật';

      const emp: Employee = {
        id: `emp-excel-${Date.now()}-${rowIdx}`,
        code,
        fullName,
        gender,
        dob,
        cccd,
        cccdDate: this.formatDateString(getVal('cccdDate')) || '2021-05-10',
        cccdPlace: getVal('cccdPlace') || 'Cục Cảnh sát QLHC về TTXH',
        hometown: getVal('hometown') || 'TP. Hồ Chí Minh',
        birthplace: getVal('hometown') || 'TP. Hồ Chí Minh',
        address: getVal('address') || 'TP. Hồ Chí Minh',
        phone: getVal('phone') || '0903 000 000',
        email: getVal('email') || `${this.normalizeString(fullName).replace(/\s+/g, '.')}@chicuc.gov.vn`,
        maritalStatus: 'Đã kết hôn',
        ethnicity: 'Kinh',
        religion: 'Không',
        departmentId: dept.id,
        departmentName: dept.name,
        positionTitle,
        jobRankCode,
        jobRankName,
        staffType,
        recruitmentDate: this.formatDateString(getVal('recruitmentDate')) || '2015-09-01',
        agencyJoinDate: this.formatDateString(getVal('recruitmentDate')) || '2015-09-01',
        industryDate: this.formatDateString(getVal('recruitmentDate')) || '2015-09-01',
        officialDate: this.formatDateString(getVal('officialDate')) || '2016-09-01',
        partyJoinDate: this.formatDateString(getVal('partyJoinDate')),
        socialInsuranceNumber: getVal('socialInsuranceNumber') || `79${String(10000000 + rowIdx)}`,
        healthInsuranceNumber: getVal('healthInsuranceNumber') || `GD479${String(10000000 + rowIdx)}`,
        stateManagementLevel: 'Chuyên viên',
        practicingCertNumber: veterinaryCert !== 'Không' ? `TY-HCM-${2020 + (rowIdx % 5)}-${code}` : undefined,
        status: (getVal('status') as WorkStatus) || 'Đang công tác',
        leaveDate: this.formatDateString(getVal('leaveDate')) || undefined,
        salary: {
          rankCode: jobRankCode,
          rankName: jobRankName,
          step,
          maxStep: 10,
          coefficient,
          effectiveDate: '2024-01-01',
          leadershipAllowance,
          seniorityAllowancePercent,
          otherAllowance: 0,
          nextSalaryIncreaseDate: getVal('salary.nextSalaryIncreaseDate') || '2027-01-01',
          baseSalary,
          industryAllowancePercent,
          publicServiceAllowancePercent,
        },
        education: {
          highestDegree,
          major,
          school,
          gradYear,
          politicalTheory,
          foreignLanguage: getVal('education.foreignLanguage') || 'Tiếng Anh B1',
          informatics: getVal('education.informatics') || 'Chuẩn CNTT cơ bản',
          veterinaryCert,
          otherCerts: [],
        },
        workHistory: [
          {
            id: `wh-${Date.now()}-${rowIdx}`,
            employeeId: `emp-excel-${Date.now()}-${rowIdx}`,
            startDate: '2018-01-01',
            endDate: 'Nay',
            unitName: dept.name,
            position: positionTitle,
            decisionNumber: '',
            decisionDate: '2018-01-01',
            signedBy: 'Chi Cục Trưởng',
            notes: 'Điều động theo vị trí đề án vị trí việc làm',
          }
        ],
        salaryHistory: [
          {
            id: `sh-${Date.now()}-${rowIdx}`,
            employeeId: `emp-excel-${Date.now()}-${rowIdx}`,
            step,
            coefficient,
            effectiveDate: '2024-01-01',
            decisionNumber: '',
            decisionDate: '2024-01-01',
            type: 'Định kỳ',
          }
        ],
        trainingHistory: [],
        rewardDiscipline: [],
        documents: [],
        driveFolderLink: undefined,
        updatedAt: new Date().toISOString(),
      };

      parsedEmployees.push(emp);
    });

    const departmentsFound = Array.from(deptStatsMap.values()).map(item => ({
      deptName: item.dept.name,
      count: item.count,
      matchedId: item.dept.id,
    }));

    return { parsedEmployees, departmentsFound };
  }

  /**
   * Định dạng chuỗi ngày tháng từ nhiều định dạng khác nhau sang YYYY-MM-DD
   */
  private static formatDateString(rawDate: string): string {
    if (!rawDate || !rawDate.trim()) return '';
    const clean = rawDate.trim();

    // Nếu đã là YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

    // Nếu dạng DD/MM/YYYY
    const dmyMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }

    // Nếu chỉ có năm YYYY
    if (/^\d{4}$/.test(clean)) {
      return `${clean}-01-01`;
    }

    // Parse thử Date
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return clean;
  }

  /**
   * Tạo tệp mẫu Excel "BANG LUONG TOAN CHI CUC .xlsx" với sheet "DM NHAN VIEN"
   * Chứa đầy đủ các cột tương ứng và danh sách cán bộ mẫu chuẩn Chi cục
   */
  public static generateSampleWorkbook(): ArrayBuffer {
    const headers = [
      'STT',
      'MÃ NHÂN VIÊN',
      'HỌ VÀ TÊN',
      'GIỚI TÍNH',
      'NGÀY SINH',
      'SỐ CCCD',
      'ĐƠN VỊ / PHÒNG / TRẠM',
      'CHỨC VỤ',
      'MÃ NGẠCH',
      'TÊN NGẠCH',
      'LOẠI NHÂN SỰ',
      'BẬC LƯƠNG',
      'HỆ SỐ LƯƠNG',
      'PCCV',
      'PCTN (%)',
      'TRÌNH ĐỘ CHUYÊN MÔN',
      'CHUYÊN NGÀNH',
      'TRƯỜNG ĐÀO TẠO',
      'NĂM TỐT NGHIỆP',
      'CHỨNG CHỈ HÀNH NGHỀ THÚ Y',
      'LÝ LUẬN CHÍNH TRỊ',
      'SỐ ĐIỆN THOẠI',
      'EMAIL',
      'QUÊ QUÁN',
      'NƠI Ở HIỆN NAY',
      'NGÀY TUYỂN DỤNG',
      'NGÀY VÀO BIÊN CHẾ',
      'NGÀY NÂNG LƯƠNG TIẾP THEO',
      'TRẠNG THÁI'
    ];

    const sampleRows = [
      [
        1, 'NV-19750312-0001', 'Trần Phú Cường', 'Nam', '1975-03-12', '079175001234',
        'Ban Lãnh đạo Chi cục', 'Chi cục Trưởng', '01.002', 'Chuyên viên chính', 'Công chức',
        6, 5.76, 0.90, 22, 'Thạc sĩ', 'Thú y Cộng đồng', 'ĐH Nông Lâm TP.HCM', 1998,
        'Chứng chỉ Chẩn đoán & Dịch tễ học Thú y cấp cao', 'Cao cấp', '0903855001', 'cuong.tp@chicuc.gov.vn',
        'Bến Tre', 'Quận 11, TP.HCM', '1999-01-15', '2000-01-15', '2026-07-01', 'Đang công tác'
      ],
      [
        2, 'NV-19780820-0002', 'Nguyễn Trường Giang', 'Nam', '1978-08-20', '079178002345',
        'Ban Lãnh đạo Chi cục', 'Phó Chi cục Trưởng', '01.002', 'Chuyên viên chính', 'Công chức',
        5, 5.42, 0.70, 18, 'Thạc sĩ', 'Bác sĩ Thú y', 'ĐH Nông Lâm TP.HCM', 2001,
        'Chứng chỉ Giám sát Dịch bệnh Thú y', 'Cao cấp', '0903855002', 'giang.nt@chicuc.gov.vn',
        'Tiền Giang', 'Quận Bình Tân, TP.HCM', '2002-03-01', '2003-03-01', '2026-11-01', 'Đang công tác'
      ],
      [
        3, 'NV-19811105-0003', 'Huỳnh Thanh Sử', 'Nam', '1981-11-05', '079181003456',
        'Ban Lãnh đạo Chi cục', 'Phó Chi cục Trưởng', '01.002', 'Chuyên viên chính', 'Công chức',
        4, 5.08, 0.70, 15, 'Tiến sĩ', 'Chăn nuôi - Thú y', 'ĐH Cần Thơ', 2004,
        'Chứng chỉ An toàn Vệ sinh Thú y Quốc gia', 'Trung cấp', '0903855003', 'su.ht@chicuc.gov.vn',
        'Long An', 'Quận 7, TP.HCM', '2005-06-15', '2006-06-15', '2027-06-15', 'Đang công tác'
      ],
      [
        4, 'NV-19830415-0004', 'Trần Văn Hoàng', 'Nam', '1983-04-15', '079183004567',
        'Phòng Hành chính - Tổng hợp', 'Trưởng phòng', '01.002', 'Chuyên viên chính', 'Công chức',
        4, 5.08, 0.50, 14, 'Thạc sĩ', 'Quản lý Công', 'Học viện Hành chính Quốc gia', 2006,
        'Chứng chỉ Quản lý Nhà nước ngạch CVC', 'Trung cấp', '0903855004', 'hoang.tv@chicuc.gov.vn',
        'TP.HCM', 'Quận Tân Bình, TP.HCM', '2007-02-01', '2008-02-01', '2027-02-01', 'Đang công tác'
      ],
      [
        5, 'NV-19860925-0005', 'Lê Thị Thu Thủy', 'Nữ', '1986-09-25', '079186005678',
        'Phòng Hành chính - Tổng hợp', 'Phó Trưởng phòng', '01.003', 'Chuyên viên', 'Công chức',
        5, 3.66, 0.30, 10, 'Đại học', 'Kế toán Tài chính', 'ĐH Kinh tế TP.HCM', 2008,
        'Chứng chỉ Kế toán Trưởng Hành chính Sự nghiệp', 'Trung cấp', '0903855005', 'thuy.ltt@chicuc.gov.vn',
        'Đồng Nai', 'Quận 10, TP.HCM', '2009-08-10', '2010-08-10', '2026-08-10', 'Đang công tác'
      ],
      [
        6, 'NV-19820718-0006', 'Phạm Minh Đức', 'Nam', '1982-07-18', '079182006789',
        'Phòng Kiểm tra chuyên ngành', 'Trưởng phòng', '01.002', 'Chuyên viên chính', 'Công chức',
        4, 5.08, 0.50, 14, 'Đại học', 'Bác sĩ Thú y', 'ĐH Nông Lâm TP.HCM', 2005,
        'Chứng chỉ Thanh tra - Kiểm tra chuyên ngành Nông nghiệp', 'Trung cấp', '0903855006', 'duc.pm@chicuc.gov.vn',
        'Bình Dương', 'Quận Phú Nhuận, TP.HCM', '2006-10-01', '2007-10-01', '2026-10-01', 'Đang công tác'
      ],
      [
        7, 'NV-19841203-0007', 'Nguyễn Tấn Đạt', 'Nam', '1984-12-03', '079184007890',
        'Phòng Quản lý Chăn nuôi', 'Trưởng phòng', '01.003', 'Chuyên viên', 'Công chức',
        5, 3.66, 0.50, 11, 'Thạc sĩ', 'Chăn nuôi', 'ĐH Nông Lâm TP.HCM', 2007,
        'Chứng chỉ Giống vật nuôi & Thức ăn chăn nuôi', 'Trung cấp', '0903855007', 'dat.nt@chicuc.gov.vn',
        'Tây Ninh', 'Huyện Hóc Môn, TP.HCM', '2008-05-15', '2009-05-15', '2026-05-15', 'Đang công tác'
      ],
      [
        8, 'NV-19850520-0008', 'Bùi Văn Tuấn', 'Nam', '1985-05-20', '079185008901',
        'Phòng Quản lý Dịch bệnh', 'Trưởng phòng', '01.003', 'Chuyên viên', 'Công chức',
        5, 3.66, 0.50, 11, 'Bác sĩ Thú y', 'Dịch tễ học Thú y', 'ĐH Nông Lâm TP.HCM', 2008,
        'Chứng chỉ Chẩn đoán xét nghiệm bệnh truyền nhiễm động vật', 'Trung cấp', '0903855008', 'tuan.bv@chicuc.gov.vn',
        'Bến Tre', 'Quận Bình Thạnh, TP.HCM', '2009-03-01', '2010-03-01', '2026-03-01', 'Đang công tác'
      ],
      [
        9, 'NV-19880310-0009', 'Võ Thị Hồng Loan', 'Nữ', '1988-03-10', '079188009012',
        'Phòng Thú y Cộng đồng', 'Trưởng phòng', '01.003', 'Chuyên viên', 'Công chức',
        4, 3.33, 0.50, 8, 'Bác sĩ Thú y', 'Vệ sinh Thú y & ATTP', 'ĐH Nông Lâm TP.HCM', 2011,
        'Chứng chỉ An toàn sinh học & Kiểm soát giết mổ', 'Sơ cấp', '0903855009', 'loan.vth@chicuc.gov.vn',
        'TP.HCM', 'Quận 3, TP.HCM', '2012-07-01', '2013-07-01', '2027-07-01', 'Đang công tác'
      ],
      [
        10, 'NV-19830614-0010', 'Lý Quốc Cường', 'Nam', '1983-06-14', '079183010123',
        'Trạm Chăn nuôi và Thú y Khu vực 1', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        5, 3.66, 0.40, 12, 'Bác sĩ Thú y', 'Thú y', 'ĐH Nông Lâm TP.HCM', 2006,
        'Chứng chỉ Kiểm dịch Động vật & Sản phẩm động vật', 'Trung cấp', '0903855010', 'cuong.lq@chicuc.gov.vn',
        'TP.HCM', 'Quận 6, TP.HCM', '2007-09-01', '2008-09-01', '2026-09-01', 'Đang công tác'
      ],
      [
        11, 'NV-19800912-0011', 'Lê Minh Trí', 'Nam', '1980-09-12', '079180011234',
        'Trạm Chăn nuôi và Thú y Khu vực 2', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        6, 3.99, 0.40, 16, 'Bác sĩ Thú y', 'Bác sĩ Thú y Thực hành', 'ĐH Nông Lâm TP.HCM', 2003,
        'Chứng chỉ Phòng chống dịch bệnh gia súc gia cầm', 'Trung cấp', '0903855011', 'tri.lm@chicuc.gov.vn',
        'Củ Chi, TP.HCM', 'Thị trấn Củ Chi, TP.HCM', '2004-04-15', '2005-04-15', '2026-04-15', 'Đang công tác'
      ],
      [
        12, 'NV-19821020-0012', 'Đỗ Hữu Thắng', 'Nam', '1982-10-20', '079182012345',
        'Trạm Chăn nuôi và Thú y Khu vực 3', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        5, 3.66, 0.40, 13, 'Bác sĩ Thú y', 'Chăn nuôi - Thú y', 'ĐH Nông Lâm TP.HCM', 2005,
        'Chứng chỉ Giám sát Dịch bệnh Vùng đệm', 'Trung cấp', '0903855012', 'thang.dh@chicuc.gov.vn',
        'Hóc Môn, TP.HCM', 'Xã Tân Thới Nhì, Hóc Môn, TP.HCM', '2006-11-01', '2007-11-01', '2026-11-01', 'Đang công tác'
      ],
      [
        13, 'NV-19850115-0013', 'Dương Văn Hải', 'Nam', '1985-01-15', '079185013456',
        'Trạm Chăn nuôi và Thú y Khu vực 4', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        4, 3.33, 0.40, 10, 'Bác sĩ Thú y', 'Bác sĩ Thú y', 'ĐH Nông Lâm TP.HCM', 2008,
        'Chứng chỉ Hành nghề Thú y Cơ sở', 'Sơ cấp', '0903855013', 'hai.dv@chicuc.gov.vn',
        'Bình Chánh, TP.HCM', 'Tân Túc, Bình Chánh, TP.HCM', '2009-08-01', '2010-08-01', '2027-08-01', 'Đang công tác'
      ],
      [
        14, 'NV-19810508-0014', 'Huỳnh Văn Cảnh', 'Nam', '1981-05-08', '079181014567',
        'Trạm Chăn nuôi và Thú y Khu vực 5', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        5, 3.66, 0.40, 14, 'Bác sĩ Thú y', 'Thú y Thuỷ sản', 'ĐH Thủy sản Nha Trang', 2004,
        'Chứng chỉ Kiểm dịch Động vật Thủy sản', 'Trung cấp', '0903855014', 'canh.hv@chicuc.gov.vn',
        'Cần Giờ, TP.HCM', 'Cần Thạnh, Cần Giờ, TP.HCM', '2005-12-01', '2006-12-01', '2026-12-01', 'Đang công tác'
      ],
      [
        15, 'NV-19831122-0015', 'Nguyễn Văn Hùng', 'Nam', '1983-11-22', '079183015678',
        'Trạm Chăn nuôi và Thú y Khu vực 6', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        5, 3.66, 0.40, 12, 'Bác sĩ Thú y', 'Dịch tễ Thú y', 'ĐH Nông Lâm TP.HCM', 2006,
        'Chứng chỉ Tiêm phòng & Khử trùng tiêu độc', 'Trung cấp', '0903855015', 'hung.nv@chicuc.gov.vn',
        'TP. Thủ Đức, TP.HCM', 'Phường Tăng Nhơn Phú B, TP. Thủ Đức', '2007-06-01', '2008-06-01', '2026-06-01', 'Đang công tác'
      ],
      [
        16, 'NV-19860330-0016', 'Phan Thanh Tùng', 'Nam', '1986-03-30', '079186016789',
        'Trạm Chăn nuôi và Thú y Khu vực 7', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        4, 3.33, 0.40, 9, 'Bác sĩ Thú y', 'Bác sĩ Thú y Đô thị', 'ĐH Nông Lâm TP.HCM', 2009,
        'Chứng chỉ Chăm sóc & Điều trị Thú cưng / Vệ sinh ATTP', 'Sơ cấp', '0903855016', 'tung.pt@chicuc.gov.vn',
        'TP.HCM', 'Quận 4, TP.HCM', '2010-09-01', '2011-09-01', '2027-09-01', 'Đang công tác'
      ],
      [
        17, 'NV-19840819-0017', 'Trần Quang Khải', 'Nam', '1984-08-19', '079184017890',
        'Trạm Chăn nuôi và Thú y Khu vực 8', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        5, 3.66, 0.40, 11, 'Bác sĩ Thú y', 'Vệ sinh Thú y', 'ĐH Nông Lâm TP.HCM', 2007,
        'Chứng chỉ Kiểm soát Cơ sở Giết mổ Gia súc', 'Trung cấp', '0903855017', 'khai.tq@chicuc.gov.vn',
        'Tân Bình, TP.HCM', 'Quận Tân Phú, TP.HCM', '2008-10-15', '2009-10-15', '2026-10-15', 'Đang công tác'
      ],
      [
        18, 'NV-19870104-0018', 'Lê Quốc Dũng', 'Nam', '1987-01-04', '079187018901',
        'Trạm Chăn nuôi và Thú y Khu vực 9', 'Trạm Trưởng', '09.019', 'Kiểm tra viên thú y', 'Công chức',
        4, 3.33, 0.40, 9, 'Bác sĩ Thú y', 'Bác sĩ Thú y', 'ĐH Nông Lâm TP.HCM', 2010,
        'Chứng chỉ Kiểm soát Giết mổ Gia cầm', 'Sơ cấp', '0903855018', 'dung.lq@chicuc.gov.vn',
        'Gò Vấp, TP.HCM', 'Phường 11, Gò Vấp, TP.HCM', '2011-03-01', '2012-03-01', '2027-03-01', 'Đang công tác'
      ],
      [
        19, 'NV-19790422-0019', 'Trịnh Quốc Bảo', 'Nam', '1979-04-22', '079179019012',
        'Trạm Kiểm dịch Động vật An Lạc', 'Trạm Trưởng', '09.018', 'Kiểm dịch viên chính ĐV', 'Công chức',
        6, 5.08, 0.50, 17, 'Bác sĩ Thú y', 'Kiểm dịch Động vật', 'ĐH Nông Lâm TP.HCM', 2002,
        'Chứng chỉ Kiểm dịch Động vật & Vệ sinh Thú y Quốc tế', 'Cao cấp', '0903855019', 'bao.tq@chicuc.gov.vn',
        'Bình Tân, TP.HCM', 'An Lạc, Bình Tân, TP.HCM', '2003-05-01', '2004-05-01', '2026-05-01', 'Đang công tác'
      ],
      [
        20, 'NV-19810815-0020', 'Vũ Đình Trọng', 'Nam', '1981-08-15', '079181020123',
        'Trạm Kiểm dịch Động vật Hóc Môn', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        5, 3.66, 0.40, 14, 'Bác sĩ Thú y', 'Kiểm dịch Động vật', 'ĐH Nông Lâm TP.HCM', 2004,
        'Chứng chỉ Phúc kiểm Động vật Vận chuyển', 'Trung cấp', '0903855020', 'trong.vd@chicuc.gov.vn',
        'Hóc Môn, TP.HCM', 'Tân Hiệp, Hóc Môn, TP.HCM', '2005-09-01', '2006-09-01', '2026-09-01', 'Đang công tác'
      ],
      [
        21, 'NV-19831201-0021', 'Cao Viết Hùng', 'Nam', '1983-12-01', '079183021234',
        'Trạm Kiểm dịch Động vật Thủ Đức', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        5, 3.66, 0.40, 12, 'Bác sĩ Thú y', 'Kiểm dịch Động vật', 'ĐH Nông Lâm TP.HCM', 2006,
        'Chứng chỉ Kiểm dịch Động vật Cửa ngõ Xa lộ Hà Nội', 'Trung cấp', '0903855021', 'hung.cv@chicuc.gov.vn',
        'TP. Thủ Đức, TP.HCM', 'Linh Trung, TP. Thủ Đức, TP.HCM', '2007-08-01', '2008-08-01', '2026-08-01', 'Đang công tác'
      ],
      [
        22, 'NV-19860618-0022', 'Đoàn Văn Nam', 'Nam', '1986-06-18', '079186022345',
        'Trạm Kiểm dịch Động vật Bắc Tân Uyên', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        4, 3.33, 0.40, 9, 'Bác sĩ Thú y', 'Kiểm dịch Thú y', 'ĐH Nông Lâm TP.HCM', 2009,
        'Chứng chỉ Kiểm soát Lưu thông Động vật Tuyến QL13', 'Sơ cấp', '0903855022', 'nam.dv@chicuc.gov.vn',
        'Bình Dương', 'Bắc Tân Uyên, Bình Dương', '2010-07-01', '2011-07-01', '2027-07-01', 'Đang công tác'
      ],
      [
        23, 'NV-19850920-0023', 'Hoàng Đức Thịnh', 'Nam', '1985-09-20', '079185023456',
        'Trạm Kiểm dịch Động vật Châu Đức', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        4, 3.33, 0.40, 10, 'Bác sĩ Thú y', 'Kiểm tra Vệ sinh Thú y', 'ĐH Nông Lâm TP.HCM', 2008,
        'Chứng chỉ Phúc kiểm Động vật Tuyến QL56', 'Sơ cấp', '0903855023', 'thinh.hd@chicuc.gov.vn',
        'Bà Rịa - Vũng Tàu', 'Châu Đức, Bà Rịa - Vũng Tàu', '2009-10-01', '2010-10-01', '2027-10-01', 'Đang công tác'
      ],
      [
        24, 'NV-19871111-0024', 'Lâm Văn Phát', 'Nam', '1987-11-11', '079187024567',
        'Trạm Kiểm dịch Động vật Bình Châu', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        4, 3.33, 0.40, 8, 'Bác sĩ Thú y', 'Kiểm dịch Thú y', 'ĐH Nông Lâm TP.HCM', 2011,
        'Chứng chỉ Kiểm dịch Tuyến QL55', 'Sơ cấp', '0903855024', 'phat.lv@chicuc.gov.vn',
        'Bình Thuận', 'Bình Châu, Xuyên Mộc', '2012-05-01', '2013-05-01', '2027-05-01', 'Đang công tác'
      ],
      [
        25, 'NV-19840228-0025', 'Nguyễn Thành Đạt', 'Nam', '1984-02-28', '079184025678',
        'Trạm Kiểm dịch Động vật Phú Mỹ', 'Trạm Trưởng', '09.019', 'Kiểm dịch viên động vật', 'Công chức',
        5, 3.66, 0.40, 11, 'Bác sĩ Thú y', 'Kiểm dịch Cảng & Xuất nhập khẩu', 'ĐH Nông Lâm TP.HCM', 2007,
        'Chứng chỉ Kiểm dịch Thú y Cảng Biển Quốc tế', 'Trung cấp', '0903855025', 'dat.nt2@chicuc.gov.vn',
        'Bà Rịa - Vũng Tàu', 'Thị xã Phú Mỹ, BR-VT', '2008-08-01', '2009-08-01', '2026-08-01', 'Đang công tác'
      ],
    ];

    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Thêm định dạng cột cơ bản
    ws['!cols'] = [
      { wch: 6 },  // STT
      { wch: 18 }, // Mã NV
      { wch: 25 }, // Họ tên
      { wch: 10 }, // Giới tính
      { wch: 12 }, // Ngày sinh
      { wch: 15 }, // CCCD
      { wch: 32 }, // Đơn vị
      { wch: 22 }, // Chức vụ
      { wch: 12 }, // Mã ngạch
      { wch: 22 }, // Tên ngạch
      { wch: 14 }, // Loại nhân sự
      { wch: 10 }, // Bậc
      { wch: 12 }, // Hệ số
      { wch: 10 }, // PCCV
      { wch: 10 }, // PCTN
      { wch: 18 }, // Trình độ
      { wch: 28 }, // Chuyên ngành
      { wch: 25 }, // Trường
      { wch: 12 }, // Năm TN
      { wch: 45 }, // Chứng chỉ thú y
      { wch: 16 }, // LLCT
      { wch: 14 }, // SĐT
      { wch: 25 }, // Email
      { wch: 18 }, // Quê quán
      { wch: 30 }, // Nơi ở
      { wch: 14 }, // Ngày tuyển dụng
      { wch: 14 }, // Ngày biên chế
      { wch: 16 }, // Hạn nâng lương
      { wch: 14 }, // Trạng thái
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DM NHAN VIEN');

    // Thêm tab phụ để bảng tính chân thực
    const wsSummary = XLSX.utils.aoa_to_sheet([
      ['BẢNG TỔNG HỢP BIÊN CHẾ VÀ LƯƠNG TOÀN CHI CỤC CHĂN NUÔI VÀ THÚ Y TP.HCM'],
      ['Năm thực hiện: 2026'],
      ['Tổng số đơn vị trực thuộc: 23 đơn vị'],
      ['Số lượng biên chế phân bổ: 350'],
      ['Dữ liệu trích xuất từ phần mềm Nhân sự và Tiền lương']
    ]);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'TONG_HOP_LUONG');

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  }
}
