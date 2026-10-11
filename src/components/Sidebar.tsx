import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Network, 
  Briefcase, 
  Coins, 
  GraduationCap, 
  Award, 
  FileText, 
  Cloud, 
  BarChart3, 
  AlertTriangle, 
  ShieldAlert, 
  History,
  FolderOpen,
  Building2,
  KeyRound,
  Receipt,
  Calculator
} from 'lucide-react';
import { UserRole } from '../types/hrm';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  userRole: UserRole;
  pendingRetirementsCount: number;
  pendingSalaryRaisesCount: number;
  departmentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  pendingRetirementsCount,
  pendingSalaryRaisesCount,
  departmentCount = 23,
}) => {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard Tổng quan',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'departments',
      label: 'Danh mục Phòng, Đơn vị',
      icon: Building2,
      badge: `${departmentCount} đơn vị`,
      badgeColor: 'bg-sky-100 text-sky-800 font-bold',
    },
    {
      id: 'staff',
      label: 'Hồ sơ & Danh sách Nhân sự',
      icon: Users,
      badge: null,
    },
    {
      id: 'organization',
      label: 'Sơ đồ Cây Tổ chức Chi cục',
      icon: Network,
      badge: null,
    },
    {
      id: 'work-history',
      label: 'Quá trình Công tác & Biến động',
      icon: Briefcase,
      badge: null,
    },
    {
      id: 'salary',
      label: 'Lương & Phụ cấp',
      icon: Coins,
      badge: pendingSalaryRaisesCount > 0 ? `${pendingSalaryRaisesCount} đến kỳ` : null,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'monthly-payroll',
      label: 'Bảng Lương & Thu Nhập Hàng Tháng',
      icon: Receipt,
      badge: 'Google Sheets',
      badgeColor: 'bg-emerald-100 text-emerald-800 font-bold',
    },
    {
      id: 'quarterly-tax',
      label: 'Thuế TNCN & Lũy Kế Quý',
      icon: Calculator,
      badge: '3 Tầng / Quý',
      badgeColor: 'bg-indigo-100 text-indigo-800 font-bold',
    },
    {
      id: 'training',
      label: 'Đào tạo & Chứng chỉ Thú y',
      icon: GraduationCap,
      badge: null,
    },
    {
      id: 'reward-discipline',
      label: 'Khen thưởng & Kỷ luật',
      icon: Award,
      badge: null,
    },
    {
      id: 'decisions',
      label: 'Văn bản & Quyết định',
      icon: FileText,
      badge: null,
    },
    {
      id: 'drive-storage',
      label: 'Hồ sơ Điện tử & Google Drive',
      icon: Cloud,
      badge: 'Drive',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'reports',
      label: 'Báo cáo & Thống kê',
      icon: BarChart3,
      badge: 'Excel/PDF',
    },
    {
      id: 'warnings',
      label: 'Cảnh báo Nhân sự',
      icon: AlertTriangle,
      badge: pendingRetirementsCount > 0 ? `${pendingRetirementsCount} hưu` : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'audit-log',
      label: 'Nhật ký Hệ thống (Audit Log)',
      icon: History,
      badge: 'Bắt buộc',
    },
    {
      id: 'auth-permissions',
      label: 'Quản lý Đăng nhập & Cấp quyền',
      icon: KeyRound,
      badge: 'Trang tính1',
      badgeColor: 'bg-emerald-100 text-emerald-800 font-bold',
    },
    {
      id: 'admin',
      label: 'Quản trị & Phân quyền',
      icon: ShieldAlert,
      badge: userRole === 'ADMIN' ? 'Admin' : null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none min-h-[calc(100vh-104px)]">
      <div className="p-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800/80">
        Menu Quản lý Hành chính
      </div>

      <nav className="p-2 space-y-1 overflow-y-auto flex-1 text-xs">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium transition-all text-left ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-sky-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ml-1.5 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badgeColor || 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 bg-slate-950/60">
        <div className="font-semibold text-slate-300">Chi cục CCNN & Thú y TP.HCM</div>
        <div className="text-[10px] text-slate-400 mt-0.5">Dữ liệu: Google Sheets & Drive API</div>
        <div className="mt-1 flex items-center gap-1.5 text-emerald-400 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Hệ thống trực tuyến an toàn</span>
        </div>
      </div>
    </aside>
  );
};
