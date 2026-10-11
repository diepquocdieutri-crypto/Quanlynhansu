import React, { useRef } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Building2, 
  Calendar, 
  User, 
  Coins, 
  Award, 
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { EmployeeCumulativeIncomeReport } from '../types/hrm';
import { MonthlyPayrollService, PAYROLL_CATEGORY_META } from '../services/monthlyPayrollService';
import { readVietnameseCurrency } from '../utils/salaryUtils';
import { getTodayVN } from '../utils/dateUtils';

interface IndividualIncomePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: EmployeeCumulativeIncomeReport | null;
  fromPeriod: string;
  toPeriod: string;
}

export const IndividualIncomePrintModal: React.FC<IndividualIncomePrintModalProps> = ({
  isOpen,
  onClose,
  report,
  fromPeriod,
  toPeriod,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !report) return null;

  const today = getTodayVN();

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    MonthlyPayrollService.exportIndividualIncomeReportToExcel(report, fromPeriod, toPeriod);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Header điều khiển (ẩn khi in) */}
        <div className="p-4 bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <TrendingUp className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>BÁO CÁO THỐNG KÊ THU NHẬP CÁ NHÂN QUA CÁC KỲ TÍNH LƯƠNG</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  {report.code}
                </span>
              </h2>
              <p className="text-xs text-sky-200 mt-0.5">
                Cán bộ: <strong>{report.fullName}</strong> &bull; Giai đoạn: <strong>{fromPeriod} &rarr; {toPeriod}</strong> ({report.monthCount} tháng)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Xuất bảng kê chi tiết ra file Excel"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="In hoặc lưu file PDF mẫu chuẩn nhà nước"
            >
              <Printer className="w-4 h-4" />
              <span>In / Lưu PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nội dung báo cáo chuẩn in ấn A4 */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 text-slate-900 font-sans print:overflow-visible print:p-0 print:space-y-4">
          <div ref={printAreaRef} className="space-y-6 print:space-y-4 max-w-4xl mx-auto">
            {/* Quốc hiệu & Tiêu ngữ */}
            <div className="grid grid-cols-2 gap-4 text-center items-start border-b border-slate-300 pb-4">
              <div>
                <div className="font-semibold text-xs tracking-wide uppercase text-slate-800">
                  ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH
                </div>
                <div className="font-bold text-xs tracking-wide uppercase text-slate-900 mt-0.5">
                  SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN
                </div>
                <div className="font-black text-xs sm:text-sm tracking-wide uppercase text-sky-950 mt-1 underline decoration-1 underline-offset-2">
                  CHI CỤC CHĂN NUÔI VÀ THÚ Y
                </div>
              </div>

              <div>
                <div className="font-bold text-xs sm:text-sm tracking-wide uppercase text-slate-900">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </div>
                <div className="font-bold text-xs tracking-wide text-slate-800 mt-0.5">
                  Độc lập - Tự do - Hạnh phúc
                </div>
                <div className="text-[11px] text-slate-500 italic mt-1">
                  TP. Hồ Chí Minh, {today}
                </div>
              </div>
            </div>

            {/* Tiêu đề Báo Cáo */}
            <div className="text-center space-y-1">
              <h1 className="text-base sm:text-lg font-black uppercase text-slate-950 tracking-wider">
                BẢNG TỔNG HỢP & XÁC NHẬN THU NHẬP CÁ NHÂN
              </h1>
              <p className="text-xs font-semibold text-slate-700 italic">
                (Thống kê quá trình chi trả tiền lương & thu nhập qua các kỳ tính lương)
              </p>
              <p className="text-xs font-bold text-sky-900 bg-sky-50 inline-block px-3 py-1 rounded-full border border-sky-200">
                Giai đoạn: Từ {fromPeriod} đến {toPeriod} &bull; Tổng số kỳ: {report.monthCount} tháng
              </p>
            </div>

            {/* Thông tin Cán Bộ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2.5 print:bg-transparent print:border-slate-300">
              <div>
                <span className="text-slate-500">Họ và tên cán bộ:</span>{' '}
                <strong className="text-slate-950 uppercase font-black">{report.fullName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Mã cán bộ nhân viên:</span>{' '}
                <strong className="font-mono text-slate-900">{report.code}</strong>
              </div>
              <div>
                <span className="text-slate-500">Đơn vị công tác:</span>{' '}
                <strong className="text-slate-900">{report.departmentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Chức vụ / Vị trí việc làm:</span>{' '}
                <strong className="text-slate-900">{report.positionTitle}</strong>
              </div>
              <div>
                <span className="text-slate-500">Ngạch lương công chức/viên chức:</span>{' '}
                <strong className="font-mono text-slate-900">{report.jobRankCode}</strong>
              </div>
              <div>
                <span className="text-slate-500">Phân loại nhân sự:</span>{' '}
                <strong className="text-slate-900">{PAYROLL_CATEGORY_META[report.category]?.title || report.category}</strong>
              </div>
            </div>

            {/* Bảng Chi Tiết Thu Nhập Từng Tháng */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 whitespace-nowrap text-center">
                    <th className="py-2 px-1.5 border-r border-slate-300">STT</th>
                    <th className="py-2 px-2 border-r border-slate-300">Kỳ Tháng</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">Lương Cơ Sở</th>
                    <th className="py-2 px-1.5 border-r border-slate-300 text-right">HSL</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">Lương HSL</th>
                    <th className="py-2 px-1.5 border-r border-slate-300 text-right">PCCV</th>
                    <th className="py-2 px-1.5 border-r border-slate-300 text-right">TNVK</th>
                    <th className="py-2 px-1.5 border-r border-slate-300 text-right">UDN</th>
                    <th className="py-2 px-1.5 border-r border-slate-300 text-right">PCCVụ</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right font-bold">Tổng PC</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right font-black">Tổng Gross</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right text-rose-800">Trích BHXH</th>
                    <th className="py-2 px-2.5 bg-emerald-50 text-emerald-950 font-black text-right border-r border-slate-300">
                      THỰC LĨNH
                    </th>
                    <th className="py-2 px-2 text-left">Ghi Chú / Quyết Định</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {report.monthlyFluctuations.map((f, idx) => (
                    <tr key={f.periodKey} className="whitespace-nowrap hover:bg-slate-50/50">
                      <td className="py-1.5 px-1.5 text-center text-slate-500 border-r border-slate-200 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2 font-mono font-bold text-slate-800 border-r border-slate-200">
                        {f.periodKey}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-600 border-r border-slate-200">
                        {f.baseSalary.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                        {f.coefficient.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-800 border-r border-slate-200">
                        {f.salaryAmount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {f.leadershipAllowanceAmount > 0 ? f.leadershipAllowanceAmount.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {f.beyondFrameAmount > 0 ? f.beyondFrameAmount.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {f.industryAllowanceAmount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {f.publicServiceAllowanceAmount > 0 ? f.publicServiceAllowanceAmount.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-900 border-r border-slate-200 bg-amber-50/20">
                        {f.totalAllowanceAmount.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-black text-blue-900 border-r border-slate-200 bg-blue-50/20">
                        {f.totalGrossIncome.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-rose-800 border-r border-slate-200">
                        -{f.totalDeductions.toLocaleString('vi-VN')}
                      </td>
                      <td className="py-1.5 px-2.5 text-right font-mono font-black text-emerald-900 bg-emerald-50/60 border-r border-slate-300">
                        {f.netSalary.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-1.5 px-2 text-slate-600 text-[10px] max-w-[150px] truncate" title={f.changeDescription}>
                        {f.changeDescription || 'Ổn định'}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900 whitespace-nowrap">
                    <td colSpan={2} className="py-2 px-2 text-center border-r border-slate-300 font-black uppercase">
                      TỔNG CỘNG
                    </td>
                    <td className="py-2 px-2 text-center text-slate-500 border-r border-slate-300 font-mono">
                      {report.monthCount} kỳ
                    </td>
                    <td className="py-2 px-1.5 text-center text-slate-500 border-r border-slate-300">-</td>
                    <td className="py-2 px-2 text-right font-mono border-r border-slate-300">
                      {report.totalSalaryAmount.toLocaleString('vi-VN')}
                    </td>
                    <td colSpan={4} className="py-2 px-1 text-center text-slate-500 border-r border-slate-300">-</td>
                    <td className="py-2 px-2 text-right font-mono text-amber-900 border-r border-slate-300 font-bold">
                      {report.totalAllowanceAmount.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-blue-900 border-r border-slate-300 font-black">
                      {report.totalGrossIncome.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-rose-900 border-r border-slate-300">
                      -{report.totalDeductions.toLocaleString('vi-VN')}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-black text-emerald-950 bg-emerald-100/70 border-r border-slate-400">
                      {report.totalNetSalary.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-2 text-[10px] text-slate-600 italic">
                      BQ: {report.averageMonthlyNetSalary.toLocaleString('vi-VN')} đ/tháng
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Số Tiền Bằng Chữ */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 print:bg-transparent print:border-slate-300">
              <div>
                <span className="text-slate-600">Tổng thu nhập thực lĩnh lũy kế bằng chữ:</span>{' '}
                <strong className="text-slate-900 italic capitalize">
                  {readVietnameseCurrency(report.totalNetSalary)}
                </strong>.
              </div>
              <div>
                <span className="text-slate-600">Thu nhập thực lĩnh bình quân mỗi tháng:</span>{' '}
                <strong className="font-mono text-emerald-800">
                  {report.averageMonthlyNetSalary.toLocaleString('vi-VN')} đ/tháng
                </strong>{' '}
                <span className="text-slate-500 italic">({readVietnameseCurrency(report.averageMonthlyNetSalary)})</span>.
              </div>
            </div>

            {/* Chữ Ký Xác Nhận Chuẩn Hành Chính */}
            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs print:pt-4">
              <div className="space-y-16">
                <div>
                  <div className="font-bold text-slate-800 uppercase">NGƯỜI LẬP BIỂU</div>
                  <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                </div>
                <div className="font-bold text-slate-900 pt-8">Bộ phận Kế toán - Lương</div>
              </div>

              <div className="space-y-16">
                <div>
                  <div className="font-bold text-slate-800 uppercase">KẾ TOÁN TRƯỞNG</div>
                  <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                </div>
                <div className="font-bold text-slate-900 pt-8">Phụ trách Tài chính - Kế toán</div>
              </div>

              <div className="space-y-16">
                <div>
                  <div className="font-bold text-slate-900 uppercase">CHI CỤC TRƯỞNG</div>
                  <div className="text-[11px] text-slate-500 italic">(Ký, đóng dấu, họ tên)</div>
                </div>
                <div className="font-bold text-slate-950 uppercase pt-8">Thủ trưởng đơn vị</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
