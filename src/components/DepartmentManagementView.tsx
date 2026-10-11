import React, { useState } from 'react';
import { 
  Building2, 
  PlusCircle, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  RotateCcw, 
  X, 
  ShieldCheck, 
  Layers,
  ChevronRight,
  Info,
  ExternalLink,
  FileSpreadsheet,
  UserCheck,
  Award,
  CheckSquare
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Department, DepartmentType, Employee } from '../types/hrm';
import { AuthPermissionService } from '../services/authPermissionService';
import { 
  getEmployeesOfDepartment, 
  isLeadershipEmployee, 
  getLeadershipRankWeight, 
  sortEmployeesByPriority,
  resolveDepartmentLeaderName, 
  resolveDepartmentDeputyLeaderName 
} from '../utils/leadershipUtils';

interface DepartmentManagementViewProps {
  departments: Department[];
  employees: Employee[];
  currentUser?: any;
  onAddDepartment: (dept: Department) => void;
  onUpdateDepartment: (dept: Department, oldId?: string) => void;
  onDeleteDepartment: (deptId: string, reassignDeptId?: string) => void;
  onResetDepartments: () => void;
  onViewDepartmentStaff: (deptId: string) => void;
}

const DEPARTMENT_TYPE_LABELS: Record<DepartmentType, { label: string; color: string; badgeBg: string }> = {
  BAN_LANH_DAO: { 
    label: 'Ban Lãnh đạo', 
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeBg: 'bg-amber-100 text-amber-800'
  },
  PHONG_CHUYEN_MON: { 
    label: 'Phòng Chuyên môn', 
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeBg: 'bg-blue-100 text-blue-800'
  },
  TRAM_THU_Y: { 
    label: 'Trạm Chăn nuôi & Thú y', 
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-100 text-emerald-800'
  },
  TRAM_KIEM_DICH: { 
    label: 'Trạm Kiểm dịch Động vật', 
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeBg: 'bg-purple-100 text-purple-800'
  },
  TRUNG_TAM: { 
    label: 'Trung tâm Xét nghiệm / Sự nghiệp', 
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    badgeBg: 'bg-rose-100 text-rose-800'
  }
};

export const DepartmentManagementView: React.FC<DepartmentManagementViewProps> = ({
  departments,
  employees,
  currentUser,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onResetDepartments,
  onViewDepartmentStaff,
}) => {
  const isAdmin = AuthPermissionService.isUserAdmin(currentUser);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [originalDeptId, setOriginalDeptId] = useState<string>('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [reassignDeptId, setReassignDeptId] = useState<string>('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Xuất file Excel nhân viên có biểu tượng chọn
  const [isExportStaffModalOpen, setIsExportStaffModalOpen] = useState(false);
  const [exportDeptFilter, setExportDeptFilter] = useState('ALL');

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<DepartmentType>('PHONG_CHUYEN_MON');
  const [formLeaderName, setFormLeaderName] = useState('');
  const [formDeputyLeaderName, setFormDeputyLeaderName] = useState('');
  const [formAllocatedQuota, setFormAllocatedQuota] = useState<number>(10);
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'Đang hoạt động' | 'Tạm dừng'>('Đang hoạt động');
  const [formError, setFormError] = useState('');

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper count employees by department (Chi cục Trưởng & Phó Chi cục Trưởng tính vào Ban Lãnh đạo)
  const getEmployeeCount = (deptId: string) => {
    return getEmployeesOfDepartment(employees, deptId).length;
  };

  // Filtered departments
  const filteredDepartments = departments.filter(d => {
    if (filterType !== 'ALL' && d.type !== filterType) return false;
    if (filterStatus !== 'ALL' && d.status !== filterStatus) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match = 
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.leaderName.toLowerCase().includes(q) ||
        (d.deputyLeaderName && d.deputyLeaderName.toLowerCase().includes(q)) ||
        d.address.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        d.email.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Calculate totals
  const totalAllocatedQuota = departments.reduce((sum, d) => sum + (d.allocatedQuota || 0), 0);
  const totalActualStaff = employees.length;

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingDepartment(null);
    setOriginalDeptId('');
    setFormCode('');
    setFormName('');
    setFormType('PHONG_CHUYEN_MON');
    setFormLeaderName('');
    setFormDeputyLeaderName('');
    setFormAllocatedQuota(10);
    setFormAddress('151 Lý Thường Kiệt, P.7, Q.11, TP.HCM');
    setFormPhone('(028) 3855 ');
    setFormEmail('@tphcm.gov.vn');
    setFormStatus('Đang hoạt động');
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (dept: Department) => {
    setEditingDepartment(dept);
    setOriginalDeptId(dept.id);
    setFormCode(dept.code);
    setFormName(dept.name);
    setFormType(dept.type);
    setFormLeaderName(dept.leaderName);
    setFormDeputyLeaderName(dept.deputyLeaderName || '');
    setFormAllocatedQuota(dept.allocatedQuota || 0);
    setFormAddress(dept.address);
    setFormPhone(dept.phone);
    setFormEmail(dept.email);
    setFormStatus(dept.status);
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) {
      setFormError('Vui lòng nhập Mã phòng / đơn vị (ví dụ: P_HCTH, T_KV1,...)');
      return;
    }
    if (!formName.trim()) {
      setFormError('Vui lòng nhập Tên phòng / đơn vị đầy đủ');
      return;
    }

    const cleanCode = formCode.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanId = cleanCode;

    // Check duplicate code / id
    if (!editingDepartment) {
      const exists = departments.some(d => d.id === cleanId || d.code.toUpperCase() === cleanCode);
      if (exists) {
        setFormError(`Mã đơn vị "${cleanCode}" đã tồn tại trên hệ thống. Vui lòng chọn mã khác.`);
        return;
      }
    } else {
      // In edit mode, check if code changed to an existing code of another dept
      const exists = departments.some(d => d.id !== originalDeptId && (d.id === cleanId || d.code.toUpperCase() === cleanCode));
      if (exists) {
        setFormError(`Mã đơn vị "${cleanCode}" đã được sử dụng bởi một đơn vị khác.`);
        return;
      }
    }

    const payload: Department = {
      id: editingDepartment ? editingDepartment.id : cleanId,
      code: cleanCode,
      name: formName.trim(),
      type: formType,
      leaderName: formLeaderName.trim() || 'Chưa phân công',
      deputyLeaderName: formDeputyLeaderName.trim(),
      allocatedQuota: Number(formAllocatedQuota) || 0,
      address: formAddress.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      status: formStatus,
    };

    if (editingDepartment) {
      onUpdateDepartment(payload, originalDeptId);
      showToast(`Đã cập nhật thông tin phòng/đơn vị: ${payload.name}`);
    } else {
      onAddDepartment(payload);
      showToast(`Đã thêm mới phòng/đơn vị: ${payload.name}`);
    }

    setIsEditModalOpen(false);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (dept: Department) => {
    setDepartmentToDelete(dept);
    // Find alternative department for reassignment if needed
    const alternatives = departments.filter(d => d.id !== dept.id);
    setReassignDeptId(alternatives[0]?.id || '');
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!departmentToDelete) return;
    const staffCount = getEmployeeCount(departmentToDelete.id);

    onDeleteDepartment(departmentToDelete.id, staffCount > 0 ? reassignDeptId : undefined);
    showToast(`Đã xóa phòng/đơn vị "${departmentToDelete.name}" thành công.`);
    setIsDeleteModalOpen(false);
    setDepartmentToDelete(null);
  };

  // 1. Xuất danh mục phòng ban (chỉ lấy biên chế thực tế, bỏ chỉ tiêu, không hiển thị liên hệ)
  const handleExportExcel = () => {
    const data = departments.map((d, index) => {
      const staffInDept = getEmployeesOfDepartment(employees, d.id);
      const leaderName = resolveDepartmentLeaderName(d, employees);
      const deputyName = resolveDepartmentDeputyLeaderName(d, employees);

      return {
        'STT': index + 1,
        'Mã Đơn Vị': d.code,
        'Tên Phòng / Đơn Vị': d.name,
        'Phân Loại': DEPARTMENT_TYPE_LABELS[d.type]?.label || d.type,
        'Trưởng Đơn Vị': leaderName || 'Chưa kiện toàn',
        'Phó Đơn Vị': deputyName || 'Chưa kiện toàn',
        'Biên Chế Thực Tế': staffInDept.length,
        'Trạng Thái': d.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DanhMuc_PhongBan');
    XLSX.writeFile(workbook, `Danh_Muc_Phong_Don_Vi_CCTY_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Đã xuất danh mục Phòng/Đơn vị ra file Excel thành công.');
  };

  // 2. Xuất danh sách nhân sự (có tùy chọn theo đơn vị hoặc toàn chi cục)
  const handleExportStaffExcel = (targetDeptId: string = exportDeptFilter) => {
    const rawList = targetDeptId === 'ALL' 
      ? employees 
      : getEmployeesOfDepartment(employees, targetDeptId);

    if (rawList.length === 0) {
      showToast('Không có nhân sự nào trong danh sách được chọn để xuất.');
      return;
    }

    // Sắp xếp ưu tiên: Chi cục Trưởng -> Phó Chi Cục Trưởng -> Trưởng trạm -> Phó Trưởng Trạm -> Công chức -> Viên chức -> Hợp đồng 111
    const listToExport = sortEmployeesByPriority(rawList);

    const data = listToExport.map((emp, idx) => {
      const dept = departments.find(d => d.id === emp.departmentId);
      return {
        'STT': idx + 1,
        'Mã Nhân Viên': emp.code,
        'Họ và Tên': emp.fullName,
        'Giới Tính': emp.gender,
        'Ngày Sinh': emp.dob,
        'Số CCCD': emp.cccd,
        'Phòng Ban / Trạm': dept?.name || emp.departmentName,
        'Chức Vụ': emp.positionTitle,
        'Loại Nhân Sự': emp.staffType,
        'Ngạch Lương': emp.salary?.rankName || emp.salary?.rankCode || '',
        'Bậc Lương': emp.salary?.step || 1,
        'Hệ Số Lương': emp.salary?.coefficient || 2.34,
        'Phụ Cấp Chức Vụ': emp.salary?.leadershipAllowance || 0,
        'Trình Độ': emp.education?.highestDegree || '',
        'Chuyên Ngành': emp.education?.major || '',
        'Trạng Thái Công Tác': emp.status || 'Đang công tác',
      };
    });

    const targetDeptName = targetDeptId === 'ALL' ? 'Toan_Chi_Cuc' : (departments.find(d => d.id === targetDeptId)?.code || targetDeptId);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_NhanSu');
    XLSX.writeFile(workbook, `Danh_Sach_Nhan_Vien_${targetDeptName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Đã xuất danh sách ${listToExport.length} nhân sự ra file Excel thành công.`);
    setIsExportStaffModalOpen(false);
  };

  // 3. Xuất danh sách lãnh đạo lấy trực tiếp từ DS_NhanSu (Chi cục trưởng, Trưởng trạm, Phó trưởng trạm, Phụ trách đơn vị...)
  const handleExportLeadersExcel = () => {
    const leaderStaff = employees.filter(emp => isLeadershipEmployee(emp));

    if (leaderStaff.length === 0) {
      showToast('Không tìm thấy cán bộ lãnh đạo nào trong DS_NhanSu.');
      return;
    }

    // Sắp xếp lãnh đạo theo chuẩn ưu tiên phân cấp Chi cục
    const sortedLeaders = sortEmployeesByPriority(leaderStaff);

    const data = sortedLeaders.map((emp, index) => {
      const dept = departments.find(d => d.id === emp.departmentId);
      return {
        'STT': index + 1,
        'Mã Nhân Sự': emp.code,
        'Họ và Tên Lãnh Đạo': emp.fullName,
        'Chức Vụ Lãnh Đạo': emp.positionTitle,
        'Đơn Vị / Phòng Ban / Trạm': dept?.name || emp.departmentName,
        'Phân Loại Nhân Sự': emp.staffType,
        'Ngạch Lương': emp.salary?.rankName || emp.salary?.rankCode || '',
        'Bậc Lương': emp.salary?.step || 1,
        'Hệ Số Lương': emp.salary?.coefficient || 2.34,
        'Phụ Cấp Chức Vụ (PCCV)': emp.salary?.leadershipAllowance || 0,
        'Trình Độ Chuyên Môn': emp.education?.highestDegree ? `${emp.education.highestDegree} - ${emp.education.major || ''}` : (emp.education?.major || ''),
        'Số Điện Thoại': emp.phone || '',
        'Email': emp.email || '',
        'Trạng Thái Công Tác': emp.status || 'Đang công tác',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DS_LanhDao');
    XLSX.writeFile(workbook, `Danh_Sach_Lanh_Dao_Chi_Cuc_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Đã xuất danh sách ${data.length} lãnh đạo Chi cục (Chi cục trưởng, Trưởng/Phó trạm, Phụ trách...) ra file Excel.`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                DANH MỤC PHÒNG, ĐƠN VỊ TRỰC THUỘC
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý thêm, sửa, xóa các phòng chuyên môn, trạm thú y khu vực & trung tâm xét nghiệm
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsExportStaffModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-xl border border-sky-200 transition shadow-xs"
            title="Kết xuất file Excel danh sách nhân viên có biểu tượng chọn"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            <span>Xuất DS Nhân Viên (Chọn)</span>
          </button>

          <button
            onClick={handleExportLeadersExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-xl border border-amber-200 transition shadow-xs"
            title="Kết xuất danh sách lãnh đạo phòng ban đơn vị ra file Excel"
          >
            <Award className="w-4 h-4 text-amber-600" />
            <span>Xuất DS Lãnh Đạo</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl border border-emerald-200 transition shadow-xs"
            title="Xuất danh mục phòng ban đơn vị ra file Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất Danh Mục</span>
          </button>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 transition"
            title="Khôi phục danh mục chuẩn 23 đơn vị"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Mặc định (23 đơn vị)</span>
          </button>

          {/* Nút Thêm Mới Phòng / Đơn Vị - Hiển thị 3D màu xanh lá cây */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-900/25 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
            title="Thêm phòng ban, trạm thú y hoặc trung tâm mới"
          >
            <PlusCircle className="w-4 h-4 text-emerald-100" />
            <span>+ Thêm Phòng, Đơn Vị Mới</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Chỉ lấy biên chế thực tế, bỏ chỉ tiêu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng Số Đơn Vị</span>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {departments.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Phòng ban & Trạm trực thuộc</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng Biên Chế Thực Tế</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-950 mt-2">
            {totalActualStaff}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Nhân sự thực tế toàn Chi cục
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đơn Vị Hoạt Động</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-2">
            {departments.filter(d => d.status === 'Đang hoạt động').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Đang vận hành thường xuyên</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cơ Cấu Tổ Chức</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xs space-y-0.5 mt-2 font-medium text-slate-700">
            <div className="flex justify-between">
              <span>Phòng chuyên môn:</span>
              <span className="font-bold text-sky-800">{departments.filter(d => d.type === 'PHONG_CHUYEN_MON').length}</span>
            </div>
            <div className="flex justify-between">
              <span>Trạm thú y & KĐ:</span>
              <span className="font-bold text-emerald-800">
                {departments.filter(d => d.type === 'TRAM_THU_Y' || d.type === 'TRAM_KIEM_DICH').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên phòng, lãnh đạo, số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Phân loại:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">-- Tất cả phân loại --</option>
              <option value="BAN_LANH_DAO">Ban Lãnh đạo</option>
              <option value="PHONG_CHUYEN_MON">Phòng Chuyên môn</option>
              <option value="TRAM_THU_Y">Trạm Chăn nuôi & Thú y</option>
              <option value="TRAM_KIEM_DICH">Trạm Kiểm dịch Động vật</option>
              <option value="TRUNG_TAM">Trung tâm Xét nghiệm</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Trạng thái:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="ALL">-- Tất cả trạng thái --</option>
              <option value="Đang hoạt động">Đang hoạt động</option>
              <option value="Tạm dừng">Tạm dừng</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded text-xs font-semibold ${
                viewMode === 'table' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bảng biểu
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2 py-1 rounded text-xs font-semibold ${
                viewMode === 'cards' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Dạng thẻ
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredDepartments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">Không tìm thấy phòng/đơn vị phù hợp</h3>
          <p className="text-xs text-slate-400 mt-1">
            Vui lòng thử điều chỉnh lại từ khóa tìm kiếm hoặc các tiêu chí bộ lọc.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('ALL');
              setFilterStatus('ALL');
            }}
            className="mt-4 px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold text-xs rounded-xl transition"
          >
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold tracking-wider uppercase text-[11px]">
                  <th className="py-3 px-3 w-10 text-center">STT</th>
                  <th className="py-3 px-3 w-28">Mã Đơn Vị</th>
                  <th className="py-3 px-3 min-w-[220px]">Tên Phòng, Đơn Vị</th>
                  <th className="py-3 px-3 min-w-[150px]">Phân Loại</th>
                  <th className="py-3 px-3 min-w-[200px]">Lãnh Đạo Đơn Vị</th>
                  <th className="py-3 px-3 min-w-[140px] text-center">Biên Chế Thực Tế</th>
                  <th className="py-3 px-3 w-28 text-center">Trạng Thái</th>
                  <th className="py-3 px-3 w-32 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepartments.map((dept, idx) => {
                  const staffCount = getEmployeeCount(dept.id);
                  const typeMeta = DEPARTMENT_TYPE_LABELS[dept.type] || {
                    label: dept.type,
                    color: 'text-slate-700 bg-slate-50 border-slate-200',
                    badgeBg: 'bg-slate-100 text-slate-800'
                  };

                  return (
                    <tr 
                      key={dept.id} 
                      className="hover:bg-sky-50/40 transition group"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          {dept.code}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 group-hover:text-sky-700 text-sm transition">
                          {dept.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          ID: <span className="font-mono">{dept.id}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">
                          <span className="text-slate-400 font-normal">Trưởng:</span>{' '}
                          <span className="font-bold text-slate-900">
                            {resolveDepartmentLeaderName(dept, employees) || 'Chưa phân công'}
                          </span>
                        </div>
                        {resolveDepartmentDeputyLeaderName(dept, employees) && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            <span className="text-slate-400">Phó:</span>{' '}
                            <span>{resolveDepartmentDeputyLeaderName(dept, employees)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-black text-slate-900 text-sm">{staffCount}</span>
                          <span className="text-slate-500 font-medium">nhân sự</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          dept.status === 'Đang hoạt động' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dept.status === 'Đang hoạt động' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {dept.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewDepartmentStaff(dept.id)}
                            title={`Xem ${staffCount} nhân sự trực thuộc`}
                            className="p-1.5 bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 rounded-lg transition"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(dept)}
                            title="Chỉnh sửa thông tin phòng/đơn vị"
                            className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-lg transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (!isAdmin) {
                                showToast('Chỉ tài khoản Admin - Toàn quyền mới có quyền xóa phòng/đơn vị.');
                                return;
                              }
                              handleOpenDeleteModal(dept);
                            }}
                            disabled={!isAdmin}
                            title={isAdmin ? "Xóa phòng/đơn vị (Admin - Toàn quyền)" : "Chỉ Admin mới có quyền xóa phòng/đơn vị"}
                            className={`p-1.5 rounded-lg transition ${
                              isAdmin
                                ? 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 cursor-pointer'
                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Hiển thị <strong>{filteredDepartments.length}</strong> / <strong>{departments.length}</strong> phòng, đơn vị</span>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.map(dept => {
            const staffCount = getEmployeeCount(dept.id);
            const typeMeta = DEPARTMENT_TYPE_LABELS[dept.type] || {
              label: dept.type,
              color: 'text-slate-700 bg-slate-50 border-slate-200',
              badgeBg: 'bg-slate-100 text-slate-800'
            };

            return (
              <div 
                key={dept.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {dept.code}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm mt-1.5">{dept.name}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${typeMeta.color} shrink-0`}>
                      {typeMeta.label}
                    </span>
                  </div>

                  <div className="py-3 space-y-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                      <div>
                        <span className="text-slate-400">Trưởng đơn vị:</span>{' '}
                        <span className="font-bold text-slate-800">
                          {resolveDepartmentLeaderName(dept, employees) || '—'}
                        </span>
                      </div>
                      {resolveDepartmentDeputyLeaderName(dept, employees) && (
                        <div>
                          <span className="text-slate-400">Phó đơn vị:</span>{' '}
                          <span className="font-medium text-slate-700">
                            {resolveDepartmentDeputyLeaderName(dept, employees)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-500 font-medium">Biên chế thực tế:</span>
                      <span className="font-black text-sky-800 text-sm">{staffCount} cán bộ</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    dept.status === 'Đang hoạt động' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dept.status === 'Đang hoạt động' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {dept.status}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onViewDepartmentStaff(dept.id)}
                      className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-lg transition flex items-center gap-1"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{staffCount} NS</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(dept)}
                      className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          showToast('Chỉ tài khoản Admin - Toàn quyền mới có quyền xóa phòng/đơn vị.');
                          return;
                        }
                        handleOpenDeleteModal(dept);
                      }}
                      disabled={!isAdmin}
                      title={isAdmin ? "Xóa phòng/đơn vị (Admin - Toàn quyền)" : "Chỉ Admin mới có quyền xóa phòng/đơn vị"}
                      className={`p-1.5 rounded-lg transition ${
                        isAdmin
                          ? 'bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 cursor-pointer'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-sky-800 to-sky-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-sky-300" />
                <h3 className="font-bold text-base">
                  {editingDepartment ? 'Chỉnh Sửa Thông Tin Phòng, Đơn Vị' : 'Thêm Mới Phòng, Đơn Vị Trực Thuộc'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mã đơn vị (Code / ID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: P_HCTH, T_KV1, TT_CDXN..."
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Mã viết hoa, không dấu, ngăn cách bằng dấu gạch dưới
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phân loại đơn vị <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as DepartmentType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none font-semibold text-slate-700"
                  >
                    <option value="PHONG_CHUYEN_MON">Phòng Chuyên môn nghiệp vụ</option>
                    <option value="TRAM_THU_Y">Trạm Chăn nuôi & Thú y Khu vực</option>
                    <option value="TRAM_KIEM_DICH">Trạm Kiểm dịch Động vật</option>
                    <option value="TRUNG_TAM">Trung tâm Xét nghiệm / Sự nghiệp</option>
                    <option value="BAN_LANH_DAO">Ban Lãnh đạo Chi cục</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên đầy đủ của Phòng, Đơn vị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Phòng Hành chính - Tổng hợp, Trạm Chăn nuôi & Thú y Khu vực 1..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Người đứng đầu (Trưởng phòng / Trưởng trạm)
                  </label>
                  <input
                    type="text"
                    placeholder="Họ và tên Trưởng đơn vị"
                    value={formLeaderName}
                    onChange={(e) => setFormLeaderName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cấp phó đơn vị (Phó phòng / Phó trạm)
                  </label>
                  <input
                    type="text"
                    placeholder="Họ và tên các Phó đơn vị (ngăn cách bằng dấu phẩy)"
                    value={formDeputyLeaderName}
                    onChange={(e) => setFormDeputyLeaderName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Chỉ tiêu biên chế được giao (Người) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formAllocatedQuota}
                    onChange={(e) => setFormAllocatedQuota(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Trạng thái hoạt động <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'Đang hoạt động' | 'Tạm dừng')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm dừng">Tạm dừng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Địa chỉ trụ sở làm việc
                </label>
                <input
                  type="text"
                  placeholder="Địa chỉ trụ sở đơn vị"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="VD: (028) 3855 ..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Hộp thư điện tử (Email)
                  </label>
                  <input
                    type="email"
                    placeholder="VD: donvi.ccty@tphcm.gov.vn"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  {editingDepartment ? 'Lưu Cập Nhật' : 'Tạo Đơn Vị Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && departmentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Xác Nhận Xóa Phòng, Đơn Vị</h3>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                Bạn đang chuẩn bị xóa phòng/đơn vị: <strong className="text-slate-900 font-bold">{departmentToDelete.name}</strong> (Mã: <span className="font-mono font-bold text-sky-800">{departmentToDelete.code}</span>).
              </p>

              {getEmployeeCount(departmentToDelete.id) > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs">
                        Đơn vị này hiện có {getEmployeeCount(departmentToDelete.id)} nhân sự trực thuộc!
                      </div>
                      <div className="text-[11px] text-amber-700 mt-1">
                        Hệ thống yêu cầu bạn chọn phòng/đơn vị mới để chuyển tiếp toàn bộ các nhân sự này trước khi tiến hành xóa:
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Chuyển {getEmployeeCount(departmentToDelete.id)} nhân sự sang đơn vị mới:
                    </label>
                    <select
                      value={reassignDeptId}
                      onChange={(e) => setReassignDeptId(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {departments
                        .filter(d => d.id !== departmentToDelete.id)
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-600 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Đơn vị hiện không có nhân sự nào trực thuộc. Hành động xóa diễn ra an toàn.</span>
                </div>
              )}

              <p className="text-slate-500 text-[11px]">
                Hành động xóa sẽ được ghi nhận vào Nhật ký hệ thống (Audit Log).
              </p>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition"
                >
                  Xác Nhận Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Khôi Phục Danh Mục 23 Đơn Vị Chuẩn */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-xs">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Khôi Phục Danh Mục 23 Đơn Vị Chuẩn</h3>
              </div>
              <button onClick={() => setIsResetConfirmOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn khôi phục danh mục 23 phòng, đơn vị trực thuộc mặc định của Chi cục Chăn nuôi và Thú y TP.HCM?
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1">
                <div className="font-bold text-amber-900">Danh mục chuẩn bao gồm:</div>
                <div className="text-[11px] text-amber-800">
                  Ban Lãnh đạo, 5 Phòng chuyên môn, 13 Trạm chăn nuôi thú y khu vực, 3 Trạm kiểm dịch động vật đầu mối & Trung tâm Chẩn đoán xét nghiệm.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsResetConfirmOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetDepartments();
                    setIsResetConfirmOpen(false);
                    showToast('Đã khôi phục danh mục 23 đơn vị chuẩn.');
                  }}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition"
                >
                  Xác Nhận Khôi Phục
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kết Xuất File Excel Danh Sách Nhân Viên Có Biểu Tượng Chọn */}
      {isExportStaffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-sky-800 to-sky-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-sky-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Kết Xuất File Excel Danh Sách Nhân Viên</h3>
                  <p className="text-[11px] text-sky-200">Chọn phạm vi xuất theo phòng ban hoặc toàn chi cục</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExportStaffModalOpen(false)} 
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-sky-600" />
                  <span>Chọn phạm vi kết xuất nhân viên:</span>
                </label>
                <select
                  value={exportDeptFilter}
                  onChange={(e) => setExportDeptFilter(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                >
                  <option value="ALL">
                    -- Toàn bộ Chi cục ({employees.length} cán bộ, nhân sự) --
                  </option>
                  {departments.map(d => {
                    const count = getEmployeeCount(d.id);
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name} ({count} nhân sự thực tế)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Số lượng hồ sơ sẽ xuất:</span>
                  <span className="font-black text-sky-900 text-sm">
                    {exportDeptFilter === 'ALL' ? employees.length : getEmployeeCount(exportDeptFilter)} nhân sự
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Dữ liệu xuất ra bảng tính Excel (.xlsx) chuẩn gồm: Mã NV, Họ tên, Giới tính, Ngày sinh, CCCD, Đơn vị, Chức vụ, Ngạch lương, Bậc, Hệ số, PCCV, Trình độ chuyên môn, Trạng thái.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExportStaffModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleExportStaffExcel(exportDeptFilter)}
                  className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition hover:shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File Excel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
