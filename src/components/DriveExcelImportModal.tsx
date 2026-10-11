import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  FileSpreadsheet, 
  Cloud, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Database,
  Building2,
  Coins,
  ShieldCheck,
  Check,
  FileCheck,
  Download
} from 'lucide-react';
import { Employee, Department } from '../types/hrm';
import { GoogleDriveService, DriveUploadedFile } from '../services/googleDriveService';
import { GoogleSheetsService, SPREADSHEET_TITLE } from '../services/googleSheetsService';
import { 
  ExcelImportService, 
  ParseResult, 
  ColumnMapping, 
  TARGET_FIELD_DEFINITIONS 
} from '../services/excelImportService';
import { formatPCCV, formatPercentAllowance } from '../utils/salaryUtils';

interface DriveExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleConnected: boolean;
  googleUserEmail?: string;
  onLoginGoogle: () => void;
  departments: Department[];
  currentEmployees: Employee[];
  onImportEmployees: (importedEmployees: Employee[], mode: 'UPSERT' | 'REPLACE', syncToSheets?: boolean) => Promise<{ success: boolean; spreadsheetUrl?: string; totalEmployees: number }> | void;
  onAddAuditLog: (action: string, targetName: string, targetCode: string, field?: string, oldVal?: string, newVal?: string, details?: string) => void;
}

export const DriveExcelImportModal: React.FC<DriveExcelImportModalProps> = ({
  isOpen,
  onClose,
  googleConnected,
  googleUserEmail,
  onLoginGoogle,
  departments,
  currentEmployees,
  onImportEmployees,
  onAddAuditLog,
}) => {
  // Tabs: 'DRIVE' | 'UPLOAD' | 'SAMPLE'
  const [activeSourceTab, setActiveSourceTab] = useState<'DRIVE' | 'UPLOAD' | 'SAMPLE'>('DRIVE');

  // Google Drive search state
  const [searchQuery, setSearchQuery] = useState('BANG LUONG TOAN CHI CUC');
  const [isSearchingDrive, setIsSearchingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveUploadedFile[]>([]);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveUploadedFile | null>(null);
  const [driveSearchError, setDriveSearchError] = useState<string | null>(null);

  // Parsing & mapping state
  const [isLoadingBuffer, setIsLoadingBuffer] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<ArrayBuffer | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');

  // Import options
  const [importMode, setImportMode] = useState<'UPSERT' | 'REPLACE'>('UPSERT');
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [syncSpreadsheetUrl, setSyncSpreadsheetUrl] = useState<string | null>(null);
  const [autoSyncGoogleSheets, setAutoSyncGoogleSheets] = useState(true);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Auto-search Google Drive if connected and modal opens
  useEffect(() => {
    if (isOpen && googleConnected && activeSourceTab === 'DRIVE') {
      handleSearchDrive(searchQuery);
    }
  }, [isOpen, googleConnected]);

  if (!isOpen) return null;

  // Tìm kiếm tệp trong Google Drive
  const handleSearchDrive = async (keyword: string) => {
    if (!googleConnected) return;
    try {
      setIsSearchingDrive(true);
      setDriveSearchError(null);
      const files = await GoogleDriveService.searchDriveFiles(keyword);
      setDriveFiles(files);
      if (files.length === 0) {
        setDriveSearchError(`Không tìm thấy tệp nào khớp với từ khóa "${keyword}" trên Google Drive của bạn. Bạn có thể thử tìm từ khóa khác hoặc tải tệp trực tiếp từ máy tính.`);
      }
    } catch (err: any) {
      console.error('Lỗi tìm kiếm Drive:', err);
      setDriveSearchError(err.message || 'Lỗi khi tìm kiếm trên Google Drive.');
    } finally {
      setIsSearchingDrive(false);
    }
  };

  // Tải file từ Drive và phân tích
  const handleSelectDriveFile = async (file: DriveUploadedFile) => {
    try {
      setSelectedDriveFile(file);
      setIsLoadingBuffer(true);
      setImportSuccess(null);
      const buffer = await GoogleDriveService.downloadFileAsArrayBuffer(file.id, file.mimeType);
      setActiveBuffer(buffer);
      setCurrentFileName(file.name);
      
      const parsed = ExcelImportService.parseExcelBuffer(buffer, file.name, undefined, departments);
      setParseResult(parsed);
    } catch (err: any) {
      console.error('Lỗi đọc file từ Drive:', err);
      alert('Không thể đọc file từ Google Drive: ' + err.message);
    } finally {
      setIsLoadingBuffer(false);
    }
  };

  // Tải file từ máy tính
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingBuffer(true);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        setActiveBuffer(buffer);
        setCurrentFileName(file.name);
        const parsed = ExcelImportService.parseExcelBuffer(buffer, file.name, undefined, departments);
        setParseResult(parsed);
      } catch (err: any) {
        console.error('Lỗi phân tích file Excel:', err);
        alert('Lỗi đọc tệp Excel: ' + err.message);
      } finally {
        setIsLoadingBuffer(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Nạp dữ liệu mẫu
  const handleLoadSample = () => {
    try {
      setIsLoadingBuffer(true);
      setImportSuccess(null);
      const buffer = ExcelImportService.generateSampleWorkbook();
      setActiveBuffer(buffer);
      setCurrentFileName('BANG LUONG TOAN CHI CUC .xlsx (Dữ liệu chuẩn Chi cục)');
      const parsed = ExcelImportService.parseExcelBuffer(buffer, 'BANG LUONG TOAN CHI CUC .xlsx', 'DM NHAN VIEN', departments);
      setParseResult(parsed);
    } catch (err: any) {
      console.error('Lỗi tạo dữ liệu mẫu:', err);
      alert('Lỗi tạo mẫu: ' + err.message);
    } finally {
      setIsLoadingBuffer(false);
    }
  };

  // Đổi sheet nếu file có nhiều sheet
  const handleChangeSheet = (sheetName: string) => {
    if (!activeBuffer) return;
    try {
      const parsed = ExcelImportService.parseExcelBuffer(activeBuffer, currentFileName, sheetName, departments);
      setParseResult(parsed);
    } catch (err: any) {
      alert('Lỗi khi đổi sheet: ' + err.message);
    }
  };

  // Tùy chỉnh đổi trường ghép cột thủ công
  const handleUpdateColumnMapping = (columnIndex: number, newTargetField: string) => {
    if (!parseResult) return;

    const newMappings = parseResult.columnMappings.map(col => {
      if (col.excelColumnIndex !== columnIndex) return col;
      const def = TARGET_FIELD_DEFINITIONS.find(d => d.field === newTargetField);
      return {
        ...col,
        targetField: newTargetField,
        targetFieldLabel: def ? def.label : 'Chưa ghép (Bỏ qua)',
        isMatched: !!newTargetField,
        matchConfidence: (newTargetField ? 'HIGH' : 'NONE') as any,
      };
    });

    // Tính toán lại ngay lập tức danh sách cán bộ và phòng ban
    const { parsedEmployees, departmentsFound } = ExcelImportService.extractEmployeesFromData(
      parseResult.rawRows || [],
      newMappings,
      departments
    );

    setParseResult({
      ...parseResult,
      columnMappings: newMappings,
      unmappedColumns: newMappings.filter(m => !m.isMatched).map(m => m.excelColumn),
      parsedEmployees,
      departmentsFound,
    });
  };

  // Tự động tìm và gán cột Họ & Tên nếu chưa được gán
  const handleAutoDetectNameColumn = () => {
    if (!parseResult) return;
    const rawRows = parseResult.rawRows || [];
    if (rawRows.length === 0) return;

    let candidateColIdx = -1;
    for (const mapping of parseResult.columnMappings) {
      let nameLikeCount = 0;
      const checkCount = Math.min(8, rawRows.length);
      for (let r = 0; r < checkCount; r++) {
        const val = String(rawRows[r][mapping.excelColumnIndex] || '').trim();
        const words = val.split(/\s+/);
        if (words.length >= 2 && words.length <= 6 && !/^\d+$/.test(val) && !/^\d{4}-\d{2}-\d{2}$/.test(val) && !val.includes('/') && !val.includes('@')) {
          nameLikeCount++;
        }
      }
      if (nameLikeCount >= Math.min(2, checkCount)) {
        candidateColIdx = mapping.excelColumnIndex;
        break;
      }
    }

    if (candidateColIdx === -1 && parseResult.columnMappings.length > 1) {
      candidateColIdx = parseResult.columnMappings[1].excelColumnIndex;
    } else if (candidateColIdx === -1 && parseResult.columnMappings.length > 0) {
      candidateColIdx = parseResult.columnMappings[0].excelColumnIndex;
    }

    if (candidateColIdx !== -1) {
      handleUpdateColumnMapping(candidateColIdx, 'fullName');
    }
  };

  // Đồng bộ thủ công dữ liệu hiện tại lên Google Sheets
  const handleManualSyncCurrentToSheets = async () => {
    if (!googleConnected) {
      onLoginGoogle();
      return;
    }
    try {
      setIsManualSyncing(true);
      const sheet = await GoogleSheetsService.getOrCreateSpreadsheet();
      await GoogleSheetsService.syncAllDataToSheets(sheet.id, currentEmployees, [], departments);
      setSyncSpreadsheetUrl(sheet.url);
      setImportSuccess(`Đã đồng bộ thành công ${currentEmployees.length} cán bộ hiện có lên Google Sheets "${SPREADSHEET_TITLE}"!`);
      alert(`Đã đồng bộ thành công lên Google Sheets "${SPREADSHEET_TITLE}"!`);
    } catch (err: any) {
      console.error('Lỗi đồng bộ Google Sheets:', err);
      alert('Không thể đồng bộ Google Sheets: ' + err.message);
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Thực hiện điền và cập nhật toàn bộ vào hệ thống
  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.parsedEmployees.length === 0) return;

    try {
      setIsImporting(true);
      setImportSuccess(null);
      setSyncSpreadsheetUrl(null);

      const res = await onImportEmployees(parseResult.parsedEmployees, importMode, autoSyncGoogleSheets);

      onAddAuditLog(
        'NHẬP_EXCEL_DRIVE',
        `Tệp: ${parseResult.fileName} (Sheet: ${parseResult.selectedSheet})`,
        `SL: ${parseResult.parsedEmployees.length}`,
        'Dữ liệu nhân sự & Bảng lương',
        `${currentEmployees.length} nhân sự hiện tại`,
        `${parseResult.parsedEmployees.length} nhân sự nhập từ Excel`,
        `Đã đọc và ghép ${parseResult.columnMappings.filter(m => m.isMatched).length} cột phù hợp từ sheet "${parseResult.selectedSheet}" vào hệ thống. Chế độ: ${importMode === 'UPSERT' ? 'Cập nhật & Thêm mới' : 'Thay thế toàn bộ'}.`
      );

      if (res && res.spreadsheetUrl) {
        setSyncSpreadsheetUrl(res.spreadsheetUrl);
        setImportSuccess(`Đã điền thành công ${parseResult.parsedEmployees.length} cán bộ vào Hệ thống & đồng bộ trực tiếp lên Google Sheets "${SPREADSHEET_TITLE}"!`);
      } else if (googleConnected && autoSyncGoogleSheets) {
        setImportSuccess(`Đã điền thành công ${parseResult.parsedEmployees.length} cán bộ vào hệ thống và đang cập nhật vào Google Sheets "${SPREADSHEET_TITLE}"!`);
      } else {
        setImportSuccess(`Đã điền và đồng bộ thành công ${parseResult.parsedEmployees.length} cán bộ vào Hệ thống Cơ Sở Dữ Liệu Chi cục!`);
      }
    } catch (err: any) {
      console.error('Lỗi khi nhập dữ liệu:', err);
      alert('Không thể nhập dữ liệu: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Tải file Excel mẫu về máy tính
  const handleDownloadSampleFile = () => {
    const buffer = ExcelImportService.generateSampleWorkbook();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BANG LUONG TOAN CHI CUC .xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-cyan-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Tìm Kiếm & Nhập File "BANG LUONG TOAN CHI CUC .xlsx"</h3>
                <span className="text-[11px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full font-medium">
                  Sheet: DM NHAN VIEN
                </span>
              </div>
              <p className="text-xs text-sky-200 mt-0.5">
                Tự động đối soát các cột trong sheet "DM NHAN VIEN" và điền toàn bộ thông tin nhân sự, đơn vị, lương vào hệ thống
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 pt-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSourceTab('DRIVE')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeSourceTab === 'DRIVE'
                  ? 'bg-white text-sky-700 border-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <Cloud className="w-4 h-4 text-sky-600" />
              <span>Tìm Trên Google Drive</span>
              {googleConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() => setActiveSourceTab('UPLOAD')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeSourceTab === 'UPLOAD'
                  ? 'bg-white text-sky-700 border-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Tải Lên Tệp Từ Máy Tính (.xlsx)</span>
            </button>

            <button
              onClick={() => setActiveSourceTab('SAMPLE')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                activeSourceTab === 'SAMPLE'
                  ? 'bg-white text-sky-700 border-sky-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Dữ Liệu Mẫu Chuẩn Chi Cục</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 pb-2">
            {googleConnected && (
              <button
                onClick={handleManualSyncCurrentToSheets}
                disabled={isManualSyncing}
                className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition shadow-xs"
                title={`Đẩy ngay dữ liệu nhân sự lên Google Sheets "${SPREADSHEET_TITLE}"`}
              >
                {isManualSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span>Đồng bộ ngay sang Google Sheets</span>
              </button>
            )}

            <button
              onClick={handleDownloadSampleFile}
              className="text-xs text-sky-700 hover:text-sky-900 flex items-center gap-1 font-medium hover:underline"
              title="Tải mẫu bảng tính Excel để xem trước cấu trúc cột"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải tệp mẫu Excel</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: GOOGLE DRIVE SEARCH */}
          {activeSourceTab === 'DRIVE' && (
            <div className="space-y-4">
              {!googleConnected ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">Chưa kết nối Google Drive</h4>
                    <p className="text-xs text-amber-700 max-w-lg mx-auto mt-1">
                      Để tìm kiếm tệp "BANG LUONG TOAN CHI CUC .xlsx" trực tiếp từ Google Drive của bạn, vui lòng đăng nhập tài khoản Google.
                    </p>
                  </div>
                  <button
                    onClick={onLoginGoogle}
                    className="inline-flex items-center gap-2 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Đăng nhập Google để tìm trên Drive</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search Box */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchDrive(searchQuery)}
                        placeholder="Nhập tên tệp: BANG LUONG TOAN CHI CUC..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => handleSearchDrive(searchQuery)}
                      disabled={isSearchingDrive}
                      className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      {isSearchingDrive ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>Tìm Tệp Trên Drive</span>
                    </button>
                  </div>

                  {/* Drive User info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 bg-sky-50/60 border border-sky-100 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Đang tìm kiếm trong tài khoản Google: <strong>{googleUserEmail}</strong></span>
                    </div>
                    <span className="text-[11px] text-slate-400">Drive API v3 (drive.readonly)</span>
                  </div>

                  {/* Error / Warning */}
                  {driveSearchError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span>{driveSearchError}</span>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => handleSearchDrive('')}
                            className="text-sky-700 underline font-semibold hover:text-sky-900"
                          >
                            Liệt kê các tệp gần đây trên Drive
                          </button>
                          <span>&bull;</span>
                          <button
                            onClick={() => setActiveSourceTab('UPLOAD')}
                            className="text-sky-700 underline font-semibold hover:text-sky-900"
                          >
                            Chuyển sang tải file từ máy tính
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Search Results List */}
                  {driveFiles.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                        <span>Danh sách tệp tìm thấy trên Google Drive ({driveFiles.length})</span>
                        <span className="text-[11px] text-slate-500 font-normal">Nhấp "Chọn tệp này" để tự động đối soát cột</span>
                      </div>
                      <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                        {driveFiles.map((file) => {
                          const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.mimeType.includes('sheet');
                          const isMatchName = file.name.toLowerCase().includes('bang luong');

                          return (
                            <div 
                              key={file.id} 
                              className={`p-3.5 flex items-center justify-between gap-3 hover:bg-sky-50/50 transition ${
                                selectedDriveFile?.id === file.id ? 'bg-sky-50 border-l-4 border-sky-600' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isExcel ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  <FileSpreadsheet className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                                    <span>{file.name}</span>
                                    {isMatchName && (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-semibold">
                                        Khớp từ khóa
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                                    <span>{file.mimeType.includes('spreadsheet') ? 'Google Sheets' : 'Excel (.xlsx)'}</span>
                                    {file.size && <span>{Math.round(file.size / 1024)} KB</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                                    title="Xem tệp trên Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleSelectDriveFile(file)}
                                  disabled={isLoadingBuffer}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition flex items-center gap-1"
                                >
                                  {isLoadingBuffer && selectedDriveFile?.id === file.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Chọn tệp này</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOCAL UPLOAD */}
          {activeSourceTab === 'UPLOAD' && (
            <div className="border-2 border-dashed border-slate-300 hover:border-sky-500 bg-slate-50/50 rounded-2xl p-8 text-center transition">
              <input
                type="file"
                id="file-upload"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer space-y-3 block">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    Kéo thả hoặc nhấp để chọn tệp "BANG LUONG TOAN CHI CUC .xlsx"
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Định dạng hỗ trợ: Microsoft Excel (.xlsx, .xls) &bull; Hệ thống sẽ tự động quét sheet "DM NHAN VIEN"
                  </p>
                </div>
                <span className="inline-block bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition">
                  Chọn tệp từ máy tính
                </span>
              </label>
            </div>
          )}

          {/* TAB 3: SAMPLE DATA */}
          {activeSourceTab === 'SAMPLE' && (
            <div className="bg-gradient-to-br from-amber-50/70 via-sky-50/50 to-white border border-amber-200/80 rounded-2xl p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Bảng Tính Mẫu "BANG LUONG TOAN CHI CUC .xlsx" &bull; Sheet "DM NHAN VIEN"
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Dữ liệu mẫu chuẩn bao gồm đầy đủ 29 cột nghiệp vụ: Mã nhân sự, Họ tên, Đơn vị (chuẩn 23 phòng/trạm trực thuộc), Chức vụ, Bậc/Hệ số lương, Phụ cấp PCCV/PCTN, Trình độ chuyên môn Bác sĩ Thú y, Chứng chỉ hành nghề thú y, CCCD, Quê quán, Ngày sinh...
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={handleLoadSample}
                  disabled={isLoadingBuffer}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow transition flex items-center gap-2"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Nạp & Phân Tích Sheet "DM NHAN VIEN" (Mẫu)</span>
                </button>

                <button
                  onClick={handleDownloadSampleFile}
                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tải Về File .xlsx</span>
                </button>
              </div>
            </div>
          )}

          {/* PARSING RESULTS: COLUMN MATCHING & PREVIEW */}
          {parseResult && (
            <div className="space-y-6 animate-in fade-in">
              {/* File & Sheet Banner */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Tệp đang phân tích:</div>
                    <div className="text-sm font-bold text-white">{parseResult.fileName}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-300">Sheet:</span>
                    <select
                      value={parseResult.selectedSheet}
                      onChange={(e) => handleChangeSheet(e.target.value)}
                      className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium focus:ring-1 focus:ring-sky-500"
                    >
                      {parseResult.sheetNames.map((sheet) => (
                        <option key={sheet} value={sheet}>
                          {sheet} {sheet.toUpperCase().includes('DM') ? '★ (Khuyên dùng)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-lg font-semibold">
                    {parseResult.totalRawRows} cán bộ / dòng dữ liệu
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <div className="text-slate-500">Cột trong Sheet:</div>
                  <div className="text-lg font-bold text-sky-900 mt-0.5">
                    {parseResult.columnMappings.length} cột
                  </div>
                  <div className="text-[11px] text-sky-700 mt-0.5">Phát hiện từ Header</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <div className="text-slate-500">Cột khớp thành công:</div>
                  <div className="text-lg font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5">
                    <span>{parseResult.columnMappings.filter(m => m.isMatched).length}</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Sẵn sàng điền vào hệ thống</div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="text-slate-500">Phòng / Trạm khớp:</div>
                  <div className="text-lg font-bold text-amber-800 mt-0.5">
                    {parseResult.departmentsFound.length} đơn vị
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">Khớp chuẩn 23 đơn vị</div>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                  <div className="text-slate-500">Chế độ cập nhật:</div>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="mt-1 w-full bg-white border border-indigo-200 rounded text-xs font-semibold py-1 px-1.5 text-indigo-900"
                  >
                    <option value="UPSERT">Cập nhật & Thêm mới</option>
                    <option value="REPLACE">Thay thế toàn bộ danh sách</option>
                  </select>
                </div>

                {/* Google Sheets Sync Setting Card */}
                <div className="col-span-2 sm:col-span-4 bg-emerald-50/80 border border-emerald-300 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-emerald-950">
                    <input
                      type="checkbox"
                      checked={autoSyncGoogleSheets}
                      onChange={(e) => setAutoSyncGoogleSheets(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>
                      Đồng thời cập nhật toàn bộ vào Google Sheets: <span className="underline decoration-emerald-500 font-extrabold">"{SPREADSHEET_TITLE}"</span> trên Google Drive
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    {googleConnected ? (
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded font-semibold flex items-center gap-1 border border-emerald-300">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Đã sẵn sàng đồng bộ Sheets
                      </span>
                    ) : (
                      <button
                        onClick={onLoginGoogle}
                        className="bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 px-3 py-1 rounded text-xs font-bold shadow-sm transition"
                      >
                        Đăng nhập Google để đồng bộ Sheets
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* WARNING IF 0 EMPLOYEES EXTRACTED */}
              {parseResult.parsedEmployees.length === 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-2 animate-in fade-in shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Lý do nút "XÁC NHẬN: ĐIỀN TOÀN BỘ THÔNG TIN" chưa được kích hoạt:</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Hệ thống chưa trích xuất được hồ sơ nhân sự nào (hiện có <strong>0 cán bộ</strong>) vì chưa phát hiện cột <strong>"Họ Và Tên"</strong> trong sheet "<strong>{parseResult.selectedSheet}</strong>". 
                    Bạn chỉ cần chọn trường <em>[Thông tin chung] Họ Và Tên (Đầy Đủ)</em> tại cột tương ứng trong bảng đối soát bên dưới, hoặc bấm nút dưới đây:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={handleAutoDetectNameColumn}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Tự Động Gán Cột Họ & Tên Cán Bộ</span>
                    </button>
                    <button
                      onClick={handleLoadSample}
                      className="bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 px-3.5 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>Nạp Sheet Mẫu Chuẩn Chi Cục (29 Cột Nghiệp Vụ)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* COLUMN MATCHING ANALYSIS TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-800 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-600" />
                    <span className="text-[11px] sm:text-xs">BẢNG ĐỐI SOÁT CỘT: SHEET "{parseResult.selectedSheet}" &rarr; HỆ THỐNG QUẢN LÝ NHÂN SỰ</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Bạn có thể chỉnh sửa ghép cột nếu cần tùy biến
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3">Cột Trong Excel ("{parseResult.selectedSheet}")</th>
                        <th className="py-2 px-3">Trạng Thái Khớp</th>
                        <th className="py-2 px-3">Trường Dữ Liệu Tương Ứng Trong Hệ Thống</th>
                        <th className="py-2 px-3">Dữ Liệu Mẫu Đọc Được</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parseResult.columnMappings.map((col, idx) => (
                        <tr key={idx} className={col.isMatched ? 'hover:bg-slate-50/80' : 'bg-amber-50/30'}>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {col.excelColumn}
                          </td>
                          <td className="py-2 px-3">
                            {col.isMatched ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                <Check className="w-3 h-3" />
                                {col.matchConfidence === 'EXACT' ? '100% Khớp' : 'Khớp Thông Minh'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                Bỏ qua (Chưa ghép)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={col.targetField}
                              onChange={(e) => handleUpdateColumnMapping(col.excelColumnIndex, e.target.value)}
                              className={`w-full text-xs rounded-lg px-2 py-1 border transition ${
                                col.isMatched 
                                  ? 'bg-sky-50/50 border-sky-300 font-medium text-sky-900' 
                                  : 'bg-white border-slate-300 text-slate-600'
                              }`}
                            >
                              <option value="">-- Bỏ qua cột này --</option>
                              {TARGET_FIELD_DEFINITIONS.map(def => (
                                <option key={def.field} value={def.field}>
                                  [{def.category}] {def.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 truncate max-w-xs text-[11px]">
                            {col.sampleValue || <span className="text-slate-300 italic">(Trống)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DATA PREVIEW TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>XEM TRƯỚC HỒ SƠ ĐÃ ĐỐI SOÁT ({parseResult.parsedEmployees.length} nhân sự)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Đã chuẩn hóa đơn vị vào 23 phòng/trạm trực thuộc
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Mã NV</th>
                        <th className="py-2 px-3">Họ và Tên</th>
                        <th className="py-2 px-3">Đơn Vị Chuẩn Hóa</th>
                        <th className="py-2 px-3">Chức Vụ</th>
                        <th className="py-2 px-3">Bậc / Hệ Số Lương</th>
                        <th className="py-2 px-3">Phụ Cấp</th>
                        <th className="py-2 px-3">Trình Độ Chuyên Môn</th>
                        <th className="py-2 px-3">Số CCCD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {parseResult.parsedEmployees.slice(0, 15).map((emp, i) => (
                        <tr key={emp.id || i} className="hover:bg-sky-50/50">
                          <td className="py-2 px-3 font-mono font-medium text-sky-900">{emp.code}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{emp.fullName}</td>
                          <td className="py-2 px-3 text-slate-700">
                            <span className="bg-sky-100/70 text-sky-900 px-2 py-0.5 rounded text-[11px] font-medium">
                              {emp.departmentName}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{emp.positionTitle}</td>
                          <td className="py-2 px-3 text-slate-700 font-mono">
                            Bậc {emp.salary.step} &bull; {emp.salary.coefficient.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">
                            {emp.salary.leadershipAllowance > 0 && `PCCV: ${formatPCCV(emp.salary.leadershipAllowance)} `}
                            {emp.salary.seniorityAllowancePercent > 0 && `TN: ${formatPercentAllowance(emp.salary.seniorityAllowancePercent, 0)}`}
                            {emp.salary.leadershipAllowance === 0 && emp.salary.seniorityAllowancePercent === 0 && '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-700 text-[11px]">
                            {emp.education.highestDegree} - {emp.education.major}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{emp.cccd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.parsedEmployees.length > 15 && (
                    <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
                      ... và {parseResult.parsedEmployees.length - 15} cán bộ nhân sự khác sẵn sàng nhập
                    </div>
                  )}
                </div>
              </div>

              {/* SUCCESS MESSAGE BANNER */}
              {importSuccess && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-800 animate-in fade-in shadow-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm text-emerald-950">{importSuccess}</div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        Dữ liệu nhân sự, ngạch bậc lương và 23 phòng/trạm đã được lưu trữ và cập nhật vào Cơ Sở Dữ Liệu hệ thống.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {syncSpreadsheetUrl && (
                      <a
                        href={syncSpreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở Bảng Tính Google Sheets</span>
                      </a>
                    )}
                    <button
                      onClick={onClose}
                      className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-1.5 rounded-lg font-semibold text-xs transition"
                    >
                      Xem Danh Sách Nhân Sự
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {parseResult ? (
              <span>
                Đã chuẩn bị <strong>{parseResult.parsedEmployees.length}</strong> nhân sự &bull;{' '}
                <strong>{parseResult.columnMappings.filter(m => m.isMatched).length}</strong> cột ghép thành công
              </span>
            ) : (
              <span>Chọn hoặc tải tệp "BANG LUONG TOAN CHI CUC .xlsx" để bắt đầu đối soát cột</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
            >
              Đóng
            </button>

            {parseResult && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting || parseResult.parsedEmployees.length === 0}
                  className="bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title={parseResult.parsedEmployees.length === 0 ? "Cần ít nhất 1 hồ sơ nhân sự để kích hoạt nút" : "Điền toàn bộ danh sách nhân sự vào hệ thống"}
                >
                  {isImporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    XÁC NHẬN: ĐIỀN TOÀN BỘ THÔNG TIN VÀO HỆ THỐNG
                    {parseResult.parsedEmployees.length > 0 && ` (${parseResult.parsedEmployees.length} CÁN BỘ)`}
                  </span>
                </button>
                {parseResult.parsedEmployees.length === 0 && (
                  <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Chưa kích hoạt do có 0 cán bộ: Vui lòng chọn cột Họ và Tên ở bảng đối soát bên trên
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
