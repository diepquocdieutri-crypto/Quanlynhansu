import React, { useState } from 'react';
import { GraduationCap, Award, Shield, CheckCircle2, FileText, Download, Search, ExternalLink, Eye, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Employee } from '../types/hrm';

interface TrainingManagementViewProps {
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
}

export const TrainingManagementView: React.FC<TrainingManagementViewProps> = ({
  employees,
  onSelectEmployee,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDegree, setFilterDegree] = useState('ALL');

  const doctorOfVeterinary = employees.filter(e => e.education.highestDegree === 'Tiến sĩ');
  const masterOfVeterinary = employees.filter(e => e.education.highestDegree === 'Thạc sĩ');
  const bachelorDegree = employees.filter(e => e.education.highestDegree === 'Đại học');

  const caoCapLLCT = employees.filter(e => e.education.politicalTheory === 'Cao cấp');
  const trungCapLLCT = employees.filter(e => e.education.politicalTheory === 'Trung cấp');

  const filteredEmployees = employees.filter(e => {
    if (filterDegree !== 'ALL' && e.education.highestDegree !== filterDegree) return false;
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchName = e.fullName.toLowerCase().includes(q);
      const matchCode = e.code.toLowerCase().includes(q);
      const matchMajor = e.education.major.toLowerCase().includes(q);
      const matchSchool = e.education.school.toLowerCase().includes(q);
      const matchDept = e.departmentName.toLowerCase().includes(q);
      return matchName || matchCode || matchMajor || matchSchool || matchDept;
    }
    return true;
  });

  // Xuất trang tính "DaoTaoBoiDuong" chuẩn cấu trúc đầy đủ tiêu đề cột
  const exportToExcel = () => {
    let stt = 1;
    const rows: any[] = [];

    filteredEmployees.forEach(emp => {
      if (emp.trainingHistory && emp.trainingHistory.length > 0) {
        emp.trainingHistory.forEach(th => {
          rows.push({
            'STT': stt++,
            'Mã Nhân Viên': emp.code,
            'Họ Và Tên': emp.fullName,
            'Đơn Vị / Phòng / Trạm': emp.departmentName,
            'Chức Vụ / Vị Trí': emp.positionTitle,
            'Trình Độ Chuyên Môn': emp.education.highestDegree,
            'Chuyên Ngành Đào Tạo': emp.education.major,
            'Cơ Sở Đào Tạo (Trường)': emp.education.school,
            'Năm Tốt Nghiệp': emp.education.gradYear,
            'Chứng Chỉ Hành Nghề Thú Y': emp.education.veterinaryCert || 'Không',
            'Lý Luận Chính Trị': emp.education.politicalTheory,
            'Bồi Dưỡng QLNN (Quản Lý Nhà Nước)': emp.stateManagementLevel || 'Đạt chuẩn ngạch chức danh',
            'Trình Độ Ngoại Ngữ': emp.education.foreignLanguage,
            'Trình Độ Tin Học': emp.education.informatics,
            'Tên Khóa Bồi Dưỡng / Tập Huấn': th.courseName,
            'Cơ Sở Tổ Chức Bồi Dưỡng': th.institution,
            'Thời Gian Bắt Đầu': th.startDate,
            'Thời Gian Kết Thúc': th.endDate,
            'Hình Thức Bồi Dưỡng': th.form,
            'Văn Bằng / Chứng Chỉ Được Cấp': th.certificateName || 'Chứng chỉ hoàn thành',
            'Ghi Chú': 'Đã hoàn thành khóa học'
          });
        });
      } else {
        rows.push({
          'STT': stt++,
          'Mã Nhân Viên': emp.code,
          'Họ Và Tên': emp.fullName,
          'Đơn Vị / Phòng / Trạm': emp.departmentName,
          'Chức Vụ / Vị Trí': emp.positionTitle,
          'Trình Độ Chuyên Môn': emp.education.highestDegree,
          'Chuyên Ngành Đào Tạo': emp.education.major,
          'Cơ Sở Đào Tạo (Trường)': emp.education.school,
          'Năm Tốt Nghiệp': emp.education.gradYear,
          'Chứng Chỉ Hành Nghề Thú Y': emp.education.veterinaryCert || 'Chứng chỉ hành nghề Thú y',
          'Lý Luận Chính Trị': emp.education.politicalTheory,
          'Bồi Dưỡng QLNN (Quản Lý Nhà Nước)': emp.stateManagementLevel || 'Đạt chuẩn ngạch chức danh',
          'Trình Độ Ngoại Ngữ': emp.education.foreignLanguage,
          'Trình Độ Tin Học': emp.education.informatics,
          'Tên Khóa Bồi Dưỡng / Tập Huấn': `Bồi dưỡng nghiệp vụ chuyên ngành ${emp.education.major}`,
          'Cơ Sở Tổ Chức Bồi Dưỡng': emp.education.school,
          'Thời Gian Bắt Đầu': emp.recruitmentDate || '2020-01-01',
          'Thời Gian Kết Thúc': 'Đạt chuẩn chức danh',
          'Hình Thức Bồi Dưỡng': 'Tập trung',
          'Văn Bằng / Chứng Chỉ Được Cấp': `${emp.education.highestDegree} - ${emp.education.major}`,
          'Ghi Chú': 'Hồ sơ chuyên môn Thú y'
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DaoTaoBoiDuong');
    XLSX.writeFile(wb, 'DaoTaoBoiDuong_ChiCucThuY.xlsx');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto text-xs">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-sky-600" />
            <span>QUẢN LÝ ĐÀO TẠO, BỒI DƯỠNG & CHỨNG CHỈ THÚ Y</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Dữ liệu đồng bộ trang tính <strong>DaoTaoBoiDuong</strong> &bull; Thống kê học vị chuyên môn, trình độ lý luận chính trị & chứng chỉ hành nghề thú y
          </p>
        </div>

        <button
          onClick={exportToExcel}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-1.5 self-start sm:self-center"
        >
          <Download className="w-4 h-4" />
          <span>Xuất File Excel (Trang tính DaoTaoBoiDuong)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 font-medium">Tiến sĩ Thú y</span>
          <div className="text-2xl font-black text-sky-900 mt-1">{doctorOfVeterinary.length} cán bộ</div>
          <div className="text-[10px] text-sky-600 mt-0.5">Chuyên gia nghiên cứu</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 font-medium">Thạc sĩ Dịch tễ / Thú y</span>
          <div className="text-2xl font-black text-blue-900 mt-1">{masterOfVeterinary.length} cán bộ</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Cán bộ quy hoạch</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 font-medium">Đại học (Bác sĩ thú y)</span>
          <div className="text-2xl font-black text-teal-900 mt-1">{bachelorDegree.length} cán bộ</div>
          <div className="text-[10px] text-teal-600 mt-0.5">Lực lượng nòng cốt</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 font-medium">Cao cấp Lý luận CT</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">{caoCapLLCT.length} cán bộ</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">Ban Lãnh đạo & Trưởng phòng</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 font-medium">Trung cấp Lý luận CT</span>
          <div className="text-2xl font-black text-purple-900 mt-1">{trungCapLLCT.length} cán bộ</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Phó phòng & Trạm trưởng</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên, mã NV, chuyên ngành, trường đào tạo..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 shrink-0">Học vị:</span>
          <select
            value={filterDegree}
            onChange={(e) => setFilterDegree(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
          >
            <option value="ALL">Tất cả trình độ</option>
            <option value="Tiến sĩ">Tiến sĩ</option>
            <option value="Thạc sĩ">Thạc sĩ</option>
            <option value="Đại học">Đại học</option>
            <option value="Cao đẳng">Cao đẳng</option>
            <option value="Trung cấp">Trung cấp</option>
            <option value="Sơ cấp">Sơ cấp</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      {/* Staff Table with Full Columns matching DaoTaoBoiDuong */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-800 border-b flex items-center justify-between">
          <span className="uppercase tracking-wider text-[11px]">
            DANH SÁCH ĐÀO TẠO BỒI DƯỠNG & CHỨNG CHỈ THÚ Y (TRANG TÍNH: DAOTAOBOIDUONG)
          </span>
          <span className="text-slate-500 font-normal">{filteredEmployees.length} cán bộ</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">STT</th>
                <th className="py-2.5 px-3">Cán Bộ / Mã NV</th>
                <th className="py-2.5 px-3">Đơn Vị & Chức Vụ</th>
                <th className="py-2.5 px-3">Học Vị / Chuyên Ngành</th>
                <th className="py-2.5 px-3">Cơ Sở Đào Tạo (Năm TN)</th>
                <th className="py-2.5 px-3">Lý Luận Chính Trị</th>
                <th className="py-2.5 px-3">Chứng Chỉ Thú Y & Hành Nghề</th>
                <th className="py-2.5 px-3">Ngoại Ngữ / Tin Học</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không tìm thấy dữ liệu phù hợp.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-sky-50/50 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div 
                        onClick={() => onSelectEmployee(emp)}
                        className="font-bold text-slate-900 hover:text-sky-600 cursor-pointer"
                      >
                        {emp.fullName}
                      </div>
                      <div className="font-mono text-[10px] text-sky-700 bg-sky-50 inline-block px-1 rounded border border-sky-200 mt-0.5">
                        {emp.code}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{emp.departmentName}</div>
                      <div className="text-[10px] text-slate-500">{emp.positionTitle}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-sky-800">{emp.education.highestDegree}</span>
                      <div className="text-[11px] text-slate-700 font-medium">{emp.education.major}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <div>{emp.education.school}</div>
                      <div className="text-[10px] text-slate-400">Tốt nghiệp: {emp.education.gradYear}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        emp.education.politicalTheory === 'Cao cấp' ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' :
                        emp.education.politicalTheory === 'Trung cấp' ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {emp.education.politicalTheory}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-emerald-800 font-medium text-[11px]">
                        {emp.education.veterinaryCert || 'Chứng chỉ hành nghề Thú y'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      <div>NN: <strong className="text-slate-800">{emp.education.foreignLanguage}</strong></div>
                      <div>TH: <strong className="text-slate-800">{emp.education.informatics}</strong></div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectEmployee(emp)}
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded font-semibold text-xs transition"
                      >
                        Hồ sơ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
