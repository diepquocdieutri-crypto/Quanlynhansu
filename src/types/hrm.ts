export type Gender = 'Nam' | 'Nữ';

export type StaffType = 
  | 'Công chức' 
  | 'Viên chức' 
  | 'Hợp đồng 111' 
  | 'Nhân viên Thú y PX' 
  | 'Khoán chuyên môn' 
  | 'Khác'
  | 'Hợp đồng lao động'
  | 'Hợp đồng 68/111';

export type WorkStatus = 
  | 'Đang công tác' 
  | 'Nghỉ hưu' 
  | 'Thôi việc' 
  | 'Chuyển công tác' 
  | 'Nghỉ không lương / Tạm hoãn'
  | 'Biệt phái';

export type DegreeLevel = 'Tiến sĩ' | 'Thạc sĩ' | 'Đại học' | 'Cao đẳng' | 'Trung cấp' | 'Sơ cấp' | 'Khác';

export type PoliticalTheoryLevel = 'Cao cấp' | 'Trung cấp' | 'Sơ cấp' | 'Chưa qua bồi dưỡng';

export interface SalaryInfo {
  rankCode: string; // e.g. 01.003 - Chuyên viên
  rankName: string;
  step: number; // Bậc lương (1 -> 12)
  maxStep: number;
  coefficient: number; // Hệ số lương (ví dụ: 2.34, 4.40...)
  effectiveDate: string; // Ngày hưởng
  leadershipAllowance: number; // Phụ cấp chức vụ (hệ số, vd: 0.7)
  seniorityAllowancePercent: number; // Phụ cấp thâm niên nghề (%)
  otherAllowance: number; // Phụ cấp trách nhiệm / độc hại
  nextSalaryIncreaseDate: string; // Ngày dự kiến nâng bậc tiếp theo
  baseSalary?: number; // Mức lương cơ sở (VNĐ, mặc định: 2.530.000 VNĐ)
  industryAllowancePercent?: number; // Phụ cấp ưu đãi ngành (%), mặc định 10%
  publicServiceAllowancePercent?: number; // Phụ cấp công vụ (%), mặc định 25%
  beyondFramePercent?: number; // Thâm niên vượt khung (%)
  responsibilityAllowance?: number; // Phụ cấp trách nhiệm (hệ số)
  travelAllowance?: number; // Phụ cấp công tác phí / lưu động (VNĐ)
}

export type PayrollCategory = 'CONG_CHUC' | 'VIEN_CHUC' | 'HOP_DONG_111' | 'THU_Y_PX' | 'KHOAN_CM';

export interface MonthlyPayrollRecord {
  employeeId: string;
  code: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  leadershipTitle: string;
  jobRankCode: string;
  jobRankName: string;
  staffType: StaffType;
  category: PayrollCategory;
  
  baseSalary: number; // Mức lương cơ sở áp dụng (VNĐ)
  coefficient: number; // Hệ số lương (HSL)
  salaryAmount: number; // Thành tiền lương theo HSL = HSL * MLCS
  
  beyondFramePercent: number; // Thâm niên vượt khung (%)
  beyondFrameAmount: number; // Thành tiền TNVK = HSL * TNVK% * MLCS
  
  leadershipAllowanceCoeff: number; // Hệ số chức vụ (HSCV)
  leadershipAllowanceAmount: number; // Thành tiền HSCV = HSCV * MLCS
  
  responsibilityAllowanceCoeff: number; // Phụ cấp trách nhiệm (HS)
  responsibilityAllowanceAmount: number; // Thành tiền PC trách nhiệm = HS * MLCS
  
  industryAllowancePercent: number; // Phụ cấp ưu đãi ngành (%)
  industryAllowanceAmount: number; // Thành tiền UDN
  
  travelAllowanceAmount: number; // Phụ cấp công tác phí / lưu động (VNĐ)
  
  publicServiceAllowancePercent: number; // Phụ cấp công vụ (%)
  publicServiceAllowanceAmount: number; // Thành tiền PCCV
  
  totalAllowanceCoeff: number; // Tổng HS Phụ cấp
  totalAllowanceAmount: number; // Tổng tiền phụ cấp
  
  totalGrossIncome: number; // Tổng thu nhập trước trích nộp
  
  insuranceSalaryBase: number; // Tiền lương làm căn cứ đóng BHXH
  socialInsuranceEmp: number; // BHXH trừ lương (8%)
  healthInsuranceEmp: number; // BHYT trừ lương (1.5%)
  unemploymentInsuranceEmp: number; // BHTN trừ lương (1% hoặc 0%)
  totalDeductions: number; // Tổng các khoản trích nộp BHXH theo quy định
  
  netSalary: number; // Tổng lương thực nhận
  month: number;
  year: number;
  periodKey: string; // ví dụ: "10/2026"
  calculatedAt?: string;
  notes?: string;
}

export interface EmployeeIncomeFluctuation {
  periodKey: string;
  month: number;
  year: number;
  baseSalary: number;
  baseSalaryChange?: number; // chênh lệch MLCS so với kỳ trước (ví dụ: +190.000 đ)
  coefficient: number;
  salaryAmount: number;
  leadershipAllowanceCoeff: number;
  leadershipAllowanceAmount: number;
  beyondFramePercent: number;
  beyondFrameAmount: number;
  responsibilityAllowanceAmount: number;
  industryAllowancePercent?: number;
  industryAllowanceAmount: number;
  publicServiceAllowanceAmount: number;
  travelAllowanceAmount: number;
  totalAllowanceAmount: number;
  totalGrossIncome: number;
  totalDeductions: number;
  netSalary: number;
  coefficientChange?: number; // chênh lệch HSL so với tháng trước
  netSalaryChange?: number; // chênh lệch thực nhận so với tháng trước
  changeDescription?: string; // Diễn giải nguyên nhân biến động (Nâng bậc lương, Đổi lương cơ sở, v.v.)
}

export interface EmployeeCumulativeIncomeReport {
  employeeId: string;
  code: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  jobRankCode: string;
  jobRankName: string;
  category: PayrollCategory;
  fromPeriod: string;
  toPeriod: string;
  monthCount: number;
  
  totalSalaryAmount: number;
  totalBeyondFrameAmount: number;
  totalLeadershipAllowanceAmount: number;
  totalResponsibilityAllowanceAmount: number;
  totalIndustryAllowanceAmount: number;
  totalTravelAllowanceAmount: number;
  totalPublicServiceAllowanceAmount: number;
  totalAllowanceAmount: number;
  totalGrossIncome: number;
  
  totalSocialInsurance: number;
  totalHealthInsurance: number;
  totalUnemploymentInsurance: number;
  totalDeductions: number;
  
  totalNetSalary: number;
  averageMonthlyNetSalary: number;
  
  monthlyFluctuations: EmployeeIncomeFluctuation[];
}

export interface EducationInfo {
  highestDegree: DegreeLevel;
  major: string; // Chuyên ngành: Bác sĩ Thú y, Chăn nuôi, Luật...
  school: string;
  gradYear: number;
  politicalTheory: PoliticalTheoryLevel;
  foreignLanguage: string; // B1, B2, IELTS, Tiếng Anh C...
  informatics: string; // Chuẩn CNTT cơ bản/nâng cao
  veterinaryCert: string; // Chứng chỉ hành nghề thú y / kiểm dịch viên
  otherCerts: string[];
}

export interface WorkHistoryRecord {
  id: string;
  employeeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or 'Nay'
  unitName: string; // Đơn vị công tác
  position: string; // Chức vụ
  decisionNumber?: string; // Quyết định số
  decisionDate?: string;
  signedBy?: string;
  notes?: string;
}

export interface SalaryHistoryRecord {
  id: string;
  employeeId: string;
  step: number;
  coefficient: number;
  effectiveDate: string;
  decisionNumber: string;
  decisionDate: string;
  type: 'Định kỳ' | 'Trước thời hạn' | 'Vượt khung';
  notes?: string;
}

export interface TrainingRecord {
  id: string;
  employeeId: string;
  courseName: string;
  institution: string;
  startDate: string;
  endDate: string;
  form: 'Tập trung' | 'Bán tập trung' | 'Trực tuyến';
  certificateName?: string;
  certificateUrl?: string;
  driveFileId?: string;
}

export interface RewardDisciplineRecord {
  id: string;
  employeeId: string;
  type: 'Khen thưởng' | 'Kỷ luật';
  form: string; // Bằng khen UBND TPHCM, Chiến sĩ thi đua, Khiển trách...
  decisionNumber: string;
  decisionDate: string;
  signLevel: string; // UBND TPHCM, Sở Nông nghiệp & PTNT, Chi cục...
  reason: string;
  fileUrl?: string;
  driveFileId?: string;
}

export interface DocumentRecord {
  id: string;
  employeeId: string;
  title: string;
  type: 'CCCD' | 'Sơ yếu lý lịch 2C' | 'Bằng tốt nghiệp' | 'Chứng chỉ thú y' | 'Quyết định bổ nhiệm' | 'Quyết định nâng lương' | 'Hợp đồng' | 'Khác';
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  fileUrl?: string; // data uri or preview link
  driveFileId?: string;
  driveViewLink?: string;
  uploadedAt: string;
}

export interface Employee {
  id: string; // Internal UUID
  code: string; // NV-19850510-0001
  fullName: string;
  gender: Gender;
  dob: string; // YYYY-MM-DD
  cccd: string;
  cccdDate: string;
  cccdPlace: string;
  hometown: string; // Quê quán
  birthplace: string; // Nơi sinh
  address: string; // Nơi ở hiện nay
  phone: string;
  email: string;
  maritalStatus: 'Độc thân' | 'Đã kết hôn' | 'Khác';
  ethnicity: string; // Dân tộc: Kinh, Hoa...
  religion: string; // Tôn giáo
  avatarUrl?: string;

  // Công tác
  departmentId: string;
  departmentName: string;
  positionTitle: string; // Chi cục trưởng, Trưởng phòng, Trạm trưởng, Chuyên viên...
  jobRankCode: string; // 01.003
  jobRankName: string; // Chuyên viên, Kiểm dịch viên thú y...
  staffType: StaffType;
  recruitmentDate: string; // Ngày tuyển dụng
  agencyJoinDate: string; // Ngày vào cơ quan (Chi cục)
  industryDate: string; // Ngày vào ngành thú y
  officialDate: string; // Ngày vào biên chế chính thức
  partyJoinDate?: string; // Ngày vào Đảng
  partyOfficialDate?: string; // Ngày chính thức vào Đảng
  partyCardNumber?: string; // Số thẻ Đảng viên
  socialInsuranceNumber?: string; // Số sổ BHXH
  healthInsuranceNumber?: string; // Mã thẻ BHYT
  stateManagementLevel?: string; // Bồi dưỡng Quản lý nhà nước (Chuyên viên chính, Chuyên viên...)
  practicingCertNumber?: string; // Số chứng chỉ hành nghề thú y
  status: WorkStatus;
  leaveDate?: string; // Ngày bắt đầu nghỉ (Nghỉ hưu / Thôi việc) YYYY-MM-DD
  leaveReason?: string; // Lý do nghỉ: Hưu trí theo tuổi, Thôi việc theo nguyện vọng, Tinh giản biên chế...
  leaveDecisionNumber?: string; // Số quyết định nghỉ hưu / thôi việc

  // Module lương & chuyên môn
  salary: SalaryInfo;
  education: EducationInfo;

  // Lịch sử & tệp đính kèm
  workHistory: WorkHistoryRecord[];
  salaryHistory: SalaryHistoryRecord[];
  trainingHistory: TrainingRecord[];
  rewardDiscipline: RewardDisciplineRecord[];
  documents: DocumentRecord[];

  // Google Drive
  driveFolderId?: string;
  driveFolderLink?: string;

  notes?: string;
  updatedAt: string;
}

export type DepartmentType = 
  | 'BAN_LANH_DAO' 
  | 'PHONG_CHUYEN_MON' 
  | 'TRAM_THU_Y' 
  | 'TRAM_KIEM_DICH' 
  | 'TRUNG_TAM';

export interface Department {
  id: string;
  code: string;
  name: string;
  type: DepartmentType;
  parentId?: string;
  leaderName: string; // Trưởng đơn vị
  deputyLeaderName: string; // Phó đơn vị
  address: string;
  phone: string;
  email: string;
  allocatedQuota: number; // Chỉ tiêu biên chế giao
  status: 'Đang hoạt động' | 'Tạm dừng';
}

export interface Decision {
  id: string;
  number: string; // Số QĐ: 123/QĐ-CCCN-TY
  date: string;
  type: 'Tuyển dụng' | 'Bổ nhiệm' | 'Bổ nhiệm lại' | 'Điều động' | 'Luân chuyển' | 'Nâng lương' | 'Khen thưởng' | 'Kỷ luật' | 'Nghỉ hưu' | 'Thôi việc';
  title: string;
  content: string;
  signLevel: string; // Chi cục trưởng / Giám đốc Sở
  effectiveDate: string;
  employeeIds: string[];
  employeeNames: string[];
  fileUrl?: string;
  driveFileId?: string;
  driveViewLink?: string;
  notes?: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'HR' | 'STAFF';
export type DataScope = 'ALL' | 'DEPARTMENT' | 'SELF';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  scope: DataScope;
  departmentId?: string;
  departmentName?: string;
  avatar?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  action: string; // THÊM_MỚI, CẬP_NHẬT, ĐIỀU_ĐỘNG, NÂNG_LƯƠNG...
  targetEmployeeCode: string;
  targetEmployeeName: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  details: string;
}

export interface GoogleDriveConfig {
  rootFolderId?: string;
  rootFolderName?: string;
  staffFolderId?: string;
  decisionsFolderId?: string;
  reportsFolderId?: string;
  connected: boolean;
  userEmail?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  lastSyncedAt?: string;
  connected: boolean;
}

// =========================================================================
// HỆ THỐNG TÍNH THUẾ TNCN THEO QUÝ & NĂM (PERSONAL INCOME TAX)
// =========================================================================

export interface TaxDependent {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  dependentName: string;
  relationship: 'Con dưới 18 tuổi' | 'Con trên 18 tuổi học ĐH/CĐ' | 'Vợ/Chồng không có thu nhập' | 'Cha/Mẹ hết tuổi lao động' | 'Khác';
  dob: string;
  idCardOrTaxCode: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM (để trống nếu còn hiệu lực)
  deductionMonthlyAmount: number; // Mặc định 4.400.000 đ/tháng
  notes?: string;
}

export interface MonthlyTaxDetail {
  month: number;
  year: number;
  periodKey: string; // "01/2026"
  baseSalary: number;
  salaryAmount: number; // Lương hệ số
  beyondFrameAmount: number; // Phụ cấp thâm niên vượt khung
  leadershipAllowanceAmount: number; // Phụ cấp chức vụ
  publicServiceAllowanceAmount: number; // Phụ cấp công vụ
  otherIncomeAmount: number; // Thu nhập khác (làm thêm, thưởng, phụ cấp khác)
  totalGrossIncome: number; // Tổng thu nhập tháng
  nonTaxableIncome: number; // Khoản không chịu thuế / miễn thuế theo điều kiện
  taxableIncome: number; // Thu nhập chịu thuế = Gross - NonTaxable
  compulsoryInsurance: number; // BHXH (8%) + BHYT (1.5%) + BHTN (1%)
  personalDeduction: number; // Giảm trừ bản thân: 11.000.000 đ/tháng
  dependentCount: number; // Số người phụ thuộc tháng này
  dependentDeduction: number; // Giảm trừ gia cảnh NPT: số NPT * 4.400.000 đ
  otherDeduction: number; // Giảm trừ khác (từ thiện, nhân đạo...)
  totalDeductions: number; // Tổng các khoản giảm trừ tháng
  assessableIncome: number; // Thu nhập tính thuế = Max(0, Taxable - TotalDeductions)
  monthlyTaxWithheld: number; // Số thuế TNCN phát sinh / đã tạm khấu trừ tháng
}

export interface QuarterlyTaxRecord {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  jobRankCode: string;
  quarter: 1 | 2 | 3 | 4;
  year: number;
  quarterKey: string; // "Quý I/2026"
  months: MonthlyTaxDetail[]; // 3 tháng tương ứng (VD: T1, T2, T3)
  
  // Tổng hợp thu nhập quý
  qSalaryAmount: number;
  qBeyondFrameAmount: number;
  qLeadershipAllowanceAmount: number;
  qPublicServiceAllowanceAmount: number;
  qOtherIncomeAmount: number;
  qTotalGrossIncome: number;
  qNonTaxableIncome: number;
  qTaxableIncome: number;

  // Tổng hợp các khoản giảm trừ quý
  qCompulsoryInsurance: number;
  qPersonalDeduction: number; // 33.000.000 đ / quý
  dependentCount: number;
  qDependentDeduction: number; // dependentCount * 13.200.000 đ / quý
  qOtherDeduction: number;
  qTotalDeductions: number;

  // Thu nhập tính thuế & số thuế
  qAssessableIncome: number; // Thu nhập tính thuế quý
  qTaxWithheld: number; // Tổng số thuế đã khấu trừ trong 3 tháng (T1 + T2 + T3)
  qQuarterlyTaxPayable: number; // Số thuế tính theo biểu quý đối soát
  qTaxDifference: number; // Chênh lệch (nếu có)
}

export interface AnnualTaxRecord {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  positionTitle: string;
  year: number;
  dependentCount: number;

  // Thuế 4 quý
  q1TaxWithheld: number;
  q2TaxWithheld: number;
  q3TaxWithheld: number;
  q4TaxWithheld: number;

  annualGrossIncome: number;
  annualTaxableIncome: number;
  annualInsuranceDeduction: number;
  annualPersonalDeduction: number; // 132.000.000 đ
  annualDependentDeduction: number; // dependentCount * 52.800.000 đ
  annualTotalDeductions: number;
  annualAssessableIncome: number;

  annualTaxPayable: number; // Thuế tính theo biểu quyết toán năm
  annualTaxWithheld: number; // Tổng thuế đã tạm khấu trừ cả năm (Q1+Q2+Q3+Q4)
  annualTaxBalance: number; // Chênh lệch: > 0 phải nộp thêm, < 0 nộp thừa (hoàn thuế)
}

export interface OtherIncomeItem {
  id: string;
  month: number; // 1 - 12
  year: number; // e.g. 2026
  periodKey: string; // "01/2026"
  employeeCode: string; // Mã nhân viên
  employeeName: string; // Họ tên nhân viên
  departmentName?: string; // Phòng ban / Đơn vị
  description: string; // Nội dung thu nhập (Thu nhập tăng thêm NQ98, thưởng, làm thêm giờ, kiêm nhiệm...)
  amount: number; // Số tiền (VNĐ)
  taxable?: boolean; // Thu nhập chịu thuế (mặc định true)
  notes?: string;
  source?: 'IMPORT_EXCEL' | 'MANUAL_ENTRY';
  createdAt?: string;
}


