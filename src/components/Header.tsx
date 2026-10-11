import React, { useState } from 'react';
import { 
  Building2, 
  Search, 
  Bell, 
  RefreshCw, 
  FolderSync, 
  FileSpreadsheet, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  LogIn,
  ExternalLink,
  ChevronDown,
  KeyRound,
  FolderSearch
} from 'lucide-react';
import { AppUser, Employee } from '../types/hrm';
import { GoogleDriveService } from '../services/googleDriveService';
import { GoogleSheetsService } from '../services/googleSheetsService';

interface HeaderProps {
  currentUser: AppUser;
  onSwitchUser: (user: AppUser) => void;
  availableUsers: AppUser[];
  googleConnected: boolean;
  googleUserEmail?: string;
  onLoginGoogle: () => void;
  onLogoutGoogle: () => void;
  onOpenSyncSheets: () => void;
  onOpenDriveModal: () => void;
  onOpenExcelImportModal: () => void;
  onOpenQuickSearchModal?: () => void;
  employees: Employee[];
  onSelectEmployee: (employee: Employee) => void;
  onNavigateTab: (tabId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSwitchUser,
  availableUsers,
  googleConnected,
  googleUserEmail,
  onLoginGoogle,
  onLogoutGoogle,
  onOpenSyncSheets,
  onOpenDriveModal,
  onOpenExcelImportModal,
  onOpenQuickSearchModal,
  employees,
  onSelectEmployee,
  onNavigateTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAlertsMenu, setShowAlertsMenu] = useState(false);

  // Tính toán các cảnh báo quan trọng
  const retiringSoon = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    const birthYear = parseInt(e.dob.split('-')[0], 10);
    const age = 2026 - birthYear;
    return (e.gender === 'Nam' && age >= 61) || (e.gender === 'Nữ' && age >= 56);
  });

  const salaryDueSoon = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    return e.salary.nextSalaryIncreaseDate && e.salary.nextSalaryIncreaseDate.includes('2026');
  });

  const missingDocs = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    return !e.avatarUrl || e.documents.length === 0 || !e.education.veterinaryCert;
  });

  const totalAlerts = retiringSoon.length + salaryDueSoon.length + (missingDocs.length > 0 ? 1 : 0);

  // Lọc kết quả tìm kiếm toàn hệ thống
  const searchResults = searchQuery.trim() === '' ? [] : employees.filter(emp => {
    const q = searchQuery.toLowerCase();
    return (
      emp.fullName.toLowerCase().includes(q) ||
      emp.code.toLowerCase().includes(q) ||
      emp.cccd.includes(q) ||
      emp.departmentName.toLowerCase().includes(q) ||
      emp.positionTitle.toLowerCase().includes(q)
    );
  }).slice(0, 6);

  return (
    <header className="bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-900 text-white shadow-md sticky top-0 z-40">
      {/* Top Banner with Administrative Identity */}
      <div className="px-4 py-2 border-b border-sky-700/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/10 p-1.5 flex items-center justify-center border border-white/20 shadow-inner">
            <Building2 className="w-7 h-7 text-cyan-300" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-sky-200">
              SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN TP. HỒ CHÍ MINH
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              CHI CỤC CHĂN NUÔI VÀ THÚ Y
              <span className="text-xs bg-sky-600/80 px-2 py-0.5 rounded border border-sky-400/40 text-sky-100 font-normal">
                Hệ Thống Quản Lý Nhân Sự
              </span>
            </h1>
          </div>
        </div>

        {/* Google Workspace Integration Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {googleConnected ? (
            <div className="flex items-center gap-2 bg-sky-950/60 border border-sky-500/40 px-3 py-1.5 rounded-lg text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="hidden sm:block">
                <span className="text-sky-300">Đã kết nối Google:</span>{' '}
                <span className="text-white font-medium">{googleUserEmail || 'Tài khoản công vụ'}</span>
              </div>
              
              <button
                onClick={onOpenExcelImportModal}
                title="Tìm kiếm và đối soát bảng lương toàn Chi cục từ Google Drive"
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded transition text-xs font-semibold shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-100" />
                <span>Nhập File BANG LUONG</span>
              </button>

              <button
                onClick={() => onNavigateTab('auth-permissions')}
                title="Quản lý cấp quyền đăng nhập (Trang tính1)"
                className="flex items-center gap-1 bg-purple-800 hover:bg-purple-700 text-white px-2.5 py-1 rounded transition text-xs font-semibold shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5 text-purple-200" />
                <span>Cấp Quyền (Trang tính1)</span>
              </button>

              <button
                onClick={onOpenSyncSheets}
                title="Đồng bộ bảng dữ liệu Google Sheets"
                className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 rounded transition text-xs font-medium"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Google Sheets</span>
              </button>

              <button
                onClick={onOpenDriveModal}
                title="Quản lý hồ sơ tệp trên Google Drive"
                className="flex items-center gap-1 bg-sky-700 hover:bg-sky-600 text-white px-2.5 py-1 rounded transition text-xs font-medium"
              >
                <FolderSync className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </button>

              <button
                onClick={onLogoutGoogle}
                title="Đăng xuất Google"
                className="p-1 hover:bg-white/10 rounded text-sky-300 hover:text-white"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenSyncSheets}
                title="Mở Trung tâm đồng bộ Google Sheets"
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg shadow-xs text-xs font-semibold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Đồng Bộ Google Sheets</span>
              </button>

              <button
                onClick={onOpenExcelImportModal}
                title="Nhập file BANG LUONG TOAN CHI CUC .xlsx"
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg shadow text-xs font-semibold transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-200" />
                <span>Nhập Bảng Lương (Excel/Drive)</span>
              </button>

              <button
                onClick={onLoginGoogle}
                className="flex items-center gap-2 bg-white text-slate-800 hover:bg-slate-100 px-3 py-1.5 rounded-lg shadow text-xs font-semibold transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Kết nối Google</span>
              </button>
            </div>
          )}

          {/* User Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 bg-sky-950/70 hover:bg-sky-950 px-2.5 py-1.5 rounded-lg border border-sky-600/50 text-xs transition"
            >
              <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-[10px]">
                {currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden md:block">
                <div className="font-semibold leading-tight text-white">{currentUser.name.split(' (')[0]}</div>
                <div className="text-[10px] text-cyan-300">{currentUser.roleTitle} ({currentUser.role})</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-sky-300" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">Danh sách tài khoản cấp quyền</div>
                    <div className="text-[10px] text-slate-500">Tham chiếu từ sheet "Trang tính1" &bull; Cột "Họ và tên"</div>
                  </div>
                  <span className="bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {availableUsers.length} cán bộ
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {availableUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => {
                        onSwitchUser(user);
                        setShowUserMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-sky-50 transition ${
                        user.id === currentUser.id ? 'bg-sky-100/70 font-semibold text-sky-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-medium truncate text-slate-900">{user.name}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded font-semibold ${
                            user.role === 'ADMIN' ? 'bg-rose-100 text-rose-800' :
                            user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                            user.role === 'HR' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {user.roleTitle}
                          </span>
                          <span className="text-slate-400 truncate max-w-[120px]">{user.email}</span>
                        </div>
                      </div>
                      {user.id === currentUser.id && (
                        <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub Bar with Universal Search & Alerts */}
      <div className="px-4 py-2 bg-sky-900/90 flex items-center justify-between gap-4">
        {/* Universal Search Bar & Quick File Search */}
        <div className="flex items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sky-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              placeholder="🔎 Tìm nhanh nhân sự: Nhập Họ tên, Số CCCD, Mã NV, Đơn vị, Chức vụ..."
              className="w-full bg-sky-950/80 border border-sky-600/60 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-sky-300/70 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-300 hover:text-white text-xs"
              >
                ✕
              </button>
            )}

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div 
                className="absolute left-0 right-0 mt-1 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 overflow-hidden z-50 text-xs"
                onMouseLeave={() => setShowSearchResults(false)}
              >
                <div className="bg-slate-100 px-3 py-1.5 font-semibold text-slate-600 border-b flex justify-between">
                  <span>Kết quả tìm kiếm ({searchResults.length})</span>
                  <span className="text-[10px] text-slate-400">Click để mở hồ sơ điện tử</span>
                </div>
                {searchResults.map(emp => (
                  <div
                    key={emp.id}
                    onClick={() => {
                      onSelectEmployee(emp);
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="px-3 py-2 hover:bg-sky-50 border-b border-slate-100 cursor-pointer flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold overflow-hidden shrink-0 border border-sky-200">
                        {emp.avatarUrl ? (
                          <img src={emp.avatarUrl} alt={emp.fullName} className="w-full h-full object-cover" />
                        ) : (
                          emp.fullName.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {emp.fullName}
                          <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono">
                            {emp.code}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {emp.positionTitle} &bull; {emp.departmentName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        emp.status === 'Đang công tác' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {emp.status}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">CCCD: {emp.cccd}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {onOpenQuickSearchModal && (
            <button
              onClick={onOpenQuickSearchModal}
              className="bg-indigo-700 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5 shrink-0 border border-indigo-500/40"
              title="Tìm kiếm truy xuất nhanh bên trong nội dung file dữ liệu trong 3 thư mục Drive"
            >
              <FolderSearch className="w-3.5 h-3.5 text-indigo-200" />
              <span className="hidden sm:inline">Tìm Trong File Drive</span>
            </button>
          )}
        </div>

        {/* Right Action Icons & Alerts */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Alerts Bell */}
          <div className="relative">
            <button
              onClick={() => setShowAlertsMenu(!showAlertsMenu)}
              className="relative p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-950 border border-sky-600/40 text-sky-200 hover:text-white transition flex items-center gap-1 text-xs"
            >
              <Bell className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline font-medium">Cảnh báo</span>
              {totalAlerts > 0 && (
                <span className="w-5 h-5 bg-rose-500 text-white font-bold rounded-full flex items-center justify-center text-[10px] animate-pulse">
                  {totalAlerts}
                </span>
              )}
            </button>

            {showAlertsMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-2 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-slate-100 font-bold text-slate-900 flex justify-between items-center">
                  <span>Cảnh báo nhân sự Chi cục</span>
                  <span className="text-rose-600 font-semibold">{totalAlerts} thông báo</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {retiringSoon.length > 0 && (
                    <div 
                      onClick={() => { onNavigateTab('warnings'); setShowAlertsMenu(false); }}
                      className="px-3 py-2 hover:bg-amber-50 cursor-pointer flex items-start gap-2 text-amber-900"
                    >
                      <span className="text-base">⏳</span>
                      <div>
                        <div className="font-semibold">0{retiringSoon.length} nhân sự sắp đến tuổi nghỉ hưu</div>
                        <div className="text-[11px] text-slate-500">Xem danh sách chuẩn bị hồ sơ hưu trí theo quy định</div>
                      </div>
                    </div>
                  )}

                  {salaryDueSoon.length > 0 && (
                    <div 
                      onClick={() => { onNavigateTab('salary'); setShowAlertsMenu(false); }}
                      className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-start gap-2 text-sky-900"
                    >
                      <span className="text-base">💰</span>
                      <div>
                        <div className="font-semibold">0{salaryDueSoon.length} nhân sự đến kỳ nâng bậc lương (2026)</div>
                        <div className="text-[11px] text-slate-500">Đủ điều kiện xét nâng ngạch, nâng bậc thường xuyên</div>
                      </div>
                    </div>
                  )}

                  {missingDocs.length > 0 && (
                    <div 
                      onClick={() => { onNavigateTab('staff'); setShowAlertsMenu(false); }}
                      className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-start gap-2 text-slate-800"
                    >
                      <span className="text-base">📋</span>
                      <div>
                        <div className="font-semibold">{missingDocs.length} hồ sơ cần rà soát bổ sung</div>
                        <div className="text-[11px] text-slate-500">Thiếu ảnh đại diện, chứng chỉ thú y hoặc tài liệu văn bản</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-3 pt-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => { onNavigateTab('warnings'); setShowAlertsMenu(false); }}
                    className="text-sky-600 hover:text-sky-800 font-semibold text-[11px]"
                  >
                    Xem chi tiết trung tâm cảnh báo &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
