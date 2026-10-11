import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  Table, 
  ShieldCheck,
  Download,
  Upload,
  Database,
  Globe,
  Layers,
  CheckSquare,
  Square,
  ArrowRightLeft,
  Calendar,
  Info,
  Wrench,
  Link,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { Employee, AuditLog, Department, Decision } from '../types/hrm';
import { GoogleSheetsService, SPREADSHEET_TITLE, SyncDiagnosisReport } from '../services/googleSheetsService';
import { ensureAccessToken, googleSignIn } from '../services/firebaseAuth';
import { formatDateTimeVN, getTodayVN } from '../utils/dateUtils';

export type SyncSourceType = 'WEB_APP' | 'DATABASE';

interface SyncDataOptions {
  employees: boolean;
  workHistory: boolean;
  salaryHistory: boolean;
  trainingHistory: boolean;
  rewardDiscipline: boolean;
  departments: boolean;
  decisions: boolean;
  auditLogs: boolean;
}

interface SheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleConnected: boolean;
  googleUserEmail?: string;
  onLoginGoogle: () => void;
  employees: Employee[];
  departments?: Department[];
  decisions?: Decision[];
  auditLogs: AuditLog[];
  onLogSyncAction: (details: string) => void;
  onUpdateEmployees?: (newEmployees: Employee[]) => void;
  onUpdateDepartments?: (newDepartments: Department[]) => void;
  onUpdateDecisions?: (newDecisions: Decision[]) => void;
  onClearMockData?: () => void;
}

export const SheetsSyncModal: React.FC<SheetsSyncModalProps> = ({
  isOpen,
  onClose,
  googleConnected,
  googleUserEmail,
  onLoginGoogle,
  employees,
  departments = [],
  decisions = [],
  auditLogs,
  onLogSyncAction,
  onUpdateEmployees,
  onUpdateDepartments,
  onUpdateDecisions,
  onClearMockData,
}) => {
  // Mặc định chọn Đồng bộ từ Cơ sở dữ liệu (Google Sheets) về Web App để nạp file của người dùng
  const [syncSource, setSyncSource] = useState<SyncSourceType>('DATABASE');
  
  // Tùy chọn các danh mục dữ liệu cần đồng bộ (Bảo vệ dữ liệu hoàn chỉnh của DanhMuc_PhongBan và KhenThuongKyLuat)
  const [syncOptions, setSyncOptions] = useState<SyncDataOptions>({
    employees: true,
    workHistory: true,
    salaryHistory: true,
    trainingHistory: true,
    rewardDiscipline: false, // Mặc định không ghi đè vào KhenThuongKyLuat
    departments: false,      // Mặc định không ghi đè vào DanhMuc_PhongBan
    decisions: true,
    auditLogs: true,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<{ id: string; url: string; title?: string } | null>(null);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem('ccty_last_sync_time') || null;
  });

  // Tùy chọn nhập link/ID bảng tính tùy chỉnh và chẩn đoán
  const [customSheetInput, setCustomSheetInput] = useState<string>(() => {
    return GoogleSheetsService.getSavedSpreadsheetId() || '';
  });
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<Array<{ id: string; title: string; url: string; modifiedTime?: string }>>([]);
  const [detectedTabs, setDetectedTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('AUTO');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisReport, setDiagnosisReport] = useState<SyncDiagnosisReport | null>(null);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);

  // Khởi tạo thông tin bảng tính và danh sách file trong Drive khi mở modal
  useEffect(() => {
    if (isOpen && googleConnected) {
      const savedId = GoogleSheetsService.getSavedSpreadsheetId();
      if (savedId) {
        setSpreadsheetInfo({
          id: savedId,
          url: `https://docs.google.com/spreadsheets/d/${savedId}/edit`,
          title: SPREADSHEET_TITLE,
        });
      }

      // Quét tự động danh sách các bảng tính trong Google Drive của người dùng
      GoogleSheetsService.listUserSpreadsheets()
        .then(files => {
          if (files && files.length > 0) {
            setDriveSpreadsheets(files);
          }
        })
        .catch(err => console.log('Quét danh sách file Drive:', err));

      // Tự động kiểm tra nhanh kết nối
      handleRunDiagnosis(savedId || undefined);
    }
  }, [isOpen, googleConnected]);

  if (!isOpen) return null;

  const toggleOption = (key: keyof SyncDataOptions) => {
    setSyncOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectAll = () => {
    const isPushToSheets = syncSource === 'WEB_APP';
    setSyncOptions({
      employees: true,
      workHistory: true,
      salaryHistory: true,
      trainingHistory: true,
      rewardDiscipline: isPushToSheets ? false : true,
      departments: isPushToSheets ? false : true,
      decisions: true,
      auditLogs: true,
    });
  };

  const handleDeselectAll = () => {
    setSyncOptions({
      employees: false,
      workHistory: false,
      salaryHistory: false,
      trainingHistory: false,
      rewardDiscipline: false,
      departments: false,
      decisions: false,
      auditLogs: false,
    });
  };

  const selectedCount = Object.values(syncOptions).filter(Boolean).length;

  // Xử lý áp dụng ID hoặc Link Google Sheets tùy chỉnh của người dùng
  const handleApplyCustomSheet = async () => {
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);
    if (!customSheetInput.trim()) {
      localStorage.removeItem('ccty_active_spreadsheet_id');
      setSpreadsheetInfo(null);
      setSyncSuccessMsg('Đã xóa link bảng tính tùy chỉnh. Hệ thống sẽ tự động tìm bảng tính chuẩn trong Drive.');
      return;
    }

    const cleanId = GoogleSheetsService.setSavedSpreadsheetId(customSheetInput);
    if (!cleanId) {
      setSyncErrorMsg('Link hoặc Mã bảng tính không hợp lệ. Vui lòng kiểm tra lại!');
      return;
    }

    setSyncSuccessMsg(`Đang kiểm tra kết nối tới bảng tính: ${cleanId}...`);
    try {
      const sheet = await GoogleSheetsService.getOrCreateSpreadsheet(cleanId);
      setSpreadsheetInfo(sheet);
      setSyncSuccessMsg(`Đã kết nối thành công tới bảng tính: "${sheet.title}" (${cleanId})`);
      // Chạy chẩn đoán nhanh để nạp danh sách tabs
      handleRunDiagnosis(cleanId);
    } catch (err: any) {
      setSyncErrorMsg('Không thể mở bảng tính này: ' + err.message + '. Vui lòng kiểm tra quyền truy cập của tài khoản Google.');
      setSyncSuccessMsg(null);
    }
  };

  // Chạy công cụ chẩn đoán hệ thống
  const handleRunDiagnosis = async (specificId?: string) => {
    try {
      setIsDiagnosing(true);
      setShowDiagnosticPanel(true);
      setSyncErrorMsg(null);

      // Đảm bảo có token
      let token = await ensureAccessToken().catch(() => null);
      if (!token) {
        onLoginGoogle();
        return;
      }

      const idToTest = specificId || GoogleSheetsService.extractSpreadsheetId(customSheetInput) || undefined;
      const report = await GoogleSheetsService.diagnoseConnection(idToTest);
      setDiagnosisReport(report);

      if (report.availableTabs.length > 0) {
        setDetectedTabs(report.availableTabs);
      }
      if (report.sheetId && report.sheetUrl) {
        setSpreadsheetInfo({
          id: report.sheetId,
          url: report.sheetUrl,
          title: report.sheetTitle,
        });
      }
    } catch (err: any) {
      setSyncErrorMsg('Lỗi chẩn đoán kết nối: ' + err.message);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Thực hiện đồng bộ chính
  const handleExecuteSync = async () => {
    setSyncErrorMsg(null);
    setSyncSuccessMsg(null);

    if (selectedCount === 0) {
      alert('Vui lòng chọn ít nhất một mục dữ liệu để thực hiện đồng bộ!');
      return;
    }

    try {
      setIsSyncing(true);

      // 1. Đảm bảo đã xác thực Google
      setSyncSuccessMsg('1/3: Đang kiểm tra xác thực tài khoản Google công vụ...');
      let token = await ensureAccessToken().catch(() => null);
      if (!token) {
        const signResult = await googleSignIn();
        if (!signResult?.accessToken) {
          throw new Error('Chưa thể nhận quyền truy cập Google Sheets. Vui lòng đăng nhập lại tài khoản Google.');
        }
      }

      // 2. Kết nối tới bảng tính Google Sheets
      setSyncSuccessMsg('2/3: Đang kết nối bảng tính Google Sheets của bạn...');
      const customId = GoogleSheetsService.extractSpreadsheetId(customSheetInput);
      const sheet = await GoogleSheetsService.getOrCreateSpreadsheet(customId || undefined);
      setSpreadsheetInfo(sheet);

      const nowVN = formatDateTimeVN(new Date());

      // -------------------------------------------------------------
      // TRƯỜNG HỢP 1: ĐỒNG BỘ TỪ TRANG WEB APP (MẶC ĐỊNH)
      // Dữ liệu trên ứng dụng Web App -> Đẩy sang CSDL / Google Sheets
      // -------------------------------------------------------------
      if (syncSource === 'WEB_APP') {
        setSyncSuccessMsg('3/3: Đang chuẩn bị dữ liệu và đẩy lên bảng tính Google Sheets...');

        const tabsToSync: string[] = [];
        if (syncOptions.employees) tabsToSync.push('DS_NhanSu');
        if (syncOptions.workHistory) tabsToSync.push('QuaTrinhCongTac');
        if (syncOptions.salaryHistory) tabsToSync.push('LichSuLuong');
        if (syncOptions.trainingHistory) tabsToSync.push('DaoTaoBoiDuong');
        if (syncOptions.rewardDiscipline) tabsToSync.push('KhenThuongKyLuat');
        if (syncOptions.departments) tabsToSync.push('DanhMuc_PhongBan');
        if (syncOptions.auditLogs) tabsToSync.push('NhatKyAuditLog');

        await GoogleSheetsService.syncAllDataToSheets(
          sheet.id,
          employees,
          auditLogs,
          departments,
          tabsToSync
        );

        localStorage.setItem('ccty_employees', JSON.stringify(employees));
        localStorage.setItem('ccty_departments', JSON.stringify(departments));
        localStorage.setItem('ccty_decisions', JSON.stringify(decisions));
        localStorage.setItem('ccty_last_sync_time', nowVN);
        setLastSyncTime(nowVN);

        const summary = `Đã đồng bộ thành công từ Web App sang Google Sheets (${tabsToSync.length} phân hệ: ${employees.length} hồ sơ cán bộ, ${departments.length} phòng/trạm)!`;
        setSyncSuccessMsg(summary);
        onLogSyncAction(`Đồng bộ từ Web app sang Google Sheets (${sheet.id}): ${tabsToSync.join(', ')}`);
      } 
      // -------------------------------------------------------------
      // TRƯỜNG HỢP 2: ĐỒNG BỘ TỪ CƠ SỞ DỮ LIỆU
      // Dữ liệu từ CSDL (Google Sheets) -> Cập nhật vào Web App
      // -------------------------------------------------------------
      else {
        setSyncSuccessMsg('3/3: Đang quét dữ liệu từ Google Sheets và phân tích danh sách cán bộ...');
        
        let loadedEmployeesCount = 0;
        let loadedDepartmentsCount = 0;
        let ccCount = 0;
        let vcCount = 0;

        // Nếu chọn đồng bộ nhân sự
        if (syncOptions.employees && onUpdateEmployees) {
          const tabToUse = selectedTab === 'AUTO' ? undefined : selectedTab;
          const freshEmployees = await GoogleSheetsService.loadEmployeesFromSheets(sheet.id, tabToUse);
          
          if (!freshEmployees || freshEmployees.length === 0) {
            setSyncErrorMsg(`Không tìm thấy dòng dữ liệu cán bộ nào trên bảng tính "${sheet.title}". Hãy bấm nút "🔍 Kiểm Tra Hệ Thống & Tìm Lỗi" để kiểm tra các tab có sẵn.`);
            return;
          }

          localStorage.removeItem('ccty_is_mock_cleared');
          onUpdateEmployees(freshEmployees);
          loadedEmployeesCount = freshEmployees.length;

          ccCount = freshEmployees.filter(e => e.staffType === 'Công chức').length;
          vcCount = freshEmployees.filter(e => e.staffType === 'Viên chức').length;
        }

        // Nếu chọn đồng bộ phòng ban
        if (syncOptions.departments && onUpdateDepartments) {
          const freshDepts = await GoogleSheetsService.loadDepartmentsFromSheets(sheet.id);
          if (freshDepts && freshDepts.length > 0) {
            onUpdateDepartments(freshDepts);
            loadedDepartmentsCount = freshDepts.length;
          }
        }

        localStorage.setItem('ccty_last_sync_time', nowVN);
        setLastSyncTime(nowVN);

        const resultInfo = `🎉 ĐÃ ĐỒNG BỘ THÀNH CÔNG! Đã nạp ${loadedEmployeesCount} hồ sơ nhân sự thực tế (${ccCount} Công chức, ${vcCount} Viên chức) và ${loadedDepartmentsCount || departments.length} phòng/trạm từ bảng tính Google Sheets!`;
        setSyncSuccessMsg(resultInfo);
        onLogSyncAction(`Đồng bộ từ Google Sheets về Web app (${sheet.id}): Nạp ${loadedEmployeesCount} cán bộ (${ccCount} Công chức)`);
      }

    } catch (err: any) {
      console.error('Lỗi thực hiện đồng bộ:', err);
      setSyncErrorMsg('Không thể hoàn tất đồng bộ: ' + (err.message || 'Lỗi không xác định. Vui lòng bấm kiểm tra kết nối bên dưới.'));
      setSyncSuccessMsg(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearGoogleSheetData = async () => {
    if (!googleConnected) {
      onLoginGoogle();
      return;
    }
    const confirmed = window.confirm(
      'Hành động này sẽ:\n' +
      '1. Xóa toàn bộ các dòng dữ liệu nhân sự, lương, quá trình công tác cũ trong bảng tính Google Sheet (giữ nguyên đầy đủ hàng tiêu đề cột chuẩn).\n' +
      '2. Làm sạch bộ nhớ dữ liệu trên Web App.\n\n' +
      'Sau khi làm sạch, bạn có thể mở bảng tính Google Sheet để tự nạp/dán 167 Công chức và dữ liệu thực tế của bạn, rồi bấm "Bắt Đầu Đồng Bộ Từ Cơ Sở Dữ Liệu". Bạn có chắc chắn muốn thực hiện?'
    );
    if (!confirmed) return;

    try {
      setIsSyncing(true);
      setSyncSuccessMsg('Đang tiến hành làm sạch các dòng dữ liệu trên bảng tính Google Sheets...');
      const targetId = GoogleSheetsService.extractSpreadsheetId(customSheetInput);
      const res = await GoogleSheetsService.clearDataRowsInSheets(targetId || undefined);
      if (onClearMockData) {
        onClearMockData();
      }
      setSpreadsheetInfo({ id: targetId || '', url: res.url, title: SPREADSHEET_TITLE });
      setSyncSuccessMsg('Đã làm sạch bảng tính Google Sheets thành công! Dòng tiêu đề cột chuẩn được bảo toàn. Bảng tính giờ đây hoàn toàn sạch để bạn tự nạp 167 Công chức thực tế.');
      onLogSyncAction('Làm sạch dữ liệu bảng tính Google Sheets (giữ hàng tiêu đề chuẩn)');
    } catch (err: any) {
      console.error('Lỗi làm sạch Google Sheets:', err);
      setSyncErrorMsg('Không thể làm sạch bảng tính: ' + err.message);
      setSyncSuccessMsg(null);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-sky-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 p-2 flex items-center justify-center border border-white/20">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>TRUNG TÂM ĐỒNG BỘ DỮ LIỆU CHI CỤC</span>
                <span className="bg-emerald-500/30 text-emerald-200 text-[10px] px-2 py-0.5 rounded font-mono">
                  Google Sheets &bull; CSDL
                </span>
              </h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Chi cục Chăn nuôi và Thú y TP.HCM &bull; Định dạng ngày tháng chuẩn: <strong>dd/mm/yyyy</strong>
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-white/15 rounded-lg text-emerald-100 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          
          {/* Status badge & Google account */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
            googleConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${googleConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <div className="font-bold text-[13px]">
                  {googleConnected ? 'Kết nối CSDL Google Sheets: Sẵn sàng' : 'Chưa đăng nhập Google CSDL'}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {googleConnected 
                    ? `Tài khoản kết nối: ${googleUserEmail || 'Tài khoản công vụ'} | Bảng tính: ${spreadsheetInfo?.title || SPREADSHEET_TITLE}` 
                    : 'Cần đăng nhập tài khoản Google công vụ để truy xuất và ghi dữ liệu CSDL.'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRunDiagnosis()}
                disabled={isDiagnosing}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] transition shrink-0 flex items-center gap-1 shadow-2xs"
                title="Kiểm tra toàn diện đường truyền và tìm nguyên nhân không đồng bộ được"
              >
                <Wrench className={`w-3.5 h-3.5 text-amber-600 ${isDiagnosing ? 'animate-spin' : ''}`} />
                <span>Kiểm tra lỗi hệ thống</span>
              </button>

              {!googleConnected && (
                <button
                  onClick={onLoginGoogle}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition shrink-0 shadow-xs"
                >
                  Đăng nhập ngay
                </button>
              )}
            </div>
          </div>

          {/* Cấu Hình Link / ID Bảng Tính Google Sheets Của Bạn */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
                <Link className="w-4 h-4 text-sky-600" />
                <span>Link hoặc Mã ID Google Sheet của bạn (Nếu bạn có file riêng):</span>
              </label>
              {spreadsheetInfo?.url && (
                <a
                  href={spreadsheetInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-700 hover:text-sky-800 font-semibold flex items-center gap-1 text-[11px] hover:underline"
                >
                  <span>Mở bảng tính đang kết nối</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSheetInput}
                onChange={(e) => setCustomSheetInput(e.target.value)}
                placeholder="Dán link Google Sheet (https://docs.google.com/spreadsheets/d/...) hoặc để trống để tự tìm"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={handleApplyCustomSheet}
                className="bg-sky-700 hover:bg-sky-800 text-white px-3 py-2 rounded-lg font-semibold text-xs shrink-0 transition flex items-center gap-1 cursor-pointer"
              >
                <span>Áp dụng & Kiểm tra</span>
              </button>
            </div>

            {/* Danh sách bảng tính tìm thấy trong Drive của người dùng */}
            {driveSpreadsheets.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800 shrink-0">📁 Hoặc chọn bảng tính từ Google Drive:</span>
                <select
                  onChange={(e) => {
                    const sheetId = e.target.value;
                    if (sheetId) {
                      setCustomSheetInput(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
                      GoogleSheetsService.setSavedSpreadsheetId(sheetId);
                      handleRunDiagnosis(sheetId);
                    }
                  }}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-sky-500 flex-1 truncate"
                >
                  <option value="">-- Chọn file bảng tính trong Drive ({driveSpreadsheets.length} file) --</option>
                  {driveSpreadsheets.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} {s.modifiedTime ? `(${s.modifiedTime.slice(0, 10)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {detectedTabs.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Tab dữ liệu nhân sự:</span>
                  <select
                    value={selectedTab}
                    onChange={(e) => setSelectedTab(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="AUTO">✨ Tự động nhận diện tab có dữ liệu</option>
                    {detectedTabs.map((t) => (
                      <option key={t} value={t}>Tab: {t}</option>
                    ))}
                  </select>
                  <span className="text-slate-400">({detectedTabs.length} tab)</span>
                </div>

                {/* Các nút bấm chọn nhanh tab */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium">Bấm chọn tab:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTab('AUTO')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      selectedTab === 'AUTO' ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    Tự động tìm
                  </button>
                  {detectedTabs.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTab(t)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                        selectedTab === t ? 'bg-sky-700 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bảng Kết Quả Chẩn Đoán Lỗi Hệ Thống (Nếu bấm kiểm tra) */}
          {showDiagnosticPanel && diagnosisReport && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-700" />
                  <span>KẾT QUẢ CHẨN ĐOÁN HỆ THỐNG ĐỒNG BỘ:</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowDiagnosticPanel(false)}
                  className="text-amber-700 hover:text-amber-900 text-[11px] font-semibold"
                >
                  Ẩn bảng
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${diagnosisReport.authOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>Xác thực Google: <strong>{diagnosisReport.authOk ? 'Hợp lệ' : 'Chưa đăng nhập'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${diagnosisReport.apiOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>Google Sheets API: <strong>{diagnosisReport.apiOk ? 'Kết nối tốt' : 'Lỗi truy cập'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${diagnosisReport.sheetFound ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>Bảng tính: <strong className="truncate max-w-[150px]">{diagnosisReport.sheetTitle || 'Không tìm thấy'}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${diagnosisReport.rowCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>Dữ liệu phát hiện: <strong>{diagnosisReport.rowCount} dòng (Tab: {diagnosisReport.detectedDataTab || 'Chưa rõ'})</strong></span>
                </div>
              </div>

              {diagnosisReport.issues.length > 0 && (
                <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Vấn đề phát hiện:</span>
                  </div>
                  {diagnosisReport.issues.map((iss, i) => (
                    <div key={i} className="pl-4">&bull; {iss}</div>
                  ))}
                  {diagnosisReport.suggestions.map((sug, i) => (
                    <div key={i} className="pl-4 text-emerald-800 font-semibold">&rarr; Gợi ý: {sug}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thông báo Thành công hoặc Lỗi */}
          {syncSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 font-semibold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="leading-relaxed">{syncSuccessMsg}</span>
            </div>
          )}

          {syncErrorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 font-semibold flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div>{syncErrorMsg}</div>
                <div className="mt-1 text-[11px] font-normal text-rose-800">
                  Bạn có thể dán link Google Sheet ở trên hoặc bấm "Kiểm tra lỗi hệ thống" để tự động phát hiện nguyên nhân.
                </div>
              </div>
            </div>
          )}

          {/* Làm Sạch Dữ Liệu Bảng Tính Google Sheets để tự nhập dữ liệu thực tế */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 border border-orange-300 mt-0.5">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-orange-950 flex items-center gap-1.5">
                  <span>Làm Sạch Bảng Tính Google Sheet & Tự Nạp Dữ Liệu Mới</span>
                  <span className="bg-orange-200 text-orange-900 text-[10px] px-2 py-0.2 rounded-full font-bold">Chuẩn Xác 100%</span>
                </h4>
                <p className="text-[11px] text-orange-800 mt-0.5 leading-relaxed">
                  Xóa sạch toàn bộ các dòng dữ liệu cũ trong bảng tính Google Sheet (bảo toàn dòng tiêu đề chuẩn). Bảng tính sẽ hoàn toàn sạch để bạn tự nạp 167 Công chức và các cán bộ thực tế của bạn, rồi nạp về Web App!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearGoogleSheetData}
              disabled={isSyncing}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
              title="Xóa dòng dữ liệu cũ trên Google Sheet để chuẩn bị nạp mới"
            >
              <span>🧹 Làm Sạch Bảng Tính Sheets</span>
            </button>
          </div>

          {/* 1. CHỌN NGUỒN VÀ HƯỚNG ĐỒNG BỘ DỮ LIỆU */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>1. CHỌN HƯỚNG & NGUỒN ĐỒNG BỘ DỮ LIỆU:</span>
              </label>
              <span className="text-[11px] text-slate-500">Mặc định: Đồng bộ từ Cơ sở dữ liệu về Web</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option B: Đồng bộ từ Cơ sở dữ liệu (ƯU TIÊN KHI NẠP TỪ GOOGLE SHEETS) */}
              <div 
                onClick={() => setSyncSource('DATABASE')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                  syncSource === 'DATABASE'
                    ? 'border-sky-600 bg-sky-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
                      <Database className="w-4 h-4 text-sky-700" />
                      <span>Đồng bộ từ Cơ sở dữ liệu Google Sheets</span>
                    </div>
                    <span className="bg-sky-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                      Nạp về Web
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Tải dữ liệu 167 Công chức và cán bộ mới nhất từ <strong>bảng tính Google Sheets</strong> về cập nhật vào ứng dụng Web app. Đảm bảo hiển thị đúng số liệu thực tế bạn đã nhập.
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-sky-800 font-semibold">
                  <span>Nguồn: CSDL Google Sheets</span>
                  <span>&rarr; Đích: Trang Web app</span>
                </div>
              </div>

              {/* Option A: Đồng bộ từ trang Web app */}
              <div 
                onClick={() => setSyncSource('WEB_APP')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                  syncSource === 'WEB_APP'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
                      <Globe className="w-4 h-4 text-emerald-700" />
                      <span>Đẩy từ Web app lên Google Sheets</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      Lưu trữ CSDL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                    Lấy dữ liệu hồ sơ nhân sự, phòng ban, lương hiện hành trên ứng dụng Web app đẩy lên lưu trữ an toàn trong <strong>bảng tính Google Sheets</strong>.
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-emerald-800 font-semibold">
                  <span>Nguồn: Web app hiện tại</span>
                  <span>&rarr; Đích: Google Sheets</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. CHỌN LỰA DỮ LIỆU ĐỒNG BỘ */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-slate-800 text-[13px]">
                  2. LỰA CHỌN CÁC PHÂN HỆ DỮ LIỆU CẦN ĐỒNG BỘ:
                </span>
                <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full font-mono text-slate-600">
                  Đã chọn {selectedCount} / 8 mục
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sky-700 hover:underline font-semibold"
                >
                  Chọn tất cả
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-500 hover:underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* 1. Hồ sơ nhân sự */}
              <div 
                onClick={() => toggleOption('employees')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.employees ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.employees ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">1. Danh sách nhân sự ({employees.length} cán bộ hiện có)</div>
                  <div className="text-[11px] text-slate-500">
                    Tab DS_NhanSu: Mã NV, họ tên, ngày sinh, CCCD, chức vụ, ngạch, loại cán bộ (Công chức, Viên chức...)
                  </div>
                </div>
              </div>

              {/* 2. Quá trình công tác */}
              <div 
                onClick={() => toggleOption('workHistory')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.workHistory ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.workHistory ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">2. Quá trình công tác & Điều động</div>
                  <div className="text-[11px] text-slate-500">
                    Tab QuaTrinhCongTac: Lịch sử bổ nhiệm, luân chuyển đơn vị, chức danh
                  </div>
                </div>
              </div>

              {/* 3. Lịch sử lương */}
              <div 
                onClick={() => toggleOption('salaryHistory')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.salaryHistory ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.salaryHistory ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">3. Lịch sử nâng lương & Phụ cấp</div>
                  <div className="text-[11px] text-slate-500">
                    Tab LichSuLuong: Bậc lương, hệ số, PCCV, PCTN, thâm niên vượt khung
                  </div>
                </div>
              </div>

              {/* 4. Đào tạo bồi dưỡng */}
              <div 
                onClick={() => toggleOption('trainingHistory')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.trainingHistory ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.trainingHistory ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">4. Đào tạo, bồi dưỡng & Văn bằng</div>
                  <div className="text-[11px] text-slate-500">
                    Tab DaoTaoBoiDuong: Trình độ chuyên môn, văn bằng thú y, lý luận chính trị
                  </div>
                </div>
              </div>

              {/* 5. Khen thưởng kỷ luật */}
              <div 
                onClick={() => {
                  if (syncSource === 'WEB_APP') {
                    alert('Dữ liệu Khen thưởng, Kỷ luật và Thi đua trên CSDL đã hoàn chỉnh. Hệ thống đã khóa tính năng ghi đè từ Web App để bảo vệ và tránh xóa thông tin đã có sẵn.');
                    return;
                  }
                  toggleOption('rewardDiscipline');
                }}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.rewardDiscipline ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.rewardDiscipline ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">5. Khen thưởng, kỷ luật & Thi đua</span>
                    {syncSource === 'WEB_APP' && (
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">
                        Đã bảo vệ CSDL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {syncSource === 'WEB_APP'
                      ? 'Dữ liệu KhenThuongKyLuat đã hoàn chỉnh trên CSDL, không ghi đè để tránh mất thông tin'
                      : 'Nạp danh hiệu thi đua, bằng khen, quyết định khen thưởng kỷ luật từ Google Sheets về Web'}
                  </div>
                </div>
              </div>

              {/* 6. Danh mục phòng ban */}
              <div 
                onClick={() => {
                  if (syncSource === 'WEB_APP') {
                    alert('Dữ liệu Danh mục Phòng ban & Trạm trên CSDL đã hoàn chỉnh. Hệ thống đã khóa tính năng ghi đè từ Web App để bảo vệ và tránh xóa thông tin đã có sẵn.');
                    return;
                  }
                  toggleOption('departments');
                }}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.departments ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.departments ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900">6. Cơ cấu tổ chức & Phòng ban ({departments.length} đơn vị)</span>
                    {syncSource === 'WEB_APP' && (
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded">
                        Đã bảo vệ CSDL
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {syncSource === 'WEB_APP'
                      ? 'Dữ liệu DanhMuc_PhongBan đã hoàn chỉnh trên CSDL, mở để nạp về Web chứ không ghi đè lên'
                      : 'Đồng bộ danh sách phòng ban, trạm, lãnh đạo từ Google Sheets DanhMuc_PhongBan'}
                  </div>
                </div>
              </div>

              {/* 7. Quyết định văn bản */}
              <div 
                onClick={() => toggleOption('decisions')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.decisions ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.decisions ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">7. Quyết định & Văn bản điều hành ({decisions.length} VB)</div>
                  <div className="text-[11px] text-slate-500">
                    Sổ theo dõi quyết định tuyển dụng, bổ nhiệm, điều động Chi cục
                  </div>
                </div>
              </div>

              {/* 8. Nhật ký Audit Log */}
              <div 
                onClick={() => toggleOption('auditLogs')}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-start gap-2.5 ${
                  syncOptions.auditLogs ? 'bg-sky-50/60 border-sky-300' : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                {syncOptions.auditLogs ? (
                  <CheckSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-slate-900">8. Nhật ký hoạt động & Kiểm toán ({auditLogs.length} sự kiện)</div>
                  <div className="text-[11px] text-slate-500">
                    Lịch sử thay đổi thông tin hồ sơ của cán bộ và người thao tác
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Last sync time */}
          {lastSyncTime && (
            <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Thời gian đồng bộ thành công gần nhất: <strong className="text-slate-700">{lastSyncTime}</strong></span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Nguồn đang chọn: <strong className="text-slate-800">{syncSource === 'WEB_APP' ? 'Đẩy dữ liệu từ Web app lên Sheets' : 'Nạp dữ liệu từ Google Sheets về Web app'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            {onClearMockData && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn bỏ toàn bộ dữ liệu giả lập có sẵn của hệ thống? Sau khi xóa, hệ thống sẽ hoàn toàn sạch và chỉ lấy dữ liệu do bạn nhập mới hoặc tải từ Google Sheets.')) {
                    onClearMockData();
                    setSyncSuccessMsg('Đã xóa sạch dữ liệu giả lập có sẵn! Hãy chọn "Đồng bộ từ Cơ sở dữ liệu" để nạp file Google Sheets của bạn.');
                  }
                }}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-semibold px-3 py-2 rounded-lg text-xs transition flex items-center gap-1.5"
                title="Bỏ toàn bộ dữ liệu giả lập có sẵn, chỉ dùng dữ liệu thực tế"
              >
                <span>🗑️ Bỏ Dữ Liệu Giả Lập</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition"
            >
              Đóng
            </button>

            <button
              onClick={handleExecuteSync}
              disabled={isSyncing || selectedCount === 0}
              className={`font-semibold px-5 py-2 rounded-lg text-xs transition flex items-center gap-2 shadow ${
                syncSource === 'WEB_APP'
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-sky-700 hover:bg-sky-800 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing 
                  ? 'Đang thực hiện đồng bộ...' 
                  : syncSource === 'WEB_APP'
                    ? 'Bắt Đầu Đẩy Sang Google Sheets'
                    : 'Bắt Đầu Nạp Từ Google Sheets'}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
