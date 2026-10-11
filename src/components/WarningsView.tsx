import React from 'react';
import { AlertTriangle, Calendar, Coins, Clock, FileWarning, ArrowRight, UserCheck } from 'lucide-react';
import { Employee } from '../types/hrm';
import { formatDateVN } from '../utils/dateUtils';

interface WarningsViewProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
}

export const WarningsView: React.FC<WarningsViewProps> = ({
  employees,
  onSelectEmployee,
}) => {
  // 1. Sắp đến tuổi nghỉ hưu
  const retiringEmployees = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    const birthYear = parseInt(e.dob.split('-')[0], 10);
    const age = 2026 - birthYear;
    return (e.gender === 'Nam' && age >= 61) || (e.gender === 'Nữ' && age >= 56);
  });

  // 2. Đến kỳ nâng lương 2026
  const salaryDueList = employees.filter(e => {
    return e.status === 'Đang công tác' && e.salary.nextSalaryIncreaseDate && e.salary.nextSalaryIncreaseDate.includes('2026');
  });

  // 3. Hồ sơ thiếu thông tin / ảnh
  const missingInfoList = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    return !e.avatarUrl || e.documents.length === 0 || !e.education.veterinaryCert;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <span>TRUNG TÂM CẢNH BÁO TỰ ĐỘNG CÔNG TÁC TỔ CHỨC CÁN BỘ</span>
        </h2>
        <p className="text-slate-500 mt-0.5">
          Tự động phát hiện cán bộ sắp nghỉ hưu, kỳ nâng lương thường xuyên và hồ sơ thiếu tài liệu
        </p>
      </div>

      {/* Warning Categories */}
      <div className="space-y-5">
        {/* Category 1: Nghỉ hưu */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>⚠ Cảnh báo cán bộ sắp đến tuổi nghỉ hưu ({retiringEmployees.length} nhân sự)</span>
            </div>
            <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px]">
              Lộ trình 2026 - 2027
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {retiringEmployees.map(emp => {
              const birthYear = parseInt(emp.dob.split('-')[0], 10);
              const age = 2026 - birthYear;
              return (
                <div
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp)}
                  className="p-3 bg-amber-50/40 rounded-xl border border-amber-200 hover:border-amber-400 cursor-pointer transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{emp.fullName}</span>
                      <span className="text-amber-800 font-bold text-xs">{age} tuổi</span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{emp.positionTitle} &bull; {emp.departmentName}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Ngày sinh: {formatDateVN(emp.dob)} (Mã: {emp.code})</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between text-[11px] font-semibold text-amber-900">
                    <span>Chuẩn bị thủ tục hưu trí</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category 2: Nâng lương */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
              <Coins className="w-4 h-4 text-blue-600" />
              <span>⚠ Cảnh báo xét nâng bậc lương thường xuyên trong năm ({salaryDueList.length} nhân sự)</span>
            </div>
            <span className="bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px]">
              Đến hạn 2026
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {salaryDueList.map(emp => (
              <div
                key={emp.id}
                onClick={() => onSelectEmployee(emp)}
                className="p-3 bg-blue-50/40 rounded-xl border border-blue-200 hover:border-blue-400 cursor-pointer transition flex flex-col justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{emp.fullName}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{emp.positionTitle} &bull; {emp.departmentName}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Bậc hiện tại: <strong>Bậc {emp.salary.step}</strong> (Hệ số {emp.salary.coefficient})
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-blue-200 flex items-center justify-between text-[11px] font-semibold text-blue-900">
                  <span>Dự kiến: {emp.salary.nextSalaryIncreaseDate}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category 3: Rà soát hồ sơ */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <FileWarning className="w-4 h-4 text-slate-500" />
              <span>⚠ Hồ sơ cần rà soát, bổ sung tài liệu & chứng chỉ ({missingInfoList.length} hồ sơ)</span>
            </div>
            <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
              Chuẩn hóa dữ liệu
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {missingInfoList.map(emp => (
              <div
                key={emp.id}
                onClick={() => onSelectEmployee(emp)}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-sky-300 cursor-pointer transition"
              >
                <div className="font-bold text-slate-900">{emp.fullName} ({emp.code})</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{emp.departmentName}</div>
                <div className="text-[11px] text-rose-600 mt-2 font-medium">
                  {!emp.avatarUrl && '• Thiếu ảnh chân dung '}
                  {emp.documents.length === 0 && '• Chưa đính kèm file Drive '}
                  {!emp.education.veterinaryCert && '• Chưa nhập chứng chỉ thú y'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
