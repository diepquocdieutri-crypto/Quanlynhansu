import React, { useState, useRef } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Check, 
  Building2, 
  Calendar, 
  FileText, 
  Layers, 
  DollarSign, 
  User, 
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { 
  Employee, 
  MonthlyPayrollRecord, 
  PayrollCategory, 
  Department 
} from '../types/hrm';
import { PAYROLL_CATEGORY_META } from '../services/monthlyPayrollService';
import { readVietnameseCurrency, formatBaseSalary } from '../utils/salaryUtils';
import { getTodayVN } from '../utils/dateUtils';

interface PayrollPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  baseSalary: number;
  payrollData: Record<PayrollCategory, MonthlyPayrollRecord[]>;
  departments: Department[];
  employees: Employee[];
}

export type PrintScope = 'ALL' | PayrollCategory | 'BY_DEPT' | 'PAYSLIP';

export const PayrollPrintModal: React.FC<PayrollPrintModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  baseSalary,
  payrollData,
  departments,
  employees,
}) => {
  const [printScope, setPrintScope] = useState<PrintScope>('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || 'BAN_LANH_DAO');
  const [selectedEmpCode, setSelectedEmpCode] = useState<string>(employees[0]?.code || 'NV-19750312-0001');
  const [showSignatureColumn, setShowSignatureColumn] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'xs'>('xs');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const today = getTodayVN();
  const [todayD, todayM, todayY] = today.split('/');

  // Gom toàn bộ danh sách cán bộ kỳ này
  const allRecords: MonthlyPayrollRecord[] = [
    ...(payrollData.CONG_CHUC || []),
    ...(payrollData.VIEN_CHUC || []),
    ...(payrollData.HOP_DONG_111 || []),
    ...(payrollData.THU_Y_PX || []),
    ...(payrollData.KHOAN_CM || []),
  ];

  // Lọc danh sách theo chế độ in được chọn
  let targetRecords: MonthlyPayrollRecord[] = [];
  let scopeTitle = '';

  if (printScope === 'ALL') {
    targetRecords = allRecords;
    scopeTitle = 'TOÀN CƠ QUAN CHI CỤC CHĂN NUÔI VÀ THÚ Y (5 KHỐI)';
  } else if (printScope === 'CONG_CHUC') {
    targetRecords = payrollData.CONG_CHUC || [];
    scopeTitle = 'KHỐI CÔNG CHỨC (HƯỞNG PHỤ CẤP CÔNG VỤ 25%)';
  } else if (printScope === 'VIEN_CHUC') {
    targetRecords = payrollData.VIEN_CHUC || [];
    scopeTitle = 'KHỐI VIÊN CHỨC SỰ NGHIỆP';
  } else if (printScope === 'HOP_DONG_111') {
    targetRecords = payrollData.HOP_DONG_111 || [];
    scopeTitle = 'KHỐI HỢP ĐỒNG LAO ĐỘNG (NGHỊ ĐỊNH 111/2022/NĐ-CP & HĐ 68)';
  } else if (printScope === 'THU_Y_PX') {
    targetRecords = payrollData.THU_Y_PX || [];
    scopeTitle = 'KHỐI NHÂN VIÊN THÚ Y PHƯỜNG XÃ & CƠ SỞ';
  } else if (printScope === 'KHOAN_CM') {
    targetRecords = payrollData.KHOAN_CM || [];
    scopeTitle = 'KHỐI KHOÁN CHUYÊN MÔN';
  } else if (printScope === 'BY_DEPT') {
    const dept = departments.find(d => d.id === selectedDeptId);
    const deptName = dept?.name || '';
    targetRecords = allRecords.filter(r => r.departmentName.toLowerCase().includes(deptName.toLowerCase()));
    scopeTitle = `ĐƠN VỊ: ${deptName.toUpperCase()}`;
  } else if (printScope === 'PAYSLIP') {
    const single = allRecords.find(r => r.code === selectedEmpCode) || allRecords[0];
    targetRecords = single ? [single] : [];
    scopeTitle = `PHIẾU LƯƠNG CÁ NHÂN: ${single?.fullName} (${single?.code})`;
  }

  // Tính tổng số liệu
  const totalCount = targetRecords.length;
  const totalSalary = targetRecords.reduce((s, r) => s + r.salaryAmount, 0);
  const totalBeyondFrame = targetRecords.reduce((s, r) => s + r.beyondFrameAmount, 0);
  const totalLeadership = targetRecords.reduce((s, r) => s + r.leadershipAllowanceAmount, 0);
  const totalPublicService = targetRecords.reduce((s, r) => s + r.publicServiceAllowanceAmount, 0);
  const totalResponsibility = targetRecords.reduce((s, r) => s + r.responsibilityAllowanceAmount, 0);
  const totalIndustry = targetRecords.reduce((s, r) => s + r.industryAllowanceAmount, 0);
  const totalTravel = targetRecords.reduce((s, r) => s + r.travelAllowanceAmount, 0);
  const totalAllowance = targetRecords.reduce((s, r) => s + r.totalAllowanceAmount, 0);
  const totalGross = targetRecords.reduce((s, r) => s + r.totalGrossIncome, 0);
  const totalBHXH = targetRecords.reduce((s, r) => s + r.socialInsuranceEmp, 0);
  const totalBHYT = targetRecords.reduce((s, r) => s + r.healthInsuranceEmp, 0);
  const totalBHTN = targetRecords.reduce((s, r) => s + r.unemploymentInsuranceEmp, 0);
  const totalDeductions = targetRecords.reduce((s, r) => s + r.totalDeductions, 0);
  const totalNet = targetRecords.reduce((s, r) => s + r.netSalary, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in print:p-0 print:bg-white print:static print:inset-auto">
      
      {/* Container chính của Modal */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden border border-slate-300 print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
        
        {/* ========================================================================= */}
        {/* HEADER ĐIỀU KHIỂN & CHỌN MẪU IN (ẨN KHI IN) */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-indigo-950 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-2 flex items-center justify-center border border-white/20 text-cyan-300 shadow-inner">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
                <span>IN BẢNG THANH TOÁN TIỀN LƯƠNG & PHỤ CẤP</span>
                <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  Kỳ Tháng {selectedMonth}/{selectedYear}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Mẫu số C02a-HD chuẩn kế toán nhà nước &bull; MLCS: <strong className="text-amber-300">{formatBaseSalary(baseSalary)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Nút bấm in ngay */}
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/40 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>In Báo Cáo Ngay (Ctrl + P)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-300 hover:text-white transition"
              title="Đóng cửa sổ xem trước"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh công cụ chọn loại bảng lương & khổ giấy (Ẩn khi in) */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 print:hidden">
          {/* Chọn Mẫu In */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-sky-700" />
              <span>Chọn Mẫu In:</span>
            </span>

            <div className="bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs flex items-center gap-0.5 flex-wrap">
              <button
                onClick={() => { setPrintScope('ALL'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'ALL'
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                🌟 Toàn Chi Cục ({allRecords.length})
              </button>

              <button
                onClick={() => { setPrintScope('CONG_CHUC'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'CONG_CHUC'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Công Chức ({payrollData.CONG_CHUC?.length || 0})
              </button>

              <button
                onClick={() => { setPrintScope('VIEN_CHUC'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'VIEN_CHUC'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Viên Chức ({payrollData.VIEN_CHUC?.length || 0})
              </button>

              <button
                onClick={() => { setPrintScope('HOP_DONG_111'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'HOP_DONG_111'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Hợp Đồng 111 ({payrollData.HOP_DONG_111?.length || 0})
              </button>

              <button
                onClick={() => { setPrintScope('THU_Y_PX'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'THU_Y_PX'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Thú Y PX ({payrollData.THU_Y_PX?.length || 0})
              </button>

              <button
                onClick={() => { setPrintScope('KHOAN_CM'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'KHOAN_CM'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Khoán CM ({payrollData.KHOAN_CM?.length || 0})
              </button>

              <button
                onClick={() => { setPrintScope('BY_DEPT'); setOrientation('landscape'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'BY_DEPT'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Theo Phòng/Trạm
              </button>

              <button
                onClick={() => { setPrintScope('PAYSLIP'); setOrientation('portrait'); }}
                className={`px-2.5 py-1 rounded-md font-bold transition text-xs ${
                  printScope === 'PAYSLIP'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                ✉️ Phiếu Lương Cá Nhân
              </button>
            </div>
          </div>

          {/* Tùy chỉnh phụ: Chọn phòng ban hoặc cá nhân */}
          <div className="flex items-center gap-3 flex-wrap">
            {printScope === 'BY_DEPT' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Đơn vị:</span>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {printScope === 'PAYSLIP' && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-600">Cán bộ:</span>
                <select
                  value={selectedEmpCode}
                  onChange={(e) => setSelectedEmpCode(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-hidden max-w-xs"
                >
                  {allRecords.map(r => (
                    <option key={r.code} value={r.code}>{r.fullName} ({r.code}) - {r.departmentName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Checkbox cột ký nhận */}
            {printScope !== 'PAYSLIP' && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={showSignatureColumn}
                  onChange={(e) => setShowSignatureColumn(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>Cột ký nhận</span>
              </label>
            )}

            {/* Chọn khổ giấy */}
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  orientation === 'landscape' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Khổ Ngang (A4)
              </button>
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  orientation === 'portrait' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Khổ Đứng (A4)
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VÙNG IN VĂN BẢN (PRINTABLE AREA)                                          */}
        {/* ========================================================================= */}
        <div 
          ref={printAreaRef}
          id="payroll-print-document"
          className="p-6 sm:p-10 overflow-auto bg-white text-black font-serif print:p-0 print:overflow-visible print:w-full print:m-0"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          {/* Style in ấn trực tiếp đảm bảo trang in nét tuyệt đối */}
          <style>{`
            @media print {
              @page {
                size: ${orientation};
                margin: 8mm 6mm 8mm 6mm;
              }
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #payroll-print-document, #payroll-print-document * {
                visibility: visible !important;
              }
              #payroll-print-document {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                font-size: 10pt !important;
              }
              .print-no-break {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              th, td {
                border-color: #000 !important;
              }
              thead {
                display: table-header-group !important;
              }
              tfoot {
                display: table-footer-group !important;
              }
            }
          `}</style>

          {/* ===================================================================== */}
          {/* PHẦN 1: MẪU BẢNG THANH TOÁN TIỀN LƯƠNG TỔNG HỢP / THEO KHỐI           */}
          {/* ===================================================================== */}
          {printScope !== 'PAYSLIP' ? (
            <div className="space-y-4">
              {/* Quốc hiệu - Tiêu ngữ & Đơn vị chủ quản */}
              <div className="flex justify-between items-start text-xs sm:text-sm leading-tight border-b-2 border-transparent pb-1">
                <div className="text-center w-5/12">
                  <div className="uppercase font-normal">SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN</div>
                  <div className="uppercase font-bold text-sm">CHI CỤC CHĂN NUÔI VÀ THÚ Y TPHCM</div>
                  <div className="italic text-[11px] mt-0.5">Mẫu số: C02a-HD (Ban hành theo TT 107/BTC)</div>
                </div>

                <div className="text-center w-6/12">
                  <div className="uppercase font-bold text-sm">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="font-bold text-sm">Độc lập - Tự do - Hạnh phúc</div>
                  <div className="text-xs tracking-widest font-serif">────────────</div>
                  <div className="italic text-xs mt-0.5">
                    TP. Hồ Chí Minh, ngày {todayD} tháng {todayM} năm {todayY}
                  </div>
                </div>
              </div>

              {/* Tiêu đề bảng lương */}
              <div className="text-center py-2 space-y-1">
                <h1 className="text-base sm:text-xl font-bold uppercase tracking-wide">
                  BẢNG THANH TOÁN TIỀN LƯƠNG VÀ CÁC KHOẢN PHỤ CẤP
                </h1>
                <div className="text-sm font-bold uppercase text-slate-800">
                  KỲ CHI TRẢ: THÁNG {selectedMonth} NĂM {selectedYear} &bull; {scopeTitle}
                </div>
                <div className="text-xs italic text-slate-700">
                  (Căn cứ Nghị định số 204/2004/NĐ-CP & Nghị định số 73/2024/NĐ-CP &bull; Mức lương cơ sở: <strong>{formatBaseSalary(baseSalary)}</strong>/tháng)
                </div>
              </div>

              {/* Bảng lương chi tiết */}
              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse border border-black text-[11px] leading-tight">
                  <thead>
                    <tr className="bg-slate-100 text-center font-bold">
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-8">STT</th>
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 w-18">Mã NV</th>
                      <th rowSpan={2} className="border border-black px-2 py-1.5 min-w-[130px] text-left">Họ và Tên</th>
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 min-w-[110px] text-left">Chức danh / Vị trí</th>
                      <th rowSpan={2} className="border border-black px-1 py-1.5 w-12">Mã ngạch</th>
                      <th rowSpan={2} className="border border-black px-1 py-1.5 w-10">HSL</th>
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 min-w-[75px] text-right">Lương HSL</th>
                      <th colSpan={4} className="border border-black px-1.5 py-1 text-center">Các Khoản Phụ Cấp (VNĐ)</th>
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 min-w-[80px] text-right font-bold bg-slate-200">Tổng Thu Nhập</th>
                      <th colSpan={4} className="border border-black px-1 py-1 text-center">Các Khoản Trích Nộp Trừ Lương</th>
                      <th rowSpan={2} className="border border-black px-1.5 py-1.5 min-w-[85px] text-right font-bold bg-slate-200">THỰC LĨNH</th>
                      {showSignatureColumn && (
                        <th rowSpan={2} className="border border-black px-2 py-1.5 min-w-[70px] text-center">Ký nhận</th>
                      )}
                    </tr>
                    <tr className="bg-slate-50 text-center font-semibold text-[10px]">
                      <th className="border border-black px-1 py-1 min-w-[65px] text-right">PC Chức vụ</th>
                      <th className="border border-black px-1 py-1 min-w-[65px] text-right">PC VK (%)</th>
                      <th className="border border-black px-1 py-1 min-w-[65px] text-right">Công vụ (25%)</th>
                      <th className="border border-black px-1 py-1 min-w-[60px] text-right">PC Khác</th>
                      <th className="border border-black px-1 py-1 w-12 text-right">BHXH 8%</th>
                      <th className="border border-black px-1 py-1 w-11 text-right">BHYT 1.5%</th>
                      <th className="border border-black px-1 py-1 w-11 text-right">BHTN 1%</th>
                      <th className="border border-black px-1 py-1 min-w-[65px] text-right font-bold">Tổng trích</th>
                    </tr>
                    <tr className="bg-slate-100 text-center text-[9px] italic text-slate-600 font-serif">
                      <th className="border border-black py-0.5">(1)</th>
                      <th className="border border-black py-0.5">(2)</th>
                      <th className="border border-black py-0.5">(3)</th>
                      <th className="border border-black py-0.5">(4)</th>
                      <th className="border border-black py-0.5">(5)</th>
                      <th className="border border-black py-0.5">(6)</th>
                      <th className="border border-black py-0.5">(7)</th>
                      <th className="border border-black py-0.5">(8)</th>
                      <th className="border border-black py-0.5">(9)</th>
                      <th className="border border-black py-0.5">(10)</th>
                      <th className="border border-black py-0.5">(11)</th>
                      <th className="border border-black py-0.5 font-bold">(12=7..11)</th>
                      <th className="border border-black py-0.5">(13)</th>
                      <th className="border border-black py-0.5">(14)</th>
                      <th className="border border-black py-0.5">(15)</th>
                      <th className="border border-black py-0.5 font-bold">(16=13..15)</th>
                      <th className="border border-black py-0.5 font-bold">(17=12-16)</th>
                      {showSignatureColumn && <th className="border border-black py-0.5">(18)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {targetRecords.map((r, idx) => {
                      const otherAllowances = (r.responsibilityAllowanceAmount || 0) + (r.industryAllowanceAmount || 0) + (r.travelAllowanceAmount || 0);
                      return (
                        <tr key={r.code} className="hover:bg-slate-50 transition print-no-break">
                          <td className="border border-black px-1.5 py-1 text-center font-medium">{idx + 1}</td>
                          <td className="border border-black px-1.5 py-1 font-mono text-[10px] text-center">{r.code}</td>
                          <td className="border border-black px-2 py-1 font-bold whitespace-nowrap text-left">{r.fullName}</td>
                          <td className="border border-black px-1.5 py-1 text-left">{r.positionTitle}</td>
                          <td className="border border-black px-1 py-1 text-center font-mono text-[10px]">{r.jobRankCode || '-'}</td>
                          <td className="border border-black px-1 py-1 text-center font-bold">{(r.coefficient || 0).toFixed(2)}</td>
                          <td className="border border-black px-1.5 py-1 text-right">{r.salaryAmount.toLocaleString('vi-VN')}</td>
                          
                          {/* Phụ cấp */}
                          <td className="border border-black px-1 py-1 text-right">
                            {r.leadershipAllowanceAmount > 0 ? r.leadershipAllowanceAmount.toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right">
                            {r.beyondFrameAmount > 0 ? `${r.beyondFrameAmount.toLocaleString('vi-VN')}` : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right">
                            {r.publicServiceAllowanceAmount > 0 ? r.publicServiceAllowanceAmount.toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right">
                            {otherAllowances > 0 ? otherAllowances.toLocaleString('vi-VN') : '-'}
                          </td>

                          {/* Tổng thu nhập */}
                          <td className="border border-black px-1.5 py-1 text-right font-bold bg-slate-50">
                            {r.totalGrossIncome.toLocaleString('vi-VN')}
                          </td>

                          {/* Trích nộp bảo hiểm */}
                          <td className="border border-black px-1 py-1 text-right">
                            {r.socialInsuranceEmp > 0 ? r.socialInsuranceEmp.toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right">
                            {r.healthInsuranceEmp > 0 ? r.healthInsuranceEmp.toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right">
                            {r.unemploymentInsuranceEmp > 0 ? r.unemploymentInsuranceEmp.toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="border border-black px-1 py-1 text-right font-semibold">
                            {r.totalDeductions.toLocaleString('vi-VN')}
                          </td>

                          {/* Thực lĩnh */}
                          <td className="border border-black px-1.5 py-1 text-right font-bold bg-slate-100 text-black">
                            {r.netSalary.toLocaleString('vi-VN')}
                          </td>

                          {/* Ký nhận */}
                          {showSignatureColumn && (
                            <td className="border border-black px-1 py-1 text-center italic text-[9px] text-slate-500">
                              {r.salaryAmount > 0 ? 'ATM' : ''}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-bold border-t-2 border-black text-center print-no-break">
                      <td colSpan={5} className="border border-black px-2 py-1.5 text-center uppercase">
                        TỔNG CỘNG ({totalCount} CÁN BỘ)
                      </td>
                      <td className="border border-black px-1 py-1.5 text-center">-</td>
                      <td className="border border-black px-1.5 py-1.5 text-right">{totalSalary.toLocaleString('vi-VN')}</td>
                      
                      <td className="border border-black px-1 py-1.5 text-right">{totalLeadership.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{totalBeyondFrame.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{totalPublicService.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{(totalResponsibility + totalIndustry + totalTravel).toLocaleString('vi-VN')}</td>
                      
                      <td className="border border-black px-1.5 py-1.5 text-right bg-slate-300">{totalGross.toLocaleString('vi-VN')}</td>

                      <td className="border border-black px-1 py-1.5 text-right">{totalBHXH.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{totalBHYT.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{totalBHTN.toLocaleString('vi-VN')}</td>
                      <td className="border border-black px-1 py-1.5 text-right">{totalDeductions.toLocaleString('vi-VN')}</td>

                      <td className="border border-black px-1.5 py-1.5 text-right bg-slate-300 text-black text-[12px]">
                        {totalNet.toLocaleString('vi-VN')}
                      </td>
                      {showSignatureColumn && (
                        <td className="border border-black px-1 py-1.5 text-center">-</td>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Số tiền bằng chữ */}
              <div className="pt-2 text-xs sm:text-sm font-serif italic print-no-break">
                <span className="font-bold not-italic">Số tiền thực lĩnh viết bằng chữ: </span>
                <span className="underline decoration-dotted">{readVietnameseCurrency(totalNet)}</span>
              </div>

              {/* Khối chữ ký 3 bên chuẩn hành chính kế toán nhà nước */}
              <div className="pt-6 grid grid-cols-3 gap-4 text-center text-xs sm:text-sm leading-normal print-no-break">
                <div>
                  <div className="font-bold uppercase">NGƯỜI LẬP BẢNG</div>
                  <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div className="h-20 sm:h-24"></div>
                  <div className="font-bold">Võ Thị Hồng Loan</div>
                </div>

                <div>
                  <div className="font-bold uppercase">KẾ TOÁN TRƯỞNG</div>
                  <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div className="h-20 sm:h-24"></div>
                  <div className="font-bold">Trần Văn Hoàng</div>
                </div>

                <div>
                  <div className="font-bold uppercase">THỦ TRƯỞNG ĐƠN VỊ</div>
                  <div className="italic text-[11px] text-slate-500">(Ký tên, đóng dấu)</div>
                  <div className="h-20 sm:h-24 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400 italic print:hidden">[Đóng dấu Chi cục]</span>
                  </div>
                  <div className="font-bold uppercase text-base text-slate-900">Trần Phú Cường</div>
                  <div className="text-[11px] italic text-slate-600">Chi cục Trưởng</div>
                </div>
              </div>
            </div>
          ) : (
            /* ===================================================================== */
            /* PHẦN 2: MẪU PHIẾU THANH TOÁN TIỀN LƯƠNG CÁ NHÂN (PAYSLIP)              */
            /* ===================================================================== */
            <div className="max-w-2xl mx-auto border-2 border-black p-6 sm:p-8 space-y-4 print:border-black print:p-6 print-no-break">
              {/* Header phiếu lương */}
              <div className="flex justify-between items-start border-b border-black pb-3">
                <div>
                  <div className="uppercase font-bold text-xs">SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN</div>
                  <div className="uppercase font-bold text-sm text-sky-950">CHI CỤC CHĂN NUÔI VÀ THÚ Y TPHCM</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Địa chỉ: 151 Lý Thường Kiệt, Q.11, TP.HCM</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded border border-slate-300 inline-block">
                    MÃ CÁN BỘ: {targetRecords[0]?.code}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 italic">
                    Tháng {selectedMonth}/{selectedYear}
                  </div>
                </div>
              </div>

              {/* Tiêu đề */}
              <div className="text-center py-1">
                <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wide">
                  PHIẾU THANH TOÁN TIỀN LƯƠNG CÁ NHÂN
                </h2>
                <p className="text-xs italic text-slate-600">
                  Kỳ lương Tháng {selectedMonth} năm {selectedYear} &bull; Mức lương cơ sở: {formatBaseSalary(baseSalary)}
                </p>
              </div>

              {/* Thông tin cán bộ */}
              {targetRecords[0] && (
                <div className="grid grid-cols-2 gap-2 text-xs border border-slate-300 bg-slate-50 p-3 rounded">
                  <div>
                    <span className="font-semibold text-slate-600">Họ và tên:</span>{' '}
                    <strong className="text-sm font-bold uppercase">{targetRecords[0].fullName}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Đơn vị công tác:</span>{' '}
                    <strong>{targetRecords[0].departmentName}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Chức vụ / Vị trí:</span>{' '}
                    <strong>{targetRecords[0].positionTitle}</strong>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Mã ngạch / HSL:</span>{' '}
                    <strong>{targetRecords[0].jobRankCode || '01.003'} &bull; HSL: {targetRecords[0].coefficient.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {/* Bảng chi tiết lương & trừ bảo hiểm */}
              {targetRecords[0] && (
                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr className="bg-slate-200 text-center font-bold">
                      <th className="border border-black p-2 text-left w-7/12">Khoản Mục Thu Nhập & Phụ Cấp</th>
                      <th className="border border-black p-2 text-right w-5/12">Số Tiền (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-2 font-medium">1. Lương ngạch bậc (HSL {targetRecords[0].coefficient.toFixed(2)} x {formatBaseSalary(baseSalary)})</td>
                      <td className="border border-black p-2 text-right font-mono">{targetRecords[0].salaryAmount.toLocaleString('vi-VN')}</td>
                    </tr>
                    {targetRecords[0].leadershipAllowanceAmount > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-medium">2. Phụ cấp chức vụ lãnh đạo (HSCV {targetRecords[0].leadershipAllowanceCoeff.toFixed(2)})</td>
                        <td className="border border-black p-2 text-right font-mono">{targetRecords[0].leadershipAllowanceAmount.toLocaleString('vi-VN')}</td>
                      </tr>
                    )}
                    {targetRecords[0].beyondFrameAmount > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-medium">3. Phụ cấp thâm niên vượt khung ({targetRecords[0].beyondFramePercent}%)</td>
                        <td className="border border-black p-2 text-right font-mono">{targetRecords[0].beyondFrameAmount.toLocaleString('vi-VN')}</td>
                      </tr>
                    )}
                    {targetRecords[0].publicServiceAllowanceAmount > 0 && (
                      <tr>
                        <td className="border border-black p-2 font-medium">4. Phụ cấp công vụ (25% đối với công chức)</td>
                        <td className="border border-black p-2 text-right font-mono">{targetRecords[0].publicServiceAllowanceAmount.toLocaleString('vi-VN')}</td>
                      </tr>
                    )}
                    {(targetRecords[0].responsibilityAllowanceAmount > 0 || targetRecords[0].industryAllowanceAmount > 0 || targetRecords[0].travelAllowanceAmount > 0) && (
                      <tr>
                        <td className="border border-black p-2 font-medium">5. Phụ cấp trách nhiệm / Ưu đãi nghề / Lưu động</td>
                        <td className="border border-black p-2 text-right font-mono">
                          {((targetRecords[0].responsibilityAllowanceAmount || 0) + (targetRecords[0].industryAllowanceAmount || 0) + (targetRecords[0].travelAllowanceAmount || 0)).toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-black p-2 uppercase">TỔNG CỘNG THU NHẬP (A)</td>
                      <td className="border border-black p-2 text-right font-mono text-sm">{targetRecords[0].totalGrossIncome.toLocaleString('vi-VN')}</td>
                    </tr>

                    {/* Các khoản trừ */}
                    <tr className="bg-slate-200 text-center font-bold">
                      <th className="border border-black p-2 text-left">Các Khoản Trích Nộp Theo Lương</th>
                      <th className="border border-black p-2 text-right">Số Tiền (VNĐ)</th>
                    </tr>
                    <tr>
                      <td className="border border-black p-2">1. Bảo hiểm xã hội trừ lương (BHXH 8%)</td>
                      <td className="border border-black p-2 text-right font-mono">{targetRecords[0].socialInsuranceEmp.toLocaleString('vi-VN')}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2">2. Bảo hiểm y tế trừ lương (BHYT 1.5%)</td>
                      <td className="border border-black p-2 text-right font-mono">{targetRecords[0].healthInsuranceEmp.toLocaleString('vi-VN')}</td>
                    </tr>
                    {targetRecords[0].unemploymentInsuranceEmp > 0 && (
                      <tr>
                        <td className="border border-black p-2">3. Bảo hiểm thất nghiệp trừ lương (BHTN 1%)</td>
                        <td className="border border-black p-2 text-right font-mono">{targetRecords[0].unemploymentInsuranceEmp.toLocaleString('vi-VN')}</td>
                      </tr>
                    )}
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-black p-2 uppercase">TỔNG CÁC KHOẢN TRÍCH NỘP (B)</td>
                      <td className="border border-black p-2 text-right font-mono text-sm">{targetRecords[0].totalDeductions.toLocaleString('vi-VN')}</td>
                    </tr>

                    {/* Thực lĩnh */}
                    <tr className="bg-slate-300 font-black text-sm">
                      <td className="border border-black p-2.5 uppercase text-black">THỰC LĨNH CHUYỂN KHOẢN (A - B)</td>
                      <td className="border border-black p-2.5 text-right font-mono text-base text-black">{targetRecords[0].netSalary.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Số tiền bằng chữ */}
              {targetRecords[0] && (
                <div className="text-xs font-serif italic pt-1">
                  <span className="font-bold not-italic">Số tiền thực lĩnh bằng chữ: </span>
                  <span className="underline decoration-dotted">{readVietnameseCurrency(targetRecords[0].netSalary)}</span>
                </div>
              )}

              {/* Chữ ký xác nhận */}
              <div className="pt-6 grid grid-cols-2 gap-6 text-center text-xs">
                <div>
                  <div className="font-bold uppercase">NGƯỜI NHẬN TIỀN</div>
                  <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-bold">{targetRecords[0]?.fullName}</div>
                </div>

                <div>
                  <div className="font-bold uppercase">NGƯỜI LẬP PHIẾU / THỦ QUỸ</div>
                  <div className="italic text-[11px] text-slate-500">(Ký, ghi rõ họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-bold">Trần Văn Hoàng</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls (Ẩn khi in) */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 print:hidden text-xs">
          <div className="text-slate-600">
            * Mẹo in: Chọn <strong>"Save as PDF"</strong> trong hộp thoại in để lưu file PDF gửi ban giám đốc hoặc cán bộ.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-200 rounded-xl font-bold text-slate-700 transition"
            >
              Đóng
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4 text-cyan-200" />
              <span>In Ngay</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
