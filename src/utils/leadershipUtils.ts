import { Employee, Department } from '../types/hrm';

/**
 * Chuẩn hóa chuỗi ký tự tiếng Việt (bỏ dấu, chuyển chữ thường) để so sánh chính xác
 */
export const normalizeText = (str?: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Kiểm tra một nhân sự có thuộc Ban Lãnh Đạo Chi Cục hay không
 * Bao gồm các chức danh: Chi cục Trưởng, Phó Chi cục Trưởng (lấy từ DS_NhanSu)
 */
export const isBanLanhDaoChiCuc = (emp: Employee): boolean => {
  if (!emp) return false;
  if (emp.departmentId === 'BAN_LANH_DAO') return true;

  const pos = normalizeText(emp.positionTitle || '');
  if (
    pos.includes('chi cuc truong') ||
    pos.includes('pho chi cuc truong') ||
    pos.includes('chi cuc pho') ||
    pos.includes('truong chi cuc') ||
    pos.includes('pho truong chi cuc') ||
    pos.includes('quyen chi cuc truong') ||
    pos.includes('q chi cuc truong') ||
    pos.includes('phu trach chi cuc') ||
    pos === 'cct' ||
    pos === 'pcct'
  ) {
    return true;
  }

  const dept = normalizeText(emp.departmentName || '');
  if (
    dept.includes('ban lanh dao') ||
    dept.includes('ban giam doc') ||
    dept === 'bld'
  ) {
    return true;
  }

  return false;
};

/**
 * Lấy danh sách nhân sự thuộc một phòng/trạm/đơn vị
 * Đặc biệt đối với 'BAN_LANH_DAO': lấy toàn bộ các chức danh Chi cục Trưởng và Phó Chi cục Trưởng từ DS_NhanSu
 */
export const getEmployeesOfDepartment = (employees: Employee[], deptId: string): Employee[] => {
  if (!Array.isArray(employees)) return [];

  if (deptId === 'BAN_LANH_DAO') {
    return employees.filter(emp => isBanLanhDaoChiCuc(emp));
  }

  return employees.filter(emp => emp.departmentId === deptId && !isBanLanhDaoChiCuc(emp));
};

/**
 * Kiểm tra xem một nhân sự có giữ chức vụ lãnh đạo / phụ trách hay không
 * Chức danh: Chi cục Trưởng, Phó Chi cục Trưởng, Trưởng phòng, Phó trưởng phòng,
 * Trưởng trạm, Phó trưởng trạm, Trạm trưởng, Giám đốc, Phó Giám đốc, Phụ trách đơn vị...
 * hoặc có phụ cấp chức vụ lãnh đạo PCCV > 0
 */
export const isLeadershipEmployee = (emp: Employee): boolean => {
  if (!emp) return false;
  if (isBanLanhDaoChiCuc(emp)) return true;

  const pos = normalizeText(emp.positionTitle || '');
  const pccv = Number(emp.salary?.leadershipAllowance) || 0;

  if (
    pos.includes('truong tram') ||
    pos.includes('tram truong') ||
    pos.includes('pho truong tram') ||
    pos.includes('pho tram truong') ||
    pos.includes('pho tram') ||
    pos.includes('phu trach don vi') ||
    pos.includes('phu trach tram') ||
    pos.includes('phu trach phong') ||
    pos.includes('phu trach') ||
    pos.includes('truong phong') ||
    pos.includes('pho truong phong') ||
    pos.includes('pho phong') ||
    pos.includes('giam doc') ||
    pos.includes('pho giam doc') ||
    pos.includes('truong') ||
    pos.includes('pho') ||
    pccv > 0
  ) {
    return true;
  }

  return false;
};

/**
 * Trọng số cấp bậc lãnh đạo để sắp xếp danh sách lãnh đạo theo phân cấp
 * 1. Chi cục Trưởng -> 2. Phó Chi cục Trưởng -> 3. Trưởng phòng / Giám đốc -> 4. Phó phòng / Phó Giám đốc
 * -> 5. Trưởng trạm / Phụ trách đơn vị -> 6. Phó trưởng trạm -> 7. Chức danh lãnh đạo khác
 */
export const getLeadershipRankWeight = (emp: Employee): number => {
  const pos = normalizeText(emp.positionTitle || '');

  // 1. Chi cục Trưởng
  if (
    pos.includes('chi cuc truong') &&
    !pos.includes('pho')
  ) {
    return 1;
  }

  // 2. Phó Chi cục Trưởng
  if (
    pos.includes('pho chi cuc truong') ||
    pos.includes('chi cuc pho') ||
    pos.includes('pho truong chi cuc')
  ) {
    return 2;
  }

  // 3. Trưởng phòng / Giám đốc Trung tâm
  if (
    (pos.includes('truong phong') || pos.includes('giam doc')) &&
    !pos.includes('pho')
  ) {
    return 3;
  }

  // 4. Phó Trưởng phòng / Phó Giám đốc Trung tâm
  if (
    pos.includes('pho truong phong') ||
    pos.includes('pho phong') ||
    pos.includes('pho giam doc')
  ) {
    return 4;
  }

  // 5. Trưởng trạm / Trạm trưởng / Phụ trách đơn vị / Phụ trách trạm
  if (
    pos.includes('truong tram') ||
    pos.includes('tram truong') ||
    pos.includes('phu trach don vi') ||
    pos.includes('phu trach tram') ||
    (pos.includes('phu trach') && !pos.includes('pho'))
  ) {
    return 5;
  }

  // 6. Phó trưởng trạm / Phó trạm
  if (
    pos.includes('pho truong tram') ||
    pos.includes('pho tram truong') ||
    pos.includes('pho tram')
  ) {
    return 6;
  }

  // 7. Các chức vụ lãnh đạo khác
  if (pos.includes('truong') && !pos.includes('pho')) return 7;
  if (pos.includes('pho')) return 8;
  return 9;
};

/**
 * Trọng số ưu tiên sắp xếp nhân sự theo yêu cầu phân cấp:
 * 1. Chi cục Trưởng
 * 2. Phó Chi Cục Trưởng
 * 3. Trưởng trạm / Trưởng phòng / Giám đốc / Phụ trách đơn vị
 * 4. Phó Trưởng Trạm / Phó Trưởng phòng / Phó Giám đốc
 * Sau đó:
 * 5. Công chức
 * 6. Viên chức
 * 7. Hợp đồng 111 (HĐ 68/111, HĐLĐ, Thú y PX, Khoán)
 */
export const getStaffPriorityScore = (emp: Employee): number => {
  if (!emp) return 999;
  const pos = normalizeText(emp.positionTitle || '');

  // 1. Chi cục Trưởng
  if (
    pos.includes('chi cuc truong') &&
    !pos.includes('pho')
  ) {
    return 10;
  }
  if (
    pos.includes('truong chi cuc') &&
    !pos.includes('pho')
  ) {
    return 10;
  }
  if (pos.includes('quyen chi cuc truong') || pos.includes('phu trach chi cuc') || pos === 'cct') {
    return 10;
  }

  // 2. Phó Chi cục Trưởng
  if (
    pos.includes('pho chi cuc truong') ||
    pos.includes('chi cuc pho') ||
    pos.includes('pho truong chi cuc') ||
    pos === 'pcct'
  ) {
    return 20;
  }

  // 3. Trưởng trạm / Trưởng phòng / Giám đốc / Phụ trách đơn vị / Phụ trách trạm
  if (
    pos.includes('truong tram') ||
    pos.includes('tram truong') ||
    pos.includes('phu trach don vi') ||
    pos.includes('phu trach tram') ||
    (pos.includes('truong phong') && !pos.includes('pho')) ||
    (pos.includes('giam doc') && !pos.includes('pho')) ||
    (pos.includes('phu trach') && !pos.includes('pho'))
  ) {
    return 30;
  }

  // 4. Phó Trưởng Trạm / Phó Trưởng phòng / Phó Giám đốc / Phó trạm
  if (
    pos.includes('pho truong tram') ||
    pos.includes('pho tram truong') ||
    pos.includes('pho tram') ||
    pos.includes('pho truong phong') ||
    pos.includes('pho phong') ||
    pos.includes('pho giam doc') ||
    (pos.includes('pho') && (pos.includes('tram') || pos.includes('phong') || pos.includes('don vi')))
  ) {
    return 40;
  }

  // Chức danh lãnh đạo khác có phụ cấp hoặc có chữ Trưởng/Phó
  const pccv = Number(emp.salary?.leadershipAllowance) || 0;
  if (pos.includes('truong') && !pos.includes('pho')) return 42;
  if (pos.includes('pho') || pccv > 0) return 44;

  // Sau đó: 5. Công chức, 6. Viên chức, 7. Hợp đồng 111
  const staffType = normalizeText(emp.staffType || '');
  const rankCode = normalizeText(emp.jobRankCode || emp.salary?.rankCode || '');

  // 5. Công chức
  if (
    staffType.includes('cong chuc') ||
    (!staffType.includes('vien chuc') &&
     !staffType.includes('111') &&
     !staffType.includes('68') &&
     !staffType.includes('hop dong') &&
     !staffType.includes('khoan') &&
     !staffType.includes('px') &&
     !rankCode.startsWith('v ') &&
     !rankCode.startsWith('09 '))
  ) {
    return 50;
  }

  // 6. Viên chức
  if (
    staffType.includes('vien chuc') ||
    rankCode.startsWith('v ') ||
    rankCode.startsWith('09 ')
  ) {
    return 60;
  }

  // 7. Hợp đồng 111 (Nghị định 111, HĐ 68/111, HĐLĐ, Thú y PX, Khoán)
  return 70;
};

/**
 * Sắp xếp danh sách nhân sự ưu tiên theo thứ bậc:
 * Chi cục Trưởng -> Phó Chi Cục Trưởng -> Trưởng trạm -> Phó Trưởng Trạm -> Công chức -> Viên chức -> Hợp đồng 111
 */
export const sortEmployeesByPriority = (list: Employee[]): Employee[] => {
  if (!Array.isArray(list) || list.length <= 1) return Array.isArray(list) ? [...list] : [];

  const decorated = list.map((emp, index) => ({
    emp,
    index,
    score: getStaffPriorityScore(emp),
    pccv: Number(emp?.salary?.leadershipAllowance) || 0,
    coef: Number(emp?.salary?.coefficient) || 0,
    fullName: emp?.fullName || '',
  }));

  decorated.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    // Ưu tiên phụ cấp chức vụ lãnh đạo PCCV
    if (b.pccv !== a.pccv) {
      return b.pccv - a.pccv;
    }
    // Ưu tiên hệ số lương
    if (b.coef !== a.coef) {
      return b.coef - a.coef;
    }
    // Sắp xếp theo tên tiếng Việt
    const nameDiff = a.fullName.localeCompare(b.fullName, 'vi');
    if (nameDiff !== 0) return nameDiff;
    return a.index - b.index;
  });

  return decorated.map(item => item.emp);
};

/**
 * Tự động tìm tên Người đứng đầu (Trưởng đơn vị / Chi cục Trưởng / Trạm trưởng / Phụ trách đơn vị) từ DS_NhanSu
 */
export const resolveDepartmentLeaderName = (
  dept: Department, 
  employees: Employee[]
): string => {
  // Lấy danh sách nhân sự thực tế của đơn vị từ DS_NhanSu
  const deptStaff = getEmployeesOfDepartment(employees, dept.id);

  if (dept.id === 'BAN_LANH_DAO') {
    const leader = deptStaff.find(e => {
      const pos = normalizeText(e.positionTitle || '');
      return pos.includes('chi cuc truong') && !pos.includes('pho');
    });
    if (leader) return leader.fullName;
  }

  // Tìm Trưởng phòng, Trạm trưởng, Giám đốc, Phụ trách đơn vị, Trưởng trạm
  const leader = deptStaff.find(e => {
    const pos = normalizeText(e.positionTitle || '');
    return (
      (pos.includes('truong') && !pos.includes('pho')) ||
      (pos.includes('giam doc') && !pos.includes('pho')) ||
      pos.includes('phu trach')
    );
  });
  if (leader) return leader.fullName;

  // Nếu không tìm thấy trong DS_NhanSu, dùng giá trị đồng bộ từ CSDL DanhMuc_PhongBan (loại bỏ tên mẫu cũ)
  if (
    dept.leaderName && 
    dept.leaderName.trim() &&
    !dept.leaderName.includes('Hữu Nam') &&
    !dept.leaderName.includes('Kim Lan')
  ) {
    return dept.leaderName.trim();
  }

  return '';
};

/**
 * Tự động tìm tên Cấp phó đơn vị (Phó Chi cục Trưởng / Phó phòng / Phó trạm) từ DS_NhanSu
 */
export const resolveDepartmentDeputyLeaderName = (
  dept: Department, 
  employees: Employee[]
): string => {
  const deptStaff = getEmployeesOfDepartment(employees, dept.id);

  if (dept.id === 'BAN_LANH_DAO') {
    const deputies = deptStaff.filter(e => {
      const pos = normalizeText(e.positionTitle || '');
      return pos.includes('pho chi cuc truong') || pos.includes('chi cuc pho');
    });
    if (deputies.length > 0) {
      return deputies.map(d => d.fullName).join(', ');
    }
  }

  // Tìm Phó phòng, Phó trạm, Phó giám đốc
  const deputies = deptStaff.filter(e => {
    const pos = normalizeText(e.positionTitle || '');
    return pos.includes('pho');
  });
  if (deputies.length > 0) {
    return deputies.map(d => d.fullName).join(', ');
  }

  // Nếu không tìm thấy trong DS_NhanSu, dùng giá trị đồng bộ từ CSDL DanhMuc_PhongBan (loại bỏ tên mẫu cũ)
  if (
    dept.deputyLeaderName && 
    dept.deputyLeaderName.trim() &&
    !dept.deputyLeaderName.includes('Hữu Nam') &&
    !dept.deputyLeaderName.includes('Kim Lan')
  ) {
    return dept.deputyLeaderName.trim();
  }

  return '';
};
