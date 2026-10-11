import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Briefcase, 
  FileSpreadsheet, 
  Cloud, 
  AlertTriangle, 
  Calendar, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  ArrowUpRight,
  PlusCircle,
  Download,
  Filter,
  Eye,
  Stethoscope,
  Scale,
  FileText,
  CheckCircle2,
  ChevronRight,
  Layers,
  Table,
  BarChart3,
  HelpCircle,
  Building2,
  PieChart,
  UserPlus,
  Search,
  X
} from 'lucide-react';
import { Employee, Department, WorkStatus } from '../types/hrm';
import * as XLSX from 'xlsx';
import { Education3DPieChart } from './Education3DPieChart';
import { RetirementTrackingSection } from './RetirementTrackingSection';
import { formatDecimal, formatPCCV, formatPercentAllowance } from '../utils/salaryUtils';
import { sortEmployeesByPriority } from '../utils/leadershipUtils';

export const STAFF_TYPE_ORDER = [
  'Công chức',
  'Viên chức',
  'Hợp đồng 111',
  'Nhân viên Thú y PX',
  'Khoán chuyên môn',
  'Khác'
] as const;

export type MainStaffType = typeof STAFF_TYPE_ORDER[number];

/**
 * Chuẩn hóa loại nhân sự về 6 nhóm chính thức theo yêu cầu nghiệp vụ
 */
export function getStaffTypeCategory(staffType?: string): MainStaffType {
  if (!staffType) return 'Khác';
  const s = staffType.trim();
  if (s === 'Công chức') return 'Công chức';
  if (s === 'Viên chức') return 'Viên chức';
  if (s === 'Hợp đồng 111' || s === 'Hợp đồng 68/111' || s.toLowerCase().includes('111') || s.toLowerCase().includes('68')) return 'Hợp đồng 111';
  if (s === 'Nhân viên Thú y PX' || s.toLowerCase().includes('thú y px') || s.toLowerCase().includes('phường xã')) return 'Nhân viên Thú y PX';
  if (s === 'Khoán chuyên môn' || s.toLowerCase().includes('khoán') || s.toLowerCase().includes('chuyên môn')) return 'Khoán chuyên môn';
  return 'Khác';
}

export const STAFF_TYPE_META: Record<MainStaffType, {
  title: string;
  subtitle: string;
  legalBasis: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  headerBg: string;
  barColor: string;
}> = {
  'Công chức': {
    title: 'Công chức',
    subtitle: 'Biên chế quản lý nhà nước & Lãnh đạo',
    legalBasis: 'Luật Cán bộ, công chức & Nghị định CP',
    icon: ShieldCheck,
    badgeBg: 'bg-blue-50',
    badgeBorder: 'border-blue-200 hover:border-blue-400',
    badgeText: 'text-blue-900',
    headerBg: 'bg-blue-600',
    barColor: 'from-blue-600 to-sky-500',
  },
  'Viên chức': {
    title: 'Viên chức',
    subtitle: 'Đơn vị sự nghiệp công lập & Kiểm dịch',
    legalBasis: 'Luật Viên chức & Nghị định số 115/2020/NĐ-CP',
    icon: UserCheck,
    badgeBg: 'bg-teal-50',
    badgeBorder: 'border-teal-200 hover:border-teal-400',
    badgeText: 'text-teal-900',
    headerBg: 'bg-teal-600',
    barColor: 'from-teal-600 to-emerald-500',
  },
  'Hợp đồng 111': {
    title: 'Hợp đồng 111',
    subtitle: 'Hợp đồng theo Nghị định 111/2022/NĐ-CP',
    legalBasis: 'Nghị định số 111/2022/NĐ-CP (thay thế NĐ 68/2000)',
    icon: FileText,
    badgeBg: 'bg-amber-50',
    badgeBorder: 'border-amber-200 hover:border-amber-400',
    badgeText: 'text-amber-900',
    headerBg: 'bg-amber-600',
    barColor: 'from-amber-500 to-yellow-400',
  },
  'Nhân viên Thú y PX': {
    title: 'Nhân viên Thú y PX',
    subtitle: 'Thú y cơ sở phụ trách phường, xã, thị trấn',
    legalBasis: 'Mạng lưới nhân viên thú y phường, xã, thị trấn',
    icon: Stethoscope,
    badgeBg: 'bg-purple-50',
    badgeBorder: 'border-purple-200 hover:border-purple-400',
    badgeText: 'text-purple-900',
    headerBg: 'bg-purple-600',
    barColor: 'from-purple-600 to-fuchsia-500',
  },
  'Khoán chuyên môn': {
    title: 'Khoán chuyên môn',
    subtitle: 'Hợp đồng khoán dịch vụ kỹ thuật chuyên ngành',
    legalBasis: 'Khoán công việc chuyên môn nghiệp vụ / đợt dịch',
    icon: Scale,
    badgeBg: 'bg-emerald-50',
    badgeBorder: 'border-emerald-200 hover:border-emerald-400',
    badgeText: 'text-emerald-900',
    headerBg: 'bg-emerald-600',
    barColor: 'from-emerald-600 to-green-400',
  },
  'Khác': {
    title: 'Khác',
    subtitle: 'Hợp đồng lao động & hình thức hỗ trợ khác',
    legalBasis: 'Bộ luật Lao động & HĐ dịch vụ / hỗ trợ khác',
    icon: Users,
    badgeBg: 'bg-slate-50',
    badgeBorder: 'border-slate-200 hover:border-slate-400',
    badgeText: 'text-slate-900',
    headerBg: 'bg-slate-600',
    barColor: 'from-slate-500 to-gray-400',
  },
};

interface DashboardViewProps {
  employees: Employee[];
  departments: Department[];
  onOpenAddModal: () => void;
  onOpenSyncSheets: () => void;
  onOpenDriveModal: () => void;
  onOpenExcelImportModal?: () => void;
  onSelectEmployee: (emp: Employee) => void;
  onNavigateTab: (tabId: string) => void;
  onFilterStaffType?: (staffType: string) => void;
  onClearMockData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  employees,
  departments,
  onOpenAddModal,
  onOpenSyncSheets,
  onOpenDriveModal,
  onOpenExcelImportModal,
  onSelectEmployee,
  onNavigateTab,
  onFilterStaffType,
  onClearMockData,
}) => {
  const [chartDimension, setChartDimension] = useState<
    'staffType' | 'unit' | 'gender' | 'age' | 'rank' | 'education' | 'status'
  >('staffType');

  // Bộ lọc cho Bảng Tóm Tắt Cơ Cấu Nhân Sự ở phía dưới Dashboard
  const [summaryStatusFilter, setSummaryStatusFilter] = useState<string>('ALL');
  const [summaryStaffTypeFilter, setSummaryStaffTypeFilter] = useState<string>('ALL');
  const [summaryDeptFilter, setSummaryDeptFilter] = useState<string>('ALL');

  // Lựa chọn loại hình nhân sự để xem Biểu đồ 3D Trình độ chuyên môn
  const [selectedStaffTypeForEdu, setSelectedStaffTypeForEdu] = useState<string>('ALL');

  // Modal chọn đối tượng xem hồ sơ điện tử trong danh sách nhân sự đang công tác
  const [isProfilePickerOpen, setIsProfilePickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerDept, setPickerDept] = useState('ALL');
  const [pickerStaffType, setPickerStaffType] = useState('ALL');

  // Danh sách cán bộ đang công tác phục vụ chọn đối tượng xem hồ sơ điện tử
  const activeStaffList = useMemo(() => {
    const filtered = employees.filter(e => {
      // Chỉ chọn cán bộ đang công tác theo đúng yêu cầu người dùng
      if (e.status !== 'Đang công tác') return false;
      if (pickerDept !== 'ALL' && e.departmentId !== pickerDept) return false;
      if (pickerStaffType !== 'ALL' && getStaffTypeCategory(e.staffType) !== pickerStaffType) return false;
      if (pickerSearch.trim() !== '') {
        const q = pickerSearch.trim().toLowerCase();
        const matchName = e.fullName?.toLowerCase().includes(q);
        const matchCode = e.code?.toLowerCase().includes(q);
        const matchCccd = e.cccd?.toLowerCase().includes(q);
        const matchPos = e.positionTitle?.toLowerCase().includes(q);
        const matchDept = e.departmentName?.toLowerCase().includes(q);
        return matchName || matchCode || matchCccd || matchPos || matchDept;
      }
      return true;
    });

    // Sắp xếp ưu tiên: Chi cục Trưởng -> Phó Chi Cục Trưởng -> Trưởng trạm -> Phó Trưởng Trạm -> Công chức -> Viên chức -> Hợp đồng 111
    return sortEmployeesByPriority(filtered);
  }, [employees, pickerDept, pickerStaffType, pickerSearch]);

  // Tổng số lượng
  const totalCount = employees.length;
  const activeCount = employees.filter(e => e.status === 'Đang công tác').length;
  const maleCount = employees.filter(e => e.gender === 'Nam').length;
  const femaleCount = employees.filter(e => e.gender === 'Nữ').length;

  // Thống kê 6 loại hình nhân sự
  const staffTypeCounts = useMemo(() => {
    const counts: Record<MainStaffType, number> = {
      'Công chức': 0,
      'Viên chức': 0,
      'Hợp đồng 111': 0,
      'Nhân viên Thú y PX': 0,
      'Khoán chuyên môn': 0,
      'Khác': 0,
    };

    employees.forEach(emp => {
      const cat = getStaffTypeCategory(emp.staffType);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, [employees]);

  // Tính phần trăm theo từng loại
  const percentOf = (count: number) => {
    if (totalCount === 0) return 0;
    return Math.round((count / totalCount) * 1000) / 10;
  };

  // Cảnh báo nghỉ hưu và nâng lương
  const retiringEmployees = useMemo(() => {
    return employees.filter(e => {
      if (e.status !== 'Đang công tác') return false;
      const birthYear = parseInt(e.dob?.split('-')[0] || '1970', 10);
      const age = 2026 - birthYear;
      return (e.gender === 'Nam' && age >= 61) || (e.gender === 'Nữ' && age >= 56);
    });
  }, [employees]);

  const salaryDueEmployees = useMemo(() => {
    return employees.filter(e => {
      return e.status === 'Đang công tác' && (e.salary?.nextSalaryIncreaseDate || '').includes('2026');
    });
  }, [employees]);

  // Điều hướng sang danh sách cán bộ có bộ lọc loại nhân sự
  const handleViewStaffType = (type: string) => {
    if (onFilterStaffType) {
      onFilterStaffType(type);
    } else {
      onNavigateTab('staff');
    }
  };

  // Tính toán dữ liệu biểu đồ
  const chartData = useMemo(() => {
    switch (chartDimension) {
      case 'staffType':
        return STAFF_TYPE_ORDER.map(type => {
          const count = staffTypeCounts[type] || 0;
          return {
            label: `${type} (${STAFF_TYPE_META[type].subtitle})`,
            shortLabel: type,
            count,
            percent: percentOf(count),
          };
        });
      case 'unit':
        return departments.map(dept => {
          const count = employees.filter(e => e.departmentId === dept.id).length;
          return {
            label: dept.name,
            shortLabel: dept.code,
            count,
            percent: percentOf(count),
          };
        });
      case 'gender':
        return [
          { label: 'Nam giới', shortLabel: 'Nam', count: maleCount, percent: percentOf(maleCount) },
          { label: 'Nữ giới', shortLabel: 'Nữ', count: femaleCount, percent: percentOf(femaleCount) },
        ];
      case 'status':
        const statusMap: Record<string, number> = {};
        employees.forEach(e => {
          const st = e.status || 'Đang công tác';
          statusMap[st] = (statusMap[st] || 0) + 1;
        });
        return Object.entries(statusMap).map(([st, cnt]) => ({
          label: st,
          shortLabel: st,
          count: cnt,
          percent: percentOf(cnt),
        }));
      case 'rank':
        const rankMap: Record<string, number> = {};
        employees.forEach(e => {
          const rk = e.jobRankName || e.positionTitle || 'Chuyên viên';
          rankMap[rk] = (rankMap[rk] || 0) + 1;
        });
        return Object.entries(rankMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([rk, cnt]) => ({
            label: rk,
            shortLabel: rk,
            count: cnt,
            percent: percentOf(cnt),
          }));
      case 'education':
        const eduMap: Record<string, number> = {};
        employees.forEach(e => {
          const deg = e.education?.highestDegree || 'Đại học';
          eduMap[deg] = (eduMap[deg] || 0) + 1;
        });
        return Object.entries(eduMap).map(([deg, cnt]) => ({
          label: deg,
          shortLabel: deg,
          count: cnt,
          percent: percentOf(cnt),
        }));
      case 'age':
        let under30 = 0, f30to40 = 0, f41to50 = 0, over50 = 0;
        employees.forEach(e => {
          const birthYear = parseInt(e.dob?.split('-')[0] || '1985', 10);
          const age = 2026 - birthYear;
          if (age < 30) under30++;
          else if (age <= 40) f30to40++;
          else if (age <= 50) f41to50++;
          else over50++;
        });
        return [
          { label: 'Dưới 30 tuổi (Cán bộ trẻ)', shortLabel: '< 30 tuổi', count: under30, percent: percentOf(under30) },
          { label: 'Từ 30 đến 40 tuổi', shortLabel: '30 - 40 tuổi', count: f30to40, percent: percentOf(f30to40) },
          { label: 'Từ 41 đến 50 tuổi', shortLabel: '41 - 50 tuổi', count: f41to50, percent: percentOf(f41to50) },
          { label: 'Trên 50 tuổi', shortLabel: '> 50 tuổi', count: over50, percent: percentOf(over50) },
        ];
      default:
        return [];
    }
  }, [chartDimension, employees, departments, staffTypeCounts, totalCount]);

  // Dữ liệu ma trận cho Bảng Tóm Tắt Cơ Cấu Nhân Sự (Phần dưới Dashboard)
  const summaryMatrix = useMemo(() => {
    // Lọc theo phòng ban nếu có
    const baseEmployees = summaryDeptFilter === 'ALL'
      ? employees
      : employees.filter(e => e.departmentId === summaryDeptFilter);

    // Tính ma trận theo từng loại hình nhân sự
    const rows = STAFF_TYPE_ORDER.map(staffTypeKey => {
      // Tập hợp cán bộ thuộc loại hình này
      const groupEmployees = baseEmployees.filter(e => getStaffTypeCategory(e.staffType) === staffTypeKey);

      // Phân theo các trạng thái
      const active = groupEmployees.filter(e => e.status === 'Đang công tác').length;
      const bietPhai = groupEmployees.filter(e => e.status === 'Biệt phái').length;
      const tamHoan = groupEmployees.filter(e => e.status === 'Nghỉ không lương / Tạm hoãn').length;
      const nghiHuu = groupEmployees.filter(e => e.status === 'Nghỉ hưu').length;
      const thoiViecChuyen = groupEmployees.filter(e => e.status === 'Thôi việc' || e.status === 'Chuyển công tác').length;
      
      const male = groupEmployees.filter(e => e.gender === 'Nam').length;
      const female = groupEmployees.filter(e => e.gender === 'Nữ').length;

      const groupTotal = groupEmployees.length;
      const groupPercent = baseEmployees.length > 0
        ? Math.round((groupTotal / baseEmployees.length) * 1000) / 10
        : 0;

      // Tính số lượng theo trạng thái đang được chọn lọc (nếu có lọc trạng thái)
      let displayCount = groupTotal;
      if (summaryStatusFilter !== 'ALL') {
        if (summaryStatusFilter === 'Đang công tác') displayCount = active;
        else if (summaryStatusFilter === 'Biệt phái') displayCount = bietPhai;
        else if (summaryStatusFilter === 'Nghỉ không lương / Tạm hoãn') displayCount = tamHoan;
        else if (summaryStatusFilter === 'Nghỉ hưu') displayCount = nghiHuu;
        else if (summaryStatusFilter === 'Thôi việc / Chuyển công tác') displayCount = thoiViecChuyen;
      }

      return {
        staffType: staffTypeKey,
        meta: STAFF_TYPE_META[staffTypeKey],
        active,
        bietPhai,
        tamHoan,
        nghiHuu,
        thoiViecChuyen,
        male,
        female,
        total: groupTotal,
        percent: groupPercent,
        displayCount,
      };
    });

    // Lọc theo loại nhân sự nếu người dùng chọn
    const filteredRows = summaryStaffTypeFilter === 'ALL'
      ? rows
      : rows.filter(r => r.staffType === summaryStaffTypeFilter);

    // Tính dòng tổng cộng
    const totalRow = {
      staffType: 'TỔNG CỘNG TOÀN ĐƠN VỊ' as const,
      active: rows.reduce((s, r) => s + r.active, 0),
      bietPhai: rows.reduce((s, r) => s + r.bietPhai, 0),
      tamHoan: rows.reduce((s, r) => s + r.tamHoan, 0),
      nghiHuu: rows.reduce((s, r) => s + r.nghiHuu, 0),
      thoiViecChuyen: rows.reduce((s, r) => s + r.thoiViecChuyen, 0),
      male: rows.reduce((s, r) => s + r.male, 0),
      female: rows.reduce((s, r) => s + r.female, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
      percent: rows.reduce((s, r) => s + r.percent, 0),
      displayCount: rows.reduce((s, r) => s + r.displayCount, 0),
    };

    return { rows: filteredRows, allRows: rows, totalRow };
  }, [employees, summaryDeptFilter, summaryStatusFilter, summaryStaffTypeFilter]);

  // Xuất Excel Bảng Tóm Tắt Cơ Cấu Nhân Sự
  const handleExportExcelSummary = () => {
    const dataToExport: Record<string, any>[] = summaryMatrix.allRows.map((r, idx) => ({
      'STT': idx + 1,
      'Loại hình nhân sự': r.staffType,
      'Diễn giải nghiệp vụ': r.meta.subtitle,
      'Cơ sở pháp lý': r.meta.legalBasis,
      'Đang công tác': r.active,
      'Biệt phái': r.bietPhai,
      'Tạm hoãn / Không lương': r.tamHoan,
      'Nghỉ hưu': r.nghiHuu,
      'Thôi việc / Chuyển CT': r.thoiViecChuyen,
      'Tổng số lượng (người)': r.total,
      'Tỉ lệ cơ cấu (%)': `${r.percent}%`,
      'Nam (người)': r.male,
      'Nữ (người)': r.female,
      'Tỉ lệ Nam (%)': r.total > 0 ? `${Math.round((r.male / r.total) * 100)}%` : '0%',
      'Tỉ lệ Nữ (%)': r.total > 0 ? `${Math.round((r.female / r.total) * 100)}%` : '0%',
    }));

    // Dòng tổng cộng
    dataToExport.push({
      'STT': 'Tổng' as any,
      'Loại hình nhân sự': 'TỔNG CỘNG',
      'Diễn giải nghiệp vụ': 'Toàn cơ quan Chi cục Chăn nuôi & Thú y',
      'Cơ sở pháp lý': '',
      'Đang công tác': summaryMatrix.totalRow.active,
      'Biệt phái': summaryMatrix.totalRow.bietPhai,
      'Tạm hoãn / Không lương': summaryMatrix.totalRow.tamHoan,
      'Nghỉ hưu': summaryMatrix.totalRow.nghiHuu,
      'Thôi việc / Chuyển CT': summaryMatrix.totalRow.thoiViecChuyen,
      'Tổng số lượng (người)': summaryMatrix.totalRow.total,
      'Tỉ lệ cơ cấu (%)': '100.0%',
      'Nam (người)': summaryMatrix.totalRow.male,
      'Nữ (người)': summaryMatrix.totalRow.female,
      'Tỉ lệ Nam (%)': summaryMatrix.totalRow.total > 0 ? `${Math.round((summaryMatrix.totalRow.male / summaryMatrix.totalRow.total) * 100)}%` : '0%',
      'Tỉ lệ Nữ (%)': summaryMatrix.totalRow.total > 0 ? `${Math.round((summaryMatrix.totalRow.female / summaryMatrix.totalRow.total) * 100)}%` : '0%',
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CoCauNhanSu');
    XLSX.writeFile(workbook, `BaoCao_CoCau_NhanSu_ChiCuc_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 rounded-xl px-4 py-3 sm:px-5 sm:py-3.5 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-white/80 rounded-full" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white uppercase flex items-center gap-2">
                <span>HỆ THỐNG QUẢN LÝ NHÂN SỰ ĐIỆN TỬ</span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:inline-block">
                  Cơ sở dữ liệu cán bộ
                </span>
              </h2>
              <p className="text-[11px] text-sky-100 mt-0.5">
                Chi cục Chăn nuôi và Thú y TP.HCM &bull; Định biên & Theo dõi 6 loại hình nhân sự
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenExcelImportModal && (
              <button
                onClick={onOpenExcelImportModal}
                title="Tìm kiếm và đối soát bảng lương toàn Chi cục từ Google Drive"
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-900" />
                <span>Nhập File BANG LUONG (Drive)</span>
              </button>
            )}
            <button
              onClick={() => setIsProfilePickerOpen(true)}
              title="Lựa chọn đối tượng trong danh sách nhân sự đang công tác để mở xem Hồ sơ điện tử (6 Tab)"
              className="bg-sky-950/70 hover:bg-sky-950 text-white font-semibold px-3 py-1.5 rounded-lg text-xs border border-sky-300/50 shadow-sm transition flex items-center gap-1.5 active:scale-95"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-300" />
              <span>Xem Hồ Sơ Điện Tử ({employees.filter(e => e.status === 'Đang công tác').length})</span>
            </button>
            {/* Nút Thêm Mới Nhân Sự - Hiển thị 3D màu xanh lá cây */}
            <button
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Thêm mới hồ sơ cán bộ nhân sự vào Chi cục"
            >
              <PlusCircle className="w-4 h-4 text-emerald-100" />
              <span>Thêm Nhân Sự Mới</span>
            </button>
            <button
              onClick={onOpenSyncSheets}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Đồng Bộ Google Sheets</span>
            </button>
            {onClearMockData && (
              <button
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn LÀM SẠCH toàn bộ dữ liệu mẫu trong hệ thống? Sau khi làm sạch, hệ thống sẽ đưa về 0 hồ sơ và sẵn sàng nhận 100% dữ liệu thực tế do bạn nạp từ Google Sheets.')) {
                    onClearMockData();
                  }
                }}
                className="bg-rose-700 hover:bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95"
                title="Làm sạch dữ liệu mẫu có sẵn để tự nạp dữ liệu thực tế"
              >
                <span>🧹 Làm Sạch Dữ Liệu Mẫu</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
      </div>

      {/* Thông báo trạng thái khi đã làm sạch dữ liệu mẫu (Sẵn sàng nạp dữ liệu người dùng) */}
      {employees.length === 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-dashed border-amber-300 rounded-2xl p-6 text-center space-y-3 animate-in fade-in">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xl font-bold shadow-xs">
            ✨
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Hệ Thống Đã Được Làm Sạch Toàn Bộ Dữ Liệu Mẫu
          </h3>
          <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
            Hệ thống cam kết <strong>không tự sinh dữ liệu giả lập</strong>. Mọi chỉ số (bao gồm 167 Công chức, các Viên chức, HĐ 111...), bảng lương, và biểu đồ 3D màu cam sẽ được trích xuất <strong>chính xác 100% từ dữ liệu thực tế do bạn nạp vào</strong>.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <button
              onClick={onOpenSyncSheets}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition flex items-center gap-2 active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Nạp Dữ Liệu Từ Google Sheets ("Chi Cục Chăn Nuôi & Thú Y TPHCM")</span>
            </button>
            <button
              onClick={onOpenAddModal}
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition flex items-center gap-2 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm Nhân Sự Mới Thủ Công</span>
            </button>
          </div>
        </div>
      )}

      {/* Row 1 Stats: 4 Cards Tổng Quan Quy Mô */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigateTab('staff')}
          title="Nhấp để xem toàn bộ danh sách cán bộ"
          className="bg-white p-4 rounded-xl border border-sky-100 shadow-sm hover:border-sky-400 hover:shadow-md transition group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-sky-700 transition">👥 TỔNG NHÂN SỰ</span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-600 group-hover:text-white transition">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-sky-900">{totalCount}</div>
            <span className="text-xs text-slate-500">hồ sơ cán bộ</span>
          </div>
          <div className="text-[11px] text-sky-600 mt-1 font-medium flex items-center gap-1">
            <span>Toàn bộ cơ quan &bull; Nhấp để xem</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">💼 ĐANG CÔNG TÁC</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700">{activeCount}</div>
            <span className="text-xs text-emerald-600 font-semibold">{percentOf(activeCount)}%</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Lực lượng trực tiếp đảm nhiệm vị trí</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">🚻 CƠ CẤU GIỚI TÍNH</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-slate-800">
              <span className="text-blue-700">{maleCount}</span>
              <span className="text-slate-400 text-lg mx-1">/</span>
              <span className="text-pink-600">{femaleCount}</span>
            </div>
            <span className="text-xs text-slate-500">Nam / Nữ</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Nam: {percentOf(maleCount)}% &bull; Nữ: {percentOf(femaleCount)}%
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('warnings')}
          className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 shadow-sm hover:border-amber-400 transition cursor-pointer group"
          title="Nhấp để xem cảnh báo nhân sự"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">⏳ CẢNH BÁO NHÂN SỰ</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 group-hover:scale-110 transition" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-amber-700">
              {retiringEmployees.length}
            </div>
            <span className="text-xs text-amber-700 font-medium">sắp hưu / nâng lương</span>
          </div>
          <div className="text-[11px] text-amber-800 mt-1 font-medium flex items-center gap-1">
            <span>Rà soát thủ tục hưu trí & lương</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Row 2: 6 Cards Chi Tiết 6 Loại Hình Nhân Sự & Biểu đồ 3D Trình Độ Chuyên Môn */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">
              CƠ CẤU 6 LOẠI HÌNH NHÂN SỰ TẠI CHI CỤC
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium hidden sm:inline">
              Nhấp vào thẻ để lọc Biểu đồ 3D Trình độ chuyên môn bên dưới
            </span>
            {selectedStaffTypeForEdu !== 'ALL' && (
              <button
                onClick={() => setSelectedStaffTypeForEdu('ALL')}
                className="text-[11px] text-sky-700 hover:text-sky-900 font-bold bg-sky-100 hover:bg-sky-200 px-2.5 py-1 rounded-lg border border-sky-300 transition"
              >
                &larr; Xem tất cả 6 loại hình
              </button>
            )}
          </div>
        </div>

        {/* 6 Thẻ loại hình nhân sự */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAFF_TYPE_ORDER.map((typeKey) => {
            const count = staffTypeCounts[typeKey] || 0;
            const pct = percentOf(count);
            const meta = STAFF_TYPE_META[typeKey];
            const Icon = meta.icon;
            const isSelected = selectedStaffTypeForEdu === typeKey;

            return (
              <div
                key={typeKey}
                onClick={() => setSelectedStaffTypeForEdu(isSelected ? 'ALL' : typeKey)}
                title={`Nhấp để xem Trình độ chuyên môn 3D của ${typeKey}`}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-50/60 shadow-md'
                    : `bg-white ${meta.badgeBorder} shadow-xs hover:shadow-md`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-bold uppercase truncate ${isSelected ? 'text-sky-900 font-black' : 'text-slate-600'}`}>
                      {meta.title}
                    </span>
                    <div className={`w-7 h-7 rounded-lg ${meta.badgeBg} flex items-center justify-center group-hover:scale-110 transition shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${meta.badgeText}`} />
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <div className={`text-xl sm:text-2xl font-black ${meta.badgeText}`}>
                      {count}
                    </div>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      ({pct}%)
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                    {meta.subtitle}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className={`font-semibold ${isSelected ? 'text-sky-700' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {isSelected ? '✓ Đang xem 3D' : 'Xem biểu đồ 3D'}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewStaffType(typeKey);
                    }}
                    title={`Chuyển tới danh sách hồ sơ ${typeKey}`}
                    className="text-sky-600 hover:text-sky-800 font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <span>Hồ sơ</span>
                    <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Biểu đồ hình tròn 3D Trình độ chuyên môn */}
        <Education3DPieChart
          employees={employees}
          selectedStaffType={selectedStaffTypeForEdu}
          onSelectStaffType={setSelectedStaffTypeForEdu}
          onFilterDegree={(_deg) => {
            onNavigateTab('staff');
          }}
        />
      </div>

      {/* Main Grid: Chart & Breakdown + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Graph / Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-600" />
                <span>BIỂU ĐỒ PHÂN BỔ NHÂN LỰC CHI CỤC</span>
              </h3>
              <p className="text-xs text-slate-500">Thống kê đa tiêu chí hỗ trợ công tác quy hoạch tổ chức</p>
            </div>

            {/* Select dimension */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={chartDimension}
                onChange={(e) => setChartDimension(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="staffType">Theo Loại Hình Nhân Sự (6 Loại)</option>
                <option value="unit">Theo Phòng / Trạm Trực Thuộc</option>
                <option value="gender">Theo Giới Tính (Nam / Nữ)</option>
                <option value="status">Theo Tình Trạng Công Tác</option>
                <option value="rank">Theo Ngạch / Chức Danh</option>
                <option value="education">Theo Trình Độ Chuyên Môn</option>
                <option value="age">Theo Nhóm Độ Tuổi</option>
              </select>
            </div>
          </div>

          {/* Bar Visualization */}
          <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-2">
            {chartData.map((item, idx) => (
              <div key={idx} className="group">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 group-hover:text-sky-800 transition truncate max-w-[280px] sm:max-w-md">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-900">{item.count} nhân sự</span>
                    <span className="text-[11px] text-slate-400 font-mono w-12 text-right">({item.percent}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-sky-500 to-cyan-500 h-full rounded-full transition-all duration-500 group-hover:from-sky-600 group-hover:to-cyan-600"
                    style={{ width: `${Math.max(item.percent, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Dữ liệu được cập nhật theo định biên Chi cục Chăn nuôi & Thú y</span>
            <button 
              onClick={() => onNavigateTab('reports')}
              className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
            >
              <span>Xem báo cáo chi tiết</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 1 Col: CẢNH BÁO NHÂN SỰ & GOOGLE WORKSPACE */}
        <div className="space-y-6">
          {/* Cảnh báo tự động */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span className="text-base">🔔</span>
                <span>CẢNH BÁO TỔ CHỨC</span>
              </h3>
              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Quan trọng
              </span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div 
                onClick={() => onNavigateTab('warnings')}
                className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 hover:bg-amber-100/70 transition cursor-pointer flex items-start gap-2.5"
              >
                <span className="text-base shrink-0">⏳</span>
                <div>
                  <div className="font-bold text-amber-950">
                    ⚠ {retiringEmployees.length} cán bộ sắp đến tuổi nghỉ hưu
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Hồ sơ cán bộ chuẩn bị đến tuổi hưu trí cần lập danh sách thông báo trước 6 tháng.
                  </div>
                </div>
              </div>

              <div 
                onClick={() => onNavigateTab('salary')}
                className="p-3 bg-blue-50/80 rounded-lg border border-blue-200 hover:bg-blue-100/70 transition cursor-pointer flex items-start gap-2.5"
              >
                <span className="text-base shrink-0">💰</span>
                <div>
                  <div className="font-bold text-blue-950">
                    ⚠ {salaryDueEmployees.length} người đến kỳ nâng bậc lương
                  </div>
                  <div className="text-[11px] text-blue-800 mt-0.5">
                    Đủ điều kiện xét nâng bậc lương thường xuyên và thâm niên nghề.
                  </div>
                </div>
              </div>

              <div 
                onClick={() => onNavigateTab('decisions')}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-start gap-2.5"
              >
                <span className="text-base shrink-0">📄</span>
                <div>
                  <div className="font-bold text-slate-900">
                    ⚠ Quyết định điều động & bổ nhiệm
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Theo dõi thời hạn các quyết định biệt phái kiểm dịch viên và hợp đồng thời vụ.
                  </div>
                </div>
              </div>

              <div 
                onClick={() => onNavigateTab('staff')}
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer flex items-start gap-2.5"
              >
                <span className="text-base shrink-0">📁</span>
                <div>
                  <div className="font-bold text-slate-900">
                    ⚠ Quản lý Hồ sơ Mẫu 2C & Số hóa
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Rà soát đầy đủ thông tin ngạch, bậc, CCCD và đính kèm tài liệu trên Drive.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Workspace Box */}
          <div className="bg-gradient-to-br from-slate-900 to-sky-950 rounded-xl p-4 text-white shadow-sm border border-slate-800">
            <h4 className="font-bold text-xs uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>Lưu trữ Google Workspace</span>
            </h4>
            <p className="text-[11px] text-slate-300 mt-1">
              Toàn bộ dữ liệu hồ sơ, tệp PDF, scan CCCD và bảng lương được lưu an toàn tại thư mục Google Drive & Google Sheets của Chi cục.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={onOpenSyncSheets}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bảng Sheets</span>
              </button>

              <button
                onClick={onOpenDriveModal}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold py-2 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Thư mục Drive</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHỐI THEO DÕI CÁN BỘ NGHỈ HƯU & NGHỈ THÔI VIỆC TRONG NĂM (Theo yêu cầu) */}
      {/* ========================================================================= */}
      <RetirementTrackingSection
        employees={employees}
        departments={departments}
        onSelectEmployee={onSelectEmployee}
        onOpenAddModal={onOpenAddModal}
        onNavigateTab={onNavigateTab}
      />

      {/* ========================================================================= */}
      {/* BẢNG DỮ LIỆU TÓM TẮT Ở PHẦN DƯỚI DASHBOARD (Đáp ứng Yêu cầu 3 & 5 của người dùng) */}
      {/* Hiển thị tổng số lượng nhân sự và tỉ lệ % của từng loại hình nhân sự; */}
      {/* Phân loại dựa theo cột trạng thái và chọn loại nhân sự; */}
      {/* Thống kê đầy đủ: Hợp đồng 111, Nhân viên Thú y PX, Khoán chuyên môn... */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        {/* Header bảng tóm tắt */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sky-100 text-sky-800 rounded-lg">
                <Table className="w-5 h-5 text-sky-700" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>BẢNG DỮ LIỆU TÓM TẮT CƠ CẤU TỔ CHỨC & TỈ LỆ PHÂN BỔ NHÂN SỰ</span>
                  <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-sky-200">
                    Ma Trận Tổng Hợp
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi số lượng và tỉ lệ phần trăm (%) từng loại hình nhân sự theo trạng thái làm việc thực tế
                </p>
              </div>
            </div>
          </div>

          {/* Công cụ xuất file */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcelSummary}
              title="Xuất bảng dữ liệu tóm tắt cơ cấu ra file Excel"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Báo Cáo Excel</span>
            </button>
          </div>
        </div>

        {/* Thanh công cụ lọc: Cột trạng thái & Chọn loại nhân sự & Đơn vị */}
        <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Lọc theo Cột Trạng thái */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>1. Cột Trạng Thái Công Tác:</span>
              </label>
              <select
                value={summaryStatusFilter}
                onChange={(e) => setSummaryStatusFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALL">🌐 Tất cả trạng thái (Toàn bộ hồ sơ)</option>
                <option value="Đang công tác">💼 Đang công tác (Thực tế làm việc)</option>
                <option value="Biệt phái">🟣 Biệt phái (Điều động kiểm dịch)</option>
                <option value="Nghỉ không lương / Tạm hoãn">⏸️ Nghỉ không lương / Tạm hoãn</option>
                <option value="Nghỉ hưu">⏳ Nghỉ hưu (Lưu trữ lịch sử)</option>
                <option value="Thôi việc / Chuyển công tác">🚪 Thôi việc / Chuyển công tác</option>
              </select>
            </div>

            {/* 2. Chọn Loại nhân sự */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Chọn Loại Hình Nhân Sự:</span>
              </label>
              <select
                value={summaryStaffTypeFilter}
                onChange={(e) => setSummaryStaffTypeFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALL">📋 Tất cả loại hình nhân sự (6 Loại)</option>
                <option value="Công chức">🏛️ Công chức (Biên chế hành chính)</option>
                <option value="Viên chức">🔬 Viên chức (Sự nghiệp công lập)</option>
                <option value="Hợp đồng 111">📑 Hợp đồng 111 (Nghị định 111/2022)</option>
                <option value="Nhân viên Thú y PX">🩺 Nhân viên Thú y PX (Cơ sở)</option>
                <option value="Khoán chuyên môn">⚖️ Khoán chuyên môn (Kỹ thuật nghiệp vụ)</option>
                <option value="Khác">👥 Khác (Hợp đồng lao động & khác)</option>
              </select>
            </div>

            {/* 3. Lọc theo Phòng / Trạm trực thuộc */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>3. Phòng Ban / Đơn Vị Trực Thuộc:</span>
              </label>
              <select
                value={summaryDeptFilter}
                onChange={(e) => setSummaryDeptFilter(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALL">🏢 Toàn bộ Chi cục (Tất cả Phòng / Trạm)</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick buttons filter */}
          <div className="flex items-center justify-between pt-1 text-[11px] border-t border-slate-200/80 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-semibold">Chọn nhanh loại nhân sự:</span>
              <button
                onClick={() => setSummaryStaffTypeFilter('ALL')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition ${
                  summaryStaffTypeFilter === 'ALL'
                    ? 'bg-sky-600 text-white border-sky-600 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                Tất cả (6 Loại)
              </button>
              {STAFF_TYPE_ORDER.map(t => (
                <button
                  key={t}
                  onClick={() => setSummaryStaffTypeFilter(t)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition ${
                    summaryStaffTypeFilter === t
                      ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {(summaryStatusFilter !== 'ALL' || summaryStaffTypeFilter !== 'ALL' || summaryDeptFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSummaryStatusFilter('ALL');
                  setSummaryStaffTypeFilter('ALL');
                  setSummaryDeptFilter('ALL');
                }}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Bảng Dữ Liệu Tóm Tắt Chi Tiết */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 w-12 text-center">STT</th>
                <th className="py-3 px-3 min-w-[200px]">Loại Hình Nhân Sự</th>
                <th className="py-3 px-3 text-center bg-emerald-50/60 text-emerald-900 border-x border-emerald-100">
                  💼 Đang Công Tác
                </th>
                <th className="py-3 px-3 text-center">Biệt Phái</th>
                <th className="py-3 px-3 text-center">Tạm Hoãn</th>
                <th className="py-3 px-3 text-center">Nghỉ Hưu</th>
                <th className="py-3 px-3 text-center">Thôi Việc / Chuyển</th>
                <th className="py-3 px-3 text-center bg-sky-50/80 text-sky-950 font-black border-x border-sky-200">
                  Tổng Số Lượng
                </th>
                <th className="py-3 px-3 min-w-[140px] text-center bg-sky-50/80 text-sky-950 font-black">
                  Tỉ Lệ Cơ Cấu (%)
                </th>
                <th className="py-3 px-3 text-center">Nam / Nữ</th>
                <th className="py-3 px-3 text-center w-28">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summaryMatrix.rows.map((row, idx) => {
                const Icon = row.meta.icon;
                return (
                  <tr key={row.staffType} className="hover:bg-slate-50/80 transition group">
                    <td className="py-3 px-3 text-center font-mono text-slate-500 font-semibold">
                      0{idx + 1}
                    </td>

                    {/* Loại hình nhân sự */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg ${row.meta.badgeBg} border ${row.meta.badgeBorder} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${row.meta.badgeText}`} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{row.staffType}</span>
                            {row.staffType === 'Hợp đồng 111' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-semibold">
                                NĐ 111
                              </span>
                            )}
                            {row.staffType === 'Nhân viên Thú y PX' && (
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-semibold">
                                Cơ sở
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {row.meta.subtitle}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Đang công tác */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30 border-x border-emerald-100">
                      <span className="text-sm">{row.active}</span>
                      <span className="text-[10px] text-emerald-600 block font-sans">
                        {row.total > 0 ? Math.round((row.active / row.total) * 100) : 0}% loại này
                      </span>
                    </td>

                    {/* Biệt phái */}
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      {row.bietPhai > 0 ? (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                          {row.bietPhai}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Tạm hoãn */}
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      {row.tamHoan > 0 ? (
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                          {row.tamHoan}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Nghỉ hưu */}
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      {row.nghiHuu > 0 ? (
                        <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold">
                          {row.nghiHuu}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Thôi việc / chuyển */}
                    <td className="py-3 px-3 text-center font-mono text-slate-700 font-medium">
                      {row.thoiViecChuyen > 0 ? (
                        <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                          {row.thoiViecChuyen}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Tổng số lượng */}
                    <td className="py-3 px-3 text-center bg-sky-50/50 border-x border-sky-200">
                      <div className="text-base sm:text-lg font-black text-sky-950 font-mono">
                        {row.total}
                      </div>
                      <span className="text-[10px] text-slate-500">cán bộ</span>
                    </td>

                    {/* Tỉ lệ cơ cấu (%) */}
                    <td className="py-3 px-3 bg-sky-50/50">
                      <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-900 mb-1">
                        <span>{row.percent}%</span>
                        <span className="text-[10px] text-slate-500 font-normal">cơ cấu</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`bg-gradient-to-r ${row.meta.barColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(row.percent, 3)}%` }}
                        />
                      </div>
                    </td>

                    {/* Nam / Nữ */}
                    <td className="py-3 px-3 text-center font-mono text-[11px]">
                      <div className="font-semibold text-slate-800">
                        <span className="text-blue-700">{row.male}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-pink-600">{row.female}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-sans">
                        {row.total > 0 ? Math.round((row.male / row.total) * 100) : 0}% Nam
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleViewStaffType(row.staffType)}
                        className="bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-sky-200 hover:border-sky-600 transition flex items-center justify-center gap-1 w-full"
                        title={`Xem danh sách hồ sơ cán bộ thuộc loại hình ${row.staffType}`}
                      >
                        <span>Xem ({row.total})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Dòng Tổng Cộng */}
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
              <tr>
                <td className="py-3 px-3 text-center font-black">∑</td>
                <td className="py-3 px-3">
                  <div className="font-black text-xs uppercase tracking-wide text-slate-900">
                    TỔNG CỘNG TOÀN CHI CỤC
                  </div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    Tổng hợp tất cả 6 loại hình nhân sự
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-mono font-black text-emerald-800 text-sm bg-emerald-100/60 border-x border-emerald-200">
                  {summaryMatrix.totalRow.active}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                  {summaryMatrix.totalRow.bietPhai}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                  {summaryMatrix.totalRow.tamHoan}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                  {summaryMatrix.totalRow.nghiHuu}
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                  {summaryMatrix.totalRow.thoiViecChuyen}
                </td>
                <td className="py-3 px-3 text-center font-mono font-black text-sky-950 text-lg bg-sky-100/80 border-x border-sky-300">
                  {summaryMatrix.totalRow.total}
                </td>
                <td className="py-3 px-3 text-center font-mono font-black text-sky-950 bg-sky-100/80">
                  <span className="text-sm">100.0%</span>
                </td>
                <td className="py-3 px-3 text-center font-mono text-[11px] font-bold">
                  <span className="text-blue-700">{summaryMatrix.totalRow.male}</span>
                  <span className="text-slate-400 mx-1">/</span>
                  <span className="text-pink-600">{summaryMatrix.totalRow.female}</span>
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    onClick={() => onNavigateTab('staff')}
                    className="bg-sky-700 hover:bg-sky-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 w-full shadow-xs"
                  >
                    <span>Xem Tất Cả</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3 Khối Phân Tích Cơ Cấu Nhanh (Insights) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* 1. Khối Biên chế Nhà nước */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-blue-950">
                1. Khối Biên chế Nhà nước: {staffTypeCounts['Công chức'] + staffTypeCounts['Viên chức']} người ({percentOf(staffTypeCounts['Công chức'] + staffTypeCounts['Viên chức'])}%)
              </div>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Bao gồm <strong>Công chức</strong> ({staffTypeCounts['Công chức']}) và <strong>Viên chức</strong> ({staffTypeCounts['Viên chức']}) thực thi công vụ hành chính và sự nghiệp kiểm dịch.
              </p>
            </div>
          </div>

          {/* 2. Khối Hợp đồng & Cơ sở */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-amber-950">
                2. Khối Hợp đồng & Cơ sở: {staffTypeCounts['Hợp đồng 111'] + staffTypeCounts['Nhân viên Thú y PX'] + staffTypeCounts['Khoán chuyên môn']} người ({percentOf(staffTypeCounts['Hợp đồng 111'] + staffTypeCounts['Nhân viên Thú y PX'] + staffTypeCounts['Khoán chuyên môn'])}%)
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Bao gồm <strong>HĐ 111</strong> ({staffTypeCounts['Hợp đồng 111']}), <strong>Thú y PX</strong> ({staffTypeCounts['Nhân viên Thú y PX']}) và <strong>Khoán CM</strong> ({staffTypeCounts['Khoán chuyên môn']}).
              </p>
            </div>
          </div>

          {/* 3. Tỉ lệ Hiện diện thực tế */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-emerald-950">
                3. Hiệu suất Hiện diện: {activeCount} / {totalCount} người ({percentOf(activeCount)}%)
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Cán bộ hiện đang trực tiếp công tác tại các Phòng chuyên môn, Trạm Kiểm dịch động vật và Trung tâm Xét nghiệm.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL LỰA CHỌN ĐỐI TƯỢNG XEM HỒ SƠ ĐIỆN TỬ (CÁN BỘ ĐANG CÔNG TÁC) */}
      {/* ========================================================================= */}
      {isProfilePickerOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header modal */}
            <div className="bg-gradient-to-r from-sky-800 via-sky-700 to-cyan-700 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 p-2 flex items-center justify-center border border-white/20">
                  <Eye className="w-6 h-6 text-cyan-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                    <span>CHỌN ĐỐI TƯỢNG XEM HỒ SƠ ĐIỆN TỬ</span>
                    <span className="bg-emerald-500/40 text-emerald-100 border border-emerald-300/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Cán Bộ Đang Công Tác
                    </span>
                  </h3>
                  <p className="text-xs text-sky-100 mt-0.5">
                    Lựa chọn cán bộ trong danh sách đang công tác để mở giao diện hồ sơ điện tử chi tiết 6 Tab
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProfilePickerOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Tìm kiếm */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Tìm theo tên, mã NV, CCCD, chức vụ..."
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  {pickerSearch && (
                    <button
                      onClick={() => setPickerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Lọc theo Phòng / Trạm */}
                <div>
                  <select
                    value={pickerDept}
                    onChange={(e) => setPickerDept(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="ALL">-- Tất cả Phòng / Trạm ({departments.length}) --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                {/* Lọc theo Loại nhân sự */}
                <div>
                  <select
                    value={pickerStaffType}
                    onChange={(e) => setPickerStaffType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="ALL">-- Tất cả loại hình nhân sự (6 Loại) --</option>
                    {STAFF_TYPE_ORDER.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Thông tin số lượng */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200">
                <span>
                  Tìm thấy <strong className="text-sky-700 font-bold">{activeStaffList.length}</strong> cán bộ đang công tác
                </span>
                <span className="text-[11px] text-slate-400">
                  Nhấp vào bất kỳ cán bộ nào để mở toàn bộ 6 Tab hồ sơ điện tử
                </span>
              </div>
            </div>

            {/* Danh sách cán bộ */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {activeStaffList.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <p className="font-semibold text-slate-700 text-sm">Không tìm thấy cán bộ đang công tác nào phù hợp</p>
                  <p className="mt-1">Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc</p>
                  <button
                    onClick={() => {
                      setPickerSearch('');
                      setPickerDept('ALL');
                      setPickerStaffType('ALL');
                    }}
                    className="mt-3 bg-sky-100 text-sky-800 font-semibold px-3 py-1.5 rounded-lg hover:bg-sky-200 transition text-xs"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeStaffList.map(emp => {
                    const staffCat = getStaffTypeCategory(emp.staffType);
                    const meta = STAFF_TYPE_META[staffCat];
                    const pccv = typeof emp.salary.leadershipAllowance === 'number'
                      ? emp.salary.leadershipAllowance
                      : parseFloat(String(emp.salary.leadershipAllowance || '0').replace(',', '.'));
                    const coeff = typeof emp.salary.coefficient === 'number'
                      ? emp.salary.coefficient
                      : parseFloat(String(emp.salary.coefficient || '2.34').replace(',', '.'));

                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          onSelectEmployee(emp);
                          setIsProfilePickerOpen(false);
                        }}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/40 hover:shadow-md transition cursor-pointer flex items-start justify-between gap-3 group bg-white"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center shrink-0 border border-sky-200 group-hover:scale-105 transition overflow-hidden">
                            {emp.avatarUrl ? (
                              <img src={emp.avatarUrl} alt={emp.fullName} className="w-full h-full object-cover" />
                            ) : (
                              emp.fullName.charAt(0)
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 group-hover:text-sky-700 transition text-xs sm:text-sm truncate">
                                {emp.fullName}
                              </h4>
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                                {emp.code}
                              </span>
                            </div>

                            <div className="text-xs text-slate-700 font-medium mt-0.5 truncate">
                              {emp.positionTitle} &bull; <span className="text-slate-500">{emp.departmentName}</span>
                            </div>

                            {/* Badges: Loại nhân sự & Lương */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                              <span className={`px-2 py-0.5 rounded font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                                {emp.staffType}
                              </span>

                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-semibold">
                                HSL: {formatDecimal(emp.salary.coefficient, 2)}
                              </span>

                              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded font-mono font-semibold" title="Phụ cấp chức vụ lãnh đạo (Định dạng Decimal)">
                                PCCV: {formatPCCV(emp.salary.leadershipAllowance)}
                              </span>

                              <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded font-mono font-semibold" title="Phụ cấp ưu đãi ngành">
                                ƯĐ: {formatPercentAllowance(emp.salary.industryAllowancePercent, 10)}
                              </span>

                              <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-mono font-semibold" title="Phụ cấp công vụ">
                                CVụ: {formatPercentAllowance(emp.salary.publicServiceAllowancePercent, 25)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Nút Xem */}
                        <div className="shrink-0 flex items-center text-sky-600 group-hover:text-sky-800 font-semibold text-xs pt-1">
                          <span className="hidden sm:inline">Mở 6 Tab</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <span>Đang hiển thị đối tượng trong danh sách nhân sự đang công tác</span>
              <button
                onClick={() => setIsProfilePickerOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-4 py-1.5 rounded-lg text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
