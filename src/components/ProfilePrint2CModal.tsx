import React, { useState, useRef } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  FileText, 
  Check, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  User, 
  Share2,
  Copy,
  FileCheck
} from 'lucide-react';
import { Employee } from '../types/hrm';
import { formatDateVN, getTodayVN } from '../utils/dateUtils';
import { formatPCCV, formatDecimal, formatPercentAllowance } from '../utils/salaryUtils';

interface ProfilePrint2CModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export type TemplateType = '2C_BNV' | '2C_TCTW' | '2C_BNV_98' | 'PHIEU_BO_SUNG' | 'TRICH_NGANG';

export const ProfilePrint2CModal: React.FC<ProfilePrint2CModalProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('2C_BNV');
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const today = getTodayVN();
  const [todayD, todayM, todayY] = today.split('/');

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header - Controls */}
        <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-indigo-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 p-1.5 flex items-center justify-center border border-white/20">
              <Printer className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>IN HỒ SƠ CÁN BỘ & SƠ YẾU LÝ LỊCH 2C</span>
                <span className="bg-sky-500/30 text-sky-200 text-[10px] px-2 py-0.5 rounded font-mono">
                  {employee.code}
                </span>
              </h3>
              <p className="text-[11px] text-sky-200">
                Chi cục Chăn nuôi và Thú y TP.HCM &bull; Cán bộ: <strong>{employee.fullName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Template Selector Tabs */}
            <div className="bg-sky-950/80 p-0.5 rounded-lg border border-sky-600/40 flex items-center text-xs flex-wrap">
              <button
                onClick={() => setSelectedTemplate('2C_BNV')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedTemplate === '2C_BNV'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Mẫu 2C-BNV/2008 của Bộ Nội Vụ (Đầy đủ 30 mục chuẩn)"
              >
                Mẫu 2C-BNV/2008
              </button>
              <button
                onClick={() => setSelectedTemplate('2C_TCTW')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedTemplate === '2C_TCTW'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Mẫu 2C/TCTW-98 của Ban Tổ chức Trung ương"
              >
                Mẫu 2C/TCTW-98
              </button>
              <button
                onClick={() => setSelectedTemplate('2C_BNV_98')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedTemplate === '2C_BNV_98'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Mẫu 2C/BNV-98 Sơ yếu lý lịch truyền thống chuẩn Bộ Nội Vụ"
              >
                Mẫu 2C/BNV-98
              </button>
              <button
                onClick={() => setSelectedTemplate('PHIEU_BO_SUNG')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedTemplate === 'PHIEU_BO_SUNG'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Mẫu 4a-BNV/2007 Phiếu bổ sung lý lịch hàng năm"
              >
                Phiếu Bổ Sung 4a
              </button>
              <button
                onClick={() => setSelectedTemplate('TRICH_NGANG')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  selectedTemplate === 'TRICH_NGANG'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-sky-200 hover:text-white'
                }`}
                title="Trích ngang lý lịch cán bộ 1 trang"
              >
                Trích Ngang 1 Trang
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition"
              title="Mở hộp thoại in của trình duyệt hoặc lưu dạng PDF"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay / Lưu PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Preview Container */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
          <div 
            ref={printAreaRef}
            className="max-w-[820px] mx-auto bg-white p-8 sm:p-10 shadow-lg border border-slate-300 font-serif text-[13px] leading-relaxed text-slate-900 print:shadow-none print:border-none print:p-0 print:max-w-none"
          >
            {/* ======================================================== */}
            {/* TEMPLATE 1: MẪU 2C-BNV/2008 (CHUẨN BỘ NỘI VỤ 30 MỤC) */}
            {/* ======================================================== */}
            {selectedTemplate === '2C_BNV' && (
              <div>
                {/* National Header */}
                <div className="grid grid-cols-12 gap-2 pb-3 border-b-2 border-slate-800 text-center">
                  <div className="col-span-5 text-left text-xs font-sans">
                    <div className="font-bold uppercase text-[11px]">SỞ NÔNG NGHIỆP VÀ PTNT TP.HCM</div>
                    <div className="font-bold uppercase text-[11px] text-sky-900">CHI CỤC CHĂN NUÔI VÀ THÚ Y</div>
                    <div className="text-[10px] text-slate-600 mt-1">Đơn vị: {employee.departmentName}</div>
                    <div className="text-[10px] font-mono mt-0.5">Số hiệu CBCC: <strong>{employee.code}</strong></div>
                  </div>

                  <div className="col-span-7 text-center">
                    <div className="font-bold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold text-xs underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="text-[11px] italic mt-2">TP. Hồ Chí Minh, ngày {todayD} tháng {todayM} năm {todayY}</div>
                  </div>
                </div>

                {/* Form Title & Photo Box */}
                <div className="flex items-start justify-between gap-4 my-4">
                  <div className="w-28 h-36 border-2 border-dashed border-slate-400 rounded flex flex-col items-center justify-center text-center p-1 shrink-0 bg-slate-50 text-[10px] text-slate-500 overflow-hidden">
                    {employee.avatarUrl ? (
                      <img src={employee.avatarUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <User className="w-8 h-8 text-slate-400 mb-1" />
                        <span>Ảnh màu 4 x 6 cm</span>
                        <span className="text-[8px]">(chụp không quá 6 tháng)</span>
                      </>
                    )}
                  </div>

                  <div className="flex-1 text-center pr-10">
                    <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                      SƠ YẾU LÝ LỊCH CÁN BỘ, CÔNG CHỨC
                    </h1>
                    <div className="text-[11px] italic text-slate-600 mt-1">
                      (Ban hành kèm theo Quyết định số 02/2008/QĐ-BNV ngày 06/10/2008 của Bộ trưởng Bộ Nội vụ)
                    </div>
                  </div>
                </div>

                {/* 30 Sections */}
                <div className="space-y-1.5 text-justify">
                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-8">
                      <strong>1) Họ và tên khai sinh:</strong> <span className="font-bold uppercase text-sm">{employee.fullName}</span>
                    </div>
                    <div className="col-span-4">
                      <strong>2) Giới tính:</strong> <span>{employee.gender}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>3) Các tên gọi khác:</strong> <span>Không</span>
                    </div>
                    <div className="col-span-6">
                      <strong>4) Ngày, tháng, năm sinh:</strong> <span className="font-bold">{formatDateVN(employee.dob)}</span>
                    </div>
                  </div>

                  <div>
                    <strong>5) Nơi sinh:</strong> <span>{employee.birthplace || employee.hometown || 'TP. Hồ Chí Minh'}</span>
                  </div>

                  <div>
                    <strong>6) Quê quán:</strong> <span>{employee.hometown || 'TP. Hồ Chí Minh'}</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-4">
                      <strong>7) Dân tộc:</strong> <span>{employee.ethnicity || 'Kinh'}</span>
                    </div>
                    <div className="col-span-4">
                      <strong>8) Tôn giáo:</strong> <span>{employee.religion || 'Không'}</span>
                    </div>
                    <div className="col-span-4">
                      <strong>9) Quốc tịch:</strong> <span>Việt Nam</span>
                    </div>
                  </div>

                  <div>
                    <strong>10) Nơi đăng ký hộ khẩu thường trú:</strong> <span>{employee.address || 'TP. Hồ Chí Minh'}</span>
                  </div>

                  <div>
                    <strong>11) Nơi ở hiện nay:</strong> <span>{employee.address || 'TP. Hồ Chí Minh'}</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>12) Nghề nghiệp khi tuyển dụng:</strong> <span>{(employee as any).recruitmentJob || 'Kỹ sư / Bác sĩ thú y'}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>13) Ngày tuyển dụng:</strong> <span>{formatDateVN(employee.recruitmentDate || '2015-09-01')}</span>
                    </div>
                  </div>

                  <div>
                    <strong>14) Cơ quan tuyển dụng:</strong> <span>{(employee as any).recruitmentAgency || 'Sở Nông nghiệp và Phát triển nông thôn TP.HCM'}</span>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>15) Chức vụ (chức danh) hiện tại:</strong> <span className="font-bold">{employee.positionTitle}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>16) Đơn vị công tác:</strong> <span>{employee.departmentName}</span>
                    </div>
                  </div>

                  <div>
                    <strong>17) Công việc chính được giao:</strong> <span>Quản lý, giám sát và kiểm tra chuyên môn chăn nuôi, thú y, kiểm dịch động vật và an toàn thực phẩm trên địa bàn TP.HCM</span>
                  </div>

                  <div className="p-2 border border-slate-300 rounded bg-slate-50/50 my-1 space-y-1">
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-6">
                        <strong>18) Ngạch công chức (viên chức):</strong> <span>{employee.jobRankCode} - {employee.jobRankName}</span>
                      </div>
                      <div className="col-span-3">
                        <strong>Mã ngạch:</strong> <span className="font-mono">{employee.jobRankCode}</span>
                      </div>
                      <div className="col-span-3">
                        <strong>Bậc lương:</strong> <span>{employee.salary.step}/12</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-4">
                        <strong>Hệ số lương:</strong> <span>{formatDecimal(employee.salary.coefficient, 2)}</span>
                      </div>
                      <div className="col-span-4">
                        <strong>Phụ cấp chức vụ:</strong> <span>{formatPCCV(employee.salary.leadershipAllowance)}</span>
                      </div>
                      <div className="col-span-4">
                        <strong>Phụ cấp thâm niên:</strong> <span>{formatPercentAllowance(employee.salary.seniorityAllowancePercent, 0)}</span>
                      </div>
                    </div>
                    <div>
                      <strong>Ngày hưởng ngạch, bậc:</strong> <span>{formatDateVN(employee.salary.effectiveDate || employee.recruitmentDate)}</span> &bull; <strong>Ngày nâng lương tiếp theo:</strong> <span>{formatDateVN(employee.salary.nextSalaryIncreaseDate || '2027-01-01')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>19) Trình độ giáo dục phổ thông:</strong> <span>12/12</span>
                    </div>
                    <div className="col-span-6">
                      <strong>20) Trình độ chuyên môn cao nhất:</strong> <span>{employee.education.highestDegree} - {employee.education.major}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>21) Lý luận chính trị:</strong> <span>{employee.education.politicalTheory}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>22) Quản lý nhà nước:</strong> <span>{employee.stateManagementLevel || 'Chuẩn ngạch chuyên môn'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>23) Ngoại ngữ:</strong> <span>{employee.education.foreignLanguage}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>24) Tin học:</strong> <span>{employee.education.informatics}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>25) Ngày vào Đảng CSVN:</strong> <span>{employee.partyJoinDate ? formatDateVN(employee.partyJoinDate) : 'Chưa'}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>Ngày chính thức:</strong> <span>{employee.partyOfficialDate ? formatDateVN(employee.partyOfficialDate) : 'Chưa'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-1">
                    <div className="col-span-6">
                      <strong>26) Số thẻ Đảng viên:</strong> <span>{employee.partyCardNumber || 'Chưa có'}</span>
                    </div>
                    <div className="col-span-6">
                      <strong>27) Số CCCD:</strong> <span className="font-mono">{employee.cccd}</span> (Cấp ngày: {formatDateVN(employee.cccdDate)})
                    </div>
                  </div>

                  <div>
                    <strong>28) Tình trạng sức khỏe:</strong> <span>Tốt</span> &bull; <strong>Chiều cao:</strong> <span>1m68</span> &bull; <strong>Cân nặng:</strong> <span>62kg</span> &bull; <strong>Nhóm máu:</strong> <span>O</span>
                  </div>

                  <div>
                    <strong>29) Khen thưởng:</strong> <span>{employee.rewardDiscipline?.filter(r => r.type === 'Khen thưởng').map(r => r.form).join(', ') || 'Lao động tiên tiến, Giấy khen Chi cục'}</span>
                  </div>

                  <div>
                    <strong>30) Kỷ luật:</strong> <span>{employee.rewardDiscipline?.filter(r => r.type === 'Kỷ luật').map(r => r.form).join(', ') || 'Không'}</span>
                  </div>
                </div>

                {/* Quá trình công tác tóm tắt */}
                <div className="mt-4 pt-3 border-t border-slate-300">
                  <div className="font-bold uppercase text-xs mb-2">TÓM TẮT QUÁ TRÌNH CÔNG TÁC:</div>
                  <table className="w-full border-collapse border border-slate-400 text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-center">
                        <th className="border border-slate-400 p-1 w-28">Từ tháng, năm &rarr; đến tháng, năm</th>
                        <th className="border border-slate-400 p-1">Chức danh, chức vụ, đơn vị công tác</th>
                        <th className="border border-slate-400 p-1 w-24">Số quyết định</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee.workHistory && employee.workHistory.length > 0 ? (
                        employee.workHistory.map((wh, idx) => (
                          <tr key={idx}>
                            <td className="border border-slate-400 p-1 text-center font-mono">
                              {formatDateVN(wh.startDate)} &rarr; {wh.endDate === 'Nay' ? 'Nay' : formatDateVN(wh.endDate)}
                            </td>
                            <td className="border border-slate-400 p-1">
                              <strong>{wh.position}</strong> - {wh.unitName}
                            </td>
                            <td className="border border-slate-400 p-1 text-center font-mono">
                              {wh.decisionNumber || '-'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="border border-slate-400 p-1 text-center font-mono">
                            {formatDateVN(employee.recruitmentDate || '2015-09-01')} &rarr; Nay
                          </td>
                          <td className="border border-slate-400 p-1">
                            {employee.positionTitle} - {employee.departmentName} (Chi cục Chăn nuôi và Thú y TP.HCM)
                          </td>
                          <td className="border border-slate-400 p-1 text-center font-mono">-</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI KHAI CAM ĐOAN</div>
                    <div className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sm">{employee.fullName}</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase text-sky-900">THỦ TRƯỞNG CƠ QUAN, ĐƠN VỊ</div>
                    <div className="text-[10px] italic text-slate-500">(Ký tên và đóng dấu)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sm text-sky-950">Trần Phú Cường</div>
                    <div className="text-[11px] text-slate-600">Chi cục trưởng</div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TEMPLATE 2: MẪU 2C/TCTW-98 (BAN TỔ CHỨC TRUNG ƯƠNG) */}
            {/* ======================================================== */}
            {selectedTemplate === '2C_TCTW' && (
              <div>
                <div className="text-center pb-2 border-b-2 border-slate-900">
                  <div className="font-bold text-xs uppercase">BAN TỔ CHỨC TRUNG ƯƠNG &bull; MẪU 2C/TCTW-98</div>
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 mt-1">
                    SƠ YẾU LÝ LỊCH CÁN BỘ
                  </h1>
                  <div className="text-xs italic text-slate-600">
                    Cơ quan quản lý: Chi cục Chăn nuôi và Thú y TP. Hồ Chí Minh
                  </div>
                  <div className="text-[11px] italic mt-1">TP. Hồ Chí Minh, ngày {todayD} tháng {todayM} năm {todayY}</div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 border rounded space-y-1">
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-8">
                        <strong>Họ và tên:</strong> <span className="font-bold uppercase text-sm">{employee.fullName}</span>
                      </div>
                      <div className="col-span-4">
                        <strong>Số hiệu CBCC:</strong> <span className="font-mono font-bold">{employee.code}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-6">
                        <strong>Ngày sinh:</strong> <span>{formatDateVN(employee.dob)}</span>
                      </div>
                      <div className="col-span-6">
                        <strong>Giới tính:</strong> <span>{employee.gender}</span>
                      </div>
                    </div>
                    <div>
                      <strong>Quê quán:</strong> <span>{employee.hometown || 'TP. Hồ Chí Minh'}</span> &bull; <strong>Nơi ở hiện nay:</strong> <span>{employee.address || 'TP. Hồ Chí Minh'}</span>
                    </div>
                    <div>
                      <strong>Chức vụ, đơn vị công tác hiện nay:</strong> <span className="font-bold">{employee.positionTitle}</span> &bull; {employee.departmentName}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      I. THÔNG TIN TIỀN LƯƠNG & NGẠCH BẬC
                    </div>
                    <div>
                      &bull; <strong>Ngạch hiện giữ:</strong> {employee.jobRankCode} - {employee.jobRankName} (Bậc {employee.salary.step}, Hệ số {formatDecimal(employee.salary.coefficient, 2)})
                    </div>
                    <div>
                      &bull; <strong>Phụ cấp chức vụ:</strong> {formatPCCV(employee.salary.leadershipAllowance)} &bull; <strong>Phụ cấp thâm niên:</strong> {formatPercentAllowance(employee.salary.seniorityAllowancePercent, 0)}
                    </div>
                    <div>
                      &bull; <strong>Ngày bổ nhiệm/xếp lương:</strong> {formatDateVN(employee.salary.effectiveDate || employee.recruitmentDate)} &bull; <strong>Kỳ nâng lương kế tiếp:</strong> {formatDateVN(employee.salary.nextSalaryIncreaseDate)}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      II. TRÌNH ĐỘ HỌC VẤN, CHUYÊN MÔN & ĐÀO TẠO
                    </div>
                    <div>
                      &bull; <strong>Trình độ chuyên môn:</strong> {employee.education.highestDegree} - Chuyên ngành {employee.education.major}
                    </div>
                    <div>
                      &bull; <strong>Lý luận chính trị:</strong> {employee.education.politicalTheory} &bull; <strong>Quản lý nhà nước:</strong> {employee.stateManagementLevel || 'Đạt chuẩn ngạch'}
                    </div>
                    <div>
                      &bull; <strong>Chứng chỉ hành nghề thú y:</strong> {employee.education.veterinaryCert || 'Đã kiểm tra đạt chuẩn chuyên môn thú y'}
                    </div>
                    <div>
                      &bull; <strong>Tin học / Ngoại ngữ:</strong> {employee.education.informatics} / {employee.education.foreignLanguage}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      III. KHEN THƯỞNG, KỶ LUẬT & ĐÁNH GIÁ CÁN BỘ
                    </div>
                    <div>
                      &bull; <strong>Khen thưởng:</strong> {employee.rewardDiscipline?.filter(r => r.type === 'Khen thưởng').map(r => r.form).join(', ') || 'Lao động tiên tiến'}
                    </div>
                    <div>
                      &bull; <strong>Kỷ luật:</strong> {employee.rewardDiscipline?.filter(r => r.type === 'Kỷ luật').map(r => r.form).join(', ') || 'Không vi phạm'}
                    </div>
                    <div>
                      &bull; <strong>Đánh giá phân loại chất lượng:</strong> Hoàn thành tốt / xuất sắc nhiệm vụ
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI KÊ KHAI</div>
                    <div className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase">{employee.fullName}</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase text-sky-900">CHI CỤC TRƯỞNG</div>
                    <div className="text-[10px] italic text-slate-500">(Ký tên và đóng dấu)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sky-950">Trần Phú Cường</div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TEMPLATE 3: MẪU 2C/BNV-98 (BỘ NỘI VỤ NĂM 1998) */}
            {/* ======================================================== */}
            {selectedTemplate === '2C_BNV_98' && (
              <div>
                <div className="grid grid-cols-12 gap-2 pb-3 border-b-2 border-slate-800 text-center">
                  <div className="col-span-5 text-left text-xs font-sans">
                    <div className="font-bold uppercase text-[11px]">BỘ NỘI VỤ &bull; MẪU 2C/BNV-98</div>
                    <div className="font-bold uppercase text-[11px] text-sky-900">CHI CỤC CHĂN NUÔI VÀ THÚ Y TP.HCM</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">Số hồ sơ: <strong>{employee.code}</strong></div>
                  </div>

                  <div className="col-span-7 text-center">
                    <div className="font-bold uppercase text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="font-bold text-xs underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="text-[11px] italic mt-2">TP. Hồ Chí Minh, ngày {todayD} tháng {todayM} năm {todayY}</div>
                  </div>
                </div>

                <div className="text-center my-4">
                  <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                    SƠ YẾU LÝ LỊCH CÔNG CHỨC, VIÊN CHỨC (MẪU 2C/BNV-98)
                  </h1>
                  <div className="text-[11px] italic text-slate-600">
                    (Ban hành theo Quyết định số 98/TCCP-BCCV của Ban Tổ chức - Cán bộ Chính phủ)
                  </div>
                </div>

                <div className="space-y-2 text-xs text-justify">
                  <div className="p-3 bg-slate-50 border rounded space-y-1.5">
                    <div><strong>1. Họ và tên khai sinh:</strong> <span className="font-bold uppercase text-sm">{employee.fullName}</span> &bull; <strong>Giới tính:</strong> {employee.gender}</div>
                    <div><strong>2. Ngày, tháng, năm sinh:</strong> <span className="font-bold">{formatDateVN(employee.dob)}</span></div>
                    <div><strong>3. Nơi sinh / Quê quán:</strong> {employee.hometown || 'TP. Hồ Chí Minh'}</div>
                    <div><strong>4. Dân tộc:</strong> {employee.ethnicity || 'Kinh'} &bull; <strong>Tôn giáo:</strong> {employee.religion || 'Không'}</div>
                    <div><strong>5. Hộ khẩu thường trú:</strong> {employee.address || 'TP. Hồ Chí Minh'}</div>
                    <div><strong>6. Số CCCD:</strong> <span className="font-mono">{employee.cccd}</span> &bull; <strong>Ngày cấp:</strong> {formatDateVN(employee.cccdDate)} ({employee.cccdPlace})</div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      QUAN HỆ CÔNG TÁC & TIỀN LƯƠNG
                    </div>
                    <div><strong>7. Ngày vào cơ quan:</strong> {formatDateVN(employee.agencyJoinDate || employee.recruitmentDate)} &bull; <strong>Ngày vào biên chế chính thức:</strong> {formatDateVN(employee.officialDate)}</div>
                    <div><strong>8. Chức vụ hiện tại:</strong> <span className="font-bold">{employee.positionTitle}</span> - Đơn vị: {employee.departmentName}</div>
                    <div><strong>9. Ngạch công chức:</strong> {employee.jobRankCode} - {employee.jobRankName} (Hệ số: {employee.salary.coefficient}, Bậc: {employee.salary.step})</div>
                    <div><strong>10. Trình độ chuyên môn:</strong> {employee.education.highestDegree} chuyên ngành {employee.education.major}</div>
                    <div><strong>11. Trình độ chính trị:</strong> {employee.education.politicalTheory} &bull; <strong>Ngoại ngữ:</strong> {employee.education.foreignLanguage}</div>
                  </div>
                </div>

                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI KHAI</div>
                    <div className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sm">{employee.fullName}</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase text-sky-900">CHI CỤC TRƯỞNG</div>
                    <div className="text-[10px] italic text-slate-500">(Ký tên và đóng dấu)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sm text-sky-950">Trần Phú Cường</div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TEMPLATE 4: PHIẾU BỔ SUNG LÝ LỊCH CÁN BỘ (MẪU 4A-BNV/2007) */}
            {/* ======================================================== */}
            {selectedTemplate === 'PHIEU_BO_SUNG' && (
              <div>
                <div className="text-center pb-2 border-b-2 border-slate-900">
                  <div className="font-bold text-xs uppercase">BỘ NỘI VỤ &bull; MẪU 4A-BNV/2007</div>
                  <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 mt-1">
                    PHIẾU BỔ SUNG LÝ LỊCH CÁN BỘ, CÔNG CHỨC
                  </h1>
                  <div className="text-xs italic text-slate-600">
                    Kỳ bổ sung năm {todayY} &bull; Đơn vị: Chi cục Chăn nuôi và Thú y TP. Hồ Chí Minh
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 border rounded space-y-1">
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-8">
                        <strong>Họ và tên:</strong> <span className="font-bold uppercase text-sm">{employee.fullName}</span>
                      </div>
                      <div className="col-span-4">
                        <strong>Số hiệu CBCC:</strong> <span className="font-mono font-bold">{employee.code}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-12 gap-1">
                      <div className="col-span-6">
                        <strong>Ngày sinh:</strong> <span>{formatDateVN(employee.dob)}</span>
                      </div>
                      <div className="col-span-6">
                        <strong>Giới tính:</strong> <span>{employee.gender}</span>
                      </div>
                    </div>
                    <div>
                      <strong>Chức vụ, đơn vị công tác:</strong> <span className="font-bold">{employee.positionTitle}</span> &bull; {employee.departmentName}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      1. THAY ĐỔI VỀ CHỨC DANH, CHỨC VỤ & ĐƠN VỊ CÔNG TÁC TRONG NĂM
                    </div>
                    <div>&bull; Giữ chức vụ: <strong>{employee.positionTitle}</strong> thuộc {employee.departmentName}</div>
                    <div>&bull; Ngạch công chức: {employee.jobRankCode} - {employee.jobRankName} (Bậc {employee.salary.step}, Hệ số {employee.salary.coefficient})</div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      2. ĐÀO TẠO, BỒI DƯỠNG NÂNG CAO TRÌNH ĐỘ TRONG NĂM
                    </div>
                    <div>&bull; Chuyên ngành: {employee.education.major} ({employee.education.highestDegree})</div>
                    <div>&bull; Lý luận chính trị: {employee.education.politicalTheory} &bull; Chứng chỉ thú y: {employee.education.veterinaryCert || 'Đã kiểm tra chuẩn hóa'}</div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="font-bold uppercase text-xs text-sky-900 border-b pb-1">
                      3. KHEN THƯỞNG, KỶ LUẬT & ĐÁNH GIÁ PHÂN LOẠI
                    </div>
                    <div>&bull; Khen thưởng: {employee.rewardDiscipline?.filter(r => r.type === 'Khen thưởng').map(r => r.form).join(', ') || 'Lao động tiên tiến'}</div>
                    <div>&bull; Kỷ luật: {employee.rewardDiscipline?.filter(r => r.type === 'Kỷ luật').map(r => r.form).join(', ') || 'Không'}</div>
                  </div>
                </div>

                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="font-bold uppercase">NGƯỜI KHAI BỔ SUNG</div>
                    <div className="text-[10px] italic text-slate-500">(Ký và ghi rõ họ tên)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase">{employee.fullName}</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase text-sky-900">CHI CỤC TRƯỞNG</div>
                    <div className="text-[10px] italic text-slate-500">(Ký tên và đóng dấu)</div>
                    <div className="h-16"></div>
                    <div className="font-bold uppercase text-sky-950">Trần Phú Cường</div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* TEMPLATE 5: TRÍCH NGANG TÓM TẮT HỒ SƠ 1 TRANG */}
            {/* ======================================================== */}
            {selectedTemplate === 'TRICH_NGANG' && (
              <div>
                <div className="text-center pb-2 border-b">
                  <div className="text-[11px] uppercase font-bold text-slate-600">SỞ NÔNG NGHIỆP VÀ PHÁT TRIỂN NÔNG THÔN TP. HỒ CHÍ MINH</div>
                  <div className="text-xs uppercase font-bold text-sky-900">CHI CỤC CHĂN NUÔI VÀ THÚ Y</div>
                  <h1 className="text-base font-black uppercase text-slate-900 mt-1">
                    BẢN TRÍCH NGANG TÓM TẮT HỒ SƠ CÁN BỘ
                  </h1>
                  <div className="text-[11px] italic text-slate-500">
                    Phục vụ công tác quy hoạch, điều động, bổ nhiệm và quản lý nhân sự &bull; Ngày trích: {today}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-12 gap-3 text-xs">
                  <div className="col-span-3 text-center">
                    <div className="w-24 h-32 mx-auto border border-slate-300 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                      {employee.avatarUrl ? (
                        <img src={employee.avatarUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-slate-400" />
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-sky-800 font-bold mt-1">{employee.code}</div>
                  </div>

                  <div className="col-span-9 space-y-1">
                    <div className="text-base font-bold uppercase text-slate-900">{employee.fullName}</div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div><strong>Sinh ngày:</strong> {formatDateVN(employee.dob)}</div>
                      <div><strong>Giới tính:</strong> {employee.gender}</div>
                      <div><strong>Số CCCD:</strong> {employee.cccd}</div>
                      <div><strong>Ngày cấp:</strong> {formatDateVN(employee.cccdDate)}</div>
                      <div><strong>Chức vụ:</strong> {employee.positionTitle}</div>
                      <div><strong>Phòng/Trạm:</strong> {employee.departmentName}</div>
                      <div><strong>Loại nhân sự:</strong> {employee.staffType}</div>
                      <div><strong>Ngạch/Bậc:</strong> {employee.jobRankCode} (Bậc {employee.salary.step}, Hệ số {employee.salary.coefficient})</div>
                      <div><strong>Chuyên môn:</strong> {employee.education.highestDegree} - {employee.education.major}</div>
                      <div><strong>LLCT:</strong> {employee.education.politicalTheory}</div>
                      <div><strong>Điện thoại:</strong> {employee.phone}</div>
                      <div><strong>Email:</strong> {employee.email}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t space-y-2 text-xs">
                  <div className="font-bold uppercase text-[11px] text-slate-700">TÓM TẮT QUÁ TRÌNH CÔNG TÁC GẦN NHẤT:</div>
                  <div className="space-y-1 text-[11px]">
                    {employee.workHistory && employee.workHistory.slice(0, 4).map((wh, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="font-mono text-sky-800 w-28 shrink-0">{formatDateVN(wh.startDate)} &rarr; {wh.endDate === 'Nay' ? 'Nay' : formatDateVN(wh.endDate)}:</span>
                        <span><strong>{wh.position}</strong> - {wh.unitName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-4 grid grid-cols-2 text-center text-xs">
                  <div>
                    <div className="font-bold uppercase text-[11px]">PHÒNG HÀNH CHÍNH - TỔNG HỢP</div>
                    <div className="text-[10px] italic text-slate-500">(Người trích lục)</div>
                    <div className="h-14"></div>
                    <div className="font-bold">Trần Văn Hoàng</div>
                  </div>

                  <div>
                    <div className="font-bold uppercase text-[11px] text-sky-900">CHI CỤC TRƯỞNG</div>
                    <div className="text-[10px] italic text-slate-500">(Ký duyệt)</div>
                    <div className="h-14"></div>
                    <div className="font-bold text-sky-950">Trần Phú Cường</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs print:hidden shrink-0">
          <div className="text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Mẫu in chuẩn hành chính Bộ Nội Vụ & TP. Hồ Chí Minh &bull; Định dạng ngày tháng: <strong>dd/mm/yyyy</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg transition"
            >
              Đóng
            </button>

            <button
              onClick={handlePrint}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
            >
              <Printer className="w-4 h-4" />
              <span>In Bản Này</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
