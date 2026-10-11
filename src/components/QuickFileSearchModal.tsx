import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  Folder, 
  FileText, 
  FileSpreadsheet, 
  FileCheck, 
  Image as ImageIcon, 
  ExternalLink, 
  Download, 
  Loader2, 
  Filter, 
  FolderOpen,
  Sparkles,
  Building,
  User
} from 'lucide-react';
import { GoogleDriveService } from '../services/googleDriveService';
import { Employee, Decision } from '../types/hrm';

interface QuickFileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleConnected: boolean;
  employees: Employee[];
  decisions: Decision[];
  onSelectEmployee?: (emp: Employee) => void;
}

export type TargetFolderType = 
  | 'ALL' 
  | '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' 
  | '02_Văn_Bản_Quyết_Định_Tổ_Chức' 
  | '03_Báo_Cáo_Biên_Chế_Thống_Kê';

interface SearchResultItem {
  id: string;
  name: string;
  mimeType: string;
  folderCategory: '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê';
  folderName: string;
  url?: string;
  size?: number;
  date?: string;
  source: 'GOOGLE_DRIVE' | 'HO_SO_CAN_BO' | 'QUYET_DINH' | 'BAO_CAO';
  matchedContext?: string;
  employeeRef?: Employee;
}

export const QuickFileSearchModal: React.FC<QuickFileSearchModalProps> = ({
  isOpen,
  onClose,
  googleConnected,
  employees,
  decisions,
  onSelectEmployee,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<TargetFolderType>('ALL');
  const [fileTypeFilter, setFileTypeFilter] = useState<'ALL' | 'PDF' | 'EXCEL' | 'IMAGE'>('ALL');
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [driveResults, setDriveResults] = useState<SearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setDriveResults([]);
      setHasSearched(false);
    }
  }, [isOpen]);

  // Tìm kiếm cục bộ trong dữ liệu ứng dụng (Hồ sơ cán bộ, Quyết định, Báo cáo)
  const localResults: SearchResultItem[] = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase().trim();
    const results: SearchResultItem[] = [];

    // 1. Tìm trong 01_Hồ_Sơ_Cán_Bộ_Nhân_Viên: Tài liệu đính kèm của từng cán bộ
    employees.forEach(emp => {
      const matchEmp = emp.fullName.toLowerCase().includes(q) ||
                       emp.code.toLowerCase().includes(q) ||
                       emp.cccd.includes(q) ||
                       emp.departmentName.toLowerCase().includes(q);

      (emp.documents || []).forEach(doc => {
        const matchDoc = doc.title.toLowerCase().includes(q) ||
                         doc.fileName.toLowerCase().includes(q) ||
                         doc.type.toLowerCase().includes(q) ||
                         matchEmp;

        if (matchDoc) {
          results.push({
            id: `doc-${doc.id}`,
            name: `${doc.title} (${doc.fileName})`,
            mimeType: doc.mimeType || 'application/pdf',
            folderCategory: '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên',
            folderName: `01_Hồ_Sơ_Cán_Bộ_Nhân_Viên / ${emp.code}_${emp.fullName}`,
            url: doc.driveViewLink || doc.fileUrl,
            size: doc.fileSize,
            date: doc.uploadedAt,
            source: 'HO_SO_CAN_BO',
            matchedContext: `Cán bộ: ${emp.fullName} (${emp.code}) - ${emp.departmentName}`,
            employeeRef: emp,
          });
        }
      });
    });

    // 2. Tìm trong 02_Văn_Bản_Quyết_Định_Tổ_Chức: Quyết định bổ nhiệm, điều động, nâng lương
    decisions.forEach(dec => {
      const matchDec = dec.number.toLowerCase().includes(q) ||
                       dec.title.toLowerCase().includes(q) ||
                       dec.content.toLowerCase().includes(q) ||
                       dec.type.toLowerCase().includes(q) ||
                       (dec.employeeNames || []).some(n => n.toLowerCase().includes(q));

      if (matchDec) {
        results.push({
          id: `dec-${dec.id}`,
          name: `Quyết định số ${dec.number}: ${dec.title}`,
          mimeType: 'application/pdf',
          folderCategory: '02_Văn_Bản_Quyết_Định_Tổ_Chức',
          folderName: '02_Văn_Bản_Quyết_Định_Tổ_Chức',
          url: dec.driveViewLink || dec.fileUrl,
          date: dec.date,
          source: 'QUYET_DINH',
          matchedContext: `Nội dung: ${dec.content} &bull; Cán bộ liên quan: ${(dec.employeeNames || []).join(', ') || 'Chi cục'}`,
        });
      }
    });

    // 3. Tìm trong 03_Báo_Cáo_Biên_Chế_Thống_Kê: Báo cáo biên chế, lương, thống kê
    const reportTemplates = [
      {
        id: 'rep-01',
        name: 'Báo_Cáo_Thống_Kê_Biên_Chế_Toàn_Chi_Cục_2026.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        desc: 'Báo cáo thống kê chỉ tiêu và số lượng công chức, viên chức, hợp đồng theo 23 đơn vị',
      },
      {
        id: 'rep-02',
        name: 'BANG_LUONG_TOAN_CHI_CUC_CHI_TIET.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        desc: 'Bảng đối soát nâng bậc lương, hệ số lương, phụ cấp chức vụ thâm niên thú y',
      },
      {
        id: 'rep-03',
        name: 'Danh_Sach_Nghi_Huu_Du_Kien_2026_2030.pdf',
        mimeType: 'application/pdf',
        desc: 'Danh sách cán bộ đến tuổi nghỉ hưu theo lộ trình Bộ Luật Lao động',
      },
    ];

    reportTemplates.forEach(rep => {
      if (rep.name.toLowerCase().includes(q) || rep.desc.toLowerCase().includes(q)) {
        results.push({
          id: rep.id,
          name: rep.name,
          mimeType: rep.mimeType,
          folderCategory: '03_Báo_Cáo_Biên_Chế_Thống_Kê',
          folderName: '03_Báo_Cáo_Biên_Chế_Thống_Kê',
          source: 'BAO_CAO',
          date: '2026-09-25',
          matchedContext: rep.desc,
        });
      }
    });

    return results;
  }, [searchTerm, employees, decisions]);

  // Thực hiện tìm kiếm sâu trên Google Drive khi người dùng nhấn Tìm kiếm
  const handleSearchDrive = async () => {
    if (!searchTerm.trim()) return;
    setHasSearched(true);

    if (!googleConnected) {
      return;
    }

    try {
      setIsSearchingDrive(true);
      const res = await GoogleDriveService.searchInsideTargetFolders(searchTerm.trim(), selectedFolder);
      
      const mapped: SearchResultItem[] = res.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        folderCategory: f.folderCategory === 'Thư mục khác' ? '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' : f.folderCategory,
        folderName: f.folderCategory,
        url: f.webViewLink,
        size: f.size,
        date: f.modifiedTime ? f.modifiedTime.split('T')[0] : undefined,
        source: 'GOOGLE_DRIVE',
        matchedContext: `Khớp nội dung văn bản bên trong file trên Google Drive (${f.folderCategory})`,
      }));

      setDriveResults(mapped);
    } catch (err: any) {
      console.warn('Lỗi tìm kiếm Drive:', err);
    } finally {
      setIsSearchingDrive(false);
    }
  };

  // Tổng hợp kết quả lọc
  const combinedResults = React.useMemo(() => {
    const list = [...driveResults, ...localResults];
    const seen = new Set<string>();
    const unique: SearchResultItem[] = [];

    for (const item of list) {
      const key = `${item.name}_${item.folderCategory}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Lọc theo thư mục
        if (selectedFolder !== 'ALL' && item.folderCategory !== selectedFolder) {
          continue;
        }
        // Lọc theo loại file
        if (fileTypeFilter === 'PDF' && !item.name.toLowerCase().endsWith('.pdf') && !item.mimeType.includes('pdf')) {
          continue;
        }
        if (fileTypeFilter === 'EXCEL' && !item.name.toLowerCase().includes('.xls') && !item.mimeType.includes('sheet') && !item.mimeType.includes('excel')) {
          continue;
        }
        if (fileTypeFilter === 'IMAGE' && !item.mimeType.includes('image')) {
          continue;
        }
        unique.push(item);
      }
    }

    return unique;
  }, [driveResults, localResults, selectedFolder, fileTypeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 text-xs">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-2 flex items-center justify-center border border-white/20">
              <Search className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Tìm Kiếm Truy Xuất Nhanh Nội Dung File</h3>
                <span className="bg-sky-500/30 text-sky-200 border border-sky-400/40 px-2 py-0.2 rounded-full text-[10px] font-semibold">
                  3 Thư Mục Google Drive
                </span>
              </div>
              <p className="text-xs text-sky-200/80 mt-0.5">
                Tìm kiếm bên trong nội dung văn bản PDF, Excel, hồ sơ cán bộ thuộc Chi cục Chăn nuôi và Thú y TP.HCM
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input & Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchDrive();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nhập từ khóa tìm kiếm bên trong file (Ví dụ: số quyết định, tên cán bộ, nâng lương, kiểm dịch, bác sĩ thú y...)"
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearchingDrive || !searchTerm.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition flex items-center gap-2 shrink-0 shadow-xs"
            >
              {isSearchingDrive ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang quét Drive...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Truy Xuất Nhanh</span>
                </>
              )}
            </button>
          </form>

          {/* Folder Tabs Filter: 3 Thư mục theo yêu cầu */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-600 text-[11px] flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-sky-600" />
                <span>Thư mục:</span>
              </span>

              <button
                onClick={() => setSelectedFolder('ALL')}
                className={`px-2.5 py-1 rounded-lg border transition text-[11px] font-medium ${
                  selectedFolder === 'ALL'
                    ? 'bg-sky-600 text-white border-sky-600 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                Tất cả (3 Thư mục)
              </button>

              <button
                onClick={() => setSelectedFolder('01_Hồ_Sơ_Cán_Bộ_Nhân_Viên')}
                className={`px-2.5 py-1 rounded-lg border transition text-[11px] font-medium flex items-center gap-1 ${
                  selectedFolder === '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Folder className="w-3 h-3 text-amber-500" />
                <span>01_Hồ_Sơ_Cán_Bộ_Nhân_Viên</span>
              </button>

              <button
                onClick={() => setSelectedFolder('02_Văn_Bản_Quyết_Định_Tổ_Chức')}
                className={`px-2.5 py-1 rounded-lg border transition text-[11px] font-medium flex items-center gap-1 ${
                  selectedFolder === '02_Văn_Bản_Quyết_Định_Tổ_Chức'
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Folder className="w-3 h-3 text-blue-500" />
                <span>02_Văn_Bản_Quyết_Định_Tổ_Chức</span>
              </button>

              <button
                onClick={() => setSelectedFolder('03_Báo_Cáo_Biên_Chế_Thống_Kê')}
                className={`px-2.5 py-1 rounded-lg border transition text-[11px] font-medium flex items-center gap-1 ${
                  selectedFolder === '03_Báo_Cáo_Biên_Chế_Thống_Kê'
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Folder className="w-3 h-3 text-emerald-500" />
                <span>03_Báo_Cáo_Biên_Chế_Thống_Kê</span>
              </button>
            </div>

            {/* File type filter */}
            <div className="flex items-center gap-1 text-[11px]">
              <span className="text-slate-500">Định dạng:</span>
              {(['ALL', 'PDF', 'EXCEL', 'IMAGE'] as const).map(ft => (
                <button
                  key={ft}
                  onClick={() => setFileTypeFilter(ft)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    fileTypeFilter === ft ? 'bg-slate-800 text-white font-bold' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {ft === 'ALL' ? 'Tất cả' : ft}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {searchTerm.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto border border-sky-100">
                <Search className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-700 text-sm">
                Nhập từ khóa để bắt đầu tìm kiếm truy xuất nhanh
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hệ thống hỗ trợ tìm kiếm bên trong nội dung các tệp PDF văn bản quyết định, sơ yếu lý lịch cán bộ, bằng cấp thú y và bảng báo cáo biên chế trong 3 thư mục Drive trọng tâm.
              </p>
            </div>
          ) : combinedResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="font-bold text-slate-700 text-sm">
                Không tìm thấy tệp hoặc nội dung nào khớp với từ khóa "{searchTerm}"
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hãy thử kiểm tra lại từ khóa hoặc bấm nút "Truy Xuất Nhanh" để quét toàn diện trên Google Drive.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 text-slate-500 text-[11px] font-medium border-b">
                <span>Tìm thấy <strong className="text-sky-700 font-bold">{combinedResults.length}</strong> tệp tài liệu khớp nội dung:</span>
                <span className="text-slate-400">Nhấp để mở xem hoặc tải về</span>
              </div>

              {combinedResults.map(item => {
                const isPdf = item.name.toLowerCase().endsWith('.pdf') || item.mimeType.includes('pdf');
                const isExcel = item.name.toLowerCase().includes('.xls') || item.mimeType.includes('sheet') || item.mimeType.includes('excel');
                const isImage = item.mimeType.includes('image');

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white hover:bg-sky-50/60 rounded-xl border border-slate-200 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPdf ? 'bg-rose-50 text-rose-600 border-rose-200' :
                        isExcel ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        isImage ? 'bg-purple-50 text-purple-600 border-purple-200' :
                        'bg-sky-50 text-sky-600 border-sky-200'
                      }`}>
                        {isPdf && <FileText className="w-5 h-5" />}
                        {isExcel && <FileSpreadsheet className="w-5 h-5" />}
                        {isImage && <ImageIcon className="w-5 h-5" />}
                        {!isPdf && !isExcel && !isImage && <FileCheck className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 group-hover:text-sky-600 transition truncate">
                            {item.name}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                            item.folderCategory === '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' ? 'bg-amber-100 text-amber-800' :
                            item.folderCategory === '02_Văn_Bản_Quyết_Định_Tổ_Chức' ? 'bg-blue-100 text-blue-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            📁 {item.folderCategory}
                          </span>
                        </div>

                        {item.matchedContext && (
                          <div className="text-[11px] text-slate-600 mt-1 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100 font-sans">
                            {item.matchedContext}
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                          <span>Vị trí: <strong>{item.folderName}</strong></span>
                          {item.date && <span>Ngày: {item.date}</span>}
                          {item.size && <span>{(item.size / 1024).toFixed(0)} KB</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {item.employeeRef && onSelectEmployee && (
                        <button
                          onClick={() => {
                            onSelectEmployee(item.employeeRef!);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold rounded-lg border border-sky-200 transition text-[11px] flex items-center gap-1"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Hồ sơ cán bộ</span>
                        </button>
                      )}

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg transition text-[11px] flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Mở xem file</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Truy xuất nội dung file từ Google Drive & Cơ sở dữ liệu Chi cục Chăn nuôi và Thú y TP.HCM
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
