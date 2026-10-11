import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Upload,
  Download,
  Filter,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
  User,
  Zap
} from 'lucide-react';
import { Employee, OtherIncomeItem } from '../types/hrm';
import { QuarterlyTaxService } from '../services/quarterlyTaxService';

interface OtherIncomeManagementSectionProps {
  employees: Employee[];
  selectedQuarter: 1 | 2 | 3 | 4;
  selectedYear: number;
  otherIncomes: OtherIncomeItem[];
  onAddNew: () => void;
  onOpenExcelImport: () => void;
  onEditItem: (item: OtherIncomeItem) => void;
  onDeleteItem: (id: string) => void;
  onTriggerQuarterlyAggregation: () => void;
}

export const OtherIncomeManagementSection: React.FC<OtherIncomeManagementSectionProps> = ({
  employees,
  selectedQuarter,
  selectedYear,
  otherIncomes,
  onAddNew,
  onOpenExcelImport,
  onEditItem,
  onDeleteItem,
  onTriggerQuarterlyAggregation,
}) => {
  const [viewMode, setViewMode] = useState<'DETAILS_LIST' | 'CUMULATIVE_PROGRESSIVE'>('DETAILS_LIST');
  const [monthFilter, setMonthFilter] = useState<number | 'ALL'>('ALL');
  const [empFilter, setEmpFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const quarterMonths = useMemo(() => {
    return selectedQuarter === 1 ? [1, 2, 3] : selectedQuarter === 2 ? [4, 5, 6] : selectedQuarter === 3 ? [7, 8, 9] : [10, 11, 12];
  }, [selectedQuarter]);

  // Lọc danh sách chi tiết
  const filteredItems = useMemo(() => {
    return otherIncomes.filter(item => {
      if (item.year !== selectedYear) return false;
      if (monthFilter !== 'ALL' && item.month !== monthFilter) return false;
      if (empFilter !== 'ALL' && item.employeeCode !== empFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.employeeName.toLowerCase().includes(q);
        const matchCode = item.employeeCode.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDesc) return false;
      }

      return true;
    });
  }, [otherIncomes, selectedYear, monthFilter, empFilter, searchTerm]);

  // Thống kê nhanh theo Quý hiện hành
  const quarterStats = useMemo(() => {
    const qItems = otherIncomes.filter(
      item => item.year === selectedYear && quarterMonths.includes(item.month)
    );
    const totalQuarterAmount = qItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const uniqueStaff = new Set(qItems.map(i => i.employeeCode)).size;

    const totalYearAmount = otherIncomes
      .filter(item => item.year === selectedYear)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return {
      quarterItemsCount: qItems.length,
      totalQuarterAmount,
      uniqueStaff,
      totalYearAmount,
    };
  }, [otherIncomes, selectedYear, quarterMonths]);

  // Bảng tra cứu lũy tiến gom theo cán bộ
  const progressiveStaffList = useMemo(() => {
    return employees.map(emp => {
      const empItemsYear = otherIncomes.filter(
        i => i.year === selectedYear && i.employeeCode === emp.code
      );
      const totalYear = empItemsYear.reduce((s, i) => s + i.amount, 0);

      const m1Items = empItemsYear.filter(i => i.month === quarterMonths[0]);
      const m2Items = empItemsYear.filter(i => i.month === quarterMonths[1]);
      const m3Items = empItemsYear.filter(i => i.month === quarterMonths[2]);

      const m1Total = m1Items.reduce((s, i) => s + i.amount, 0);
      const m2Total = m2Items.reduce((s, i) => s + i.amount, 0);
      const m3Total = m3Items.reduce((s, i) => s + i.amount, 0);
      const quarterTotal = m1Total + m2Total + m3Total;

      return {
        employeeCode: emp.code,
        fullName: emp.fullName,
        departmentName: emp.departmentName || '',
        m1Total,
        m2Total,
        m3Total,
        quarterTotal,
        totalYear,
        itemsCountYear: empItemsYear.length,
      };
    }).filter(row => {
      if (empFilter !== 'ALL' && row.employeeCode !== empFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (!row.fullName.toLowerCase().includes(q) && !row.employeeCode.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [employees, otherIncomes, selectedYear, quarterMonths, empFilter, searchTerm]);

  return (
    <div className="p-5 space-y-5">
      {/* Header & Chỉ số thống kê */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <span>THU NHẬP KHÁC</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu cung cấp trực tiếp cho cột <strong>"Thu Nhập Khác"</strong> trong bảng Thống Kê Thu Nhập Quý &amp; Tính Thuế TNCN.
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onTriggerQuarterlyAggregation}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition active:scale-95"
            title="Gom tất cả các khoản chi tiết thu nhập khác của 3 tháng vào Quý"
          >
            <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>Gom &amp; Tính Thu Nhập Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]}</span>
          </button>

          <button
            onClick={onOpenExcelImport}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95"
          >
            <Upload className="w-4 h-4" />
            <span>Đưa Lên Từ File Excel</span>
          </button>

          <button
            onClick={onAddNew}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nhập Mới</span>
          </button>
        </div>
      </div>

      {/* Thẻ chỉ số gom Quý */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-xl">
          <div className="text-[11px] font-bold text-indigo-700 uppercase">Gom Thu Nhập Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]}</div>
          <div className="text-lg font-black text-indigo-950 mt-1">
            {quarterStats.totalQuarterAmount.toLocaleString('vi-VN')} <span className="text-xs">đ</span>
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">
            {quarterStats.quarterItemsCount} khoản / {quarterStats.uniqueStaff} cán bộ
          </div>
        </div>

        <div className="bg-sky-50/70 border border-sky-200 p-3.5 rounded-xl">
          <div className="text-[11px] font-bold text-sky-700 uppercase">Tháng {quarterMonths[0]}</div>
          <div className="text-base font-black text-sky-950 mt-1">
            {otherIncomes
              .filter(i => i.year === selectedYear && i.month === quarterMonths[0])
              .reduce((s, i) => s + i.amount, 0)
              .toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-sky-600 mt-0.5">Kỳ đầu quý</div>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Tháng {quarterMonths[1]}</div>
          <div className="text-base font-black text-emerald-950 mt-1">
            {otherIncomes
              .filter(i => i.year === selectedYear && i.month === quarterMonths[1])
              .reduce((s, i) => s + i.amount, 0)
              .toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Kỳ giữa quý</div>
        </div>

        <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-xl">
          <div className="text-[11px] font-bold text-purple-700 uppercase">Lũy Kế Cả Năm {selectedYear}</div>
          <div className="text-base font-black text-purple-950 mt-1">
            {quarterStats.totalYearAmount.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-purple-600 mt-0.5">Tổng các khoản khác cả năm</div>
        </div>
      </div>

      {/* Thanh chuyển chế độ & bộ lọc */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Toggle Chế độ xem */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
          <button
            onClick={() => setViewMode('DETAILS_LIST')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              viewMode === 'DETAILS_LIST'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Danh Sách Chi Tiết ({filteredItems.length})
          </button>
          <button
            onClick={() => setViewMode('CUMULATIVE_PROGRESSIVE')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 ${
              viewMode === 'CUMULATIVE_PROGRESSIVE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Tra Cứu Lũy Tiến / Lũy Kế
          </button>
        </div>

        {/* Bộ lọc */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'DETAILS_LIST' && (
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Tất cả tháng</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
          )}

          <select
            value={empFilter}
            onChange={(e) => setEmpFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px]"
          >
            <option value="ALL">Tất cả cán bộ</option>
            {employees.map(emp => (
              <option key={emp.code} value={emp.code}>
                {emp.code} - {emp.fullName}
              </option>
            ))}
          </select>

          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 1: DANH SÁCH CHI TIẾT CÁC KHOẢN THU NHẬP KHÁC */}
      {/* ========================================================================= */}
      {viewMode === 'DETAILS_LIST' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-[550px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider font-bold border-b border-slate-300 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12">STT</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[95px]">Kỳ Tháng</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[100px]">Mã NV</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Họ và Tên Cán Bộ</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Phòng Ban / Đơn Vị</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[220px]">Nội Dung Thu Nhập</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[125px]">Số Tiền (VNĐ)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[85px]">Nguồn</th>
                <th className="py-2.5 px-3 border-r border-slate-200 min-w-[130px]">Ghi Chú</th>
                <th className="py-2.5 px-3 text-center min-w-[80px]">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không có khoản thu nhập khác nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-indigo-900">
                      Tháng {item.month}/{item.year}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                      {item.employeeCode}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                      {item.employeeName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[160px]">
                      {item.departmentName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800">
                      {item.description}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-black text-indigo-950 bg-indigo-50/40">
                      {item.amount.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.source === 'IMPORT_EXCEL'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}>
                        {item.source === 'IMPORT_EXCEL' ? 'Excel' : 'Nhập tay'}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-500 text-[11px] truncate max-w-[130px]">
                      {item.notes || '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-1 hover:bg-slate-200 text-indigo-600 rounded transition"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded transition"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot className="bg-slate-100 font-black text-slate-900 sticky bottom-0 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="py-2.5 px-3 text-center uppercase border-r border-slate-200">
                    TỔNG CỘNG ({filteredItems.length} khoản)
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200 text-indigo-950 font-black text-sm">
                    {filteredItems.reduce((s, i) => s + i.amount, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 text-center">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHẾ ĐỘ 2: BẢNG TRA CỨU LŨY TIẾN / LŨY KẾ THEO CÁN BỘ */}
      {/* ========================================================================= */}
      {viewMode === 'CUMULATIVE_PROGRESSIVE' && (
        <div className="space-y-3">
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-center justify-between">
            <span>
              Bảng tra cứu lũy tiến thu nhập khác: Cho phép đối chiếu từ Tháng ➔ Quý {['I', 'II', 'III', 'IV'][selectedQuarter - 1]} ➔ Lũy kế cả năm của từng cán bộ.
            </span>
            <span className="font-bold">
              Kỳ Quý gồm: Tháng {quarterMonths[0]}, {quarterMonths[1]}, {quarterMonths[2]}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-[550px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-800 uppercase tracking-wider font-bold border-b border-slate-300 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12">STT</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[100px]">Mã NV</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Họ và Tên Cán Bộ</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 min-w-[160px]">Phòng Ban</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">
                    Thu Nhập T{quarterMonths[0]}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">
                    Thu Nhập T{quarterMonths[1]}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[115px] bg-slate-50">
                    Thu Nhập T{quarterMonths[2]}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[130px] font-black bg-indigo-50 text-indigo-950">
                    GOM THU NHẬP QUÝ
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right min-w-[130px] font-black text-purple-950 bg-purple-50">
                    LŨY KẾ CẢ NĂM
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[80px]">Số Lần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {progressiveStaffList.map((row, idx) => (
                  <tr key={row.employeeCode} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                      {row.employeeCode}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                      {row.fullName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-slate-600 truncate max-w-[160px]">
                      {row.departmentName}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 bg-slate-50/50">
                      {row.m1Total.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 bg-slate-50/50">
                      {row.m2Total.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700 bg-slate-50/50">
                      {row.m3Total.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-black text-indigo-950 bg-indigo-50/70">
                      {row.quarterTotal.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right font-black text-purple-950 bg-purple-50/70">
                      {row.totalYear.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold text-[11px]">
                        {row.itemsCountYear}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-black text-slate-900 sticky bottom-0 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-center uppercase border-r border-slate-200">
                    TỔNG CỘNG ({progressiveStaffList.length} cán bộ)
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200">
                    {progressiveStaffList.reduce((s, r) => s + r.m1Total, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200">
                    {progressiveStaffList.reduce((s, r) => s + r.m2Total, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200">
                    {progressiveStaffList.reduce((s, r) => s + r.m3Total, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200 text-indigo-950 font-black text-sm">
                    {progressiveStaffList.reduce((s, r) => s + r.quarterTotal, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-2.5 px-3 text-right border-r border-slate-200 text-purple-950 font-black text-sm">
                    {progressiveStaffList.reduce((s, r) => s + r.totalYear, 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="py-2.5 px-3 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
