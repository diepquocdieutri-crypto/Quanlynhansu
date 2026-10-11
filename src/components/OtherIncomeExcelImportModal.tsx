import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Employee, OtherIncomeItem } from '../types/hrm';
import { QuarterlyTaxService } from '../services/quarterlyTaxService';

interface OtherIncomeExcelImportModalProps {
  employees: Employee[];
  selectedYear: number;
  onClose: () => void;
  onImportSuccess: (items: OtherIncomeItem[]) => void;
}

export const OtherIncomeExcelImportModal: React.FC<OtherIncomeExcelImportModalProps> = ({
  employees,
  selectedYear,
  onClose,
  onImportSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewItems, setPreviewItems] = useState<OtherIncomeItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    QuarterlyTaxService.exportSampleOtherIncomeTemplate(employees);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);
    setPreviewItems([]);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const res = QuarterlyTaxService.parseOtherIncomesFromExcel(buffer, employees, selectedYear);
      setPreviewItems(res.imported);
      setErrors(res.errors);
    } catch (err: any) {
      setErrors(['Lỗi khi đọc file Excel: ' + (err.message || 'Định dạng file không được hỗ trợ')]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (previewItems.length === 0) return;
    onImportSuccess(previewItems);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="font-black text-base text-white">
                Đưa Dữ Liệu Thu Nhập Khác Lên Từ File Excel
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Nhập các khoản: Thưởng lễ, phụ cấp tăng thêm NQ98, làm thêm giờ, kiêm nhiệm, bồi dưỡng...
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Hướng dẫn & Tải mẫu */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800 uppercase">
                Yêu cầu cấu trúc cột trong file Excel:
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Các cột cần có: <span className="font-semibold text-indigo-700">Tháng</span>, <span className="font-semibold text-indigo-700">Mã Nhân Viên</span>, <span className="font-semibold text-indigo-700">Họ và Tên</span>, <span className="font-semibold text-indigo-700">Nội Dung Thu Nhập</span>, <span className="font-semibold text-indigo-700">Số Tiền</span>.
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              Tải Biểu Mẫu Chuẩn (.xlsx)
            </button>
          </div>

          {/* Khu vực chọn / thả file */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl p-6 text-center cursor-pointer transition"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              {file ? file.name : 'Bấm vào đây để chọn tệp Excel từ máy tính của bạn'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Hỗ trợ định dạng .xlsx, .xls hoặc .csv
            </p>
          </div>

          {/* Trạng thái đang đọc */}
          {isProcessing && (
            <div className="flex items-center justify-center gap-2 py-4 text-indigo-600 text-xs font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Đang phân tích cấu trúc file Excel...
            </div>
          )}

          {/* Lỗi cảnh báo nếu có */}
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Cảnh báo dòng dữ liệu ({errors.length}):
              </div>
              <ul className="text-xs text-amber-700 list-disc pl-5 space-y-0.5 max-h-24 overflow-y-auto">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bảng xem trước dữ liệu */}
          {previewItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-black text-slate-800 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Dữ liệu hợp lệ sẵn sàng đưa vào hệ thống: ({previewItems.length} mục)
                </div>
                <div className="text-xs font-bold text-indigo-700">
                  Tổng tiền: {previewItems.reduce((s, i) => s + i.amount, 0).toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto shadow-inner">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-10">STT</th>
                      <th className="py-2 px-2.5">Kỳ Tháng</th>
                      <th className="py-2 px-2.5">Mã NV</th>
                      <th className="py-2 px-2.5">Họ và Tên</th>
                      <th className="py-2 px-2.5">Nội Dung Thu Nhập</th>
                      <th className="py-2 px-2.5 text-right">Số Tiền (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previewItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-indigo-800">
                          Tháng {item.month}/{item.year}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-slate-700">{item.employeeCode}</td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-900">{item.employeeName}</td>
                        <td className="py-1.5 px-2.5 text-slate-700 truncate max-w-[200px]" title={item.description}>
                          {item.description}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-black text-emerald-700">
                          {item.amount.toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Dữ liệu sau khi nạp sẽ được lưu trữ để tính toán lũy kế và gom theo quý.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={previewItems.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Xác Nhận Nạp {previewItems.length} Khoản Vào Hệ Thống
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
