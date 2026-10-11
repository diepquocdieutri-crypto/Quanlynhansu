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
  ArrowRight,
  ArrowUpRight,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  HelpCircle,
  Check,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Table,
  EyeOff,
  Info,
  DollarSign,
  Zap,
  Upload
} from 'lucide-react';
import {
  Employee,
  Department,
  TaxDependent,
  MonthlyTaxDetail,
  QuarterlyTaxRecord,
  AnnualTaxRecord,
  OtherIncomeItem
} from '../types/hrm';
import {
  QuarterlyTaxService,
  TAX_SPREADSHEET_TITLE,
  TAX_SAVED_QUARTERS_KEY,
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
  PERSONAL_DEDUCTION_QUARTERLY,
  DEPENDENT_DEDUCTION_QUARTERLY,
  PERSONAL_DEDUCTION_ANNUAL,
  DEPENDENT_DEDUCTION_ANNUAL
} from '../services/quarterlyTaxService';
import { OtherIncomeManagementSection } from './OtherIncomeManagementSection';
import { OtherIncomeFormModal } from './OtherIncomeFormModal';
import { OtherIncomeExcelImportModal } from './OtherIncomeExcelImportModal';

interface QuarterlyTaxViewProps {
  employees: Employee[];
  departments: Department[];
  googleConnected: boolean;
  onLoginGoogle?: () => void;
  onSelectEmployee?: (emp: Employee) => void;
  onNavigateToMonthlyPayroll?: () => void;
}

type TabType = 'QUARTERLY_TAX' | 'INCOME_STATS' | 'OTHER_INCOME' | 'THREE_MONTHS_DETAIL' | 'DEPENDENTS' | 'ANNUAL_SETTLEMENT';

export const QuarterlyTaxView: React.FC<QuarterlyTaxViewProps> = ({
  employees,
  departments,
  googleConnected,
  onLoginGoogle,
  onSelectEmployee,
  onNavigateToMonthlyPayroll,
}) => {
  // Kỳ thuế lựa chọn
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(3); // Quý 3/2026 mặc định
  const [activeTab, setActiveTab] = useState<TabType>('QUARTERLY_TAX');

  // Bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Danh sách Người phụ thuộc (NPT)
  const [dependents, setDependents] = useState<TaxDependent[]>([]);
  const [isDependentModalOpen, setIsDependentModalOpen] = useState(false);
  const [editingDependent, setEditingDependent] = useState<TaxDependent | null>(null);

  // Danh sách Thu Nhập Khác (đưa lên từ Excel & nhập mới)
  const [otherIncomes, setOtherIncomes] = useState<OtherIncomeItem[]>([]);
  const [isOtherIncomeModalOpen, setIsOtherIncomeModalOpen] = useState(false);
  const [editingOtherIncome, setEditingOtherIncome] = useState<OtherIncomeItem | null>(null);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

  // Modal điều tra/truy ngược cá nhân (Quarter -> Months -> Salary items -> PIT)
  const [auditTargetRecord, setAuditTargetRecord] = useState<QuarterlyTaxRecord | null>(null);

  // Trạng thái nút Tính thuế theo Quý & Năm từ chi tiết tháng
  const [isCalculatingQuarterTax, setIsCalculatingQuarterTax] = useState(false);
  const [calculatedQuarterInfo, setCalculatedQuarterInfo] = useState<{
    quarter: number;
    year: number;
    timestamp: string;
    monthsExtracted: number[];
  } | null>(null);

  const [isCalculatingAnnualTax, setIsCalculatingAnnualTax] = useState(false);
  const [calculatedAnnualInfo, setCalculatedAnnualInfo] = useState<{
    year: number;
    timestamp: string;
  } | null>(null);

  // Chế độ xem chi tiết từng tháng trên bảng tính thuế Quý
  const [showMonthlyBreakdownOnTaxTable, setShowMonthlyBreakdownOnTaxTable] = useState<boolean>(false);
  const [expandedEmployeeCode, setExpandedEmployeeCode] = useState<string | null>(null);
  const [showExtractedMonthsBanner, setShowExtractedMonthsBanner] = useState<boolean>(true);

  // Chế độ xem chi tiết 4 Quý trên bảng quyết toán năm
  const [showQuarterlyBreakdownOnAnnualTable, setShowQuarterlyBreakdownOnAnnualTable] = useState<boolean>(false);
  const [expandedAnnualEmployeeCode, setExpandedAnnualEmployeeCode] = useState<string | null>(null);
  const [showAnnualExtractedBanner, setShowAnnualExtractedBanner] = useState<boolean>(true);

  // Banner hiển thị kết quả gom thu nhập khác theo Quý
  const [aggregatedQuarterBanner, setAggregatedQuarterBanner] = useState<{
    quarter: number;
    year: number;
    totalAmount: number;
    itemsCount: number;
    staffCount: number;
    cuongTotal: number;
    timestamp: string;
  } | null>(null);

  // Trạng thái đồng bộ Google Sheets
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ url: string; count: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Tải danh sách người phụ thuộc & thu nhập khác
  useEffect(() => {
    const list = QuarterlyTaxService.getDependents();
    setDependents(list);
    const incList = QuarterlyTaxService.getOtherIncomes();
    setOtherIncomes(incList);
  }, []);

  // Bản đồ thu nhập khác tính từ React state để đồng bộ tức thời khi nhập/tải lên Excel
  const otherIncomesMap = useMemo(() => {
    return QuarterlyTaxService.getOtherIncomesMap(otherIncomes);
  }, [otherIncomes]);

  // Tính toán dữ liệu thuế Quý và Năm (tự động cập nhật khi có biến động thu nhập khác hoặc NPT)
  const quarterlyRecords = useMemo(() => {
    return QuarterlyTaxService.calculateQuarterlyTax(employees, selectedQuarter, selectedYear, otherIncomesMap);
  }, [employees, selectedQuarter, selectedYear, dependents, otherIncomesMap]);

  const annualRecords = useMemo(() => {
    return QuarterlyTaxService.calculateAnnualTax(employees, selectedYear, otherIncomesMap);
  }, [employees, selectedYear, dependents, otherIncomesMap]);

  // Bộ lọc dữ liệu bảng Quý
  const filteredQuarterlyRecords = useMemo(() => {
    return quarterlyRecords.filter(r => {
      const matchSearch =
        !searchTerm.trim() ||
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.departmentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = departmentFilter === 'ALL' || r.departmentName === departmentFilter;

      return matchSearch && matchDept;
    });
  }, [quarterlyRecords, searchTerm, departmentFilter]);

  // Bộ lọc dữ liệu quyết toán năm
  const filteredAnnualRecords = useMemo(() => {
    return annualRecords.filter(r => {
      const matchSearch =
        !searchTerm.trim() ||
        r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.departmentName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDept = departmentFilter === 'ALL' || r.departmentName === departmentFilter;

      return matchSearch && matchDept;
    });
  }, [annualRecords, searchTerm, departmentFilter]);

  // Thống kê tổng hợp Quý
  const summary = useMemo(() => {
    const totalStaff = quarterlyRecords.length;
    const totalGross = quarterlyRecords.reduce((s, r) => s + r.qTotalGrossIncome, 0);
    const totalTaxable = quarterlyRecords.reduce((s, r) => s + r.qTaxableIncome, 0);
    const totalInsurance = quarterlyRecords.reduce((s, r) => s + r.qCompulsoryInsurance, 0);
    const totalPersonal = quarterlyRecords.reduce((s, r) => s + r.qPersonalDeduction, 0);
    const totalDependentDeduction = quarterlyRecords.reduce((s, r) => s + r.qDependentDeduction, 0);
    const totalDeductions = quarterlyRecords.reduce((s, r) => s + r.qTotalDeductions, 0);
    const totalAssessable = quarterlyRecords.reduce((s, r) => s + r.qAssessableIncome, 0);
    const totalTaxWithheld = quarterlyRecords.reduce((s, r) => s + r.qTaxWithheld, 0);
    const totalQuarterlyTaxPayable = quarterlyRecords.reduce((s, r) => s + r.qQuarterlyTaxPayable, 0);
    const totalDiff = quarterlyRecords.reduce((s, r) => s + r.qTaxDifference, 0);

    return {
      totalStaff,
      totalGross,
      totalTaxable,
      totalInsurance,
      totalPersonal,
      totalDependentDeduction,
      totalDeductions,
      totalAssessable,
      totalTaxWithheld,
      totalQuarterlyTaxPayable,
      totalDiff,
    };
  }, [quarterlyRecords]);

  // Tháng tương ứng với quý
  const quarterMonthNumbers = useMemo(() => {
    return selectedQuarter === 1 ? [1, 2, 3] : selectedQuarter === 2 ? [4, 5, 6] : selectedQuarter === 3 ? [7, 8, 9] : [10, 11, 12];
  }, [selectedQuarter]);

  // Thống kê 3 tháng chi tiết đã lấy để tạo thành Quý
  const quarterMonthsDetailSummary = useMemo(() => {
    return quarterMonthNumbers.map(monthNum => {
      const monthSalaryTotal = quarterlyRecords.reduce((sum, r) => {
        const m = r.months.find(x => x.month === monthNum);
        return sum + (m?.salaryAmount || 0);
      }, 0);
      const monthGrossTotal = quarterlyRecords.reduce((sum, r) => {
        const m = r.months.find(x => x.month === monthNum);
        return sum + (m?.totalGrossIncome || 0);
      }, 0);
      const monthOtherIncomeTotal = otherIncomes
        .filter(i => i.year === selectedYear && i.month === monthNum)
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const monthOtherIncomeCount = otherIncomes
        .filter(i => i.year === selectedYear && i.month === monthNum).length;
      const monthInsuranceTotal = quarterlyRecords.reduce((sum, r) => {
        const m = r.months.find(x => x.month === monthNum);
        return sum + (m?.compulsoryInsurance || 0);
      }, 0);
      const monthTaxWithheldTotal = quarterlyRecords.reduce((sum, r) => {
        const m = r.months.find(x => x.month === monthNum);
        return sum + (m?.monthlyTaxWithheld || 0);
      }, 0);

      return {
        month: monthNum,
        year: selectedYear,
        monthSalaryTotal,
        monthGrossTotal,
        monthOtherIncomeTotal,
        monthOtherIncomeCount,
        monthInsuranceTotal,
        monthTaxWithheldTotal,
      };
    });
  }, [quarterlyRecords, quarterMonthNumbers, otherIncomes, selectedYear]);

  // Thống kê 4 Quý chi tiết đã lấy để tạo thành Quyết toán năm
  const annualQuartersDetailSummary = useMemo(() => {
    const q1Tax = annualRecords.reduce((sum, r) => sum + r.q1TaxWithheld, 0);
    const q2Tax = annualRecords.reduce((sum, r) => sum + r.q2TaxWithheld, 0);
    const q3Tax = annualRecords.reduce((sum, r) => sum + r.q3TaxWithheld, 0);
    const q4Tax = annualRecords.reduce((sum, r) => sum + r.q4TaxWithheld, 0);
    const totalTaxWithheld = annualRecords.reduce((sum, r) => sum + r.annualTaxWithheld, 0);
    const totalTaxPayable = annualRecords.reduce((sum, r) => sum + r.annualTaxPayable, 0);
    const totalTaxBalance = annualRecords.reduce((sum, r) => sum + r.annualTaxBalance, 0);

    return {
      q1Tax,
      q2Tax,
      q3Tax,
      q4Tax,
      totalTaxWithheld,
      totalTaxPayable,
      totalTaxBalance,
    };
  }, [annualRecords]);

  // Thông báo Toast tự tắt
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Đồng bộ lên Google Sheets
  const handleSyncToSheets = async () => {
    if (!googleConnected) {
      if (onLoginGoogle) {
        onLoginGoogle();
      } else {
        showToast('Vui lòng kết nối tài khoản Google để đồng bộ Google Sheets', 'error');
      }
      return;
    }

    try {
      setIsSyncing(true);
      const res = await QuarterlyTaxService.syncTaxToGoogleSheets(
        selectedQuarter,
        selectedYear,
        quarterlyRecords,
        annualRecords,
        dependents,
        otherIncomes
      );
      setSyncResult({ url: res.spreadsheetUrl, count: res.totalSynced });
      showToast(`Đã đồng bộ thành công 6 trang tính thuế TNCN lên Google Sheets (${res.totalSynced} cán bộ)!`, 'success');
    } catch (err: any) {
      console.error('Lỗi sync tax to sheets:', err);
      showToast(err.message || 'Lỗi khi đồng bộ lên Google Sheets', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Xuất file Excel 6 Sheets
  const handleExportExcel = () => {
    try {
      QuarterlyTaxService.exportTaxToExcel(selectedQuarter, selectedYear, quarterlyRecords, annualRecords, dependents, otherIncomes);
      showToast('Đã xuất thành công file Excel 6 trang tính hồ sơ thuế TNCN theo quý!', 'success');
    } catch (err: any) {
      console.error('Lỗi export excel:', err);
      showToast('Không thể xuất file Excel: ' + err.message, 'error');
    }
  };

  // Xử lý Người phụ thuộc (Lưu / Xóa)
  const handleSaveDependent = (dep: TaxDependent) => {
    QuarterlyTaxService.saveDependent(dep);
    setDependents(QuarterlyTaxService.getDependents());
    setIsDependentModalOpen(false);
    setEditingDependent(null);
    showToast('Đã lưu thông tin người phụ thuộc thành công!', 'success');
  };

  const handleDeleteDependent = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa người phụ thuộc này không?')) {
      QuarterlyTaxService.deleteDependent(id);
      setDependents(QuarterlyTaxService.getDependents());
      showToast('Đã xóa người phụ thuộc!', 'success');
    }
  };

  // Xử lý Thu nhập khác (Lưu, Xóa, Nhập Excel, Gom theo Quý)
  const handleSaveOtherIncome = (item: OtherIncomeItem) => {
    QuarterlyTaxService.saveOtherIncome(item);
    setOtherIncomes(QuarterlyTaxService.getOtherIncomes());
    setIsOtherIncomeModalOpen(false);
    setEditingOtherIncome(null);
    showToast('Đã lưu khoản thu nhập khác thành công!', 'success');
  };

  const handleDeleteOtherIncome = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa khoản thu nhập khác này không?')) {
      QuarterlyTaxService.deleteOtherIncome(id);
      setOtherIncomes(QuarterlyTaxService.getOtherIncomes());
      showToast('Đã xóa khoản thu nhập khác!', 'success');
    }
  };

  const handleImportExcelSuccess = (items: OtherIncomeItem[]) => {
    for (const it of items) {
      QuarterlyTaxService.saveOtherIncome(it);
    }
    setOtherIncomes(QuarterlyTaxService.getOtherIncomes());
    setIsExcelImportModalOpen(false);
    showToast(`Đã đưa thành công ${items.length} khoản thu nhập khác từ file Excel vào hệ thống!`, 'success');
  };

  // Nút kích hoạt gom theo quý của phần chi tiết thu nhập khác để điền vào bảng thu nhập quý
  const handleAggregateQuarterlyOtherIncomes = () => {
    const qMonths = selectedQuarter === 1 ? [1, 2, 3] : selectedQuarter === 2 ? [4, 5, 6] : selectedQuarter === 3 ? [7, 8, 9] : [10, 11, 12];
    const quarterItems = otherIncomes.filter(
      item => Number(item.year) === selectedYear && qMonths.includes(Number(item.month))
    );
    const totalAmount = quarterItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const affectedStaff = new Set(quarterItems.map(item => (item.employeeCode || '').trim().toUpperCase()).filter(Boolean));

    const cuongItems = quarterItems.filter(
      i => (i.employeeCode && i.employeeCode.trim().toUpperCase() === 'NV-19750312-0001') ||
           (i.employeeName && i.employeeName.trim().toLowerCase().includes('trần phú cường'))
    );
    const cuongTotal = cuongItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAggregatedQuarterBanner({
      quarter: selectedQuarter,
      year: selectedYear,
      totalAmount,
      itemsCount: quarterItems.length,
      staffCount: affectedStaff.size,
      cuongTotal,
      timestamp: nowStr,
    });

    showToast(
      `⚡ Đã gom thành công ${quarterItems.length} khoản thu nhập khác (Tổng: ${totalAmount.toLocaleString('vi-VN')} đ cho ${affectedStaff.size} cán bộ, trong đó ông Trần Phú Cường: ${cuongTotal.toLocaleString('vi-VN')} đ) vào Bảng Thống Kê Thu Nhập Quý ${['I', 'II', 'III', 'IV'][selectedQuarter - 1]}/${selectedYear}!`,
      'success'
    );
    setActiveTab('INCOME_STATS');
  };

  // Nút tính thuế Quý: Lấy các bảng chi tiết của 3 tháng tương ứng tạo thành bảng tính thuế của Quý
  const handleExecuteQuarterlyTaxCalculation = () => {
    setIsCalculatingQuarterTax(true);
    setTimeout(() => {
      setIsCalculatingQuarterTax(false);
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCalculatedQuarterInfo({
        quarter: selectedQuarter,
        year: selectedYear,
        timestamp: nowStr,
        monthsExtracted: quarterMonthNumbers,
      });
      setShowExtractedMonthsBanner(true);

      // Lưu trạng thái vào danh sách kỳ thuế đã tính
      try {
        const savedList = JSON.parse(localStorage.getItem(TAX_SAVED_QUARTERS_KEY) || '[]');
        const key = `Q${selectedQuarter}_${selectedYear}`;
        const updated = savedList.filter((k: string) => k !== key);
        updated.push(key);
        localStorage.setItem(TAX_SAVED_QUARTERS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Lỗi lưu kỳ thuế:', e);
      }

      showToast(
        `⚡ Đã lấy bảng chi tiết 3 tháng (Tháng ${quarterMonthNumbers[0]}, Tháng ${quarterMonthNumbers[1]}, Tháng ${quarterMonthNumbers[2]}) ➔ Tạo thành Bảng Tính Thuế Quý ${['I', 'II', 'III', 'IV'][selectedQuarter - 1]} năm ${selectedYear} thành công!`,
        'success'
      );
    }, 450);
  };

  // Nút tính thuế quyết toán năm: Lấy các bảng chi tiết của 4 Quý (12 tháng lương & thu nhập khác) tạo thành bảng quyết toán cả năm
  const handleExecuteAnnualTaxCalculation = () => {
    setIsCalculatingAnnualTax(true);
    setTimeout(() => {
      setIsCalculatingAnnualTax(false);
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setCalculatedAnnualInfo({
        year: selectedYear,
        timestamp: nowStr,
      });
      setShowAnnualExtractedBanner(true);

      showToast(
        `⚡ Đã lấy bảng chi tiết 4 Quý (12 tháng lương & thu nhập khác) ➔ Tạo thành Bảng Quyết Toán Thuế TNCN cả năm ${selectedYear} thành công!`,
        'success'
      );
    }, 450);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-medium animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-600'
              : 'bg-rose-950 text-rose-100 border-rose-600'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* HEADER BANNER CHUYÊN NGHIỆP */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-sky-950 rounded-2xl p-6 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-indigo-300" />
                  Hệ Thống Tính Lương & Thuế TNCN
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Google Sheets Riêng Biệt (5 Sheet)
                </span>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Mô Hình 3 Tầng Dữ Liệu
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                HỆ THỐNG TÍNH LƯƠNG & LƯU TRỮ LŨY KẾ THU NHẬP - TÍNH THUẾ THEO QUÝ
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-3xl leading-relaxed">
                Tự động trích xuất hệ số lương, phụ cấp vượt khung, chức vụ, công vụ và các khoản giảm trừ bảo hiểm, bản thân, người phụ thuộc để tính và đối soát thuế TNCN 3 tháng/lần.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {onNavigateToMonthlyPayroll && (
                <button
                  onClick={onNavigateToMonthlyPayroll}
                  className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition flex items-center gap-2 shadow-sm"
                  title="Chuyển sang Bảng lương hàng tháng"
                >
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  Bảng Lương Tháng
                </button>
              )}

              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow transition flex items-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4" />
                Xuất Excel (5 Sheet)
              </button>

              <button
                onClick={handleSyncToSheets}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang đồng bộ Sheets...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                    Đồng bộ Google Sheets
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SƠ ĐỒ MÔ HÌNH 3 TẦNG ĐỀ XUẤT */}
          <div className="mt-5 pt-4 border-t border-indigo-800/50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-indigo-900/40">
              <div className="text-xs font-bold text-sky-300 uppercase flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                TẦNG 1: Dữ liệu Tháng (Gốc)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Lấy từ bảng lương: Lương hệ số, phụ cấp chức vụ, TNVK, công vụ, tiền đóng BHXH/BHYT, giảm trừ bản thân (11M) &amp; NPT (4.4M).
              </p>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-indigo-900/40">
              <div className="text-xs font-bold text-emerald-300 uppercase flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                TẦNG 2: Tổng hợp Quý (3 Tháng/Lần)
              </div>
              <div className="font-mono text-xs text-emerald-200 font-bold">
                Tháng {quarterMonthNumbers[0]} + Tháng {quarterMonthNumbers[1]} + Tháng {quarterMonthNumbers[2]} = Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Lưu chi tiết từng người lao động (T1, T2, T3) để truy ngược hồ sơ khi thanh tra/đối soát.
              </p>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3.5 border border-indigo-900/40">
              <div className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                TẦNG 3: Quyết toán Năm
              </div>
              <div className="font-mono text-xs text-amber-200 font-bold">
                Quý I + Quý II + Quý III + Quý IV ➔ Quyết toán năm {selectedYear}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Đối chiếu số thuế tạm nộp 4 quý với số thuế tính lại theo biểu lũy tiến cả năm.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SYNC RESULT NOTIFICATION */}
      {syncResult && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                Đã ghi nhận thành công {syncResult.count} cán bộ vào Google Sheets:
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Tệp: <span className="font-semibold">{TAX_SPREADSHEET_TITLE}</span> | Gồm 5 sheet: NguoiPhuThuoc, ThongKe_ThuNhap_Quy, TinhThue_TNCN_Quy, BangKe_ChiTiet_3Thang, QuyetToan_Nam.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={syncResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mở trên Google Sheets
            </a>
            <button onClick={() => setSyncResult(null)} className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* BỘ ĐIỀU KHIỂN CHỌN NĂM & CHỌN QUÝ */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Chọn năm */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-bold text-slate-700">Năm tính thuế:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={2024}>Năm 2024</option>
              <option value={2025}>Năm 2025</option>
              <option value={2026}>Năm 2026 (Hiện hành)</option>
              <option value={2027}>Năm 2027</option>
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Chọn quý */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {([1, 2, 3, 4] as const).map((q) => {
              const qTitles = ['Quý I (T1-T3)', 'Quý II (T4-T6)', 'Quý III (T7-T9)', 'Quý IV (T10-T12)'];
              const isSelected = selectedQuarter === q;
              return (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {qTitles[q - 1]}
                  {q === 3 && (
                    <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-200 text-slate-700'}`}>
                      MLCS 2.34M
                    </span>
                  )}
                  {q === 4 && (
                    <span className={`text-[10px] px-1 rounded ${isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-amber-100 text-amber-800 font-bold'}`}>
                      MLCS 2.53M
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tìm kiếm và Lọc phòng ban */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, mã cán bộ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
          >
            <option value="ALL">Tất cả phòng ban ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* THẺ THỐNG KÊ CHỈ SỐ TÀI CHÍNH QUÝ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng nhân sự</div>
          <div className="text-xl font-black text-slate-900 mt-1">{summary.totalStaff}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Chi cục &amp; Trạm Thú y</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng thu nhập quý</div>
          <div className="text-lg font-black text-indigo-700 mt-1">
            {summary.totalGross.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">Lương HSL + Phụ cấp</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thu nhập chịu thuế</div>
          <div className="text-lg font-black text-sky-700 mt-1">
            {summary.totalTaxable.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
          </div>
          <div className="text-[11px] text-sky-600 mt-0.5">Đã trừ khoản miễn thuế</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng giảm trừ quý</div>
          <div className="text-lg font-black text-amber-700 mt-1">
            {summary.totalDeductions.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">BHXH + Bản thân + NPT</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Thu nhập tính thuế</div>
          <div className="text-lg font-black text-purple-700 mt-1">
            {summary.totalAssessable.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
          </div>
          <div className="text-[11px] text-purple-600 mt-0.5">Chịu thuế - Giảm trừ</div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200 shadow-sm">
          <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Thuế đã khấu trừ</div>
          <div className="text-lg font-black text-indigo-900 mt-1">
            {summary.totalTaxWithheld.toLocaleString('vi-VN')} <span className="text-xs font-normal">đ</span>
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
            Tổng 3 tháng (T1+T2+T3)
          </div>
        </div>
      </div>

      {/* 5 TABS GIAO DIỆN THEO ĐÚNG ĐỀ XUẤT */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Navigation Tab Bar */}
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/70 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab('QUARTERLY_TAX')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'QUARTERLY_TAX'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Calculator className="w-4 h-4" />
            1. Bảng Tính Thuế TNCN Theo Quý
          </button>

          <button
            onClick={() => setActiveTab('INCOME_STATS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'INCOME_STATS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Coins className="w-4 h-4" />
            2. Thống Kê Các Khoản Thu Nhập
          </button>

          <button
            onClick={() => setActiveTab('OTHER_INCOME')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'OTHER_INCOME'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            3. Thu Nhập Khác ({otherIncomes.length})
          </button>

          <button
            onClick={() => setActiveTab('THREE_MONTHS_DETAIL')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'THREE_MONTHS_DETAIL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-4 h-4" />
            4. Chi Tiết 3 Tháng &amp; Truy Ngược (T1 + T2 + T3)
          </button>

          <button
            onClick={() => setActiveTab('DEPENDENTS')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'DEPENDENTS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Users className="w-4 h-4" />
            5. Sheet Người Phụ Thuộc ({dependents.length})
          </button>

          <button
            onClick={() => setActiveTab('ANNUAL_SETTLEMENT')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ANNUAL_SETTLEMENT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            6. Quyết Toán Thuế Cả Năm (Tầng 3)
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: BẢNG TÍNH THUẾ TNCN THEO QUÝ (Sheet: TinhThue_TNCN_Quy) */}
        {/* ========================================================================= */}
        {activeTab === 'QUARTERLY_TAX' && (
          <div className="p-5 space-y-4">
            {/* Header & Bộ nút hành động tính thuế */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  <span>BẢNG TÍNH THUẾ THU NHẬP CÁ NHÂN QUÝ {['I', 'II', 'III', 'IV'][selectedQuarter - 1]} / NĂM {selectedYear}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quy chuẩn giảm trừ bản thân: 33.000.000 đ/quý (11M/tháng) | Giảm trừ gia cảnh NPT: 13.200.000 đ/người/quý (4.4M/tháng).
                </p>
              </div>

              {/* Nhóm nút hành động tính thuế theo quý */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExecuteQuarterlyTaxCalculation}
                  disabled={isCalculatingQuarterTax}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                  title="Lấy dữ liệu chi tiết 3 tháng lương & thu nhập khác tạo thành bảng tính thuế quý"
                >
                  {isCalculatingQuarterTax ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Đang lấy chi tiết Tháng {quarterMonthNumbers[0]}, {quarterMonthNumbers[1]}, {quarterMonthNumbers[2]}...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>⚡ Tính Thuế Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]} (Lấy Chi Tiết T{quarterMonthNumbers[0]} + T{quarterMonthNumbers[1]} + T{quarterMonthNumbers[2]})</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowMonthlyBreakdownOnTaxTable(!showMonthlyBreakdownOnTaxTable)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    showMonthlyBreakdownOnTaxTable
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Bật/Tắt hiển thị các cột chi tiết từng tháng ngay trên bảng thuế"
                >
                  {showMonthlyBreakdownOnTaxTable ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ẩn Cột Chi Tiết Tháng</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hiện Chi Tiết T{quarterMonthNumbers[0]}, T{quarterMonthNumbers[1]}, T{quarterMonthNumbers[2]}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('THREE_MONTHS_DETAIL')}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 flex items-center gap-1.5 transition"
                  title="Xem bảng kê chi tiết 3 tháng & truy vết kiểm tra"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>Bảng Kê 3 Tháng</span>
                </button>

                <div className="text-xs text-slate-600 bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold">
                  <span className="font-bold text-indigo-700">{filteredQuarterlyRecords.length}</span> cán bộ
                </div>
              </div>
            </div>

            {/* SƠ ĐỒ DỮ LIỆU ĐÃ TRÍCH XUẤT TỪ 3 THÁNG TẠO THÀNH QUÝ */}
            {showExtractedMonthsBanner && (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-indigo-800/40 shadow-md">
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-800/50 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Dữ liệu đã trích xuất từ 3 tháng tạo thành Bảng Tính Thuế Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]} / {selectedYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-indigo-200 bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                      Thời gian tính: <strong className="text-white">{calculatedQuarterInfo?.timestamp || 'Tự động tính hiện hành'}</strong>
                    </span>
                    <button
                      onClick={() => setShowExtractedMonthsBanner(false)}
                      className="text-slate-400 hover:text-white p-1"
                      title="Thu gọn banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {quarterMonthsDetailSummary.map((m, idx) => {
                    const colors = [
                      { bg: 'bg-sky-950/70 border-sky-800/50 text-sky-300', tag: 'bg-sky-500/20 text-sky-200' },
                      { bg: 'bg-emerald-950/70 border-emerald-800/50 text-emerald-300', tag: 'bg-emerald-500/20 text-emerald-200' },
                      { bg: 'bg-amber-950/70 border-amber-800/50 text-amber-300', tag: 'bg-amber-500/20 text-amber-200' },
                    ][idx];
                    return (
                      <div key={m.month} className={`rounded-xl p-3 border ${colors.bg}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${colors.tag}`}>
                            Nguồn: Tháng {m.month}/{m.year}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            {idx === 0 ? 'Tháng đầu quý' : idx === 1 ? 'Tháng giữa quý' : 'Tháng cuối quý'}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Lương HSL + PC:</span>
                            <span className="font-bold text-white">{m.monthSalaryTotal.toLocaleString('vi-VN')} đ</span>
                          </div>
                          <div className="flex justify-between text-indigo-300">
                            <span>Thu nhập khác:</span>
                            <span className="font-bold text-indigo-200">
                              {m.monthOtherIncomeTotal.toLocaleString('vi-VN')} đ ({m.monthOtherIncomeCount} khoản)
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>BH bắt buộc:</span>
                            <span className="font-mono text-slate-300">{m.monthInsuranceTotal.toLocaleString('vi-VN')} đ</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-700/60 font-black">
                            <span className="text-amber-300">Thuế đã khấu trừ:</span>
                            <span className="text-emerald-300">{m.monthTaxWithheldTotal.toLocaleString('vi-VN')} đ</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Card Tổng hợp Quý */}
                  <div className="rounded-xl p-3 border bg-indigo-900/60 border-indigo-700/60 text-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500 text-white">
                        = TỔNG HỢP QUÝ {['I', 'II', 'III', 'IV'][selectedQuarter - 1]}
                      </span>
                      <span className="text-[10px] text-indigo-200">
                        {summary.totalStaff} cán bộ
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-indigo-200">
                        <span>Tổng thu nhập quý:</span>
                        <span className="font-bold text-white">{summary.totalGross.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between text-indigo-200">
                        <span>Tổng giảm trừ quý:</span>
                        <span className="font-bold text-amber-300">{summary.totalDeductions.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between text-indigo-200">
                        <span>Thu nhập tính thuế:</span>
                        <span className="font-bold text-purple-300">{summary.totalAssessable.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-indigo-700 font-black">
                        <span className="text-amber-200">TỔNG THUẾ QUÝ:</span>
                        <span className="text-emerald-300 text-sm">{summary.totalTaxWithheld.toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[600px]">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider sticky top-0 z-10 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-2 border-r border-slate-200 text-center w-10">Mở</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-12">STT</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[95px]">Mã NV</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[150px]">Họ và Tên</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Phòng Ban</th>

                    {/* Hiển thị chi tiết 3 tháng thu nhập nếu bật */}
                    {showMonthlyBreakdownOnTaxTable && (
                      <>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-sky-50 text-sky-900">
                          TN T{quarterMonthNumbers[0]}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-emerald-50 text-emerald-900">
                          TN T{quarterMonthNumbers[1]}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-amber-50 text-amber-900">
                          TN T{quarterMonthNumbers[2]}
                        </th>
                      </>
                    )}

                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px] bg-slate-100 font-black">
                      Tổng Thu Nhập Quý
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px] bg-sky-50/70 text-sky-900">
                      Thu Nhập Chịu Thuế
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px]">BH Bắt Buộc</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px]">GT Bản Thân</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-center min-w-[60px]">NPT</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px]">GT Gia Cảnh</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[120px] bg-amber-50 text-amber-900">Tổng Giảm Trừ</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px] bg-purple-50 text-purple-900">Thu Nhập Tính Thuế</th>

                    {/* Hiển thị chi tiết 3 tháng thuế khấu trừ nếu bật */}
                    {showMonthlyBreakdownOnTaxTable && (
                      <>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-sky-50 text-sky-900">
                          Thuế T{quarterMonthNumbers[0]}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-emerald-50 text-emerald-900">
                          Thuế T{quarterMonthNumbers[1]}
                        </th>
                        <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-amber-50 text-amber-900">
                          Thuế T{quarterMonthNumbers[2]}
                        </th>
                      </>
                    )}

                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[135px] bg-indigo-50 font-black text-indigo-900">
                      Thuế Đã Khấu Trừ Quý (3T)
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px]">Thuế Tính Theo Quý</th>
                    <th className="py-3 px-3 text-center min-w-[90px]">Truy Vết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredQuarterlyRecords.map((r, idx) => {
                    const isPositiveTax = r.qTaxWithheld > 0;
                    const isExpanded = expandedEmployeeCode === r.employeeCode;
                    const empOtherIncomes = otherIncomes.filter(
                      i => i.year === selectedYear && quarterMonthNumbers.includes(i.month) && i.employeeCode === r.employeeCode
                    );

                    return (
                      <React.Fragment key={r.employeeCode}>
                        <tr className={`hover:bg-slate-50 transition ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                          <td className="py-2.5 px-2 border-r border-slate-200 text-center">
                            <button
                              onClick={() => setExpandedEmployeeCode(isExpanded ? null : r.employeeCode)}
                              className={`p-1 rounded hover:bg-slate-200 transition ${isExpanded ? 'text-indigo-600 font-bold bg-indigo-100' : 'text-slate-400'}`}
                              title={isExpanded ? 'Thu gọn chi tiết 3 tháng' : 'Mở rộng chi tiết 3 tháng cấu thành quý'}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                            {r.employeeCode}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
                            <button
                              onClick={() => {
                                const emp = employees.find(e => e.code === r.employeeCode);
                                if (emp && onSelectEmployee) onSelectEmployee(emp);
                              }}
                              className="hover:text-indigo-600 hover:underline text-left"
                            >
                              {r.fullName}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[180px]" title={r.departmentName}>
                            {r.departmentName}
                          </td>

                          {/* Chi tiết thu nhập 3 tháng */}
                          {showMonthlyBreakdownOnTaxTable && (
                            <>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-sky-900 bg-sky-50/40">
                                {r.months[0]?.totalGrossIncome.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-emerald-900 bg-emerald-50/40">
                                {r.months[1]?.totalGrossIncome.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-amber-900 bg-amber-50/40">
                                {r.months[2]?.totalGrossIncome.toLocaleString('vi-VN')}
                              </td>
                            </>
                          )}

                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                            {r.qTotalGrossIncome.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-semibold text-sky-800 bg-sky-50/50">
                            {r.qTaxableIncome.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                            {r.qCompulsoryInsurance.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-600">
                            {r.qPersonalDeduction.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                            {r.dependentCount > 0 ? (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[11px]">
                                {r.dependentCount}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                            {r.qDependentDeduction.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-amber-800 bg-amber-50/50">
                            {r.qTotalDeductions.toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-purple-900 bg-purple-50/50">
                            {r.qAssessableIncome.toLocaleString('vi-VN')}
                          </td>

                          {/* Chi tiết thuế khấu trừ 3 tháng */}
                          {showMonthlyBreakdownOnTaxTable && (
                            <>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-sky-950 bg-sky-50/40">
                                {r.months[0]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-emerald-950 bg-emerald-50/40">
                                {r.months[1]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-amber-950 bg-amber-50/40">
                                {r.months[2]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                              </td>
                            </>
                          )}

                          <td className={`py-2.5 px-3 border-r border-slate-200 text-right font-black ${isPositiveTax ? 'text-indigo-900 bg-indigo-50/70' : 'text-slate-400'}`}>
                            {r.qTaxWithheld.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                            {r.qQuarterlyTaxPayable.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setAuditTargetRecord(r)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-200 flex items-center justify-center gap-1 mx-auto transition"
                              title="Truy ngược từ quý ➔ tháng ➔ bảng lương ➔ cách tính thuế"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Truy vết
                            </button>
                          </td>
                        </tr>

                        {/* SUBROW MỞ RỘNG: CHI TIẾT 3 THÁNG TẠO THÀNH QUÝ CỦA CÁN BỘ NÀY */}
                        {isExpanded && (
                          <tr className="bg-indigo-50/30">
                            <td colSpan={showMonthlyBreakdownOnTaxTable ? 21 : 15} className="p-4 border-b-2 border-indigo-300">
                              <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-indigo-600" />
                                    <span className="font-bold text-xs text-slate-900 uppercase">
                                      Bảng Chi Tiết 3 Tháng Cấu Thành Quý: {r.fullName} ({r.employeeCode}) - {r.departmentName}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => setAuditTargetRecord(r)}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Hồ Sơ Truy Ngược Lũy Tiến</span>
                                  </button>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse border border-slate-200">
                                    <thead className="bg-slate-100 font-bold text-slate-700">
                                      <tr>
                                        <th className="py-2 px-3 border border-slate-200">Khoản mục cấu thành</th>
                                        {r.months.map(m => (
                                          <th key={m.periodKey} className="py-2 px-3 border border-slate-200 text-right">
                                            Tháng {m.month}/{m.year}
                                          </th>
                                        ))}
                                        <th className="py-2 px-3 border border-slate-200 text-right bg-indigo-50 font-black text-indigo-950">
                                          Tổng Cả Quý
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Mức lương cơ sở (MLCS)</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right font-mono">
                                            {m.baseSalary.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right text-slate-400 bg-slate-50">-</td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Lương theo hệ số ngạch bậc</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.salaryAmount.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qSalaryAmount.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Phụ cấp thâm niên vượt khung</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.beyondFrameAmount.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qBeyondFrameAmount.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Phụ cấp chức vụ lãnh đạo</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.leadershipAllowanceAmount.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qLeadershipAllowanceAmount.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Phụ cấp công vụ (25%)</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.publicServiceAllowanceAmount.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qPublicServiceAllowanceAmount.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr className="bg-indigo-50/30">
                                        <td className="py-1.5 px-3 border border-slate-200 font-bold text-indigo-900">
                                          Thu nhập khác (từ Sheet Thu Nhập Khác)
                                        </td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right font-bold text-indigo-900">
                                            {m.otherIncomeAmount.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-black text-indigo-950 bg-indigo-100/50">
                                          {r.qOtherIncomeAmount.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr className="font-bold bg-slate-50">
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-900">TỔNG THU NHẬP THÁNG</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right text-slate-900">
                                            {m.totalGrossIncome.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-black text-indigo-950 bg-indigo-100">
                                          {r.qTotalGrossIncome.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">BH bắt buộc (BHXH, BHYT, BHTN 10.5%)</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.compulsoryInsurance.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qCompulsoryInsurance.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">Giảm trừ bản thân (11M/tháng)</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.personalDeduction.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qPersonalDeduction.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr>
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-700">
                                          Giảm trừ gia cảnh NPT ({r.dependentCount} người x 4.4M)
                                        </td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right">
                                            {m.dependentDeduction.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-bold text-slate-900 bg-indigo-50/40">
                                          {r.qDependentDeduction.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr className="bg-amber-50/40 font-bold">
                                        <td className="py-1.5 px-3 border border-slate-200 text-amber-900">TỔNG GIẢM TRỪ THÁNG</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right text-amber-900">
                                            {m.totalDeductions.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-black text-amber-950 bg-amber-100/60">
                                          {r.qTotalDeductions.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr className="bg-purple-50/40 font-bold">
                                        <td className="py-1.5 px-3 border border-slate-200 text-purple-900">THU NHẬP TÍNH THUẾ THÁNG</td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-1.5 px-3 border border-slate-200 text-right text-purple-900">
                                            {m.assessableIncome.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 border border-slate-200 text-right font-black text-purple-950 bg-purple-100/60">
                                          {r.qAssessableIncome.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                      <tr className="bg-indigo-100/60 font-black">
                                        <td className="py-2 px-3 border border-slate-200 text-indigo-950">
                                          THUẾ TNCN ĐÃ TẠM KHẤU TRỪ
                                        </td>
                                        {r.months.map(m => (
                                          <td key={m.periodKey} className="py-2 px-3 border border-slate-200 text-right text-indigo-950 font-bold">
                                            {m.monthlyTaxWithheld.toLocaleString('vi-VN')} đ
                                          </td>
                                        ))}
                                        <td className="py-2 px-3 border border-slate-200 text-right text-indigo-950 text-sm font-black bg-indigo-200/80">
                                          {r.qTaxWithheld.toLocaleString('vi-VN')} đ
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* Chi tiết các khoản thu nhập khác phát sinh trong quý của cán bộ này */}
                                {empOtherIncomes.length > 0 && (
                                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    <div className="text-[11px] font-bold text-indigo-900 uppercase mb-1">
                                      Khoản thu nhập khác phát sinh trong quý ({empOtherIncomes.length} khoản trích xuất từ Sheet Thu Nhập Khác):
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {empOtherIncomes.map(item => (
                                        <span key={item.id} className="px-2.5 py-1 bg-white border border-indigo-200 rounded-md text-[11px] text-slate-800 shadow-2xs">
                                          <strong>Tháng {item.month}:</strong> {item.description} - <span className="font-bold text-indigo-700">{item.amount.toLocaleString('vi-VN')} đ</span>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 sticky bottom-0 z-10 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-center uppercase border-r border-slate-200">
                      TỔNG CỘNG ({filteredQuarterlyRecords.length} cán bộ)
                    </td>

                    {/* Tổng chi tiết 3 tháng thu nhập nếu bật */}
                    {showMonthlyBreakdownOnTaxTable && (
                      <>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-sky-950">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[0]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-emerald-950">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[1]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-amber-950">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[2]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900 font-black">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qTotalGrossIncome, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-sky-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qTaxableIncome, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qCompulsoryInsurance, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qPersonalDeduction, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-slate-200 text-indigo-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.dependentCount, 0)}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qDependentDeduction, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-amber-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qTotalDeductions, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-purple-900">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qAssessableIncome, 0).toLocaleString('vi-VN')}
                    </td>

                    {/* Tổng chi tiết 3 tháng thuế nếu bật */}
                    {showMonthlyBreakdownOnTaxTable && (
                      <>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-sky-950 font-bold">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[0]?.monthlyTaxWithheld || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-emerald-950 font-bold">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[1]?.monthlyTaxWithheld || 0), 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-3 text-right border-r border-slate-200 text-amber-950 font-bold">
                          {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[2]?.monthlyTaxWithheld || 0), 0).toLocaleString('vi-VN')}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-3 text-right border-r border-slate-200 text-indigo-950 font-black text-sm">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qTaxWithheld, 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qQuarterlyTaxPayable, 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-center">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: THỐNG KÊ CÁC KHOẢN THU NHẬP (Sheet: ThongKe_ThuNhap_Quy) */}
        {/* ========================================================================= */}
        {activeTab === 'INCOME_STATS' && (
          <div className="p-5 space-y-4">
            {/* Banner hiển thị khi kích hoạt gom thu nhập khác theo Quý */}
            {aggregatedQuarterBanner && (
              <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl shadow-lg border border-indigo-700 animate-in fade-in flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-400 text-indigo-950 rounded-xl font-black text-sm flex items-center justify-center">
                    <Zap className="w-5 h-5 fill-indigo-950" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      ĐÃ GOM THU NHẬP KHÁC VÀO QUÝ {['I', 'II', 'III', 'IV'][aggregatedQuarterBanner.quarter - 1]} / {aggregatedQuarterBanner.year} THÀNH CÔNG
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                        {aggregatedQuarterBanner.timestamp}
                      </span>
                    </h4>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Tổng số: <span className="font-bold text-amber-300">{aggregatedQuarterBanner.totalAmount.toLocaleString('vi-VN')} đ</span> ({aggregatedQuarterBanner.itemsCount} khoản thu nhập khác cho {aggregatedQuarterBanner.staffCount} cán bộ).
                      {aggregatedQuarterBanner.cuongTotal > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-md font-bold border border-amber-300/30">
                          Chi cục Trưởng Trần Phú Cường: {aggregatedQuarterBanner.cuongTotal.toLocaleString('vi-VN')} đ
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAggregatedQuarterBanner(null)}
                  className="px-2.5 py-1 text-xs text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition"
                >
                  ✕ Đóng
                </button>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  BẢNG THỐNG KÊ CHI TIẾT CÁC KHOẢN THU NHẬP - QUÝ {['I', 'II', 'III', 'IV'][selectedQuarter - 1]} / NĂM {selectedYear}
                  <span className="text-xs font-normal text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    Sheet: ThongKe_ThuNhap_Quy
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cột <strong className="text-indigo-700">"Thu Nhập Khác"</strong> tổng hợp từ các khoản chi trả trong 3 tháng của Quý (Nghị quyết 98, trực kiểm dịch, thưởng lễ...).
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Nút lọc nhanh xem ông Trần Phú Cường */}
                <button
                  onClick={() => setSearchTerm(searchTerm.includes('Cường') ? '' : 'Trần Phú Cường')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                    searchTerm.includes('Cường')
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                  title="Lọc nhanh dòng của Chi cục Trưởng Trần Phú Cường"
                >
                  <span>⭐ {searchTerm.includes('Cường') ? 'Bỏ lọc (Xem tất cả)' : 'Xem ông Trần Phú Cường'}</span>
                </button>
                <button
                  onClick={handleAggregateQuarterlyOtherIncomes}
                  className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95"
                  title="Gom các khoản chi tiết thu nhập khác của 3 tháng vào Quý"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>⚡ Gom Thu Nhập Khác Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]}</span>
                </button>
                <button
                  onClick={() => setActiveTab('OTHER_INCOME')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 flex items-center gap-1 transition"
                  title="Mở bảng Thu Nhập Khác để xem chi tiết hoặc đưa lên từ Excel"
                >
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Xem Thu Nhập Khác ({otherIncomes.length})</span>
                </button>
                <span className="text-xs px-2.5 py-1 bg-sky-100 text-sky-800 font-bold rounded-lg">
                  Tháng {quarterMonthNumbers[0]}, {quarterMonthNumbers[1]}, {quarterMonthNumbers[2]}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[600px]">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider sticky top-0 z-10 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-12">STT</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[100px]">Mã NV</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Họ và Tên</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[150px]">Chức Danh</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">Thu Nhập T{quarterMonthNumbers[0]}</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">Thu Nhập T{quarterMonthNumbers[1]}</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">Thu Nhập T{quarterMonthNumbers[2]}</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[120px]">Lương Hệ Số Quý</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px]">Phụ Cấp VK</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px]">Phụ Cấp CV</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px]">Phụ Cấp PCCV</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[160px] bg-indigo-50/70 text-indigo-950 font-black">Thu Nhập Khác</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[115px]">Khoản Miễn Thuế</th>
                    <th className="py-3 px-3 text-right min-w-[130px] bg-indigo-100 font-black text-indigo-950">Tổng Thu Nhập Quý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredQuarterlyRecords.map((r, idx) => {
                    const isCuong = r.fullName.toLowerCase().includes('cường') || r.employeeCode === 'NV-19750312-0001';
                    return (
                      <tr
                        key={r.employeeCode}
                        className={`transition ${
                          isCuong
                            ? 'bg-amber-50/80 hover:bg-amber-100/80 border-l-4 border-l-amber-500 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">{r.employeeCode}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{r.fullName}</span>
                            {isCuong && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900">
                                Lãnh đạo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">{r.positionTitle}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-slate-50/50">
                          {r.months[0]?.totalGrossIncome.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-slate-50/50">
                          {r.months[1]?.totalGrossIncome.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-slate-50/50">
                          {r.months[2]?.totalGrossIncome.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-800">
                          {r.qSalaryAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                          {r.qBeyondFrameAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                          {r.qLeadershipAllowanceAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">
                          {r.qPublicServiceAllowanceAmount.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right bg-indigo-50/40">
                          <div className="font-bold text-indigo-900">
                            {r.qOtherIncomeAmount.toLocaleString('vi-VN')} đ
                          </div>
                          {r.qOtherIncomeAmount > 0 && (
                            <div className="text-[10px] text-indigo-600/80 whitespace-nowrap mt-0.5">
                              T{quarterMonthNumbers[0]}: {(r.months[0]?.otherIncomeAmount || 0).toLocaleString('vi-VN')} | T{quarterMonthNumbers[1]}: {(r.months[1]?.otherIncomeAmount || 0).toLocaleString('vi-VN')} | T{quarterMonthNumbers[2]}: {(r.months[2]?.otherIncomeAmount || 0).toLocaleString('vi-VN')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right text-emerald-700 font-medium">
                          {r.qNonTaxableIncome.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-indigo-900 bg-indigo-50/60">
                          {r.qTotalGrossIncome.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 sticky bottom-0 z-10 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 text-center uppercase border-r border-slate-200">
                      TỔNG CỘNG
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[0]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[1]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + (r.months[2]?.totalGrossIncome || 0), 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qSalaryAmount, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qBeyondFrameAmount, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qLeadershipAllowanceAmount, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qPublicServiceAllowanceAmount, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qOtherIncomeAmount, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-emerald-800">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qNonTaxableIncome, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-indigo-950 text-sm">
                      {filteredQuarterlyRecords.reduce((s, r) => s + r.qTotalGrossIncome, 0).toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SHEET THU NHẬP KHÁC (Sheet: ThuNhap_Khac)                          */}
        {/* ========================================================================= */}
        {activeTab === 'OTHER_INCOME' && (
          <OtherIncomeManagementSection
            employees={employees}
            selectedQuarter={selectedQuarter}
            selectedYear={selectedYear}
            otherIncomes={otherIncomes}
            onAddNew={() => {
              setEditingOtherIncome(null);
              setIsOtherIncomeModalOpen(true);
            }}
            onOpenExcelImport={() => setIsExcelImportModalOpen(true)}
            onEditItem={(item) => {
              setEditingOtherIncome(item);
              setIsOtherIncomeModalOpen(true);
            }}
            onDeleteItem={handleDeleteOtherIncome}
            onTriggerQuarterlyAggregation={handleAggregateQuarterlyOtherIncomes}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CHI TIẾT 3 THÁNG & TRUY NGƯỢC (Sheet: BangKe_ChiTiet_3Thang)       */}
        {/* ========================================================================= */}
        {activeTab === 'THREE_MONTHS_DETAIL' && (
          <div className="p-5 space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-indigo-950">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Info className="w-4 h-4 text-indigo-600" />
                Mô hình lưu trữ chi tiết theo yêu cầu thanh tra &amp; kiểm tra:
              </div>
              <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                Đừng để phần mềm chỉ lưu: <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200">"Thuế Quý = 15.000.000 đ"</span>, mà phải lưu chi tiết: <span className="font-semibold">Người lao động | T1 | T2 | T3 | Tổng quý | Đã khấu trừ</span>. Từ đó cơ quan thuế hoặc lãnh đạo có thể truy ngược từ <strong>Quý ➔ Tháng ➔ Bảng lương ➔ Khoản thu nhập ➔ Cách tính thuế</strong>.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[600px]">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider sticky top-0 z-10 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-12">STT</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[100px]">Mã NV</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Người Lao Động</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Phòng Ban</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px] bg-sky-50">
                      Thu Nhập T{quarterMonthNumbers[0]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-sky-50 text-indigo-900">
                      Thuế KT T{quarterMonthNumbers[0]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px] bg-emerald-50">
                      Thu Nhập T{quarterMonthNumbers[1]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-emerald-50 text-indigo-900">
                      Thuế KT T{quarterMonthNumbers[1]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px] bg-amber-50">
                      Thu Nhập T{quarterMonthNumbers[2]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[110px] bg-amber-50 text-indigo-900">
                      Thuế KT T{quarterMonthNumbers[2]}
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px] font-black">
                      Tổng Quý (VNĐ)
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[135px] font-black bg-indigo-50 text-indigo-950">
                      ĐÃ KHẤU TRỪ QUÝ
                    </th>
                    <th className="py-3 px-3 text-center min-w-[120px]">Truy Ngược</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredQuarterlyRecords.map((r, idx) => (
                    <tr key={r.employeeCode} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">{r.employeeCode}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">{r.fullName}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[180px]">{r.departmentName}</td>
                      
                      {/* Tháng 1 */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-sky-50/40">
                        {r.months[0]?.totalGrossIncome.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-indigo-900 bg-sky-50/40">
                        {r.months[0]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                      </td>

                      {/* Tháng 2 */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-emerald-50/40">
                        {r.months[1]?.totalGrossIncome.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-indigo-900 bg-emerald-50/40">
                        {r.months[1]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                      </td>

                      {/* Tháng 3 */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-medium text-slate-800 bg-amber-50/40">
                        {r.months[2]?.totalGrossIncome.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-indigo-900 bg-amber-50/40">
                        {r.months[2]?.monthlyTaxWithheld.toLocaleString('vi-VN')}
                      </td>

                      {/* Tổng Quý */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-black text-slate-900">
                        {r.qTotalGrossIncome.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-black text-indigo-950 bg-indigo-50/70">
                        {r.qTaxWithheld.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setAuditTargetRecord(r)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition flex items-center justify-center gap-1 mx-auto"
                        >
                          <History className="w-3.5 h-3.5" />
                          Hồ sơ chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SHEET NGƯỜI PHỤ THUỘC (Sheet: NguoiPhuThuoc) */}
        {/* ========================================================================= */}
        {activeTab === 'DEPENDENTS' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  DANH SÁCH ĐĂNG KÝ NGƯỜI PHỤ THUỘC GIẢM TRỪ GIA CẢNH
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mức giảm trừ: <strong>4.400.000 đ/người/tháng</strong> (13.200.000 đ/người/quý) theo Nghị quyết số 954/2020/UBTVQH14.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingDependent(null);
                  setIsDependentModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                Đăng Ký Thêm Người Phụ Thuộc
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-12">STT</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[100px]">Mã Cán Bộ</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[150px]">Cán Bộ Kê Khai</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Người Phụ Thuộc</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[130px]">Mối Quan Hệ</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[95px]">Ngày Sinh</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[120px]">Số CCCD / MST</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[95px]">Thời Điểm BĐ</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[95px]">Thời Điểm KT</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[125px]">Mức Giảm Trừ/T</th>
                    <th className="py-3 px-3 text-center min-w-[90px]">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dependents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-400">
                        Chưa có người phụ thuộc nào được đăng ký.
                      </td>
                    </tr>
                  ) : (
                    dependents.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">{d.employeeCode}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">{d.employeeName}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-indigo-900">{d.dependentName}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                            {d.relationship}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 font-mono">{d.dob}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-800">{d.idCardOrTaxCode}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-emerald-700 font-bold">{d.startDate}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-600">{d.endDate || 'Hiệu lực'}</td>
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-amber-800">
                          {d.deductionMonthlyAmount.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingDependent(d);
                                setIsDependentModalOpen(true);
                              }}
                              className="p-1 hover:bg-slate-200 text-indigo-600 rounded transition"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDependent(d.id)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: QUYẾT TOÁN THUẾ CẢ NĂM (Sheet: QuyetToan_Nam) */}
        {/* ========================================================================= */}
        {activeTab === 'ANNUAL_SETTLEMENT' && (
          <div className="p-5 space-y-4">
            {/* Header & Nút hành động tính quyết toán năm */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  <span>TỔNG HỢP QUYẾT TOÁN THUẾ THU NHẬP CÁ NHÂN CẢ NĂM {selectedYear} (TẦNG 3)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mô hình: <strong>Quý I + Quý II + Quý III + Quý IV ➔ Đối chiếu số liệu quyết toán năm</strong>. Giảm trừ bản thân cả năm: 132.000.000 đ | NPT: 52.800.000 đ/người.
                </p>
              </div>

              {/* Action buttons on Annual Settlement */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExecuteAnnualTaxCalculation}
                  disabled={isCalculatingAnnualTax}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                  title="Lấy dữ liệu 4 Quý (12 tháng lương & thu nhập khác) để tạo thành bảng quyết toán thuế cả năm"
                >
                  {isCalculatingAnnualTax ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Đang lấy chi tiết 4 Quý (12 tháng lương & thu nhập khác)...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>⚡ Tính Quyết Toán Cả Năm {selectedYear} (Lấy Chi Tiết Quý I + II + III + IV)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowQuarterlyBreakdownOnAnnualTable(!showQuarterlyBreakdownOnAnnualTable)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    showQuarterlyBreakdownOnAnnualTable
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Bật/Tắt hiển thị chi tiết các Quý trên bảng quyết toán"
                >
                  {showQuarterlyBreakdownOnAnnualTable ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ẩn Chi Tiết 4 Quý</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hiện Chi Tiết 4 Quý</span>
                    </>
                  )}
                </button>

                <div className="text-xs text-slate-600 bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200 font-semibold">
                  <span className="font-bold text-indigo-700">{filteredAnnualRecords.length}</span> cán bộ
                </div>
              </div>
            </div>

            {/* SƠ ĐỒ DỮ LIỆU ĐÃ TRÍCH XUẤT TỪ 4 QUÝ ĐỂ QUYẾT TOÁN NĂM */}
            {showAnnualExtractedBanner && (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 border border-indigo-800/40 shadow-md">
                <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-indigo-800/50 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      Dữ liệu đã trích xuất từ 4 Quý (12 tháng lương &amp; thu nhập khác) ➔ Tạo thành Quyết Toán Năm {selectedYear}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-indigo-200 bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                      Thời gian tính: <strong className="text-white">{calculatedAnnualInfo?.timestamp || 'Tự động tính hiện hành'}</strong>
                    </span>
                    <button
                      onClick={() => setShowAnnualExtractedBanner(false)}
                      className="text-slate-400 hover:text-white p-1"
                      title="Thu gọn banner"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="rounded-xl p-3 border bg-slate-800/60 border-slate-700 text-white">
                    <div className="text-[10px] font-bold uppercase text-sky-400">Nguồn 1: Quý I (T1-T3)</div>
                    <div className="text-base font-black mt-1 text-white">
                      {annualQuartersDetailSummary.q1Tax.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Thuế đã tạm khấu trừ</div>
                  </div>

                  <div className="rounded-xl p-3 border bg-slate-800/60 border-slate-700 text-white">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">Nguồn 2: Quý II (T4-T6)</div>
                    <div className="text-base font-black mt-1 text-white">
                      {annualQuartersDetailSummary.q2Tax.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Thuế đã tạm khấu trừ</div>
                  </div>

                  <div className="rounded-xl p-3 border bg-slate-800/60 border-slate-700 text-white">
                    <div className="text-[10px] font-bold uppercase text-amber-400">Nguồn 3: Quý III (T7-T9)</div>
                    <div className="text-base font-black mt-1 text-white">
                      {annualQuartersDetailSummary.q3Tax.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Thuế đã tạm khấu trừ</div>
                  </div>

                  <div className="rounded-xl p-3 border bg-slate-800/60 border-slate-700 text-white">
                    <div className="text-[10px] font-bold uppercase text-purple-400">Nguồn 4: Quý IV (T10-T12)</div>
                    <div className="text-base font-black mt-1 text-white">
                      {annualQuartersDetailSummary.q4Tax.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Thuế đã tạm khấu trừ</div>
                  </div>

                  {/* Cột Quyết toán */}
                  <div className="rounded-xl p-3 border bg-indigo-900/80 border-indigo-600 text-white col-span-2 md:col-span-1">
                    <div className="text-[10px] font-black uppercase text-amber-300">Quyết Toán Cả Năm {selectedYear}</div>
                    <div className="text-base font-black mt-1 text-emerald-300">
                      {annualQuartersDetailSummary.totalTaxPayable.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[10px] text-indigo-200 mt-0.5 flex justify-between">
                      <span>Đã nộp:</span>
                      <span className="font-bold">{annualQuartersDetailSummary.totalTaxWithheld.toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[600px]">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider sticky top-0 z-10 font-bold border-b border-slate-300">
                  <tr>
                    <th className="py-3 px-2 border-r border-slate-200 text-center w-10">Mở</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-12">STT</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[95px]">Mã NV</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[150px]">Họ và Tên</th>
                    <th className="py-3 px-3 border-r border-slate-200 min-w-[160px]">Phòng Ban</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-center min-w-[55px]">NPT</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-slate-50">Thuế Quý I</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-slate-50">Thuế Quý II</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-slate-50">Thuế Quý III</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[105px] bg-slate-50">Thuế Quý IV</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px] font-bold bg-indigo-50 text-indigo-900">
                      Tổng Thuế Đã Tạm Nộp
                    </th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px]">Thu Nhập Chịu Thuế Năm</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px] bg-amber-50">Tổng Giảm Trừ Năm</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[130px] font-bold text-purple-900">Thu Nhập Tính Thuế Năm</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right min-w-[135px] font-black text-slate-900 bg-sky-50">
                      Thuế Quyết Toán Năm
                    </th>
                    <th className="py-3 px-3 text-right min-w-[125px] font-bold">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAnnualRecords.map((a, idx) => {
                    const isExtraPayable = a.annualTaxBalance > 0;
                    const isRefund = a.annualTaxBalance < 0;
                    const isExpanded = expandedAnnualEmployeeCode === a.employeeCode;

                    return (
                      <React.Fragment key={a.employeeCode}>
                        <tr className={`hover:bg-slate-50 transition ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                          <td className="py-2.5 px-2 border-r border-slate-200 text-center">
                            <button
                              onClick={() => setExpandedAnnualEmployeeCode(isExpanded ? null : a.employeeCode)}
                              className={`p-1 rounded hover:bg-slate-200 transition ${isExpanded ? 'text-indigo-600 font-bold bg-indigo-100' : 'text-slate-400'}`}
                              title={isExpanded ? 'Thu gọn' : 'Xem chi tiết 4 Quý của cán bộ này'}
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">{idx + 1}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">{a.employeeCode}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">{a.fullName}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[180px]">{a.departmentName}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-indigo-700">{a.dependentCount}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">{a.q1TaxWithheld.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">{a.q2TaxWithheld.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">{a.q3TaxWithheld.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-700">{a.q4TaxWithheld.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-black text-indigo-900 bg-indigo-50/50">
                            {a.annualTaxWithheld.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-800">{a.annualTaxableIncome.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-amber-900 bg-amber-50/40">{a.annualTotalDeductions.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-purple-900">{a.annualAssessableIncome.toLocaleString('vi-VN')}</td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right font-black text-slate-900 bg-sky-50/50">
                            {a.annualTaxPayable.toLocaleString('vi-VN')} đ
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isExtraPayable ? 'text-rose-600' : isRefund ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {a.annualTaxBalance > 0 ? `+${a.annualTaxBalance.toLocaleString('vi-VN')} đ` : `${a.annualTaxBalance.toLocaleString('vi-VN')} đ`}
                          </td>
                        </tr>

                        {/* SUBROW MỞ RỘNG 4 QUÝ */}
                        {isExpanded && (
                          <tr className="bg-indigo-50/30">
                            <td colSpan={16} className="p-4 border-b-2 border-indigo-300">
                              <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4 space-y-3">
                                <div className="text-xs font-bold text-indigo-900 uppercase">
                                  Chi Tiết Đối Chiếu 4 Quý Lương &amp; Thu Nhập: {a.fullName} ({a.employeeCode})
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div className="bg-sky-50 p-2.5 rounded-lg border border-sky-200">
                                    <div className="font-bold text-sky-900">Quý I (Tháng 1-3)</div>
                                    <div className="text-slate-600 mt-1">Thuế đã tạm nộp:</div>
                                    <div className="font-black text-slate-900 text-sm">{a.q1TaxWithheld.toLocaleString('vi-VN')} đ</div>
                                  </div>
                                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                                    <div className="font-bold text-emerald-900">Quý II (Tháng 4-6)</div>
                                    <div className="text-slate-600 mt-1">Thuế đã tạm nộp:</div>
                                    <div className="font-black text-slate-900 text-sm">{a.q2TaxWithheld.toLocaleString('vi-VN')} đ</div>
                                  </div>
                                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                    <div className="font-bold text-amber-900">Quý III (Tháng 7-9)</div>
                                    <div className="text-slate-600 mt-1">Thuế đã tạm nộp:</div>
                                    <div className="font-black text-slate-900 text-sm">{a.q3TaxWithheld.toLocaleString('vi-VN')} đ</div>
                                  </div>
                                  <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200">
                                    <div className="font-bold text-purple-900">Quý IV (Tháng 10-12)</div>
                                    <div className="text-slate-600 mt-1">Thuế đã tạm nộp:</div>
                                    <div className="font-black text-slate-900 text-sm">{a.q4TaxWithheld.toLocaleString('vi-VN')} đ</div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 sticky bottom-0 z-10 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-center uppercase border-r border-slate-200">
                      TỔNG CỘNG ({filteredAnnualRecords.length} cán bộ)
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {annualQuartersDetailSummary.q1Tax.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {annualQuartersDetailSummary.q2Tax.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {annualQuartersDetailSummary.q3Tax.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-800">
                      {annualQuartersDetailSummary.q4Tax.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-indigo-950 font-black">
                      {annualQuartersDetailSummary.totalTaxWithheld.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-900">
                      {filteredAnnualRecords.reduce((s, a) => s + a.annualTaxableIncome, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-amber-900">
                      {filteredAnnualRecords.reduce((s, a) => s + a.annualTotalDeductions, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-purple-900">
                      {filteredAnnualRecords.reduce((s, a) => s + a.annualAssessableIncome, 0).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-3 text-right border-r border-slate-200 text-slate-950 font-black bg-sky-50">
                      {annualQuartersDetailSummary.totalTaxPayable.toLocaleString('vi-VN')} đ
                    </td>
                    <td className={`py-3 px-3 text-right font-black ${annualQuartersDetailSummary.totalTaxBalance > 0 ? 'text-rose-600' : annualQuartersDetailSummary.totalTaxBalance < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {annualQuartersDetailSummary.totalTaxBalance > 0 ? `+${annualQuartersDetailSummary.totalTaxBalance.toLocaleString('vi-VN')} đ` : `${annualQuartersDetailSummary.totalTaxBalance.toLocaleString('vi-VN')} đ`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL TRUY VẾT & KIỂM TRA CÁN BỘ (AUDIT & DRILLDOWN CÁ NHÂN) */}
      {/* ========================================================================= */}
      {auditTargetRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between sticky top-0 z-10 rounded-t-2xl">
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 text-xs font-bold rounded uppercase tracking-wider">
                  Truy Ngược Hồ Sơ Lương &amp; Thuế TNCN
                </span>
                <h3 className="text-lg font-black mt-1 text-white">
                  {auditTargetRecord.fullName} ({auditTargetRecord.employeeCode})
                </h3>
                <p className="text-xs text-slate-300">
                  {auditTargetRecord.positionTitle} - {auditTargetRecord.departmentName} | {auditTargetRecord.quarterKey}
                </p>
              </div>
              <button
                onClick={() => setAuditTargetRecord(null)}
                className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Sơ đồ truy ngược */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Chuỗi truy vết logic (Audit Trace Chain):
                </div>
                <div className="flex items-center gap-2 flex-wrap font-mono text-xs font-bold">
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-900 rounded-lg">
                    {auditTargetRecord.quarterKey}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="px-2.5 py-1 bg-sky-100 text-sky-900 rounded-lg">
                    3 Tháng Lương (T{quarterMonthNumbers[0]}, T{quarterMonthNumbers[1]}, T{quarterMonthNumbers[2]})
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg">
                    Khoản Thu Nhập &amp; Giảm Trừ
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg">
                    Biểu Lũy Tiến Từng Phần
                  </span>
                </div>
              </div>

              {/* Bảng chi tiết 3 tháng gốc */}
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">
                  1. Chi tiết 3 tháng lương &amp; các khoản thu nhập gốc:
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-200">Khoản mục</th>
                        {auditTargetRecord.months.map(m => (
                          <th key={m.periodKey} className="py-2.5 px-3 border-r border-slate-200 text-right">
                            Tháng {m.month}/{m.year}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right bg-indigo-50 text-indigo-900 font-black">Tổng Cả Quý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">Mức lương cơ sở (MLCS)</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                            {m.baseSalary.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-mono text-slate-600 bg-slate-50">-</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Lương theo hệ số ngạch bậc</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.salaryAmount.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qSalaryAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Phụ cấp thâm niên vượt khung</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.beyondFrameAmount.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qBeyondFrameAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Phụ cấp chức vụ lãnh đạo</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.leadershipAllowanceAmount.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qLeadershipAllowanceAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Phụ cấp công vụ (25%)</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.publicServiceAllowanceAmount.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qPublicServiceAllowanceAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Thu nhập khác / Phụ cấp ngành</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.otherIncomeAmount.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qOtherIncomeAmount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-900">TỔNG THU NHẬP (GROSS)</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right text-slate-900">
                            {m.totalGrossIncome.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right text-indigo-900 font-black bg-indigo-100">
                          {auditTargetRecord.qTotalGrossIncome.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bảng chi tiết giảm trừ & tính thuế 3 tháng */}
              <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-3">
                  2. Chi tiết các khoản giảm trừ và thuế TNCN khấu trừ:
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-200">Chỉ số thuế</th>
                        {auditTargetRecord.months.map(m => (
                          <th key={m.periodKey} className="py-2.5 px-3 border-r border-slate-200 text-right">
                            Tháng {m.month}/{m.year}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right bg-indigo-50 text-indigo-900 font-black">Tổng Cả Quý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Thu nhập chịu thuế (sau miễn)</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right text-sky-800 font-medium">
                            {m.taxableIncome.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-sky-900 bg-sky-50">
                          {auditTargetRecord.qTaxableIncome.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Bảo hiểm bắt buộc (BHXH, BHYT)</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right text-slate-800">
                            {m.compulsoryInsurance.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qCompulsoryInsurance.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">Giảm trừ bản thân</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right text-slate-800">
                            {m.personalDeduction.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qPersonalDeduction.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          Giảm trừ người phụ thuộc ({auditTargetRecord.dependentCount} người)
                        </td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right text-slate-800">
                            {m.dependentDeduction.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-bold text-slate-900 bg-indigo-50/50">
                          {auditTargetRecord.qDependentDeduction.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr className="bg-amber-50/50 font-bold text-amber-900">
                        <td className="py-2 px-3 border-r border-slate-200">TỔNG CÁC KHOẢN GIẢM TRỪ</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.totalDeductions.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-black bg-amber-100">
                          {auditTargetRecord.qTotalDeductions.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr className="font-bold text-purple-900">
                        <td className="py-2 px-3 border-r border-slate-200">THU NHẬP TÍNH THUẾ</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2 px-3 border-r border-slate-200 text-right">
                            {m.assessableIncome.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-black bg-purple-50">
                          {auditTargetRecord.qAssessableIncome.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr className="bg-indigo-900 text-white font-black">
                        <td className="py-2.5 px-3 border-r border-indigo-800">THUẾ TNCN KHẤU TRỪ</td>
                        {auditTargetRecord.months.map(m => (
                          <td key={m.periodKey} className="py-2.5 px-3 border-r border-indigo-800 text-right">
                            {m.monthlyTaxWithheld.toLocaleString('vi-VN')} đ
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right bg-indigo-950 text-emerald-400 text-sm">
                          {auditTargetRecord.qTaxWithheld.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
              <span className="text-xs text-slate-500">
                Chi cục Chăn nuôi và Thú y TP.HCM - Quản lý thuế TNCN chuẩn thông tư 111/2013/TT-BTC
              </span>
              <button
                onClick={() => setAuditTargetRecord(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA NGƯỜI PHỤ THUỘC */}
      {/* ========================================================================= */}
      {isDependentModalOpen && (
        <DependentFormModal
          editingDependent={editingDependent}
          employees={employees}
          onClose={() => {
            setIsDependentModalOpen(false);
            setEditingDependent(null);
          }}
          onSave={handleSaveDependent}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL THÊM / SỬA THU NHẬP KHÁC */}
      {/* ========================================================================= */}
      {isOtherIncomeModalOpen && (
        <OtherIncomeFormModal
          editingItem={editingOtherIncome}
          employees={employees}
          defaultMonth={quarterMonthNumbers[0]}
          defaultYear={selectedYear}
          onClose={() => {
            setIsOtherIncomeModalOpen(false);
            setEditingOtherIncome(null);
          }}
          onSave={handleSaveOtherIncome}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL NHẬP THU NHẬP KHÁC TỪ FILE EXCEL */}
      {/* ========================================================================= */}
      {isExcelImportModalOpen && (
        <OtherIncomeExcelImportModal
          employees={employees}
          selectedYear={selectedYear}
          onClose={() => setIsExcelImportModalOpen(false)}
          onImportSuccess={handleImportExcelSuccess}
        />
      )}
    </div>
  );
};

// =========================================================================
// MODAL FORM NHẬP / CHỈNH SỬA NGƯỜI PHỤ THUỘC
// =========================================================================
interface DependentFormModalProps {
  editingDependent: TaxDependent | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (dep: TaxDependent) => void;
}

const DependentFormModal: React.FC<DependentFormModalProps> = ({
  editingDependent,
  employees,
  onClose,
  onSave,
}) => {
  const [selectedEmpCode, setSelectedEmpCode] = useState(editingDependent?.employeeCode || employees[0]?.code || '');
  const [dependentName, setDependentName] = useState(editingDependent?.dependentName || '');
  const [relationship, setRelationship] = useState<TaxDependent['relationship']>(
    editingDependent?.relationship || 'Con dưới 18 tuổi'
  );
  const [dob, setDob] = useState(editingDependent?.dob || '2015-01-01');
  const [idCardOrTaxCode, setIdCardOrTaxCode] = useState(editingDependent?.idCardOrTaxCode || '');
  const [startDate, setStartDate] = useState(editingDependent?.startDate || '2020-01');
  const [endDate, setEndDate] = useState(editingDependent?.endDate || '');
  const [notes, setNotes] = useState(editingDependent?.notes || '');

  const currentEmp = employees.find(e => e.code === selectedEmpCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dependentName.trim()) {
      alert('Vui lòng nhập họ và tên người phụ thuộc');
      return;
    }

    const newDep: TaxDependent = {
      id: editingDependent?.id || `dep-${Date.now()}`,
      employeeId: currentEmp?.id || `emp-${selectedEmpCode}`,
      employeeCode: selectedEmpCode,
      employeeName: currentEmp?.fullName || '',
      dependentName: dependentName.trim(),
      relationship,
      dob,
      idCardOrTaxCode: idCardOrTaxCode.trim(),
      startDate,
      endDate: endDate.trim() ? endDate.trim() : undefined,
      deductionMonthlyAmount: DEPENDENT_DEDUCTION_MONTHLY, // 4.400.000 đ
      notes: notes.trim(),
    };

    onSave(newDep);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-300" />
            <h3 className="font-black text-base text-white">
              {editingDependent ? 'Cập Nhật Người Phụ Thuộc' : 'Đăng Ký Người Phụ Thuộc Mới'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Cán bộ / Nhân viên nộp thuế:
            </label>
            <select
              value={selectedEmpCode}
              onChange={(e) => setSelectedEmpCode(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {employees.map(emp => (
                <option key={emp.code} value={emp.code}>
                  {emp.code} - {emp.fullName} ({emp.departmentName || 'Chi cục'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Họ và tên người phụ thuộc: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Nguyễn Hoàng Khang"
              value={dependentName}
              onChange={(e) => setDependentName(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mối quan hệ:
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Con dưới 18 tuổi">Con dưới 18 tuổi</option>
                <option value="Con trên 18 tuổi học ĐH/CĐ">Con trên 18 tuổi học ĐH/CĐ</option>
                <option value="Vợ/Chồng không có thu nhập">Vợ/Chồng không có thu nhập</option>
                <option value="Cha/Mẹ hết tuổi lao động">Cha/Mẹ hết tuổi lao động</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Ngày sinh:
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Số CCCD hoặc Mã số thuế NPT:
            </label>
            <input
              type="text"
              placeholder="Số định danh cá nhân / CCCD / MST"
              value={idCardOrTaxCode}
              onChange={(e) => setIdCardOrTaxCode(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Thời điểm bắt đầu (YYYY-MM):
              </label>
              <input
                type="text"
                placeholder="2020-01"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Thời điểm kết thúc (nếu có):
              </label>
              <input
                type="text"
                placeholder="Để trống nếu còn hiệu lực"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Ghi chú:
            </label>
            <input
              type="text"
              placeholder="Giảm trừ người phụ thuộc..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Lưu Thông Tin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
