export interface JobRank {
  code: string;
  name: string;
  defaultCoefficient?: number;
  maxStep?: number;
  group?: 'Kế toán' | 'Hành chính' | 'Kiểm dịch & Thú y' | 'Ngạch tự nhập / Khác';
  isCustom?: boolean;
}

export const DEFAULT_JOB_RANKS: JobRank[] = [
  // 1. Nhóm Kế toán (theo yêu cầu)
  {
    code: '06.029',
    name: 'Kế toán viên cao cấp',
    defaultCoefficient: 6.20,
    maxStep: 6,
    group: 'Kế toán'
  },
  {
    code: '06.030',
    name: 'Kế toán viên chính',
    defaultCoefficient: 4.40,
    maxStep: 8,
    group: 'Kế toán'
  },
  {
    code: '06.031',
    name: 'Kế toán viên',
    defaultCoefficient: 2.34,
    maxStep: 9,
    group: 'Kế toán'
  },
  {
    code: '06.032',
    name: 'Kế toán viên trung cấp',
    defaultCoefficient: 1.86,
    maxStep: 12,
    group: 'Kế toán'
  },

  // 2. Nhóm Kiểm dịch động thực vật & Thú y (theo yêu cầu)
  {
    code: '09.068',
    name: 'Kiểm dịch viên động thực vật',
    defaultCoefficient: 2.34,
    maxStep: 9,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: '09.067',
    name: 'Kiểm dịch viên chính động thực vật',
    defaultCoefficient: 4.40,
    maxStep: 8,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: '09.018',
    name: 'Kiểm dịch viên thú y chính',
    defaultCoefficient: 4.40,
    maxStep: 8,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: '09.019',
    name: 'Kiểm dịch viên thú y',
    defaultCoefficient: 2.34,
    maxStep: 9,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: '09.020',
    name: 'Kỹ thuật viên thú y',
    defaultCoefficient: 2.10,
    maxStep: 12,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: 'V.03.04.10',
    name: 'Bác sĩ thú y chính (Hạng II)',
    defaultCoefficient: 4.40,
    maxStep: 8,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: 'V.03.04.11',
    name: 'Bác sĩ thú y (Hạng III)',
    defaultCoefficient: 2.34,
    maxStep: 9,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: 'V.03.04.12',
    name: 'Kỹ thuật viên chẩn đoán bệnh động vật (Hạng III)',
    defaultCoefficient: 2.10,
    maxStep: 12,
    group: 'Kiểm dịch & Thú y'
  },
  {
    code: 'V.03.04.13',
    name: 'Kỹ thuật viên chẩn đoán bệnh động vật (Hạng IV)',
    defaultCoefficient: 1.86,
    maxStep: 12,
    group: 'Kiểm dịch & Thú y'
  },

  // 3. Nhóm Hành chính / Chuyên viên (theo yêu cầu: Chuyên viên)
  {
    code: '01.001',
    name: 'Chuyên viên cao cấp',
    defaultCoefficient: 6.20,
    maxStep: 6,
    group: 'Hành chính'
  },
  {
    code: '01.002',
    name: 'Chuyên viên chính',
    defaultCoefficient: 4.40,
    maxStep: 8,
    group: 'Hành chính'
  },
  {
    code: '01.003',
    name: 'Chuyên viên',
    defaultCoefficient: 2.34,
    maxStep: 9,
    group: 'Hành chính'
  },
  {
    code: '01.004',
    name: 'Cán sự',
    defaultCoefficient: 1.86,
    maxStep: 12,
    group: 'Hành chính'
  },
  {
    code: '01.005',
    name: 'Nhân viên',
    defaultCoefficient: 1.35,
    maxStep: 12,
    group: 'Hành chính'
  }
];

const STORAGE_KEY = 'ccty_custom_job_ranks';

export class JobRankService {
  /**
   * Lấy danh sách ngạch tùy chỉnh do người dùng nhập thêm
   */
  public static getCustomRanks(): JobRank[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Lấy toàn bộ danh sách ngạch (ngạch chuẩn + ngạch người dùng nhập thêm)
   */
  public static getAllRanks(): JobRank[] {
    const customs = this.getCustomRanks();
    // Gộp và loại bỏ trùng mã ngạch
    const merged = [...DEFAULT_JOB_RANKS];
    
    customs.forEach(c => {
      const idx = merged.findIndex(m => m.code.toLowerCase() === c.code.toLowerCase());
      if (idx >= 0) {
        merged[idx] = c;
      } else {
        merged.push({ ...c, isCustom: true });
      }
    });

    return merged;
  }

  /**
   * Thêm một ngạch mới vào hệ thống
   */
  public static addCustomRank(newRank: {
    code: string;
    name: string;
    defaultCoefficient?: number;
    maxStep?: number;
    group?: 'Kế toán' | 'Hành chính' | 'Kiểm dịch & Thú y' | 'Ngạch tự nhập / Khác';
  }): JobRank {
    const code = newRank.code.trim();
    const name = newRank.name.trim();

    if (!code) throw new Error('Vui lòng nhập mã ngạch (Ví dụ: 06.029, 09.068)');
    if (!name) throw new Error('Vui lòng nhập tên ngạch công chức / viên chức');

    const rankObj: JobRank = {
      code,
      name,
      defaultCoefficient: newRank.defaultCoefficient || 2.34,
      maxStep: newRank.maxStep || 9,
      group: newRank.group || 'Ngạch tự nhập / Khác',
      isCustom: true
    };

    const currentCustoms = this.getCustomRanks();
    const existingIndex = currentCustoms.findIndex(c => c.code.toLowerCase() === code.toLowerCase());

    let updated: JobRank[];
    if (existingIndex >= 0) {
      currentCustoms[existingIndex] = rankObj;
      updated = [...currentCustoms];
    } else {
      updated = [rankObj, ...currentCustoms];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return rankObj;
  }

  /**
   * Lấy thông tin ngạch theo mã
   */
  public static getRankByCode(code?: string): JobRank | undefined {
    if (!code) return undefined;
    const cleanCode = code.trim().toLowerCase();
    const all = this.getAllRanks();
    return all.find(r => r.code.toLowerCase() === cleanCode);
  }

  /**
   * Lấy nhãn hiển thị: "Mã ngạch - Tên ngạch"
   */
  public static getRankLabel(code?: string, fallbackName?: string): string {
    if (!code) return fallbackName || '';
    const found = this.getRankByCode(code);
    if (found) {
      return `${found.code} - ${found.name}`;
    }
    return fallbackName ? `${code} - ${fallbackName}` : code;
  }
}
