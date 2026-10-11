import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Filter, 
  FileSpreadsheet, 
  Calendar, 
  CheckCircle2, 
  Users 
} from 'lucide-react';
import { Employee, Department } from '../types/hrm';
import * as XLSX from 'xlsx';

interface ReportsViewProps {
  employees: Employee[];
  departments: Department[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  employees,
  departments,
}) => {
  const [reportType, setReportType] = useState<
    'staff' | 'quota' | 'age' | 'gender' | 'education' | 'rank' | 'salary' | 'retirement'
  >('staff');

  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStaffType, setFilterStaffType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('Đang công tác');

  // Lọc danh sách theo tiêu chí
  const filteredList = employees.filter(e => {
    if (filterDept !== 'ALL' && e.departmentId !== filterDept) return false;
    if (filterStaffType !== 'ALL' && e.staffType !== filterStaffType) return false;
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    return true;
  });

  const handleExportExcel = () => {
    const data = filteredList.map((emp, i) => ({
      'STT': i + 1,
      'Mã Nhân Viên': emp.code,
      'Họ Và Tên': emp.fullName,
      'Giới Tính': emp.gender,
      'Ngày Sinh': emp.dob,
      'Đơn Vị': emp.departmentName,
      'Chức Vụ': emp.positionTitle,
      'Ngạch': emp.jobRankCode,
      'Loại Nhân Sự': emp.staffType,
      'Trình Độ': emp.education.highestDegree,
      'Chuyên Ngành': emp.education.major,
      'Bậc Lương': emp.salary.step,
      'Hệ Số': emp.salary.coefficient,
      'Tình Trạng': emp.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCao');
    XLSX.writeFile(wb, `BaoCao_NhanSu_${reportType}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-sky-600" />
            <span>BÁO CÁO & THỐNG KÊ NHÂN SỰ HÀNH CHÍNH</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Tổng hợp dữ liệu biên chế, chức danh, độ tuổi, trình độ & xuất báo cáo theo mẫu nhà nước
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
          >
            <Printer className="w-4 h-4" />
            <span>In Báo Cáo / Xuất PDF</span>
          </button>
        </div>
      </div>

      {/* Filter criteria (Prompt #15 layout) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b">
          <Filter className="w-4 h-4 text-sky-600" />
          <span>BỘ LỌC THỐNG KÊ ĐA CHIỀU</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Loại báo cáo</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-900"
            >
              <option value="staff">Báo cáo danh sách nhân sự tổng hợp</option>
              <option value="salary">Báo cáo bảng lương và các khoản phụ cấp</option>
              <option value="quota">Báo cáo định biên & cơ cấu tổ chức</option>
              <option value="age">Báo cáo độ tuổi cán bộ</option>
              <option value="gender">Báo cáo cơ cấu giới tính</option>
              <option value="education">Báo cáo trình độ chuyên môn & LLCT</option>
              <option value="rank">Báo cáo chức danh & ngạch lương</option>
              <option value="retirement">Báo cáo lộ trình nghỉ hưu</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Đơn vị / Phòng / Trạm</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="ALL">Tất cả đơn vị (14 phòng/trạm)</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Loại nhân sự</label>
            <select
              value={filterStaffType}
              onChange={(e) => setFilterStaffType(e.target.value)}
              className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="ALL">Tất cả loại nhân sự</option>
              <option value="Công chức">Công chức</option>
              <option value="Viên chức">Viên chức</option>
              <option value="Hợp đồng lao động">Hợp đồng lao động</option>
              <option value="Hợp đồng 68/111">Hợp đồng 68/111</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Trạng thái công tác</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Đang công tác">Đang công tác</option>
              <option value="Nghỉ hưu">Nghỉ hưu</option>
              <option value="Thôi việc">Thôi việc</option>
              <option value="Chuyển công tác">Chuyển công tác</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Preview Document */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 print:border-none print:shadow-none">
        {/* State Report Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start pb-4 border-b border-slate-300 text-slate-800">
          <div>
            <div className="uppercase font-semibold text-xs">SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN</div>
            <div className="uppercase font-black text-sm text-sky-950">CHI CỤC CHĂN NUÔI VÀ THÚ Y TPHCM</div>
            <div className="text-[10px] text-slate-500">Số: ....../BC-CCTY</div>
          </div>

          <div className="text-right text-xs mt-2 sm:mt-0">
            <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="font-semibold">Độc lập - Tự do - Hạnh phúc</div>
            <div className="text-[10px] text-slate-500 italic mt-1">TP. Hồ Chí Minh, ngày 24 tháng 09 năm 2026</div>
          </div>
        </div>

        {/* Report Title */}
        <div className="text-center py-2">
          <h3 className="text-base font-black uppercase text-slate-900 tracking-wide">
            {reportType === 'salary' 
              ? 'BÁO CÁO THỐNG KÊ TIỀN LƯƠNG VÀ CÁC KHOẢN PHỤ CẤP'
              : 'BÁO CÁO THỐNG KÊ ĐỘI NGŨ CÔNG CHỨC, VIÊN CHỨC VÀ NGƯỜI LAO ĐỘNG'}
          </h3>
          <div className="text-xs text-slate-500 italic mt-0.5">
            (Số liệu thực tế: {filteredList.length} hồ sơ trích xuất)
          </div>
        </div>

        {/* Preview Table */}
        <div className="overflow-x-auto">
          {reportType === 'salary' ? (
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold text-slate-800 border-b uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2 border-r text-center w-10">STT</th>
                  <th className="py-2 px-3 border-r">Mã NV</th>
                  <th className="py-2 px-3 border-r">Họ Và Tên</th>
                  <th className="py-2 px-3 border-r">Đơn Vị</th>
                  <th className="py-2 px-3 border-r">Chức Vụ</th>
                  <th className="py-2 px-2 border-r text-center">Ngạch</th>
                  <th className="py-2 px-2 border-r text-center">Bậc</th>
                  <th className="py-2 px-2 border-r text-center">HSL</th>
                  <th className="py-2 px-2 border-r text-center">PCCV</th>
                  <th className="py-2 px-2 border-r text-center">VK (%)</th>
                  <th className="py-2 px-3 border-r text-right">Lương Cơ Bản</th>
                  <th className="py-2 px-2 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((emp, idx) => {
                  const base = emp.salary?.baseSalary || 2340000;
                  const coeff = emp.salary?.coefficient || 2.34;
                  const salaryAmt = Math.round(coeff * base);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="py-2 px-2 border-r text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 border-r font-mono font-semibold text-slate-700">{emp.code}</td>
                      <td className="py-2 px-3 border-r font-bold text-slate-900">{emp.fullName}</td>
                      <td className="py-2 px-3 border-r text-slate-700">{emp.departmentName}</td>
                      <td className="py-2 px-3 border-r font-medium text-slate-800">{emp.positionTitle}</td>
                      <td className="py-2 px-2 border-r text-center font-mono">{emp.jobRankCode}</td>
                      <td className="py-2 px-2 border-r text-center">{emp.salary.step}</td>
                      <td className="py-2 px-2 border-r text-center font-bold">{coeff.toFixed(2)}</td>
                      <td className="py-2 px-2 border-r text-center">{Number(emp.salary.leadershipAllowance || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r text-center">{emp.salary.seniorityAllowancePercent || 0}%</td>
                      <td className="py-2 px-3 border-r text-right font-medium">{salaryAmt.toLocaleString('vi-VN')} đ</td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[10px] font-semibold">{emp.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-bold text-slate-800 border-b uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-2 border-r text-center w-10">STT</th>
                  <th className="py-2 px-3 border-r">Mã NV</th>
                  <th className="py-2 px-3 border-r">Họ Và Tên</th>
                  <th className="py-2 px-2 border-r text-center">Giới Tính</th>
                  <th className="py-2 px-2 border-r text-center">Năm Sinh</th>
                  <th className="py-2 px-3 border-r">Đơn Vị Trực Thuộc</th>
                  <th className="py-2 px-3 border-r">Chức Vụ</th>
                  <th className="py-2 px-2 border-r text-center">Ngạch / Bậc</th>
                  <th className="py-2 px-3 border-r">Trình Độ Học Vấn</th>
                  <th className="py-2 px-2 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2 border-r text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border-r font-mono font-semibold text-slate-700">{emp.code}</td>
                    <td className="py-2 px-3 border-r font-bold text-slate-900">{emp.fullName}</td>
                    <td className="py-2 px-2 border-r text-center">{emp.gender}</td>
                    <td className="py-2 px-2 border-r text-center">{emp.dob.split('-')[0]}</td>
                    <td className="py-2 px-3 border-r text-slate-700">{emp.departmentName}</td>
                    <td className="py-2 px-3 border-r font-medium text-slate-800">{emp.positionTitle}</td>
                    <td className="py-2 px-2 border-r text-center font-mono">
                      {emp.jobRankCode} (Bậc {emp.salary.step})
                    </td>
                    <td className="py-2 px-3 border-r">{emp.education.highestDegree} ({emp.education.major})</td>
                    <td className="py-2 px-2 text-center">
                      <span className="text-[10px] font-semibold">{emp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Signatures */}
        <div className="pt-8 flex justify-between items-start text-xs text-slate-800">
          <div className="text-center w-64">
            <div className="font-bold uppercase">NGƯỜI LẬP BÁO CÁO</div>
            <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký và ghi rõ họ tên)</div>
            <div className="mt-14 font-bold">Lê Thị Thu Thủy</div>
            <div className="text-[11px] text-slate-500">Chuyên viên Tổ chức Cán bộ</div>
          </div>

          <div className="text-center w-64">
            <div className="font-bold uppercase">CHI CỤC TRƯỞNG</div>
            <div className="text-[10px] text-slate-500 italic mt-0.5">(Ký tên và đóng dấu)</div>
            <div className="mt-14 font-bold text-sky-950">Trần Phú Cường</div>
            <div className="text-[11px] text-slate-500">Chi cục trưởng</div>
          </div>
        </div>
      </div>
    </div>
  );
};
