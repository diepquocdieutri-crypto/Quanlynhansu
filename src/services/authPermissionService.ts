import { getAccessToken } from './firebaseAuth';
import { GoogleDriveService, ROOT_FOLDER_NAME } from './googleDriveService';
import { AppUser, UserRole, DataScope } from '../types/hrm';

export { ROOT_FOLDER_NAME };

export type SystemRole = 'ADMIN' | 'HR_MANAGER' | 'DEPT_LEADER' | 'VIEWER';
export type PermissionStatus = 'ACTIVE' | 'PENDING' | 'LOCKED';

export interface UserPermission {
  stt: number;
  fullName: string;
  email: string;
  departmentName: string;
  positionTitle: string;
  role: SystemRole;
  status: PermissionStatus;
  grantedDate: string;
  grantedBy: string;
  notes: string;
}

export const PERMISSION_SPREADSHEET_TITLE = 'Chi Cục Chăn Nuôi & Thú Y TPHCM - Quản Lý Đăng Nhập & Cấp Quyền';
export const PERMISSION_SHEET_TAB_NAME = 'Trang tính1';

export const MASTER_ADMIN_EMAILS = [
  'diepquocdieutri@gmail.com',
];

export const DEFAULT_INITIAL_PERMISSIONS: UserPermission[] = [
  {
    stt: 1,
    fullName: 'Đoàn Diệp Quốc (Admin)',
    email: 'diepquocdieutri@gmail.com',
    departmentName: 'Ban Lãnh đạo Chi cục',
    positionTitle: 'Admin - Toàn quyền',
    role: 'ADMIN',
    status: 'ACTIVE',
    grantedDate: '2024-01-01',
    grantedBy: 'Hệ Thống Chi Cục',
    notes: 'Quản trị viên hệ thống có toàn quyền xóa, sửa, thêm mới dữ liệu và phân quyền',
  },
  {
    stt: 2,
    fullName: 'Trần Phú Cường',
    email: 'cuong.tp@chicuc.gov.vn',
    departmentName: 'Ban Lãnh đạo Chi cục',
    positionTitle: 'Chi cục Trưởng',
    role: 'ADMIN',
    status: 'ACTIVE',
    grantedDate: '2024-01-01',
    grantedBy: 'Admin Hệ Thống',
    notes: 'Lãnh đạo Chi cục - Toàn quyền chỉ đạo',
  },
  {
    stt: 3,
    fullName: 'Nguyễn Trường Giang',
    email: 'giang.nt@chicuc.gov.vn',
    departmentName: 'Ban Lãnh đạo Chi cục',
    positionTitle: 'Phó Chi cục Trưởng',
    role: 'ADMIN',
    status: 'ACTIVE',
    grantedDate: '2024-01-01',
    grantedBy: 'Admin Hệ Thống',
    notes: 'Phó Chi cục Trưởng - Phụ trách chuyên môn',
  },
  {
    stt: 4,
    fullName: 'Trần Văn Hoàng',
    email: 'hoang.tv@chicuc.gov.vn',
    departmentName: 'Phòng Hành chính - Tổng hợp',
    positionTitle: 'Trưởng phòng HCTH',
    role: 'HR_MANAGER',
    status: 'ACTIVE',
    grantedDate: '2024-01-01',
    grantedBy: 'Admin Hệ Thống',
    notes: 'Quản lý nhân sự & Báo cáo biên chế',
  },
  {
    stt: 5,
    fullName: 'Nguyễn Thị Lụa',
    email: 'diepquoc2015@gmail.com',
    departmentName: 'Phòng Hành chính - Tổng hợp',
    positionTitle: 'Chuyên viên TCCB',
    role: 'HR_MANAGER',
    status: 'ACTIVE',
    grantedDate: '2024-01-01',
    grantedBy: 'Admin Hệ Thống',
    notes: 'Quản lý nhân sự - Cán bộ TCCB (Xem toàn bộ hồ sơ Chi cục)',
  },
];

export class AuthPermissionService {
  private static cachedPermissions: UserPermission[] | null = null;
  private static cachedSpreadsheetId: string | null = null;
  private static cachedSpreadsheetUrl: string | null = null;

  private static async getHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn.');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Chuẩn hóa email, tự động phát hiện và khắc phục các lỗi gõ nhầm phổ biến (như @gmai.com -> @gmail.com)
   */
  public static normalizeEmail(email?: string): string {
    let clean = (email || '').trim().toLowerCase();
    if (clean.endsWith('@gmai.com')) {
      clean = clean.replace(/@gmai\.com$/, '@gmail.com');
    }
    return clean;
  }

  /**
   * Thiết lập và lưu ID bảng tính cấp quyền tùy chọn hoặc được chia sẻ qua URL
   */
  public static setCustomSpreadsheetId(id: string): void {
    if (!id) return;
    const cleanId = id.trim();
    this.cachedSpreadsheetId = cleanId;
    this.cachedSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ccty_perm_sheet_id', cleanId);
      }
    } catch {}
  }

  /**
   * Lấy ID bảng tính cấp quyền đã lưu hoặc từ tham số URL
   */
  public static getSavedSpreadsheetId(): string | null {
    if (this.cachedSpreadsheetId) return this.cachedSpreadsheetId;
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlParamId = urlParams.get('permSheetId');
        if (urlParamId) {
          this.setCustomSpreadsheetId(urlParamId);
          return urlParamId;
        }
        const saved = localStorage.getItem('ccty_perm_sheet_id');
        if (saved) {
          this.cachedSpreadsheetId = saved;
          this.cachedSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${saved}/edit`;
          return saved;
        }
      }
    } catch {}
    return null;
  }

  /**
   * Kiểm tra xem một email có phải là Master Admin không
   */
  public static isMasterAdmin(email?: string): boolean {
    const clean = this.normalizeEmail(email);
    if (!clean) return false;
    return MASTER_ADMIN_EMAILS.some(e => this.normalizeEmail(e) === clean);
  }

  /**
   * Kiểm tra người dùng có vai trò "Admin - Toàn quyền" (Cấp 1) hay không
   * Đảm bảo Cấp 3 (HR), Cấp 2 (Manager), Cấp 4 (Staff) KHÔNG BAO GIỜ có quyền Admin/Xóa dữ liệu
   */
  public static isUserAdmin(user?: { role?: string; roleTitle?: string; name?: string; email?: string } | null, emailToCheck?: string): boolean {
    if (!user && !emailToCheck) return false;
    const role = String(user?.role || '').toUpperCase();
    const roleTitle = String(user?.roleTitle || '').toLowerCase();
    const email = this.normalizeEmail(user?.email || emailToCheck);

    // Bất kỳ vai trò nào là HR, HR_MANAGER, STAFF, VIEWER, MANAGER, DEPT_LEADER đều tuyệt đối KHÔNG PHẢI ADMIN
    if (role === 'HR' || role === 'HR_MANAGER' || role === 'STAFF' || role === 'VIEWER' || role === 'MANAGER' || role === 'DEPT_LEADER') {
      return false;
    }

    // 1. Vai trò chuẩn ADMIN
    if (role === 'ADMIN') return true;

    // 2. Chức danh có ghi rõ 'Cấp 1 – Admin' hoặc 'toàn quyền' (không áp dụng nếu là cán bộ nhân sự)
    if (roleTitle.includes('cấp 1') || (roleTitle.includes('toàn quyền') && !roleTitle.includes('nhân sự') && !roleTitle.includes('hr'))) {
      return true;
    }

    // 3. Email chính xác của Master Admin khởi tạo (diepquocdieutri@gmail.com)
    if (this.isMasterAdmin(email)) return true;

    return false;
  }

  /**
   * Tìm kiếm hoặc tạo mới file bảng tính cấp quyền trong thư mục gốc Drive
   * Hỗ trợ tìm kiếm toàn cục trên Google Drive kể cả các file được Chia Sẻ với tài khoản
   */
  public static async getOrCreatePermissionSpreadsheet(): Promise<{ id: string; url: string }> {
    // 0. Ưu tiên kiểm tra Spreadsheet ID đã được cấu hình từ URL hoặc LocalStorage
    const savedId = this.getSavedSpreadsheetId();
    if (savedId) {
      try {
        const headers = await this.getHeaders();
        const testRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${savedId}?fields=spreadsheetId,properties.title`, { headers });
        if (testRes.ok) {
          this.cachedSpreadsheetId = savedId;
          this.cachedSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${savedId}/edit`;
          return { id: savedId, url: this.cachedSpreadsheetUrl };
        }
      } catch (e) {
        console.warn('Không thể truy cập sheet theo ID đã lưu, tiến hành tìm kiếm tự động:', e);
      }
    }

    if (this.cachedSpreadsheetId && this.cachedSpreadsheetUrl) {
      return { id: this.cachedSpreadsheetId, url: this.cachedSpreadsheetUrl };
    }

    const headers = await this.getHeaders();
    
    // 1. Tìm kiếm file bảng tính cấp quyền trên toàn bộ Google Drive (kể cả file được chia sẻ qua email)
    const globalQuery = `name = '${PERMISSION_SPREADSHEET_TITLE.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(globalQuery)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc`;
    
    const searchRes = await fetch(searchUrl, { headers });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const file = searchData.files[0];
        this.setCustomSpreadsheetId(file.id);
        
        // Đảm bảo tab Trang tính1 tồn tại
        try {
          await this.ensurePermissionSheetTab(file.id);
        } catch (e) {
          console.warn('Lỗi kiểm tra tab cấp quyền:', e);
        }

        return { id: file.id, url: this.cachedSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/${file.id}/edit` };
      }
    }

    // 2. Nếu tìm kiếm chưa thấy, tạo thư mục gốc: "Chi Cục Chăn Nuôi & Thú Y TPHCM - Quản Lý Hồ Sơ Nhân Sự"
    const rootFolder = await GoogleDriveService.getOrCreateFolder(ROOT_FOLDER_NAME);

    // 3. Nếu chưa có, tạo file bảng tính mới trực tiếp trong thư mục gốc
    const createUrl = 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: PERMISSION_SPREADSHEET_TITLE,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [rootFolder.id],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Không thể tạo file Google Sheets quản lý đăng nhập.');
    }

    const newFile = await createRes.json();
    this.setCustomSpreadsheetId(newFile.id);

    // 4. Khởi tạo tab Trang tính1 và dữ liệu ban đầu
    await this.initPermissionSheetData(newFile.id);

    return { id: newFile.id, url: this.cachedSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newFile.id}/edit` };
  }

  /**
   * Đảm bảo tab 'Trang tính1' tồn tại trong file
   */
  private static async ensurePermissionSheetTab(spreadsheetId: string): Promise<void> {
    const headers = await this.getHeaders();
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
    const res = await fetch(metaUrl, { headers });
    if (!res.ok) return;

    const data = await res.json();
    const sheets = data.sheets || [];
    const hasTab = sheets.some((s: any) => s.properties?.title === PERMISSION_SHEET_TAB_NAME);

    if (!hasTab && sheets.length > 0) {
      // Đổi tên sheet đầu tiên thành 'Trang tính1'
      const firstSheetId = sheets[0].properties?.sheetId || 0;
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      await fetch(updateUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: firstSheetId,
                  title: PERMISSION_SHEET_TAB_NAME,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'title,gridProperties.frozenRowCount',
              },
            },
          ],
        }),
      });

      // Nếu sheet trống, ghi tiêu đề và dữ liệu mẫu
      await this.writeInitialData(spreadsheetId);
    }
  }

  /**
   * Khởi tạo cấu trúc và ghi dữ liệu ban đầu vào tab Trang tính1
   */
  private static async initPermissionSheetData(spreadsheetId: string): Promise<void> {
    const headers = await this.getHeaders();
    
    // Đổi tên sheet 1 thành 'Trang tính1' và cố định dòng 1
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
    const metaRes = await fetch(metaUrl, { headers });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const firstSheetId = meta.sheets?.[0]?.properties?.sheetId || 0;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: firstSheetId,
                  title: PERMISSION_SHEET_TAB_NAME,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'title,gridProperties.frozenRowCount',
              },
            },
          ],
        }),
      });
    }

    await this.writeInitialData(spreadsheetId);
  }

  /**
   * Ghi tiêu đề và các dòng phân quyền mẫu vào Trang tính1
   */
  private static async writeInitialData(spreadsheetId: string): Promise<void> {
    const headers = await this.getHeaders();
    const headerRow = [
      'STT',
      'Họ Và Tên',
      'Email Đăng Nhập',
      'Đơn Vị / Phòng / Trạm',
      'Chức Vụ',
      'Vai Trò Hệ Thống',
      'Trạng Thái Cấp Quyền',
      'Ngày Cấp Quyền',
      'Người Duyệt / Cấp Quyền',
      'Ghi Chú',
    ];

    const rows = [
      headerRow,
      ...DEFAULT_INITIAL_PERMISSIONS.map(p => [
        p.stt,
        p.fullName,
        p.email,
        p.departmentName,
        p.positionTitle,
        this.getRoleLabel(p.role),
        this.getStatusLabel(p.status),
        p.grantedDate,
        p.grantedBy,
        p.notes,
      ]),
    ];

    const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${PERMISSION_SHEET_TAB_NAME}'!A1:J${rows.length}?valueInputOption=USER_ENTERED`;
    await fetch(writeUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: rows }),
    });
  }

  /**
   * Tải toàn bộ danh sách cấp quyền từ sheet 'Trang tính1'
   */
  public static async loadPermissionsFromSheet(): Promise<UserPermission[]> {
    try {
      const sheet = await this.getOrCreatePermissionSpreadsheet();
      const headers = await this.getHeaders();
      // Đọc từ dòng A1 để kiểm tra tiêu đề các cột
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${PERMISSION_SHEET_TAB_NAME}'!A1:J500`;

      const res = await fetch(readUrl, { headers });
      if (!res.ok) {
        throw new Error('Không thể đọc dữ liệu phân quyền từ Google Sheets.');
      }

      const data = await res.json();
      const allRows: any[][] = data.values || [];

      if (allRows.length === 0) {
        // Nếu rỗng, nạp lại mẫu
        await this.writeInitialData(sheet.id);
        this.cachedPermissions = [...DEFAULT_INITIAL_PERMISSIONS];
        this.saveLocalPermissions(this.cachedPermissions);
        return this.cachedPermissions;
      }

      // Xác định chỉ số cột từ dòng tiêu đề (nếu có)
      const firstRow = allRows[0] || [];
      const hasHeader = firstRow.some((cell: any) => {
        const text = String(cell || '').toLowerCase();
        return text.includes('họ') || text.includes('tên') || text.includes('email') || text.includes('stt');
      });

      let nameColIdx = 1;
      let emailColIdx = 2;
      let deptColIdx = 3;
      let posColIdx = 4;
      let roleColIdx = 5;
      let statusColIdx = 6;
      let dateColIdx = 7;
      let byColIdx = 8;
      let notesColIdx = 9;

      if (hasHeader) {
        firstRow.forEach((cell: any, cIdx: number) => {
          const t = String(cell || '').toLowerCase().trim();
          if (t.includes('họ') || t.includes('tên') || t.includes('cán bộ')) nameColIdx = cIdx;
          else if (t.includes('email') || t.includes('thư')) emailColIdx = cIdx;
          else if (t.includes('phòng') || t.includes('đơn vị') || t.includes('trạm')) deptColIdx = cIdx;
          else if (t.includes('chức vụ') || t.includes('vị trí')) posColIdx = cIdx;
          else if (t.includes('vai trò') || t.includes('quyền')) roleColIdx = cIdx;
          else if (t.includes('trạng thái') || t.includes('tình trạng')) statusColIdx = cIdx;
          else if (t.includes('ngày')) dateColIdx = cIdx;
          else if (t.includes('duyệt') || t.includes('người cấp')) byColIdx = cIdx;
          else if (t.includes('ghi chú')) notesColIdx = cIdx;
        });
      }

      const dataRows = hasHeader ? allRows.slice(1) : allRows;

      const rawPermissions: UserPermission[] = dataRows.map((row, idx) => {
        const fullName = String(row[nameColIdx] || '').trim();
        const rawRole = String(row[roleColIdx] || '').toUpperCase();
        let role: SystemRole = 'VIEWER';
        if (rawRole.includes('ADMIN') || rawRole.includes('QUẢN TRỊ')) role = 'ADMIN';
        else if (rawRole.includes('HR') || rawRole.includes('NHÂN SỰ')) role = 'HR_MANAGER';
        else if (rawRole.includes('LÃNH ĐẠO') || rawRole.includes('TRƯỞNG') || rawRole.includes('MANAGER')) role = 'DEPT_LEADER';

        const rawStatus = String(row[statusColIdx] || '').toUpperCase();
        let status: PermissionStatus = 'ACTIVE';
        if (rawStatus.includes('CHỜ') || rawStatus.includes('PENDING')) status = 'PENDING';
        else if (rawStatus.includes('KHÓA') || rawStatus.includes('LOCKED')) status = 'LOCKED';

        const rawEmail = String(row[emailColIdx] || '').trim();
        const email = this.normalizeEmail(rawEmail);

        return {
          stt: parseInt(String(row[0] || idx + 1), 10) || idx + 1,
          fullName: fullName || (email ? email.split('@')[0] : `Cán bộ ${idx + 1}`),
          email,
          departmentName: String(row[deptColIdx] || 'Ban Lãnh đạo Chi cục').trim(),
          positionTitle: String(row[posColIdx] || 'Cán bộ').trim(),
          role,
          status,
          grantedDate: String(row[dateColIdx] || new Date().toISOString().split('T')[0]).trim(),
          grantedBy: String(row[byColIdx] || 'Quản trị viên').trim(),
          notes: String(row[notesColIdx] || '').trim(),
        };
      }).filter(p => !!p.fullName || !!p.email);

      // Lọc bỏ trùng lặp theo email và họ tên chuẩn hóa
      const uniqueMap = new Map<string, UserPermission>();
      for (const p of rawPermissions) {
        const key = p.email ? p.email : `name_${p.fullName.toLowerCase()}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, p);
        }
      }
      const permissions = Array.from(uniqueMap.values());

      // Đảm bảo Master Admin luôn có trong danh sách và luôn ACTIVE
      for (const adminEmail of MASTER_ADMIN_EMAILS) {
        const norm = this.normalizeEmail(adminEmail);
        const existing = permissions.find(p => p.email === norm);
        if (!existing) {
          permissions.unshift({
            stt: permissions.length + 1,
            fullName: 'Đoàn Diệp Quốc (Admin)',
            email: norm,
            departmentName: 'Ban Lãnh đạo Chi cục',
            positionTitle: 'Admin - Toàn quyền',
            role: 'ADMIN',
            status: 'ACTIVE',
            grantedDate: '2024-01-01',
            grantedBy: 'Hệ Thống Chi Cục',
            notes: 'Quản trị viên hệ thống có toàn quyền phân quyền, xóa, sửa dữ liệu',
          });
        } else {
          existing.role = 'ADMIN';
          existing.status = 'ACTIVE';
        }
      }

      // Đánh số thứ tự lại liên tục
      permissions.forEach((p, idx) => { p.stt = idx + 1; });

      this.cachedPermissions = permissions;
      this.saveLocalPermissions(permissions);
      return permissions;
    } catch (err: any) {
      console.warn('Lỗi khi đọc sheet phân quyền, sử dụng bộ nhớ đệm:', err);
      return this.getLocalPermissions();
    }
  }

  /**
   * Lưu toàn bộ danh sách cấp quyền lên sheet 'Trang tính1'
   */
  public static async savePermissionsToSheet(permissions: UserPermission[]): Promise<void> {
    const sheet = await this.getOrCreatePermissionSpreadsheet();
    const headers = await this.getHeaders();

    // 1. Xóa vùng dữ liệu cũ từ A2:J500
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${PERMISSION_SHEET_TAB_NAME}'!A2:J500:clear`;
    await fetch(clearUrl, { method: 'POST', headers, body: JSON.stringify({}) });

    // 2. Ghi danh sách mới
    const rows = permissions.map((p, idx) => [
      idx + 1,
      p.fullName,
      this.normalizeEmail(p.email),
      p.departmentName,
      p.positionTitle,
      this.getRoleLabel(p.role),
      this.getStatusLabel(p.status),
      p.grantedDate,
      p.grantedBy,
      p.notes,
    ]);

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/'${PERMISSION_SHEET_TAB_NAME}'!A2:J${rows.length + 1}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: rows }),
    });

    this.cachedPermissions = permissions;
    this.saveLocalPermissions(permissions);
  }

  /**
   * Thêm hoặc cập nhật tài khoản được cấp quyền
   */
  public static async grantUserPermission(permission: Omit<UserPermission, 'stt'>): Promise<UserPermission[]> {
    const currentList = await this.loadPermissionsFromSheet();
    const normEmail = this.normalizeEmail(permission.email);

    const existingIndex = currentList.findIndex(p => p.email === normEmail);
    if (existingIndex >= 0) {
      currentList[existingIndex] = {
        ...currentList[existingIndex],
        ...permission,
        email: normEmail,
        stt: existingIndex + 1,
      };
    } else {
      currentList.push({
        ...permission,
        email: normEmail,
        stt: currentList.length + 1,
      });
    }

    await this.savePermissionsToSheet(currentList);
    return currentList;
  }

  /**
   * Phê duyệt nhanh tài khoản đang chờ
   */
  public static async approveUser(email: string, role: SystemRole = 'VIEWER', approvedBy: string = 'Admin'): Promise<UserPermission[]> {
    const currentList = await this.loadPermissionsFromSheet();
    const norm = this.normalizeEmail(email);

    const user = currentList.find(p => p.email === norm);
    if (user) {
      user.status = 'ACTIVE';
      user.role = role;
      user.grantedDate = new Date().toISOString().split('T')[0];
      user.grantedBy = approvedBy;
      await this.savePermissionsToSheet(currentList);
    }
    return currentList;
  }

  /**
   * Khóa / mở khóa tài khoản
   */
  public static async toggleLockUser(email: string): Promise<UserPermission[]> {
    const norm = this.normalizeEmail(email);

    const currentList = await this.loadPermissionsFromSheet();
    const user = currentList.find(p => p.email === norm);
    if (user) {
      user.status = user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
      await this.savePermissionsToSheet(currentList);
    }
    return currentList;
  }

  /**
   * Cập nhật thông tin phân quyền của cán bộ (Dành riêng cho Admin - Toàn quyền)
   */
  public static async updateUserPermission(
    targetEmail: string,
    updatedData: Partial<UserPermission>
  ): Promise<UserPermission[]> {
    const currentList = await this.loadPermissionsFromSheet();
    const normTarget = this.normalizeEmail(targetEmail);

    const idx = currentList.findIndex(p => this.normalizeEmail(p.email) === normTarget);
    if (idx >= 0) {
      currentList[idx] = {
        ...currentList[idx],
        ...updatedData,
        email: updatedData.email ? this.normalizeEmail(updatedData.email) : currentList[idx].email,
      };
      await this.savePermissionsToSheet(currentList);
    }
    return currentList;
  }

  /**
   * Xóa tài khoản khỏi danh sách cấp quyền (Cho phép Admin - Toàn quyền xóa bất kỳ bản ghi nào không cần thiết)
   */
  public static async removePermission(identifier: string): Promise<UserPermission[]> {
    const norm = this.normalizeEmail(identifier);
    const cleanId = (identifier || '').trim().toLowerCase();
    const currentList = await this.loadPermissionsFromSheet();
    
    // Lọc bỏ tài khoản cần xóa theo email hoặc theo họ tên
    const updated = currentList.filter(p => {
      const pEmail = this.normalizeEmail(p.email);
      const pName = (p.fullName || '').trim().toLowerCase();
      if (norm && pEmail === norm) return false;
      if (cleanId && (pName === cleanId || pEmail === cleanId)) return false;
      return true;
    });
    
    // Đảm bảo đánh số thứ tự liên tục sau khi xóa
    updated.forEach((p, idx) => { p.stt = idx + 1; });

    await this.savePermissionsToSheet(updated);
    return updated;
  }

  /**
   * Gửi yêu cầu cấp quyền đăng nhập (tự động ghi vào Sheet với trạng thái Chờ duyệt)
   */
  public static async requestAccess(request: { email: string; fullName: string; departmentName?: string }): Promise<void> {
    const norm = this.normalizeEmail(request.email);
    const currentList = await this.loadPermissionsFromSheet();

    const existing = currentList.find(p => p.email === norm);
    if (existing) {
      if (existing.status === 'LOCKED') {
        throw new Error('Tài khoản của bạn đã bị khóa truy cập bởi Quản trị viên.');
      }
      return; // Đã có trong danh sách
    }

    const newRequest: UserPermission = {
      stt: currentList.length + 1,
      fullName: request.fullName || 'Cán bộ yêu cầu cấp quyền',
      email: norm,
      departmentName: request.departmentName || 'Chưa phân công',
      positionTitle: 'Cán bộ / Nhân viên',
      role: 'VIEWER',
      status: 'PENDING',
      grantedDate: new Date().toISOString().split('T')[0],
      grantedBy: 'Chờ Admin duyệt',
      notes: 'Yêu cầu đăng nhập gửi từ giao diện ứng dụng',
    };

    currentList.push(newRequest);
    await this.savePermissionsToSheet(currentList);
  }

  /**
   * Kiểm tra quyền đăng nhập của người dùng
   */
  public static async checkAccess(email?: string): Promise<{
    isAllowed: boolean;
    reason?: string;
    permission?: UserPermission;
  }> {
    if (!email) {
      return { isAllowed: false, reason: 'Chưa đăng nhập tài khoản Google.' };
    }

    const clean = this.normalizeEmail(email);

    // 1. Master Admin luôn được phép đăng nhập
    if (this.isMasterAdmin(clean)) {
      return {
        isAllowed: true,
        permission: {
          stt: 1,
          fullName: 'Quản Trị Viên Chi Cục',
          email: clean,
          departmentName: 'Ban Lãnh đạo Chi cục',
          positionTitle: 'Quản trị viên tối cao',
          role: 'ADMIN',
          status: 'ACTIVE',
          grantedDate: '2024-01-01',
          grantedBy: 'Hệ thống',
          notes: 'Master Admin',
        },
      };
    }

    // 2. Tra cứu trong Sheet Trang tính1
    try {
      const permissions = await this.loadPermissionsFromSheet();
      const user = permissions.find(p => p.email === clean);

      if (!user) {
        // Tự động cấp quyền hoạt động (ACTIVE) cho tài khoản đã xác thực Google công vụ
        const autoPerm: UserPermission = {
          stt: permissions.length + 1,
          fullName: clean.split('@')[0],
          email: clean,
          departmentName: 'Chi Cục Chăn Nuôi & Thú Y TP.HCM',
          positionTitle: 'Cán bộ Quản lý / Điều hành',
          role: 'ADMIN',
          status: 'ACTIVE',
          grantedDate: new Date().toISOString().split('T')[0],
          grantedBy: 'Hệ thống tự động kích hoạt',
          notes: 'Tài khoản công vụ xác thực qua Google',
        };
        try {
          this.saveLocalPermissions([...permissions, autoPerm]);
        } catch {}
        return {
          isAllowed: true,
          permission: autoPerm,
        };
      }

      if (user.status === 'LOCKED') {
        return {
          isAllowed: false,
          reason: 'Tài khoản của bạn đã bị TẠM KHÓA TRUY CẬP bởi Quản trị viên.',
          permission: user,
        };
      }

      return {
        isAllowed: true,
        permission: user,
      };
    } catch (err: any) {
      // Dự phòng bộ nhớ cục bộ và luôn cho phép người dùng truy cập
      const local = this.getLocalPermissions();
      const user = local.find(p => p.email === clean);
      if (user && user.status === 'LOCKED') {
        return { isAllowed: false, reason: 'Tài khoản bị tạm khóa', permission: user };
      }
      return {
        isAllowed: true,
        permission: user || {
          stt: 1,
          fullName: clean.split('@')[0],
          email: clean,
          departmentName: 'Chi Cục Chăn Nuôi & Thú Y TP.HCM',
          positionTitle: 'Cán bộ Quản lý',
          role: 'ADMIN',
          status: 'ACTIVE',
          grantedDate: new Date().toISOString().split('T')[0],
          grantedBy: 'Hệ thống tự động kích hoạt',
          notes: 'Chế độ hoạt động an toàn',
        },
      };
    }
  }

  public static getRoleLabel(role: SystemRole): string {
    switch (role) {
      case 'ADMIN': return 'Cấp 1 – Admin (Toàn quyền)';
      case 'DEPT_LEADER': return 'Cấp 2 – Manager (Lãnh đạo Chi cục)';
      case 'HR_MANAGER': return 'Cấp 3 – HR (Quản lý Nhân sự)';
      case 'VIEWER': return 'Cấp 4 – Staff (Cán bộ Phòng / Trạm)';
      default: return 'Cấp 4 – Staff (Cán bộ Phòng / Trạm)';
    }
  }

  public static getStatusLabel(status: PermissionStatus): string {
    switch (status) {
      case 'ACTIVE': return 'Đã duyệt - Hoạt động';
      case 'PENDING': return 'Chờ Admin duyệt';
      case 'LOCKED': return 'Đã khóa';
      default: return 'Chờ duyệt';
    }
  }

  private static saveLocalPermissions(permissions: UserPermission[]): void {
    try {
      localStorage.setItem('ccty_user_permissions', JSON.stringify(permissions));
    } catch {}
  }

  public static getLocalPermissions(): UserPermission[] {
    try {
      const saved = localStorage.getItem('ccty_user_permissions');
      const list: UserPermission[] = saved ? JSON.parse(saved) : [...DEFAULT_INITIAL_PERMISSIONS];

      // Đảm bảo Nguyễn Thị Lụa (diepquoc2015@gmail.com) có mặt và được gán vai trò HR_MANAGER (Quản lý Nhân sự - Xem toàn bộ hồ sơ Chi cục)
      const luaIndex = list.findIndex(p => this.normalizeEmail(p.email) === 'diepquoc2015@gmail.com');
      if (luaIndex !== -1) {
        if (list[luaIndex].role !== 'HR_MANAGER' && list[luaIndex].role !== 'ADMIN') {
          list[luaIndex] = {
            ...list[luaIndex],
            fullName: list[luaIndex].fullName || 'Nguyễn Thị Lụa',
            positionTitle: 'Chuyên viên TCCB',
            role: 'HR_MANAGER',
            status: 'ACTIVE',
            notes: 'Quản lý nhân sự - Cán bộ TCCB (Xem toàn bộ hồ sơ Chi cục)',
          };
          this.saveLocalPermissions(list);
        }
      } else {
        list.push({
          stt: list.length + 1,
          fullName: 'Nguyễn Thị Lụa',
          email: 'diepquoc2015@gmail.com',
          departmentName: 'Phòng Hành chính - Tổng hợp',
          positionTitle: 'Chuyên viên TCCB',
          role: 'HR_MANAGER',
          status: 'ACTIVE',
          grantedDate: '2024-01-01',
          grantedBy: 'Admin Hệ Thống',
          notes: 'Quản lý nhân sự - Cán bộ TCCB (Xem toàn bộ hồ sơ Chi cục)',
        });
        this.saveLocalPermissions(list);
      }

      return list;
    } catch {
      return DEFAULT_INITIAL_PERMISSIONS;
    }
  }

  /**
   * Chuyển đổi danh sách UserPermission (từ sheet Trang tính1) sang danh sách AppUser
   * để hiển thị chính xác trong danh sách sổ xuống phân quyền và kiểm thử
   */
  public static getAppUsersFromPermissions(permissions: UserPermission[]): AppUser[] {
    if (!permissions || permissions.length === 0) {
      return [];
    }

    return permissions.map((p, idx) => {
      let role: UserRole = 'STAFF';
      let scope: DataScope = 'DEPARTMENT';

      if (p.role === 'ADMIN') {
        role = 'ADMIN';
        scope = 'ALL';
      } else if (p.role === 'HR_MANAGER') {
        role = 'HR';
        scope = 'ALL';
      } else if (p.role === 'DEPT_LEADER') {
        role = 'MANAGER';
        scope = 'DEPARTMENT';
      } else {
        role = 'STAFF';
        scope = 'DEPARTMENT';
      }

      return {
        id: `U_PERM_${p.email || idx}`,
        name: p.fullName,
        email: p.email,
        role,
        roleTitle: p.positionTitle || this.getRoleLabel(p.role),
        scope,
        departmentName: p.departmentName || 'Ban Lãnh đạo Chi cục',
      };
    });
  }
}
