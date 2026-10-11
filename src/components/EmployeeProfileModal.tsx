import React, { useState } from 'react';
import { 
  X, 
  User, 
  Briefcase, 
  GraduationCap, 
  Coins, 
  Award, 
  FileText, 
  Cloud, 
  History, 
  Upload, 
  ExternalLink, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  AlertCircle,
  FolderOpen,
  Printer,
  Shield,
  FileCheck,
  Plus,
  Image as ImageIcon,
  CreditCard,
  Building,
  Flag,
  Check,
  Eye,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Employee, WorkHistoryRecord, SalaryHistoryRecord, TrainingRecord, RewardDisciplineRecord, DocumentRecord } from '../types/hrm';
import { GoogleDriveService } from '../services/googleDriveService';
import { AuthPermissionService } from '../services/authPermissionService';
import { ProfilePrint2CModal } from './ProfilePrint2CModal';
import { formatDateVN } from '../utils/dateUtils';
import { formatBaseSalary, formatDecimal, formatPCCV, formatPercentAllowance } from '../utils/salaryUtils';

interface EmployeeProfileModalProps {
  employee: Employee | null;
  employees?: Employee[];
  onSelectEmployee?: (emp: Employee) => void;
  onClose: () => void;
  onUpdateEmployee: (updated: Employee, auditChange: { field: string; oldVal: string; newVal: string; details: string }) => void;
  onDeleteEmployee?: (empId: string) => void;
  currentUser?: { role: string; roleTitle: string; name: string };
  googleConnected: boolean;
  rootStaffFolderId?: string;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employee,
  employees = [],
  onSelectEmployee,
  onClose,
  onUpdateEmployee,
  onDeleteEmployee,
  currentUser,
  googleConnected,
  rootStaffFolderId,
}) => {
  // Đúng chuẩn 6 Tab theo yêu cầu người dùng
  const [activeTab, setActiveTab] = useState<
    'tab1_personal' | 'tab2_workHistory' | 'tab3_salary' | 'tab4_education' | 'tab5_rewardDiscipline' | 'tab6_driveFiles'
  >('tab1_personal');

  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Xem trước tài liệu
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);

  // Modal phụ: Thêm mốc quá trình công tác
  const [showAddWorkModal, setShowAddWorkModal] = useState(false);
  const [newWorkUnit, setNewWorkUnit] = useState('');
  const [newWorkPos, setNewWorkPos] = useState('');
  const [newWorkStart, setNewWorkStart] = useState('2026-01-01');
  const [newWorkEnd, setNewWorkEnd] = useState('Nay');
  const [newWorkDec, setNewWorkDec] = useState('');
  const [newWorkSigner, setNewWorkSigner] = useState('Chi cục trưởng Chi cục Chăn nuôi và Thú y');

  // Modal phụ: Thêm khen thưởng / kỷ luật
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPrint2CModalOpen, setIsPrint2CModalOpen] = useState(false);
  const [newRewardType, setNewRewardType] = useState<'Khen thưởng' | 'Kỷ luật'>('Khen thưởng');
  const [newRewardForm, setNewRewardForm] = useState('');
  const [newRewardReason, setNewRewardReason] = useState('');
  const [newRewardDec, setNewRewardDec] = useState('');
  const [newRewardDate, setNewRewardDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRewardSigner, setNewRewardSigner] = useState('');

  if (!employee) return null;

  // Tính số liệu mặc định nếu chưa có
  const partyJoinDate = employee.partyJoinDate || 'Chưa vào Đảng';
  const partyOfficialDate = employee.partyOfficialDate || (employee.partyJoinDate ? 'Đã công nhận chính thức' : 'Chưa');
  const partyCardNumber = employee.partyCardNumber || (employee.partyJoinDate ? `ĐV-${employee.code.replace('NV-', '')}` : 'Chưa có');
  const socialInsuranceNum = employee.socialInsuranceNumber || `79${employee.cccd ? employee.cccd.slice(-8) : '12345678'}`;
  const healthInsuranceNum = employee.healthInsuranceNumber || `GD479${employee.cccd ? employee.cccd.slice(-10) : '0123456789'}`;

  // Xử lý tải file lên Google Drive cho nhân viên
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>, 
    docType: DocumentRecord['type'], 
    updateAvatar: boolean = false
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsUploadingDrive(true);
      setUploadStatusMsg('Đang chuẩn bị thư mục Google Drive cho nhân sự...');

      let folderId = employee.driveFolderId;
      let folderLink = employee.driveFolderLink;

      // Nếu đã kết nối Google và có folder mẹ thì tạo hoặc lấy thư mục riêng của nhân viên
      if (googleConnected && rootStaffFolderId) {
        const empFolder = await GoogleDriveService.getOrCreateEmployeeFolder(
          employee.code,
          employee.fullName,
          rootStaffFolderId
        );
        folderId = empFolder.id;
        folderLink = empFolder.webViewLink;
      }

      setUploadStatusMsg(`Đang tải tệp "${file.name}" lên Google Drive...`);

      let driveFileId = '';
      let driveViewLink = '';

      if (googleConnected && folderId) {
        const uploaded = await GoogleDriveService.uploadFile(
          file,
          file.name,
          file.type || 'application/octet-stream',
          folderId
        );
        driveFileId = uploaded.id;
        driveViewLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      } else {
        // Chế độ demo local link
        driveViewLink = URL.createObjectURL(file);
      }

      const newDoc: DocumentRecord = {
        id: `doc-${Date.now()}`,
        employeeId: employee.id,
        title: file.name.replace(/\.[^/.]+$/, ''),
        type: docType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        driveFileId,
        driveViewLink,
        uploadedAt: new Date().toISOString().split('T')[0],
      };

      const updatedDocs = [newDoc, ...employee.documents];
      const updatedEmployee: Employee = {
        ...employee,
        documents: updatedDocs,
        driveFolderId: folderId,
        driveFolderLink: folderLink,
        avatarUrl: updateAvatar ? driveViewLink : employee.avatarUrl,
        updatedAt: new Date().toISOString().split('T')[0],
      };

      onUpdateEmployee(updatedEmployee, {
        field: 'Hồ sơ tài liệu đính kèm',
        oldVal: `${employee.documents.length} tệp`,
        newVal: `${updatedDocs.length} tệp`,
        details: `Đã tải lên tệp: ${file.name} (${docType})`,
      });

      setUploadStatusMsg(`Tải lên thành công tệp ${file.name}!`);
      setTimeout(() => setUploadStatusMsg(null), 3000);
    } catch (err: any) {
      console.error('Lỗi tải tệp:', err);
      alert('Không thể tải tệp lên Google Drive: ' + err.message);
      setUploadStatusMsg(null);
    } finally {
      setIsUploadingDrive(false);
      // Reset input
      event.target.value = '';
    }
  };

  // Thêm mốc quá trình công tác
  const handleAddWorkHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkUnit || !newWorkPos) {
      alert('Vui lòng nhập đơn vị và chức vụ công tác');
      return;
    }

    const newRecord: WorkHistoryRecord = {
      id: `wh-${Date.now()}`,
      employeeId: employee.id,
      startDate: newWorkStart,
      endDate: newWorkEnd,
      unitName: newWorkUnit,
      position: newWorkPos,
      decisionNumber: newWorkDec,
      signedBy: newWorkSigner,
    };

    const updatedEmployee: Employee = {
      ...employee,
      workHistory: [newRecord, ...employee.workHistory],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onUpdateEmployee(updatedEmployee, {
      field: 'Quá trình công tác',
      oldVal: `${employee.workHistory.length} mốc`,
      newVal: `${updatedEmployee.workHistory.length} mốc`,
      details: `Bổ sung quá trình công tác: ${newWorkPos} tại ${newWorkUnit}`,
    });

    setShowAddWorkModal(false);
    setNewWorkUnit('');
    setNewWorkPos('');
    setNewWorkDec('');
  };

  // Thêm mốc khen thưởng/kỷ luật
  const handleAddRewardDiscipline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRewardForm || !newRewardReason) {
      alert('Vui lòng nhập hình thức và lý do khen thưởng/kỷ luật');
      return;
    }

    const newRecord: RewardDisciplineRecord = {
      id: `rd-${Date.now()}`,
      employeeId: employee.id,
      type: newRewardType,
      form: newRewardForm,
      decisionNumber: newRewardDec,
      decisionDate: newRewardDate,
      signLevel: newRewardSigner,
      reason: newRewardReason,
    };

    const updatedEmployee: Employee = {
      ...employee,
      rewardDiscipline: [newRecord, ...employee.rewardDiscipline],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onUpdateEmployee(updatedEmployee, {
      field: 'Khen thưởng & Kỷ luật',
      oldVal: `${employee.rewardDiscipline.length} mục`,
      newVal: `${updatedEmployee.rewardDiscipline.length} mục`,
      details: `Ghi nhận ${newRewardType}: ${newRewardForm}`,
    });

    setShowAddRewardModal(false);
  };

  const printProfile = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-800 via-sky-700 to-cyan-700 text-white px-5 py-3.5 flex items-center justify-between border-b border-sky-600 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-12 h-12 rounded-full bg-white/10 p-0.5 border-2 border-white/40 overflow-hidden shrink-0 flex items-center justify-center font-bold text-base shadow-sm">
                {employee.avatarUrl ? (
                  <img src={employee.avatarUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                ) : (
                  employee.fullName.charAt(0)
                )}
              </div>
              <label 
                title="Đổi ảnh đại diện (Ảnh 3x4 / 4x6)" 
                className="absolute inset-0 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer text-[10px]"
              >
                <span>Đổi ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'Khác', true)}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="bg-sky-500/40 text-sky-100 border border-sky-300/40 px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <FileCheck className="w-3 h-3" /> HỒ SƠ ĐIỆN TỬ NHÂN SỰ (6 TAB)
                </span>
                <span className="text-[11px] text-sky-200 hidden sm:inline">&bull; Chi cục Chăn nuôi & Thú y TP.HCM</span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">{employee.fullName}</h3>
                <span className="bg-sky-900/80 px-2 py-0.5 rounded text-xs font-mono font-bold text-sky-200 border border-sky-500/40">
                  {employee.code}
                </span>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                  employee.status === 'Đang công tác' ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-amber-500/30 text-amber-200'
                }`}>
                  {employee.status}
                </span>
                {employee.leaveDate && (
                  <span className="bg-amber-400/20 text-amber-200 border border-amber-300/40 px-2 py-0.2 rounded-full text-[10px] font-semibold">
                    📅 Nghỉ từ: {formatDateVN(employee.leaveDate)}
                  </span>
                )}
              </div>
              <div className="text-xs text-sky-100 mt-0.5">
                {employee.positionTitle} &bull; {employee.departmentName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDeleteEmployee && AuthPermissionService.isUserAdmin(currentUser) && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Xóa hồ sơ cán bộ này (Chỉ Cấp 1 – Admin có quyền)"
                className="px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs border bg-rose-600/80 hover:bg-rose-600 text-rose-100 hover:text-white border-rose-400/40 cursor-pointer shadow"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span className="hidden sm:inline font-medium">Xóa Hồ Sơ</span>
              </button>
            )}

            <button
              onClick={() => setIsPrint2CModalOpen(true)}
              title="In hồ sơ cán bộ mẫu 2C (Mẫu 2C-BNV/2008, 2C/TCTW-98 & Trích ngang)"
              className="px-2.5 py-1.5 hover:bg-white/10 rounded-lg text-sky-100 hover:text-white transition flex items-center gap-1.5 text-xs border border-white/20 shadow-xs"
            >
              <Printer className="w-4 h-4 text-sky-200" />
              <span className="hidden sm:inline font-medium">In Hồ Sơ Mẫu 2C</span>
            </button>

            <button
              onClick={onClose}
              title="Đóng cửa sổ"
              className="p-1.5 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh chọn nhanh đối tượng cán bộ đang công tác */}
        {employees && employees.length > 0 && onSelectEmployee && (
          <div className="bg-sky-950 text-white px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-sky-800 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-cyan-300 font-bold flex items-center gap-1.5 shrink-0">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Xem đối tượng:</span>
              </span>
              <select
                value={employee.id}
                onChange={(e) => {
                  const target = employees.find(emp => emp.id === e.target.value);
                  if (target) onSelectEmployee(target);
                }}
                className="bg-sky-900 text-white border border-sky-600 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-400 w-full sm:max-w-md truncate cursor-pointer"
              >
                <optgroup label="💼 Danh sách nhân sự Đang công tác">
                  {employees
                    .filter(e => e.status === 'Đang công tác')
                    .map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.code}) &bull; {emp.positionTitle} &bull; {emp.departmentName} [{emp.staffType}]
                      </option>
                    ))}
                </optgroup>
                {employees.some(e => e.status !== 'Đang công tác') && (
                  <optgroup label="📁 Trạng thái khác (Nghỉ hưu / Biệt phái / Tạm hoãn)">
                    {employees
                      .filter(e => e.status !== 'Đang công tác')
                      .map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.code}) &bull; {emp.status} &bull; {emp.departmentName}
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Điều hướng Trước / Tiếp theo */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              <span className="text-[11px] text-sky-300 font-mono hidden md:inline">
                {(() => {
                  const activeList = employees.filter(e => e.status === 'Đang công tác');
                  const currentIdx = activeList.findIndex(e => e.id === employee.id);
                  return currentIdx !== -1 ? `${currentIdx + 1} / ${activeList.length} đang công tác` : '';
                })()}
              </span>
              <button
                onClick={() => {
                  const activeList = employees.filter(e => e.status === 'Đang công tác');
                  const currentIdx = activeList.findIndex(e => e.id === employee.id);
                  if (currentIdx > 0) {
                    onSelectEmployee(activeList[currentIdx - 1]);
                  } else if (activeList.length > 0) {
                    onSelectEmployee(activeList[activeList.length - 1]);
                  }
                }}
                title="Chuyển sang xem cán bộ đang công tác trước đó"
                className="bg-sky-800 hover:bg-sky-700 text-sky-100 hover:text-white px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trước</span>
              </button>
              <button
                onClick={() => {
                  const activeList = employees.filter(e => e.status === 'Đang công tác');
                  const currentIdx = activeList.findIndex(e => e.id === employee.id);
                  if (currentIdx >= 0 && currentIdx < activeList.length - 1) {
                    onSelectEmployee(activeList[currentIdx + 1]);
                  } else if (activeList.length > 0) {
                    onSelectEmployee(activeList[0]);
                  }
                }}
                title="Chuyển sang xem cán bộ đang công tác tiếp theo"
                className="bg-sky-800 hover:bg-sky-700 text-sky-100 hover:text-white px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition"
              >
                <span>Tiếp</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation: ĐÚNG CHUẨN 6 TAB NGHIỆP VỤ */}
        <div className="flex items-center gap-1 px-4 border-b border-slate-200 bg-slate-50 overflow-x-auto text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('tab1_personal')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab1_personal' ? 'border-sky-600 text-sky-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-sky-600" />
            <span>Tab 1 - Lý lịch cá nhân</span>
          </button>

          <button
            onClick={() => setActiveTab('tab2_workHistory')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab2_workHistory' ? 'border-sky-600 text-sky-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-sky-600" />
            <span>Tab 2 - Quá trình công tác ({employee.workHistory.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tab3_salary')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab3_salary' ? 'border-sky-600 text-sky-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-sky-600" />
            <span>Tab 3 - Lương & Phụ cấp</span>
          </button>

          <button
            onClick={() => setActiveTab('tab4_education')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab4_education' ? 'border-sky-600 text-sky-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-sky-600" />
            <span>Tab 4 - Đào tạo & Văn bằng</span>
          </button>

          <button
            onClick={() => setActiveTab('tab5_rewardDiscipline')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab5_rewardDiscipline' ? 'border-sky-600 text-sky-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-sky-600" />
            <span>Tab 5 - Khen thưởng & Kỷ luật ({employee.rewardDiscipline.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tab6_driveFiles')}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === 'tab6_driveFiles' ? 'border-emerald-600 text-emerald-700 font-bold bg-white shadow-xs' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tab 6 - Văn bản & Tệp hồ sơ ({employee.documents.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          
          {/* ============================================================== */}
          {/* TAB 1 - LÝ LỊCH CÁ NHÂN */}
          {/* ============================================================== */}
          {activeTab === 'tab1_personal' && (
            <div className="space-y-4">
              
              {/* Thẻ định danh cơ bản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-medium">Mã Nhân Viên</div>
                  <div className="text-sm font-bold text-slate-900 mt-1 font-mono">{employee.code}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Chi cục Chăn nuôi & Thú y</div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-medium">Họ và Tên khai sinh</div>
                  <div className="text-sm font-bold text-slate-900 mt-1 uppercase">{employee.fullName}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Giới tính: <span className="font-semibold text-slate-700">{employee.gender}</span></div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-medium">Ngày sinh & Nơi sinh</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{formatDateVN(employee.dob)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Nơi sinh: {employee.birthplace}</div>
                </div>

                <div className="bg-sky-50/70 p-3.5 rounded-xl border border-sky-200">
                  <div className="text-sky-800 font-medium">Phòng / Trạm Công Tác</div>
                  <div className="text-sm font-bold text-sky-950 mt-1">{employee.departmentName}</div>
                  <div className="text-[10px] text-sky-700 mt-0.5">{employee.positionTitle} ({employee.staffType})</div>
                </div>
              </div>

              {/* Thông tin Căn cước công dân (CCCD) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-sky-800 border-b pb-2">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  <span>1. Thông tin Căn cước công dân (CCCD) & Quốc tịch</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-slate-500">Số Căn cước công dân (CCCD):</span>
                    <div className="font-mono font-bold text-slate-900 text-sm mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-200 inline-block">
                      {employee.cccd}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Ngày cấp CCCD:</span>
                    <div className="font-semibold text-slate-800 mt-1">{formatDateVN(employee.cccdDate)}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Nơi cấp:</span>
                    <div className="font-semibold text-slate-800 mt-1">{employee.cccdPlace}</div>
                  </div>
                </div>
              </div>

              {/* Thông tin Đảng viên (Ngày vào Đảng, Ngày chính thức) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-red-800 border-b pb-2">
                  <Flag className="w-4 h-4 text-red-600" />
                  <span>2. Thông tin Đảng viên (Đảng Cộng Sản Việt Nam)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-slate-500">Tình trạng Đảng viên:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {employee.partyJoinDate ? (
                        <span className="text-red-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Đảng viên ĐCSVN
                        </span>
                      ) : (
                        <span className="text-slate-500">Chưa vào Đảng</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Ngày vào Đảng (Dự bị):</span>
                    <div className="font-bold text-red-700 mt-0.5">{partyJoinDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Ngày chính thức:</span>
                    <div className="font-bold text-red-800 mt-0.5">{partyOfficialDate}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Số thẻ Đảng viên:</span>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">{partyCardNumber}</div>
                  </div>
                </div>
              </div>

              {/* Thông tin Bảo hiểm (BHXH, BHYT) */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-emerald-800 border-b pb-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>3. Chế độ Bảo hiểm (BHXH & BHYT)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <span className="text-slate-500">Số sổ Bảo hiểm xã hội (BHXH):</span>
                    <div className="font-mono font-bold text-emerald-900 text-sm mt-0.5 bg-emerald-50 p-1.5 rounded border border-emerald-200 inline-block">
                      {socialInsuranceNum}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Mã thẻ Bảo hiểm y tế (BHYT):</span>
                    <div className="font-mono font-bold text-emerald-900 text-sm mt-0.5 bg-emerald-50 p-1.5 rounded border border-emerald-200 inline-block">
                      {healthInsuranceNum}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Tình trạng đóng bảo hiểm:</span>
                    <div className="font-semibold text-emerald-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đang tham gia tại Chi cục BVTV & Thú y</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Địa chỉ & Liên lạc */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-sky-800 border-b pb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span>4. Quê quán, Địa chỉ thường trú & Liên lạc</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500">Quê quán:</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{employee.hometown}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Nơi ở hiện nay (Địa chỉ thường trú):</span>
                    <div className="font-semibold text-slate-800 mt-0.5">{employee.address}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Số điện thoại liên lạc:</span>
                    <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-sky-600" />
                      <span>{employee.phone}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Hộp thư điện tử (Email công vụ):</span>
                    <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-sky-600" />
                      <span>{employee.email}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Dân tộc:</span>
                    <span className="font-semibold text-slate-800 ml-1.5">{employee.ethnicity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tôn giáo:</span>
                    <span className="font-semibold text-slate-800 ml-1.5">{employee.religion}</span>
                  </div>
                </div>
              </div>

              {/* Thông tin Quản lý Công chức, Viên chức & Chức danh nghề nghiệp */}
              <div className="border border-sky-200 bg-sky-50/40 rounded-xl p-4 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs uppercase tracking-wider text-sky-900 border-b border-sky-200 pb-2 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-sky-700" />
                  <span>5. Thông tin Quản lý Công chức, Viên chức & Chức danh nghề nghiệp</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Phân loại biên chế:</span>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        employee.staffType === 'Công chức' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                        employee.staffType === 'Viên chức' ? 'bg-teal-100 text-teal-900 border border-teal-300' :
                        'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}>
                        {employee.staffType}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Mã ngạch & Tên ngạch:</span>
                    <div className="font-mono font-bold text-sky-950 mt-1">
                      {employee.jobRankCode} - {employee.jobRankName || employee.positionTitle}
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Ngày tuyển dụng vào ngành:</span>
                    <div className="font-bold text-slate-900 mt-1">{formatDateVN(employee.recruitmentDate) || 'Chưa cập nhật'}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Ngày vào biên chế chính thức:</span>
                    <div className="font-bold text-slate-900 mt-1">{formatDateVN(employee.officialDate || employee.recruitmentDate) || 'Chưa cập nhật'}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Trạng thái công tác:</span>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        employee.status === 'Đang công tác' ? 'bg-emerald-100 text-emerald-800' :
                        employee.status === 'Nghỉ hưu' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {employee.status}
                      </span>
                    </div>
                  </div>
                  {(employee.leaveDate || employee.status === 'Nghỉ hưu' || employee.status === 'Thôi việc') && (
                    <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-300">
                      <span className="text-amber-900 font-bold text-[11px] flex items-center gap-1">
                        <span>🏖️</span>
                        <span>Ngày bắt đầu nghỉ:</span>
                      </span>
                      <div className="font-bold text-amber-950 mt-1">
                        {formatDateVN(employee.leaveDate) || 'Chưa cập nhật ngày nghỉ'}
                      </div>
                      {employee.leaveDecisionNumber && (
                        <div className="text-[10px] text-amber-800 mt-0.5 font-medium">QĐ: {employee.leaveDecisionNumber}</div>
                      )}
                      {employee.leaveReason && (
                        <div className="text-[10px] text-amber-700 italic mt-0.5">{employee.leaveReason}</div>
                      )}
                    </div>
                  )}
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                    <span className="text-slate-500 text-[11px]">Bồi dưỡng QLNN:</span>
                    <div className="font-semibold text-slate-800 mt-1">{employee.stateManagementLevel || 'Chuyên viên'}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-sky-100 sm:col-span-2">
                    <span className="text-slate-500 text-[11px]">Chứng chỉ hành nghề thú y / KĐV:</span>
                    <div className="font-semibold text-sky-900 mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{employee.practicingCertNumber || employee.education.veterinaryCert || 'Đã cấp chứng chỉ hành nghề theo quy định'}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2 - QUÁ TRÌNH CÔNG TÁC */}
          {/* ============================================================== */}
          {activeTab === 'tab2_workHistory' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 p-3.5 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sky-950 flex items-center gap-1.5 text-sm">
                    <History className="w-4 h-4 text-sky-700" />
                    <span>Lịch sử thuyên chuyển, bổ nhiệm & kiêm nhiệm</span>
                  </div>
                  <p className="text-sky-800 text-[11px] mt-0.5">
                    Quản lý toàn bộ quá trình công tác từ khi tuyển dụng, phân công nhiệm vụ, điều động các trạm kiểm dịch theo quy chuẩn 2C/TCTW.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddWorkModal(true)}
                  className="bg-sky-700 hover:bg-sky-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghi nhận mốc mới</span>
                </button>
              </div>

              {/* Bảng mốc thời gian */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Thời Gian (Từ &rarr; Đến)</th>
                      <th className="py-2.5 px-3">Đơn Vị Công Tác</th>
                      <th className="py-2.5 px-3">Chức Vụ / Nhiệm Vụ</th>
                      <th className="py-2.5 px-3">Số Quyết Định</th>
                      <th className="py-2.5 px-3">Người Ký / Thẩm Quyền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employee.workHistory.map((wh) => (
                      <tr key={wh.id} className="hover:bg-sky-50/50 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap font-mono text-[11px]">
                          {formatDateVN(wh.startDate)} &rarr; <span className={wh.endDate === 'Nay' ? 'text-emerald-700 font-bold' : ''}>{wh.endDate === 'Nay' ? 'Nay' : formatDateVN(wh.endDate)}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{wh.unitName}</td>
                        <td className="py-2.5 px-3 font-bold text-sky-800">
                          <span className="bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            {wh.position}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{wh.decisionNumber || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{wh.signedBy || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Form bổ sung mốc công tác */}
              {showAddWorkModal && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3 animate-in fade-in">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center justify-between">
                    <span>Thêm mốc điều động / bổ nhiệm / kiêm nhiệm mới:</span>
                    <button onClick={() => setShowAddWorkModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <form onSubmit={handleAddWorkHistory} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Đơn vị công tác (*)</label>
                      <input
                        type="text"
                        required
                        value={newWorkUnit}
                        onChange={(e) => setNewWorkUnit(e.target.value)}
                        placeholder="VD: Trạm Thú y Hóc Môn / Phòng Dịch tễ"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Chức vụ / Nhiệm vụ (*)</label>
                      <input
                        type="text"
                        required
                        value={newWorkPos}
                        onChange={(e) => setNewWorkPos(e.target.value)}
                        placeholder="VD: Trạm phó, Kiểm dịch viên"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Từ ngày</label>
                      <input
                        type="date"
                        value={newWorkStart}
                        onChange={(e) => setNewWorkStart(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Đến ngày</label>
                      <input
                        type="text"
                        value={newWorkEnd}
                        onChange={(e) => setNewWorkEnd(e.target.value)}
                        placeholder="Nay hoặc YYYY-MM-DD"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Số Quyết Định</label>
                      <input
                        type="text"
                        value={newWorkDec}
                        onChange={(e) => setNewWorkDec(e.target.value)}
                        placeholder="VD: 145/QĐ-CCNNTY"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddWorkModal(false)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded font-semibold shadow-sm"
                      >
                        Lưu Mốc Công Tác
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3 - LƯƠNG & PHỤ CẤP */}
          {/* ============================================================== */}
          {activeTab === 'tab3_salary' && (
            <div className="space-y-4">
              
              {/* Thẻ chỉ số lương & các loại phụ cấp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200">
                  <div className="text-sky-800 font-medium text-[11px]">BẬC LƯƠNG</div>
                  <div className="font-black text-sky-950 text-xl mt-1">
                    Bậc {employee.salary.step} <span className="text-xs font-normal text-slate-500">/ {employee.salary.maxStep}</span>
                  </div>
                  <div className="text-[10px] text-sky-700 mt-1 font-semibold truncate">
                    {employee.jobRankCode}
                  </div>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                  <div className="text-emerald-800 font-medium text-[11px]">HỆ SỐ LƯƠNG</div>
                  <div className="font-black text-emerald-800 text-xl mt-1 font-mono">
                    {formatDecimal(employee.salary.coefficient, 2)}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1">
                    Hệ số hiện hưởng
                  </div>
                </div>

                <div className="bg-teal-50 p-3.5 rounded-xl border border-teal-200">
                  <div className="text-teal-800 font-medium text-[11px]">LƯƠNG CƠ SỞ</div>
                  <div className="font-black text-teal-900 text-lg mt-1 font-mono">
                    {formatBaseSalary(employee.salary.baseSalary)}
                  </div>
                  <div className="text-[10px] text-teal-700 mt-1">
                    Mặc định 2.530.000 đ
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="text-slate-600 font-medium text-[11px]">PHỤ CẤP CV (PCCV)</div>
                  <div className="font-black text-indigo-900 text-xl mt-1 font-mono">
                    {formatPCCV(employee.salary.leadershipAllowance)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">
                    Định dạng Decimal &bull; {employee.positionTitle}
                  </div>
                </div>

                <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200">
                  <div className="text-indigo-800 font-medium text-[11px]">ƯU ĐÃI NGÀNH</div>
                  <div className="font-black text-indigo-900 text-xl mt-1 font-mono">
                    {formatPercentAllowance(employee.salary.industryAllowancePercent, 10)}
                  </div>
                  <div className="text-[10px] text-indigo-700 mt-1">
                    Mặc định 10% ngành
                  </div>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                  <div className="text-emerald-800 font-medium text-[11px]">PHỤ CẤP CÔNG VỤ</div>
                  <div className="font-black text-emerald-900 text-xl mt-1 font-mono">
                    {formatPercentAllowance(employee.salary.publicServiceAllowancePercent, 25)}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-1">
                    Mặc định 25% công vụ
                  </div>
                </div>
              </div>

              {/* Hộp theo dõi dự kiến nâng bậc tiếp theo */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="font-bold text-blue-950 flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-blue-700" />
                    <span>Thời điểm dự kiến xét nâng bậc lương tiếp theo:</span>
                  </div>
                  <div className="text-base font-mono font-black text-blue-900 mt-1">
                    {employee.salary.nextSalaryIncreaseDate || '2026-10-01'}
                  </div>
                  <div className="text-xs text-blue-700 mt-0.5">
                    Chu kỳ xét: 36 tháng đối với ngạch Chuyên viên, 24 tháng đối với ngạch Cán sự / Nhân viên &bull; Thâm niên nghề: <strong>{employee.salary.seniorityAllowancePercent}%</strong>
                  </div>
                </div>

                <span className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 self-start sm:self-center shadow-xs">
                  Hệ thống theo dõi nâng lương tự động
                </span>
              </div>

              {/* Bảng lịch sử nâng bậc lương qua các năm */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center justify-between">
                  <span>Lịch sử nâng bậc lương qua các năm</span>
                  <span className="text-slate-500 font-normal text-xs">{employee.salaryHistory.length} quyết định lưu trữ</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <tr>
                      <th className="py-2.5 px-3">Bậc Lương</th>
                      <th className="py-2.5 px-3">Hệ Số</th>
                      <th className="py-2.5 px-3">Ngày Hưởng</th>
                      <th className="py-2.5 px-3">Loại Nâng Lương</th>
                      <th className="py-2.5 px-3">Số Quyết Định & Ngày Ký</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employee.salaryHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">
                          Chưa ghi nhận lịch sử nâng lương trước đó.
                        </td>
                      </tr>
                    ) : (
                      employee.salaryHistory.map((sh) => (
                        <tr key={sh.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">Bậc {sh.step}</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">{sh.coefficient}</td>
                          <td className="py-2 px-3">{formatDateVN(sh.effectiveDate)}</td>
                          <td className="py-2 px-3">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700">
                              {sh.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">{sh.decisionNumber} ({formatDateVN(sh.decisionDate)})</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4 - ĐÀO TẠO & VĂN BẰNG */}
          {/* ============================================================== */}
          {activeTab === 'tab4_education' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Bằng cấp chuyên môn */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                  <h4 className="font-bold text-sky-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <GraduationCap className="w-4 h-4 text-sky-600" />
                    <span>1. Bằng cấp chuyên môn (Bác sĩ thú y / Thạc sĩ / Tiến sĩ)</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Trình độ chuyên môn cao nhất:</span>
                    <div className="font-black text-sky-900 text-base mt-0.5 bg-sky-50 px-2 py-1 rounded inline-block border border-sky-200">
                      {employee.education.highestDegree}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Chuyên ngành đào tạo:</span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">{employee.education.major}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Cơ sở đào tạo:</span>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      {employee.education.school} &bull; Năm tốt nghiệp: <span className="font-bold text-sky-800">{employee.education.gradYear}</span>
                    </div>
                  </div>
                </div>

                {/* Chứng chỉ hành nghề thú y */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                  <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    <span>2. Chứng chỉ hành nghề Chăn nuôi & Thú y</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Chứng chỉ hành nghề / Thẻ Kiểm dịch viên:</span>
                    <div className="font-bold text-emerald-900 text-sm mt-0.5">
                      {employee.education.veterinaryCert || 'Chứng chỉ hành nghề Thú y theo quy chuẩn Cục Thú y'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Phạm vi chuyên môn hành nghề:</span>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      Kiểm dịch động vật, kiểm soát giết mổ, chẩn đoán xét nghiệm & phòng chống dịch bệnh gia súc, gia cầm.
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Cơ quan cấp chứng chỉ:</span>
                    <div className="font-semibold text-slate-700 mt-0.5">
                      Sở Nông nghiệp và Phát triển nông thôn TP.HCM / Cục Thú y
                    </div>
                  </div>
                </div>

                {/* Lý luận chính trị */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                  <h4 className="font-bold text-red-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <Flag className="w-4 h-4 text-red-600" />
                    <span>3. Trình độ Lý luận chính trị</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Trình độ Lý luận chính trị:</span>
                    <div className="font-bold text-red-800 text-sm mt-0.5">
                      {employee.education.politicalTheory}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Cơ sở đào tạo lý luận:</span>
                    <div className="font-semibold text-slate-800 mt-0.5">
                      Học viện Cán bộ TP.HCM / Trường Chính trị cấp tỉnh, thành
                    </div>
                  </div>
                </div>

                {/* Bồi dưỡng Quản lý nhà nước & Kỹ năng */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white shadow-xs">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b pb-2">
                    <Shield className="w-4 h-4 text-slate-600" />
                    <span>4. Bồi dưỡng Quản lý nhà nước, Ngoại ngữ & Tin học</span>
                  </h4>
                  <div>
                    <span className="text-slate-500">Bồi dưỡng Quản lý nhà nước:</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {employee.stateManagementLevel || 'Đạt chuẩn ngạch Chuyên viên / Lãnh đạo cấp phòng'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500">Ngoại ngữ:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">{employee.education.foreignLanguage}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Tin học:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">{employee.education.informatics}</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5 - KHEN THƯỞNG & KỶ LUẬT */}
          {/* ============================================================== */}
          {activeTab === 'tab5_rewardDiscipline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Lịch sử thi đua, khen thưởng các cấp & Ghi chú kỷ luật</span>
                  </h4>
                  <p className="text-slate-500 text-xs">
                    Theo dõi đầy đủ bằng khen UBND Thành phố, Chiến sĩ thi đua, Bằng khen Bộ NN&PTNT.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddRewardModal(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Khen Thưởng / Kỷ Luật</span>
                </button>
              </div>

              {/* Form bổ sung */}
              {showAddRewardModal && (
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl space-y-3 animate-in fade-in">
                  <div className="font-bold text-amber-950 text-xs uppercase tracking-wide flex items-center justify-between">
                    <span>Ghi nhận Khen thưởng hoặc Kỷ luật mới:</span>
                    <button onClick={() => setShowAddRewardModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  <form onSubmit={handleAddRewardDiscipline} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Phân loại (*)</label>
                      <select
                        value={newRewardType}
                        onChange={(e) => setNewRewardType(e.target.value as any)}
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="Khen thưởng">Khen thưởng</option>
                        <option value="Kỷ luật">Kỷ luật</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Hình thức khen thưởng / kỷ luật (*)</label>
                      <input
                        type="text"
                        required
                        value={newRewardForm}
                        onChange={(e) => setNewRewardForm(e.target.value)}
                        placeholder="VD: Bằng khen UBND TPHCM / Chiến sĩ thi đua"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Số Quyết Định</label>
                      <input
                        type="text"
                        value={newRewardDec}
                        onChange={(e) => setNewRewardDec(e.target.value)}
                        placeholder="VD: 342/QĐ-UBND"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-slate-600">Lý do / Thành tích (*)</label>
                      <input
                        type="text"
                        required
                        value={newRewardReason}
                        onChange={(e) => setNewRewardReason(e.target.value)}
                        placeholder="VD: Có thành tích xuất sắc trong công tác phòng chống dịch cúm gia cầm năm 2025"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Cơ quan ban hành / Ký</label>
                      <input
                        type="text"
                        value={newRewardSigner}
                        onChange={(e) => setNewRewardSigner(e.target.value)}
                        placeholder="VD: UBND TP.HCM"
                        className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddRewardModal(false)}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-semibold"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-semibold shadow-sm"
                      >
                        Lưu Quyết Định
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Danh sách khen thưởng / kỷ luật */}
              {employee.rewardDiscipline.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  Chưa ghi nhận mục khen thưởng hoặc kỷ luật. Nhấn "Thêm Khen Thưởng" để bổ sung.
                </div>
              ) : (
                <div className="space-y-3">
                  {employee.rewardDiscipline.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border shadow-xs ${
                        item.type === 'Khen thưởng' ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className={`w-4 h-4 ${item.type === 'Khen thưởng' ? 'text-emerald-600' : 'text-rose-600'}`} />
                          <span className="font-bold text-slate-900 text-sm">{item.form}</span>
                          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                            item.type === 'Khen thưởng' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.type}
                          </span>
                        </div>
                        <span className="text-slate-500 text-xs font-medium">Ngày quyết định: {formatDateVN(item.decisionDate)}</span>
                      </div>
                      <div className="text-slate-700 mt-1.5 font-medium">{item.reason}</div>
                      <div className="text-slate-500 text-[11px] mt-1 flex items-center gap-2">
                        <span>Số QĐ: <strong className="font-mono text-slate-800">{item.decisionNumber}</strong></span>
                        <span>&bull;</span>
                        <span>Cấp ký: <strong className="text-slate-800">{item.signLevel}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 6 - VĂN BẢN & TỆP HỒ SƠ (DRIVE) */}
          {/* ============================================================== */}
          {activeTab === 'tab6_driveFiles' && (
            <div className="space-y-4">
              
              {/* Thẻ liên kết Google Drive */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="font-bold text-emerald-950 flex items-center gap-2 text-sm">
                    <Cloud className="w-5 h-5 text-emerald-600" />
                    <span>Thư mục lưu trữ tài liệu cá nhân trên Google Drive:</span>
                  </div>
                  <div className="text-slate-600 text-xs mt-1">
                    {employee.driveFolderLink ? (
                      <a 
                        href={employee.driveFolderLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-emerald-700 hover:underline font-semibold flex items-center gap-1.5"
                      >
                        <span>Mở trực tiếp thư mục Google Drive của {employee.fullName}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span>Đường dẫn Drive: <code>Chi Cục Chăn Nuôi & Thú Y / 01_Hồ_Sơ_Cán_Bộ_Nhân_Viên / {employee.code}_{employee.fullName}</code></span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-emerald-800 font-semibold bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200">
                  {employee.documents.length} tệp số hóa
                </div>
              </div>

              {/* 3 Nút Tải Lên Chuyên Biệt Theo Yêu Cầu Người Dùng */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* 1. Tải Ảnh Thẻ */}
                <label className="p-3.5 bg-white border border-slate-200 hover:border-sky-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-sky-700 transition">Ảnh thẻ 3x4 / 4x6</div>
                    <div className="text-[10px] text-slate-500">Cập nhật ảnh đại diện & lưu Drive</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'Khác', true)}
                    className="hidden"
                    disabled={isUploadingDrive}
                  />
                </label>

                {/* 2. Tải Scan CCCD */}
                <label className="p-3.5 bg-white border border-slate-200 hover:border-emerald-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition">Bản scan CCCD</div>
                    <div className="text-[10px] text-slate-500">Tải scan 2 mặt CCCD gắn chip</div>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e, 'CCCD')}
                    className="hidden"
                    disabled={isUploadingDrive}
                  />
                </label>

                {/* 3. Tải File PDF Quyết Định / 2C */}
                <label className="p-3.5 bg-white border border-slate-200 hover:border-rose-400 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-rose-700 transition">File PDF Quyết Định</div>
                    <div className="text-[10px] text-slate-500">Bổ nhiệm, nâng lương, 2C/TCTW</div>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileUpload(e, 'Quyết định bổ nhiệm')}
                    className="hidden"
                    disabled={isUploadingDrive}
                  />
                </label>

              </div>

              {uploadStatusMsg && (
                <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse border border-blue-200">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              {/* Bảng danh sách toàn bộ tệp đính kèm */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex justify-between">
                  <span>Danh sách tài liệu đã đính kèm ({employee.documents.length})</span>
                  <span className="text-slate-500 font-normal">Hỗ trợ tệp PDF, Ảnh thẻ 3x4, Scan CCCD</span>
                </div>

                {employee.documents.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    Chưa có tệp hồ sơ nào. Nhấn vào các ô tải lên ở trên để thêm Ảnh thẻ, Scan CCCD hoặc Quyết định PDF.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                      <tr>
                        <th className="py-2.5 px-3">Tên Tệp / Tài Liệu</th>
                        <th className="py-2.5 px-3">Phân Loại</th>
                        <th className="py-2.5 px-3">Ngày Tải Lên</th>
                        <th className="py-2.5 px-3">Dung Lượng</th>
                        <th className="py-2.5 px-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employee.documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                            <span>{doc.fileName}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200">
                              {doc.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{doc.uploadedAt}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono">
                            {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : '420 KB'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-semibold hover:underline"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Xem</span>
                              </button>
                              {doc.driveViewLink && (
                                <a
                                  href={doc.driveViewLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-semibold hover:underline"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Drive</span>
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal xem trước tài liệu */}
              {previewDoc && (
                <div className="fixed inset-0 bg-slate-900/70 z-60 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-300">
                    <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                      <div className="font-bold text-xs truncate max-w-md">{previewDoc.fileName}</div>
                      <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-white">✕</button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-100">
                      {previewDoc.fileName.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                        <img 
                          src={previewDoc.driveViewLink || previewDoc.fileUrl} 
                          alt={previewDoc.fileName}
                          className="max-h-[60vh] max-w-full rounded shadow object-contain" 
                        />
                      ) : (
                        <div className="text-center p-6 space-y-3">
                          <FileText className="w-16 h-16 text-rose-500 mx-auto" />
                          <div className="font-bold text-slate-800 text-sm">{previewDoc.fileName}</div>
                          <p className="text-slate-500 text-xs">Tài liệu PDF / Văn bản số hóa đã được lưu trữ an toàn trên Google Drive.</p>
                          {previewDoc.driveViewLink && (
                            <a
                              href={previewDoc.driveViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg text-xs"
                            >
                              <span>Mở xem toàn màn hình trên Google Drive</span>
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500">
            Hồ sơ điện tử chuẩn 6 Tab &bull; Cập nhật lần cuối: <span className="font-semibold text-slate-700">{employee.updatedAt}</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg transition"
          >
            Đóng Hồ Sơ
          </button>
        </div>

        {/* Modal Xác Nhận Xóa Hồ Sơ (Thay thế window.confirm) */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-xs">
              <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-sm">Xác Nhận Xóa Hồ Sơ Cán Bộ</h3>
                </div>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-rose-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ của cán bộ sau khỏi cơ sở dữ liệu?
                </p>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                  <div className="font-bold text-slate-900 text-sm">{employee.fullName}</div>
                  <div className="font-mono text-sky-800 text-xs">Mã nhân sự: {employee.code}</div>
                  <div className="text-slate-600">{employee.positionTitle} &bull; {employee.departmentName}</div>
                  <div className="text-[11px] text-rose-700 font-semibold mt-1">
                    Trạng thái: {employee.status}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 italic">
                  * Thao tác này sẽ xóa hồ sơ khỏi cơ sở dữ liệu và lưu vết vào Nhật ký hệ thống (Audit Log).
                </p>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteEmployee) {
                        onDeleteEmployee(employee.id);
                        onClose();
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Xác Nhận Xóa</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal In Hồ Sơ Mẫu 2C Chuẩn Bộ Nội Vụ */}
        <ProfilePrint2CModal
          isOpen={isPrint2CModalOpen}
          onClose={() => setIsPrint2CModalOpen(false)}
          employee={employee}
        />

      </div>
    </div>
  );
};
