import React, { useState, useMemo } from 'react';
import { 
  Cloud, 
  Folder, 
  FolderPlus, 
  Upload, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  FileImage,
  FolderOpen,
  Search,
  Filter,
  X,
  FileCheck,
  Eye,
  Download,
  Calendar,
  Layers,
  LayoutGrid,
  List,
  Building2,
  User,
  ShieldCheck,
  FileBadge
} from 'lucide-react';
import { Employee, Department, DocumentRecord } from '../types/hrm';
import { GoogleDriveService, DriveFolderInfo, ROOT_FOLDER_NAME } from '../services/googleDriveService';
import { formatDateVN } from '../utils/dateUtils';

interface DriveStorageViewProps {
  googleConnected: boolean;
  googleUserEmail?: string;
  onLoginGoogle: () => void;
  employees: Employee[];
  departments?: Department[];
  onSelectEmployee?: (emp: Employee) => void;
  onOpenQuickSearchModal?: () => void;
}

export const DriveStorageView: React.FC<DriveStorageViewProps> = ({
  googleConnected,
  googleUserEmail,
  onLoginGoogle,
  employees,
  departments = [],
  onSelectEmployee,
  onOpenQuickSearchModal,
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initResult, setInitResult] = useState<{
    rootFolder?: DriveFolderInfo;
    staffFolder?: DriveFolderInfo;
    decisionsFolder?: DriveFolderInfo;
    reportsFolder?: DriveFolderInfo;
  } | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // -------------------------------------------------------------
  // BỘ LỌC VÀ CÔNG CỤ TRA CỨU HỒ SƠ ĐIỆN TỬ
  // -------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedDocType, setSelectedDocType] = useState<string>('ALL');
  const [dossierStatusFilter, setDossierStatusFilter] = useState<'ALL' | 'HAS_DOCS' | 'NO_DOCS'>('ALL');
  const [displayMode, setDisplayMode] = useState<'FOLDER' | 'DOCUMENT'>('FOLDER');
  const [selectedEmployeePreview, setSelectedEmployeePreview] = useState<Employee | null>(null);

  // Khởi tạo cây thư mục trên Google Drive
  const handleInitStructure = async () => {
    if (!googleConnected) {
      onLoginGoogle();
      return;
    }

    try {
      setIsInitializing(true);
      setActionMessage('Đang kết nối Google Drive API và tạo cấu trúc thư mục...');

      const structure = await GoogleDriveService.initSystemDriveStructure();
      setInitResult(structure);
      setActionMessage('Khởi tạo cấu trúc thư mục Google Drive thành công!');
    } catch (err: any) {
      console.error('Lỗi khởi tạo Drive:', err);
      alert('Không thể tạo thư mục trên Google Drive: ' + err.message);
      setActionMessage(null);
    } finally {
      setIsInitializing(false);
    }
  };

  // Danh sách các phòng ban trích xuất từ dữ liệu
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.departmentName) set.add(e.departmentName);
    });
    departments.forEach(d => {
      if (d.name) set.add(d.name);
    });
    return Array.from(set).sort();
  }, [employees, departments]);

  // Bộ lọc danh sách cán bộ theo tiêu chí tìm kiếm
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return employees.filter(emp => {
      // 1. Lọc theo phòng ban
      if (selectedDept !== 'ALL' && emp.departmentName !== selectedDept) {
        return false;
      }

      // 2. Lọc theo trạng thái có tài liệu hay không
      if (dossierStatusFilter === 'HAS_DOCS' && (!emp.documents || emp.documents.length === 0)) {
        return false;
      }
      if (dossierStatusFilter === 'NO_DOCS' && emp.documents && emp.documents.length > 0) {
        return false;
      }

      // 3. Lọc theo loại tài liệu đính kèm
      if (selectedDocType !== 'ALL') {
        const hasMatchedDoc = emp.documents && emp.documents.some(d => d.type === selectedDocType);
        if (!hasMatchedDoc) return false;
      }

      // 4. Lọc theo từ khóa tra cứu (Họ tên, mã NV, CCCD, chức vụ, tên tài liệu scan)
      if (q) {
        const matchName = emp.fullName.toLowerCase().includes(q);
        const matchCode = emp.code.toLowerCase().includes(q);
        const matchCccd = emp.cccd ? emp.cccd.toLowerCase().includes(q) : false;
        const matchPosition = emp.positionTitle ? emp.positionTitle.toLowerCase().includes(q) : false;
        const matchDocTitle = emp.documents ? emp.documents.some(d => 
          d.title.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)
        ) : false;

        if (!matchName && !matchCode && !matchCccd && !matchPosition && !matchDocTitle) {
          return false;
        }
      }

      return true;
    });
  }, [employees, searchQuery, selectedDept, selectedDocType, dossierStatusFilter]);

  // Toàn bộ các file tài liệu số hóa tìm được theo điều kiện tìm kiếm (phục vụ hiển thị dạng bảng tài liệu)
  const flattenedDocuments = useMemo(() => {
    const list: {
      document: DocumentRecord;
      employee: Employee;
    }[] = [];

    const q = searchQuery.trim().toLowerCase();

    filteredEmployees.forEach(emp => {
      if (!emp.documents) return;
      emp.documents.forEach(doc => {
        if (selectedDocType !== 'ALL' && doc.type !== selectedDocType) {
          return;
        }
        if (q) {
          const matchDoc = doc.title.toLowerCase().includes(q) || doc.fileName.toLowerCase().includes(q);
          const matchEmp = emp.fullName.toLowerCase().includes(q) || emp.code.toLowerCase().includes(q);
          if (!matchDoc && !matchEmp) return;
        }
        list.push({
          document: doc,
          employee: emp,
        });
      });
    });

    return list;
  }, [filteredEmployees, selectedDocType, searchQuery]);

  // Tổng số lượng tài liệu số hóa trong toàn bộ danh sách cán bộ
  const totalDigitizedDocuments = useMemo(() => {
    return employees.reduce((acc, curr) => acc + (curr.documents?.length || 0), 0);
  }, [employees]);

  const hasActiveFilters = searchQuery !== '' || selectedDept !== 'ALL' || selectedDocType !== 'ALL' || dossierStatusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept('ALL');
    setSelectedDocType('ALL');
    setDossierStatusFilter('ALL');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Cloud className="w-6 h-6 text-emerald-600" />
            <span>HỒ SƠ ĐIỆN TỬ & LƯU TRỮ GOOGLE DRIVE DỰ ÁN</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Quản lý cây thư mục lưu trữ ảnh thẻ, scan CCCD, bằng cấp, chứng chỉ thú y và quyết định PDF trên Google Drive
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenQuickSearchModal && (
            <button
              onClick={onOpenQuickSearchModal}
              className="bg-indigo-700 hover:bg-indigo-600 text-white font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
              title="Tìm kiếm truy xuất nhanh bên trong nội dung file dữ liệu trong các thư mục Drive"
            >
              <Search className="w-4 h-4 text-indigo-200" />
              <span>Tìm Kiếm Trong File Drive</span>
            </button>
          )}

          {googleConnected ? (
            <button
              onClick={handleInitStructure}
              disabled={isInitializing}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{isInitializing ? 'Đang tạo thư mục...' : 'Khởi Tạo / Đồng Bộ Cây Thư Mục Drive'}</span>
            </button>
          ) : (
            <button
              onClick={onLoginGoogle}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              <span>Đăng nhập Google để kích hoạt Google Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Status Notice */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        googleConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
            googleConnected ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm">
              {googleConnected ? 'Đã kết nối với Google Drive của đơn vị' : 'Chưa kết nối Google Drive'}
            </div>
            <div className="text-[11px] opacity-90 mt-0.5">
              {googleConnected 
                ? `Tài khoản: ${googleUserEmail || 'Tài khoản Google công vụ'}. Toàn bộ hồ sơ được lưu an toàn.`
                : 'Đăng nhập để cấp quyền lưu trữ tệp hồ sơ nhân sự trực tiếp vào thư mục Google Drive của bạn.'}
            </div>
          </div>
        </div>

        {actionMessage && (
          <div className="bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-300 font-semibold text-emerald-800 text-xs">
            {actionMessage}
          </div>
        )}
      </div>

      {/* Drive Tree Structure Display */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b pb-3">
          <FolderOpen className="w-4 h-4 text-sky-600" />
          <span>CẤU TRÚC THƯ MỤC GOOGLE DRIVE CHUẨN CỦA CHI CỤC</span>
        </h3>

        <div className="space-y-3 font-mono text-xs">
          {/* Root Folder */}
          <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-950 font-bold">
              <Folder className="w-4 h-4 text-sky-600" />
              <span>[{ROOT_FOLDER_NAME}]</span>
            </div>
            {initResult?.rootFolder?.webViewLink && (
              <a
                href={initResult.rootFolder.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 hover:underline flex items-center gap-1 font-sans text-xs font-semibold"
              >
                <span>Mở trên Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Subfolders */}
          <div className="pl-6 border-l-2 border-slate-200 space-y-2.5">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Folder className="w-4 h-4 text-amber-500" />
                <span>01_Hồ_Sơ_Cán_Bộ_Nhân_Viên</span>
              </div>
              <span className="text-[11px] font-sans text-slate-500">Chứa các thư mục con theo từng mã nhân viên</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Folder className="w-4 h-4 text-blue-500" />
                <span>02_Văn_Bản_Quyết_Định_Tổ_Chức</span>
              </div>
              <span className="text-[11px] font-sans text-slate-500">File PDF quyết định bổ nhiệm, điều động, khen thưởng</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Folder className="w-4 h-4 text-emerald-500" />
                <span>03_Báo_Cáo_Biên_Chế_Thống_Kê</span>
              </div>
              <span className="text-[11px] font-sans text-slate-500">Báo cáo định kỳ & bảng số liệu xuất tự động</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* THƯ MỤC HỒ SƠ ĐIỆN TỬ CỦA TỪNG CÁN BỘ & CÔNG CỤ TRA CỨU */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        
        {/* Header of Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Folder className="w-4 h-4 text-sky-600" />
              <span>THƯ MỤC HỒ SƠ ĐIỆN TỬ CỦA TỪNG CÁN BỘ</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Tra cứu hồ sơ scan, bằng cấp chuyên môn thú y, scan CCCD, quyết định bổ nhiệm của từng cán bộ Chi cục
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDisplayMode('FOLDER')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition ${
                  displayMode === 'FOLDER' 
                    ? 'bg-white text-sky-800 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem dạng thư mục điện tử theo cán bộ"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thư mục cán bộ</span>
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode('DOCUMENT')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition ${
                  displayMode === 'DOCUMENT' 
                    ? 'bg-white text-sky-800 shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem danh sách chi tiết các tài liệu số hóa tìm được"
              >
                <List className="w-3.5 h-3.5" />
                <span>Bảng tài liệu tra cứu</span>
              </button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* CÔNG CỤ TRA CỨU HỒ SƠ ĐIỆN TỬ (THEO YÊU CẦU NGƯỜI DÙNG) */}
        {/* ----------------------------------------------------------- */}
        <div className="bg-gradient-to-r from-sky-50/70 via-indigo-50/40 to-slate-50 border border-sky-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-bold text-sky-950 flex items-center gap-2 text-xs uppercase tracking-wide">
              <Search className="w-4 h-4 text-sky-600" />
              <span>CÔNG CỤ TRA CỨU & TÌM KIẾM HỒ SƠ ĐIỆN TỬ</span>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 hover:underline"
              >
                <X className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>

          {/* Search Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input Box */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Nhập tên cán bộ, mã NV, CCCD hoặc tên tệp tài liệu..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-800"
              >
                <option value="ALL">-- Tất cả phòng ban / đơn vị --</option>
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Document Type Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedDocType}
                onChange={e => setSelectedDocType(e.target.value)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-800"
              >
                <option value="ALL">-- Loại tài liệu --</option>
                <option value="CCCD">Scan CCCD</option>
                <option value="Sơ yếu lý lịch 2C">Sơ yếu lý lịch 2C</option>
                <option value="Bằng tốt nghiệp">Bằng tốt nghiệp</option>
                <option value="Chứng chỉ thú y">Chứng chỉ thú y</option>
                <option value="Quyết định bổ nhiệm">Quyết định bổ nhiệm</option>
                <option value="Quyết định nâng lương">Quyết định nâng lương</option>
                <option value="Hợp đồng">Hợp đồng lao động</option>
                <option value="Khác">Tài liệu khác</option>
              </select>
            </div>

            {/* Dossier Attached Status */}
            <div className="sm:col-span-2">
              <select
                value={dossierStatusFilter}
                onChange={e => setDossierStatusFilter(e.target.value as any)}
                className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-800"
              >
                <option value="ALL">-- Trạng thái tệp --</option>
                <option value="HAS_DOCS">Có tệp đính kèm</option>
                <option value="NO_DOCS">Chưa có tệp đính kèm</option>
              </select>
            </div>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-600 border-t border-sky-100">
            <div className="flex items-center gap-3">
              <span>
                Tìm thấy: <strong className="text-sky-900 font-bold">{filteredEmployees.length}</strong> cán bộ
              </span>
              <span>&bull;</span>
              <span>
                Tài liệu số hóa: <strong className="text-indigo-900 font-bold">{flattenedDocuments.length}</strong> tệp
              </span>
              <span>&bull;</span>
              <span>
                Tổng toàn Chi cục: <strong>{employees.length}</strong> cán bộ ({totalDigitizedDocuments} tệp đã số hóa)
              </span>
            </div>

            {searchQuery && (
              <span className="bg-sky-100/80 text-sky-800 px-2 py-0.5 rounded text-[10px] font-medium">
                Từ khóa: &ldquo;{searchQuery}&rdquo;
              </span>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* VIEW 1: THƯ MỤC CÁN BỘ (FOLDER VIEW) */}
        {/* ----------------------------------------------------------- */}
        {displayMode === 'FOLDER' && (
          <div>
            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <FolderOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <div className="font-semibold text-slate-600 text-sm">Không tìm thấy hồ sơ cán bộ phù hợp</div>
                <p className="text-xs text-slate-400 mt-1">
                  Thử tìm kiếm với từ khóa khác hoặc bấm &ldquo;Đặt lại bộ lọc&rdquo;.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {filteredEmployees.map(emp => {
                  const docCount = emp.documents?.length || 0;

                  return (
                    <div
                      key={emp.id}
                      className="p-3.5 bg-slate-50 hover:bg-sky-50/80 rounded-xl border border-slate-200 hover:border-sky-300 transition flex flex-col justify-between shadow-xs group"
                    >
                      <div>
                        {/* Folder Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition">
                              <Folder className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                                {emp.fullName}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[10px] text-sky-800 font-semibold bg-sky-100/60 px-1.5 py-0.2 rounded">
                                  {emp.code}
                                </span>
                                {emp.cccd && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    CCCD: {emp.cccd}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            docCount > 0 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {docCount} tệp
                          </span>
                        </div>

                        {/* Dept & Position */}
                        <div className="mt-2.5 space-y-0.5 text-[11px] text-slate-600">
                          <div className="truncate flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{emp.departmentName}</span>
                          </div>
                          <div className="truncate font-medium text-slate-800 pl-5">
                            {emp.positionTitle}
                          </div>
                        </div>

                        {/* Document list tags if any */}
                        {docCount > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/70 space-y-1">
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">Tệp trong thư mục:</div>
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {emp.documents.map((doc, idx) => (
                                <div 
                                  key={doc.id || idx}
                                  className="flex items-center justify-between text-[10px] bg-white p-1 rounded border border-slate-200 text-slate-700"
                                >
                                  <span className="truncate max-w-[150px]" title={doc.title}>
                                    &bull; {doc.title}
                                  </span>
                                  {doc.driveViewLink ? (
                                    <a
                                      href={doc.driveViewLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-sky-600 hover:text-sky-800 font-semibold shrink-0"
                                    >
                                      Xem
                                    </a>
                                  ) : (
                                    <span className="text-[9px] text-slate-400">PDF/Ảnh</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                        {onSelectEmployee ? (
                          <button
                            type="button"
                            onClick={() => onSelectEmployee(emp)}
                            className="text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Mở hồ sơ</span>
                          </button>
                        ) : (
                          <span className="text-slate-500">Cập nhật: {formatDateVN(emp.updatedAt)}</span>
                        )}

                        {emp.driveFolderLink ? (
                          <a
                            href={emp.driveFolderLink}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-sky-100/80 hover:bg-sky-200 text-sky-800 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition text-[10px]"
                          >
                            <span>Mở Drive</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">
                            {googleConnected ? 'Chưa đồng bộ Drive' : 'Đăng nhập Drive'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* VIEW 2: BẢNG DANH SÁCH TÀI LIỆU TRA CỨU (DOCUMENT TABLE) */}
        {/* ----------------------------------------------------------- */}
        {displayMode === 'DOCUMENT' && (
          <div className="space-y-3">
            {flattenedDocuments.length === 0 ? (
              <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <div className="font-semibold text-slate-600 text-sm">Không tìm thấy tài liệu số hóa nào phù hợp</div>
                <p className="text-xs text-slate-400 mt-1">
                  Chưa có tệp scan hoặc không khớp với từ khóa tìm kiếm.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3">Tên Tài Liệu / Văn Bản Scan</th>
                      <th className="p-3">Phân Loại Hồ Sơ</th>
                      <th className="p-3">Cán Bộ Sở Hữu</th>
                      <th className="p-3">Đơn Vị / Phòng / Trạm</th>
                      <th className="p-3 text-center">Ngày Lưu (dd/mm/yyyy)</th>
                      <th className="p-3 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {flattenedDocuments.map((item, index) => {
                      const { document: doc, employee: emp } = item;

                      return (
                        <tr key={doc.id || index} className="hover:bg-sky-50/50 transition">
                          <td className="p-3 text-center font-mono text-slate-500">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                              <div>
                                <div className="font-bold text-slate-900">{doc.title}</div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {doc.fileName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="bg-sky-100 text-sky-800 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block">
                              {doc.type}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{emp.fullName}</div>
                            <div className="text-[10px] text-sky-800 font-mono mt-0.5">{emp.code}</div>
                          </td>
                          <td className="p-3 text-slate-700">
                            <div>{emp.departmentName}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{emp.positionTitle}</div>
                          </td>
                          <td className="p-3 text-center font-mono text-slate-700">
                            {formatDateVN(doc.uploadedAt || emp.updatedAt)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {doc.driveViewLink ? (
                                <a
                                  href={doc.driveViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-sky-50 text-sky-700 hover:bg-sky-100 p-1.5 rounded-lg border border-sky-200 transition"
                                  title="Mở tài liệu trên Google Drive"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onSelectEmployee && onSelectEmployee(emp)}
                                  className="bg-slate-50 text-slate-700 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition"
                                  title="Xem trong chi tiết hồ sơ cán bộ"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
