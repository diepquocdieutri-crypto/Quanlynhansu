import React, { useState, useMemo } from 'react';
import { Coins, AlertCircle, CheckCircle2, TrendingUp, Calendar, Download, Plus, ArrowUpRight, Receipt } from 'lucide-react';
import { Employee } from '../types/hrm';
import { formatDateVN } from '../utils/dateUtils';
import { JobRankService } from '../services/jobRankService';
import * as XLSX from 'xlsx';
import { formatBaseSalary, formatDecimal, formatPCCV, formatPercentAllowance, parseBaseSalary, DEFAULT_BASE_SALARY } from '../utils/salaryUtils';

interface SalaryManagementViewProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  onRaiseSalary: (employeeId: string, nextStep: number, nextCoeff: number, decisionNumber: string) => void;
  onNavigateToMonthlyPayroll?: () => void;
}

export const SalaryManagementView: React.FC<SalaryManagementViewProps> = ({
  employees,
  onSelectEmployee,
  onRaiseSalary,
  onNavigateToMonthlyPayroll,
}) => {
  const [selectedRankFilter, setSelectedRankFilter] = useState('ALL');
  const allRanks = useMemo(() => JobRankService.getAllRanks(), []);

  // Lọc danh sách nhân sự đến kỳ nâng lương trong năm 2026
  const salaryDueList = employees.filter(e => {
    return e.status === 'Đang công tác' && e.salary.nextSalaryIncreaseDate && e.salary.nextSalaryIncreaseDate.includes('2026');
  });

  const filteredEmployees = employees.filter(emp => {
    if (selectedRankFilter !== 'ALL' && !emp.jobRankCode.includes(selectedRankFilter)) return false;
    return true;
  });

  const exportSalaryExcel = () => {
    const data = filteredEmployees.map((emp, idx) => ({
      'STT': idx + 1,
      'Mã Nhân Viên': emp.code,
      'Họ Và Tên': emp.fullName,
      'Đơn Vị': emp.departmentName,
      'Chức Vụ': emp.positionTitle,
      'Ngạch Lương': `${emp.jobRankCode} - ${emp.jobRankName}`,
      'Bậc Lương': emp.salary.step,
      'Hệ Số Lương': formatDecimal(emp.salary.coefficient, 2),
      'Mức Lương Cơ Sở (VNĐ)': parseBaseSalary(emp.salary.baseSalary, DEFAULT_BASE_SALARY),
      'Phụ Cấp Chức Vụ': formatPCCV(emp.salary.leadershipAllowance),
      'Phụ Cấp Thâm Niên (%)': formatPercentAllowance(emp.salary.seniorityAllowancePercent, 0),
      'Phụ Cấp Ưu Đãi Ngành (%)': formatPercentAllowance(emp.salary.industryAllowancePercent, 10),
      'Phụ Cấp Công Vụ (%)': formatPercentAllowance(emp.salary.publicServiceAllowancePercent, 25),
      'Ngày Hưởng': emp.salary.effectiveDate,
      'Ngày Dự Kiến Nâng Bậc': emp.salary.nextSalaryIncreaseDate,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BangLuong');
    XLSX.writeFile(wb, 'BangLuong_ChiCucChanNuoiThuY.xlsx');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Coins className="w-6 h-6 text-sky-600" />
            <span>QUẢN LÝ TIỀN LƯƠNG, PHỤ CẤP & BẬC HÀNH CHÍNH</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Bảng hệ số lương theo ngạch công chức 01.002, 01.003 & viên chức kiểm dịch thú y 09.018, 09.019
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToMonthlyPayroll && (
            <button
              onClick={onNavigateToMonthlyPayroll}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-950/30 border-b-[3px] border-emerald-800 active:border-b-0 active:translate-y-[3px] active:shadow-inner transition-all cursor-pointer transform hover:-translate-y-0.5"
              title="Mở Bảng tính lương & thu nhập hàng tháng theo 4 loại hình riêng biệt"
            >
              <Receipt className="w-4 h-4 text-emerald-100" />
              <span>Bảng Lương Hàng Tháng (Google Sheets)</span>
            </button>
          )}

          <button
            onClick={exportSalaryExcel}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-3.5 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất Bảng Lương Excel</span>
          </button>
        </div>
      </div>

      {/* 3 Thẻ Quy định Tiền lương & Phụ cấp Nhà nước */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-xs">
            💵
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">
              Mức Lương Cơ Sở (Mặc định)
            </div>
            <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">
              2.530.000 <span className="text-xs font-normal text-emerald-800">đ/tháng</span>
            </div>
            <div className="text-[10px] text-emerald-700">Mức lương cơ sở áp dụng hiện hành</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-xs">
            🛡️
          </div>
          <div>
            <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">
              Phụ Cấp Ưu Đãi Ngành (Mặc định)
            </div>
            <div className="text-lg font-black font-mono text-indigo-950 mt-0.5">
              10%
            </div>
            <div className="text-[10px] text-indigo-700">Áp dụng chuyên môn kiểm dịch & thú y</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 p-3.5 rounded-xl shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-xs">
            🏛️
          </div>
          <div>
            <div className="text-[11px] font-bold text-teal-900 uppercase tracking-wide">
              Phụ Cấp Công Vụ (Mặc định)
            </div>
            <div className="text-lg font-black font-mono text-teal-950 mt-0.5">
              25%
            </div>
            <div className="text-[10px] text-teal-700">Áp dụng công chức hành chính & quản lý</div>
          </div>
        </div>
      </div>

      {/* CẢNH BÁO NÂNG LƯƠNG - Prompt #9 Requirement */}
      <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              🔔
            </div>
            <div>
              <div className="font-bold text-blue-950 text-sm">
                Cảnh báo xét nâng bậc lương thường xuyên ({salaryDueList.length} nhân sự)
              </div>
              <div className="text-blue-800 text-[11px] mt-0.5">
                Các cán bộ đủ thời gian giữ bậc theo quy chuẩn 3 năm (ngạch chuyên viên) hoặc 2 năm (cán sự/nhân viên).
              </div>
            </div>
          </div>

          <span className="bg-blue-600 text-white font-semibold px-3 py-1 rounded-full text-xs">
            Đến kỳ nâng bậc năm 2026
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {salaryDueList.map(emp => (
            <div
              key={emp.id}
              onClick={() => onSelectEmployee(emp)}
              className="bg-white p-3 rounded-lg border border-blue-200 hover:border-blue-400 cursor-pointer transition shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-slate-900">{emp.fullName}</div>
                <div className="text-[11px] text-slate-500">{emp.departmentName}</div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="font-mono text-blue-700 font-bold">Bậc {emp.salary.step} ({emp.salary.coefficient})</span>
                <span className="text-amber-700 font-semibold">{emp.salary.nextSalaryIncreaseDate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Lọc theo ngạch:</span>
          <select
            value={selectedRankFilter}
            onChange={(e) => setSelectedRankFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
          >
            <option value="ALL">-- Tất cả ngạch công chức & viên chức --</option>
            <optgroup label="📋 Nhóm Kế toán">
              {allRanks.filter(r => r.group === 'Kế toán').map(r => (
                <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
              ))}
            </optgroup>
            <optgroup label="🛡️ Nhóm Kiểm dịch & Thú y">
              {allRanks.filter(r => r.group === 'Kiểm dịch & Thú y').map(r => (
                <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
              ))}
            </optgroup>
            <optgroup label="🏛️ Nhóm Hành chính / Chuyên viên">
              {allRanks.filter(r => r.group === 'Hành chính').map(r => (
                <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
              ))}
            </optgroup>
            {allRanks.some(r => r.group === 'Ngạch tự nhập / Khác' || r.isCustom) && (
              <optgroup label="⭐ Ngạch tự nhập thêm">
                {allRanks.filter(r => r.group === 'Ngạch tự nhập / Khác' || r.isCustom).map(r => (
                  <option key={r.code} value={r.code}>{r.code} - {r.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <span className="text-slate-500">
          Tổng số: <strong className="text-slate-800">{filteredEmployees.length}</strong> cán bộ
        </span>
      </div>

      {/* Salary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 font-bold text-slate-700 border-b uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3">Cán Bộ / Mã NV</th>
              <th className="py-2.5 px-3">Đơn Vị Trực Thuộc</th>
              <th className="py-2.5 px-3">Ngạch Lương</th>
              <th className="py-2.5 px-3 text-center">Bậc / Bậc Tối Đa</th>
              <th className="py-2.5 px-3 text-center">Hệ Số Lương</th>
              <th className="py-2.5 px-3 text-center">Phụ Cấp CV</th>
              <th className="py-2.5 px-3 text-center">Thâm Niên (%)</th>
              <th className="py-2.5 px-3 text-center">Ưu Đãi Ngành (%)</th>
              <th className="py-2.5 px-3 text-center">Công Vụ (%)</th>
              <th className="py-2.5 px-3">Ngày Hưởng</th>
              <th className="py-2.5 px-3">Dự Kiến Nâng Bậc</th>
              <th className="py-2.5 px-3 text-right">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map(emp => (
              <tr key={emp.id} className="hover:bg-sky-50/50">
                <td className="py-2.5 px-3">
                  <div 
                    onClick={() => onSelectEmployee(emp)}
                    className="font-bold text-slate-900 hover:text-sky-600 cursor-pointer"
                  >
                    {emp.fullName}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">{emp.code}</div>
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-700">{emp.departmentName}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-800">{emp.jobRankCode}</td>
                <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                  {emp.salary.step} / {emp.salary.maxStep}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <div className="font-bold text-emerald-700 text-sm font-mono">
                    {formatDecimal(emp.salary.coefficient, 2)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    CS: {formatBaseSalary(emp.salary.baseSalary)}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono text-xs shadow-2xs">
                    {formatPCCV(emp.salary.leadershipAllowance)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                  {formatPercentAllowance(emp.salary.seniorityAllowancePercent, 0)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono text-xs">
                    {formatPercentAllowance(emp.salary.industryAllowancePercent, 10)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono text-xs">
                    {formatPercentAllowance(emp.salary.publicServiceAllowancePercent, 25)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">{formatDateVN(emp.salary.effectiveDate)}</td>
                <td className="py-2.5 px-3">
                  <span className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
                    emp.salary.nextSalaryIncreaseDate.includes('2026')
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'text-slate-600'
                  }`}>
                    {formatDateVN(emp.salary.nextSalaryIncreaseDate)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => onSelectEmployee(emp)}
                    className="text-sky-600 hover:text-sky-800 font-semibold"
                  >
                    Chi tiết &rarr;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
