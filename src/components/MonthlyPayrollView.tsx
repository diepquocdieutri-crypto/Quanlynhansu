import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, 
  FileSpreadsheet, 
  Download, 
  Printer, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Building2, 
  Coins, 
  ShieldCheck, 
  UserCheck, 
  Layers, 
  RefreshCw, 
  Eye, 
  X,
  CreditCard,
  Percent,
  Receipt,
  FileCheck,
  TrendingUp,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  BarChart3,
  User,
  Clock,
  Zap,
  AlertTriangle,
  KeyRound,
  ShieldAlert,
  LogIn,
  Settings,
  Copy,
  Check,
  Code,
  Link2
} from 'lucide-react';
import { 
  Employee, 
  Department, 
  PayrollCategory, 
  MonthlyPayrollRecord,
  EmployeeCumulativeIncomeReport,
  EmployeeIncomeFluctuation
} from '../types/hrm';
import { 
  MonthlyPayrollService, 
  PAYROLL_CATEGORY_META, 
  MONTHLY_PAYROLL_SPREADSHEET_TITLE,
  SavedPeriodRecord
} from '../services/monthlyPayrollService';
import { PayrollPrintModal } from './PayrollPrintModal';
import { IndividualIncomePrintModal } from './IndividualIncomePrintModal';

interface MonthlyPayrollViewProps {
  employees: Employee[];
  departments: Department[];
  googleConnected: boolean;
  onLoginGoogle?: () => void;
  onSelectEmployee?: (emp: Employee) => void;
  onNavigateToQuarterlyTax?: () => void;
  onRefreshFromSheets?: () => void;
  isRefreshingSheets?: boolean;
  onOpenSyncSheets?: () => void;
  onResetMockData?: () => void;
}

export const MonthlyPayrollView: React.FC<MonthlyPayrollViewProps> = ({
  employees,
  departments,
  googleConnected,
  onLoginGoogle,
  onSelectEmployee,
  onNavigateToQuarterlyTax,
  onRefreshFromSheets,
  isRefreshingSheets,
  onOpenSyncSheets,
  onResetMockData,
}) => {
  const currentDate = new Date();
  
  // Chế độ xem: Bảng lương kỳ tháng hiện hành | Truy xuất lũy kế thu nhập & biến động lương
  const [viewMode, setViewMode] = useState<'CURRENT_PERIOD' | 'CUMULATIVE_ANALYTICS'>('CURRENT_PERIOD');

  // Kỳ tính lương tháng (Mặc định chuẩn bị kỳ Tháng 10/2026 với MLCS mới 2.530.000 đ)
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [baseSalary, setBaseSalary] = useState<number>(2530000); // 2.530.000 đ cho Tháng 10/2026
  const [activeCategoryTab, setActiveCategoryTab] = useState<PayrollCategory | 'ALL'>('ALL'); // Mặc định hiển thị toàn cơ quan
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  
  // Trạng thái đồng bộ Google Sheets & Lưu trữ
  const [isProcessingAndSaving, setIsProcessingAndSaving] = useState(false);
  const [syncResult, setSyncResult] = useState<{ url: string; count: number; periodKey: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [savedPeriodsList, setSavedPeriodsList] = useState<SavedPeriodRecord[]>([]);

  // Bộ lọc cho chế độ Truy xuất Lũy kế Thu nhập & Biến động lương cá nhân
  const [cumFromMonth, setCumFromMonth] = useState<number>(1);
  const [cumFromYear, setCumFromYear] = useState<number>(2026);
  const [cumToMonth, setCumToMonth] = useState<number>(currentDate.getMonth() + 1);
  const [cumToYear, setCumToYear] = useState<number>(currentDate.getFullYear());
  const [selectedIndividualCode, setSelectedIndividualCode] = useState<string>('ALL'); // 'ALL' hoặc mã cán bộ
  const [cumCategoryFilter, setCumCategoryFilter] = useState<PayrollCategory | 'ALL'>('ALL');
  const [cumSearchTerm, setCumSearchTerm] = useState('');

  // Modal xem chi tiết phiếu lương cá nhân
  const [selectedPaySlip, setSelectedPaySlip] = useState<MonthlyPayrollRecord | null>(null);
  // Modal in mẫu bảng lương chuẩn nhà nước
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  // Modal in báo cáo thống kê thu nhập cá nhân lũy kế
  const [isIndividualPrintModalOpen, setIsIndividualPrintModalOpen] = useState(false);

  // Chế độ chọn khoảng thời gian lũy kế: 'MONTH_RANGE' (Tháng/Năm) hoặc 'YEAR_RANGE' (Năm này đến Năm khác)
  const [cumQueryMode, setCumQueryMode] = useState<'MONTH_RANGE' | 'YEAR_RANGE'>('MONTH_RANGE');
  const [cumFromYearOnly, setCumFromYearOnly] = useState<number>(2025);
  const [cumToYearOnly, setCumToYearOnly] = useState<number>(2026);

  // Trạng thái modal cảnh báo lỗi xác thực Google OAuth (Mã lỗi 401 - Invalid authentication credentials)
  const [authExpiredModalInfo, setAuthExpiredModalInfo] = useState<{
    isOpen: boolean;
    message: string;
    pendingMonth?: number;
    pendingYear?: number;
    pendingBaseSalary?: number;
    pendingPayroll?: Record<PayrollCategory, MonthlyPayrollRecord[]>;
    pendingPeriodKey?: string;
  }>({
    isOpen: false,
    message: '',
  });

  // Trạng thái modal cấu hình Google Apps Script Webhook (Code.gs)
  const [isAppsScriptModalOpen, setIsAppsScriptModalOpen] = useState(false);
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState(() => MonthlyPayrollService.getAppsScriptUrl() || '');
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [isTestingSync, setIsTestingSync] = useState(false);

  // Trạng thái modal cảnh báo xác nhận ghi đè khi kỳ lương đã tồn tại trong hệ thống
  const [overwriteConfirmModal, setOverwriteConfirmModal] = useState<{
    isOpen: boolean;
    month: number;
    year: number;
    baseSalary: number;
    periodKey: string;
    calculatedData: Record<PayrollCategory, MonthlyPayrollRecord[]>;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Tải danh sách kỳ lương đã lưu trữ
  const refreshSavedPeriods = () => {
    const list = MonthlyPayrollService.getSavedPeriods(employees);
    setSavedPeriodsList(list);
  };

  useEffect(() => {
    refreshSavedPeriods();
  }, [employees]);

  // Tự động điều chỉnh mức lương cơ sở theo kỳ tháng được chọn (Tháng 9: 2.340.000 đ, Tháng 10: 2.530.000 đ) hoặc lấy từ kỳ đã lưu
  useEffect(() => {
    const periodKey = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
    const foundSaved = savedPeriodsList.find(p => p.periodKey === periodKey);
    if (foundSaved && foundSaved.baseSalary) {
      setBaseSalary(foundSaved.baseSalary);
    } else {
      setBaseSalary(MonthlyPayrollService.getBaseSalaryForPeriod(selectedMonth, selectedYear));
    }
  }, [selectedMonth, selectedYear, savedPeriodsList]);

  // Tính toán bảng lương toàn cơ quan theo tháng và mức lương cơ sở (ưu tiên dữ liệu đã lưu nếu có)
  const payrollData = useMemo(() => {
    const periodKey = `${String(selectedMonth).padStart(2, '0')}/${selectedYear}`;
    const savedPeriod = savedPeriodsList.find(p => p.periodKey === periodKey);
    if (savedPeriod && savedPeriod.data && (
      (savedPeriod.data.CONG_CHUC?.length || 0) + 
      (savedPeriod.data.VIEN_CHUC?.length || 0) + 
      (savedPeriod.data.HOP_DONG_111?.length || 0) + 
      (savedPeriod.data.THU_Y_PX?.length || 0) +
      (savedPeriod.data.KHOAN_CM?.length || 0) > 0
    )) {
      return savedPeriod.data;
    }
    return MonthlyPayrollService.calculatePayroll(employees, selectedMonth, selectedYear, baseSalary);
  }, [employees, selectedMonth, selectedYear, baseSalary, savedPeriodsList]);

  // Thống kê tổng hợp 4 loại hình
  const summaries = useMemo(() => {
    return MonthlyPayrollService.getSummaries(payrollData);
  }, [payrollData]);

  // Lọc danh sách hiển thị theo Tab loại hình được chọn, tìm kiếm và phòng ban
  const currentRecords = useMemo(() => {
    let list: MonthlyPayrollRecord[] = [];
    if (activeCategoryTab === 'ALL') {
      list = [
        ...(payrollData.CONG_CHUC || []),
        ...(payrollData.VIEN_CHUC || []),
        ...(payrollData.HOP_DONG_111 || []),
        ...(payrollData.THU_Y_PX || []),
        ...(payrollData.KHOAN_CM || []),
      ];
    } else {
      list = payrollData[activeCategoryTab] || [];
    }

    return list.filter(r => {
      if (selectedDeptFilter !== 'ALL' && !r.departmentName.toLowerCase().includes(selectedDeptFilter.toLowerCase())) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const q = searchTerm.trim().toLowerCase();
        const matchName = r.fullName.toLowerCase().includes(q);
        const matchCode = r.code.toLowerCase().includes(q);
        const matchPos = r.positionTitle.toLowerCase().includes(q);
        const matchRank = r.jobRankName.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPos && !matchRank) return false;
      }
      return true;
    });
  }, [payrollData, activeCategoryTab, selectedDeptFilter, searchTerm]);

  // Tổng cộng cho danh sách đang xem
  const activeTotals = useMemo(() => {
    return {
      count: currentRecords.length,
      salaryAmount: currentRecords.reduce((s, r) => s + r.salaryAmount, 0),
      beyondFrameAmount: currentRecords.reduce((s, r) => s + r.beyondFrameAmount, 0),
      leadershipAllowanceAmount: currentRecords.reduce((s, r) => s + r.leadershipAllowanceAmount, 0),
      responsibilityAllowanceAmount: currentRecords.reduce((s, r) => s + r.responsibilityAllowanceAmount, 0),
      industryAllowanceAmount: currentRecords.reduce((s, r) => s + r.industryAllowanceAmount, 0),
      travelAllowanceAmount: currentRecords.reduce((s, r) => s + r.travelAllowanceAmount, 0),
      publicServiceAllowanceAmount: currentRecords.reduce((s, r) => s + r.publicServiceAllowanceAmount, 0),
      totalAllowanceAmount: currentRecords.reduce((s, r) => s + r.totalAllowanceAmount, 0),
      totalGrossIncome: currentRecords.reduce((s, r) => s + r.totalGrossIncome, 0),
      socialInsuranceEmp: currentRecords.reduce((s, r) => s + r.socialInsuranceEmp, 0),
      healthInsuranceEmp: currentRecords.reduce((s, r) => s + r.healthInsuranceEmp, 0),
      unemploymentInsuranceEmp: currentRecords.reduce((s, r) => s + r.unemploymentInsuranceEmp, 0),
      totalDeductions: currentRecords.reduce((s, r) => s + r.totalDeductions, 0),
      netSalary: currentRecords.reduce((s, r) => s + r.netSalary, 0),
    };
  }, [currentRecords]);

  // Dữ liệu Truy Xuất Lũy Kế Thu Nhập & Biến Động Lương
  const cumulativeReports = useMemo(() => {
    return MonthlyPayrollService.queryCumulativeAndFluctuation({
      fromMonth: cumFromMonth,
      fromYear: cumFromYear,
      toMonth: cumToMonth,
      toYear: cumToYear,
      employeeCode: selectedIndividualCode === 'ALL' ? undefined : selectedIndividualCode,
      category: cumCategoryFilter,
      employees,
    });
  }, [cumFromMonth, cumFromYear, cumToMonth, cumToYear, selectedIndividualCode, cumCategoryFilter, employees, savedPeriodsList]);

  // Lọc tìm kiếm trong danh sách báo cáo lũy kế
  const filteredCumulativeReports = useMemo(() => {
    if (cumSearchTerm.trim() === '') return cumulativeReports;
    const q = cumSearchTerm.trim().toLowerCase();
    return cumulativeReports.filter(r => 
      r.fullName.toLowerCase().includes(q) || 
      r.code.toLowerCase().includes(q) || 
      r.departmentName.toLowerCase().includes(q) ||
      r.positionTitle.toLowerCase().includes(q)
    );
  }, [cumulativeReports, cumSearchTerm]);

  // Cán bộ đơn lẻ đang được chọn để xem biến động chi tiết
  const singleSelectedReport = useMemo(() => {
    if (selectedIndividualCode === 'ALL') {
      return filteredCumulativeReports.length > 0 ? filteredCumulativeReports[0] : null;
    }
    return cumulativeReports.find(r => r.code === selectedIndividualCode) || null;
  }, [selectedIndividualCode, filteredCumulativeReports, cumulativeReports]);

  // Chế độ xem bảng toàn cơ quan: Lũy kế giai đoạn đang chọn HOẶC So sánh lũy kế theo từng năm (2024 - 2025 - 2026)
  const [agencyTableMode, setAgencyTableMode] = useState<'CUMULATIVE_PERIOD' | 'ANNUAL_COMPARISON'>('CUMULATIVE_PERIOD');

  // Thống kê lũy kế theo từng năm của cá nhân đang xem
  const singleEmployeeAnnualSummary = useMemo(() => {
    if (!singleSelectedReport) return [];
    const yearlyMap = new Map<number, {
      year: number;
      monthCount: number;
      totalSalaryAmount: number;
      totalAllowanceAmount: number;
      totalGrossIncome: number;
      totalDeductions: number;
      totalNetSalary: number;
      averageNetSalary: number;
    }>();

    singleSelectedReport.monthlyFluctuations.forEach(f => {
      const y = f.year;
      const cur = yearlyMap.get(y) || {
        year: y,
        monthCount: 0,
        totalSalaryAmount: 0,
        totalAllowanceAmount: 0,
        totalGrossIncome: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        averageNetSalary: 0,
      };
      cur.monthCount += 1;
      cur.totalSalaryAmount += f.salaryAmount;
      cur.totalAllowanceAmount += f.totalAllowanceAmount;
      cur.totalGrossIncome += f.totalGrossIncome;
      cur.totalDeductions += f.totalDeductions;
      cur.totalNetSalary += f.netSalary;
      yearlyMap.set(y, cur);
    });

    const list = Array.from(yearlyMap.values()).map(item => ({
      ...item,
      averageNetSalary: item.monthCount > 0 ? Math.round(item.totalNetSalary / item.monthCount) : 0,
    }));
    list.sort((a, b) => b.year - a.year);
    return list;
  }, [singleSelectedReport]);

  // Thống kê so sánh thu nhập lũy kế theo từng năm (2024, 2025, 2026) của toàn cơ quan
  const agencyAnnualComparison = useMemo(() => {
    const years = [2024, 2025, 2026];
    const yearReportsMap: Record<number, Map<string, EmployeeCumulativeIncomeReport>> = {};
    years.forEach(y => {
      const rep = MonthlyPayrollService.queryCumulativeAndFluctuation({
        fromMonth: 1,
        fromYear: y,
        toMonth: 12,
        toYear: y,
        category: cumCategoryFilter,
        employees,
      });
      const map = new Map<string, EmployeeCumulativeIncomeReport>();
      rep.forEach(r => map.set(r.code, r));
      yearReportsMap[y] = map;
    });

    const activeList = employees.filter(e => {
      if (cumCategoryFilter !== 'ALL' && MonthlyPayrollService.getPayrollCategory(e) !== cumCategoryFilter) return false;
      if (cumSearchTerm.trim() !== '') {
        const q = cumSearchTerm.trim().toLowerCase();
        return e.fullName.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || e.departmentName.toLowerCase().includes(q);
      }
      return true;
    });

    return activeList.map((emp, idx) => {
      const cat = MonthlyPayrollService.getPayrollCategory(emp);
      const y2024 = yearReportsMap[2024]?.get(emp.code);
      const y2025 = yearReportsMap[2025]?.get(emp.code);
      const y2026 = yearReportsMap[2026]?.get(emp.code);

      const net2024 = y2024?.totalNetSalary || 0;
      const net2025 = y2025?.totalNetSalary || 0;
      const net2026 = y2026?.totalNetSalary || 0;
      const totalAllYears = net2024 + net2025 + net2026;

      return {
        stt: idx + 1,
        code: emp.code,
        fullName: emp.fullName,
        departmentName: emp.departmentName,
        positionTitle: emp.positionTitle,
        jobRankCode: emp.jobRankCode || emp.salary?.rankCode || '01.003',
        category: cat,
        net2024,
        net2025,
        net2026,
        totalAllYears,
        growth25_26: net2025 > 0 ? Number((((net2026 - net2025) / net2025) * 100).toFixed(1)) : 0,
      };
    });
  }, [cumCategoryFilter, cumSearchTerm, employees, savedPeriodsList]);

  // Nút hành động tính ngay Bảng lương Tháng 10/2026 với MLCS 2.530.000 đ
  const handleCalculateMonth10 = async () => {
    await handleProcessAndSavePayroll(10, 2026, 2530000);
  };

  // Hàm xử lý đăng nhập lại Google và đồng bộ kỳ lương đang chờ
  const handleReAuthAndSync = async () => {
    if (!onLoginGoogle) {
      showToast('Chức năng đăng nhập Google chưa được kích hoạt.', 'error');
      return;
    }
    try {
      setIsProcessingAndSaving(true);
      await onLoginGoogle();

      // Sau khi đăng nhập thành công, chờ một chút để state token được đồng bộ
      await new Promise(r => setTimeout(r, 400));

      if (authExpiredModalInfo.pendingPayroll && authExpiredModalInfo.pendingMonth && authExpiredModalInfo.pendingYear) {
        const res = await MonthlyPayrollService.saveAndSyncMonthlyPayroll(
          authExpiredModalInfo.pendingMonth,
          authExpiredModalInfo.pendingYear,
          authExpiredModalInfo.pendingBaseSalary || baseSalary,
          employees,
          authExpiredModalInfo.pendingPayroll,
          true
        );

        if (res.googleSheetsResult) {
          setSyncResult({ 
            url: res.googleSheetsResult.spreadsheetUrl, 
            count: res.googleSheetsResult.totalSynced, 
            periodKey: authExpiredModalInfo.pendingPeriodKey || `${authExpiredModalInfo.pendingMonth}/${authExpiredModalInfo.pendingYear}` 
          });
        }

        setSavedPeriodsList(res.savedPeriods);

        if (res.googleSheetsError) {
          showToast(`❌ Lỗi đồng bộ Sheets: ${res.googleSheetsError}`, 'error');
        } else {
          showToast(`🎉 Đã kết nối lại Google thành công! Bảng lương kỳ ${authExpiredModalInfo.pendingPeriodKey} đã được lưu vào Google Sheets và CSDL!`, 'success');
        }
      }

      setAuthExpiredModalInfo({ isOpen: false, message: '' });
    } catch (err: any) {
      console.error('Lỗi khi đăng nhập lại Google và đồng bộ:', err);
      showToast(`Đăng nhập Google thất bại: ${err.message || 'Hủy thao tác'}`, 'error');
    } finally {
      setIsProcessingAndSaving(false);
    }
  };

  // Hàm thực hiện lưu CSDL và đồng bộ Google Sheets (sau khi đã kiểm tra hoặc đã xác nhận ghi đè)
  const executeSaveAndSyncPayroll = async (
    m: number,
    y: number,
    effectiveBase: number,
    payrollToSave: Record<PayrollCategory, MonthlyPayrollRecord[]>
  ) => {
    const periodKey = `${String(m).padStart(2, '0')}/${y}`;
    try {
      setIsProcessingAndSaving(true);
      const result = await MonthlyPayrollService.saveAndSyncMonthlyPayroll(
        m,
        y,
        effectiveBase,
        employees,
        payrollToSave,
        googleConnected
      );

      // Cập nhật state ngay lập tức: hiện nút kỳ lương màu xanh dương
      setSavedPeriodsList(result.savedPeriods);

      if (result.googleSheetsResult) {
        setSyncResult({ 
          url: result.googleSheetsResult.spreadsheetUrl, 
          count: result.googleSheetsResult.totalSynced, 
          periodKey 
        });
      }

      if (result.googleSheetsError) {
        showToast(`❌ Lỗi đồng bộ Sheets: ${result.googleSheetsError}`, 'error');
      } else {
        showToast(`🎉 ${result.message}`, 'success');
      }
    } catch (saveErr: any) {
      // Cập nhật danh sách từ LocalStorage dự phòng nếu đã ghi thành công CSDL cục bộ
      const fallbackPeriods = MonthlyPayrollService.getSavedPeriods(employees);
      setSavedPeriodsList(fallbackPeriods);

      const isAuth401 = 
        saveErr?.status === 401 ||
        saveErr?.name === 'GoogleAuthError' ||
        (typeof saveErr?.message === 'string' && (
          saveErr.message.includes('401') ||
          saveErr.message.toLowerCase().includes('invalid authentication credentials') ||
          saveErr.message.toLowerCase().includes('unauthenticated') ||
          saveErr.message.toLowerCase().includes('hết hạn')
        ));

      const isTimeout = 
        saveErr?.isTimeout ||
        saveErr?.name === 'TimeoutError' ||
        (typeof saveErr?.message === 'string' && (
          saveErr.message.includes('Quá thời gian kết nối') ||
          saveErr.message.toLowerCase().includes('timeout')
        ));

      if (isAuth401) {
        setAuthExpiredModalInfo({
          isOpen: true,
          message: saveErr.message || 'Mã lỗi 401 (Invalid authentication credentials): Phiên đăng nhập Google đã hết hạn.',
          pendingMonth: m,
          pendingYear: y,
          pendingBaseSalary: effectiveBase,
          pendingPayroll: payrollToSave,
          pendingPeriodKey: periodKey,
        });
        showToast('⚠️ Mã lỗi 401: Phiên xác thực Google đã hết hạn. Vui lòng cấp lại quyền để lưu vào Trang tính.', 'error');
      } else if (isTimeout) {
        showToast('⏳ Quá thời gian kết nối. Vui lòng kiểm tra mạng và thử lại!', 'error');
      } else {
        console.error('Lỗi khi lưu bảng lương:', saveErr);
        showToast(`❌ Lỗi đồng bộ Sheets: ${saveErr.message || 'Lỗi khi lưu bảng lương vào cơ sở dữ liệu / trang tính.'}`, 'error');
      }
    } finally {
      // Luôn mở khóa nút bấm để không bị treo loading
      setIsProcessingAndSaving(false);
    }
  };

  // Xử lý khi người dùng chọn Hủy (Cancel) trong hộp thoại cảnh báo ghi đè
  const handleCancelOverwrite = () => {
    setOverwriteConfirmModal(null);
    setIsProcessingAndSaving(false);
    showToast('Đã hủy lưu dữ liệu.', 'error');
  };

  // Xử lý khi người dùng chọn Đồng ý (OK / Ghi đè) trong hộp thoại cảnh báo ghi đè
  const handleConfirmOverwrite = async () => {
    if (!overwriteConfirmModal) return;
    const { month, year, baseSalary: bSalary, calculatedData } = overwriteConfirmModal;
    setOverwriteConfirmModal(null);
    await executeSaveAndSyncPayroll(month, year, bSalary, calculatedData);
  };

  // Nút hành động chính: "Thực hiện tính lương & Lưu kỳ tính lương tháng vào Trang tính & CSDL"
  const handleProcessAndSavePayroll = async (targetMonth?: number, targetYear?: number, targetBase?: number) => {
    try {
      const m = targetMonth ?? selectedMonth;
      const y = targetYear ?? selectedYear;
      let effectiveBase = targetBase ?? baseSalary;

      // Đảm bảo mức lương cơ sở chuẩn theo kỳ nếu đang tính tháng 10
      if (y === 2026 && m === 10 && effectiveBase < 2530000) {
        effectiveBase = 2530000;
        setBaseSalary(2530000);
      }

      const periodKey = `${String(m).padStart(2, '0')}/${y}`;

      // 1. Tính toán trước bảng lương theo kỳ đã chọn để hiển thị ngay trên giao diện
      const currentPayroll = MonthlyPayrollService.calculatePayroll(employees, m, y, effectiveBase);
      
      setSelectedMonth(m);
      setSelectedYear(y);
      setBaseSalary(effectiveBase);
      setActiveCategoryTab('ALL');
      setSearchTerm('');
      setSelectedDeptFilter('ALL');
      setViewMode('CURRENT_PERIOD');
      if (m === 10 && y === 2026 && cumToMonth < 10 && cumToYear <= 2026) {
        setCumToMonth(10);
      }

      // Tự động cuộn đến bảng hiển thị chi tiết
      setTimeout(() => {
        const tableElem = document.getElementById('monthly-payroll-table-section');
        if (tableElem) {
          tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);

      // 2. KIỂM TRA DỮ LIỆU TRƯỚC KHI LƯU:
      // Kiểm tra xem kỳ lương này (Tháng/Năm) đã tồn tại trong CSDL/LocalStorage chưa
      const isAlreadySaved = MonthlyPayrollService.isPeriodExisting(m, y);

      if (isAlreadySaved) {
        // XỬ LÝ NẾU ĐÃ CÓ (CẢNH BÁO GHI ĐÈ):
        // Tuyệt đối không tự động ghi đè! Tắt trạng thái loading và hiển thị hộp thoại xác nhận
        setIsProcessingAndSaving(false);
        setOverwriteConfirmModal({
          isOpen: true,
          month: m,
          year: y,
          baseSalary: effectiveBase,
          periodKey,
          calculatedData: currentPayroll,
        });
        return;
      }

      // 3. XỬ LÝ NẾU CHƯA CÓ:
      // Cho phép tự động đồng bộ và lưu mới bình thường
      await executeSaveAndSyncPayroll(m, y, effectiveBase, currentPayroll);
    } catch (err: any) {
      console.error('Lỗi tính & lưu lương:', err);
      const isTimeout = 
        err?.isTimeout ||
        err?.name === 'TimeoutError' ||
        (typeof err?.message === 'string' && (
          err.message.includes('Quá thời gian kết nối') ||
          err.message.toLowerCase().includes('timeout')
        ));
      if (isTimeout) {
        showToast('⏳ Quá thời gian kết nối. Vui lòng kiểm tra mạng và thử lại!', 'error');
      } else {
        showToast(err.message || 'Lỗi khi tính toán bảng lương.', 'error');
      }
      setIsProcessingAndSaving(false);
    }
  };

  // Hàm chọn thống kê nhanh theo Năm
  const handleSelectYearRange = (fromYear: number, toYear: number) => {
    setCumQueryMode('YEAR_RANGE');
    setCumFromYearOnly(fromYear);
    setCumToYearOnly(toYear);
    setCumFromMonth(1);
    setCumFromYear(fromYear);
    setCumToMonth(12);
    setCumToYear(toYear);
    showToast(`Đã chọn khoảng thống kê: Từ Năm ${fromYear} đến Năm ${toYear}`, 'success');
  };

  // Hàm chọn thống kê nhanh theo Tháng
  const handleSelectMonthRange = (fromM: number, fromY: number, toM: number, toY: number) => {
    setCumQueryMode('MONTH_RANGE');
    setCumFromMonth(fromM);
    setCumFromYear(fromY);
    setCumToMonth(toM);
    setCumToYear(toY);
    showToast(`Đã chọn khoảng thống kê: Từ Tháng ${fromM}/${fromY} đến Tháng ${toM}/${toY}`, 'success');
  };

  // Xuất file Excel 5 sheet kỳ hiện tại
  const handleExportExcelCurrent = () => {
    try {
      MonthlyPayrollService.exportToExcel(selectedMonth, selectedYear, baseSalary, payrollData);
      showToast(`Đã xuất file Excel bảng lương tháng ${selectedMonth}/${selectedYear} với 5 Sheet riêng biệt.`);
    } catch (err: any) {
      console.error('Lỗi xuất Excel:', err);
      showToast('Có lỗi xảy ra khi tạo file Excel.', 'error');
    }
  };

  // Xuất file Excel báo cáo lũy kế & biến động lương
  const handleExportCumulativeExcel = () => {
    try {
      const fromStr = `Tháng ${cumFromMonth}/${cumFromYear}`;
      const toStr = `Tháng ${cumToMonth}/${cumToYear}`;
      MonthlyPayrollService.exportCumulativeReportToExcel(filteredCumulativeReports, fromStr, toStr);
      showToast(`Đã xuất báo cáo Lũy kế thu nhập & Biến động lương ra file Excel thành công.`);
    } catch (err: any) {
      console.error('Lỗi xuất báo cáo lũy kế:', err);
      showToast('Có lỗi xảy ra khi xuất file Excel.', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-bounce text-white ${
          toastMessage.type === 'error' ? 'bg-rose-700' : 'bg-emerald-700'
        }`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          )}
          <span className="font-semibold text-xs">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner & Global Actions */}
      <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl">
                <Calculator className="w-6 h-6 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-wide text-white uppercase flex items-center gap-2">
                  <span>HỆ THỐNG TÍNH LƯƠNG & LƯU TRỮ LŨY KẾ THU NHẬP</span>
                  <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                    Lưu Trữ Từng Kỳ Tháng & Phân Loại Riêng Biệt
                  </span>
                </h1>
                <p className="text-xs text-sky-200 mt-0.5">
                  Chi cục Chăn nuôi và Thú y TP.HCM &bull; Cơ sở dữ liệu bảng lương tháng, truy xuất thu nhập lũy kế & biến động lương cá nhân
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Giữ duy nhất nút màu cam hiển thị đúng kỳ tính lương đã chọn & nút xuất/in báo cáo */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Nút Tính Lương Màu Cam Duy Nhất - Hiển thị đúng kỳ tính lương đã chọn */}
            <button
              onClick={() => handleProcessAndSavePayroll(selectedMonth, selectedYear, baseSalary)}
              disabled={isProcessingAndSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-b from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-950/40 border-b-[3px] border-amber-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5 ring-2 ring-amber-300/50 disabled:opacity-60"
              title={`Bấm để tính toán bảng lương kỳ Tháng ${selectedMonth}/${selectedYear}, hiển thị chi tiết và lưu về cơ sở dữ liệu`}
            >
              <Zap className={`w-4 h-4 text-yellow-200 fill-yellow-200 ${isProcessingAndSaving ? 'animate-bounce' : ''}`} />
              <span>
                {isProcessingAndSaving 
                  ? `Đang Tính Kỳ Tháng ${selectedMonth}/${selectedYear}...` 
                  : `Tính Lương Tháng ${selectedMonth}/${selectedYear} (${(baseSalary / 1000000).toFixed(2)}M)`}
              </span>
            </button>

            {/* Nút Xuất Excel kỳ hiện tại - 3D Teal */}
            <button
              onClick={handleExportExcelCurrent}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-400 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-950/40 border-b-[3px] border-teal-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Tải file Excel gồm 5 Sheet: Công chức, Viên chức, HĐ 111, Thú y PX, Khoán CM"
            >
              <Download className="w-4 h-4 text-teal-100" />
              <span>Xuất Excel Tháng {selectedMonth}/{selectedYear}</span>
            </button>

            {/* Nút In bảng lương chuẩn nhà nước */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-b from-sky-600 via-sky-700 to-sky-800 hover:from-sky-500 hover:to-sky-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-950/40 border-b-[3px] border-sky-900 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Mở mẫu bảng thanh toán tiền lương và phụ cấp để in chuẩn kế toán nhà nước"
            >
              <Printer className="w-4 h-4 text-cyan-200" />
              <span>In Báo Cáo</span>
            </button>
          </div>
        </div>

        {/* Trạng thái liên kết Google Sheets & Kết quả đồng bộ */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {googleConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 rounded-lg text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Google Sheets: Đã kết nối OAuth2 (Sẵn sàng đồng bộ trực tiếp)</span>
              </span>
            ) : (
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-200 border border-amber-400/30 rounded-lg text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Google Sheets: Chưa kết nối hoặc Token hết hạn (Mã 401)</span>
                </span>
                {onLoginGoogle && (
                  <button
                    onClick={onLoginGoogle}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer transition"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Đăng nhập Google ngay</span>
                  </button>
                )}
              </div>
            )}

            {/* Nút Cấu hình Webhook & Apps Script */}
            <button
              onClick={() => setIsAppsScriptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 hover:text-white border border-sky-400/30 rounded-lg text-[11px] font-bold transition cursor-pointer"
              title="Cấu hình Google Apps Script Webhook hoặc xem mã Code.gs để khắc phục triệt để lỗi CORS"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Cấu hình Apps Script (Code.gs) & Webhook</span>
              {appsScriptUrlInput && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5"></span>
              )}
            </button>
          </div>

          {syncResult && (
            <div className="flex items-center gap-2 text-emerald-200">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Đã lưu kỳ lương <strong>{syncResult.periodKey}</strong> ({syncResult.count} cán bộ) vào trang tính: <strong>"{MONTHLY_PAYROLL_SPREADSHEET_TITLE}"</strong></span>
              </span>
              <a
                href={syncResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-white font-bold ml-2"
              >
                <span>Mở Trang Tính Google</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 2 Chế độ xem: Bảng Lương Kỳ Tháng | Truy Xuất Lũy Kế Thu Nhập & Biến Động */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-2xl shadow-2xs gap-3">
        <button
          onClick={() => setViewMode('CURRENT_PERIOD')}
          className={`pb-3 px-3 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
            viewMode === 'CURRENT_PERIOD'
              ? 'border-sky-600 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>BẢNG LƯƠNG THEO KỲ THÁNG ({selectedMonth}/{selectedYear})</span>
          <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
            5 Khối Nhân Sự
          </span>
        </button>

        <button
          onClick={() => setViewMode('CUMULATIVE_ANALYTICS')}
          className={`pb-3 px-3 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
            viewMode === 'CUMULATIVE_ANALYTICS'
              ? 'border-sky-600 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>TRUY XUẤT LŨY KẾ THU NHẬP & BIẾN ĐỘNG LƯƠNG CÁ NHÂN</span>
          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
            Từ Tháng &rarr; Đến Tháng
          </span>
        </button>

        {onNavigateToQuarterlyTax && (
          <button
            onClick={onNavigateToQuarterlyTax}
            className="ml-auto mb-2 px-3 py-1.5 font-bold text-xs text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1.5 border border-indigo-200 shadow-2xs self-center"
          >
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span>Hệ Thống Tính Thuế TNCN Theo Quý (3 Tầng) &rarr;</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 1: BẢNG LƯƠNG THEO KỲ THÁNG HIỆN HÀNH (4 LOẠI HÌNH LƯU TRỮ RIÊNG)   */}
      {/* ========================================================================= */}
      {viewMode === 'CURRENT_PERIOD' && (
        <div className="space-y-6">
          {/* Control Panel: Chọn Tháng / Năm & Mức Lương Cơ Sở */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Kỳ tính lương:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setSelectedMonth(m);
                    setBaseSalary(MonthlyPayrollService.getBaseSalaryForPeriod(m, selectedYear));
                    setActiveCategoryTab('ALL');
                  }}
                  className="bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setSelectedYear(y);
                    setBaseSalary(MonthlyPayrollService.getBaseSalaryForPeriod(selectedMonth, y));
                  }}
                  className="bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Mức lương cơ sở:</span>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
                  <input
                    type="number"
                    step="10000"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(Number(e.target.value) || 2340000)}
                    className="w-28 bg-transparent text-slate-900 font-bold text-xs focus:outline-hidden text-right"
                  />
                  <span className="text-slate-500 font-medium">VNĐ</span>
              </div>
            </div>
            </div>

            {/* Bộ lọc tìm kiếm nhanh */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã NV, chức vụ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-56 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden"
              >
                <option value="ALL">Tất cả đơn vị ({departments.length})</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Thanh hiển thị các kỳ tính lương đã lưu trong cơ sở dữ liệu */}
          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sky-950 flex items-center gap-1.5">
                <History className="w-4 h-4 text-sky-700" />
                <span>Kỳ lương đã lưu trữ trong CSDL ({savedPeriodsList.length} kỳ):</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {savedPeriodsList.map(p => {
                  const isSelected = selectedMonth === p.month && selectedYear === p.year;
                  return (
                    <button
                      key={p.periodKey}
                      onClick={() => {
                        setSelectedMonth(p.month);
                        setSelectedYear(p.year);
                        setBaseSalary(p.baseSalary || 2340000);
                        setActiveCategoryTab('ALL');
                        setSearchTerm('');
                        setSelectedDeptFilter('ALL');
                        setViewMode('CURRENT_PERIOD');
                        showToast(`Đang hiển thị bảng lương kỳ Tháng ${p.periodKey} (MLCS: ${(p.baseSalary || 2340000).toLocaleString('vi-VN')} đ).`, 'success');
                      }}
                      className={`px-3 py-1 rounded-xl font-mono font-bold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-sky-700 text-white shadow-xs ring-2 ring-sky-400 font-black'
                          : 'bg-white text-slate-700 hover:bg-sky-100 border border-slate-200 hover:border-sky-300'
                      }`}
                      title={`Nhấp để hiển thị kỳ lương Tháng ${p.periodKey} (MLCS: ${(p.baseSalary || 2340000).toLocaleString('vi-VN')} đ)`}
                    >
                      <span>Tháng {p.periodKey}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${isSelected ? 'bg-sky-800 text-sky-100' : 'bg-slate-100 text-slate-600'}`}>
                        {((p.baseSalary || 2340000) / 1000000).toFixed(2)}M
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => setViewMode('CUMULATIVE_ANALYTICS')}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thống kê thu nhập lũy kế qua các kỳ tính &rarr;</span>
            </button>
          </div>

          {/* CÁC THẺ RIÊNG BIỆT CHO TỪNG LOẠI HÌNH NHÂN SỰ (5 KHỐI ĐẦY ĐỦ) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {summaries.map(s => {
              const isActive = activeCategoryTab === s.category;
              return (
                <button
                  key={s.category}
                  onClick={() => setActiveCategoryTab(s.category)}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-br from-white to-sky-50/80 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${PAYROLL_CATEGORY_META[s.category].badgeColor}`}>
                      {s.shortTitle}
                    </span>
                    <span className="font-bold text-slate-800 text-xs">
                      {s.count} nhân sự
                    </span>
                  </div>
                  <div className="font-extrabold text-slate-900 text-sm truncate">
                    {s.title}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Thực nhận:</span>
                    <span className="font-bold text-emerald-700">
                      {s.totalNetSalary.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-600 rounded-b-2xl" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab xem toàn bộ cơ quan & thông báo */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveCategoryTab('ALL');
                  setSearchTerm('');
                  setSelectedDeptFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeCategoryTab === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Xem Toàn Chi Cục ({employees.length > 0 ? employees.length : ((payrollData.CONG_CHUC?.length || 0) + (payrollData.VIEN_CHUC?.length || 0) + (payrollData.HOP_DONG_111?.length || 0) + (payrollData.THU_Y_PX?.length || 0) + (payrollData.KHOAN_CM?.length || 0))} nhân sự)</span>
              </button>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500 font-medium">
                Đang xem: <strong className="text-slate-900">{activeCategoryTab === 'ALL' ? 'Toàn bộ cơ quan' : PAYROLL_CATEGORY_META[activeCategoryTab].title}</strong> ({currentRecords.length} cán bộ)
              </span>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Đã lưu trữ {savedPeriodsList.length} kỳ tính lương trong hệ thống</span>
            </div>
          </div>

          {/* KPI Cards Tổng Hợp Cho Tab Đang Chọn */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Biên Chế Tính Lương</div>
              <div className="text-lg font-black text-slate-900 mt-0.5">
                {activeTotals.count} <span className="text-xs font-normal text-slate-500">cán bộ</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Đang công tác</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Tổng Lương HSL</div>
              <div className="text-lg font-black text-sky-900 mt-0.5">
                {activeTotals.salaryAmount.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
              </div>
              <div className="text-[10px] text-sky-600 mt-1">Lương ngạch bậc</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Tổng Các Phụ Cấp</div>
              <div className="text-lg font-black text-amber-900 mt-0.5">
                {activeTotals.totalAllowanceAmount.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
              </div>
              <div className="text-[10px] text-amber-600 mt-1">HSCV, UDN, TNVK, PC Công vụ...</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Tổng Trích Nộp BHXH</div>
              <div className="text-lg font-black text-rose-900 mt-0.5">
                {activeTotals.totalDeductions.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">đ</span>
              </div>
              <div className="text-[10px] text-rose-600 mt-1">BHXH 8%, BHYT 1.5%, BHTN 1%</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-3.5 rounded-xl text-white shadow-sm col-span-2 lg:col-span-1">
              <div className="text-emerald-100 text-[11px] font-medium">TỔNG LƯƠNG THỰC NHẬN</div>
              <div className="text-lg font-black text-white mt-0.5">
                {activeTotals.netSalary.toLocaleString('vi-VN')} <span className="text-xs font-normal text-emerald-200">đ</span>
              </div>
              <div className="text-[10px] text-emerald-200 mt-1">Thực lĩnh kỳ Tháng {selectedMonth}/{selectedYear}</div>
            </div>
          </div>

          {/* Data Table */}
          <div id="monthly-payroll-table-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center uppercase tracking-wider text-[10px]">
                    <th colSpan={9} className="py-2 px-3 border-r border-slate-200 bg-slate-200/70">
                      1. THÔNG TIN CÁN BỘ NHÂN SỰ
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-sky-100 text-sky-900">
                      2. LƯƠNG HỆ SỐ
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-indigo-100 text-indigo-900">
                      3. TN VƯỢT KHUNG
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-amber-100 text-amber-900">
                      4. CHỨC VỤ (PCCV)
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-purple-100 text-purple-900">
                      5. TRÁCH NHIỆM
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-emerald-100 text-emerald-900">
                      6. ƯU ĐÃI NGÀNH (UDN)
                    </th>
                    <th className="py-2 px-2 border-r border-slate-200 bg-orange-100 text-orange-900">
                      7. CÔNG TÁC PHÍ
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-cyan-100 text-cyan-900">
                      8. CÔNG VỤ (25%)
                    </th>
                    <th colSpan={2} className="py-2 px-2 border-r border-slate-200 bg-yellow-100 text-yellow-900">
                      9. TỔNG PHỤ CẤP
                    </th>
                    <th className="py-2 px-2 border-r border-slate-200 bg-blue-100 text-blue-900">
                      10. TỔNG THU NHẬP
                    </th>
                    <th colSpan={4} className="py-2 px-2 border-r border-slate-200 bg-rose-100 text-rose-900">
                      11. TRÍCH NỘP BẢO HIỂM
                    </th>
                    <th className="py-2 px-3 bg-emerald-700 text-white font-black">
                      12. THỰC NHẬN
                    </th>
                    <th className="py-2 px-2 bg-slate-200 text-slate-700">
                      CHI TIẾT
                    </th>
                  </tr>

                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap text-[10.5px]">
                    <th className="py-2.5 px-2 text-center border-r border-slate-200">STT</th>
                    <th className="py-2.5 px-2 border-r border-slate-200">Kỳ Lương</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200">Mức Lương Cơ Sở</th>
                    <th className="py-2.5 px-2 border-r border-slate-200">Mã NV</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">Họ và Tên</th>
                    <th className="py-2.5 px-2.5 border-r border-slate-200">Đơn Vị</th>
                    <th className="py-2.5 px-2 border-r border-slate-200">Chức Danh / Vị Trí</th>
                    <th className="py-2.5 px-2 border-r border-slate-200">Chức Vụ Lãnh Đạo</th>
                    <th className="py-2.5 px-2 border-r border-slate-200">Ngạch Lương</th>
                    
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-sky-50/50">Hệ Số Lương</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-sky-50/50 font-bold">Thành Tiền HSL</th>

                    <th className="py-2.5 px-1.5 text-center border-r border-slate-200 bg-indigo-50/50">TNVK %</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-indigo-50/50">Tiền TNVK</th>

                    <th className="py-2.5 px-1.5 text-right border-r border-slate-200 bg-amber-50/50">Hệ Số CV</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-amber-50/50 font-bold">Tiền HSCV</th>

                    <th className="py-2.5 px-1.5 text-right border-r border-slate-200 bg-purple-50/50">HS TN</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-purple-50/50">Tiền PCTN</th>

                    <th className="py-2.5 px-1.5 text-center border-r border-slate-200 bg-emerald-50/50">UDN %</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-emerald-50/50 font-bold">Tiền UDN</th>

                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-orange-50/50">Công Tác Phí</th>

                    <th className="py-2.5 px-1.5 text-center border-r border-slate-200 bg-cyan-50/50">PCCV %</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-cyan-50/50">Tiền PCCV</th>

                    <th className="py-2.5 px-1.5 text-right border-r border-slate-200 bg-yellow-50/50">Tổng HS PC</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-yellow-50/50 font-bold text-amber-900">Tổng Tiền PC</th>

                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-blue-50/50 font-bold text-blue-900">Tổng Thu Nhập</th>

                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-rose-50/50">BHXH (8%)</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-rose-50/50">BHYT (1.5%)</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-rose-50/50">BHTN (1%)</th>
                    <th className="py-2.5 px-2 text-right border-r border-slate-200 bg-rose-50/50 font-bold text-rose-800">Tổng Trích Nộp</th>

                    <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950 font-black border-r border-slate-200">
                      LƯƠNG THỰC NHẬN
                    </th>

                    <th className="py-2.5 px-2 text-center">Phiếu Lương</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {currentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={31} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl shadow-xs">
                            🔍
                          </div>
                          <div className="font-bold text-slate-800 text-sm">
                            {activeCategoryTab !== 'ALL' && (((payrollData.CONG_CHUC?.length || 0) + (payrollData.VIEN_CHUC?.length || 0) + (payrollData.HOP_DONG_111?.length || 0) + (payrollData.THU_Y_PX?.length || 0) + (payrollData.KHOAN_CM?.length || 0)) > 0)
                              ? `Không có cán bộ thuộc loại hình "${PAYROLL_CATEGORY_META[activeCategoryTab]?.title || activeCategoryTab}".`
                              : searchTerm.trim() !== ''
                              ? `Không tìm thấy cán bộ nào khớp với từ khóa "${searchTerm}".`
                              : selectedDeptFilter !== 'ALL'
                              ? `Không tìm thấy cán bộ thuộc đơn vị "${selectedDeptFilter}".`
                              : `Chưa có bản ghi bảng lương cho kỳ Tháng ${selectedMonth}/${selectedYear}.`}
                          </div>
                          <p className="text-slate-500 text-xs">
                            {activeCategoryTab !== 'ALL'
                              ? `Cơ quan hiện có ${(payrollData.CONG_CHUC?.length || 0) + (payrollData.VIEN_CHUC?.length || 0)} cán bộ ở các loại hình khác. Hãy chọn "Xem Toàn Chi Cục".`
                              : `Bạn có thể bấm nút bên dưới để đặt lại bộ lọc hoặc tính toán ngay bảng lương Tháng 10/2026.`}
                          </p>
                          <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                              onClick={() => {
                                setActiveCategoryTab('ALL');
                                setSearchTerm('');
                                setSelectedDeptFilter('ALL');
                              }}
                              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Xem Toàn Bộ Cán Bộ</span>
                            </button>
                            <button
                              onClick={handleCalculateMonth10}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5 text-yellow-200 fill-yellow-200" />
                              <span>Tính Lương Tháng 10 (2.53M)</span>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRecords.map((r, idx) => (
                      <tr 
                        key={r.employeeId || r.code}
                        className="hover:bg-sky-50/60 transition whitespace-nowrap"
                      >
                        <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 font-mono text-slate-500 font-medium">
                          {r.periodKey}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-700 font-semibold">
                          {r.baseSalary.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 font-mono font-bold text-slate-700">
                          {r.code}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-900">
                          {r.fullName}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-slate-600 max-w-[160px] truncate" title={r.departmentName}>
                          {r.departmentName}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 text-slate-600">
                          {r.positionTitle}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 text-slate-600 font-medium">
                          {r.leadershipTitle || '-'}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 text-slate-500 font-mono text-[10px]">
                          {r.jobRankCode}
                        </td>

                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-semibold text-slate-800 bg-sky-50/20">
                          {r.coefficient.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-bold text-sky-900 bg-sky-50/20">
                          {r.salaryAmount.toLocaleString('vi-VN')}
                        </td>

                        <td className="py-2 px-1.5 text-center border-r border-slate-100 text-slate-500 font-mono bg-indigo-50/20">
                          {r.beyondFramePercent > 0 ? `${r.beyondFramePercent}%` : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-700 bg-indigo-50/20">
                          {r.beyondFrameAmount > 0 ? r.beyondFrameAmount.toLocaleString('vi-VN') : '-'}
                        </td>

                        <td className="py-2 px-1.5 text-right border-r border-slate-100 font-mono font-semibold text-amber-800 bg-amber-50/20">
                          {r.leadershipAllowanceCoeff > 0 ? r.leadershipAllowanceCoeff.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-bold text-amber-900 bg-amber-50/20">
                          {r.leadershipAllowanceAmount > 0 ? r.leadershipAllowanceAmount.toLocaleString('vi-VN') : '-'}
                        </td>

                        <td className="py-2 px-1.5 text-right border-r border-slate-100 font-mono text-purple-800 bg-purple-50/20">
                          {r.responsibilityAllowanceCoeff > 0 ? r.responsibilityAllowanceCoeff.toFixed(2) : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-700 bg-purple-50/20">
                          {r.responsibilityAllowanceAmount > 0 ? r.responsibilityAllowanceAmount.toLocaleString('vi-VN') : '-'}
                        </td>

                        <td className="py-2 px-1.5 text-center border-r border-slate-100 font-mono text-emerald-700 bg-emerald-50/20">
                          {r.industryAllowancePercent}%
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-bold text-emerald-900 bg-emerald-50/20">
                          {r.industryAllowanceAmount.toLocaleString('vi-VN')}
                        </td>

                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-700 bg-orange-50/20">
                          {r.travelAllowanceAmount > 0 ? r.travelAllowanceAmount.toLocaleString('vi-VN') : '-'}
                        </td>

                        <td className="py-2 px-1.5 text-center border-r border-slate-100 font-mono text-cyan-800 bg-cyan-50/20">
                          {r.publicServiceAllowancePercent > 0 ? `${r.publicServiceAllowancePercent}%` : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-700 bg-cyan-50/20">
                          {r.publicServiceAllowanceAmount > 0 ? r.publicServiceAllowanceAmount.toLocaleString('vi-VN') : '-'}
                        </td>

                        <td className="py-2 px-1.5 text-right border-r border-slate-100 font-mono font-bold text-amber-900 bg-yellow-50/30">
                          {r.totalAllowanceCoeff.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-bold text-amber-900 bg-yellow-50/30">
                          {r.totalAllowanceAmount.toLocaleString('vi-VN')}
                        </td>

                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-black text-blue-900 bg-blue-50/30">
                          {r.totalGrossIncome.toLocaleString('vi-VN')}
                        </td>

                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-600 bg-rose-50/20">
                          {r.socialInsuranceEmp.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-600 bg-rose-50/20">
                          {r.healthInsuranceEmp.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-slate-600 bg-rose-50/20">
                          {r.unemploymentInsuranceEmp > 0 ? r.unemploymentInsuranceEmp.toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-bold text-rose-800 bg-rose-50/40">
                          {r.totalDeductions.toLocaleString('vi-VN')}
                        </td>

                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-900 bg-emerald-50/80 border-r border-slate-200">
                          {r.netSalary.toLocaleString('vi-VN')} đ
                        </td>

                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => setSelectedPaySlip(r)}
                            className="p-1 text-sky-700 hover:text-sky-900 hover:bg-sky-100 rounded transition"
                            title="Xem chi tiết phiếu lương cá nhân"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 2: TRUY XUẤT LŨY KẾ THU NHẬP & BIẾN ĐỘNG LƯƠNG CÁ NHÂN           */}
      {/* ========================================================================= */}
      {viewMode === 'CUMULATIVE_ANALYTICS' && (
        <div className="space-y-6">
          {/* Panel Lọc: Từ Tháng ... Đến Tháng ... & Chọn Cá Nhân */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Khoảng thời gian:</span>
                </span>

                {/* Chọn chế độ: Theo Tháng hoặc Theo Năm */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                  <button
                    onClick={() => setCumQueryMode('MONTH_RANGE')}
                    className={`px-2 py-1 rounded-md transition ${cumQueryMode === 'MONTH_RANGE' ? 'bg-white text-sky-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Theo Tháng
                  </button>
                  <button
                    onClick={() => {
                      setCumQueryMode('YEAR_RANGE');
                      setCumFromMonth(1);
                      setCumToMonth(12);
                    }}
                    className={`px-2 py-1 rounded-md transition ${cumQueryMode === 'YEAR_RANGE' ? 'bg-white text-sky-800 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Theo Năm
                  </button>
                </div>
                
                {cumQueryMode === 'MONTH_RANGE' ? (
                  <>
                    {/* Từ tháng */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                      <span className="text-slate-500 font-medium">Từ:</span>
                      <select
                        value={cumFromMonth}
                        onChange={(e) => {
                          const newFrom = Number(e.target.value);
                          setCumFromMonth(newFrom);
                          if (cumFromYear === cumToYear && newFrom > cumToMonth) {
                            setCumToMonth(newFrom);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>Tháng {m}</option>
                        ))}
                      </select>
                      <select
                        value={cumFromYear}
                        onChange={(e) => {
                          const newYear = Number(e.target.value);
                          setCumFromYear(newYear);
                          if (newYear > cumToYear) {
                            setCumToYear(newYear);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <span className="text-slate-400 font-bold">&rarr;</span>

                    {/* Đến tháng */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                      <span className="text-slate-500 font-medium">Đến:</span>
                      <select
                        value={cumToMonth}
                        onChange={(e) => {
                          const newTo = Number(e.target.value);
                          setCumToMonth(newTo);
                          if (cumFromYear === cumToYear && newTo < cumFromMonth) {
                            setCumFromMonth(newTo);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>Tháng {m}</option>
                        ))}
                      </select>
                      <select
                        value={cumToYear}
                        onChange={(e) => {
                          const newYear = Number(e.target.value);
                          setCumToYear(newYear);
                          if (newYear < cumFromYear) {
                            setCumFromYear(newYear);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Từ năm đến năm */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                      <span className="text-slate-500 font-medium">Từ Năm:</span>
                      <select
                        value={cumFromYear}
                        onChange={(e) => {
                          const y = Number(e.target.value);
                          setCumFromYear(y);
                          setCumFromMonth(1);
                          if (y > cumToYear) {
                            setCumToYear(y);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <span className="text-slate-400 font-bold">&rarr;</span>

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                      <span className="text-slate-500 font-medium">Đến Năm:</span>
                      <select
                        value={cumToYear}
                        onChange={(e) => {
                          const y = Number(e.target.value);
                          setCumToYear(y);
                          setCumToMonth(12);
                          if (y < cumFromYear) {
                            setCumFromYear(y);
                          }
                        }}
                        className="bg-transparent font-bold text-slate-800 text-xs focus:outline-hidden cursor-pointer"
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Các nút thiết lập nhanh khoảng thời gian */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => handleSelectYearRange(2026, 2026)}
                    className="px-2 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded text-[10px] font-bold transition"
                  >
                    Năm 2026
                  </button>
                  <button
                    onClick={() => handleSelectYearRange(2025, 2025)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[10px] font-bold transition"
                  >
                    Năm 2025
                  </button>
                  <button
                    onClick={() => handleSelectYearRange(2024, 2026)}
                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold transition"
                  >
                    2024-2026
                  </button>
                  <button
                    onClick={() => handleSelectMonthRange(9, 2026, 10, 2026)}
                    className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold transition"
                  >
                    T9-T10/2026
                  </button>
                </div>
              </div>

              {/* Action Buttons: Đồng bộ Google Sheets & Xuất Excel Báo Cáo Lũy Kế */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleProcessAndSavePayroll(selectedMonth, selectedYear, baseSalary)}
                  disabled={isProcessingAndSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-sky-600 via-sky-700 to-sky-800 hover:from-sky-500 hover:to-sky-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-950/30 border-b-[3px] border-sky-900 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5 disabled:opacity-60"
                  title="Đồng bộ toàn bộ sổ lưu trữ các kỳ tính lương lên Google Sheets"
                >
                  <FileSpreadsheet className={`w-4 h-4 text-sky-100 ${isProcessingAndSaving ? 'animate-spin' : ''}`} />
                  <span>Đồng Bộ Lên Sheets</span>
                </button>
                <button
                  onClick={handleExportCumulativeExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
                  title="Xuất file Excel gồm 2 Sheet: Bảng tổng hợp lũy kế và Chi tiết biến động từng tháng"
                >
                  <Download className="w-4 h-4 text-emerald-100" />
                  <span>Xuất Báo Cáo Toàn Đơn Vị</span>
                </button>
              </div>
            </div>

            {/* Bộ chọn cá nhân & Loại hình */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-sky-600" />
                  <span>Chọn đối tượng cá nhân:</span>
                </label>
                <select
                  value={selectedIndividualCode}
                  onChange={(e) => setSelectedIndividualCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 font-bold text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ALL">-- Tất cả cán bộ trong cơ quan ({employees.length}) --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.code}>
                      {e.fullName} ({e.code}) &bull; {e.positionTitle} &bull; {e.departmentName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Phân loại nhân sự:
                </label>
                <select
                  value={cumCategoryFilter}
                  onChange={(e) => setCumCategoryFilter(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ALL">Tất cả 5 loại hình</option>
                  <option value="CONG_CHUC">1. Công chức</option>
                  <option value="VIEN_CHUC">2. Viên chức</option>
                  <option value="HOP_DONG_111">3. Hợp đồng 111 & HĐ 68</option>
                  <option value="THU_Y_PX">4. Nhân viên Thú y Phường Xã</option>
                  <option value="KHOAN_CM">5. Khoán chuyên môn</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tìm kiếm nhanh:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm tên cán bộ, phòng ban..."
                    value={cumSearchTerm}
                    onChange={(e) => setCumSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* NẾU ĐANG CHỌN 1 CÁ NHÂN CỤ THỂ HOẶC XEM BIẾN ĐỘNG LƯƠNG CỦA CÁ NHÂN */}
          {singleSelectedReport ? (
            <div className="space-y-4">
              {/* Thẻ Hồ sơ Cán bộ & Tổng Hợp Lũy Kế Thu Nhập */}
              <div className="bg-gradient-to-br from-white to-sky-50/50 p-5 rounded-2xl border border-sky-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white font-black text-lg flex items-center justify-center shadow-xs">
                      {singleSelectedReport.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-slate-900">{singleSelectedReport.fullName}</h2>
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold border border-slate-200">
                          {singleSelectedReport.code}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-800 border-blue-200">
                          {PAYROLL_CATEGORY_META[singleSelectedReport.category].shortTitle}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {singleSelectedReport.positionTitle} &bull; {singleSelectedReport.departmentName} &bull; Ngạch: <strong className="font-mono">{singleSelectedReport.jobRankCode}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="text-right">
                      <span className="text-slate-500 text-[11px]">Khoảng thời gian:</span>
                      <div className="font-bold text-sky-950 text-xs mt-0.5">
                        {singleSelectedReport.fromPeriod} &rarr; {singleSelectedReport.toPeriod} ({singleSelectedReport.monthCount} tháng tính lương)
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setIsIndividualPrintModalOpen(true)}
                        className="px-3.5 py-1.5 bg-gradient-to-b from-sky-600 via-sky-700 to-sky-800 hover:from-sky-500 hover:to-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="In hoặc xuất file PDF báo cáo thống kê thu nhập cá nhân chuẩn A4"
                      >
                        <Printer className="w-4 h-4 text-cyan-200" />
                        <span>In Báo Cáo Cá Nhân (A4)</span>
                      </button>
                      <button
                        onClick={() => MonthlyPayrollService.exportIndividualIncomeReportToExcel(singleSelectedReport, singleSelectedReport.fromPeriod, singleSelectedReport.toPeriod)}
                        className="px-3.5 py-1.5 bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Tải bảng kê chi tiết thu nhập cá nhân ra file Excel"
                      >
                        <Download className="w-4 h-4 text-emerald-100" />
                        <span>Xuất Excel Cá Nhân</span>
                      </button>
                      {selectedIndividualCode !== 'ALL' && (
                        <button
                          onClick={() => setSelectedIndividualCode('ALL')}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition cursor-pointer"
                          title="Quay lại danh sách tổng hợp toàn bộ cán bộ công chức viên chức"
                        >
                          ← Toàn Cơ Quan
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4 Cards Lũy Kế Thu Nhập Của Cá Nhân */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-slate-500 text-[11px]">Tổng Lương HSL Lũy Kế</div>
                    <div className="font-bold font-mono text-sm text-sky-900 mt-0.5">
                      {singleSelectedReport.totalSalaryAmount.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-slate-500 text-[11px]">Tổng Phụ Cấp Lũy Kế</div>
                    <div className="font-bold font-mono text-sm text-amber-900 mt-0.5">
                      {singleSelectedReport.totalAllowanceAmount.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-slate-500 text-[11px]">Tổng Trích Nộp BH Lũy Kế</div>
                    <div className="font-bold font-mono text-sm text-rose-900 mt-0.5">
                      {singleSelectedReport.totalDeductions.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-3 rounded-xl shadow-xs">
                    <div className="text-emerald-100 text-[11px]">TỔNG THỰC LĨNH LŨY KẾ</div>
                    <div className="font-black font-mono text-base mt-0.5">
                      {singleSelectedReport.totalNetSalary.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-emerald-200 mt-0.5">
                      Bình quân: {singleSelectedReport.averageMonthlyNetSalary.toLocaleString('vi-VN')} đ/tháng
                    </div>
                  </div>
                </div>
              </div>

              {/* BẢNG THEO DÕI QUÁ TRÌNH BIẾN ĐỘNG LƯƠNG CỦA CÁ NHÂN (THEO TỪNG THÁNG) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span>DIỄN BIẾN & QUÁ TRÌNH BIẾN ĐỘNG LƯƠNG QUA CÁC THÁNG</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Theo dõi chi tiết sự thay đổi hệ số lương, phụ cấp chức vụ, thâm niên vượt khung và số tiền thực nhận qua từng tháng
                    </p>
                  </div>

                  <span className="text-[11px] font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-full">
                    {singleSelectedReport.monthlyFluctuations.length} tháng ghi nhận
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                        <th className="py-2.5 px-3 border-r border-slate-200">Kỳ Tháng</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Mức Lương Cơ Sở</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Hệ Số Lương (HSL)</th>
                        <th className="py-2.5 px-2 text-center border-r border-slate-200">Biến Động HSL</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Lương Ngạch Bậc</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Phụ Cấp Chức Vụ</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Thâm Niên VK</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Ưu Đãi Ngành</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200">Công Vụ (25%)</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200 font-bold text-amber-900">Tổng Phụ Cấp</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200 font-black text-blue-900">Tổng Thu Nhập</th>
                        <th className="py-2.5 px-2 text-right border-r border-slate-200 text-rose-800">Trích BHXH</th>
                        <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-950 font-black border-r border-slate-200">
                          LƯƠNG THỰC NHẬN
                        </th>
                        <th className="py-2.5 px-3 text-center border-r border-slate-200">Biến Động Thực Nhận</th>
                        <th className="py-2.5 px-3 text-left">Nguyên Nhân / Diễn Giải</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {singleSelectedReport.monthlyFluctuations.map((f, idx) => {
                        const isCoeffChanged = f.coefficientChange && f.coefficientChange !== 0;
                        const isNetChanged = f.netSalaryChange && f.netSalaryChange !== 0;
                        const isBaseSalaryChanged = f.baseSalaryChange && f.baseSalaryChange !== 0;

                        return (
                          <tr key={f.periodKey} className="hover:bg-sky-50/50 transition whitespace-nowrap">
                            <td className="py-2.5 px-3 font-bold font-mono text-slate-800 border-r border-slate-100 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-sky-600" />
                              <span>{f.periodKey}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-slate-700 border-r border-slate-100">
                              <div className="font-bold">{f.baseSalary.toLocaleString('vi-VN')} đ</div>
                              {isBaseSalaryChanged ? (
                                <span className={`inline-block text-[9.5px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${
                                  f.baseSalaryChange! > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {f.baseSalaryChange! > 0 ? `+${f.baseSalaryChange!.toLocaleString('vi-VN')} đ` : `${f.baseSalaryChange!.toLocaleString('vi-VN')} đ`}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-100 bg-sky-50/20">
                              {f.coefficient.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-center border-r border-slate-100">
                              {isCoeffChanged ? (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full font-mono font-bold text-[10px] ${
                                  f.coefficientChange! > 0 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {f.coefficientChange! > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  <span>{f.coefficientChange! > 0 ? `+${f.coefficientChange}` : f.coefficientChange}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-sky-900 border-r border-slate-100">
                              {f.salaryAmount.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-amber-900 border-r border-slate-100">
                              {f.leadershipAllowanceAmount > 0 ? `${f.leadershipAllowanceAmount.toLocaleString('vi-VN')} đ` : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-indigo-900 border-r border-slate-100">
                              {f.beyondFrameAmount > 0 ? `${f.beyondFrameAmount.toLocaleString('vi-VN')} đ` : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-emerald-900 border-r border-slate-100">
                              {f.industryAllowanceAmount.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-cyan-900 border-r border-slate-100">
                              {f.publicServiceAllowanceAmount > 0 ? `${f.publicServiceAllowanceAmount.toLocaleString('vi-VN')} đ` : '-'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-amber-950 border-r border-slate-100 bg-amber-50/20">
                              {f.totalAllowanceAmount.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-black text-blue-950 border-r border-slate-100 bg-blue-50/20">
                              {f.totalGrossIncome.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-rose-800 border-r border-slate-100">
                              -{f.totalDeductions.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-900 bg-emerald-50/80 border-r border-slate-200">
                              {f.netSalary.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-[10px] border-r border-slate-100">
                              {isNetChanged ? (
                                <span className={`inline-flex items-center gap-0.5 font-bold ${
                                  f.netSalaryChange! > 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}>
                                  {f.netSalaryChange! > 0 ? `+${f.netSalaryChange!.toLocaleString('vi-VN')} đ` : `${f.netSalaryChange!.toLocaleString('vi-VN')} đ`}
                                </span>
                              ) : (
                                <span className="text-slate-400">Không đổi</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-left">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                f.changeDescription?.includes('Nâng bậc') && f.changeDescription?.includes('MLCS')
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : f.changeDescription?.includes('Nâng bậc')
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : f.changeDescription?.includes('lương cơ sở')
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'text-slate-400'
                              }`}>
                                {f.changeDescription || 'Ổn định'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {/* BẢNG TỔNG HỢP LŨY KẾ THU NHẬP TOÀN CƠ QUAN TRONG KHOẢNG THỜI GIAN */}
          {selectedIndividualCode === 'ALL' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-2">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900">
                    BẢNG TỔNG HỢP LŨY KẾ THU NHẬP TOÀN CƠ QUAN ({filteredCumulativeReports.length} CÁN BỘ)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Thời gian: Từ Tháng {cumFromMonth}/{cumFromYear} đến Tháng {cumToMonth}/{cumToYear}
                  </p>
                </div>

                <div className="font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  Tổng chi trả thực lĩnh: {filteredCumulativeReports.reduce((s, r) => s + r.totalNetSalary, 0).toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                      <th className="py-2.5 px-2 text-center border-r border-slate-200">STT</th>
                      <th className="py-2.5 px-2 border-r border-slate-200">Mã NV</th>
                      <th className="py-2.5 px-3 border-r border-slate-200">Họ và Tên</th>
                      <th className="py-2.5 px-2.5 border-r border-slate-200">Đơn Vị</th>
                      <th className="py-2.5 px-2 border-r border-slate-200">Chức Danh</th>
                      <th className="py-2.5 px-2 border-r border-slate-200 text-center">Phân Loại</th>
                      <th className="py-2.5 px-1.5 border-r border-slate-200 text-center">Số Tháng</th>
                      <th className="py-2.5 px-2 text-right border-r border-slate-200">Tổng Lương HSL</th>
                      <th className="py-2.5 px-2 text-right border-r border-slate-200">Tổng Phụ Cấp</th>
                      <th className="py-2.5 px-2 text-right border-r border-slate-200 font-bold text-blue-900">Tổng Thu Nhập</th>
                      <th className="py-2.5 px-2 text-right border-r border-slate-200 text-rose-800">Tổng Trích BH</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50 font-black text-emerald-950 border-r border-slate-200">
                        TỔNG THỰC NHẬN LŨY KẾ
                      </th>
                      <th className="py-2.5 px-2 text-right border-r border-slate-200 font-bold text-slate-800">
                        Bình Quân / Tháng
                      </th>
                      <th className="py-2.5 px-2 text-center">Xem Biến Động</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredCumulativeReports.map((r, idx) => (
                      <tr key={r.code} className="hover:bg-sky-50/50 transition whitespace-nowrap">
                        <td className="py-2 px-2 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 font-mono font-bold text-slate-700">
                          {r.code}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-bold text-slate-900">
                          {r.fullName}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-100 text-slate-600 max-w-[160px] truncate" title={r.departmentName}>
                          {r.departmentName}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-100 text-slate-600">
                          {r.positionTitle}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-100">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold border ${PAYROLL_CATEGORY_META[r.category].badgeColor}`}>
                            {PAYROLL_CATEGORY_META[r.category].shortTitle}
                          </span>
                        </td>
                        <td className="py-2 px-1.5 text-center border-r border-slate-100 font-mono font-bold text-sky-800">
                          {r.monthCount}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-sky-950">
                          {r.totalSalaryAmount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-amber-950">
                          {r.totalAllowanceAmount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono font-black text-blue-950 bg-blue-50/20">
                          {r.totalGrossIncome.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-100 font-mono text-rose-800">
                          -{r.totalDeductions.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-black text-emerald-900 bg-emerald-50/80">
                          {r.totalNetSalary.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200 font-mono font-bold text-slate-900">
                          {r.averageMonthlyNetSalary.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedIndividualCode(r.code)}
                              className="p-1 px-1.5 text-sky-700 hover:text-sky-900 hover:bg-sky-100 rounded transition font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer border border-sky-200"
                              title="Xem chi tiết diễn biến lương từng tháng của cá nhân này"
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Biến động</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedIndividualCode(r.code);
                                setIsIndividualPrintModalOpen(true);
                              }}
                              className="p-1 px-1.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 rounded transition font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer border border-indigo-200"
                              title="In hoặc xuất file PDF báo cáo thu nhập cá nhân chuẩn A4"
                            >
                              <Printer className="w-3.5 h-3.5 text-indigo-600" />
                              <span>In Báo Cáo</span>
                            </button>
                            <button
                              onClick={() => MonthlyPayrollService.exportIndividualIncomeReportToExcel(r, r.fromPeriod, r.toPeriod)}
                              className="p-1 px-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer border border-emerald-200"
                              title="Tải bảng kê chi tiết thu nhập ra file Excel"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Excel</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-300 whitespace-nowrap">
                      <td colSpan={7} className="py-3 px-3 border-r border-slate-300 text-center uppercase tracking-wider">
                        TỔNG CỘNG LŨY KẾ ({filteredCumulativeReports.length} cán bộ)
                      </td>
                      <td className="py-3 px-2 text-right border-r border-slate-300 font-mono text-sky-950">
                        {filteredCumulativeReports.reduce((s, r) => s + r.totalSalaryAmount, 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-2 text-right border-r border-slate-300 font-mono text-amber-950">
                        {filteredCumulativeReports.reduce((s, r) => s + r.totalAllowanceAmount, 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-2 text-right border-r border-slate-300 font-mono text-blue-950">
                        {filteredCumulativeReports.reduce((s, r) => s + r.totalGrossIncome, 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-2 text-right border-r border-slate-300 font-mono text-rose-950">
                        -{filteredCumulativeReports.reduce((s, r) => s + r.totalDeductions, 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-950 bg-emerald-200/80 border-r border-slate-300">
                        {filteredCumulativeReports.reduce((s, r) => s + r.totalNetSalary, 0).toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3 px-2 text-right font-mono">
                        {filteredCumulativeReports.length > 0 
                          ? Math.round(filteredCumulativeReports.reduce((s, r) => s + r.totalNetSalary, 0) / filteredCumulativeReports.length).toLocaleString('vi-VN') 
                          : 0} đ
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Xem Chi Tiết Phiếu Lương Cá Nhân */}
      {selectedPaySlip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-sky-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-cyan-300" />
                <div>
                  <h3 className="font-bold text-sm">PHIẾU BÁO LƯƠNG & THU NHẬP CÁ NHÂN</h3>
                  <p className="text-[11px] text-sky-200">Kỳ lương: {selectedPaySlip.periodKey}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPaySlip(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Mã nhân viên:</span>{' '}
                  <strong className="text-slate-900 font-mono">{selectedPaySlip.code}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Họ và tên:</span>{' '}
                  <strong className="text-slate-900">{selectedPaySlip.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Đơn vị:</span>{' '}
                  <span className="text-slate-800 font-medium">{selectedPaySlip.departmentName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Chức vụ:</span>{' '}
                  <span className="text-slate-800 font-medium">{selectedPaySlip.positionTitle}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ngạch lương:</span>{' '}
                  <span className="text-slate-800 font-mono">{selectedPaySlip.jobRankCode} - {selectedPaySlip.jobRankName}</span>
                </div>
                <div>
                  <span className="text-slate-500">Loại hình:</span>{' '}
                  <span className="font-bold text-sky-700">{selectedPaySlip.staffType}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-800 border-b pb-1 flex justify-between">
                  <span>Khoản mục thu nhập</span>
                  <span>Thành tiền (VNĐ)</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span>1. Lương ngạch bậc (Hệ số: <strong>{selectedPaySlip.coefficient}</strong> &times; {selectedPaySlip.baseSalary.toLocaleString('vi-VN')} đ)</span>
                  <span className="font-mono font-bold text-slate-900">{selectedPaySlip.salaryAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>2. Thâm niên vượt khung ({selectedPaySlip.beyondFramePercent}%)</span>
                  <span className="font-mono">{selectedPaySlip.beyondFrameAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>3. Phụ cấp chức vụ lãnh đạo (Hệ số: {selectedPaySlip.leadershipAllowanceCoeff})</span>
                  <span className="font-mono">{selectedPaySlip.leadershipAllowanceAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>4. Phụ cấp trách nhiệm (Hệ số: {selectedPaySlip.responsibilityAllowanceCoeff})</span>
                  <span className="font-mono">{selectedPaySlip.responsibilityAllowanceAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>5. Phụ cấp ưu đãi ngành ({selectedPaySlip.industryAllowancePercent}%)</span>
                  <span className="font-mono">{selectedPaySlip.industryAllowanceAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>6. Phụ cấp công vụ ({selectedPaySlip.publicServiceAllowancePercent}%)</span>
                  <span className="font-mono">{selectedPaySlip.publicServiceAllowanceAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>7. Phụ cấp công tác phí / lưu động</span>
                  <span className="font-mono">{selectedPaySlip.travelAllowanceAmount.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1.5 font-bold text-blue-900 bg-blue-50 px-2 rounded-lg">
                  <span>TỔNG THU NHẬP (Lương + Phụ cấp)</span>
                  <span className="font-mono text-sm">{selectedPaySlip.totalGrossIncome.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-800 border-b pb-1 flex justify-between text-rose-900">
                  <span>Các khoản trích nộp theo lương</span>
                  <span>Số tiền trừ (VNĐ)</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>- Bảo hiểm xã hội (8% lương đóng BH)</span>
                  <span className="font-mono">-{selectedPaySlip.socialInsuranceEmp.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>- Bảo hiểm y tế (1.5% lương đóng BH)</span>
                  <span className="font-mono">-{selectedPaySlip.healthInsuranceEmp.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100 text-slate-600">
                  <span>- Bảo hiểm thất nghiệp (1%)</span>
                  <span className="font-mono">-{selectedPaySlip.unemploymentInsuranceEmp.toLocaleString('vi-VN')} đ</span>
                </div>

                <div className="flex justify-between py-1.5 font-bold text-rose-900 bg-rose-50 px-2 rounded-lg">
                  <span>TỔNG TRÍCH NỘP BẢO HIỂM</span>
                  <span className="font-mono text-sm">-{selectedPaySlip.totalDeductions.toLocaleString('vi-VN')} đ</span>
                </div>
              </div>

              <div className="p-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-[11px] text-emerald-100 uppercase font-bold tracking-wider">LƯƠNG THỰC NHẬN VÀO TÀI KHOẢN</div>
                  <div className="text-xs text-emerald-200">Đã trừ các khoản đóng bảo hiểm bắt buộc</div>
                </div>
                <div className="text-xl font-black font-mono">
                  {selectedPaySlip.netSalary.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedPaySlip(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>In Phiếu Lương</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh báo & Đăng nhập lại Google (Mã lỗi 401 - Invalid authentication credentials) */}
      {authExpiredModalInfo.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 p-5 text-white flex items-start gap-3.5">
              <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black uppercase tracking-wide">
                    Xác Thực Lại Tài Khoản Google (Mã lỗi 401)
                  </h3>
                  <button 
                    onClick={() => setAuthExpiredModalInfo(prev => ({ ...prev, isOpen: false }))}
                    className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-rose-100 mt-1">
                  Mã truy cập OAuth2 đã hết hạn (Invalid authentication credentials)
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Dữ liệu tính lương đã được lưu an toàn trong CSDL nội bộ</div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    Kỳ lương <strong>{authExpiredModalInfo.pendingPeriodKey || `${selectedMonth}/${selectedYear}`}</strong> đã được tính toán đầy đủ cho tất cả cán bộ công chức, viên chức.
                  </div>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-rose-900">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Lỗi xác thực Google Sheets (HTTP 401)</div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    {authExpiredModalInfo.message || 'Mã xác thực Google OAuth2 đã hết hạn sau phiên làm việc hoặc chưa được cấp quyền ghi.'}
                  </div>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed">
                Để dữ liệu được đồng bộ trực tiếp vào trang tính Google Sheets <strong>"{MONTHLY_PAYROLL_SPREADSHEET_TITLE}"</strong>, vui lòng bấm nút bên dưới để cấp mới phiên đăng nhập Google. Hệ thống sẽ tự động lưu ngay bảng lương sau khi đăng nhập thành công.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAuthExpiredModalInfo(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Để Sau (Giữ trong CSDL)
              </button>
              <button
                type="button"
                onClick={handleReAuthAndSync}
                disabled={isProcessingAndSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-black rounded-xl shadow-md shadow-orange-950/20 active:translate-y-0.5 transition cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4 text-yellow-200" />
                <span>
                  {isProcessingAndSaving ? 'Đang Đăng Nhập & Đồng Bộ...' : 'Đăng Nhập Lại Google & Đồng Bộ Ngay'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal In Bảng Lương Nhà Nước Chuẩn Chỉ */}
      <PayrollPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        baseSalary={baseSalary}
        payrollData={payrollData}
        departments={departments}
        employees={employees}
      />

      {/* Modal In Báo Cáo Thống Kê Thu Nhập Cá Nhân Qua Các Kỳ Tính Lương Chuẩn A4 */}
      <IndividualIncomePrintModal
        isOpen={isIndividualPrintModalOpen}
        onClose={() => setIsIndividualPrintModalOpen(false)}
        report={singleSelectedReport}
        fromPeriod={singleSelectedReport?.fromPeriod || `Tháng ${cumFromMonth}/${cumFromYear}`}
        toPeriod={singleSelectedReport?.toPeriod || `Tháng ${cumToMonth}/${cumToYear}`}
      />

      {/* Modal Cấu hình Google Apps Script Webhook (Code.gs) & Xử lý CORS */}
      {isAppsScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-sky-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-sky-800 to-indigo-900 p-5 text-white flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Code className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wide">
                    Cấu Hình Google Apps Script Webhook (Code.gs)
                  </h3>
                  <p className="text-xs text-sky-200 mt-0.5">
                    Khắc phục triệt để lỗi CORS, ngắt kết nối và quyền truy cập khi đồng bộ Google Sheets
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAppsScriptModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              {/* Giải thích vì sao cần Apps Script Webhook */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3.5 space-y-2">
                <div className="font-bold text-sky-950 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>Tại sao nên dùng Google Apps Script Webhook?</span>
                </div>
                <p className="text-sky-900 leading-relaxed text-[11px]">
                  Khi gọi trực tiếp Google Sheets API từ trình duyệt, một số trình duyệt hoặc mạng nội bộ cơ quan có thể chặn yêu cầu vì chính sách <strong>CORS</strong> hoặc thiếu quyền ghi Drive. Google Apps Script Web App đóng vai trò như một Backend trung gian miễn phí, nhận POST requests và tự động ghi thẳng vào file Google Sheets mà không lo lỗi CORS hay hết hạn Token.
                </p>
              </div>

              {/* Ô cấu hình URL Webhook */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <label className="font-bold text-slate-900 block text-xs">
                  Đường dẫn Google Apps Script Web App URL (doPost Webhook):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={appsScriptUrlInput}
                    onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      MonthlyPayrollService.setAppsScriptUrl(appsScriptUrlInput);
                      showToast('Đã lưu cấu hình Google Apps Script Webhook URL!', 'success');
                    }}
                    className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg cursor-pointer transition shadow-xs whitespace-nowrap"
                  >
                    Lưu URL
                  </button>
                  {appsScriptUrlInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setAppsScriptUrlInput('');
                        MonthlyPayrollService.setAppsScriptUrl('');
                        showToast('Đã xóa URL Webhook, chuyển về gọi Google API trực tiếp.', 'success');
                      }}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer transition whitespace-nowrap"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {appsScriptUrlInput 
                    ? '✅ Hệ thống sẽ tự động ưu tiên đồng bộ qua Webhook này khi nhấn Tính Lương / Lưu Bảng Lương.'
                    : 'ℹ️ Chưa cấu hình Webhook. Hệ thống đang sử dụng Google Sheets API v4 trực tiếp qua OAuth2.'}
                </p>
              </div>

              {/* Hướng dẫn cài đặt 5 bước */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-white">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Các bước triển khai Google Apps Script (Code.gs):</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(APPS_SCRIPT_SAMPLE_CODE);
                      setHasCopiedCode(true);
                      showToast('📋 Đã sao chép toàn bộ mã Code.gs vào bộ nhớ đệm!', 'success');
                      setTimeout(() => setHasCopiedCode(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                  >
                    {hasCopiedCode ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{hasCopiedCode ? 'Đã sao chép!' : 'Sao chép mã Code.gs'}</span>
                  </button>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                  <li>Mở bảng tính Google Sheets của bạn &rarr; chọn <strong>Tiện ích mở rộng (Extensions)</strong> &rarr; <strong>Apps Script</strong>.</li>
                  <li>Xóa toàn bộ mã mặc định trong tệp <code>Code.gs</code>, dán đoạn mã bên dưới vào và nhấn <strong>Lưu dự án (Ctrl + S)</strong>.</li>
                  <li>Nhấn nút <strong>Triển khai (Deploy)</strong> màu xanh ở góc trên bên phải &rarr; chọn <strong>Tùy chọn triển khai mới (New deployment)</strong>.</li>
                  <li>Nhấp vào biểu tượng bánh răng chọn loại <strong>Ứng dụng web (Web app)</strong>:
                    <ul className="list-disc list-inside pl-4 mt-0.5 text-slate-500 space-y-0.5">
                      <li>Thực thi dưới dạng: <strong>Tôi (Me)</strong></li>
                      <li>Ai có quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong> <span className="text-amber-700 font-bold">(Rất quan trọng để tránh lỗi CORS)</span></li>
                    </ul>
                  </li>
                  <li>Nhấn <strong>Triển khai (Deploy)</strong>, cấp quyền nếu được hỏi, sau đó sao chép <strong>URL ứng dụng web</strong> dán vào ô bên trên.</li>
                </ol>
              </div>

              {/* Khung hiển thị Code.gs */}
              <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-900 text-slate-100">
                <div className="bg-slate-800 px-3 py-2 flex items-center justify-between border-b border-slate-700">
                  <span className="font-mono font-bold text-[11px] text-slate-300">Code.gs (Hỗ trợ doPost, xử lý CORS, ghi 6 Sheet)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(APPS_SCRIPT_SAMPLE_CODE);
                      setHasCopiedCode(true);
                      showToast('📋 Đã sao chép mã Code.gs!', 'success');
                      setTimeout(() => setHasCopiedCode(false), 2500);
                    }}
                    className="text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy code</span>
                  </button>
                </div>
                <pre className="p-3 font-mono text-[10.5px] leading-relaxed max-h-48 overflow-y-auto text-emerald-300 whitespace-pre">
                  {APPS_SCRIPT_SAMPLE_CODE}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                disabled={isTestingSync}
                onClick={async () => {
                  try {
                    setIsTestingSync(true);
                    const res = await MonthlyPayrollService.syncToGoogleSheets(selectedMonth, selectedYear, baseSalary, payrollData);
                    setSyncResult({ url: res.spreadsheetUrl, count: res.totalSynced, periodKey: `${String(selectedMonth).padStart(2, '0')}/${selectedYear}` });
                    showToast(`🎉 Kiểm tra đồng bộ thành công! Đã gửi ${res.totalSynced} bản ghi lên Google Sheets.`, 'success');
                  } catch (testErr: any) {
                    showToast(`❌ Lỗi đồng bộ Sheets: ${testErr.message || 'Không thể đồng bộ'}`, 'error');
                  } finally {
                    setIsTestingSync(false);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSync ? 'animate-spin' : ''}`} />
                <span>{isTestingSync ? 'Đang kiểm tra đồng bộ...' : 'Thử Nghiệm Đồng Bộ Ngay'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAppsScriptModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cảnh Báo & Xác Nhận Ghi Đè Kỳ Lương Đã Tồn Tại */}
      {overwriteConfirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-300 animate-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-5 text-white flex items-start gap-3.5">
              <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                <AlertTriangle className="w-7 h-7 text-yellow-200" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black uppercase tracking-wide">
                    Xác Nhận Ghi Đè Dữ Liệu Kỳ Lương
                  </h3>
                  <button 
                    onClick={handleCancelOverwrite}
                    className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-amber-100 mt-1">
                  Kỳ lương Tháng {overwriteConfirmModal.periodKey} đã có bản ghi trong hệ thống
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-950">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm font-semibold leading-relaxed">
                  Dữ liệu kỳ lương tháng này đã tồn tại trong hệ thống. Bạn có chắc chắn muốn ghi đè lên dữ liệu đã có không?
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-slate-600 text-xs font-mono">
                <div className="flex justify-between">
                  <span>Kỳ lương tính toán:</span>
                  <strong className="text-slate-900 font-bold">Tháng {overwriteConfirmModal.periodKey}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Mức lương cơ sở:</span>
                  <strong className="text-sky-800 font-bold">{overwriteConfirmModal.baseSalary.toLocaleString('vi-VN')} đ/tháng</strong>
                </div>
                <div className="flex justify-between">
                  <span>Số lượng cán bộ:</span>
                  <strong className="text-slate-900 font-bold">{employees.length} người</strong>
                </div>
              </div>

              <p className="text-slate-500 text-[11px] leading-relaxed">
                * Nếu chọn <strong>Đồng ý</strong>: Hệ thống sẽ tiến hành ghi đè dữ liệu mới vào CSDL và đồng bộ lên Google Sheets. Nếu chọn <strong>Hủy</strong>: Quá trình lưu sẽ dừng lại và giữ nguyên vẹn dữ liệu cũ.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancelOverwrite}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Hủy (Giữ Dữ Liệu Cũ)
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-orange-500 text-white font-black rounded-xl shadow-md shadow-orange-950/20 active:translate-y-0.5 transition cursor-pointer"
              >
                <Check className="w-4 h-4 text-yellow-200" />
                <span>Đồng Ý (Ghi Đè & Đồng Bộ)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const APPS_SCRIPT_SAMPLE_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ BẢNG LƯƠNG & THU NHẬP (Code.gs)
 * CHI CỤC CHĂN NUÔI VÀ THÚ Y THÀNH PHỐ HỒ CHÍ MINH
 * ============================================================================
 * 
 * Hướng dẫn:
 * 1. Mở file Google Sheets -> Tiện ích mở rộng (Extensions) -> Apps Script
 * 2. Xóa hết mã cũ và dán toàn bộ đoạn mã này vào file Code.gs
 * 3. Nhấn nút "Lưu dự án" (Ctrl + S)
 * 4. Nhấn "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment)
 * 5. Chọn loại "Ứng dụng web" (Web app):
 *    - Mô tả: Webhook Bảng Lương CCTY
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 6. Nhấn "Triển khai" (Deploy) -> Cấp quyền nếu có yêu cầu -> Sao chép URL ứng dụng web
 * 7. Dán URL ứng dụng web vào phần mềm và nhấn "Lưu URL".
 */

// Xử lý yêu cầu CORS Preflight (OPTIONS request)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

// Kiểm tra trạng thái hoạt động (GET request)
function doGet(e) {
  var response = {
    status: "online",
    message: "Google Apps Script Webhook cho Bảng Lương CCTY đang hoạt động sẵn sàng!",
    spreadsheetName: SpreadsheetApp.getActiveSpreadsheet().getName(),
    spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Tiếp nhận dữ liệu bảng lương từ Web App (POST request)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Đợi tối đa 15 giây nếu có tiến trình khác đang ghi
    lock.waitLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Không nhận được nội dung dữ liệu gửi lên (postData rỗng).");
    }

    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      throw new Error("Không thể phân tích dữ liệu JSON: " + parseErr.message);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var periodKey = payload.periodKey || (payload.month + "/" + payload.year);
    var sheetsData = payload.sheetsData || {};
    var totalSynced = payload.totalSynced || 0;

    var sheetNames = Object.keys(sheetsData);
    if (!sheetNames || sheetNames.length === 0) {
      sheetNames = [
        "LUONG_CONG_CHUC",
        "LUONG_VIEN_CHUC",
        "LUONG_HD_111",
        "LUONG_THUY_PX",
        "LUONG_KHOAN_CM",
        "LuyKe_ThuNhap_ToanDonVi",
        "LichSu_CacKyLuong"
      ];
    }

    for (var i = 0; i < sheetNames.length; i++) {
      var sName = sheetNames[i];
      var itemData = sheetsData[sName];
      if (!itemData || !itemData.rows || itemData.rows.length === 0) continue;

      var sheet = ss.getSheetByName(sName);
      if (!sheet) {
        sheet = ss.insertSheet(sName);
        sheet.setFrozenRows(4);
      }

      // Xóa nội dung dữ liệu cũ
      sheet.clearContents();

      var rows = itemData.rows;
      var numRows = rows.length;
      var maxCols = 0;
      for (var r = 0; r < numRows; r++) {
        if (rows[r].length > maxCols) maxCols = rows[r].length;
      }

      // Chuẩn hóa mảng 2 chiều
      var formattedValues = [];
      for (var r = 0; r < numRows; r++) {
        var rowArr = [];
        for (var c = 0; c < maxCols; c++) {
          var val = rows[r][c];
          rowArr.push(val !== undefined && val !== null ? val : "");
        }
        formattedValues.push(rowArr);
      }

      // Ghi dữ liệu vào trang tính
      if (numRows > 0 && maxCols > 0) {
        var range = sheet.getRange(1, 1, numRows, maxCols);
        range.setValues(formattedValues);
      }
    }

    var result = {
      status: "success",
      message: "Đồng bộ thành công kỳ lương Tháng " + periodKey + " vào Google Sheets!",
      periodKey: periodKey,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      totalSynced: totalSynced,
      timestamp: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    var errorResponse = {
      status: "error",
      message: error.toString(),
      timestamp: new Date().toISOString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
