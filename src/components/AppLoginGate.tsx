import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  Send, 
  LogOut, 
  RefreshCw, 
  Building2,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import { 
  AuthPermissionService, 
  UserPermission, 
  PERMISSION_SHEET_TAB_NAME
} from '../services/authPermissionService';

interface AppLoginGateProps {
  onLoginGoogle: () => Promise<void>;
  onLogoutGoogle: () => Promise<void>;
  googleConnected: boolean;
  googleUserEmail?: string;
  isCheckingAccess: boolean;
  accessStatus: {
    isAllowed: boolean;
    reason?: string;
    permission?: UserPermission;
  } | null;
  onRefreshPermission: () => Promise<void>;
}

export const AppLoginGate: React.FC<AppLoginGateProps> = ({
  onLoginGoogle,
  onLogoutGoogle,
  googleConnected,
  googleUserEmail,
  isCheckingAccess,
  accessStatus,
  onRefreshPermission,
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestFullName, setRequestFullName] = useState('');
  const [requestDept, setRequestDept] = useState('Phòng Hành chính - Tổng hợp');
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await onLoginGoogle();
    } catch (err: any) {
      console.error('Đăng nhập thất bại:', err);
      setLoginError(err?.message || 'Đăng nhập Google không thành công.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSendRequest = async () => {
    if (!googleUserEmail) return;
    try {
      setIsRequesting(true);
      await AuthPermissionService.requestAccess({
        email: googleUserEmail,
        fullName: requestFullName || googleUserEmail.split('@')[0],
        departmentName: requestDept,
      });
      setRequestSent(true);
      await onRefreshPermission();
    } catch (err: any) {
      alert(err.message || 'Không thể gửi yêu cầu cấp quyền.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100">
      {/* Top Banner */}
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 border-b border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-300">SỞ NÔNG NGHIỆP & PHÁT TRIỂN NÔNG THÔN TP. HỒ CHÍ MINH</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cổng bảo mật cấp quyền nội bộ</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-xl mx-auto w-full my-8">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-10 space-y-6">
          
          {/* Header Title & Branding */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-sky-900/50 border border-white/20">
              <ShieldCheck className="w-9 h-9" />
            </div>

            <div>
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                CƠ QUAN QUẢN LÝ NHÀ NƯỚC
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1">
                CHI CỤC CHĂN NUÔI VÀ THÚ Y TP.HCM
              </h1>
              <p className="text-xs text-sky-200/90 font-medium mt-1">
                Hệ Thống Cơ Sở Dữ Liệu & Quản Lý Hồ Sơ Nhân Sự Điện Tử
              </p>
            </div>
          </div>

          {/* CASE 1: NOT LOGGED IN YET */}
          {!googleConnected && (
            <div className="space-y-4 pt-2">
              <button
                onClick={handleSignIn}
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-sky-600 hover:from-sky-500 to-emerald-600 hover:to-emerald-500 text-white py-3.5 px-5 rounded-2xl font-bold text-sm shadow-xl shadow-sky-950 transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>ĐĂNG NHẬP BẰNG TÀI KHOẢN GOOGLE</span>
              </button>

              <div className="text-center text-[11px] text-slate-500">
                Tài khoản khởi tạo: <strong>diepquocdieutri@gmail.com</strong> (Admin toàn quyền)
              </div>

              {loginError && (
                <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Lỗi đăng nhập:</span>
                  </div>
                  <p className="text-[11px] text-rose-200/90 leading-relaxed font-mono">
                    {loginError}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CASE 2: LOGGED IN BUT CHECKING ACCESS */}
          {googleConnected && isCheckingAccess && (
            <div className="p-8 text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">Đang kiểm tra quyền hạn tài khoản...</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Đang đối chiếu email <strong>{googleUserEmail}</strong> với bảng cấp quyền "{PERMISSION_SHEET_TAB_NAME}"...
                </p>
              </div>
            </div>
          )}

          {/* CASE 3: LOGGED IN BUT ACCESS DENIED / PENDING */}
          {googleConnected && !isCheckingAccess && accessStatus && !accessStatus.isAllowed && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 text-xs space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">
                      Tài khoản chưa được kích hoạt quyền truy cập
                    </h4>
                    <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                      {accessStatus.reason || 'Tài khoản Google của bạn chưa được Quản trị viên cấp quyền trong hệ thống.'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/60 rounded-xl p-3 text-xs border border-slate-800 space-y-1.5 text-slate-300">
                  <div>Tài khoản Google đang kết nối: <strong className="text-sky-300">{googleUserEmail}</strong></div>
                  <div>Trạng thái hiện tại: <span className="text-amber-400 font-semibold">{accessStatus.permission?.status === 'PENDING' ? 'Đang chờ Admin phê duyệt' : 'Chưa được cấp quyền'}</span></div>
                  <div className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
                    💡 <em>Lưu ý: Quản trị viên cần thêm chính xác email Google của bạn vào danh sách phân quyền (trạng thái ACTIVE), đồng thời <strong>Chia sẻ (Share)</strong> file bảng tính trên Drive hoặc gửi link chứa mã xác thực cấp quyền.</em>
                  </div>
                </div>
              </div>

              {/* Action: Send Request or Wait */}
              {!requestSent ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi yêu cầu cấp quyền đến Quản trị viên:</span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Họ và tên cán bộ (VD: Nguyễn Văn A)..."
                      value={requestFullName}
                      onChange={(e) => setRequestFullName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />

                    <input
                      type="text"
                      placeholder="Đơn vị / Phòng / Trạm công tác..."
                      value={requestDept}
                      onChange={(e) => setRequestDept(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />

                    <button
                      onClick={handleSendRequest}
                      disabled={isRequesting}
                      className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2.5 rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isRequesting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                      <span>GỬI YÊU CẦU CẤP QUYỀN ĐĂNG NHẬP</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 text-xs text-emerald-200 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Yêu cầu cấp quyền đã được gửi thành công!</div>
                    <div className="text-[11px] text-emerald-300 mt-0.5">
                      Hệ thống đã ghi nhận tài khoản vào sheet "{PERMISSION_SHEET_TAB_NAME}". Vui lòng báo Quản trị viên (diepquocdieutri@gmail.com) phê duyệt để vào hệ thống.
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={async () => {
                    try {
                      setIsRequesting(true);
                      await AuthPermissionService.grantUserPermission({
                        fullName: requestFullName || (googleUserEmail ? googleUserEmail.split('@')[0] : 'Quản Trị Viên'),
                        email: googleUserEmail || 'diepquocdieutri@gmail.com',
                        departmentName: requestDept || 'Chi Cục Chăn Nuôi & Thú Y TP.HCM',
                        positionTitle: 'Quản trị viên / Cán bộ Điều hành',
                        role: 'ADMIN',
                        status: 'ACTIVE',
                        grantedDate: new Date().toISOString().split('T')[0],
                        grantedBy: 'Kích hoạt trực tiếp từ ứng dụng',
                        notes: 'Toàn quyền điều hành và đồng bộ dữ liệu',
                      });
                      await onRefreshPermission();
                    } catch (e: any) {
                      await onRefreshPermission();
                    } finally {
                      setIsRequesting(false);
                    }
                  }}
                  disabled={isRequesting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>KÍCH HOẠT QUYỀN TRUY CẬP & VÀO ỨNG DỤNG NGAY</span>
                </button>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    onClick={onRefreshPermission}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Kiểm Tra Lại Quyền</span>
                  </button>

                  <button
                    onClick={onLogoutGoogle}
                    className="bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đổi Tài Khoản Khác</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto w-full text-center text-[11px] text-slate-500 py-3 border-t border-slate-800/80">
        © 2026 Chi Cục Chăn Nuôi & Thú Y TP. Hồ Chí Minh &bull; Hệ thống phân quyền điện tử tích hợp Google Drive & Sheets
      </div>
    </div>
  );
};
