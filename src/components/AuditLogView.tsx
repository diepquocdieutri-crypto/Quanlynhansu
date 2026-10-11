import React, { useState } from 'react';
import { History, ShieldAlert, Search, Filter, Lock } from 'lucide-react';
import { AuditLog } from '../types/hrm';
import { formatDateTimeVN } from '../utils/dateUtils';

interface AuditLogViewProps {
  logs: AuditLog[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    if (filterAction !== 'ALL' && !log.action.includes(filterAction)) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      return (
        log.userName.toLowerCase().includes(q) ||
        log.targetEmployeeName.toLowerCase().includes(q) ||
        log.targetEmployeeCode.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-sky-600" />
            <span>NHẬT KÝ HỆ THỐNG & TRUY VẾT DỮ LIỆU (AUDIT LOG)</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Module bắt buộc cho cơ quan nhà nước &bull; Ghi nhận mọi biến động, sửa đổi dữ liệu hồ sơ (Không cho phép xóa)
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>Nhật ký bất biến (Read-only)</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo Người thực hiện, Tên cán bộ bị sửa, Mã NV, Chi tiết thay đổi..."
            className="w-full bg-slate-50 border rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-50 border rounded-lg px-3 py-1.5 text-xs"
          >
            <option value="ALL">Tất cả hành động</option>
            <option value="THÊM_MỚI">Thêm mới nhân sự</option>
            <option value="CẬP_NHẬT">Cập nhật hồ sơ</option>
            <option value="ĐIỀU_ĐỘNG">Điều động / Bổ nhiệm</option>
            <option value="NÂNG_LƯƠNG">Nâng bậc lương</option>
            <option value="GOOGLE">Đồng bộ Google Workspace</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table (Prompt #14 format) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 font-bold text-slate-700 border-b uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3">Thời Gian</th>
              <th className="py-2.5 px-3">Người Dùng Thực Hiện</th>
              <th className="py-2.5 px-3">Hành Động</th>
              <th className="py-2.5 px-3">Nhân Sự Bị Sửa</th>
              <th className="py-2.5 px-3">Trường Thay Đổi</th>
              <th className="py-2.5 px-3">Giá Trị Trước</th>
              <th className="py-2.5 px-3">Giá Trị Sau</th>
              <th className="py-2.5 px-3">Chi Tiết / Căn Cứ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{formatDateTimeVN(log.timestamp)}</td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-900">{log.userName}</div>
                  <div className="text-[10px] text-slate-400">{log.userEmail}</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className="bg-sky-100 text-sky-900 font-semibold px-2 py-0.5 rounded text-[10px]">
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-bold text-slate-900">{log.targetEmployeeName}</div>
                  <div className="text-[10px] font-mono text-slate-500">{log.targetEmployeeCode}</div>
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-800">{log.fieldChanged || '-'}</td>
                <td className="py-2.5 px-3 text-rose-700 font-mono bg-rose-50/50 px-1 rounded max-w-[120px] truncate">
                  {log.oldValue || '-'}
                </td>
                <td className="py-2.5 px-3 text-emerald-700 font-mono bg-emerald-50/50 px-1 rounded max-w-[120px] truncate">
                  {log.newValue || '-'}
                </td>
                <td className="py-2.5 px-3 text-slate-600 max-w-xs">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
