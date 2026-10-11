import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  UserPlus, 
  ExternalLink, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit3,
  Download,
  CheckCircle2, 
  AlertCircle, 
  Search, 
  FileSpreadsheet, 
  Building2,
  Clock,
  ShieldAlert,
  UserCheck,
  X,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Share2,
  Key,
  Globe
} from 'lucide-react';
import { Department, AppUser } from '../types/hrm';
import { 
  AuthPermissionService, 
  UserPermission, 
  SystemRole, 
  PERMISSION_SHEET_TAB_NAME, 
  PERMISSION_SPREADSHEET_TITLE, 
  ROOT_FOLDER_NAME 
} from '../services/authPermissionService';
import * as XLSX from 'xlsx';

interface AuthPermissionManagementViewProps {
  departments: Department[];
  currentUser?: AppUser;
  currentUserEmail?: string;
  onAddAuditLog: (action: string, targetName: string, targetCode: string, field?: string, oldVal?: string, newVal?: string, details?: string) => void;
}

export const AuthPermissionManagementView: React.FC<AuthPermissionManagementViewProps> = ({
  departments,
  currentUser,
  currentUserEmail,
  onAddAuditLog,
}) => {
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Xác định quyền hạn của người dùng đang đăng nhập (Admin - Toàn quyền)
  const emailToCheck = currentUser?.email || currentUserEmail;
  const isAdmin = AuthPermissionService.isUserAdmin(currentUser, emailToCheck);

  // Modal thêm tài khoản
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    departmentName: departments[0]?.name || 'Ban Lãnh đạo Chi cục',
    positionTitle: 'Chuyên viên',
    role: 'VIEWER' as SystemRole,
    notes: '',
  });

  // Modal chỉnh sửa quyền (Sửa dữ liệu)
  const [editingUser, setEditingUser] = useState<UserPermission | null>(null);

  // Modal xác nhận xóa (Xóa dữ liệu - thay thế window.confirm để không bao giờ bị lỗi iFrame)
  const [userToDelete, setUserToDelete] = useState<UserPermission | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Tải danh sách quyền từ Google Sheets
  const loadPermissions = async () => {
    try {
      setIsLoading(true);
      const list = await AuthPermissionService.loadPermissionsFromSheet();
      setPermissions(list);
      const sheet = await AuthPermissionService.getOrCreatePermissionSpreadsheet();
      setSpreadsheetUrl(sheet.url);
      setSpreadsheetId(sheet.id);
    } catch (err: any) {
      console.error('Lỗi tải danh sách quyền:', err);
      setPermissions(AuthPermissionService.getLocalPermissions());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  // Tạo đường link triển khai chuẩn cho cán bộ (tự động chuyển ais-dev- sang ais-pre- để tránh lỗi Google 403)
  const getPublicShareLink = () => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const path = window.location.pathname;
    return spreadsheetId 
      ? `${origin}${path}?permSheetId=${spreadsheetId}`
      : `${origin}${path}`;
  };

  // Sao chép link triển khai gửi cho cán bộ đăng nhập
  const handleCopyDeploymentLink = async () => {
    try {
      const link = getPublicShareLink();
      await navigator.clipboard.writeText(link);
      setIsCopied(true);
      showToast('Đã sao chép đường link đăng nhập (Shared URL ais-pre-) cho cán bộ!');
      setTimeout(() => setIsCopied(false), 3000);
    } catch {
      showToast('Không thể sao chép tự động. Vui lòng copy thủ công URL trình duyệt.', 'error');
    }
  };

  // Phê duyệt tài khoản đang chờ
  const handleApprove = async (user: UserPermission) => {
    if (!isAdmin) {
      showToast('Chỉ tài khoản "Admin - Toàn quyền" mới có quyền phê duyệt.', 'error');
      return;
    }
    try {
      setActionLoading(user.email);
      const updated = await AuthPermissionService.approveUser(user.email, user.role, currentUser?.name || currentUserEmail || 'Admin Chi cục');
      setPermissions(updated);
      showToast(`Đã phê duyệt tài khoản: ${user.fullName}`);
      onAddAuditLog(
        'PHÊ_DUYỆT_ĐĂNG_NHẬP',
        user.fullName,
        user.email,
        'Trạng thái cấp quyền',
        'PENDING',
        'ACTIVE',
        `Admin đã duyệt cho phép tài khoản ${user.email} đăng nhập hệ thống với vai trò ${AuthPermissionService.getRoleLabel(user.role)}.`
      );
    } catch (err: any) {
      showToast('Lỗi phê duyệt: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Khóa / Mở khóa
  const handleToggleLock = async (user: UserPermission) => {
    if (!isAdmin) {
      showToast('Chỉ tài khoản "Admin - Toàn quyền" mới có quyền khóa/mở khóa.', 'error');
      return;
    }
    try {
      setActionLoading(user.email);
      const updated = await AuthPermissionService.toggleLockUser(user.email);
      setPermissions(updated);
      const newStatus = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
      showToast(`Đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} tài khoản: ${user.fullName}`);
      onAddAuditLog(
        'THAY_ĐỔI_KHÓA_TRUY_CẬP',
        user.fullName,
        user.email,
        'Trạng thái đăng nhập',
        user.status,
        newStatus,
        `Admin đã ${newStatus === 'LOCKED' ? 'khóa' : 'mở khóa'} quyền đăng nhập của tài khoản ${user.email}.`
      );
    } catch (err: any) {
      showToast('Lỗi: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Xác nhận xóa tài khoản (Không dùng window.confirm)
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (!isAdmin) {
      showToast('Chỉ tài khoản "Admin - Toàn quyền" mới có quyền xóa dữ liệu.', 'error');
      setUserToDelete(null);
      return;
    }

    try {
      const identifier = userToDelete.email || userToDelete.fullName;
      setActionLoading(identifier);
      const updated = await AuthPermissionService.removePermission(identifier);
      setPermissions(updated);
      showToast(`Đã xóa tài khoản: ${userToDelete.fullName} (${userToDelete.email || 'Không có email'})`);
      onAddAuditLog(
        'XÓA_QUYỀN_ĐĂNG_NHẬP',
        userToDelete.fullName,
        userToDelete.email || userToDelete.fullName,
        'Tài khoản đăng nhập',
        userToDelete.email || userToDelete.fullName,
        'Đã xóa khỏi file Trang tính1',
        `Admin đã xóa hoàn toàn quyền đăng nhập của ${userToDelete.fullName} khỏi file Trang tính1.`
      );
      setUserToDelete(null);
    } catch (err: any) {
      showToast('Lỗi khi xóa: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Mở modal sửa thông tin quyền
  const handleOpenEdit = (user: UserPermission) => {
    if (!isAdmin) {
      showToast('Chỉ tài khoản "Admin - Toàn quyền" mới có quyền chỉnh sửa dữ liệu.', 'error');
      return;
    }
    setEditingUser({ ...user });
  };

  // Lưu chỉnh sửa thông tin quyền
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!isAdmin) {
      showToast('Chỉ tài khoản "Admin - Toàn quyền" mới có quyền chỉnh sửa dữ liệu.', 'error');
      return;
    }

    try {
      setActionLoading('edit');
      const cleanEmail = AuthPermissionService.normalizeEmail(editingUser.email);
      const updated = await AuthPermissionService.updateUserPermission(editingUser.email, {
        ...editingUser,
        email: cleanEmail,
      });
      setPermissions(updated);
      showToast(`Cập nhật phân quyền thành công cho cán bộ: ${editingUser.fullName}`);
      onAddAuditLog(
        'CẬP_NHẬT_PHÂN_QUYỀN',
        editingUser.fullName,
        cleanEmail,
        'Thông tin cấp quyền',
        '',
        `${AuthPermissionService.getRoleLabel(editingUser.role)} - ${editingUser.status}`,
        `Admin đã sửa thông tin vai trò hệ thống: ${AuthPermissionService.getRoleLabel(editingUser.role)} - Đơn vị: ${editingUser.departmentName}`
      );
      setEditingUser(null);
    } catch (err: any) {
      showToast('Lỗi cập nhật: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Thêm quyền mới (Cho phép cả Admin lẫn User thêm mới dữ liệu theo yêu cầu)
  const handleCreatePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = AuthPermissionService.normalizeEmail(formData.email);
    if (!cleanEmail || !formData.fullName) {
      showToast('Vui lòng nhập đầy đủ Email và Họ tên.', 'error');
      return;
    }

    try {
      setActionLoading('create');
      const statusToSet = isAdmin ? 'ACTIVE' : 'PENDING';
      const updated = await AuthPermissionService.grantUserPermission({
        fullName: formData.fullName,
        email: cleanEmail,
        departmentName: formData.departmentName,
        positionTitle: formData.positionTitle,
        role: formData.role,
        status: statusToSet,
        grantedDate: new Date().toISOString().split('T')[0],
        grantedBy: currentUser?.name || currentUserEmail || 'Hệ Thống Chi Cục',
        notes: formData.notes || (isAdmin ? 'Cấp quyền bởi Admin' : 'Yêu cầu thêm mới gửi bởi User'),
      });
      setPermissions(updated);
      setIsAddModalOpen(false);
      setFormData({
        fullName: '',
        email: '',
        departmentName: departments[0]?.name || 'Ban Lãnh đạo Chi cục',
        positionTitle: 'Chuyên viên',
        role: 'VIEWER',
        notes: '',
      });
      showToast(isAdmin ? `Đã cấp quyền thành công cho ${formData.fullName}` : `Đã thêm mới cán bộ vào danh sách (Chờ Admin duyệt)`);
      onAddAuditLog(
        'CẤP_QUYỀN_ĐĂNG_NHẬP_MỚI',
        formData.fullName,
        cleanEmail,
        'Cấp quyền truy cập',
        'Chưa có quyền',
        statusToSet,
        `Tài khoản ${currentUser?.name || 'Người dùng'} đã thêm cán bộ ${formData.fullName} (${cleanEmail}) - Vai trò: ${AuthPermissionService.getRoleLabel(formData.role)}.`
      );
    } catch (err: any) {
      showToast('Lỗi khi cấp quyền: ' + err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Truy xuất dữ liệu: Xuất danh sách phân quyền ra file Excel
  const handleExportPermissionsExcel = () => {
    const data = filteredList.map((p, idx) => ({
      'STT': idx + 1,
      'Họ Và Tên': p.fullName,
      'Email Đăng Nhập': p.email,
      'Đơn Vị / Phòng / Trạm': p.departmentName,
      'Chức Vụ': p.positionTitle,
      'Vai Trò Hệ Thống': AuthPermissionService.getRoleLabel(p.role),
      'Trạng Thái Cấp Quyền': AuthPermissionService.getStatusLabel(p.status),
      'Ngày Cấp': p.grantedDate,
      'Người Duyệt / Cấp': p.grantedBy,
      'Ghi Chú': p.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CapQuyen_TrangTinh1');
    XLSX.writeFile(wb, `DS_PhanQuyen_ChiCucThuY_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Đã truy xuất và tải xuống file Excel danh sách phân quyền!');
  };

  // Filter
  const filteredList = permissions.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = p.fullName.toLowerCase().includes(q) || 
                        p.email.toLowerCase().includes(q) || 
                        p.departmentName.toLowerCase().includes(q);
    const matchRole = roleFilter === 'ALL' || p.role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalCount = permissions.length;
  const activeCount = permissions.filter(p => p.status === 'ACTIVE').length;
  const pendingCount = permissions.filter(p => p.status === 'PENDING').length;
  const lockedCount = permissions.filter(p => p.status === 'LOCKED').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 text-xs">
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

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-800 rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30 shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black tracking-tight">Quản Lý Đăng Nhập & Cấp Quyền Truy Cập</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Sheet: {PERMISSION_SHEET_TAB_NAME}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isAdmin ? 'bg-purple-500/30 text-purple-200 border-purple-400/40' : 'bg-amber-500/30 text-amber-200 border-amber-400/40'
              }`}>
                {isAdmin ? '🛡️ Vai trò: Admin - Toàn quyền (Xóa, Sửa, Thêm, Duyệt)' : '👤 Vai trò: User (Xem, Truy xuất & Thêm mới dữ liệu)'}
              </span>
            </div>
            <p className="text-xs text-sky-200/80 mt-1 max-w-2xl leading-relaxed">
              Toàn bộ danh sách phân quyền được đọc và lưu trữ trực tiếp vào sheet <strong>"{PERMISSION_SHEET_TAB_NAME}"</strong> trong file <strong>"{PERMISSION_SPREADSHEET_TITLE}"</strong> thuộc thư mục Drive <strong>"{ROOT_FOLDER_NAME}"</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {spreadsheetUrl && (
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Mở Bảng Tính "{PERMISSION_SHEET_TAB_NAME}"</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {/* Nút Truy xuất dữ liệu Excel */}
          <button
            onClick={handleExportPermissionsExcel}
            className="bg-teal-700 hover:bg-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
            title="Truy xuất và tải về danh sách phân quyền dạng Excel"
          >
            <Download className="w-4 h-4" />
            <span>Truy Xuất Excel</span>
          </button>

          {/* Nút Thêm mới dữ liệu */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAdmin ? 'Cấp Quyền Cán Bộ Mới' : 'Thêm Mới Cán Bộ'}</span>
          </button>
        </div>
      </div>

      {/* KHUNG TRIỂN KHAI & ĐƯỜNG LINK ĐĂNG NHẬP CHO CÁN BỘ */}
      <div className="bg-sky-950/40 border border-sky-800/60 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600/30 text-sky-400 flex items-center justify-center border border-sky-500/40">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Đường Link Triển Khai Cho Cán Bộ Đăng Nhập</h3>
              <p className="text-[11px] text-sky-300">
                Gửi đường link này cho cán bộ (như Nguyễn Thị Nga) để truy cập đúng file dữ liệu phân quyền của Chi cục
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyDeploymentLink}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow cursor-pointer ${
              isCopied ? 'bg-emerald-600 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'Đã Sao Chép Link!' : 'Sao Chép Link Đăng Nhập Cho Cán Bộ'}</span>
          </button>
        </div>

        {/* Link Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-sky-300 font-semibold">
            <span>Liên kết triển khai cán bộ (Tự động sử dụng Shared App URL):</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Đã cấu hình truy cập công khai (Shared URL)</span>
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5">
            <span className="font-mono text-[11px] text-sky-200 select-all truncate flex-1 font-semibold">
              {getPublicShareLink()}
            </span>
            <button
              onClick={handleCopyDeploymentLink}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              title="Sao chép liên kết"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Role explanation notification */}
      <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
        isAdmin ? 'bg-purple-50 border-purple-200 text-purple-950' : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center gap-2.5">
          <Info className="w-4 h-4 text-purple-600 shrink-0" />
          <div className="text-xs">
            <strong>Phân quyền hệ thống: </strong>
            {isAdmin ? (
              <span>Bạn đang đăng nhập với tư cách <strong>Admin - Toàn quyền</strong>: Được phép <strong>XÓA</strong>, <strong>SỬA</strong>, <strong>THÊM MỚI</strong> và <strong>DUYỆT</strong> tất cả tài khoản trong Vai Trò Hệ Thống.</span>
            ) : (
              <span>Bạn đang đăng nhập với vai trò <strong>User</strong>: Được phép <strong>XEM</strong>, <strong>TRUY XUẤT DỮ LIỆU</strong> (Xuất Excel) và <strong>THÊM MỚI DỮ LIỆU</strong>. Không được phép xóa hoặc sửa bản ghi của người khác.</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Tổng tài khoản trong Sheet</div>
          <div className="text-2xl font-black text-slate-800 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Lưu tại "{PERMISSION_SHEET_TAB_NAME}"</div>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-emerald-800">Đã duyệt & Đang hoạt động</div>
          <div className="text-2xl font-black text-emerald-700 mt-1 flex items-center gap-2">
            <span>{activeCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Được phép đăng nhập</div>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-amber-800">Chờ Admin duyệt</div>
          <div className="text-2xl font-black text-amber-700 mt-1 flex items-center gap-2">
            <span>{pendingCount}</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">Gửi từ màn hình đăng nhập</div>
        </div>

        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-medium text-rose-800">Đã tạm khóa</div>
          <div className="text-2xl font-black text-rose-700 mt-1 flex items-center gap-2">
            <span>{lockedCount}</span>
            <Lock className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">Bị chặn đăng nhập</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo họ tên, email, đơn vị công tác..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="ADMIN">Cấp 1 – Admin (Toàn quyền)</option>
            <option value="DEPT_LEADER">Cấp 2 – Manager (Lãnh đạo)</option>
            <option value="HR_MANAGER">Cấp 3 – HR (Quản lý Nhân sự)</option>
            <option value="VIEWER">Cấp 4 – Staff (Cơ sở)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đã duyệt - Hoạt động</option>
            <option value="PENDING">Chờ Admin duyệt</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          <button
            onClick={loadPermissions}
            disabled={isLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Tải lại từ Sheets</span>
          </button>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">STT</th>
                <th className="py-3 px-3.5">Họ Và Tên</th>
                <th className="py-3 px-3.5">Email Đăng Nhập</th>
                <th className="py-3 px-3.5">Đơn Vị Công Tác</th>
                <th className="py-3 px-3.5">Vai Trò Hệ Thống</th>
                <th className="py-3 px-3.5">Trạng Thái</th>
                <th className="py-3 px-3.5">Ngày Cấp</th>
                <th className="py-3 px-3.5">Người Cấp</th>
                <th className="py-3 px-3.5 text-center min-w-[130px]">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500 mb-2" />
                    <span>Đang đọc dữ liệu từ sheet "{PERMISSION_SHEET_TAB_NAME}"...</span>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không tìm thấy tài khoản nào khớp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredList.map((user, idx) => {
                  return (
                    <tr 
                      key={`${user.email}_${idx}`} 
                      className={`hover:bg-slate-50/80 transition ${
                        user.status === 'PENDING' ? 'bg-amber-50/30' : user.status === 'LOCKED' ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono text-center text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{user.fullName}</span>
                          {user.role === 'ADMIN' && (
                            <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.2 rounded font-bold border border-purple-200">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal">{user.positionTitle}</div>
                      </td>
                      <td className="py-3 px-3.5 font-mono text-sky-900 font-medium">
                        {user.email}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-medium">
                          {user.departmentName}
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                          user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          user.role === 'HR_MANAGER' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          user.role === 'DEPT_LEADER' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {AuthPermissionService.getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                          user.status === 'PENDING' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {user.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {user.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-600" />}
                          {user.status === 'LOCKED' && <Lock className="w-3 h-3 text-rose-600" />}
                          <span>{AuthPermissionService.getStatusLabel(user.status)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {user.grantedDate}
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] truncate max-w-[120px]">
                        {user.grantedBy}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Phê duyệt tài khoản PENDING */}
                          {user.status === 'PENDING' && isAdmin && (
                            <button
                              onClick={() => handleApprove(user)}
                              disabled={actionLoading === user.email}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-[11px] font-bold shadow-xs transition flex items-center gap-1"
                              title="Phê duyệt cho phép đăng nhập"
                            >
                              <UserCheck className="w-3 h-3" />
                              <span>Duyệt</span>
                            </button>
                          )}

                          {/* Khóa / Mở khóa (Chỉ Admin) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleToggleLock(user)}
                              disabled={actionLoading === user.email}
                              className={`p-1.5 rounded-lg border transition ${
                                user.status === 'LOCKED'
                                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                              title={user.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}
                            >
                              {user.status === 'LOCKED' ? (
                                <Unlock className="w-3.5 h-3.5" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {/* SỬA QUYỀN (Admin - Toàn quyền được phép sửa) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEdit(user)}
                              disabled={actionLoading === user.email}
                              className="p-1.5 rounded-lg border border-slate-200 text-sky-600 hover:bg-sky-50 hover:border-sky-300 transition"
                              title="Sửa quyền, vai trò hoặc chức vụ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* XÓA QUYỀN (Admin - Toàn quyền được phép xóa) */}
                          {isAdmin ? (
                            <button
                              onClick={() => setUserToDelete(user)}
                              disabled={actionLoading === user.email}
                              className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition"
                              title="Xóa quyền truy cập khỏi danh sách"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Chỉ xem</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Chỉnh Sửa Thông Tin Quyền (SỬA DỮ LIỆU) */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 text-xs">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">Chỉnh Sửa Quyền & Vai Trò Hệ Thống</h3>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Họ Và Tên</label>
                <input
                  type="text"
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Đăng Nhập</label>
                <input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                />
                {editingUser.email.includes('@gmai.com') && (
                  <div 
                    onClick={() => setEditingUser({ ...editingUser, email: editingUser.email.replace('@gmai.com', '@gmail.com') })}
                    className="mt-1 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between cursor-pointer"
                  >
                    <span>⚠️ Phát hiện gõ nhầm <strong>@gmai.com</strong>. Nhấn vào đây để sửa thành <strong>{editingUser.email.replace('@gmai.com', '@gmail.com')}</strong></span>
                    <span className="text-sky-600 font-bold underline shrink-0 ml-2">Sửa ngay</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Đơn Vị Công Tác</label>
                  <select
                    value={editingUser.departmentName}
                    onChange={(e) => setEditingUser({ ...editingUser, departmentName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Chức Vụ</label>
                  <input
                    type="text"
                    value={editingUser.positionTitle}
                    onChange={(e) => setEditingUser({ ...editingUser, positionTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Vai Trò Hệ Thống</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as SystemRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-semibold text-purple-900"
                  >
                    <option value="ADMIN">Cấp 1 – Admin (Toàn quyền: Thêm, Sửa, Xóa)</option>
                    <option value="DEPT_LEADER">Cấp 2 – Manager (Lãnh đạo Chi cục - Ký duyệt)</option>
                    <option value="HR_MANAGER">Cấp 3 – HR (Quản lý Nhân sự - Xem toàn bộ Chi cục, Không được xóa)</option>
                    <option value="VIEWER">Cấp 4 – Staff (Cán bộ Phòng / Trạm - Xem theo đơn vị)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Trạng Thái Cấp Quyền</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-semibold"
                  >
                    <option value="ACTIVE">Đã duyệt - Hoạt động</option>
                    <option value="PENDING">Chờ Admin duyệt</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ghi Chú</label>
                <textarea
                  rows={2}
                  value={editingUser.notes}
                  onChange={(e) => setEditingUser({ ...editingUser, notes: e.target.value })}
                  placeholder="Ghi chú điều chỉnh quyền hạn..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'edit'}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLoading === 'edit' ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Quyền (XÓA DỮ LIỆU - Không dùng window.confirm) */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-xs">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Xác Nhận Xóa Quyền Cán Bộ</h3>
              </div>
              <button onClick={() => setUserToDelete(null)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn xóa quyền truy cập của cán bộ sau khỏi sheet <strong>"{PERMISSION_SHEET_TAB_NAME}"</strong>?
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{userToDelete.fullName}</div>
                <div className="font-mono text-sky-800 text-xs">{userToDelete.email}</div>
                <div className="text-slate-600">{userToDelete.positionTitle} &bull; {userToDelete.departmentName}</div>
                <div className="text-[11px] text-purple-700 font-semibold mt-1">
                  Vai trò: {AuthPermissionService.getRoleLabel(userToDelete.role)}
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Sau khi xóa, cán bộ này sẽ không thể đăng nhập vào Hệ thống Cơ sở dữ liệu Chi cục cho đến khi được cấp quyền trở lại.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  disabled={actionLoading === userToDelete.email}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{actionLoading === userToDelete.email ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cấp Quyền Cán Bộ Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">
                  {isAdmin ? 'Cấp Quyền Đăng Nhập Cán Bộ Mới' : 'Đề Xuất / Thêm Mới Cán Bộ'}
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePermission} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Họ Và Tên Cán Bộ *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email Google Đăng Nhập *</label>
                <input
                  type="email"
                  required
                  placeholder="canbo@gmail.com hoặc email công vụ"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                />
                {formData.email.includes('@gmai.com') && (
                  <div 
                    onClick={() => setFormData({ ...formData, email: formData.email.replace('@gmai.com', '@gmail.com') })}
                    className="mt-1 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center justify-between cursor-pointer"
                  >
                    <span>⚠️ Phát hiện gõ nhầm <strong>@gmai.com</strong>. Nhấn vào đây để sửa thành <strong>{formData.email.replace('@gmai.com', '@gmail.com')}</strong></span>
                    <span className="text-sky-600 font-bold underline shrink-0 ml-2">Sửa ngay</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Đơn Vị Công Tác</label>
                  <select
                    value={formData.departmentName}
                    onChange={(e) => setFormData({ ...formData, departmentName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Chức Vụ</label>
                  <input
                    type="text"
                    placeholder="Chuyên viên, Trạm trưởng..."
                    value={formData.positionTitle}
                    onChange={(e) => setFormData({ ...formData, positionTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Vai Trò Phân Quyền</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as SystemRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 font-semibold"
                >
                  <option value="ADMIN">Cấp 1 – Admin (Toàn quyền: Thêm, Sửa, Xóa)</option>
                  <option value="DEPT_LEADER">Cấp 2 – Manager (Lãnh đạo Chi cục - Ký duyệt)</option>
                  <option value="HR_MANAGER">Cấp 3 – HR (Quản lý Nhân sự - Xem toàn bộ Chi cục, Không được xóa)</option>
                  <option value="VIEWER">Cấp 4 – Staff (Cán bộ Phòng / Trạm - Xem theo đơn vị)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ghi Chú</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú thêm..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create'}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{actionLoading === 'create' ? 'Đang ghi vào Sheet...' : 'Xác Nhận Cấp Quyền'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
