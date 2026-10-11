import React, { useState, useMemo } from 'react';
import { 
  UserMinus, 
  Calendar, 
  FileSpreadsheet, 
  Download, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Filter, 
  Search, 
  Building2, 
  ChevronRight, 
  PlusCircle, 
  Users,
  ShieldCheck,
  Award,
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { Employee, Department } from '../types/hrm';
import { formatDateVN } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface RetirementTrackingSectionProps {
  employees: Employee[];
  departments: Department[];
  onSelectEmployee: (emp: Employee) => void;
  onOpenAddModal: () => void;
  onNavigateTab: (tabId: string) => void;
}

// Danh sách cán bộ nghỉ hưu / thôi việc mẫu đã được xóa sạch để chỉ hiển thị dữ liệu thực tế từ CSDL
const DEMO_RETIRED_RESIGNED_STAFF: Partial<Employee>[] = [];

export const RetirementTrackingSection: React.FC<RetirementTrackingSectionProps> = ({
  employees,
  departments,
  onSelectEmployee,
  onOpenAddModal,
  onNavigateTab,
}) => {
  // Bộ lọc năm theo dõi (Mặc định năm 2026)
  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr === '2026' ? '2026' : currentYearStr);

  // Tab con trong mục theo dõi: ALL | RETIRED | RESIGNED | UPCOMING
  const [activeSubTab, setActiveSubTab] = useState<'ALL' | 'RETIRED' | 'RESIGNED' | 'UPCOMING'>('ALL');

  // Tìm kiếm & Lọc đơn vị
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');

  // Danh sách các năm để người dùng lựa chọn
  const availableYears = ['2026', '2025', '2024', 'ALL'];

  // 1. Lọc cán bộ đã nghỉ hưu trong năm
  const realRetiredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (e.status !== 'Nghỉ hưu' && !e.leaveDate) return false;
      if (e.status === 'Nghỉ hưu') {
        if (selectedYear === 'ALL') return true;
        if (e.leaveDate && e.leaveDate.includes(selectedYear)) return true;
        // Nếu không có leaveDate nhưng là Nghỉ hưu
        return !e.leaveDate;
      }
      return false;
    });
  }, [employees, selectedYear]);

  // 2. Lọc cán bộ nghỉ thôi việc trong năm
  const realResignedEmployees = useMemo(() => {
    return employees.filter(e => {
      if (e.status !== 'Thôi việc') return false;
      if (selectedYear === 'ALL') return true;
      if (e.leaveDate && e.leaveDate.includes(selectedYear)) return true;
      return !e.leaveDate;
    });
  }, [employees, selectedYear]);

  // 3. Cán bộ sắp đến tuổi nghỉ hưu trong năm (theo quy định tuổi nghỉ hưu: Nam 61-62, Nữ 56-57)
  const upcomingRetirees = useMemo(() => {
    const yr = selectedYear === 'ALL' ? parseInt(currentYearStr, 10) : parseInt(selectedYear, 10);
    return employees.filter(e => {
      if (e.status !== 'Đang công tác') return false;
      const birthYear = parseInt(e.dob?.split('-')[0] || '1970', 10);
      const age = yr - birthYear;
      return (e.gender === 'Nam' && age >= 61) || (e.gender === 'Nữ' && age >= 56);
    });
  }, [employees, selectedYear, currentYearStr]);

  // Kiểm tra có dữ liệu thực tế hay sử dụng dữ liệu định biên chuẩn tham khảo
  const hasRealLeavingData = realRetiredEmployees.length > 0 || realResignedEmployees.length > 0;

  // Tổng hợp danh sách hiển thị
  const displayRetiredList: (Employee | Partial<Employee>)[] = useMemo(() => {
    if (hasRealLeavingData) return realRetiredEmployees;
    // Fallback sang demo nếu CSDL chưa nhập cán bộ nghỉ trong năm
    if (selectedYear === '2026' || selectedYear === 'ALL') {
      return DEMO_RETIRED_RESIGNED_STAFF.filter(s => s.status === 'Nghỉ hưu');
    }
    return [];
  }, [hasRealLeavingData, realRetiredEmployees, selectedYear]);

  const displayResignedList: (Employee | Partial<Employee>)[] = useMemo(() => {
    if (hasRealLeavingData) return realResignedEmployees;
    if (selectedYear === '2026' || selectedYear === 'ALL') {
      return DEMO_RETIRED_RESIGNED_STAFF.filter(s => s.status === 'Thôi việc');
    }
    return [];
  }, [hasRealLeavingData, realResignedEmployees, selectedYear]);

  const totalRetiredCount = displayRetiredList.length;
  const totalResignedCount = displayResignedList.length;
  const totalLeavingCount = totalRetiredCount + totalResignedCount;

  // Lọc danh sách theo Tab con, từ khóa và phòng ban
  const filteredList = useMemo(() => {
    let baseList: (Employee | Partial<Employee>)[] = [];

    if (activeSubTab === 'ALL') {
      baseList = [...displayRetiredList, ...displayResignedList];
    } else if (activeSubTab === 'RETIRED') {
      baseList = displayRetiredList;
    } else if (activeSubTab === 'RESIGNED') {
      baseList = displayResignedList;
    } else if (activeSubTab === 'UPCOMING') {
      baseList = upcomingRetirees;
    }

    return baseList.filter(item => {
      if (filterDept !== 'ALL') {
        const matchesDept = (item as any).departmentId === filterDept || item.departmentName?.includes(filterDept);
        if (!matchesDept) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        const mName = item.fullName?.toLowerCase().includes(q);
        const mCode = item.code?.toLowerCase().includes(q);
        const mPos = item.positionTitle?.toLowerCase().includes(q);
        const mDept = item.departmentName?.toLowerCase().includes(q);
        const mDec = item.leaveDecisionNumber?.toLowerCase().includes(q);
        return mName || mCode || mPos || mDept || mDec;
      }
      return true;
    });
  }, [activeSubTab, displayRetiredList, displayResignedList, upcomingRetirees, filterDept, searchQuery]);

  // Xuất file Excel báo cáo
  const handleExportExcel = () => {
    const data = filteredList.map((item, idx) => ({
      'STT': idx + 1,
      'Mã Nhân Viên': item.code || '',
      'Họ Và Tên': item.fullName || '',
      'Giới Tính': item.gender || '',
      'Ngày Sinh': formatDateVN(item.dob),
      'Đơn Vị / Phòng / Trạm': item.departmentName || '',
      'Chức Vụ': item.positionTitle || '',
      'Loại Nhân Sự': item.staffType || '',
      'Phân Loại': activeSubTab === 'UPCOMING' ? 'Dự kiến đến tuổi nghỉ hưu' : (item.status === 'Nghỉ hưu' ? 'Nghỉ hưu' : 'Thôi việc'),
      'Ngày Bắt Đầu Nghỉ': formatDateVN(item.leaveDate) || (activeSubTab === 'UPCOMING' ? 'Dự kiến trong năm' : 'Chưa cập nhật'),
      'Số Quyết Định': item.leaveDecisionNumber || '',
      'Lý Do Nghỉ': item.leaveReason || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `NghiHuu_ThoiViec_${selectedYear}`);
    XLSX.writeFile(wb, `BaoCao_NghiHuu_ThoiViec_ChiCucThuY_Nam${selectedYear}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
      {/* Header của Khối Theo Dõi */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <UserMinus className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                  THEO DÕI CÁN BỘ NGHỈ HƯU & NGHỈ THÔI VIỆC TRONG NĂM
                </h3>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Năm {selectedYear === 'ALL' ? 'Toàn bộ' : selectedYear}
                </span>
                {!hasRealLeavingData && (
                  <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Định biên mẫu tham khảo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ghi nhận ngày bắt đầu nghỉ, số quyết định và phân loại hồ sơ nghỉ hưu, nghỉ thôi việc phục vụ công tác báo cáo Sở Nông nghiệp & PTNT
              </p>
            </div>
          </div>
        </div>

        {/* Bộ lọc năm & Nút thao tác */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Lọc Năm */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-500">Năm theo dõi:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-bold text-sky-900 focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr === 'ALL' ? 'Tất cả các năm' : `Năm ${yr}`}
                </option>
              ))}
            </select>
          </div>

          {/* Xuất Excel */}
          <button
            onClick={handleExportExcel}
            title="Xuất danh sách cán bộ nghỉ hưu và thôi việc ra Excel"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          {/* Thêm nhân sự mới */}
          <button
            onClick={onOpenAddModal}
            title="Thêm hồ sơ nhân sự mới hoặc cập nhật trạng thái nghỉ"
            className="bg-sky-700 hover:bg-sky-800 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition flex items-center gap-1.5 active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Thêm Mới</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ Thống Kê Tổng Quan (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Tổng số người rời cơ quan */}
        <div 
          onClick={() => setActiveSubTab('ALL')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeSubTab === 'ALL'
              ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              TỔNG NGHỈ TRONG NĂM
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <TrendingDown className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-amber-950">
              {totalLeavingCount}
            </div>
            <span className="text-xs text-slate-500 font-medium">cán bộ</span>
          </div>
          <div className="text-[11px] text-amber-800 mt-1 font-medium flex items-center gap-1">
            <span>Hưu trí: {totalRetiredCount} &bull; Thôi việc: {totalResignedCount}</span>
          </div>
        </div>

        {/* Card 2: Nghỉ hưu */}
        <div 
          onClick={() => setActiveSubTab('RETIRED')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeSubTab === 'RETIRED'
              ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              🏖️ NGHỈ HƯU
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
              <Award className="w-4 h-4 text-orange-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-orange-950">
              {totalRetiredCount}
            </div>
            <span className="text-xs text-orange-700 font-bold">
              {totalLeavingCount > 0 ? Math.round((totalRetiredCount / totalLeavingCount) * 100) : 0}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Hưởng lương hưu & chế độ BHXH
          </div>
        </div>

        {/* Card 3: Thôi việc */}
        <div 
          onClick={() => setActiveSubTab('RESIGNED')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeSubTab === 'RESIGNED'
              ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              🚪 NGHỈ THÔI VIỆC
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <UserMinus className="w-4 h-4 text-rose-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-rose-950">
              {totalResignedCount}
            </div>
            <span className="text-xs text-rose-700 font-bold">
              {totalLeavingCount > 0 ? Math.round((totalResignedCount / totalLeavingCount) * 100) : 0}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Thôi việc / Chấm dứt hợp đồng
          </div>
        </div>

        {/* Card 4: Sắp đến tuổi nghỉ hưu */}
        <div 
          onClick={() => setActiveSubTab('UPCOMING')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeSubTab === 'UPCOMING'
              ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ⏳ SẮP ĐẾN TUỔI HƯU
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 text-sky-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-black text-sky-950">
              {upcomingRetirees.length}
            </div>
            <span className="text-xs text-sky-700 font-semibold">cán bộ</span>
          </div>
          <div className="text-[11px] text-sky-800 mt-1 font-medium flex items-center gap-1">
            <span>Rà soát thông báo trước 6 tháng</span>
          </div>
        </div>
      </div>

      {/* Tabs & Bộ Lọc Nhanh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        {/* Sub Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveSubTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'ALL'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>Tất cả nghỉ trong năm ({totalLeavingCount})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('RETIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'RETIRED'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🏖️ Nghỉ hưu ({totalRetiredCount})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('RESIGNED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'RESIGNED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>🚪 Nghỉ thôi việc ({totalResignedCount})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'UPCOMING'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>⏳ Sắp đến tuổi hưu ({upcomingRetirees.length})</span>
          </button>
        </div>

        {/* Tìm kiếm & Lọc đơn vị */}
        <div className="flex items-center gap-2">
          {/* Ô Tìm Kiếm */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên, mã, số QĐ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 w-44 sm:w-56"
            />
          </div>

          {/* Lọc Đơn Vị */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 max-w-[160px]"
          >
            <option value="ALL">-- Tất cả đơn vị --</option>
            {departments.map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bảng Dữ Liệu Chi Tiết */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center">STT</th>
              <th className="py-2.5 px-3 min-w-[200px]">Cán Bộ / Mã Nhân Sự</th>
              <th className="py-2.5 px-3 min-w-[180px]">Đơn Vị Trực Thuộc</th>
              <th className="py-2.5 px-3 min-w-[150px]">Chức Vụ & Loại Hình</th>
              <th className="py-2.5 px-3 text-center min-w-[120px]">Phân Loại</th>
              <th className="py-2.5 px-3 min-w-[130px] font-black text-amber-900 bg-amber-50/60">
                Ngày Bắt Đầu Nghỉ
              </th>
              <th className="py-2.5 px-3 min-w-[180px]">Quyết Định / Lý Do</th>
              <th className="py-2.5 px-3 text-right w-24">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  <div className="max-w-md mx-auto space-y-2">
                    <UserMinus className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700 text-sm">
                      Không tìm thấy cán bộ nào trong danh mục này
                    </p>
                    <p className="text-xs text-slate-400">
                      Chưa có dữ liệu ghi nhận trong năm {selectedYear} hoặc từ khóa tìm kiếm không khớp
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredList.map((emp, idx) => {
                const isUpcoming = activeSubTab === 'UPCOMING';
                const isRetired = emp.status === 'Nghỉ hưu';
                const isResigned = emp.status === 'Thôi việc';

                return (
                  <tr key={emp.id || idx} className="hover:bg-amber-50/30 transition">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>

                    {/* Họ tên & Mã NV */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0 border border-amber-200">
                          {emp.fullName?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <div 
                            onClick={() => {
                              const found = employees.find(e => e.id === emp.id || e.code === emp.code);
                              if (found) onSelectEmployee(found);
                            }}
                            className="font-bold text-slate-900 hover:text-sky-700 cursor-pointer flex items-center gap-1 group"
                          >
                            <span className="group-hover:underline">{emp.fullName}</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({emp.gender})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 rounded font-semibold">
                              {emp.code}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Sinh: {formatDateVN(emp.dob)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Đơn vị */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">
                        {emp.departmentName}
                      </div>
                    </td>

                    {/* Chức vụ & Loại hình */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">
                        {emp.positionTitle}
                      </div>
                      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 mt-0.5">
                        {emp.staffType || 'Viên chức'}
                      </span>
                    </td>

                    {/* Phân loại */}
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isUpcoming
                          ? 'bg-sky-50 text-sky-800 border-sky-300'
                          : (isRetired
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300')
                      }`}>
                        {isUpcoming ? '⏳ Sắp đến tuổi' : (isRetired ? '🏖️ Nghỉ hưu' : '🚪 Thôi việc')}
                      </span>
                    </td>

                    {/* Ngày Bắt Đầu Nghỉ */}
                    <td className="py-2.5 px-3 bg-amber-50/40">
                      {emp.leaveDate ? (
                        <div className="inline-flex items-center gap-1.5 bg-amber-100/90 text-amber-950 font-bold px-2.5 py-1 rounded-lg border border-amber-300 font-mono shadow-2xs">
                          <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>{formatDateVN(emp.leaveDate)}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          {isUpcoming ? 'Dự kiến trong năm' : 'Chưa cập nhật'}
                        </span>
                      )}
                    </td>

                    {/* Quyết định & Lý do */}
                    <td className="py-2.5 px-3">
                      {emp.leaveDecisionNumber && (
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">Số:</span>
                          <span>{emp.leaveDecisionNumber}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 italic line-clamp-1">
                        {emp.leaveReason || (isUpcoming ? 'Đến tuổi nghỉ hưu theo quy định' : 'Hưởng chế độ BHXH')}
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          const found = employees.find(e => e.id === emp.id || e.code === emp.code);
                          if (found) {
                            onSelectEmployee(found);
                          } else {
                            onNavigateTab('staff');
                          }
                        }}
                        title="Xem hồ sơ điện tử chi tiết"
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-xs transition inline-flex items-center gap-1 active:scale-95 shadow-2xs"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Hồ Sơ</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Ghi Chú & Hướng Dẫn Nghiệp Vụ */}
      <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Dữ liệu ngày bắt đầu nghỉ hưu và thôi việc được đồng bộ tự động với Google Sheets (tab <strong>DS_NhanSu</strong>) và hồ sơ điện tử.
          </span>
        </div>
        <button
          onClick={() => onNavigateTab('staff')}
          className="text-amber-800 hover:text-amber-950 font-bold underline flex items-center gap-1 shrink-0"
        >
          <span>Xem trong Danh Sách Nhân Sự</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
