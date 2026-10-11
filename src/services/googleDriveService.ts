import { getAccessToken } from './firebaseAuth';

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveUploadedFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: number;
}

export const ROOT_FOLDER_NAME = 'Chi Cục Chăn Nuôi & Thú Y TPHCM - Quản Lý Hồ Sơ Nhân Sự';

export class GoogleDriveService {
  private static async getHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn. Vui lòng đăng nhập Google.');
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Tìm kiếm hoặc tạo mới thư mục trên Google Drive
   */
  public static async getOrCreateFolder(folderName: string, parentFolderId?: string): Promise<DriveFolderInfo> {
    const headers = await this.getHeaders();
    
    // Tìm thư mục
    let query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&spaces=drive`;
    const res = await fetch(searchUrl, { headers });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Không thể tìm kiếm thư mục trên Google Drive.');
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }

    // Nếu chưa có, tạo mới
    const metadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Không thể tạo thư mục trên Google Drive.');
    }

    return await createRes.json();
  }

  /**
   * Khởi tạo cấu trúc thư mục chuẩn cho Chi cục trên Google Drive
   */
  public static async initSystemDriveStructure(): Promise<{
    rootFolder: DriveFolderInfo;
    staffFolder: DriveFolderInfo;
    decisionsFolder: DriveFolderInfo;
    reportsFolder: DriveFolderInfo;
  }> {
    // 1. Thư mục gốc
    const rootFolder = await this.getOrCreateFolder(ROOT_FOLDER_NAME);

    // 2. Các thư mục nhánh
    const staffFolder = await this.getOrCreateFolder('01_Hồ_Sơ_Cán_Bộ_Nhân_Viên', rootFolder.id);
    const decisionsFolder = await this.getOrCreateFolder('02_Văn_Bản_Quyết_Định_Tổ_Chức', rootFolder.id);
    const reportsFolder = await this.getOrCreateFolder('03_Báo_Cáo_Biên_Chế_Thống_Kê', rootFolder.id);

    return { rootFolder, staffFolder, decisionsFolder, reportsFolder };
  }

  /**
   * Tạo thư mục riêng cho từng nhân viên: NV-19850510-0001_NguyenVanA
   */
  public static async getOrCreateEmployeeFolder(
    employeeCode: string, 
    employeeName: string, 
    parentFolderId: string
  ): Promise<DriveFolderInfo> {
    const cleanName = `${employeeCode}_${employeeName.replace(/[\\/:*?"<>|]/g, '')}`;
    return await this.getOrCreateFolder(cleanName, parentFolderId);
  }

  /**
   * Tải tệp lên thư mục Google Drive (PDF, hình ảnh CCCD, văn bằng, quyết định)
   */
  public static async uploadFile(
    file: File | Blob, 
    fileName: string, 
    mimeType: string, 
    parentFolderId: string
  ): Promise<DriveUploadedFile> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa kết nối Google Drive. Vui lòng đăng nhập.');
    }

    const metadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata);

    const fileBuffer = await file.arrayBuffer();
    const mediaHeader = delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`;

    const enc = new TextEncoder();
    const part1 = enc.encode(metadataPart);
    const part2 = enc.encode(mediaHeader);
    const part3 = new Uint8Array(fileBuffer);
    const part4 = enc.encode(closeDelimiter);

    const totalLength = part1.length + part2.length + part3.length + part4.length;
    const bodyBuffer = new Uint8Array(totalLength);

    let offset = 0;
    bodyBuffer.set(part1, offset);
    offset += part1.length;
    bodyBuffer.set(part2, offset);
    offset += part2.length;
    bodyBuffer.set(part3, offset);
    offset += part3.length;
    bodyBuffer.set(part4, offset);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: bodyBuffer,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || 'Lỗi khi tải tệp lên Google Drive.');
    }

    const uploadedData = await uploadRes.json();
    return uploadedData;
  }

  /**
   * Lấy danh sách tệp trong một thư mục
   */
  public static async listFilesInFolder(folderId: string): Promise<DriveUploadedFile[]> {
    const headers = await this.getHeaders();
    const q = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,size,createdTime)&orderBy=createdTime desc`;
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Không thể liệt kê tệp trong thư mục.');
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Tìm kiếm tệp trong toàn bộ Google Drive theo từ khóa hoặc tên tệp
   */
  public static async searchDriveFiles(keyword: string = ''): Promise<DriveUploadedFile[]> {
    const headers = await this.getHeaders();
    
    // Tìm kiếm tệp khớp tên hoặc từ khóa, loại trừ thùng rác
    let q = `trashed = false`;
    if (keyword.trim()) {
      const cleanKeyword = keyword.replace(/'/g, "\\'").trim();
      q += ` and (name contains '${cleanKeyword}')`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,size,modifiedTime)&pageSize=30&orderBy=modifiedTime desc`;
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Không thể tìm kiếm tệp trên Google Drive.');
    }

    const data = await res.json();
    return data.files || [];
  }

  /**
   * Tải nội dung tệp từ Google Drive dưới dạng ArrayBuffer để đọc bằng thư viện XLSX
   */
  public static async downloadFileAsArrayBuffer(fileId: string, mimeType?: string): Promise<ArrayBuffer> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Chưa đăng nhập Google hoặc phiên làm việc đã hết hạn.');
    }

    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    // Nếu là file dạng Google Spreadsheet gốc, cần export ra dạng .xlsx
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
    }

    const res = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      let errorMsg = 'Không thể tải tệp từ Google Drive.';
      try {
        const err = await res.json();
        errorMsg = err.error?.message || errorMsg;
      } catch {
        errorMsg = `Lỗi tải tệp: HTTP ${res.status}`;
      }
      throw new Error(errorMsg);
    }

    return await res.arrayBuffer();
  }

  /**
   * Tìm kiếm truy xuất nhanh bên trong nội dung và tên file thuộc 3 thư mục trọng tâm:
   * - 01_Hồ_Sơ_Cán_Bộ_Nhân_Viên
   * - 02_Văn_Bản_Quyết_Định_Tổ_Chức
   * - 03_Báo_Cáo_Biên_Chế_Thống_Kê
   */
  public static async searchInsideTargetFolders(
    query: string,
    targetFolder: 'ALL' | '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê' = 'ALL'
  ): Promise<Array<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    size?: number;
    modifiedTime?: string;
    folderCategory: '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê' | 'Thư mục khác';
    parentFolderName?: string;
  }>> {
    const headers = await this.getHeaders();
    const cleanQ = query.replace(/'/g, "\\'").trim();
    if (!cleanQ) return [];

    try {
      // 1. Lấy thông tin 3 thư mục nhánh
      const { staffFolder, decisionsFolder, reportsFolder } = await this.initSystemDriveStructure();

      // Tập hợp ID các thư mục cần tìm
      const folderMap = new Map<string, '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê'>();
      if (staffFolder?.id) folderMap.set(staffFolder.id, '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên');
      if (decisionsFolder?.id) folderMap.set(decisionsFolder.id, '02_Văn_Bản_Quyết_Định_Tổ_Chức');
      if (reportsFolder?.id) folderMap.set(reportsFolder.id, '03_Báo_Cáo_Biên_Chế_Thống_Kê');

      // Ngoài ra, lấy danh sách các thư mục con của 01_Hồ_Sơ_Cán_Bộ_Nhân_Viên (thư mục từng cán bộ)
      if (staffFolder?.id && (targetFolder === 'ALL' || targetFolder === '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên')) {
        try {
          const subQuery = `'${staffFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
          const subRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQuery)}&fields=files(id,name)&pageSize=100`, { headers });
          if (subRes.ok) {
            const subData = await subRes.json();
            (subData.files || []).forEach((f: any) => {
              folderMap.set(f.id, '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên');
            });
          }
        } catch (e) {
          console.warn('Lỗi lấy thư mục con cán bộ:', e);
        }
      }

      // 2. Xây dựng câu truy vấn Google Drive: tìm kiếm fullText (bên trong nội dung file) HOẶC tên file
      // Drive API cho phép: (fullText contains 'xyz' or name contains 'xyz')
      const driveQuery = `(fullText contains '${cleanQ}' or name contains '${cleanQ}') and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=files(id,name,mimeType,webViewLink,size,modifiedTime,parents)&pageSize=50&orderBy=modifiedTime desc`;

      const res = await fetch(searchUrl, { headers });
      if (!res.ok) {
        // Nếu fullText bị giới hạn bởi quyền, thử lại chỉ tìm theo tên
        const fallbackQuery = `name contains '${cleanQ}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
        const fallbackRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fallbackQuery)}&fields=files(id,name,mimeType,webViewLink,size,modifiedTime,parents)&pageSize=50&orderBy=modifiedTime desc`, { headers });
        if (!fallbackRes.ok) return [];
        const fbData = await fallbackRes.json();
        return this.filterAndTagResults(fbData.files || [], folderMap, targetFolder);
      }

      const data = await res.json();
      return this.filterAndTagResults(data.files || [], folderMap, targetFolder);
    } catch (err: any) {
      console.warn('Lỗi tìm kiếm nội dung file trên Drive:', err);
      return [];
    }
  }

  private static filterAndTagResults(
    files: any[],
    folderMap: Map<string, '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê'>,
    targetFolder: string
  ): any[] {
    const results: any[] = [];

    for (const file of files) {
      const parents = file.parents || [];
      let category: '01_Hồ_Sơ_Cán_Bộ_Nhân_Viên' | '02_Văn_Bản_Quyết_Định_Tổ_Chức' | '03_Báo_Cáo_Biên_Chế_Thống_Kê' | 'Thư mục khác' = 'Thư mục khác';

      for (const pId of parents) {
        if (folderMap.has(pId)) {
          category = folderMap.get(pId)!;
          break;
        }
      }

      // Nếu người dùng chọn lọc thư mục cụ thể
      if (targetFolder !== 'ALL' && category !== targetFolder) {
        continue;
      }

      results.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        size: file.size ? parseInt(file.size, 10) : undefined,
        modifiedTime: file.modifiedTime,
        folderCategory: category,
        parentFolderName: category !== 'Thư mục khác' ? category : 'Google Drive',
      });
    }

    return results;
  }
}

