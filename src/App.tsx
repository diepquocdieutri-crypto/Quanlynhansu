import React, { useState, useEffect } from 'react';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_DEPARTMENTS, 
  INITIAL_DECISIONS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_USERS 
} from './data/initialData';
import { 
  Employee, 
  Department, 
  Decision, 
  AuditLog, 
  AppUser 
} from './types/hrm';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { EmployeeListView } from './components/EmployeeListView';
import { EmployeeProfileModal } from './components/EmployeeProfileModal';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import { OrganizationTreeView } from './components/OrganizationTreeView';
import { WorkHistoryMovementView } from './components/WorkHistoryMovementView';
import { SalaryManagementView } from './components/SalaryManagementView';
import { TrainingManagementView } from './components/TrainingManagementView';
import { RewardDisciplineView } from './components/RewardDisciplineView';
import { DecisionsView } from './components/DecisionsView';
import { DriveStorageView } from './components/DriveStorageView';
import { SheetsSyncModal } from './components/SheetsSyncModal';
import { DriveExcelImportModal } from './components/DriveExcelImportModal';
import { ReportsView } from './components/ReportsView';
import { WarningsView } from './components/WarningsView';
import { AuditLogView } from './components/AuditLogView';
import { PermissionsView } from './components/PermissionsView';
import { DepartmentManagementView } from './components/DepartmentManagementView';
import { initAuth, googleSignIn, logoutGoogle, onGoogleAuthExpired, onTokenChange } from './services/firebaseAuth';
import { GoogleDriveService } from './services/googleDriveService';
import { GoogleSheetsService } from './services/googleSheetsService';
import { ExcelImportService } from './services/excelImportService';
import { AppLoginGate } from './components/AppLoginGate';
import { AuthPermissionManagementView } from './components/AuthPermissionManagementView';
import { AuthPermissionService, UserPermission } from './services/authPermissionService';
import { QuickFileSearchModal } from './components/QuickFileSearchModal';
import { MonthlyPayrollView } from './components/MonthlyPayrollView';
import { QuarterlyTaxView } from './components/QuarterlyTaxView';
import { QuarterlyTaxService } from './services/quarterlyTaxService';
import { MonthlyPayrollService } from './services/monthlyPayrollService';
import { parseBaseSalary, parseDecimalNumber, DEFAULT_BASE_SALARY } from './utils/salaryUtils';
import { isBanLanhDaoChiCuc } from './utils/leadershipUtils';

// Hàm chuẩn hóa họ tên để loại bỏ trùng lặp triệt để (kể cả khi tên có thêm hậu tố (Admin), dấu cách thừa...)
function normalizeFullName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // Bỏ hậu tố trong ngoặc như (Admin), (Master Admin)...
    .replace(/[^a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Hàm loại bỏ trùng lặp nhân sự theo KHÓA CHÍNH: Mã Nhân Viên (Cột "Họ Và Tên" được phép trùng tên)
function deduplicateEmployees(list: Employee[]): Employee[] {
  const seenCodes = new Set<string>();
  const seenIds = new Set<string>();
  const result: Employee[] = [];

  for (const emp of list) {
    const code = (emp.code || '').trim().toUpperCase();
    const id = (emp.id || '').trim();

    // Khóa chính duy nhất là Mã Nhân Viên (Cột Họ Và Tên được phép trùng tên)
    if (code) {
      if (seenCodes.has(code)) continue;
      seenCodes.add(code);
    } else if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }

    result.push(emp);
  }
  return result;
}

export default function App() {
  // Local storage state initialization with fallbacks
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const isMockCleared = localStorage.getItem('ccty_is_mock_cleared') === 'true';
    const saved = localStorage.getItem('ccty_employees');
    const mockCodes = [
      'NV-19720814-0001',
      'NV-19750318-0002',
      'NV-19800922-0003',
      'NV-19850410-0004',
      'NV-19641105-0005',
      'NV-19880612-0006',
      'NV-19790514-0007',
      'NV-19940825-0008',
      'NV-19960210-0009',
      'NV-19821203-0010',
      'NV-19650220-0011',
      'NV-19700715-0012',
      'NV-19600101-0013',
    ];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (isMockCleared && parsed.length === 0) {
            return [];
          }
          if (parsed.length > 0) {
            // Lọc bỏ các mã nhân viên mẫu cũ nếu có
            const cleaned = parsed.filter((e: any) => !mockCodes.includes(e.code) && !e.id?.startsWith('emp-0'));
            if (cleaned.length > 0) {
              const unique = deduplicateEmployees(cleaned);
              const isMockDecision = (num?: string) => {
                if (!num) return false;
                const n = num.toLowerCase();
                return (
                  n.includes('89/qd') || n.includes('89/qđ') ||
                  n.includes('115/qd') || n.includes('115/qđ') ||
                  n.includes('208/qd') || n.includes('208/qđ') ||
                  n.includes('14/qd') || n.includes('14/qđ')
                );
              };

              // Chuẩn hóa và lọc bỏ quyết định tự điền trước đây như 89/QĐ, 115/QĐ, 208/QĐ
              const sanitized = unique.map((emp: Employee) => {
                const healedBase = parseBaseSalary(emp.salary?.baseSalary, DEFAULT_BASE_SALARY);
                const healedPccv = parseDecimalNumber(emp.salary?.leadershipAllowance, 0.0);
                const healedCoeff = parseDecimalNumber(emp.salary?.coefficient, 2.34);
                const cleanRewards = (emp.rewardDiscipline || []).filter(rd => !isMockDecision(rd.decisionNumber));
                const cleanSalaryHistory = (emp.salaryHistory || []).filter(sh => !isMockDecision(sh.decisionNumber));

                const isBLD = isBanLanhDaoChiCuc(emp);

                return {
                  ...emp,
                  departmentId: isBLD ? 'BAN_LANH_DAO' : emp.departmentId,
                  departmentName: isBLD ? 'Ban Lãnh đạo Chi cục' : emp.departmentName,
                  salary: {
                    ...emp.salary,
                    baseSalary: healedBase,
                    leadershipAllowance: healedPccv,
                    coefficient: healedCoeff,
                  },
                  rewardDiscipline: cleanRewards,
                  salaryHistory: cleanSalaryHistory,
                };
              });
              localStorage.setItem('ccty_employees', JSON.stringify(sanitized));
              return sanitized;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    // Nếu người dùng đã yêu cầu xóa sạch dữ liệu giả lập, trả về mảng rỗng để nạp từ Google Sheets
    if (isMockCleared) {
      return [];
    }
    // Khởi tạo từ danh sách nhân sự chuẩn DS_NhanSu có sẵn của Chi cục nếu chưa xóa mẫu
    localStorage.setItem('ccty_employees', JSON.stringify(INITIAL_EMPLOYEES));
    return deduplicateEmployees(INITIAL_EMPLOYEES);
  });

  const [departments, setDepartments] = useState<Department[]>(() => {
    const saved = localStorage.getItem('ccty_departments');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Tự động làm sạch các tên giả định cũ (như Nguyễn Hữu Nam, Chu Thị Kim Lan) nếu có trong bộ nhớ
          const sanitized = parsed.map((d: Department) => ({
            ...d,
            leaderName: (d.leaderName && (d.leaderName.includes('Hữu Nam') || d.leaderName.includes('Kim Lan'))) ? '' : (d.leaderName || ''),
            deputyLeaderName: (d.deputyLeaderName && (d.deputyLeaderName.includes('Hữu Nam') || d.deputyLeaderName.includes('Kim Lan'))) ? '' : (d.deputyLeaderName || ''),
          }));
          localStorage.setItem('ccty_departments', JSON.stringify(sanitized));
          return sanitized;
        }
      } catch {
        // ignore
      }
    }
    return INITIAL_DEPARTMENTS;
  });
  
  const [decisions, setDecisions] = useState<Decision[]>(() => {
    const saved = localStorage.getItem('ccty_decisions');
    if (saved) {
      try {
        const parsed: Decision[] = JSON.parse(saved);
        // Tự động loại bỏ triệt để các quyết định mẫu tự điền trước đây như 89/QĐ, 115/QĐ, 208/QĐ, 14/QĐ...
        const cleaned = (Array.isArray(parsed) ? parsed : []).filter((d) => {
          const num = (d.number || '').toLowerCase();
          return (
            !num.includes('89/qd') &&
            !num.includes('89/qđ') &&
            !num.includes('115/qd') &&
            !num.includes('115/qđ') &&
            !num.includes('208/qd') &&
            !num.includes('208/qđ') &&
            !num.includes('14/qd') &&
            !num.includes('14/qđ')
          );
        });
        localStorage.setItem('ccty_decisions', JSON.stringify(cleaned));
        return cleaned;
      } catch (e) {
        return [];
      }
    }
    return INITIAL_DECISIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('ccty_audit_logs');
    if (saved) {
      try {
        const parsed: AuditLog[] = JSON.parse(saved);
        const cleaned = (Array.isArray(parsed) ? parsed : []).filter((log) => {
          const det = (log.details || '').toLowerCase();
          const id = (log.id || '').toLowerCase();
          return (
            !det.includes('208/qd') &&
            !det.includes('208/qđ') &&
            !det.includes('14/qd') &&
            !det.includes('14/qđ') &&
            id !== 'log-001' &&
            id !== 'log-002' &&
            id !== 'log-003'
          );
        });
        localStorage.setItem('ccty_audit_logs', JSON.stringify(cleaned));
        return cleaned;
      } catch (e) {
        return [];
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [users, setUsers] = useState<AppUser[]>(() => {
    const localPerms = AuthPermissionService.getLocalPermissions();
    return AuthPermissionService.getAppUsersFromPermissions(localPerms);
  });
  const [currentUser, setCurrentUser] = useState<AppUser>(() => {
    const localPerms = AuthPermissionService.getLocalPermissions();
    const appUsers = AuthPermissionService.getAppUsersFromPermissions(localPerms);
    return appUsers[0] || INITIAL_USERS[0];
  });

  // UI state
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState<boolean>(false);
  const [isQuickSearchModalOpen, setIsQuickSearchModalOpen] = useState<boolean>(false);
  const [isRefreshingSheets, setIsRefreshingSheets] = useState<boolean>(false);
  const [staffTypeFilter, setStaffTypeFilter] = useState<string>('ALL');

  const handleFilterStaffTypeFromDashboard = (type: string) => {
    setStaffTypeFilter(type);
    setCurrentTab('staff');
  };

  // Google Auth & Workspace state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | undefined>();
  const [rootStaffFolderId, setRootStaffFolderId] = useState<string | undefined>();

  // Access Permission Gate State (Lớp Đăng Nhập & Cấp Quyền Bảo Mật)
  const [accessStatus, setAccessStatus] = useState<{
    isAllowed: boolean;
    reason?: string;
    permission?: UserPermission;
  } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(false);

  // Save to localStorage whenever critical data changes
  useEffect(() => {
    localStorage.setItem('ccty_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('ccty_departments', JSON.stringify(departments));
    localStorage.setItem('ccty_dept_version', 'v2_23depts');
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('ccty_decisions', JSON.stringify(decisions));
  }, [decisions]);

  useEffect(() => {
    localStorage.setItem('ccty_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Khởi tạo và ghi nhận mã bảng tính cấp quyền từ link triển khai URL (?permSheetId=...)
  useEffect(() => {
    AuthPermissionService.getSavedSpreadsheetId();
  }, []);

  // Kiểm tra quyền hạn của người dùng từ sheet Trang tính1 trong thư mục Drive
  const checkAccessPermission = async (email?: string) => {
    // Luôn tải danh sách cán bộ cấp quyền mới nhất từ sheet Trang tính1 để đồng bộ dropdown
    try {
      const allPerms = await AuthPermissionService.loadPermissionsFromSheet();
      const mappedUsers = AuthPermissionService.getAppUsersFromPermissions(allPerms);
      if (mappedUsers.length > 0) {
        setUsers(mappedUsers);
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ danh sách cán bộ cấp quyền:', e);
    }

    if (!email) {
      setAccessStatus(null);
      return;
    }
    try {
      setIsCheckingAccess(true);
      const res = await AuthPermissionService.checkAccess(email);
      setAccessStatus(res);
      if (res.isAllowed && res.permission) {
        // Cập nhật người dùng hiện tại theo thông tin phân quyền
        setCurrentUser(prev => ({
          ...prev,
          name: res.permission?.fullName || prev.name,
          email: res.permission?.email || email,
          role: res.permission?.role === 'ADMIN' ? 'ADMIN' : (res.permission?.role === 'HR_MANAGER' ? 'HR' : (res.permission?.role === 'DEPT_LEADER' ? 'MANAGER' : 'STAFF')),
          roleTitle: AuthPermissionService.getRoleLabel(res.permission?.role || 'VIEWER'),
        }));
      }
    } catch (err: any) {
      console.warn('Lỗi kiểm tra quyền hạn:', err);
      if (AuthPermissionService.isMasterAdmin(email)) {
        setAccessStatus({ isAllowed: true });
      } else {
        setAccessStatus({ isAllowed: false, reason: err.message });
      }
    } finally {
      setIsCheckingAccess(false);
    }
  };

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setGoogleConnected(true);
        const email = user.email || undefined;
        setGoogleUserEmail(email);
        await checkAccessPermission(email);
        // Automatically check/init Drive structure in background
        GoogleDriveService.initSystemDriveStructure()
          .then(res => {
            setRootStaffFolderId(res.staffFolder.id);
          })
          .catch(err => console.log('Drive init in background info:', err));
      },
      () => {
        setGoogleConnected(false);
        setGoogleUserEmail(undefined);
        setAccessStatus(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Lắng nghe biến động Access Token Google & Bắt sự kiện hết hạn phiên làm việc (Mã 401)
  useEffect(() => {
    const unsubExpired = onGoogleAuthExpired(({ message }) => {
      console.warn('Google Auth token expired (401):', message);
      setGoogleConnected(false);
      setGoogleUserEmail(undefined);
    });
    const unsubToken = onTokenChange((token) => {
      if (!token) {
        setGoogleConnected(false);
      } else {
        setGoogleConnected(true);
      }
    });
    return () => {
      unsubExpired();
      unsubToken();
    };
  }, []);

  // Đăng nhập Google
  const handleLoginGoogle = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleConnected(true);
        const email = result.user.email || undefined;
        setGoogleUserEmail(email);
        await checkAccessPermission(email);

        addAuditLog(
          'ĐĂNG_NHẬP_GOOGLE',
          result.user.displayName || result.user.email || 'Người dùng',
          'Cơ sở dữ liệu',
          'Kết nối',
          'Chưa kết nối',
          'Đã kết nối',
          `Người dùng kết nối Google Workspace với tài khoản: ${result.user.email}`
        );

        // Khởi tạo cây thư mục
        const res = await GoogleDriveService.initSystemDriveStructure();
        setRootStaffFolderId(res.staffFolder.id);
      }
    } catch (err: any) {
      console.error('Lỗi đăng nhập Google:', err);
      alert('Không thể kết nối Google: ' + err.message);
    }
  };

  const handleLogoutGoogle = async () => {
    await logoutGoogle();
    setGoogleConnected(false);
    setGoogleUserEmail(undefined);
    setAccessStatus(null);
  };

  // Helper ghi nhận nhật ký hệ thống (Audit Log) - Nguyên tắc không bao giờ xóa
  const addAuditLog = (
    action: string,
    targetEmployeeName: string,
    targetEmployeeCode: string,
    fieldChanged?: string,
    oldValue?: string,
    newValue?: string,
    details: string = ''
  ) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleString('vi-VN'),
      userName: currentUser.name,
      userEmail: currentUser.email,
      action,
      targetEmployeeCode,
      targetEmployeeName,
      fieldChanged,
      oldValue,
      newValue,
      details,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Xóa 1 hồ sơ nhân sự (Dành riêng cho Quản trị viên)
  const handleDeleteEmployee = (empId: string) => {
    const target = employees.find(e => e.id === empId || e.code === empId);
    if (!target) return;
    
    setEmployees(prev => prev.filter(e => e.id !== target.id && e.code !== target.code));
    if (selectedEmployee?.id === target.id || selectedEmployee?.code === target.code) {
      setSelectedEmployee(null);
    }
    
    addAuditLog(
      'XÓA_NHÂN_SỰ',
      target.fullName,
      target.code,
      'Hồ sơ nhân sự',
      `${target.positionTitle} - ${target.departmentName}`,
      'Đã xóa khỏi cơ sở dữ liệu',
      `Quản trị viên ${currentUser.name} đã xóa vĩnh viễn hồ sơ cán bộ: ${target.code} (${target.fullName})`
    );
  };

  // Dọn sạch toàn bộ 13 nhân viên mẫu để đưa hệ thống vào vận hành chính thức
  const handleClearAllMockEmployees = () => {
    const mockCodes = [
      'NV-19720814-0001',
      'NV-19750318-0002',
      'NV-19800922-0003',
      'NV-19850410-0004',
      'NV-19641105-0005',
      'NV-19880612-0006',
      'NV-19790514-0007',
      'NV-19940825-0008',
      'NV-19960210-0009',
      'NV-19821203-0010',
      'NV-19650220-0011',
      'NV-19700715-0012',
      'NV-19600101-0013',
    ];

    setEmployees(prev => prev.filter(e => !mockCodes.includes(e.code) && !e.id.startsWith('emp-0')));
    if (selectedEmployee && (mockCodes.includes(selectedEmployee.code) || selectedEmployee.id.startsWith('emp-0'))) {
      setSelectedEmployee(null);
    }

    addAuditLog(
      'DỌN_DẸP_HỆ_THỐNG',
      'Toàn bộ nhân sự mẫu (13 mã NV)',
      'NV-MOCK-ALL',
      'Cơ sở dữ liệu nhân sự',
      'Dữ liệu nhân viên mẫu demo',
      'Sẵn sàng vận hành chính thức',
      `Quản trị viên ${currentUser.name} đã dọn dẹp toàn bộ 13 cán bộ mẫu thử nghiệm để chính thức triển khai sử dụng hệ thống.`
    );
  };

  // Xóa văn bản quyết định (Admin - Toàn quyền)
  const handleDeleteDecision = (decisionId: string) => {
    const target = decisions.find(d => d.id === decisionId);
    if (!target) return;
    setDecisions(prev => prev.filter(d => d.id !== decisionId));
    addAuditLog(
      'XÓA_QUYẾT_ĐỊNH',
      target.number,
      'Văn bản quyết định',
      'Sổ quyết định',
      target.title,
      'Đã xóa khỏi hệ thống',
      `Quản trị viên ${currentUser.name} đã xóa văn bản quyết định số: ${target.number} (${target.title})`
    );
  };

  // Tải lại trực tiếp toàn bộ dữ liệu nhân sự & phòng ban từ Google Sheets CSDL
  const handleRefreshFromSheets = async () => {
    try {
      setIsRefreshingSheets(true);

      // Kiểm tra hoặc kết nối tài khoản Google
      if (!googleConnected) {
        await handleLoginGoogle();
      }

      const savedSheetId = GoogleSheetsService.getSavedSpreadsheetId();
      const [sheetEmployees, sheetDepts] = await Promise.all([
        GoogleSheetsService.loadEmployeesFromSheets(savedSheetId || undefined),
        GoogleSheetsService.loadDepartmentsFromSheets(savedSheetId || undefined).catch(() => []),
      ]);

      if (sheetEmployees && sheetEmployees.length > 0) {
        const unique = deduplicateEmployees(sheetEmployees);
        setEmployees(unique);
        localStorage.setItem('ccty_employees', JSON.stringify(unique));
        localStorage.removeItem('ccty_is_mock_cleared');

        if (sheetDepts && sheetDepts.length > 0) {
          setDepartments(sheetDepts);
          localStorage.setItem('ccty_departments', JSON.stringify(sheetDepts));
        }

        const ccCount = unique.filter(e => e.staffType === 'Công chức').length;
        const vcCount = unique.filter(e => e.staffType === 'Viên chức').length;

        addAuditLog(
          'TẢI_LẠI_TỪ_SHEETS',
          'Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự',
          'DS_NhanSu',
          'Cơ sở dữ liệu nhân sự',
          '',
          `${unique.length} cán bộ hợp lệ`,
          `Đã tải ${unique.length} cán bộ (${ccCount} Công chức, ${vcCount} Viên chức) và ${sheetDepts?.length || 0} phòng/trạm từ Google Sheets.`
        );

        alert(`🎉 ĐÃ ĐỒNG BỘ THÀNH CÔNG LÊN ỨNG DỤNG!\n\nĐã nạp ${unique.length} cán bộ thực tế từ Google Sheets:\n- ${ccCount} Công chức\n- ${vcCount} Viên chức\n- ${unique.length - ccCount - vcCount} Nhân sự khác\n\nToàn bộ biểu đồ 3D và danh sách nhân sự đã được cập nhật chuẩn xác theo bảng tính.`);
      } else {
        // Tự động mở Trung Tâm Đồng Bộ để người dùng chọn bảng tính hoặc dán link
        setIsSheetsModalOpen(true);
      }
    } catch (err: any) {
      console.warn('Lỗi tải từ Google Sheets:', err);
      // Mở Trung Tâm Đồng Bộ để hiển thị công cụ chẩn đoán
      setIsSheetsModalOpen(true);
    } finally {
      setIsRefreshingSheets(false);
    }
  };

  // Bỏ toàn bộ dữ liệu giả lập có sẵn của hệ thống, chỉ dùng dữ liệu thực tế do người dùng đưa vào
  const handleClearMockData = () => {
    localStorage.setItem('ccty_is_mock_cleared', 'true');
    localStorage.removeItem('ccty_employees');
    QuarterlyTaxService.clearOtherIncomes();
    MonthlyPayrollService.clearSavedPeriods();
    setEmployees([]);
    setSelectedEmployee(null);

    addAuditLog(
      'XÓA_DỮ_LIỆU_GIẢ_LẬP',
      'Toàn Chi cục',
      'Hệ thống CSDL',
      'Dữ liệu giả lập hệ thống',
      'Đã xóa toàn bộ',
      'Chỉ dùng dữ liệu nhập / nạp thực tế',
      `Đã xóa sạch toàn bộ dữ liệu giả lập có sẵn của hệ thống theo yêu cầu người dùng.`
    );
  };

  // Tự động tải dữ liệu nhân sự từ Google Sheets khi kết nối Google mà danh sách trên máy đang trống (chỉ khi người dùng chưa chọn xóa sạch dữ liệu)
  useEffect(() => {
    const isMockCleared = localStorage.getItem('ccty_is_mock_cleared') === 'true';
    if (googleConnected && employees.length === 0 && !isRefreshingSheets && !isMockCleared) {
      handleRefreshFromSheets();
    }
  }, [googleConnected, employees.length]);

  // Thêm hoặc Cập nhật Nhân sự
  const handleSaveEmployee = (empData: Employee, isEdit: boolean) => {
    if (isEdit) {
      const oldEmp = employees.find(e => e.id === empData.id);
      setEmployees(prev => prev.map(e => (e.id === empData.id ? empData : e)));
      addAuditLog(
        'CẬP_NHẬT_HỒ_SƠ',
        empData.fullName,
        empData.code,
        'Hồ sơ nhân sự',
        oldEmp ? `${oldEmp.positionTitle} - ${oldEmp.departmentName}` : '',
        `${empData.positionTitle} - ${empData.departmentName}`,
        `Cập nhật chi tiết hồ sơ cán bộ bởi ${currentUser.name}`
      );
    } else {
      setEmployees(prev => [empData, ...prev]);
      addAuditLog(
        'THÊM_MỚI_NHÂN_SỰ',
        empData.fullName,
        empData.code,
        'Tạo mới hồ sơ',
        'Chưa có',
        'Đang công tác',
        `Tiếp nhận và lập mã hồ sơ điện tử mới: ${empData.code} (${empData.fullName})`
      );
    }

    setEditingEmployee(null);
    setIsAddModalOpen(false);
  };

  // Cập nhật hồ sơ từ Modal Chi tiết
  const handleUpdateEmployeeProfile = (
    updated: Employee,
    auditChange: { field: string; oldVal: string; newVal: string; details: string }
  ) => {
    setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
    setSelectedEmployee(updated);
    addAuditLog(
      'CẬP_NHẬT_HỒ_SƠ',
      updated.fullName,
      updated.code,
      auditChange.field,
      auditChange.oldVal,
      auditChange.newVal,
      auditChange.details
    );
  };

  // Nhập & Điền dữ liệu cán bộ từ Excel / Drive
  const handleImportEmployees = async (
    importedEmployees: Employee[],
    mode: 'UPSERT' | 'REPLACE',
    syncToSheets: boolean = true
  ): Promise<{ success: boolean; spreadsheetUrl?: string; totalEmployees: number }> => {
    let finalEmployees: Employee[] = [];
    if (mode === 'REPLACE') {
      finalEmployees = importedEmployees;
      setEmployees(finalEmployees);
    } else {
      setEmployees(prev => {
        const empMap = new Map<string, Employee>();
        prev.forEach(e => empMap.set(e.code, e));
        importedEmployees.forEach(newEmp => {
          // Khóa chính là Mã Nhân Viên (Cột "Họ Và Tên" ĐƯỢC PHÉP TRÙNG TÊN)
          const existingKey = Array.from(empMap.keys()).find(k => {
            const item = empMap.get(k);
            if (!item) return false;
            // Khớp theo mã nhân viên (Primary key)
            if (item.code && newEmp.code && item.code.trim().toUpperCase() === newEmp.code.trim().toUpperCase()) return true;
            // Khớp CCCD nếu cả 2 bên đều có CCCD hợp lệ (từ 9 số trở lên) và trùng khớp
            if (item.cccd && newEmp.cccd && item.cccd.trim().length >= 9 && item.cccd.trim() === newEmp.cccd.trim()) return true;
            return false;
          });
          if (existingKey) {
            const old = empMap.get(existingKey)!;
            empMap.set(existingKey, {
              ...old,
              ...newEmp,
              id: old.id,
              code: old.code || newEmp.code,
              workHistory: newEmp.workHistory && newEmp.workHistory.length > 0 ? newEmp.workHistory : old.workHistory,
              salaryHistory: newEmp.salaryHistory && newEmp.salaryHistory.length > 0 ? newEmp.salaryHistory : old.salaryHistory,
            });
          } else {
            empMap.set(newEmp.code, newEmp);
          }
        });
        finalEmployees = Array.from(empMap.values());
        return finalEmployees;
      });
    }

    // Tự động chuyển màn hình sang tab danh sách nhân sự để thấy ngay dữ liệu mới
    setCurrentTab('staff');

    let spreadsheetUrl: string | undefined;

    // Tự động đồng bộ và đẩy dữ liệu lên Google Sheets "Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự"
    if (syncToSheets && googleConnected) {
      try {
        const sheet = await GoogleSheetsService.getOrCreateSpreadsheet();
        spreadsheetUrl = sheet.url;
        const targetList = finalEmployees.length > 0 ? finalEmployees : importedEmployees;
        await GoogleSheetsService.syncAllDataToSheets(
          sheet.id,
          targetList,
          auditLogs,
          departments
        );
        addAuditLog(
          'ĐỒNG_BỘ_GOOGLE_SHEETS',
          `Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự`,
          sheet.id,
          'Toàn bộ bảng tính Google Sheets',
          undefined,
          undefined,
          `Đã cập nhật tự động toàn bộ dữ liệu nhân sự (${targetList.length} cán bộ) vào Google Sheets sau khi nhập file.`
        );
      } catch (err: any) {
        console.error('Lỗi tự động đồng bộ Google Sheets:', err);
      }
    }

    return {
      success: true,
      spreadsheetUrl,
      totalEmployees: finalEmployees.length || importedEmployees.length,
    };
  };

  // Thực thi lệnh điều động / bổ nhiệm
  const handleExecuteMovement = (
    employeeId: string,
    newDepartmentId: string,
    newPosition: string,
    decisionNumber: string,
    effectiveDate: string,
    signedBy: string,
    notes: string
  ) => {
    const targetEmp = employees.find(e => e.id === employeeId);
    if (!targetEmp) return;

    const newDept = departments.find(d => d.id === newDepartmentId);
    const newDeptName = newDept ? newDept.name : 'Đơn vị mới';

    const oldDeptName = targetEmp.departmentName;
    const oldPosition = targetEmp.positionTitle;

    // Cập nhật lịch sử công tác
    const newHistoryItem = {
      id: `wh-${Date.now()}`,
      employeeId,
      startDate: effectiveDate,
      endDate: 'Nay',
      unitName: newDeptName,
      position: newPosition,
      decisionNumber,
      decisionDate: effectiveDate,
      signedBy,
      notes,
    };

    // Đóng dòng lịch sử trước đó nếu có
    const updatedHistory = targetEmp.workHistory.map(wh => {
      if (wh.endDate === 'Nay') {
        return { ...wh, endDate: effectiveDate };
      }
      return wh;
    });

    const updatedEmployee: Employee = {
      ...targetEmp,
      departmentId: newDepartmentId,
      departmentName: newDeptName,
      positionTitle: newPosition,
      workHistory: [newHistoryItem, ...updatedHistory],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setEmployees(prev => prev.map(e => (e.id === employeeId ? updatedEmployee : e)));

    // Thêm vào danh mục quyết định
    const newDec: Decision = {
      id: `dec-${Date.now()}`,
      number: decisionNumber,
      date: effectiveDate,
      type: 'Điều động',
      title: `Về việc điều động, bổ nhiệm cán bộ đối với ông/bà ${targetEmp.fullName}`,
      content: `Điều động ông/bà ${targetEmp.fullName} từ ${oldDeptName} sang ${newDeptName}, giữ chức vụ ${newPosition}.`,
      signLevel: signedBy,
      effectiveDate,
      employeeIds: [targetEmp.id],
      employeeNames: [targetEmp.fullName],
      notes,
    };
    setDecisions(prev => [newDec, ...prev]);

    addAuditLog(
      'ĐIỀU_ĐỘNG_BỔ_NHIỆM',
      targetEmp.fullName,
      targetEmp.code,
      'Đơn vị & Chức vụ',
      `${oldDeptName} (${oldPosition})`,
      `${newDeptName} (${newPosition})`,
      `Quyết định số ${decisionNumber} do ${signedBy} ký ngày ${effectiveDate}`
    );
  };

  // Nâng lương
  const handleRaiseSalary = (
    employeeId: string,
    nextStep: number,
    nextCoeff: number,
    decisionNumber: string
  ) => {
    const targetEmp = employees.find(e => e.id === employeeId);
    if (!targetEmp) return;

    const oldStep = targetEmp.salary.step;
    const oldCoeff = targetEmp.salary.coefficient;
    const effectiveDate = new Date().toISOString().split('T')[0];

    const updatedEmp: Employee = {
      ...targetEmp,
      salary: {
        ...targetEmp.salary,
        step: nextStep,
        coefficient: nextCoeff,
        effectiveDate,
        nextSalaryIncreaseDate: '2029-01-01',
      },
      salaryHistory: [
        {
          id: `sh-${Date.now()}`,
          employeeId,
          step: nextStep,
          coefficient: nextCoeff,
          effectiveDate,
          decisionNumber,
          decisionDate: effectiveDate,
          type: 'Định kỳ',
          notes: 'Nâng bậc lương thường xuyên',
        },
        ...targetEmp.salaryHistory,
      ],
      updatedAt: effectiveDate,
    };

    setEmployees(prev => prev.map(e => (e.id === employeeId ? updatedEmp : e)));

    addAuditLog(
      'NÂNG_BẬC_LƯƠNG',
      targetEmp.fullName,
      targetEmp.code,
      'Bậc lương & Hệ số',
      `Bậc ${oldStep} (${oldCoeff})`,
      `Bậc ${nextStep} (${nextCoeff})`,
      `Theo Quyết định nâng lương thường xuyên số ${decisionNumber}`
    );
  };

  // Quản lý Danh mục Phòng / Đơn vị (Thêm, Sửa, Xóa, Khôi phục)
  const handleAddDepartment = (newDept: Department) => {
    setDepartments(prev => [...prev, newDept]);
    addAuditLog(
      'THÊM_ĐƠN_VỊ',
      newDept.name,
      newDept.code,
      'Danh mục Phòng/Đơn vị',
      '',
      newDept.name,
      `Thêm mới đơn vị "${newDept.name}" (${newDept.code}) vào cơ cấu tổ chức Chi cục`
    );
  };

  const handleUpdateDepartment = (updatedDept: Department, oldId?: string) => {
    const targetId = oldId || updatedDept.id;
    setDepartments(prev => prev.map(d => d.id === targetId ? updatedDept : d));

    // Đồng bộ tên và mã phòng ban cho các nhân sự thuộc đơn vị này nếu thay đổi
    setEmployees(prev => prev.map(emp => {
      if (emp.departmentId === targetId) {
        return {
          ...emp,
          departmentId: updatedDept.id,
          departmentName: updatedDept.name,
        };
      }
      return emp;
    }));

    addAuditLog(
      'CẬP_NHẬT_ĐƠN_VỊ',
      updatedDept.name,
      updatedDept.code,
      'Thông tin Phòng/Đơn vị',
      oldId && oldId !== updatedDept.id ? `Mã cũ: ${oldId}` : '',
      updatedDept.name,
      `Cập nhật thông tin phòng/đơn vị "${updatedDept.name}" (${updatedDept.code})`
    );
  };

  const handleDeleteDepartment = (deptId: string, reassignDeptId?: string) => {
    const targetDept = departments.find(d => d.id === deptId);
    const reassignDept = departments.find(d => d.id === reassignDeptId);

    // Nếu có nhân sự và có đơn vị chuyển tiếp
    if (reassignDeptId && reassignDept) {
      setEmployees(prev => prev.map(emp => {
        if (emp.departmentId === deptId) {
          return {
            ...emp,
            departmentId: reassignDept.id,
            departmentName: reassignDept.name,
          };
        }
        return emp;
      }));
    }

    setDepartments(prev => prev.filter(d => d.id !== deptId));

    addAuditLog(
      'XÓA_ĐƠN_VỊ',
      targetDept?.name || deptId,
      targetDept?.code || deptId,
      'Danh mục Phòng/Đơn vị',
      targetDept?.name || '',
      'Đã xóa khỏi hệ thống',
      `Xóa phòng/đơn vị "${targetDept?.name || deptId}". ${
        reassignDept ? `Đã điều chuyển nhân sự sang đơn vị mới: ${reassignDept.name}` : ''
      }`
    );
  };

  const handleResetDepartments = () => {
    setDepartments(INITIAL_DEPARTMENTS);
    localStorage.setItem('ccty_dept_version', 'v2_23depts');
    localStorage.setItem('ccty_departments', JSON.stringify(INITIAL_DEPARTMENTS));
    addAuditLog(
      'KHÔI_PHỤC_DANH_MỤC_ĐƠN_VỊ',
      'Chi cục Chăn nuôi & Thú y',
      'BLD',
      'Danh mục Phòng/Đơn vị',
      '',
      '23 đơn vị chuẩn',
      'Khôi phục danh mục 23 phòng, đơn vị trực thuộc theo danh sách cập nhật'
    );
  };

  // Tính các số liệu cảnh báo
  const pendingRetirementsCount = employees.filter(e => {
    if (e.status !== 'Đang công tác') return false;
    const birthYear = parseInt(e.dob.split('-')[0], 10);
    const age = 2026 - birthYear;
    return (e.gender === 'Nam' && age >= 61) || (e.gender === 'Nữ' && age >= 56);
  }).length;

  const pendingSalaryRaisesCount = employees.filter(e => {
    return e.status === 'Đang công tác' && e.salary.nextSalaryIncreaseDate && e.salary.nextSalaryIncreaseDate.includes('2026');
  }).length;

  // LỚP ĐĂNG NHẬP & CẤP QUYỀN BẢO VỆ ỨNG DỤNG
  // Nếu chưa đăng nhập Google hoặc chưa được Quản trị viên cấp quyền trong Trang tính1
  if (!googleConnected || !accessStatus?.isAllowed) {
    return (
      <AppLoginGate
        onLoginGoogle={handleLoginGoogle}
        onLogoutGoogle={handleLogoutGoogle}
        googleConnected={googleConnected}
        googleUserEmail={googleUserEmail}
        isCheckingAccess={isCheckingAccess}
        accessStatus={accessStatus}
        onRefreshPermission={() => checkAccessPermission(googleUserEmail)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 antialiased selection:bg-sky-500 selection:text-white">
      {/* Header with Administrative Identity, Search, Google status, User switcher */}
      <Header
        currentUser={currentUser}
        onSwitchUser={setCurrentUser}
        availableUsers={users}
        googleConnected={googleConnected}
        googleUserEmail={googleUserEmail}
        onLoginGoogle={handleLoginGoogle}
        onLogoutGoogle={handleLogoutGoogle}
        onOpenSyncSheets={() => setIsSheetsModalOpen(true)}
        onOpenDriveModal={() => setCurrentTab('drive-storage')}
        onOpenExcelImportModal={() => setIsExcelImportModalOpen(true)}
        employees={employees}
        onSelectEmployee={setSelectedEmployee}
        onNavigateTab={setCurrentTab}
      />

      {/* Main Workspace layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          userRole={currentUser.role}
          pendingRetirementsCount={pendingRetirementsCount}
          pendingSalaryRaisesCount={pendingSalaryRaisesCount}
          departmentCount={departments.length}
        />

        {/* Dynamic Content View */}
        <main className="flex-1 overflow-y-auto bg-slate-50 min-h-[calc(100vh-104px)]">
          {currentTab === 'dashboard' && (
            <DashboardView
              employees={employees}
              departments={departments}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenSyncSheets={() => setIsSheetsModalOpen(true)}
              onOpenDriveModal={() => setCurrentTab('drive-storage')}
              onOpenExcelImportModal={() => setIsExcelImportModalOpen(true)}
              onSelectEmployee={setSelectedEmployee}
              onNavigateTab={setCurrentTab}
              onFilterStaffType={handleFilterStaffTypeFromDashboard}
            />
          )}

          {currentTab === 'departments' && (
            <DepartmentManagementView
              departments={departments}
              employees={employees}
              currentUser={currentUser}
              onAddDepartment={handleAddDepartment}
              onUpdateDepartment={handleUpdateDepartment}
              onDeleteDepartment={handleDeleteDepartment}
              onResetDepartments={handleResetDepartments}
              onViewDepartmentStaff={(deptId) => {
                setCurrentTab('staff');
              }}
            />
          )}

          {currentTab === 'staff' && (
            <EmployeeListView
              employees={employees}
              departments={departments}
              currentUser={currentUser}
              onSelectEmployee={setSelectedEmployee}
              onEditEmployee={(emp) => setEditingEmployee(emp)}
              onDeleteEmployee={handleDeleteEmployee}
              onClearAllMockEmployees={handleClearAllMockEmployees}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onOpenMovementModal={(emp) => {
                setSelectedEmployee(emp);
                setCurrentTab('work-history');
              }}
              onOpenSyncSheets={() => setIsSheetsModalOpen(true)}
              onOpenExcelImportModal={() => setIsExcelImportModalOpen(true)}
              initialStaffTypeFilter={staffTypeFilter}
              onRefreshFromSheets={handleRefreshFromSheets}
              isRefreshingSheets={isRefreshingSheets}
            />
          )}

          {currentTab === 'organization' && (
            <OrganizationTreeView
              departments={departments}
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
              onFilterByDepartment={(deptId) => {
                setCurrentTab('staff');
              }}
              onManageDepartments={() => setCurrentTab('departments')}
              onOpenAddEmployee={() => setIsAddModalOpen(true)}
              onOpenAddDepartment={() => setCurrentTab('departments')}
            />
          )}

          {currentTab === 'work-history' && (
            <WorkHistoryMovementView
              employees={employees}
              departments={departments}
              onExecuteMovement={handleExecuteMovement}
              onSelectEmployee={setSelectedEmployee}
              initialEmployeeId={selectedEmployee?.id}
            />
          )}

          {currentTab === 'salary' && (
            <SalaryManagementView
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
              onRaiseSalary={handleRaiseSalary}
              onNavigateToMonthlyPayroll={() => setCurrentTab('monthly-payroll')}
            />
          )}

          {currentTab === 'monthly-payroll' && (
            <MonthlyPayrollView
              employees={employees}
              departments={departments}
              googleConnected={googleConnected}
              onLoginGoogle={handleLoginGoogle}
              onSelectEmployee={setSelectedEmployee}
              onNavigateToQuarterlyTax={() => setCurrentTab('quarterly-tax')}
              onRefreshFromSheets={handleRefreshFromSheets}
              isRefreshingSheets={isRefreshingSheets}
              onOpenSyncSheets={() => setIsSheetsModalOpen(true)}
              onResetMockData={handleClearMockData}
            />
          )}

          {currentTab === 'quarterly-tax' && (
            <QuarterlyTaxView
              employees={employees}
              departments={departments}
              googleConnected={googleConnected}
              onLoginGoogle={handleLoginGoogle}
              onSelectEmployee={setSelectedEmployee}
              onNavigateToMonthlyPayroll={() => setCurrentTab('monthly-payroll')}
            />
          )}

          {currentTab === 'training' && (
            <TrainingManagementView
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
            />
          )}

          {currentTab === 'reward-discipline' && (
            <RewardDisciplineView
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
            />
          )}

          {currentTab === 'decisions' && (
            <DecisionsView
              decisions={decisions}
              googleConnected={googleConnected}
              onUpdateDecision={(updated) => {
                setDecisions(prev => prev.map(d => d.id === updated.id ? updated : d));
                addAuditLog(
                  'CẬP_NHẬT_QUYẾT_ĐỊNH',
                  updated.number,
                  'Văn bản',
                  'Đính kèm PDF',
                  '',
                  updated.title,
                  `Đính kèm tệp PDF cho quyết định: ${updated.number}`
                );
              }}
              onAddDecision={(dec) => {
                setDecisions(prev => [dec, ...prev]);
                addAuditLog(
                  'THÊM_QUYẾT_ĐỊNH',
                  dec.number,
                  'Văn bản',
                  'Sổ quyết định',
                  '',
                  dec.title,
                  `Vào sổ quyết định: ${dec.number}${dec.driveViewLink || dec.fileUrl ? ' (Có đính kèm file PDF)' : ''}`
                );
              }}
            />
          )}

          {currentTab === 'drive-storage' && (
            <DriveStorageView
              googleConnected={googleConnected}
              googleUserEmail={googleUserEmail}
              onLoginGoogle={handleLoginGoogle}
              employees={employees}
              departments={departments}
              onSelectEmployee={(emp) => setSelectedEmployee(emp)}
              onOpenQuickSearchModal={() => setIsQuickSearchModalOpen(true)}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              employees={employees}
              departments={departments}
            />
          )}

          {currentTab === 'warnings' && (
            <WarningsView
              employees={employees}
              onSelectEmployee={setSelectedEmployee}
            />
          )}

          {currentTab === 'audit-log' && (
            <AuditLogView logs={auditLogs} />
          )}

          {currentTab === 'admin' && (
            <PermissionsView
              users={users}
              currentUser={currentUser}
              departments={departments}
              onSwitchUser={setCurrentUser}
            />
          )}

          {currentTab === 'auth-permissions' && (
            <AuthPermissionManagementView
              departments={departments}
              currentUserEmail={googleUserEmail}
              onAddAuditLog={addAuditLog}
            />
          )}
        </main>
      </div>

      {/* Profile Detail Modal */}
      {selectedEmployee && (
        <EmployeeProfileModal
          employee={selectedEmployee}
          employees={employees}
          onSelectEmployee={setSelectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdateEmployee={handleUpdateEmployeeProfile}
          onDeleteEmployee={handleDeleteEmployee}
          currentUser={currentUser}
          googleConnected={googleConnected}
          rootStaffFolderId={rootStaffFolderId}
        />
      )}

      {/* Add / Edit Employee Modal */}
      {(isAddModalOpen || editingEmployee) && (
        <EmployeeFormModal
          initialData={editingEmployee}
          departments={departments}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingEmployee(null);
          }}
          onSave={handleSaveEmployee}
          existingEmployeesCount={employees.length}
        />
      )}

      {/* Sheets Sync Modal - Trung tâm đồng bộ dữ liệu */}
      <SheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        googleConnected={googleConnected}
        googleUserEmail={googleUserEmail}
        onLoginGoogle={handleLoginGoogle}
        employees={employees}
        departments={departments}
        decisions={decisions}
        auditLogs={auditLogs}
        onLogSyncAction={(details) => {
          addAuditLog(
            'ĐỒNG_BỘ_DỮ_LIỆU',
            'Toàn Chi cục',
            'Cơ sở dữ liệu',
            'Hệ thống CSDL & Web App',
            'Chưa đồng bộ',
            'Đã đồng bộ',
            details
          );
        }}
        onUpdateEmployees={(newEmps) => {
          setEmployees(newEmps);
          localStorage.setItem('ccty_employees', JSON.stringify(newEmps));
        }}
        onUpdateDepartments={(newDepts) => {
          setDepartments(newDepts);
          localStorage.setItem('ccty_departments', JSON.stringify(newDepts));
        }}
        onUpdateDecisions={(newDecs) => {
          setDecisions(newDecs);
          localStorage.setItem('ccty_decisions', JSON.stringify(newDecs));
        }}
        onClearMockData={handleClearMockData}
      />

      {/* Drive Excel Import Modal for BANG LUONG TOAN CHI CUC .xlsx & sheet DM NHAN VIEN */}
      <DriveExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        googleConnected={googleConnected}
        googleUserEmail={googleUserEmail}
        onLoginGoogle={handleLoginGoogle}
        departments={departments}
        currentEmployees={employees}
        onImportEmployees={handleImportEmployees}
        onAddAuditLog={addAuditLog}
      />
    </div>
  );
}
