import React, { useState, useRef, useEffect } from 'react';
import { 
  Briefcase, 
  ArrowRight, 
  FileCheck, 
  Plus, 
  History, 
  CheckCircle2, 
  User, 
  Search, 
  X, 
  ChevronDown, 
  Building2 
} from 'lucide-react';
import { Employee, Department, WorkHistoryRecord } from '../types/hrm';
import { formatDateVN } from '../utils/dateUtils';

interface WorkHistoryMovementViewProps {
  employees: Employee[];
  departments: Department[];
  onExecuteMovement: (
    employeeId: string,
    newDepartmentId: string,
    newPosition: string,
    decisionNumber: string,
    effectiveDate: string,
    signedBy: string,
    notes: string
  ) => void;
  onSelectEmployee: (emp: Employee) => void;
  initialEmployeeId?: string;
}

export const WorkHistoryMovementView: React.FC<WorkHistoryMovementViewProps> = ({
  employees,
  departments,
  onExecuteMovement,
  onSelectEmployee,
  initialEmployeeId,
}) => {
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState(
    initialEmployeeId || employees.find(e => e.status === 'Đang công tác')?.id || employees[0]?.id || ''
  );
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const empDropdownRef = useRef<HTMLDivElement>(null);

  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const [newDeptId, setNewDeptId] = useState(departments[1]?.id || departments[0]?.id || '');
  const [newPosition, setNewPosition] = useState('');
  const [decisionNumber, setDecisionNumber] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [signedBy, setSignedBy] = useState('Chi cục trưởng Chi cục Chăn nuôi & Thú y');
  const [movementType, setMovementType] = useState<'Điều động' | 'Bổ nhiệm' | 'Biệt phái' | 'Luân chuyển'>('Điều động');
  const [notes, setNotes] = useState('');

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (empDropdownRef.current && !empDropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cập nhật selectedEmpId nếu initialEmployeeId thay đổi
  useEffect(() => {
    if (initialEmployeeId) {
      setSelectedEmpId(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  const activeEmployees = employees.filter(e => e.status === 'Đang công tác');
  const selectedEmployee = employees.find(e => e.id === selectedEmpId) || activeEmployees[0] || employees[0];

  // Hàm loại bỏ dấu tiếng Việt để tìm kiếm thông minh
  const removeAccents = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  };

  // Lọc danh sách cán bộ theo từ khóa tìm kiếm (họ tên, mã số, đơn vị, chức vụ)
  const filteredMovementEmployees = activeEmployees.filter(emp => {
    if (!empSearchQuery.trim()) return true;
    const q = removeAccents(empSearchQuery);
    return (
      removeAccents(emp.fullName || '').includes(q) ||
      removeAccents(emp.code || '').includes(q) ||
      removeAccents(emp.departmentName || '').includes(q) ||
      removeAccents(emp.positionTitle || '').includes(q)
    );
  });

  // Thu thập toàn bộ lịch sử công tác từ tất cả nhân sự
  const allHistoryRecords: { emp: Employee; record: WorkHistoryRecord }[] = [];
  employees.forEach(emp => {
    emp.workHistory.forEach(record => {
      allHistoryRecords.push({ emp, record });
    });
  });

  allHistoryRecords.sort((a, b) => b.record.startDate.localeCompare(a.record.startDate));

  // Lọc lịch sử công tác theo tìm kiếm
  const filteredHistoryRecords = allHistoryRecords.filter(({ emp, record }) => {
    if (!historySearchQuery.trim()) return true;
    const q = removeAccents(historySearchQuery);
    return (
      removeAccents(emp.fullName || '').includes(q) ||
      removeAccents(emp.code || '').includes(q) ||
      removeAccents(record.unitName || '').includes(q) ||
      removeAccents(record.position || '').includes(q) ||
      removeAccents(record.decisionNumber || '').includes(q) ||
      removeAccents(record.notes || '').includes(q)
    );
  });

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId || !newDeptId || !newPosition) {
      alert('Vui lòng điền đủ thông tin điều động.');
      return;
    }

    onExecuteMovement(
      selectedEmpId,
      newDeptId,
      newPosition,
      decisionNumber,
      effectiveDate,
      signedBy,
      `${movementType}: ${notes}`
    );

    alert(`Đã ban hành quyết định điều động/bổ nhiệm thành công cho cán bộ: ${selectedEmployee?.fullName || ''}`);
    setShowMovementForm(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-sky-600" />
            <span>QUÁ TRÌNH CÔNG TÁC & BIẾN ĐỘNG NHÂN SỰ</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Lập quyết định điều động, bổ nhiệm, luân chuyển & theo dõi toàn bộ lịch sử công tác của cán bộ
          </p>
        </div>

        <button
          onClick={() => {
            setShowMovementForm(true);
            setEmpSearchQuery('');
            setIsDropdownOpen(false);
          }}
          className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Lập Quyết Định Điều Động / Bổ Nhiệm</span>
        </button>
      </div>

      {/* Movement Modal Dialog */}
      {showMovementForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="bg-sky-800 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="font-bold text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-cyan-300" />
                <span>Quyết Định Điều Động / Bổ Nhiệm / Biệt Phái Cán Bộ</span>
              </div>
              <button 
                onClick={() => setShowMovementForm(false)} 
                className="hover:bg-white/10 p-1 rounded text-sky-200 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phần tìm kiếm & chọn Cán bộ / Nhân sự được điều động */}
                <div className="relative" ref={empDropdownRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-sky-600" />
                      <span>Cán bộ / Nhân sự được điều động</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {filteredMovementEmployees.length}/{activeEmployees.length} cán bộ
                    </span>
                  </div>

                  {/* Thanh tìm kiếm cán bộ nhân sự */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={empSearchQuery}
                      onChange={(e) => {
                        setEmpSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="Tìm theo họ tên, mã NV, phòng ban..."
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-sky-500 rounded-lg pl-8 pr-16 py-2 text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                    <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-0.5">
                      {empSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEmpSearchQuery('')}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                          title="Xóa từ khóa tìm kiếm"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition cursor-pointer"
                        title={isDropdownOpen ? "Đóng danh sách" : "Mở danh sách cán bộ"}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-sky-600' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Thẻ hiển thị cán bộ đang chọn */}
                  {selectedEmployee && (
                    <div 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`mt-1.5 p-2 rounded-lg border flex items-center justify-between cursor-pointer transition ${
                        isDropdownOpen 
                          ? 'bg-slate-50 border-slate-200' 
                          : 'bg-sky-50/80 hover:bg-sky-100/80 border-sky-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                          {selectedEmployee.fullName ? selectedEmployee.fullName.trim().split(' ').pop()?.charAt(0) : 'U'}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 mr-1.5">{selectedEmployee.fullName}</span>
                          <span className="font-mono text-[10px] text-sky-700 bg-sky-100 px-1 py-0.5 rounded mr-1.5 border border-sky-200">
                            {selectedEmployee.code}
                          </span>
                          <span className="text-slate-500 text-[11px] truncate">
                            {selectedEmployee.departmentName}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-sky-700 shrink-0 ml-2">
                        {isDropdownOpen ? 'Thu gọn' : 'Đổi cán bộ'}
                      </span>
                    </div>
                  )}

                  {/* Dropdown danh sách kết quả tìm kiếm */}
                  {isDropdownOpen && (
                    <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col">
                      <div className="p-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600 flex justify-between items-center font-medium">
                        <span>
                          {empSearchQuery ? (
                            <>Kết quả tìm kiếm cho "{empSearchQuery}": <strong>{filteredMovementEmployees.length}</strong> cán bộ</>
                          ) : (
                            <>Tất cả cán bộ đang công tác (<strong>{filteredMovementEmployees.length}</strong>):</>
                          )}
                        </span>
                        {empSearchQuery && (
                          <button 
                            type="button" 
                            onClick={() => setEmpSearchQuery('')}
                            className="text-sky-600 hover:underline text-[10px] cursor-pointer"
                          >
                            Xem tất cả
                          </button>
                        )}
                      </div>

                      <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
                        {filteredMovementEmployees.length > 0 ? (
                          filteredMovementEmployees.map(emp => {
                            const isSelected = emp.id === selectedEmpId;
                            return (
                              <div
                                key={emp.id}
                                onClick={() => {
                                  setSelectedEmpId(emp.id);
                                  setIsDropdownOpen(false);
                                  setEmpSearchQuery('');
                                }}
                                className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                                  isSelected 
                                    ? 'bg-sky-50/90 text-sky-900 border-l-4 border-sky-600 font-medium' 
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSelected ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {emp.fullName ? emp.fullName.trim().split(' ').pop()?.charAt(0) : 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-900 text-xs">{emp.fullName}</span>
                                      <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {emp.code}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                      <span className="font-medium text-slate-700">{emp.positionTitle}</span>
                                      <span>•</span>
                                      <span className="truncate">{emp.departmentName}</span>
                                    </div>
                                  </div>
                                </div>

                                {isSelected ? (
                                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 ml-2" />
                                ) : (
                                  <span className="text-[10px] text-slate-400 shrink-0 ml-2 px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200">
                                    Chọn
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-slate-500 space-y-1.5">
                            <p className="text-xs">Không tìm thấy cán bộ nào khớp với "{empSearchQuery}"</p>
                            <button
                              type="button"
                              onClick={() => setEmpSearchQuery('')}
                              className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                            >
                              Xóa từ khóa để xem toàn bộ danh sách
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hình thức biến động</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="Điều động">Điều động</option>
                    <option value="Bổ nhiệm">Bổ nhiệm</option>
                    <option value="Bổ nhiệm lại">Bổ nhiệm lại</option>
                    <option value="Luân chuyển">Luân chuyển</option>
                    <option value="Biệt phái">Biệt phái</option>
                  </select>
                </div>
              </div>

              {/* Current vs Destination */}
              <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-slate-500 font-medium">Vị trí hiện tại:</span>
                  <div className="font-bold text-slate-900">{selectedEmployee ? selectedEmployee.positionTitle : '-'}</div>
                  <div className="text-[11px] text-sky-700">{selectedEmployee ? selectedEmployee.departmentName : '-'}</div>
                </div>

                <div className="flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-sky-600 rotate-90 sm:rotate-0" />
                </div>

                <div>
                  <span className="text-slate-500 font-medium">Đơn vị tiếp nhận mới:</span>
                  <select
                    value={newDeptId}
                    onChange={(e) => setNewDeptId(e.target.value)}
                    className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-sky-950 mt-0.5"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chức vụ tại đơn vị mới</label>
                  <input
                    type="text"
                    required
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số Quyết định hành chính</label>
                  <input
                    type="text"
                    required
                    value={decisionNumber}
                    onChange={(e) => setDecisionNumber(e.target.value)}
                    placeholder="VD: 123/QĐ-CCTY"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày có hiệu lực</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Người ký quyết định</label>
                  <input
                    type="text"
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lý do / Căn cứ điều động</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMovementForm(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg font-semibold shadow cursor-pointer"
                >
                  Ban Hành Quyết Định & Cập Nhật Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-4 h-4 text-sky-600" />
              <span>SỔ LỊCH SỬ QUÁ TRÌNH CÔNG TÁC TOÀN ĐƠN VỊ ({filteredHistoryRecords.length}/{allHistoryRecords.length} sự kiện)</span>
            </div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Bảo lưu lịch sử phục vụ đối chiếu, bổ nhiệm theo quy định
            </div>
          </div>

          {/* Ô tìm kiếm nhanh trong sổ lịch sử */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Tìm theo cán bộ, mã NV, số QĐ, đơn vị..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
            />
            {historySearchQuery && (
              <button
                type="button"
                onClick={() => setHistorySearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">Cán Bộ / Mã NV</th>
                <th className="py-2.5 px-3">Giai Đoạn Công Tác</th>
                <th className="py-2.5 px-3">Đơn Vị Công Tác</th>
                <th className="py-2.5 px-3">Chức Vụ Đảm Nhiệm</th>
                <th className="py-2.5 px-3">Số Quyết Định</th>
                <th className="py-2.5 px-3">Ghi Chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistoryRecords.length > 0 ? (
                filteredHistoryRecords.map(({ emp, record }) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div 
                        onClick={() => onSelectEmployee(emp)}
                        className="font-bold text-slate-900 hover:text-sky-600 cursor-pointer"
                      >
                        {emp.fullName}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">{emp.code}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                      {formatDateVN(record.startDate)} &rarr; {record.endDate === 'Nay' ? 'Nay' : formatDateVN(record.endDate)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{record.unitName}</td>
                    <td className="py-2.5 px-3 font-bold text-sky-800">{record.position}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {record.decisionNumber ? `${record.decisionNumber} (${formatDateVN(record.decisionDate)})` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{record.notes || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Không tìm thấy sự kiện lịch sử công tác nào khớp với từ khóa tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

