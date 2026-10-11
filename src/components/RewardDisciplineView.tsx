import React from 'react';
import { Award, ShieldAlert, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { Employee } from '../types/hrm';
import { formatDateVN } from '../utils/dateUtils';

interface RewardDisciplineViewProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
}

export const RewardDisciplineView: React.FC<RewardDisciplineViewProps> = ({
  employees,
  onSelectEmployee,
}) => {
  const allRewards: any[] = [];
  const allDisciplines: any[] = [];

  employees.forEach(emp => {
    emp.rewardDiscipline.forEach(rd => {
      if (rd.type === 'Khen thưởng') {
        allRewards.push({ emp, ...rd });
      } else {
        allDisciplines.push({ emp, ...rd });
      }
    });
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-600" />
          <span>QUẢN LÝ KHEN THƯỞNG & KỶ LUẬT HÀNH CHÍNH</span>
        </h2>
        <p className="text-slate-500 mt-0.5">
          Bảo lưu vĩnh viễn hồ sơ thi đua khen thưởng và các hình thức xử lý kỷ luật theo luật cán bộ công chức
        </p>
      </div>

      {/* Grid 2 Sections: Khen thưởng vs Kỷ luật */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Khen thưởng */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm text-emerald-800">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>DANH HIỆU THI ĐUA & KHEN THƯỞNG ({allRewards.length})</span>
            </h3>
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
              Tuyên dương
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {allRewards.map((item, idx) => (
              <div key={idx} className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1">
                <div className="flex items-center justify-between">
                  <div 
                    onClick={() => onSelectEmployee(item.emp)}
                    className="font-bold text-slate-900 hover:text-emerald-700 cursor-pointer"
                  >
                    {item.emp.fullName} ({item.emp.code})
                  </div>
                  <span className="text-[10px] text-slate-500">{formatDateVN(item.decisionDate)}</span>
                </div>
                <div className="font-semibold text-emerald-900">{item.form}</div>
                <div className="text-slate-600 text-[11px]">{item.reason}</div>
                <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                  <span>Số QĐ: {item.decisionNumber}</span>
                  <span>Cấp ký: {item.signLevel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kỷ luật */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm text-rose-800">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>HỒ SƠ XỬ LÝ KỶ LUẬT ({allDisciplines.length})</span>
            </h3>
            <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
              Bảo lưu lịch sử
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {allDisciplines.length === 0 ? (
              <div className="py-8 text-center text-slate-400">Không có hồ sơ kỷ luật đang hiệu lực.</div>
            ) : (
              allDisciplines.map((item, idx) => (
                <div key={idx} className="p-3 bg-rose-50/50 rounded-lg border border-rose-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <div 
                      onClick={() => onSelectEmployee(item.emp)}
                      className="font-bold text-slate-900 hover:text-rose-700 cursor-pointer"
                    >
                      {item.emp.fullName} ({item.emp.code})
                    </div>
                    <span className="text-[10px] text-slate-500">{formatDateVN(item.decisionDate)}</span>
                  </div>
                  <div className="font-semibold text-rose-900">{item.form}</div>
                  <div className="text-slate-600 text-[11px]">{item.reason}</div>
                  <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                    <span>Số QĐ: {item.decisionNumber}</span>
                    <span>Cấp ký: {item.signLevel}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
