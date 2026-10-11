import React, { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Award, 
  BookOpen, 
  Users, 
  Download, 
  Filter, 
  PieChart as PieIcon, 
  Layers, 
  CheckCircle2, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Employee } from '../types/hrm';
import { MainStaffType, STAFF_TYPE_ORDER, STAFF_TYPE_META, getStaffTypeCategory } from './DashboardView';
import * as XLSX from 'xlsx';

export interface DegreeItem {
  id: string;
  name: string;
  count: number;
  percent: number;
  colorTop: string;
  colorTopEnd: string;
  colorSide: string;
  colorBorder: string;
  badgeClass: string;
  textClass: string;
  maleCount?: number;
  femaleCount?: number;
  popularMajors?: string[];
  description: string;
}

// Dữ liệu màu sắc chuẩn phong cách Cam Hổ Phách (Vibrant Orange & Amber) sắc nét, tương phản cao, nổi khối 3D rõ ràng
const DEGREE_META_MAP: Record<string, {
  colorTop: string;
  colorTopEnd: string;
  colorSide: string;
  colorBorder: string;
  badgeClass: string;
  textClass: string;
  description: string;
}> = {
  'Tiến sĩ': {
    colorTop: '#ea580c', // Cam Cháy Sâu / Deep Rust Sunset Orange
    colorTopEnd: '#c2410c',
    colorSide: '#7c2d12', // Khối nghiêng nâu cam đậm
    colorBorder: '#ffedd5',
    badgeClass: 'bg-orange-100 text-orange-950 border-orange-300 font-bold',
    textClass: 'text-orange-900',
    description: 'Chuyên gia đầu ngành chăn nuôi, thú y, dịch tễ & vi sinh',
  },
  'Thạc sĩ': {
    colorTop: '#f97316', // Cam Tươi Rực Rỡ / Vivid Citrus Orange
    colorTopEnd: '#ea580c',
    colorSide: '#9a3412', // Khối nghiêng cam sẫm
    colorBorder: '#fff7ed',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300 font-bold',
    textClass: 'text-amber-900',
    description: 'Bác sĩ Thú y, Quản lý công, CNSH, Chăn nuôi nâng cao',
  },
  'Đại học': {
    colorTop: '#f59e0b', // Vàng Hổ Phách Ánh Kim / Golden Amber
    colorTopEnd: '#d97706',
    colorSide: '#78350f', // Khối nghiêng hổ phách đậm
    colorBorder: '#fef3c7',
    badgeClass: 'bg-yellow-100 text-yellow-950 border-yellow-300 font-bold',
    textClass: 'text-yellow-900',
    description: 'Bác sĩ Thú y, Kỹ sư Chăn nuôi, Cử nhân Luật, Kế toán',
  },
  'Cao đẳng': {
    colorTop: '#eab308', // Vàng Nghệ Mật Ong Sáng / Honey Gold
    colorTopEnd: '#ca8a04',
    colorSide: '#713f12', // Khối nghiêng vàng đất
    colorBorder: '#fef08a',
    badgeClass: 'bg-yellow-50 text-yellow-900 border-yellow-200 font-bold',
    textClass: 'text-yellow-800',
    description: 'Cao đẳng Thú y, Dịch tễ, Kỹ thuật xét nghiệm chăn nuôi',
  },
  'Trung cấp': {
    colorTop: '#f43f5e', // San Hô Đỏ Cam Nổi Bật / Coral Sunset
    colorTopEnd: '#e11d48',
    colorSide: '#881337', // Khối nghiêng hồng cam đậm
    colorBorder: '#ffe4e6',
    badgeClass: 'bg-rose-100 text-rose-950 border-rose-300 font-bold',
    textClass: 'text-rose-900',
    description: 'Kỹ thuật viên thú y cơ sở, kiểm dịch viên phụ trợ',
  },
  'Sơ cấp / Khác': {
    colorTop: '#d97706', // Nâu Cam Hạt Dẻ / Warm Terracotta
    colorTopEnd: '#b45309',
    colorSide: '#451a03', // Khối nghiêng nâu thẫm
    colorBorder: '#ffedd5',
    badgeClass: 'bg-stone-100 text-stone-900 border-stone-300 font-bold',
    textClass: 'text-stone-800',
    description: 'Lái xe, văn thư, phục vụ, bảo vệ, khoán kỹ thuật cơ sở',
  },
};

interface Education3DPieChartProps {
  employees: Employee[];
  selectedStaffType?: string;
  onSelectStaffType?: (type: string) => void;
  onFilterDegree?: (degree: string) => void;
}

export const Education3DPieChart: React.FC<Education3DPieChartProps> = ({
  employees,
  selectedStaffType = 'ALL',
  onSelectStaffType,
  onFilterDegree,
}) => {
  const [activeStaffType, setActiveStaffType] = useState<string>(selectedStaffType);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'degree' | 'major'>('degree');

  // Đồng bộ khi prop từ bên ngoài thay đổi
  React.useEffect(() => {
    if (selectedStaffType) {
      setActiveStaffType(selectedStaffType);
    }
  }, [selectedStaffType]);

  const handleStaffTypeChange = (type: string) => {
    setActiveStaffType(type);
    if (onSelectStaffType) {
      onSelectStaffType(type);
    }
  };

  // Lọc danh sách cán bộ theo loại hình đang chọn
  const filteredEmployees = useMemo(() => {
    if (activeStaffType === 'ALL') {
      return employees;
    }
    return employees.filter(e => getStaffTypeCategory(e.staffType) === activeStaffType);
  }, [employees, activeStaffType]);

  // Tính toán dữ liệu Trình độ chuyên môn (Chỉ tính từ dữ liệu nhân sự thực tế, không sinh dữ liệu giả lập)
  const degreeItems = useMemo<DegreeItem[]>(() => {
    if (filteredEmployees.length === 0) {
      return [];
    }

    // Dùng dữ liệu thực từ danh sách employees
    const degreeMap: Record<string, { count: number; male: number; female: number; majors: Set<string> }> = {
      'Tiến sĩ': { count: 0, male: 0, female: 0, majors: new Set() },
      'Thạc sĩ': { count: 0, male: 0, female: 0, majors: new Set() },
      'Đại học': { count: 0, male: 0, female: 0, majors: new Set() },
      'Cao đẳng': { count: 0, male: 0, female: 0, majors: new Set() },
      'Trung cấp': { count: 0, male: 0, female: 0, majors: new Set() },
      'Sơ cấp / Khác': { count: 0, male: 0, female: 0, majors: new Set() },
    };

    filteredEmployees.forEach(emp => {
      const rawDeg = emp.education?.highestDegree || 'Đại học';
      let normDeg = 'Sơ cấp / Khác';
      if (rawDeg.includes('Tiến sĩ')) normDeg = 'Tiến sĩ';
      else if (rawDeg.includes('Thạc sĩ')) normDeg = 'Thạc sĩ';
      else if (rawDeg.includes('Đại học')) normDeg = 'Đại học';
      else if (rawDeg.includes('Cao đẳng')) normDeg = 'Cao đẳng';
      else if (rawDeg.includes('Trung cấp')) normDeg = 'Trung cấp';

      if (!degreeMap[normDeg]) {
        degreeMap[normDeg] = { count: 0, male: 0, female: 0, majors: new Set() };
      }
      degreeMap[normDeg].count += 1;
      if (emp.gender === 'Nam') degreeMap[normDeg].male += 1;
      else degreeMap[normDeg].female += 1;

      if (emp.education?.major) {
        degreeMap[normDeg].majors.add(emp.education.major);
      }
    });

    const total = filteredEmployees.length;
    const order = ['Tiến sĩ', 'Thạc sĩ', 'Đại học', 'Cao đẳng', 'Trung cấp', 'Sơ cấp / Khác'];

    return order
      .filter(deg => degreeMap[deg] && degreeMap[deg].count > 0)
      .map((deg, idx) => {
        const item = degreeMap[deg];
        const meta = DEGREE_META_MAP[deg] || DEGREE_META_MAP['Sơ cấp / Khác'];
        const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
        return {
          id: `deg-${idx}`,
          name: deg,
          count: item.count,
          percent: pct,
          colorTop: meta.colorTop,
          colorTopEnd: meta.colorTopEnd,
          colorSide: meta.colorSide,
          colorBorder: meta.colorBorder,
          badgeClass: meta.badgeClass,
          textClass: meta.textClass,
          description: meta.description,
          maleCount: item.male,
          femaleCount: item.female,
          popularMajors: Array.from(item.majors).slice(0, 3),
        };
      });
  }, [filteredEmployees]);

  // Tổng số nhân sự đang xét
  const currentTotal = useMemo(() => {
    return degreeItems.reduce((acc, curr) => acc + curr.count, 0);
  }, [degreeItems]);

  // Tỷ lệ sau đại học (Thạc sĩ + Tiến sĩ)
  const postGradStats = useMemo(() => {
    const postGradCount = degreeItems
      .filter(d => d.name === 'Tiến sĩ' || d.name === 'Thạc sĩ')
      .reduce((s, i) => s + i.count, 0);
    const pct = currentTotal > 0 ? Math.round((postGradCount / currentTotal) * 1000) / 10 : 0;
    return { count: postGradCount, percent: pct };
  }, [degreeItems, currentTotal]);

  // Tỷ lệ Đại học trở lên
  const higherEduStats = useMemo(() => {
    const count = degreeItems
      .filter(d => d.name === 'Tiến sĩ' || d.name === 'Thạc sĩ' || d.name === 'Đại học')
      .reduce((s, i) => s + i.count, 0);
    const pct = currentTotal > 0 ? Math.round((count / currentTotal) * 1000) / 10 : 0;
    return { count, percent: pct };
  }, [degreeItems, currentTotal]);

  // ==========================================
  // THUẬT TOÁN HÌNH HỌC VẼ BIỂU ĐỒ TRÒN 3D (SVG)
  // ==========================================
  const svgWidth = 540;
  const svgHeight = 340;
  const cx = 270;
  const cy = 145;
  const rx = 150;
  const ry = 80; // Tỷ lệ nghiêng ~ 0.53 tạo chiều sâu 3D đẳng cự (isometric depth)
  const depth3D = 28; // Độ dày khối 3D (chiều cao trụ nón)

  // Tính toán các lát cắt hình nón 3D
  const slices = useMemo(() => {
    if (currentTotal === 0 || degreeItems.length === 0) return [];

    let currentAngle = -Math.PI / 2; // Bắt đầu từ 12 giờ (đỉnh trên)
    
    return degreeItems.map((item, index) => {
      const angleSpan = (item.count / currentTotal) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      const midAngle = (startAngle + endAngle) / 2;
      currentAngle = endAngle;

      const isHovered = hoveredIndex === index;
      const explodeDist = isHovered ? 12 : 0;
      const ox = explodeDist * Math.cos(midAngle);
      const oy = explodeDist * (ry / rx) * Math.sin(midAngle);

      // Điểm tâm dời khi hover
      const scx = cx + ox;
      const scy = cy + oy;

      // Điểm đầu và cuối trên elip đỉnh (top face)
      const x1 = scx + rx * Math.cos(startAngle);
      const y1 = scy + ry * Math.sin(startAngle);
      const x2 = scx + rx * Math.cos(endAngle);
      const y2 = scy + ry * Math.sin(endAngle);

      // Đường bao mặt trên (Top Face)
      const largeArc = angleSpan > Math.PI ? 1 : 0;
      const topPath = `M ${scx} ${scy} L ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2} Z`;

      // Cắt thành các đoạn nhỏ để dựng mặt vành trụ 3D (Cylinder side wall)
      // Vành trụ chỉ nhìn thấy ở nửa trước: sin(angle) >= 0 (tức góc từ 0 đến PI)
      const numSteps = Math.max(6, Math.ceil(angleSpan * 12));
      const stepAngle = angleSpan / numSteps;
      const frontRimQuads: string[] = [];

      for (let i = 0; i < numSteps; i++) {
        const aStart = startAngle + i * stepAngle;
        const aEnd = aStart + stepAngle;
        const aMid = (aStart + aEnd) / 2;

        // Chuẩn hóa góc về [0, 2*PI)
        const normMid = ((aMid % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

        // Nửa trước nhìn thấy khi normMid nằm trong khoảng [0, PI]
        if (normMid >= 0 && normMid <= Math.PI) {
          const px1 = scx + rx * Math.cos(aStart);
          const py1 = scy + ry * Math.sin(aStart);
          const px2 = scx + rx * Math.cos(aEnd);
          const py2 = scy + ry * Math.sin(aEnd);

          const quad = `M ${px1} ${py1} L ${px2} ${py2} L ${px2} ${py2 + depth3D} L ${px1} ${py1 + depth3D} Z`;
          frontRimQuads.push(quad);
        }
      }

      // Mặt cắt hướng tâm tại startAngle (nếu nhìn thấy)
      const normStart = ((startAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const isStartWallVisible = Math.cos(normStart) < 0; // nửa bên trái
      const startWallPath = isStartWallVisible
        ? `M ${scx} ${scy} L ${x1} ${y1} L ${x1} ${y1 + depth3D} L ${scx} ${scy + depth3D} Z`
        : null;

      // Mặt cắt hướng tâm tại endAngle (nếu nhìn thấy)
      const normEnd = ((endAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const isEndWallVisible = Math.cos(normEnd) > 0; // nửa bên phải
      const endWallPath = isEndWallVisible
        ? `M ${scx} ${scy} L ${x2} ${y2} L ${x2} ${y2 + depth3D} L ${scx} ${scy + depth3D} Z`
        : null;

      // Tọa độ mũi tên chỉ dẫn (Callout leader line)
      const labelDist = rx + 24;
      const lx = scx + labelDist * Math.cos(midAngle);
      const ly = scy + (labelDist * (ry / rx)) * Math.sin(midAngle);

      // Điểm gập ngang của đường chỉ dẫn
      const isRightSide = Math.cos(midAngle) >= 0;
      const elbowX = isRightSide ? lx + 18 : lx - 18;
      const textAnchor: 'start' | 'end' = isRightSide ? 'start' : 'end';
      const textX = isRightSide ? elbowX + 6 : elbowX - 6;

      return {
        item,
        index,
        startAngle,
        endAngle,
        midAngle,
        scx,
        scy,
        topPath,
        frontRimQuads,
        startWallPath,
        endWallPath,
        isHovered,
        leaderLine: {
          x1: scx + (rx + 4) * Math.cos(midAngle),
          y1: scy + (ry + 4) * Math.sin(midAngle),
          x2: lx,
          y2: ly,
          x3: elbowX,
          y3: ly,
          textX,
          textY: ly,
          textAnchor,
        },
      };
    });
  }, [degreeItems, currentTotal, hoveredIndex, cx, cy, rx, ry, depth3D]);

  // Xuất file Excel báo cáo Trình độ chuyên môn
  const handleExportExcel = () => {
    const dataToExport = degreeItems.map((item, idx) => ({
      'STT': idx + 1,
      'Trình Độ Chuyên Môn': item.name,
      'Loại Hình Nhân Sự': activeStaffType === 'ALL' ? 'Toàn Chi cục (6 loại hình)' : activeStaffType,
      'Số Lượng (người)': item.count,
      'Tỷ Lệ (%)': `${item.percent}%`,
      'Nam (người)': item.maleCount || 0,
      'Nữ (người)': item.femaleCount || 0,
      'Chức Năng & Vị Trí Việc Làm': item.description,
    }));

    // Thêm dòng tổng cộng
    dataToExport.push({
      'STT': 'Tổng cộng' as any,
      'Trình Độ Chuyên Môn': 'Toàn bộ danh sách',
      'Loại Hình Nhân Sự': activeStaffType === 'ALL' ? 'Toàn Chi cục' : activeStaffType,
      'Số Lượng (người)': currentTotal,
      'Tỷ Lệ (%)': '100.0%',
      'Nam (người)': degreeItems.reduce((s, i) => s + (i.maleCount || 0), 0),
      'Nữ (người)': degreeItems.reduce((s, i) => s + (i.femaleCount || 0), 0),
      'Chức Năng & Vị Trí Việc Làm': `Đại học trở lên chiếm ${higherEduStats.percent}% (Sau ĐH: ${postGradStats.percent}%)`,
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TrinhDoChuyenMon');
    XLSX.writeFile(
      workbook,
      `BaoCao_TrinhDo_ChuyenMon_ChiCuc_${activeStaffType.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
      {/* Header section */}
      <div className="bg-gradient-to-r from-stone-950 via-orange-950 to-amber-950 p-4 sm:p-5 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/25 text-orange-400 border border-orange-400/30">
                <PieIcon className="w-5 h-5" />
              </span>
              <h3 className="font-bold text-base sm:text-lg tracking-wide uppercase text-white flex items-center gap-2">
                <span>TRÌNH ĐỘ CHUYÊN MÔN THEO CƠ CẤU 6 LOẠI HÌNH NHÂN SỰ</span>
                <span className="bg-orange-500/30 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Biểu đồ 3D Lập Thể
                </span>
              </h3>
            </div>
            <p className="text-xs text-orange-200/80 pl-9">
              Phân tích cơ cấu học vị, bằng cấp đào tạo chuyên môn và định biên nhân lực kỹ thuật Chi cục Thú y (Tông Cam Nổi Bật)
            </p>
          </div>

          {/* Quick Metrics & Export */}
          <div className="flex items-center gap-2 flex-wrap pl-9 lg:pl-0">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3 py-1.5 border border-white/10 text-left">
              <div className="text-[10px] text-amber-200 font-medium">Đại học trở lên</div>
              <div className="text-sm font-bold text-white flex items-baseline gap-1">
                <span>{higherEduStats.count}</span>
                <span className="text-[10px] text-amber-300 font-semibold">({higherEduStats.percent}%)</span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs rounded-xl px-3 py-1.5 border border-white/10 text-left">
              <div className="text-[10px] text-amber-200 font-medium">Sau Đại học (ThS/TS)</div>
              <div className="text-sm font-bold text-white flex items-baseline gap-1">
                <span>{postGradStats.count}</span>
                <span className="text-[10px] text-orange-300 font-semibold">({postGradStats.percent}%)</span>
              </div>
            </div>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5 active:scale-95"
              title="Xuất bảng số liệu Trình độ chuyên môn ra file Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs by 6 Staff Types */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => handleStaffTypeChange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
              activeStaffType === 'ALL'
                ? 'bg-orange-600 text-white shadow-sm ring-1 ring-white/50'
                : 'bg-white/10 text-orange-100 hover:bg-white/20'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất cả 6 loại hình ({employees.length})</span>
          </button>

          {STAFF_TYPE_ORDER.map((typeKey) => {
            const count = employees.filter(e => getStaffTypeCategory(e.staffType) === typeKey).length;
            const isSelected = activeStaffType === typeKey;
            return (
              <button
                key={typeKey}
                onClick={() => handleStaffTypeChange(typeKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-md ring-2 ring-orange-400 font-bold'
                    : 'bg-white/10 text-orange-100 hover:bg-white/20'
                }`}
              >
                <span>{typeKey}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-orange-100 text-orange-900 font-bold' : 'bg-white/15 text-orange-200'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: 3D Pie Chart on Left + Detailed Breakdown on Right */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: 3D Pie Chart with Callouts */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative bg-gradient-to-b from-amber-50/40 via-orange-50/25 to-slate-50/60 rounded-2xl border border-amber-200/80 p-3 sm:p-4">
          <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-1 px-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Biểu đồ 3D Hình Tròn Cơ Cấu Học Vị & Bằng Cấp (Tông Màu Cam Hổ Phách Nổi Bật)</span>
            </div>
            <span className="text-[11px] font-medium bg-amber-100/90 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
              Tổng số: <strong>{currentTotal}</strong> cán bộ ({currentTotal > 0 ? '100%' : '0%'})
            </span>
          </div>

          {/* SVG Container */}
          <div className="w-full overflow-visible flex items-center justify-center min-h-[300px] sm:min-h-[340px]">
            {currentTotal === 0 ? (
              <div className="text-center py-12 px-4 max-w-md">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shadow-xs">
                  <PieIcon className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">Chưa có dữ liệu nhân sự để vẽ biểu đồ 3D</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hệ thống không tự sinh dữ liệu giả lập. Vui lòng bấm <strong>"Đồng bộ từ Google Sheets"</strong> để nạp dữ liệu từ file <em>"Chi Cục Chăn Nuôi & Thú Y TPHCM - Cơ Sở Dữ Liệu Quản Lý Nhân Sự"</em> hoặc thêm cán bộ mới.
                </p>
              </div>
            ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full max-w-[540px] h-auto overflow-visible select-none drop-shadow-sm"
            >
              <defs>
                {/* Bóng đổ elip dưới đáy khối nón 3D */}
                <radialGradient id="pieShadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="#0f172a" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>

                {/* Các dải màu gradient cho từng lát cắt 3D */}
                {degreeItems.map((item, idx) => (
                  <React.Fragment key={idx}>
                    <linearGradient id={`gradTop-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={item.colorTop} />
                      <stop offset="100%" stopColor={item.colorTopEnd} />
                    </linearGradient>
                    <linearGradient id={`gradSide-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={item.colorSide} />
                      <stop offset="100%" stopColor="#020617" stopOpacity="0.85" />
                    </linearGradient>
                  </React.Fragment>
                ))}
              </defs>

              {/* 1. Đáy bóng 3D mờ nhạt bên dưới */}
              <ellipse
                cx={cx}
                cy={cy + depth3D + 20}
                rx={rx + 18}
                ry={ry + 10}
                fill="url(#pieShadow)"
              />

              {/* 2. Mặt vành trụ bên hông khối 3D (Cylinder side wall rim) */}
              <g className="transition-all duration-300">
                {slices.map((slice) => {
                  const idx = slice.index;
                  return (
                    <g key={`sides-${idx}`}>
                      {/* Mặt cắt hướng tâm start wall */}
                      {slice.startWallPath && (
                        <path
                          d={slice.startWallPath}
                          fill={slice.item.colorSide}
                          stroke={slice.item.colorBorder}
                          strokeWidth="0.5"
                          opacity={slice.isHovered ? 1 : 0.9}
                          className="transition-all duration-200"
                        />
                      )}

                      {/* Vành mặt ngoài cylinder rim */}
                      {slice.frontRimQuads.map((quadD, qIdx) => (
                        <path
                          key={qIdx}
                          d={quadD}
                          fill={slice.item.colorSide}
                          stroke={slice.item.colorSide}
                          strokeWidth="0.3"
                          opacity={slice.isHovered ? 1 : 0.95}
                          className="transition-all duration-200 cursor-pointer"
                          onMouseEnter={() => setHoveredIndex(idx)}
                          onMouseLeave={() => setHoveredIndex(null)}
                        />
                      ))}

                      {/* Mặt cắt hướng tâm end wall */}
                      {slice.endWallPath && (
                        <path
                          d={slice.endWallPath}
                          fill={slice.item.colorSide}
                          stroke={slice.item.colorBorder}
                          strokeWidth="0.5"
                          opacity={slice.isHovered ? 1 : 0.9}
                          className="transition-all duration-200"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* 3. Bề mặt elip trên đỉnh (Top Faces) */}
              <g className="transition-all duration-300">
                {slices.map((slice) => {
                  const idx = slice.index;
                  return (
                    <path
                      key={`top-${idx}`}
                      d={slice.topPath}
                      fill={`url(#gradTop-${idx})`}
                      stroke="rgba(255, 255, 255, 0.65)"
                      strokeWidth={slice.isHovered ? '2' : '1'}
                      className="cursor-pointer transition-all duration-200 hover:brightness-110"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => onFilterDegree && onFilterDegree(slice.item.name)}
                    >
                      <title>
                        {slice.item.name}: {slice.item.count} người ({slice.item.percent}%)
                      </title>
                    </path>
                  );
                })}
              </g>

              {/* 4. Đường chỉ dẫn kèm nhãn số lượng & % (GHI CHÚ SỐ LƯỢNG KÈM TỶ LỆ %) */}
              <g className="pointer-events-none">
                {slices.map((slice) => {
                  const { item, leaderLine, isHovered } = slice;
                  if (item.count === 0) return null;

                  return (
                    <g key={`leader-${slice.index}`} className="transition-opacity duration-200">
                      {/* Đường line chỉ từ mặt 3D */}
                      <path
                        d={`M ${leaderLine.x1} ${leaderLine.y1} L ${leaderLine.x2} ${leaderLine.y2} L ${leaderLine.x3} ${leaderLine.y3}`}
                        fill="none"
                        stroke={isHovered ? item.colorTop : '#94a3b8'}
                        strokeWidth={isHovered ? '2' : '1.2'}
                        strokeDasharray={isHovered ? 'none' : '3,2'}
                      />
                      {/* Chấm tròn nối đầu mũi kim */}
                      <circle
                        cx={leaderLine.x1}
                        cy={leaderLine.y1}
                        r={isHovered ? 3.5 : 2.5}
                        fill={item.colorTop}
                        stroke="#ffffff"
                        strokeWidth="1"
                      />

                      {/* Ghi chú: Dòng 1 Tên trình độ */}
                      <text
                        x={leaderLine.textX}
                        y={leaderLine.textY - 5}
                        textAnchor={leaderLine.textAnchor}
                        fill={isHovered ? item.colorSide : '#1e293b'}
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {item.name}
                      </text>

                      {/* Ghi chú: Dòng 2 SỐ LƯỢNG KÈM TỶ LỆ % */}
                      <text
                        x={leaderLine.textX}
                        y={leaderLine.textY + 11}
                        textAnchor={leaderLine.textAnchor}
                        fill={isHovered ? '#9a3412' : '#c2410c'}
                        fontSize="11"
                        fontWeight="800"
                        fontFamily="sans-serif"
                      >
                        {item.count} người ({item.percent}%)
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            )}
          </div>

          <div className="text-[11px] text-slate-500 mt-2 text-center flex items-center justify-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            <span>
              Di chuột vào từng lát cắt 3D để xem nổi khối và chi tiết số lượng &bull; Nhấp để lọc danh sách
            </span>
          </div>
        </div>

        {/* Right Column: Detailed Breakdown Cards & Stats Table */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-teal-600" />
                <span>BẢNG CHI TIẾT SỐ LƯỢNG & TỶ LỆ (%)</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Phạm vi: <strong className="text-slate-800">{activeStaffType === 'ALL' ? 'Toàn bộ 6 loại hình' : activeStaffType}</strong>
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-orange-900 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-200">
              {currentTotal} nhân sự
            </span>
          </div>

          {/* Cards for each degree level */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {degreeItems.map((item, index) => {
              const isHovered = hoveredIndex === index;
              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => onFilterDegree && onFilterDegree(item.name)}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isHovered
                      ? 'border-orange-400 bg-orange-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs"
                        style={{ backgroundColor: item.colorTop }}
                      />
                      <span className="font-bold text-xs text-slate-800">{item.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${item.badgeClass}`}>
                        {item.description}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-slate-900">{item.count}</span>
                      <span className="text-[11px] text-slate-500">người</span>
                      <span className="text-xs font-bold font-mono text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                        {item.percent}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(item.percent, 3)}%`,
                        backgroundColor: item.colorTop,
                      }}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      Nam: <strong className="text-blue-700">{item.maleCount}</strong> &bull; Nữ: <strong className="text-pink-700">{item.femaleCount}</strong>
                    </span>
                    <span className="text-orange-700 font-medium hover:underline flex items-center gap-0.5">
                      Xem cán bộ <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quy chuẩn cơ cấu nhân lực Chi cục */}
          <div className="p-3 bg-gradient-to-r from-teal-50 to-sky-50 rounded-xl border border-teal-200/80 text-[11px] text-teal-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-teal-950">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>Định biên chuẩn chức danh nghề nghiệp Chi cục</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              100% công chức, viên chức ngạch kiểm tra viên chăn nuôi & kiểm dịch viên thú y đảm bảo chuẩn hóa văn bằng chuyên môn trình độ Đại học trở lên theo quy định của Bộ Nông nghiệp & PTNT và Sở Nội vụ TP.HCM.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Education3DPieChart;
