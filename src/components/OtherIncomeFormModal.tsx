import React, { useState } from 'react';
import { X, Check, DollarSign } from 'lucide-react';
import { Employee, OtherIncomeItem } from '../types/hrm';

interface OtherIncomeFormModalProps {
  editingItem: OtherIncomeItem | null;
  employees: Employee[];
  defaultMonth: number;
  defaultYear: number;
  onClose: () => void;
  onSave: (item: OtherIncomeItem) => void;
}

export const OtherIncomeFormModal: React.FC<OtherIncomeFormModalProps> = ({
  editingItem,
  employees,
  defaultMonth,
  defaultYear,
  onClose,
  onSave,
}) => {
  const [month, setMonth] = useState<number>(editingItem?.month || defaultMonth);
  const [year, setYear] = useState<number>(editingItem?.year || defaultYear);
  const [employeeCode, setEmployeeCode] = useState<string>(
    editingItem?.employeeCode || employees[0]?.code || ''
  );
  const [description, setDescription] = useState<string>(
    editingItem?.description || 'Thu nhập tăng thêm theo Nghị quyết 98/2023/QH15'
  );
  const [amount, setAmount] = useState<number>(editingItem?.amount || 5000000);
  const [taxable, setTaxable] = useState<boolean>(editingItem?.taxable !== false);
  const [notes, setNotes] = useState<string>(editingItem?.notes || '');

  const suggestions = [
    'Thu nhập tăng thêm theo Nghị quyết 98/2023/QH15',
    'Tiền làm thêm giờ trực chốt kiểm dịch động vật',
    'Tiền thưởng ngày Lễ Quốc khánh 02/9',
    'Bồi dưỡng tham gia hội đồng giám định chuyên môn',
    'Tiền trực kiểm soát giết mổ ban đêm',
    'Phụ cấp kiêm nhiệm công tác phòng chống dịch',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Vui lòng nhập nội dung thu nhập');
      return;
    }
    if (amount <= 0) {
      alert('Số tiền thu nhập phải lớn hơn 0');
      return;
    }

    const matchedEmp = employees.find(e => e.code === employeeCode);
    const item: OtherIncomeItem = {
      id: editingItem?.id || `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      month,
      year,
      periodKey: `${String(month).padStart(2, '0')}/${year}`,
      employeeCode,
      employeeName: matchedEmp?.fullName || editingItem?.employeeName || '',
      departmentName: matchedEmp?.departmentName || editingItem?.departmentName || '',
      description: description.trim(),
      amount: Math.round(amount),
      taxable,
      source: editingItem?.source || 'MANUAL_ENTRY',
      notes: notes.trim(),
      createdAt: editingItem?.createdAt || new Date().toISOString(),
    };

    onSave(item);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-300" />
            <h3 className="font-black text-base text-white">
              {editingItem ? 'Chỉnh Sửa Khoản Thu Nhập Khác' : 'Nhập Mới Khoản Thu Nhập Khác'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Kỳ Tháng: <span className="text-rose-500">*</span>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Năm: <span className="text-rose-500">*</span>
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Cán bộ / Nhân viên nhận thu nhập: <span className="text-rose-500">*</span>
            </label>
            <select
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {employees.map((emp) => (
                <option key={emp.code} value={emp.code}>
                  {emp.code} - {emp.fullName} ({emp.departmentName || 'Chi cục'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nội dung khoản thu nhập: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Thu nhập tăng thêm theo Nghị quyết 98"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setDescription(s)}
                  className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded border border-slate-200 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Số tiền thu nhập (VNĐ): <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min={0}
                step="any"
                placeholder="Nhập số tiền..."
                value={amount || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                  setAmount(isNaN(val) ? 0 : val);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                VNĐ
              </span>
            </div>
            {/* Gợi ý mức tiền nhanh */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500 font-semibold mr-0.5">Mức nhanh:</span>
              {[1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 9_500_000, 12_000_000, 15_000_000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition border ${
                    amount === amt
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'
                  }`}
                >
                  {(amt / 1_000_000).toLocaleString('vi-VN')} Tr
                </button>
              ))}
            </div>
            <div className="text-[11px] text-indigo-700 font-bold mt-1.5 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center justify-between">
              <span>Số tiền bằng chữ số:</span>
              <span className="text-sm font-black text-indigo-950">{(amount || 0).toLocaleString('vi-VN')} VNĐ</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="taxableCheck"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <label htmlFor="taxableCheck" className="text-xs text-slate-700 font-medium">
              Khoản thu nhập chịu thuế TNCN (Tính vào tổng thu nhập và thu nhập chịu thuế)
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Ghi chú thêm:
            </label>
            <input
              type="text"
              placeholder="VD: Căn cứ quyết định chi khen thưởng số 12/QĐ-CCTY..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Lưu Khoản Thu Nhập
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
