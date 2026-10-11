import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Download, 
  Eye, 
  Edit3, 
  Trash2,
  FileSpreadsheet, 
  FolderOpen, 
  ArrowUpDown, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Shield,
  Briefcase,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  FolderSearch,
  X,
  Lock,
  Printer
} from 'lucide-react';
import { Employee, Department, StaffType, WorkStatus, AppUser } from '../types/hrm';
import { AuthPermissionService } from '../services/authPermissionService';
import { ExcelImportService } from '../services/excelImportService';
import { formatDateVN } from '../utils/dateUtils';
import { ProfilePrint2CModal } from './ProfilePrint2CModal';
import * as XLSX from 'xlsx';
import { formatBaseSalary, formatDecimal, formatPCCV, formatPercentAllowance, parseBaseSalary, DEFAULT_BASE_SALARY } from '../utils/salaryUtils';
import { sortEmployeesByPriority } from '../utils/leadershipUtils';

interface EmployeeListViewProps {
  employees: Employee[];
  departments: Department[];
  currentUser?: AppUser | { role: string; roleTitle: string; name: string; email?: string };
  onSelectEmployee: (emp: Employee) => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee?: (empId: string) => void;
  onClearAllMockEmployees?: () => void;
  onOpenAddModal: () => void;
  onOpenMovementModal: (emp: Employee) => void;
  onOpenSyncSheets: () => void;
  onOpenExcelImportModal?: () => void;
  onRefreshFromSheets?: () => void;
  onOpenQuickSearchModal?: () => void;
  isRefreshingSheets?: boolean;
  initialStaffTypeFilter?: string;
}

export const EmployeeListView: React.FC<EmployeeListViewProps> = ({
  employees,
  departments,
  currentUser,
  onSelectEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onClearAllMockEmployees,
  onOpenAddModal,
  onOpenMovementModal,
  onOpenSyncSheets,
  onOpenExcelImportModal,
  onRefreshFromSheets,
  onOpenQuickSearchModal,
  isRefreshingSheets = false,
  initialStaffTypeFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [selectedStaffType, setSelectedStaffType] = useState<string>(initialStaffTypeFilter || 'ALL');
  const [selectedWorkStatus, setSelectedWorkStatus] = useState<string>('ALL');

  React.useEffect(() => {
    if (initialStaffTypeFilter) {
      setSelectedStaffType(initialStaffTypeFilter);
    }
  }, [initialStaffTypeFilter]);
  
  // MẶC ĐỊNH HIỂN THỊ TẤT CẢ CÁN BỘ CÓ TRONG CƠ SỞ DỮ LIỆU THEO YÊU CẦU
  const [statusTab, setStatusTab] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ALL');

  // Modal xác nhận xóa hồ sơ nhân viên trong ứng dụng (KHÔNG DÙNG window.confirm)
  const [confirmDeleteEmployee, setConfirmDeleteEmployee] = useState<Employee | null>(null);
  const [printingEmployee, setPrintingEmployee] = useState<Employee | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Kiểm tra vai trò Admin - Toàn quyền (Cấp 1) và quyền sửa (Cấp 1 & Cấp 3)
  const isAdmin = AuthPermissionService.isUserAdmin(currentUser);
  const isCanEdit = isAdmin || currentUser?.role === 'HR';

  // Khóa chính là cột "Mã Nhân Viên" (Cột "Họ Và Tên" được phép trùng tên)
  const uniqueEmployees = useMemo(() => {
    const seenCodes = new Set<string>();
    const seenIds = new Set<string>();
    const result: Employee[] = [];

    for (const emp of employees) {
      const code = (emp.code || '').trim().toUpperCase();
      const id = (emp.id || '').trim();

      // Khóa chính duy nhất là Mã Nhân Viên theo quy chuẩn CSDL (Họ và Tên được phép trùng)
      if (code) {
        if (seenCodes.has(code)) continue;
        seenCodes.add(code);
      } else if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
      }

      result.push(emp);
    }
    return result;
  }, [employees]);

  // Danh sách các chức vụ thực tế có trong hệ thống để chọn nhanh
  const uniquePositions = useMemo(() => {
    const posSet = new Set<string>();
    uniqueEmployees.forEach(e => {
      if (e.positionTitle && e.positionTitle.trim()) {
        posSet.add(e.positionTitle.trim());
      }
    });
    return Array.from(posSet).sort();
  }, [uniqueEmployees]);

  // Reset toàn bộ bộ lọc
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedDept('ALL');
    setSelectedPosition('ALL');
    setSelectedStaffType('ALL');
    setSelectedWorkStatus('ALL');
    setStatusTab('ALL');
  };

  const hasActiveFilters = searchTerm !== '' || selectedDept !== 'ALL' || selectedPosition !== 'ALL' || selectedStaffType !== 'ALL' || selectedWorkStatus !== 'ALL' || statusTab !== 'ALL';

  // Lọc dữ liệu chuẩn xác và đa tiêu chí trên danh sách đã loại bỏ trùng lặp
  const filteredEmployees = useMemo(() => {
    const filtered = uniqueEmployees.filter(emp => {
      // 1. Lọc theo Tab trạng thái
      if (statusTab === 'ACTIVE' && emp.status !== 'Đang công tác') return false;
      if (statusTab === 'ARCHIVED' && emp.status === 'Đang công tác') return false;

      // 2. Lọc theo Dropdown Trạng thái công tác cụ thể (nếu chọn)
      if (selectedWorkStatus !== 'ALL') {
        if (emp.status !== selectedWorkStatus) return false;
      }

      // 3. Lọc theo Đơn vị / Phòng / Trạm (Ánh xạ thông minh mọi biến thể tên viết tắt)
      if (selectedDept !== 'ALL') {
        const selDeptObj = departments.find(d => d.id === selectedDept);
        const matchDeptId = emp.departmentId === selectedDept;
        const matchDeptCode = selDeptObj?.code && (emp.departmentId === selDeptObj.code || (emp as any).departmentCode === selDeptObj.code);
        
        let matchDeptName = false;
        if (selDeptObj && emp.departmentName) {
          const normEmpDept = ExcelImportService.normalizeString(emp.departmentName);
          const normSelDept = ExcelImportService.normalizeString(selDeptObj.name);
          
          if (normEmpDept === normSelDept || normEmpDept.includes(normSelDept) || normSelDept.includes(normEmpDept)) {
            matchDeptName = true;
          } else {
            // Kiểm tra theo mã trạm khu vực nếu là Trạm Khu Vực (T_KV1 -> T_KV9)
            const kvMatch = selDeptObj.id.match(/^T_KV(\d+)$/);
            if (kvMatch) {
              const kvNum = kvMatch[1];
              if (
                normEmpDept.includes(`khu vuc ${kvNum}`) || 
                normEmpDept.includes(`kv ${kvNum}`) || 
                normEmpDept.includes(`kv${kvNum}`) ||
                normEmpDept.includes(`khuvuc ${kvNum}`) ||
                normEmpDept.includes(`khu vuc${kvNum}`) ||
                (kvNum === '3' && (normEmpDept.includes('hoc mon') || normEmpDept.includes('kv 3') || normEmpDept.includes('kv3'))) ||
                (kvNum === '2' && normEmpDept.includes('cu chi')) ||
                (kvNum === '4' && (normEmpDept.includes('binh chanh') || normEmpDept.includes('nha be'))) ||
                (kvNum === '5' && normEmpDept.includes('can gio')) ||
                (kvNum === '6' && normEmpDept.includes('thu duc'))
              ) {
                matchDeptName = true;
              }
            } else {
              // Thử khớp thông minh bằng matchDepartment
              const matched = ExcelImportService.matchDepartment(emp.departmentName, departments);
              if (matched && matched.id === selDeptObj.id) {
                matchDeptName = true;
              }
            }
          }
        }
        if (!matchDeptId && !matchDeptCode && !matchDeptName) return false;
      }

      // 4. Lọc theo Chức vụ / Vị trí
      if (selectedPosition !== 'ALL') {
        if (!emp.positionTitle || !emp.positionTitle.toLowerCase().includes(selectedPosition.toLowerCase())) {
          return false;
        }
      }

      // 5. Lọc theo Loại nhân sự
      if (selectedStaffType !== 'ALL') {
        const empStaffType = (emp.staffType || '').toLowerCase();
        const targetStaffType = selectedStaffType.toLowerCase();
        if (targetStaffType === 'công chức') {
          if (!empStaffType.includes('công chức')) return false;
        } else if (targetStaffType === 'viên chức') {
          if (!empStaffType.includes('viên chức')) return false;
        } else if (targetStaffType === 'hợp đồng 111') {
          if (!empStaffType.includes('111') && !empStaffType.includes('68')) return false;
        } else if (targetStaffType === 'nhân viên thú y px') {
          if (!empStaffType.includes('thú y px') && !empStaffType.includes('px')) return false;
        } else if (targetStaffType === 'khoán chuyên môn') {
          if (!empStaffType.includes('khoán') && !empStaffType.includes('chuyên môn')) return false;
        } else if (targetStaffType === 'khác') {
          const isKnown = empStaffType.includes('công chức') || 
                          empStaffType.includes('viên chức') || 
                          empStaffType.includes('111') || 
                          empStaffType.includes('68') || 
                          empStaffType.includes('thú y px') || 
                          empStaffType.includes('px') || 
                          empStaffType.includes('khoán');
          if (isKnown && emp.staffType !== 'Khác') return false;
        } else {
          if (emp.staffType !== selectedStaffType) return false;
        }
      }

      // 6. Tìm kiếm từ khóa tự do
      if (searchTerm.trim() !== '') {
        const q = searchTerm.trim().toLowerCase();
        const matchName = emp.fullName ? emp.fullName.toLowerCase().includes(q) : false;
        const matchCode = emp.code ? emp.code.toLowerCase().includes(q) : false;
        const matchCccd = emp.cccd ? emp.cccd.includes(q) : false;
        const matchDept = emp.departmentName ? emp.departmentName.toLowerCase().includes(q) : false;
        const matchPos = emp.positionTitle ? emp.positionTitle.toLowerCase().includes(q) : false;
        const matchPhone = emp.phone ? emp.phone.includes(q) : false;
        const matchEmail = emp.email ? emp.email.toLowerCase().includes(q) : false;

        if (!matchName && !matchCode && !matchCccd && !matchDept && !matchPos && !matchPhone && !matchEmail) {
          return false;
        }
      }

      return true;
    });

    // Sắp xếp ưu tiên: Chi cục Trưởng -> Phó Chi Cục Trưởng -> Trưởng trạm -> Phó Trưởng Trạm -> Công chức -> Viên chức -> Hợp đồng 111
    return sortEmployeesByPriority(filtered);
  }, [uniqueEmployees, statusTab, selectedWorkStatus, selectedDept, selectedPosition, selectedStaffType, searchTerm, departments]);

  // Xử lý nút xóa: CHỈ DUY NHẤT Cấp 1 – Admin mới được phép xóa hồ sơ cán bộ gốc
  const handleDeleteClick = (emp: Employee) => {
    if (!isAdmin) {
      showToast('Chỉ tài khoản Cấp 1 – Admin mới được phép xóa hồ sơ cán bộ. Cấp 3 – HR không có quyền xóa.', 'error');
      return;
    }
    setConfirmDeleteEmployee(emp);
  };

  // Xác nhận xóa thực tế trong modal
  const executeDeleteEmployee = () => {
    if (!isAdmin) {
      showToast('Từ chối thao tác: Chỉ Cấp 1 – Admin mới có quyền xóa dữ liệu.', 'error');
      return;
    }
    if (!confirmDeleteEmployee || !onDeleteEmployee) return;
    const target = confirmDeleteEmployee;
    setConfirmDeleteEmployee(null);
    onDeleteEmployee(target.id);
    showToast(`Đã xóa vĩnh viễn hồ sơ cán bộ: ${target.fullName} (${target.code}) khỏi cơ sở dữ liệu.`);
  };

  // Xử lý nút sửa: Cả Cấp 1 – Admin và Cấp 3 – HR đều được quyền sửa/cập nhật thông tin cán bộ
  const handleEditClick = (emp: Employee) => {
    if (!isCanEdit) {
      showToast('Chỉ tài khoản Cấp 1 – Admin và Cấp 3 – HR mới có quyền chỉnh sửa dữ liệu hồ sơ.', 'error');
      return;
    }
    onEditEmployee(emp);
  };

  // Xuất file Excel
  const exportToExcel = () => {
    const data = filteredEmployees.map((emp, idx) => ({
      'STT': idx + 1,
      'Mã Nhân Viên': emp.code,
      'Họ Và Tên': emp.fullName,
      'Giới Tính': emp.gender,
      'Ngày Sinh': formatDateVN(emp.dob),
      'Số CCCD': emp.cccd,
      'Đơn Vị / Phòng / Trạm': emp.departmentName,
      'Chức Vụ': emp.positionTitle,
      'Ngạch Công Chức': `${emp.jobRankCode} - ${emp.jobRankName}`,
      'Loại Nhân Sự': emp.staffType,
      'Bậc Lương': emp.salary.step,
      'Hệ Số Lương': formatDecimal(emp.salary.coefficient, 2),
      'Mức Lương Cơ Sở (VNĐ)': parseBaseSalary(emp.salary.baseSalary, DEFAULT_BASE_SALARY),
      'Phụ Cấp Chức Vụ': formatPCCV(emp.salary.leadershipAllowance),
      'Phụ Cấp Ưu Đãi Ngành (%)': formatPercentAllowance(emp.salary.industryAllowancePercent, 10),
      'Phụ Cấp Công Vụ (%)': formatPercentAllowance(emp.salary.publicServiceAllowancePercent, 25),
      'Trình Độ': emp.education.highestDegree,
      'Chuyên Ngành': emp.education.major,
      'Lý Luận Chính Trị': emp.education.politicalTheory,
      'Chứng Chỉ Thú Y': emp.education.veterinaryCert || 'Không',
      'Số Điện Thoại': emp.phone,
      'Email': emp.email,
      'Trạng Thái': emp.status,
      'Ngày Bắt Đầu Nghỉ (Nghỉ Hưu / Thôi Việc)': formatDateVN(emp.leaveDate),
      'Số Quyết Định Nghỉ': emp.leaveDecisionNumber || '',
      'Lý Do Nghỉ': emp.leaveReason || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachNhanSu');
    XLSX.writeFile(wb, `DS_NhanSu_ChiCucThuY_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Đã truy xuất và xuất file Excel thành công!');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto text-xs">
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

      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-sky-600" />
              <span>QUẢN LÝ HỒ SƠ & DANH SÁCH NHÂN SỰ</span>
            </h2>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isAdmin ? 'bg-purple-100 text-purple-800 border-purple-200' :
              (currentUser?.role === 'HR' ? 'bg-teal-100 text-teal-800 border-teal-200' :
               (currentUser?.role === 'MANAGER' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-slate-100 text-slate-700 border-slate-300'))
            }`}>
              {isAdmin ? '🛡️ Cấp 1 – Admin (Toàn quyền)' :
               (currentUser?.role === 'HR' ? '📋 Cấp 3 – HR (Quản lý Nhân sự - Không được xóa)' :
                (currentUser?.role === 'MANAGER' ? '👔 Cấp 2 – Manager (Lãnh đạo Chi cục)' : '👤 Cấp 4 – Staff (Cơ sở)'))}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cơ sở dữ liệu: "Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự" &bull; Đã tự động lọc bỏ các bản ghi trùng lặp
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Tìm kiếm truy xuất nhanh trong nội dung file Drive */}
          {onOpenQuickSearchModal && (
            <button
              onClick={onOpenQuickSearchModal}
              className="bg-indigo-700 hover:bg-indigo-800 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              title="Tìm kiếm truy xuất nhanh bên trong nội dung file PDF, Excel, văn bản trong 3 thư mục Drive"
            >
              <FolderSearch className="w-4 h-4 text-indigo-200" />
              <span>Tìm Trong File Drive</span>
            </button>
          )}

          {/* Nút Tải lại từ Google Sheets */}
          {onRefreshFromSheets && (
            <button
              onClick={onRefreshFromSheets}
              disabled={isRefreshingSheets}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1.5"
              title="Tải lại trực tiếp từ Google Sheets Cơ sở dữ liệu Quản lý Nhân sự"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSheets ? 'animate-spin' : ''}`} />
              <span>{isRefreshingSheets ? 'Đang đọc Sheet...' : 'Tải Từ Google Sheets'}</span>
            </button>
          )}

          {/* Thêm mới nhân sự (Cho phép cả Admin lẫn User thêm mới dữ liệu) - Hiển thị 3D màu xanh lá cây */}
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-900/25 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
            title="Thêm mới hồ sơ cán bộ nhân sự vào Chi cục"
          >
            <Plus className="w-4 h-4 text-emerald-100" />
            <span>Thêm Mới Nhân Sự</span>
          </button>

          {/* Truy xuất dữ liệu ra file Excel */}
          <button
            onClick={exportToExcel}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            title="Truy xuất dữ liệu và tải file Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={onOpenSyncSheets}
            className="bg-emerald-800 hover:bg-emerald-900 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Đồng Bộ Sheets</span>
          </button>
        </div>
      </div>

      {/* Tabs: Mặc định hiển thị TẤT CẢ cán bộ nhân viên trong cơ sở dữ liệu */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => {
              setStatusTab('ALL');
              setSelectedWorkStatus('ALL');
            }}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              statusTab === 'ALL'
                ? 'border-sky-600 text-sky-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Tất cả cán bộ (Toàn bộ CSDL)</span>
            <span className="bg-sky-100 text-sky-800 px-2 py-0.2 rounded-full text-[10px] font-bold">
              {uniqueEmployees.length}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('ACTIVE');
              setSelectedWorkStatus('ALL');
            }}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              statusTab === 'ACTIVE'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Đang công tác</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full text-[10px] font-bold">
              {uniqueEmployees.filter(e => e.status === 'Đang công tác').length}
            </span>
          </button>

          <button
            onClick={() => {
              setStatusTab('ARCHIVED');
              setSelectedWorkStatus('ALL');
            }}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              statusTab === 'ARCHIVED'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Hồ sơ đã nghỉ hưu / chuyển công tác (Lưu trữ)</span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full text-[10px] font-bold">
              {uniqueEmployees.filter(e => e.status !== 'Đang công tác').length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block shrink-0 pl-2">
          Hiển thị <span className="font-bold text-sky-700">{filteredEmployees.length}</span> / {uniqueEmployees.length} hồ sơ hợp lệ
        </div>
      </div>

      {/* Filter Toolbar Nâng Cao Đa Tiêu Chí */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>BỘ LỌC TÌM KIẾM NHÂN SỰ</span>
            <span className="text-[11px] font-normal text-slate-500 hidden md:inline">
              (Lọc theo Đơn vị, Chức vụ, Trạng thái công tác, Loại nhân sự)
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-sky-700 hover:text-sky-900 hover:bg-sky-50 px-2.5 py-1 rounded-lg transition flex items-center gap-1 text-[11px] font-semibold border border-sky-200"
              title="Đặt lại tất cả các điều kiện lọc về mặc định (Hiển thị tất cả)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc (Hiển thị tất cả)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* 1. Tìm kiếm tổng hợp */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên cán bộ, CCCD, Mã NV, SĐT, Email..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-7 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. Lọc theo Đơn vị / Phòng / Trạm */}
          <div className="sm:col-span-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white font-medium"
            >
              <option value="ALL">🏢 Tất cả Đơn vị / Phòng / Trạm ({departments.length})</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Lọc theo Chức vụ */}
          <div className="sm:col-span-2">
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white font-medium"
            >
              <option value="ALL">👔 Tất cả Chức vụ</option>
              {uniquePositions.map(pos => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Lọc theo Trạng thái công tác */}
          <div className="sm:col-span-3">
            <select
              value={selectedWorkStatus}
              onChange={(e) => setSelectedWorkStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white font-medium"
            >
              <option value="ALL">📌 Tất cả Trạng thái công tác</option>
              <option value="Đang công tác">🟢 Đang công tác</option>
              <option value="Nghỉ hưu">🟡 Nghỉ hưu (Đã hoàn thành)</option>
              <option value="Chuyển công tác">🔵 Chuyển công tác</option>
              <option value="Thôi việc">⚪ Thôi việc</option>
              <option value="Nghỉ không lương / Tạm hoãn">🟠 Nghỉ không lương / Tạm hoãn</option>
              <option value="Biệt phái">🟣 Biệt phái</option>
            </select>
          </div>
        </div>

        {/* Bộ lọc phụ: Loại nhân sự */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-600">Loại nhân sự:</span>
            {['ALL', 'Công chức', 'Viên chức', 'Hợp đồng 111', 'Nhân viên Thú y PX', 'Khoán chuyên môn', 'Khác'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStaffType(st)}
                className={`px-2.5 py-0.5 rounded-full border transition ${
                  selectedStaffType === st
                    ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                {st === 'ALL' ? 'Tất cả' : st}
              </button>
            ))}
          </div>

          <div className="text-slate-500">
            Kết quả: <span className="font-bold text-sky-700">{filteredEmployees.length}</span> / {uniqueEmployees.length} cán bộ
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3">Cán Bộ / Mã Nhân Sự</th>
                <th className="py-3 px-3">Đơn Vị Trực Thuộc</th>
                <th className="py-3 px-3">Chức Vụ / Vị Trí</th>
                <th className="py-3 px-3">Ngạch / Bậc Lương</th>
                <th className="py-3 px-3">Trình Độ Chuyên Môn</th>
                <th className="py-3 px-3">Tài Liệu Drive</th>
                {/* CỘT TRẠNG THÁI: RỘNG ĐẦY ĐỦ ĐỂ KHÔNG BỊ CẮT CHỮ */}
                <th className="py-3 px-3 text-center min-w-[140px] whitespace-nowrap">Trạng Thái</th>
                <th className="py-3 px-3 text-right min-w-[130px] whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-slate-700 text-sm">
                        {uniqueEmployees.length === 0
                          ? 'Cơ sở dữ liệu nhân sự hiện đang trống (0 cán bộ)'
                          : 'Không tìm thấy hồ sơ cán bộ nào khớp với bộ lọc hiện tại'}
                      </div>

                      {uniqueEmployees.length === 0 && (
                        <div className="space-y-3 pt-1">
                          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                            Dữ liệu nhân sự trên thiết bị này chưa được tải về. Bấm nút dưới đây để kết nối và nạp danh sách cán bộ từ Google Sheets (trang tính <strong>DS_NhanSu</strong>):
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            {onRefreshFromSheets && (
                              <button
                                onClick={onRefreshFromSheets}
                                disabled={isRefreshingSheets}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${isRefreshingSheets ? 'animate-spin' : ''}`} />
                                <span>{isRefreshingSheets ? 'Đang đọc dữ liệu Google Sheets...' : '📥 Tải Dữ Liệu Nhân Sự Từ Google Sheets'}</span>
                              </button>
                            )}
                            {onOpenSyncSheets && (
                              <button
                                onClick={onOpenSyncSheets}
                                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center gap-2 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>Mở Trung Tâm Đồng Bộ Sheets</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {hasActiveFilters && uniqueEmployees.length > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Xóa bộ lọc & Hiển thị tất cả ({uniqueEmployees.length} cán bộ)</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-sky-50/50 transition">
                    {/* Name + Code */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-sky-200">
                          {emp.avatarUrl ? (
                            <img src={emp.avatarUrl} alt={emp.fullName} className="w-full h-full object-cover" />
                          ) : (
                            emp.fullName.charAt(0)
                          )}
                        </div>
                        <div>
                          <div 
                            onClick={() => onSelectEmployee(emp)}
                            className="font-bold text-slate-900 hover:text-sky-600 cursor-pointer flex items-center gap-1.5 group"
                            title="Nhấp để mở xem Hồ sơ điện tử"
                          >
                            <span className="group-hover:underline decoration-sky-400">{emp.fullName}</span>
                            <span className="text-[9px] text-sky-700 bg-sky-50 group-hover:bg-sky-100 px-1 rounded font-semibold border border-sky-200 transition">
                              Hồ sơ
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-sky-700 bg-sky-50 inline-block px-1 rounded border border-sky-200 mt-0.5">
                            {emp.code}
                          </div>
                          <div className="text-[10px] text-slate-400">CCCD: {emp.cccd}</div>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{emp.departmentName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Mã: {emp.departmentId}</div>
                    </td>

                    {/* Position */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{emp.positionTitle}</div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 border ${
                        emp.staffType === 'Công chức' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        emp.staffType === 'Viên chức' ? 'bg-teal-100 text-teal-800 border-teal-200' :
                        emp.staffType === 'Hợp đồng 111' || emp.staffType === 'Hợp đồng 68/111' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                        emp.staffType === 'Nhân viên Thú y PX' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                        emp.staffType === 'Khoán chuyên môn' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {emp.staffType}
                      </span>
                    </td>

                    {/* Salary & Rank */}
                    <td className="py-2.5 px-3">
                      <div className="text-slate-800 font-medium">
                        Ngạch: <span className="font-semibold">{emp.jobRankCode}</span>
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        Bậc {emp.salary.step} &bull; Hệ số: <span className="font-bold text-sky-700">{formatDecimal(emp.salary.coefficient, 2)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Lương CS: <span className="text-slate-700 font-semibold">{formatBaseSalary(emp.salary.baseSalary)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 font-medium border border-sky-200" title="Phụ cấp chức vụ lãnh đạo (Định dạng Decimal)">
                          PCCV: <strong className="font-mono">{formatPCCV(emp.salary.leadershipAllowance)}</strong>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200" title="Phụ cấp ưu đãi ngành">
                          ƯĐ: {formatPercentAllowance(emp.salary.industryAllowancePercent, 10)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200" title="Phụ cấp công vụ">
                          CVụ: {formatPercentAllowance(emp.salary.publicServiceAllowancePercent, 25)}
                        </span>
                      </div>
                    </td>

                    {/* Education */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">
                        {emp.education.highestDegree} - {emp.education.major}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        LLCT: <span className="font-medium">{emp.education.politicalTheory}</span>
                      </div>
                    </td>

                    {/* Google Drive Status */}
                    <td className="py-2.5 px-3">
                      {emp.documents && emp.documents.length > 0 ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>{emp.documents.length} tệp Drive</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Chưa đính kèm</span>
                      )}
                    </td>

                    {/* CỘT TRẠNG THÁI: HIỂN THỊ ĐẦY ĐỦ NỘI DUNG RÕ RÀNG */}
                    <td className="py-2.5 px-3 text-center min-w-[140px] whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border shadow-2xs ${
                        emp.status === 'Đang công tác' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                        emp.status === 'Nghỉ hưu' ? 'bg-amber-50 text-amber-800 border-amber-300' :
                        emp.status === 'Chuyển công tác' ? 'bg-blue-50 text-blue-800 border-blue-300' :
                        emp.status === 'Thôi việc' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                        emp.status === 'Nghỉ không lương / Tạm hoãn' ? 'bg-orange-50 text-orange-800 border-orange-300' :
                        emp.status === 'Biệt phái' ? 'bg-purple-50 text-purple-800 border-purple-300' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {emp.status}
                      </span>
                      {emp.leaveDate && (
                        <div className="text-[10px] text-amber-900 mt-1 font-semibold flex items-center justify-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <span>🏖️</span>
                          <span>Nghỉ từ: {formatDateVN(emp.leaveDate)}</span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right min-w-[130px] whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectEmployee(emp)}
                          title="Mở xem chi tiết Hồ sơ điện tử (Modal 6 Tab)"
                          className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center gap-1 shrink-0 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Hồ Sơ</span>
                        </button>

                        {/* Nút sửa (Cấp 1 – Admin & Cấp 3 – HR) */}
                        <button
                          onClick={() => handleEditClick(emp)}
                          title={isCanEdit ? "Chỉnh sửa thông tin hồ sơ" : "Chỉ Cấp 1 – Admin và Cấp 3 – HR mới có quyền sửa dữ liệu"}
                          className={`p-1.5 rounded-lg border transition ${
                            isCanEdit 
                              ? 'hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer' 
                              : 'text-slate-300 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onOpenMovementModal(emp)}
                          title="Lập quyết định điều động / bổ nhiệm"
                          className="p-1.5 hover:bg-blue-50 text-blue-700 rounded-lg border border-blue-200 transition cursor-pointer"
                        >
                          <Briefcase className="w-4 h-4" />
                        </button>

                        {/* Nút biểu tượng in mẫu 2C (Bộ Nội Vụ / BTC Trung Ương) */}
                        <button
                          onClick={() => setPrintingEmployee(emp)}
                          title="In hồ sơ & Sơ yếu lý lịch mẫu 2C (Mẫu 2C-BNV/2008, 2C/TCTW-98, Trích ngang)"
                          className="p-1.5 hover:bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:border-emerald-400 transition cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Nút xóa thùng rác (CHỈ DUY NHẤT Cấp 1 – Admin mới hiển thị và có quyền xóa) */}
                        {onDeleteEmployee && isAdmin && (
                          <button
                            onClick={() => handleDeleteClick(emp)}
                            title="Xóa hồ sơ cán bộ này (Chỉ Cấp 1 – Admin có quyền xóa)"
                            className="p-1.5 rounded-lg border hover:bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Xác Nhận Xóa Hồ Sơ Cán Bộ (XÓA DỮ LIỆU - Thay thế hoàn toàn window.confirm) */}
      {confirmDeleteEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-xs">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Xác Nhận Xóa Hồ Sơ Cán Bộ</h3>
              </div>
              <button 
                onClick={() => setConfirmDeleteEmployee(null)} 
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ của cán bộ sau khỏi cơ sở dữ liệu?
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{confirmDeleteEmployee.fullName}</div>
                <div className="font-mono text-sky-800 text-xs">Mã nhân sự: {confirmDeleteEmployee.code}</div>
                <div className="text-slate-600">CCCD: {confirmDeleteEmployee.cccd}</div>
                <div className="text-slate-600">{confirmDeleteEmployee.positionTitle} &bull; {confirmDeleteEmployee.departmentName}</div>
                <div className="text-[11px] text-rose-700 font-semibold mt-1">
                  Trạng thái: {confirmDeleteEmployee.status}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Lưu ý: Thao tác này sẽ xóa hồ sơ khỏi danh sách hiển thị và lưu vết vào Nhật ký hệ thống (Audit Log).
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEmployee(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeDeleteEmployee}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xác Nhận Xóa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal In Hồ Sơ Mẫu 2C (Bộ Nội Vụ / BTC Trung Ương / Trích ngang) khi bấm biểu tượng in */}
      <ProfilePrint2CModal
        isOpen={!!printingEmployee}
        onClose={() => setPrintingEmployee(null)}
        employee={printingEmployee}
      />
    </div>
  );
};
