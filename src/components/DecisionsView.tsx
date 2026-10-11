import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Download, 
  ExternalLink, 
  Calendar, 
  Search, 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Paperclip, 
  Eye, 
  FolderSync,
  FileCheck,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Decision } from '../types/hrm';
import { GoogleDriveService } from '../services/googleDriveService';
import { AuthPermissionService } from '../services/authPermissionService';
import { formatDateVN } from '../utils/dateUtils';

interface DecisionsViewProps {
  decisions: Decision[];
  onAddDecision: (decision: Decision) => void;
  onUpdateDecision?: (decision: Decision) => void;
  onDeleteDecision?: (decisionId: string) => void;
  currentUser?: any;
  googleConnected?: boolean;
}

export const DecisionsView: React.FC<DecisionsViewProps> = ({
  decisions,
  onAddDecision,
  onUpdateDecision,
  onDeleteDecision,
  currentUser,
  googleConnected = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [decisionToDelete, setDecisionToDelete] = useState<Decision | null>(null);

  const isAdmin = AuthPermissionService.isUserAdmin(currentUser);

  // Form states
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<Decision['type']>('Điều động');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [signLevel, setSignLevel] = useState('Chi cục trưởng Chi cục Chăn nuôi & Thú y');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [employeeNamesInput, setEmployeeNamesInput] = useState('');

  // PDF Attachment states
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [customDriveLink, setCustomDriveLink] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick attach PDF to existing decision
  const [attachingToDecision, setAttachingToDecision] = useState<Decision | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview PDF Modal
  const [previewPdf, setPreviewPdf] = useState<{ url: string; title: string; driveLink?: string } | null>(null);

  const filteredDecisions = decisions.filter(dec => {
    const q = searchTerm.toLowerCase();
    return (
      dec.number.toLowerCase().includes(q) ||
      dec.title.toLowerCase().includes(q) ||
      dec.type.toLowerCase().includes(q) ||
      (dec.employeeNames && dec.employeeNames.some(n => n.toLowerCase().includes(q)))
    );
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Vui lòng chọn tệp định dạng PDF (.pdf)');
        return;
      }
      setSelectedPdfFile(file);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!number.trim() || !title.trim()) {
      alert('Vui lòng nhập số quyết định và trích yếu.');
      return;
    }

    setIsUploading(true);
    let driveFileId = '';
    let driveViewLink = customDriveLink.trim();
    let fileUrl = '';

    try {
      if (selectedPdfFile) {
        setUploadStatusMsg('Đang xử lý tệp PDF...');
        
        // Tạo link xem nhanh local
        try {
          fileUrl = await readFileAsDataUrl(selectedPdfFile);
        } catch {
          fileUrl = URL.createObjectURL(selectedPdfFile);
        }

        // Nếu đã kết nối Google Drive, tải trực tiếp vào thư mục 02_Văn_Bản_Quyết_Định_Tổ_Chức
        if (googleConnected) {
          setUploadStatusMsg('Đang tải tệp PDF lên Google Drive...');
          try {
            const { decisionsFolder } = await GoogleDriveService.initSystemDriveStructure();
            const sanitizedNumber = number.replace(/[/\\?%*:|"<>]/g, '_');
            const sanitizedName = `${sanitizedNumber}_${selectedPdfFile.name}`;
            
            const uploaded = await GoogleDriveService.uploadFile(
              selectedPdfFile,
              sanitizedName,
              'application/pdf',
              decisionsFolder.id
            );

            driveFileId = uploaded.id;
            driveViewLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
          } catch (uploadErr: any) {
            console.warn('Lỗi khi tải file lên Google Drive:', uploadErr);
            // Vẫn tiếp tục tạo quyết định với tệp local
          }
        }
      }

      const empNames = employeeNamesInput
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

      const newDec: Decision = {
        id: `dec-${Date.now()}`,
        number: number.trim(),
        date,
        type,
        title: title.trim(),
        content: content.trim() || title.trim(),
        signLevel,
        effectiveDate,
        employeeIds: [],
        employeeNames: empNames.length > 0 ? empNames : ['Cán bộ liên quan'],
        fileUrl: fileUrl || undefined,
        driveFileId: driveFileId || undefined,
        driveViewLink: driveViewLink || undefined,
      };

      onAddDecision(newDec);
      
      // Reset form
      setShowAddModal(false);
      setNumber('');
      setTitle('');
      setContent('');
      setEmployeeNamesInput('');
      setSelectedPdfFile(null);
      setCustomDriveLink('');
      setShowLinkInput(false);
      setUploadStatusMsg('');
    } catch (err: any) {
      alert('Có lỗi xảy ra: ' + (err.message || 'Không thể tạo quyết định'));
    } finally {
      setIsUploading(false);
    }
  };

  // Xử lý đính kèm tệp PDF nhanh cho quyết định có sẵn trong bảng
  const handleQuickAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!attachingToDecision || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Vui lòng chọn tệp định dạng PDF (.pdf)');
      return;
    }

    try {
      let fileUrl = '';
      try {
        fileUrl = await readFileAsDataUrl(file);
      } catch {
        fileUrl = URL.createObjectURL(file);
      }

      let driveFileId = '';
      let driveViewLink = '';

      if (googleConnected) {
        const { decisionsFolder } = await GoogleDriveService.initSystemDriveStructure();
        const sanitizedNumber = attachingToDecision.number.replace(/[/\\?%*:|"<>]/g, '_');
        const sanitizedName = `${sanitizedNumber}_${file.name}`;
        
        const uploaded = await GoogleDriveService.uploadFile(
          file,
          sanitizedName,
          'application/pdf',
          decisionsFolder.id
        );
        driveFileId = uploaded.id;
        driveViewLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      }

      const updated: Decision = {
        ...attachingToDecision,
        fileUrl,
        driveFileId: driveFileId || attachingToDecision.driveFileId,
        driveViewLink: driveViewLink || attachingToDecision.driveViewLink,
      };

      if (onUpdateDecision) {
        onUpdateDecision(updated);
      } else {
        onAddDecision(updated);
      }

      alert(`Đã đính kèm tệp PDF "${file.name}" cho quyết định ${attachingToDecision.number}!`);
    } catch (err: any) {
      alert('Không thể tải tệp lên: ' + err.message);
    } finally {
      setAttachingToDecision(null);
      if (quickFileInputRef.current) quickFileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-xs">
      {/* Hidden input for quick attaching PDF */}
      <input
        type="file"
        ref={quickFileInputRef}
        accept="application/pdf"
        onChange={handleQuickAttachFile}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-sky-600" />
            <span>QUẢN LÝ VĂN BẢN & QUYẾT ĐỊNH NHÂN SỰ</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Sổ quyết định bổ nhiệm, điều động, nâng lương, khen thưởng, kỷ luật lưu trữ điện tử đính kèm file PDF
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5 shadow active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Vào Sổ Quyết Định Mới</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm theo Số QĐ, Trích yếu nội dung, Loại quyết định, Cán bộ..."
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
        />
        <div className="text-slate-400 text-[11px] whitespace-nowrap">
          {filteredDecisions.length} quyết định
        </div>
      </div>

      {/* Decisions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-700 border-b uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Số Quyết Định</th>
                <th className="py-2.5 px-3">Ngày Ban Hành</th>
                <th className="py-2.5 px-3">Phân Loại</th>
                <th className="py-2.5 px-3">Trích Yếu Nội Dung</th>
                <th className="py-2.5 px-3">Cán Bộ Áp Dụng</th>
                <th className="py-2.5 px-3">Cấp Ký</th>
                <th className="py-2.5 px-3">Hiệu Lực</th>
                <th className="py-2.5 px-3 text-right">Tệp Văn Bản PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDecisions.map(dec => {
                const hasPdf = Boolean(dec.driveViewLink || dec.fileUrl);
                return (
                  <tr key={dec.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-900 whitespace-nowrap">
                      {dec.number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono">{formatDateVN(dec.date)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded text-[10px]">
                        {dec.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 max-w-xs sm:max-w-sm truncate" title={dec.title}>
                      {dec.title}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {dec.employeeNames && dec.employeeNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {dec.employeeNames.map((name, i) => (
                            <span key={i} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Chi cục</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{dec.signLevel}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700 whitespace-nowrap font-mono">{formatDateVN(dec.effectiveDate)}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasPdf ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const previewUrl = dec.fileUrl || dec.driveViewLink || '';
                                setPreviewPdf({
                                  url: previewUrl,
                                  title: `${dec.number} - ${dec.title}`,
                                  driveLink: dec.driveViewLink,
                                });
                              }}
                              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-md font-semibold text-[11px] inline-flex items-center gap-1 transition"
                              title="Xem tệp PDF"
                            >
                              <FileText className="w-3.5 h-3.5 text-rose-600" />
                              <span>Xem PDF</span>
                            </button>

                            {dec.driveViewLink && (
                              <a
                                href={dec.driveViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 hover:text-sky-800 p-1 hover:bg-sky-50 rounded"
                                title="Mở trên Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAttachingToDecision(dec);
                              if (quickFileInputRef.current) {
                                quickFileInputRef.current.click();
                              }
                            }}
                            className="text-slate-400 hover:text-sky-600 hover:bg-sky-50 px-2 py-1 rounded text-[11px] font-medium border border-dashed border-slate-300 inline-flex items-center gap-1 transition"
                            title="Đính kèm tệp PDF cho quyết định này"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>+ Đính kèm PDF</span>
                          </button>
                        )}

                        {isAdmin && onDeleteDecision && (
                          <button
                            type="button"
                            onClick={() => setDecisionToDelete(dec)}
                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg border border-rose-200 transition"
                            title="Xóa quyết định này (Admin - Toàn quyền)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-base font-bold text-slate-900">Vào Sổ Quyết Định Nhân Sự Mới</h3>
                <p className="text-[11px] text-slate-500">Đăng ký quyết định hành chính và đính kèm file văn bản PDF</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số Quyết định *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: 145/QĐ-CCTY"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-sky-900 focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại quyết định</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white"
                  >
                    <option value="Bổ nhiệm">Bổ nhiệm</option>
                    <option value="Bổ nhiệm lại">Bổ nhiệm lại</option>
                    <option value="Điều động">Điều động</option>
                    <option value="Luân chuyển">Luân chuyển</option>
                    <option value="Nâng lương">Nâng lương</option>
                    <option value="Tuyển dụng">Tuyển dụng</option>
                    <option value="Khen thưởng">Khen thưởng</option>
                    <option value="Kỷ luật">Kỷ luật</option>
                    <option value="Nghỉ hưu">Nghỉ hưu</option>
                    <option value="Thôi việc">Thôi việc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trích yếu nội dung *</label>
                <input
                  type="text"
                  required
                  placeholder="Về việc điều động / bổ nhiệm / nâng bậc lương đối với..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cán bộ liên quan (tên các cán bộ, cách nhau bằng dấu phẩy)</label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn A, Trần Thị B"
                  value={employeeNamesInput}
                  onChange={(e) => setEmployeeNamesInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày ký ban hành</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày có hiệu lực</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cấp ký ban hành</label>
                <input
                  type="text"
                  value={signLevel}
                  onChange={(e) => setSignLevel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:bg-white"
                />
              </div>

              {/* CHỨC NĂNG ADD FILE PDF */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span>Đính kèm tệp văn bản PDF (Quyết định scan / file ký số)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>{showLinkInput ? 'Chọn tải tệp lên' : 'Nhập link Drive'}</span>
                  </button>
                </div>

                {/* Input file ẩn */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!showLinkInput ? (
                  <div>
                    {!selectedPdfFile ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-4 text-center cursor-pointer bg-white transition hover:bg-sky-50/50 group"
                      >
                        <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-1.5 group-hover:scale-110 transition">
                          <Upload className="w-4 h-4" />
                        </div>
                        <div className="font-bold text-slate-700 text-xs">
                          Bấm vào đây để chọn tệp PDF từ máy tính
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Hỗ trợ file định dạng .pdf (bản scan đóng dấu đỏ hoặc file ký số điện tử)
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[11px]">
                            PDF
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-semibold text-slate-800 truncate text-xs">
                              {selectedPdfFile.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {(selectedPdfFile.size / 1024).toFixed(1)} KB &bull; Sẵn sàng lưu vào hồ sơ
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] text-sky-600 hover:underline font-medium px-2 py-1"
                          >
                            Đổi tệp
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPdfFile(null)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded"
                            title="Xóa tệp đã chọn"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ghi chú điểm lưu trữ */}
                    {selectedPdfFile && (
                      <div className="mt-2">
                        {googleConnected ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>
                              Tự động đồng bộ lên Google Drive vào thư mục: <strong>02_Văn_Bản_Quyết_Định_Tổ_Chức</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Tệp PDF sẽ lưu trữ xem trước trực tiếp trên ứng dụng (kết nối Google Drive để đồng bộ đám mây).
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      placeholder="Dán đường dẫn chia sẻ file trên Google Drive (https://drive.google.com/...)"
                      value={customDriveLink}
                      onChange={(e) => setCustomDriveLink(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-sky-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1">
                      Nhập link trực tiếp nếu bạn đã tải quyết định lên Google Drive trước đó.
                    </div>
                  </div>
                )}
              </div>

              {/* Uploading progress indicator */}
              {isUploading && uploadStatusMsg && (
                <div className="flex items-center gap-2 p-2.5 bg-sky-50 text-sky-900 rounded-lg border border-sky-200 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white px-5 py-2 rounded-lg font-semibold shadow transition flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Lưu Vào Sổ & Đính Kèm</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview PDF */}
      {previewPdf && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-3.5 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded bg-rose-600 text-white flex items-center justify-center font-bold text-[10px]">
                  PDF
                </div>
                <h4 className="font-bold text-xs truncate max-w-xl text-slate-100">
                  {previewPdf.title}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {previewPdf.driveLink && (
                  <a
                    href={previewPdf.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-sky-800 hover:bg-sky-700 text-sky-100 px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở Google Drive</span>
                  </a>
                )}

                {previewPdf.url && (
                  <a
                    href={previewPdf.url}
                    download="quyet-dinh.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải về</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewPdf(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF or Object */}
            <div className="flex-1 bg-slate-100 p-2 overflow-hidden relative">
              {previewPdf.url.startsWith('http') || previewPdf.url.startsWith('data:') || previewPdf.url.startsWith('blob:') ? (
                <iframe
                  src={previewPdf.url}
                  title="Xem tệp PDF Quyết định"
                  className="w-full h-full rounded-lg border border-slate-300 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
                  <FileText className="w-12 h-12 text-slate-300" />
                  <p className="text-sm">Không thể mở xem trước trực tiếp.</p>
                  {previewPdf.driveLink && (
                    <a
                      href={previewPdf.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                      Bấm để mở trên Google Drive
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Quyết Định (Admin - Toàn quyền) */}
      {decisionToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-xs">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">Xác Nhận Xóa Văn Bản Quyết Định</h3>
              </div>
              <button onClick={() => setDecisionToDelete(null)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-slate-700 leading-relaxed">
                Bạn có chắc chắn muốn xóa văn bản quyết định sau khỏi sổ quản lý?
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{decisionToDelete.number}</div>
                <div className="text-slate-700 font-medium">{decisionToDelete.title}</div>
                <div className="text-[11px] text-slate-500">Phân loại: {decisionToDelete.type} &bull; Ngày ký: {decisionToDelete.date}</div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDecisionToDelete(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteDecision && decisionToDelete) {
                      onDeleteDecision(decisionToDelete.id);
                      setDecisionToDelete(null);
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
    </div>
  );
};
