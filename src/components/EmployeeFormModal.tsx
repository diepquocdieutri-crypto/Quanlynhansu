import React, { useState } from 'react';
import { X, Save, User, Briefcase, Coins, GraduationCap, Sparkles, Plus, Check, AlertCircle } from 'lucide-react';
import { Employee, Department, StaffType, Gender, DegreeLevel, PoliticalTheoryLevel, WorkStatus } from '../types/hrm';
import { JobRankService, JobRank } from '../services/jobRankService';
import { parseBaseSalary, parseDecimalNumber, formatBaseSalary, formatPCCV, formatDecimal, formatPercentAllowance, DEFAULT_BASE_SALARY } from '../utils/salaryUtils';

interface EmployeeFormModalProps {
  initialData?: Employee | null;
  departments: Department[];
  onClose: () => void;
  onSave: (employeeData: Employee, isEdit: boolean) => void;
  existingEmployeesCount: number;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  initialData,
  departments,
  onClose,
  onSave,
  existingEmployeesCount,
}) => {
  const isEdit = !!initialData;

  // Helper sinh mã nhân viên tự động NV-YYYYMMDD-XXXX per Prompt #5
  const generateEmployeeCode = (dobVal: string) => {
    const cleanDob = dobVal ? dobVal.replace(/-/g, '') : '19900101';
    const seq = String(existingEmployeesCount + 1).padStart(4, '0');
    return `NV-${cleanDob}-${seq}`;
  };

  const [formTab, setFormTab] = useState<'personal' | 'assignment' | 'salary' | 'education'>('personal');

  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [code, setCode] = useState(initialData?.code || generateEmployeeCode('1990-01-01'));
  const [gender, setGender] = useState<Gender>(initialData?.gender || 'Nam');
  const [dob, setDob] = useState(initialData?.dob || '1990-01-01');
  const [cccd, setCccd] = useState(initialData?.cccd || '');
  const [cccdDate, setCccdDate] = useState(initialData?.cccdDate || '2021-01-01');
  const [cccdPlace, setCccdPlace] = useState(initialData?.cccdPlace || 'Cục Cảnh sát QLHC về TTXH');
  const [hometown, setHometown] = useState(initialData?.hometown || 'TP. Hồ Chí Minh');
  const [birthplace, setBirthplace] = useState(initialData?.birthplace || 'TP. Hồ Chí Minh');
  const [address, setAddress] = useState(initialData?.address || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [maritalStatus, setMaritalStatus] = useState<'Độc thân' | 'Đã kết hôn' | 'Khác'>(initialData?.maritalStatus || 'Đã kết hôn');
  const [ethnicity, setEthnicity] = useState(initialData?.ethnicity || 'Kinh');
  const [religion, setReligion] = useState(initialData?.religion || 'Không');
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl || '');

  // Công tác
  const [departmentId, setDepartmentId] = useState(initialData?.departmentId || departments[0]?.id || 'P_HCTH');
  const [positionTitle, setPositionTitle] = useState(initialData?.positionTitle || 'Chuyên viên');
  const [jobRankCode, setJobRankCode] = useState(initialData?.jobRankCode || '01.003');
  const [jobRankName, setJobRankName] = useState(initialData?.jobRankName || JobRankService.getRankByCode(initialData?.jobRankCode || '01.003')?.name || 'Chuyên viên');
  const [staffType, setStaffType] = useState<StaffType>(initialData?.staffType || 'Công chức');
  const [recruitmentDate, setRecruitmentDate] = useState(initialData?.recruitmentDate || '2020-01-01');
  const [officialDate, setOfficialDate] = useState(initialData?.officialDate || '2021-01-01');
  const [status, setStatus] = useState<WorkStatus>(initialData?.status || 'Đang công tác');
  const [leaveDate, setLeaveDate] = useState(initialData?.leaveDate || '');
  const [leaveReason, setLeaveReason] = useState(initialData?.leaveReason || '');
  const [leaveDecisionNumber, setLeaveDecisionNumber] = useState(initialData?.leaveDecisionNumber || '');

  // Danh sách ngạch công chức / viên chức (Ngạch chuẩn + Ngạch tự nhập thêm)
  const [allRanks, setAllRanks] = useState<JobRank[]>(() => JobRankService.getAllRanks());
  const [showAddRankModal, setShowAddRankModal] = useState(false);
  const [newRankCode, setNewRankCode] = useState('');
  const [newRankName, setNewRankName] = useState('');
  const [newRankCoeff, setNewRankCoeff] = useState(2.34);
  const [newRankMaxStep, setNewRankMaxStep] = useState(9);
  const [newRankGroup, setNewRankGroup] = useState<'Kế toán' | 'Hành chính' | 'Kiểm dịch & Thú y' | 'Ngạch tự nhập / Khác'>('Ngạch tự nhập / Khác');

  // Lương
  const [baseSalary, setBaseSalary] = useState<number | string>(() => {
    if (initialData?.salary.baseSalary !== undefined && initialData?.salary.baseSalary !== null) {
      return parseBaseSalary(initialData.salary.baseSalary, DEFAULT_BASE_SALARY);
    }
    return DEFAULT_BASE_SALARY;
  });
  const [step, setStep] = useState(initialData?.salary.step || 1);
  const [coefficient, setCoefficient] = useState<number | string>(() => {
    if (initialData?.salary.coefficient !== undefined && initialData?.salary.coefficient !== null) {
      return parseDecimalNumber(initialData.salary.coefficient, 2.34);
    }
    return 2.34;
  });
  const [effectiveDate, setEffectiveDate] = useState(initialData?.salary.effectiveDate || '2024-01-01');
  const [leadershipAllowance, setLeadershipAllowance] = useState<string>(() => {
    if (initialData?.salary.leadershipAllowance !== undefined && initialData?.salary.leadershipAllowance !== null) {
      return formatPCCV(initialData.salary.leadershipAllowance);
    }
    return '0.00';
  });
  const [seniorityAllowancePercent, setSeniorityAllowancePercent] = useState<number | string>(initialData?.salary.seniorityAllowancePercent ?? 0);
  const [industryAllowancePercent, setIndustryAllowancePercent] = useState<number | string>(initialData?.salary.industryAllowancePercent ?? 10);
  const [publicServiceAllowancePercent, setPublicServiceAllowancePercent] = useState<number | string>(initialData?.salary.publicServiceAllowancePercent ?? 25);
  const [nextSalaryIncreaseDate, setNextSalaryIncreaseDate] = useState(initialData?.salary.nextSalaryIncreaseDate || '2027-01-01');

  // Đào tạo
  const [highestDegree, setHighestDegree] = useState<DegreeLevel>(initialData?.education.highestDegree || 'Đại học');
  const [major, setMajor] = useState(initialData?.education.major || 'Bác sĩ Thú y');
  const [school, setSchool] = useState(initialData?.education.school || 'Đại học Nông Lâm TP.HCM');
  const [gradYear, setGradYear] = useState(initialData?.education.gradYear || 2015);
  const [politicalTheory, setPoliticalTheory] = useState<PoliticalTheoryLevel>(initialData?.education.politicalTheory || 'Trung cấp');
  const [foreignLanguage, setForeignLanguage] = useState(initialData?.education.foreignLanguage || 'Tiếng Anh B1');
  const [informatics, setInformatics] = useState(initialData?.education.informatics || 'Ứng dụng CNTT cơ bản');
  const [veterinaryCert, setVeterinaryCert] = useState(initialData?.education.veterinaryCert || 'Chứng chỉ Kiểm dịch Thú y Quốc gia');

  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    if (!isEdit) {
      setCode(generateEmployeeCode(newDob));
    }
  };

  const handleRankChange = (codeVal: string) => {
    if (codeVal === '__ADD_NEW__') {
      setShowAddRankModal(true);
      return;
    }

    setJobRankCode(codeVal);
    const found = allRanks.find(r => r.code.toLowerCase() === codeVal.toLowerCase());
    if (found) {
      setJobRankName(found.name);
      if (!isEdit && found.defaultCoefficient) {
        setCoefficient(found.defaultCoefficient);
      }
    }
  };

  const handleSaveNewRank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRankCode.trim() || !newRankName.trim()) {
      alert('Vui lòng nhập đầy đủ Mã ngạch và Tên ngạch.');
      return;
    }

    try {
      const created = JobRankService.addCustomRank({
        code: newRankCode,
        name: newRankName,
        defaultCoefficient: Number(newRankCoeff) || 2.34,
        maxStep: Number(newRankMaxStep) || 9,
        group: newRankGroup,
      });

      const updatedList = JobRankService.getAllRanks();
      setAllRanks(updatedList);
      setJobRankCode(created.code);
      setJobRankName(created.name);
      setCoefficient(created.defaultCoefficient || 2.34);
      setShowAddRankModal(false);
      setNewRankCode('');
      setNewRankName('');
    } catch (err: any) {
      alert(err.message || 'Lỗi thêm ngạch mới');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert('Vui lòng nhập Họ và Tên nhân viên.');
      return;
    }

    const deptObj = departments.find(d => d.id === departmentId);
    const departmentName = deptObj ? deptObj.name : 'Chi cục Chăn nuôi & Thú y';

    const employeeData: Employee = {
      id: initialData?.id || `emp-${Date.now()}`,
      code,
      fullName: fullName.trim(),
      gender,
      dob,
      cccd: cccd || '079' + Math.floor(100000000 + Math.random() * 900000000),
      cccdDate,
      cccdPlace,
      hometown,
      birthplace,
      address: address || 'TP. Hồ Chí Minh',
      phone: phone || '0901234567',
      email: email || `${code.toLowerCase().replace(/-/g, '')}@ccty.gov.vn`,
      maritalStatus,
      ethnicity,
      religion,
      avatarUrl: avatarUrl || undefined,
      departmentId,
      departmentName,
      positionTitle,
      jobRankCode,
      jobRankName,
      staffType,
      recruitmentDate,
      agencyJoinDate: recruitmentDate,
      industryDate: recruitmentDate,
      officialDate,
      status,
      leaveDate: leaveDate || undefined,
      leaveReason: leaveReason.trim() ? leaveReason.trim() : undefined,
      leaveDecisionNumber: leaveDecisionNumber.trim() ? leaveDecisionNumber.trim() : undefined,
      salary: {
        rankCode: jobRankCode,
        rankName: jobRankName,
        step,
        maxStep: jobRankCode.includes('002') ? 8 : 9,
        coefficient: parseDecimalNumber(coefficient, 2.34),
        effectiveDate,
        leadershipAllowance: parseDecimalNumber(leadershipAllowance, 0.0),
        seniorityAllowancePercent: parseDecimalNumber(seniorityAllowancePercent, 0),
        otherAllowance: 0,
        nextSalaryIncreaseDate,
        baseSalary: parseBaseSalary(baseSalary, DEFAULT_BASE_SALARY),
        industryAllowancePercent: parseDecimalNumber(industryAllowancePercent, 10),
        publicServiceAllowancePercent: parseDecimalNumber(publicServiceAllowancePercent, 25),
      },
      education: {
        highestDegree,
        major,
        school,
        gradYear,
        politicalTheory,
        foreignLanguage,
        informatics,
        veterinaryCert,
        otherCerts: [],
      },
      workHistory: initialData?.workHistory || [
        {
          id: `wh-${Date.now()}`,
          employeeId: initialData?.id || `emp-${Date.now()}`,
          startDate: recruitmentDate,
          endDate: 'Nay',
          unitName: departmentName,
          position: positionTitle,
          notes: 'Quyết định tuyển dụng / tiếp nhận ban đầu',
        },
      ],
      salaryHistory: initialData?.salaryHistory || [
        {
          id: `sh-${Date.now()}`,
          employeeId: initialData?.id || `emp-${Date.now()}`,
          step,
          coefficient: parseDecimalNumber(coefficient, 2.34),
          effectiveDate,
          decisionNumber: '',
          decisionDate: effectiveDate,
          type: 'Định kỳ',
        },
      ],
      trainingHistory: initialData?.trainingHistory || [],
      rewardDiscipline: initialData?.rewardDiscipline || [],
      documents: initialData?.documents || [],
      driveFolderId: initialData?.driveFolderId,
      driveFolderLink: initialData?.driveFolderLink,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSave(employeeData, isEdit);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-sky-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">
              {isEdit ? `Chỉnh Sửa Hồ Sơ: ${initialData?.fullName}` : 'Thêm Mới Cán Bộ / Nhân Sự Chi Cục'}
            </h3>
            <p className="text-xs text-sky-200 mt-0.5">
              Chi cục Chăn nuôi và Thú y TP.HCM &bull; Mã hồ sơ điện tử chuẩn hóa
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-sky-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 text-xs font-semibold shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setFormTab('personal')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 ${
              formTab === 'personal' ? 'border-sky-600 text-sky-700 bg-white font-bold' : 'border-transparent text-slate-600'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Thông tin cá nhân</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('assignment')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 ${
              formTab === 'assignment' ? 'border-sky-600 text-sky-700 bg-white font-bold' : 'border-transparent text-slate-600'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>2. Đơn vị & Chức vụ</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('salary')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 ${
              formTab === 'salary' ? 'border-sky-600 text-sky-700 bg-white font-bold' : 'border-transparent text-slate-600'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>3. Tiền lương & Phụ cấp</span>
          </button>

          <button
            type="button"
            onClick={() => setFormTab('education')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 ${
              formTab === 'education' ? 'border-sky-600 text-sky-700 bg-white font-bold' : 'border-transparent text-slate-600'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>4. Đào tạo & Thú y</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
          
          {/* TAB 1: CÁ NHÂN */}
          {formTab === 'personal' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Họ và Tên khai sinh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã nhân viên (Định dạng NV-YYYYMMDD-XXXX)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-2 font-mono font-bold text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setCode(generateEmployeeCode(dob))}
                      title="Tạo lại mã"
                      className="p-2 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => handleDobChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số CCCD</label>
                  <input
                    type="text"
                    value={cccd}
                    onChange={(e) => setCccd(e.target.value)}
                    placeholder="079..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quê quán</label>
                  <input
                    type="text"
                    value={hometown}
                    onChange={(e) => setHometown(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nơi ở hiện nay</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, đường, quận/huyện TP.HCM"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại di động</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Địa chỉ Email công vụ</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="...@ccty.gov.vn"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Đường dẫn ảnh chân dung (URL)</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>
            </div>
          )}

          {/* TAB 2: ĐƠN VỊ & CHỨC VỤ */}
          {formTab === 'assignment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn vị / Phòng / Trạm trực thuộc</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chức vụ / Vị trí việc làm</label>
                  <input
                    type="text"
                    value={positionTitle}
                    onChange={(e) => setPositionTitle(e.target.value)}
                    placeholder="Trưởng phòng, Trạm phó, Kiểm dịch viên..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Ngạch công chức / viên chức *</label>
                    <button
                      type="button"
                      onClick={() => setShowAddRankModal(true)}
                      className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-1 hover:underline"
                      title="Nhập thêm ngạch mới vào trường dữ liệu này"
                    >
                      <Plus className="w-3 h-3 text-sky-600" />
                      <span>+ Thêm ngạch mới</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <select
                      value={jobRankCode}
                      onChange={(e) => handleRankChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 font-medium text-slate-800"
                    >
                      {/* Nhóm Kế toán (theo yêu cầu người dùng) */}
                      <optgroup label="📋 Nhóm Kế toán (06.xxx)">
                        {allRanks.filter(r => r.group === 'Kế toán').map(r => (
                          <option key={r.code} value={r.code}>
                            {r.code} - {r.name}
                          </option>
                        ))}
                      </optgroup>

                      {/* Nhóm Kiểm dịch động thực vật & Thú y (theo yêu cầu người dùng: Kiểm dịch viên động thực vật 09.068) */}
                      <optgroup label="🛡️ Nhóm Kiểm dịch & Thú y (09.xxx / V.03)">
                        {allRanks.filter(r => r.group === 'Kiểm dịch & Thú y').map(r => (
                          <option key={r.code} value={r.code}>
                            {r.code} - {r.name}
                          </option>
                        ))}
                      </optgroup>

                      {/* Nhóm Hành chính / Chuyên viên (theo yêu cầu người dùng: Chuyên viên) */}
                      <optgroup label="🏛️ Nhóm Hành chính / Chuyên viên (01.xxx)">
                        {allRanks.filter(r => r.group === 'Hành chính').map(r => (
                          <option key={r.code} value={r.code}>
                            {r.code} - {r.name}
                          </option>
                        ))}
                      </optgroup>

                      {/* Nhóm ngạch tự nhập thêm của người dùng */}
                      {allRanks.some(r => r.group === 'Ngạch tự nhập / Khác' || r.isCustom) && (
                        <optgroup label="⭐ Ngạch tự nhập thêm">
                          {allRanks.filter(r => r.group === 'Ngạch tự nhập / Khác' || r.isCustom).map(r => (
                            <option key={r.code} value={r.code}>
                              {r.code} - {r.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {/* Nếu mã ngạch hiện thời chưa có trong danh sách */}
                      {!allRanks.some(r => r.code.toLowerCase() === jobRankCode.toLowerCase()) && (
                        <optgroup label="Ngạch hiện tại">
                          <option value={jobRankCode}>{jobRankCode} - {jobRankName || 'Ngạch hiện thời'}</option>
                        </optgroup>
                      )}

                      <option value="__ADD_NEW__" className="text-sky-700 font-bold bg-sky-50">
                        ➕ [Nhập thêm ngạch mới khác...]
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddRankModal(true)}
                      className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 hover:text-sky-900 border border-sky-300 rounded-lg shrink-0 transition"
                      title="Nhập thêm ngạch mới vào trường dữ liệu này"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span className="truncate pr-1">Tên ngạch: <strong className="text-slate-800">{jobRankName}</strong></span>
                    <span className="font-mono text-sky-800 shrink-0 font-bold">Mã: {jobRankCode}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Loại nhân sự *</label>
                  <select
                    value={staffType}
                    onChange={(e) => setStaffType(e.target.value as StaffType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="Công chức">Công chức</option>
                    <option value="Viên chức">Viên chức</option>
                    <option value="Hợp đồng 111">Hợp đồng 111</option>
                    <option value="Nhân viên Thú y PX">Nhân viên Thú y PX</option>
                    <option value="Khoán chuyên môn">Khoán chuyên môn</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tình trạng công tác</label>
                  <select
                    value={status}
                    onChange={(e) => {
                      const newStatus = e.target.value as WorkStatus;
                      setStatus(newStatus);
                      if ((newStatus === 'Nghỉ hưu' || newStatus === 'Thôi việc') && !leaveDate) {
                        setLeaveDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Đang công tác">Đang công tác</option>
                    <option value="Nghỉ hưu">Nghỉ hưu</option>
                    <option value="Thôi việc">Thôi việc</option>
                    <option value="Chuyển công tác">Chuyển công tác</option>
                    <option value="Nghỉ không lương / Tạm hoãn">Nghỉ không lương / Tạm hoãn</option>
                    <option value="Biệt phái">Biệt phái</option>
                  </select>
                </div>
              </div>

              {/* Thông tin Theo Dõi Nghỉ Hưu & Thôi Việc (Theo yêu cầu người dùng) */}
              {(status === 'Nghỉ hưu' || status === 'Thôi việc' || leaveDate) && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5 uppercase">
                      <span>🏖️</span>
                      <span>Thông Tin Theo Dõi Nghỉ Hưu & Nghỉ Thôi Việc</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      status === 'Nghỉ hưu' ? 'bg-amber-200 text-amber-900 border-amber-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {status === 'Nghỉ hưu' ? 'Chế độ Hưu trí' : (status === 'Thôi việc' ? 'Thôi việc / Chấm dứt HĐ' : status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-amber-950 mb-1">
                        Ngày bắt đầu nghỉ {status === 'Nghỉ hưu' || status === 'Thôi việc' ? <span className="text-rose-600">*</span> : ''}
                      </label>
                      <input
                        type="date"
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        required={status === 'Nghỉ hưu' || status === 'Thôi việc'}
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500 shadow-xs"
                      />
                      <span className="text-[10px] text-amber-800 mt-0.5 block">
                        Ngày chính thức nghỉ thôi việc hoặc nghỉ hưu
                      </span>
                    </div>

                    <div>
                      <label className="block font-semibold text-amber-950 mb-1">
                        Số Quyết định nghỉ hưu / thôi việc
                      </label>
                      <input
                        type="text"
                        value={leaveDecisionNumber}
                        onChange={(e) => setLeaveDecisionNumber(e.target.value)}
                        placeholder="VD: 312/QĐ-SNN, 85/QĐ-CCTY..."
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-amber-950 mb-1">
                        Lý do nghỉ thôi việc / nghỉ hưu
                      </label>
                      <input
                        type="text"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="Đủ tuổi nghỉ hưu, Tinh giản biên chế..."
                        className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày tuyển dụng</label>
                  <input
                    type="date"
                    value={recruitmentDate}
                    onChange={(e) => setRecruitmentDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày vào biên chế chính thức</label>
                  <input
                    type="date"
                    value={officialDate}
                    onChange={(e) => setOfficialDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIỀN LƯƠNG */}
          {formTab === 'salary' && (
            <div className="space-y-4">
              {/* TRƯỜNG THÔNG TIN MỨC LƯƠNG CƠ SỞ (Tùy ý nhập không bị ràng buộc số tiền) */}
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl">
                <div className="max-w-md">
                  <label className="block font-bold text-sky-950 text-xs mb-1 flex items-center gap-1.5">
                    <span>💵</span>
                    <span>MỨC LƯƠNG CƠ SỞ (VNĐ/THÁNG) *</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={baseSalary}
                      onChange={(e) => setBaseSalary(e.target.value)}
                      placeholder="VD: 2530000 hoặc 5576120"
                      className="w-full bg-white border border-sky-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-sky-950 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <span className="text-xs text-sky-900 font-mono font-bold shrink-0">
                      {formatBaseSalary(baseSalary)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Mức lương cơ sở mặc định: <strong>2.530.000 VNĐ/tháng</strong> (cho phép điền số tiền tự do không ràng buộc, ví dụ: 5.576.120 đ...)
                  </span>
                </div>
              </div>

              {/* Bậc, Hệ số lương & Ngày hưởng */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bậc lương hiện hưởng</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={step}
                    onChange={(e) => setStep(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hệ số lương (Decimal)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={coefficient}
                    onChange={(e) => setCoefficient(e.target.value)}
                    onBlur={() => {
                      const parsed = parseDecimalNumber(coefficient, 2.34);
                      setCoefficient(formatDecimal(parsed, 2));
                    }}
                    placeholder="2.34"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                    Hệ số: {formatDecimal(coefficient, 2)}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày hưởng bậc lương</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {/* Nhóm Các Khoản Phụ Cấp */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3">
                <div className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-sky-600" />
                  <span>Các Khoản Phụ Cấp Chức Vụ & Theo Nghề</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phụ cấp chức vụ (Định dạng Decimal)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={leadershipAllowance}
                        onChange={(e) => setLeadershipAllowance(e.target.value)}
                        onBlur={() => setLeadershipAllowance(formatPCCV(leadershipAllowance))}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                      <span className="text-[10px] text-indigo-700 font-mono font-semibold block mt-0.5">
                        Chuẩn Decimal: {formatPCCV(leadershipAllowance)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phụ cấp thâm niên nghề (%)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={seniorityAllowancePercent}
                      onChange={(e) => setSeniorityAllowancePercent(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 shadow-2xs"
                    />
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                      Hiển thị: {formatPercentAllowance(seniorityAllowancePercent, 0)}
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phụ cấp ưu đãi ngành (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={industryAllowancePercent}
                        onChange={(e) => setIndustryAllowancePercent(e.target.value)}
                        placeholder="10"
                        className="w-full bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                      <span className="text-[10px] text-indigo-700 font-mono block mt-0.5">
                        Hiển thị: {formatPercentAllowance(industryAllowancePercent, 10)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phụ cấp công vụ (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={publicServiceAllowancePercent}
                        onChange={(e) => setPublicServiceAllowancePercent(e.target.value)}
                        placeholder="25"
                        className="w-full bg-white border border-emerald-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                      />
                      <span className="text-[10px] text-emerald-700 font-mono block mt-0.5">
                        Hiển thị: {formatPercentAllowance(publicServiceAllowancePercent, 25)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dự kiến nâng lương lần sau */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Dự kiến nâng bậc lương lần sau</label>
                  <input
                    type="date"
                    value={nextSalaryIncreaseDate}
                    onChange={(e) => setNextSalaryIncreaseDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ĐÀO TẠO */}
          {formTab === 'education' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trình độ chuyên môn cao nhất</label>
                  <select
                    value={highestDegree}
                    onChange={(e) => setHighestDegree(e.target.value as DegreeLevel)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Đại học">Đại học</option>
                    <option value="Cao đẳng">Cao đẳng</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Sơ cấp">Sơ cấp</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chuyên ngành đào tạo</label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Bác sĩ Thú y, Chăn nuôi, Luật..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cơ sở đào tạo</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Năm tốt nghiệp</label>
                  <input
                    type="number"
                    value={gradYear}
                    onChange={(e) => setGradYear(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lý luận chính trị</label>
                  <select
                    value={politicalTheory}
                    onChange={(e) => setPoliticalTheory(e.target.value as PoliticalTheoryLevel)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  >
                    <option value="Cao cấp">Cao cấp</option>
                    <option value="Trung cấp">Trung cấp</option>
                    <option value="Sơ cấp">Sơ cấp</option>
                    <option value="Chưa qua bồi dưỡng">Chưa qua bồi dưỡng</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chứng chỉ Thú y / Kiểm dịch</label>
                  <input
                    type="text"
                    value={veterinaryCert}
                    onChange={(e) => setVeterinaryCert(e.target.value)}
                    placeholder="Chứng chỉ Kiểm dịch Động vật..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold px-4 py-2 rounded-lg transition"
            >
              Hủy bỏ
            </button>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2 rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Save className="w-4 h-4" />
                <span>{isEdit ? 'Lưu Thay Đổi Hồ Sơ' : 'Tạo Hồ Sơ Mới'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Modal Nhập Ngạch Công Chức / Viên Chức Mới */}
      {showAddRankModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-[70] flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 text-xs">
            <div className="bg-gradient-to-r from-sky-800 to-indigo-800 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-300" />
                <h3 className="font-bold text-sm">Nhập Ngạch Công Chức / Viên Chức Mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRankModal(false)}
                className="text-sky-200 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRank} className="p-5 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mã ngạch công chức / viên chức *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: 06.029, 06.033, 09.068, V.03.04.14..."
                  value={newRankCode}
                  onChange={(e) => setNewRankCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-sky-900 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Mã số chuẩn ngạch công chức hoặc chức danh nghề nghiệp</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên ngạch công chức / viên chức *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Kế toán viên cao cấp, Kiểm dịch viên động thực vật..."
                  value={newRankName}
                  onChange={(e) => setNewRankName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hệ số lương bậc 1</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRankCoeff}
                    onChange={(e) => setNewRankCoeff(parseFloat(e.target.value) || 2.34)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-700 focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số bậc tối đa</label>
                  <select
                    value={newRankMaxStep}
                    onChange={(e) => setNewRankMaxStep(parseInt(e.target.value, 10) || 9)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                  >
                    <option value="6">6 bậc (Ngạch cao cấp: 01.001, 06.029)</option>
                    <option value="8">8 bậc (Ngạch chính: 01.002, 06.030, 09.018)</option>
                    <option value="9">9 bậc (Chuyên viên, Kế toán viên, KDV: 01.003, 06.031, 09.068)</option>
                    <option value="12">12 bậc (Trung cấp, Cán sự, KTV: 01.004, 06.032, 09.020)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phân nhóm ngạch</label>
                <select
                  value={newRankGroup}
                  onChange={(e) => setNewRankGroup(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="Kế toán">Nhóm Kế toán</option>
                  <option value="Kiểm dịch & Thú y">Nhóm Kiểm dịch & Thú y</option>
                  <option value="Hành chính">Nhóm Hành chính</option>
                  <option value="Ngạch tự nhập / Khác">Ngạch tự nhập / Khác</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddRankModal(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu & Chọn Ngạch Này</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
