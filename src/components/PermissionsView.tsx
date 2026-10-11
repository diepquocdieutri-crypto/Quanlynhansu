import React, { useState } from 'react';
import { ShieldCheck, Users, Key, Database, UserCheck, ShieldAlert } from 'lucide-react';
import { AppUser, UserRole, DataScope, Department } from '../types/hrm';

interface PermissionsViewProps {
  users: AppUser[];
  currentUser: AppUser;
  departments: Department[];
  onSwitchUser: (user: AppUser) => void;
}

export const PermissionsView: React.FC<PermissionsViewProps> = ({
  users,
  currentUser,
  departments,
  onSwitchUser,
}) => {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-sky-600" />
          <span>PHÂN QUYỀN TRUY CẬP & PHẠM VI DỮ LIỆU (DATA SCOPE)</span>
        </h2>
        <p className="text-slate-500 mt-0.5">
          Thiết kế 4 cấp quyền hành chính kết hợp phạm vi truy cập dữ liệu (Toàn Chi cục &bull; Theo Phòng &bull; Theo Trạm &bull; Cá nhân)
        </p>
      </div>

      {/* 4 Levels Description (Prompt #12 & #13) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sky-950 text-sm">Cấp 1 – ADMIN</span>
            <span className="bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded text-[10px]">Toàn quyền</span>
          </div>
          <div className="font-medium text-slate-700">Quản trị hệ thống</div>
          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
            <li>Xem, Thêm, Sửa, Xóa hồ sơ</li>
            <li>Quản lý tài khoản & phân quyền</li>
            <li>Cấu hình Google Sheets & Drive</li>
            <li>Xem toàn bộ Nhật ký Audit Log</li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-950 text-sm">Cấp 2 – MANAGER</span>
            <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">Lãnh đạo</span>
          </div>
          <div className="font-medium text-slate-700">Chi cục trưởng & Cấp phó</div>
          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
            <li>Xem toàn bộ hồ sơ Chi cục</li>
            <li>Ký duyệt điều động, bổ nhiệm</li>
            <li>Ký duyệt nâng bậc lương</li>
            <li>Xem và ký duyệt các báo cáo</li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-teal-950 text-sm">Cấp 3 – HR</span>
            <span className="bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded text-[10px]">Tổ chức</span>
          </div>
          <div className="font-medium text-slate-700">Cán bộ Tổ chức Cán bộ</div>
          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
            <li className="font-semibold text-teal-950">Xem toàn bộ hồ sơ Chi cục</li>
            <li>Xem & thêm mới hồ sơ nhân sự</li>
            <li>Cập nhật ngạch bậc, quá trình</li>
            <li>Xuất báo cáo, đồng bộ Drive/Sheets</li>
            <li className="text-rose-600 font-medium">Không được xóa hồ sơ gốc</li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">Cấp 4 – STAFF</span>
            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">Cơ sở</span>
          </div>
          <div className="font-medium text-slate-700">Cán bộ Phòng / Trạm</div>
          <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
            <li>Chỉ xem nhân sự trong đơn vị mình</li>
            <li>Cập nhật một số trường cho phép</li>
            <li className="text-slate-400">Không xem hồ sơ đơn vị khác</li>
            <li className="text-slate-400">Data Scope: DEPARTMENT</li>
          </ul>
        </div>
      </div>

      {/* User Accounts Management & Testing switcher */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b flex justify-between items-center">
          <span className="font-bold text-slate-800 text-sm">
            DANH SÁCH TÀI KHOẢN CÁN BỘ & THIẾT LẬP DATA SCOPE
          </span>
          <span className="text-slate-500 text-xs">
            Đang đăng nhập dưới quyền: <strong className="text-sky-900">{currentUser.name}</strong> ({currentUser.role})
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 font-bold text-slate-700 border-b uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3">Cán Bộ / Tài Khoản</th>
              <th className="py-2.5 px-3">Email Công Vụ</th>
              <th className="py-2.5 px-3">Vai Trò Hệ Thống</th>
              <th className="py-2.5 px-3">Phạm Vi Dữ Liệu (Data Scope)</th>
              <th className="py-2.5 px-3">Đơn Vị Quản Lý</th>
              <th className="py-2.5 px-3 text-right">Kiểm Thử Vai Trò</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className={`hover:bg-slate-50 ${u.id === currentUser.id ? 'bg-sky-50/60 font-semibold' : ''}`}>
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-[10px] text-slate-500">{u.roleTitle}</div>
                </td>
                <td className="py-3 px-3 font-mono text-slate-600">{u.email}</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] whitespace-nowrap ${
                    u.role === 'ADMIN' ? 'bg-sky-100 text-sky-900 border border-sky-300' :
                    u.role === 'MANAGER' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                    u.role === 'HR' ? 'bg-teal-100 text-teal-900 border border-teal-300' :
                    'bg-slate-200 text-slate-700 border border-slate-300'
                  }`}>
                    {u.role === 'ADMIN' ? 'Cấp 1 – ADMIN' :
                     u.role === 'MANAGER' ? 'Cấp 2 – MANAGER' :
                     u.role === 'HR' ? 'Cấp 3 – HR' :
                     'Cấp 4 – STAFF'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    {u.scope === 'ALL' ? 'Toàn Chi cục (ALL)' : `Theo đơn vị (${u.scope})`}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-700">{u.departmentName || 'Toàn bộ 14 đơn vị Chi cục'}</td>
                <td className="py-3 px-3 text-right">
                  {u.id === currentUser.id ? (
                    <span className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                      <UserCheck className="w-4 h-4" />
                      <span>Đang chọn</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => onSwitchUser(u)}
                      className="bg-slate-100 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      Chuyển sang tài khoản này
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
