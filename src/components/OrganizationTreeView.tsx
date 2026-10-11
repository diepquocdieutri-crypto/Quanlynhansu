import React, { useState } from 'react';
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  CheckCircle2, 
  ShieldCheck, 
  Download,
  FileSpreadsheet,
  Award,
  UserCheck,
  X,
  Plus,
  PlusCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Department, Employee } from '../types/hrm';
import { 
  getEmployeesOfDepartment, 
  isLeadershipEmployee, 
  getLeadershipRankWeight, 
  sortEmployeesByPriority,
  resolveDepartmentLeaderName, 
  resolveDepartmentDeputyLeaderName 
} from '../utils/leadershipUtils';

interface OrganizationTreeViewProps {
  departments: Department[];
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  onFilterByDepartment: (deptId: string) => void;
  onManageDepartments?: () => void;
  onOpenAddEmployee?: () => void;
  onOpenAddDepartment?: () => void;
}

export const OrganizationTreeView: React.FC<OrganizationTreeViewProps> = ({
  departments,
  employees,
  onSelectEmployee,
  onFilterByDepartment,
  onManageDepartments,
  onOpenAddEmployee,
  onOpenAddDepartment,
}) => {
  const [selectedDeptId, setSelectedDeptId] = useState<string>('BAN_LANH_DAO');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'ROOT': true,
    'PHONG_CHUYEN_MON': true,
    'TRAM_THU_Y': true,
    'TRAM_KIEM_DICH': true,
    'TRUNG_TAM': true,
  });

  // Modal export nhân viên có chọn lọc
  const [isExportStaffModalOpen, setIsExportStaffModalOpen] = useState(false);
  const [exportDeptFilter, setExportDeptFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  const selectedDept = departments.find(d => d.id === selectedDeptId) || departments[0] || {
    id: 'BAN_LANH_DAO',
    code: 'BLD',
    name: 'Ban Lãnh đạo Chi cục',
    type: 'BAN_LANH_DAO',
    leaderName: '',
    deputyLeaderName: '',
    address: '',
    phone: '',
    email: '',
    allocatedQuota: 0,
    status: 'Đang hoạt động'
  };

  const deptEmployees = sortEmployeesByPriority(getEmployeesOfDepartment(employees, selectedDept.id));

  // Phân nhóm đơn vị theo loại
  const banLanhDao = departments.filter(d => d.type === 'BAN_LANH_DAO');
  const phongChuyenMon = departments.filter(d => d.type === 'PHONG_CHUYEN_MON');
  const tramThuY = departments.filter(d => d.type === 'TRAM_THU_Y');
  const tramKiemDich = departments.filter(d => d.type === 'TRAM_KIEM_DICH');
  const trungTam = departments.filter(d => d.type === 'TRUNG_TAM');

  const getStaffCount = (deptId: string) => {
    return getEmployeesOfDepartment(employees, deptId).length;
  };

  // Xuất file Excel danh sách nhân viên (có biểu tượng chọn)
  const handleExportStaffExcel = (targetDeptId: string = exportDeptFilter) => {
    const rawList = targetDeptId === 'ALL'
      ? employees
      : employees.filter(e => e.departmentId === targetDeptId);

    if (rawList.length === 0) {
      showToast('Không có nhân sự nào trong danh sách được chọn.');
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
        'Phòng Ban / Trạm': dept?.name || emp.departmentId,
        'Chức Vụ': emp.positionTitle,
        'Phân Loại': emp.staffType,
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

  // Xuất file Excel danh sách lãnh đạo lấy trực tiếp từ DS_NhanSu (Chi cục trưởng, Trưởng trạm, Phó trưởng trạm, Phụ trách đơn vị...)
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

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-sky-600" />
            <span>CƠ CẤU TỔ CHỨC CHI CỤC CHĂN NUÔI & THÚ Y TP.HCM</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sơ đồ hình cây {departments.length} đơn vị trực thuộc &bull; Cơ cấu tổ chức & lãnh đạo đơn vị
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-3 bg-sky-50 px-3.5 py-2 rounded-xl border border-sky-200">
            <div>
              <span className="text-slate-500">Biên chế thực tế:</span>{' '}
              <span className="font-bold text-sky-900 text-sm">
                {employees.length} nhân sự
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500">Tổng đơn vị:</span>{' '}
              <span className="font-bold text-sky-900 text-sm">{departments.length} đơn vị</span>
            </div>
          </div>

          {/* Nút Thêm Mới Nhân Sự - Hiển thị 3D màu xanh lá cây */}
          {onOpenAddEmployee && (
            <button
              onClick={onOpenAddEmployee}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-900/25 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Thêm mới hồ sơ cán bộ nhân sự vào Chi cục"
            >
              <PlusCircle className="w-4 h-4 text-emerald-100" />
              <span>Thêm Mới Nhân Sự</span>
            </button>
          )}

          {/* Nút Thêm Mới Đơn Vị - Hiển thị 3D màu xanh lá cây */}
          {onOpenAddDepartment && (
            <button
              onClick={onOpenAddDepartment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-b from-teal-500 via-teal-600 to-teal-700 hover:from-teal-400 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-900/25 border-b-[3px] border-teal-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Thêm mới phòng chuyên môn, trạm thú y hoặc đơn vị trực thuộc"
            >
              <Plus className="w-4 h-4 text-teal-100" />
              <span>Thêm Đơn Vị Mới</span>
            </button>
          )}

          <button
            onClick={() => setIsExportStaffModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-xl border border-sky-200 transition shadow-2xs"
            title="Kết xuất danh sách nhân viên ra Excel (có chọn lọc)"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            <span>Xuất DS Nhân Viên (Chọn)</span>
          </button>

          <button
            onClick={handleExportLeadersExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-xl border border-amber-200 transition shadow-2xs"
            title="Kết xuất danh sách lãnh đạo phòng ban đơn vị"
          >
            <Award className="w-4 h-4 text-amber-600" />
            <span>Xuất DS Lãnh Đạo</span>
          </button>

          {onManageDepartments && (
            <button
              onClick={onManageDepartments}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition"
            >
              <Building2 className="w-4 h-4" />
              <span>Quản lý Danh mục</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column: Left Org Tree, Right Detail Card & Staff List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Col: Interactive Organization Tree */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs select-none">
          <div className="font-bold text-slate-800 pb-3 mb-3 border-b border-slate-100 flex items-center justify-between">
            <span>SƠ ĐỒ CÂY TỔ CHỨC</span>
          </div>

          <div className="space-y-2">
            {/* Root: Chi cục */}
            <div className="bg-sky-900 text-white p-2.5 rounded-lg flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-300" />
                <span>CHI CỤC CHĂN NUÔI VÀ THÚ Y TPHCM</span>
              </div>
              <span className="bg-sky-700 text-[10px] px-2 py-0.5 rounded">Gốc</span>
            </div>

            {/* Level 1: Ban Lãnh đạo Chi cục */}
            <div className="pl-3 border-l-2 border-sky-200 space-y-1 mt-2">
              {banLanhDao.map(dept => {
                const count = getStaffCount(dept.id);
                return (
                  <div
                    key={dept.id}
                    onClick={() => setSelectedDeptId(dept.id)}
                    className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                      selectedDeptId === dept.id
                        ? 'bg-sky-100 text-sky-900 font-bold border border-sky-300 shadow-sm'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sky-600" />
                      <span>{dept.name}</span>
                    </div>
                    <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                      {count} NS
                    </span>
                  </div>
                );
              })}

              {/* Group: Các Phòng Chuyên Môn */}
              <div className="pt-2">
                <div
                  onClick={() => toggleNode('PHONG_CHUYEN_MON')}
                  className="font-bold text-slate-700 py-1.5 px-2 hover:bg-slate-100 rounded cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 text-sky-800">
                    {expandedNodes['PHONG_CHUYEN_MON'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>KHỐI PHÒNG CHUYÊN MÔN</span>
                  </div>
                </div>

                {expandedNodes['PHONG_CHUYEN_MON'] && (
                  <div className="pl-4 border-l border-slate-200 space-y-1 mt-1">
                    {phongChuyenMon.map(dept => {
                      const count = getStaffCount(dept.id);
                      return (
                        <div
                          key={dept.id}
                          onClick={() => setSelectedDeptId(dept.id)}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                            selectedDeptId === dept.id
                              ? 'bg-sky-100 text-sky-900 font-bold border border-sky-300 shadow-sm'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{dept.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                            {count} NS
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group: Các Trạm Khu Vực */}
              <div className="pt-2">
                <div
                  onClick={() => toggleNode('TRAM_THU_Y')}
                  className="font-bold text-slate-700 py-1.5 px-2 hover:bg-slate-100 rounded cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 text-teal-800">
                    {expandedNodes['TRAM_THU_Y'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>KHỐI TRẠM CHĂN NUÔI & THÚ Y</span>
                  </div>
                </div>

                {expandedNodes['TRAM_THU_Y'] && (
                  <div className="pl-4 border-l border-slate-200 space-y-1 mt-1">
                    {tramThuY.map(dept => {
                      const count = getStaffCount(dept.id);
                      return (
                        <div
                          key={dept.id}
                          onClick={() => setSelectedDeptId(dept.id)}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                            selectedDeptId === dept.id
                              ? 'bg-teal-100 text-teal-900 font-bold border border-teal-300 shadow-sm'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{dept.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                            {count} NS
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group: Các Trạm Kiểm Dịch Động Vật */}
              <div className="pt-2">
                <div
                  onClick={() => toggleNode('TRAM_KIEM_DICH')}
                  className="font-bold text-slate-700 py-1.5 px-2 hover:bg-slate-100 rounded cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5 text-indigo-800">
                    {expandedNodes['TRAM_KIEM_DICH'] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <span>KHỐI TRẠM KIỂM DỊCH ĐỘNG VẬT</span>
                  </div>
                </div>

                {expandedNodes['TRAM_KIEM_DICH'] && (
                  <div className="pl-4 border-l border-slate-200 space-y-1 mt-1">
                    {tramKiemDich.map(dept => {
                      const count = getStaffCount(dept.id);
                      return (
                        <div
                          key={dept.id}
                          onClick={() => setSelectedDeptId(dept.id)}
                          className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                            selectedDeptId === dept.id
                              ? 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-300 shadow-sm'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="truncate">{dept.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                            {count} NS
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group: Trung Tâm Xét Nghiệm */}
              <div className="pt-2">
                {trungTam.map(dept => {
                  const count = getStaffCount(dept.id);
                  return (
                    <div
                      key={dept.id}
                      onClick={() => setSelectedDeptId(dept.id)}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition ${
                        selectedDeptId === dept.id
                          ? 'bg-purple-100 text-purple-900 font-bold border border-purple-300 shadow-sm'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <span className="font-semibold">{dept.name}</span>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                        {count} NS
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

        {/* Right Col: Selected Department Dossier & Attached Staff */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Department Info Card (Không khóa, hiển thị trực tiếp từ CSDL, không hiện liên hệ) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  Hồ Sơ Đơn Vị &bull; Mã: {selectedDept.code}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">{selectedDept.name}</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{selectedDept.status}</span>
                </span>
                <button
                  onClick={() => onFilterByDepartment(selectedDept.id)}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Xem danh sách nhân sự
                </button>
              </div>
            </div>

            {/* Leadership & Staff Grid (Chỉ lấy biên chế thực tế, bỏ chỉ tiêu) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-medium">Người đứng đầu (Trưởng đơn vị):</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {resolveDepartmentLeaderName(selectedDept, employees) || 'Chưa kiện toàn'}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 font-medium">Cấp phó đơn vị:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {resolveDepartmentDeputyLeaderName(selectedDept, employees) || 'Chưa kiện toàn'}
                </div>
              </div>

              <div className="bg-sky-50/70 p-3 rounded-lg border border-sky-200">
                <span className="text-sky-700 font-medium">Biên chế thực tế hiện có:</span>
                <div className="font-black text-sky-950 text-base mt-0.5">
                  {deptEmployees.length} <span className="text-xs font-normal text-slate-500">nhân sự</span>
                </div>
              </div>
            </div>
          </div>

          {/* Staff currently in this department */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3 text-xs">
            <div className="font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <span>DANH SÁCH NHÂN SỰ ĐANG CÔNG TÁC ({deptEmployees.length})</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(Ưu tiên: Lãnh đạo &rarr; CC &rarr; VC &rarr; HĐ 111)</span>
              </span>
              {onOpenAddEmployee && (
                <button
                  onClick={onOpenAddEmployee}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-[11px] rounded-lg shadow-sm shadow-emerald-900/25 border-b-2 border-emerald-800 active:border-b-0 active:translate-y-[2px] transition-all cursor-pointer transform hover:-translate-y-0.5"
                  title="Thêm mới hồ sơ cán bộ nhân sự"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm Mới</span>
                </button>
              )}
            </div>

            {deptEmployees.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                Chưa có hồ sơ nhân sự phân bổ cho đơn vị này trên hệ thống.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {deptEmployees.map(emp => {
                  const posLower = (emp.positionTitle || '').toLowerCase();
                  const isCCT = posLower.includes('chi cục trưởng') && !posLower.includes('phó');
                  const isPCCT = posLower.includes('phó chi cục') || posLower.includes('chi cục phó');
                  const isTruong = (posLower.includes('trưởng trạm') || posLower.includes('trưởng phòng') || posLower.includes('phụ trách')) && !posLower.includes('phó');
                  const isPho = posLower.includes('phó') && !isPCCT;

                  return (
                    <div
                      key={emp.id}
                      onClick={() => onSelectEmployee(emp)}
                      className="p-2.5 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold overflow-hidden border border-sky-200 shrink-0">
                          {emp.avatarUrl ? (
                            <img src={emp.avatarUrl} alt={emp.fullName} className="w-full h-full object-cover" />
                          ) : (
                            emp.fullName.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{emp.fullName}</span>
                            {isCCT && (
                              <span className="text-[10px] bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 rounded-full font-bold">
                                Chi cục Trưởng
                              </span>
                            )}
                            {isPCCT && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-full font-bold">
                                Phó Chi cục Trưởng
                              </span>
                            )}
                            {isTruong && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 border border-sky-200 px-1.5 py-0.2 rounded-full font-semibold">
                                {emp.positionTitle}
                              </span>
                            )}
                            {isPho && (
                              <span className="text-[10px] bg-cyan-100 text-cyan-800 border border-cyan-200 px-1.5 py-0.2 rounded-full font-semibold">
                                {emp.positionTitle}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {emp.positionTitle} &bull; Mã: <span className="font-mono">{emp.code}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                          Bậc {emp.salary?.step || 1} ({emp.salary?.coefficient || 2.34})
                        </span>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {emp.staffType || 'Công chức'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Modal Xuất Danh Sách Nhân Viên Có Biểu Tượng Chọn */}
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
                  <p className="text-[11px] text-sky-200">Chọn phòng ban cần xuất hoặc xuất toàn chi cục</p>
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
                  className="w-full px-3 py-2.5 border border-slate-300 bg-white rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="ALL">
                    -- Toàn bộ Chi cục ({employees.length} cán bộ, nhân sự) --
                  </option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({getStaffCount(d.id)} nhân sự thực tế)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Số lượng hồ sơ sẽ xuất:</span>
                  <span className="font-black text-sky-900 text-sm">
                    {exportDeptFilter === 'ALL' ? employees.length : getStaffCount(exportDeptFilter)} nhân sự
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  File Excel (.xlsx) bao gồm các trường thông tin: Mã NV, Họ tên, Giới tính, Ngày sinh, CCCD, Phòng ban/Trạm, Chức vụ, Bậc/Hệ số lương, PCCV, Trình độ chuyên môn, Trạng thái.
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
