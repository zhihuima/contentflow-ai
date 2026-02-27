// ============================================================
// 高密度信息大图提示词库 (Based on AJ Skills Prompts)
// 8 套风格：坐标蓝图、复古波普、文件夹、热敏纸、档案柜、色块、票据、简约现代
// ============================================================

export interface ImageStyle {
    id: string;
    name: string;
    description: string;
    colors: {
        background: string;
        primary: string;
        accent: string;
        highlight: string;
        text: string;
    };
    promptTemplate: string;
}

// ============================================================
// 8 套高密度信息大图风格
// ============================================================
export const IMAGE_STYLES: ImageStyle[] = [
    {
        id: 'blueprint',
        name: '坐标蓝图·波普实验室',
        description: '技术拆解类、科学解释类，实验室精密感 + 波普艺术',
        colors: {
            background: '#F2F2F2',
            primary: '#B8D8BE',
            accent: '#E91E63',
            highlight: '#FFF200',
            text: '#2D2926',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Blueprint Lab + Pop Art" style.

Visual Design Requirements:
- Background: Professional grayish-white with faint blueprint grid texture (#F2F2F2)
- Main functional blocks use muted Teal/Sage Green (#B8D8BE) for stable data zones
- Key highlights and alerts use vibrant Fluorescent Pink (#E91E63)
- Keywords marked with vivid Lemon Yellow (#FFF200) translucent highlighter effect
- Ultra-fine grid lines and coordinate markers in Charcoal Brown (#2D2926)
- Layout: 6-7 modular information blocks arranged in a technical coordinate system
- Each module has a "Visual Coordinate" code (like A-01, B-05)
- Typography: Mix of monospace headers and clean sans-serif body text
- Include decorative elements: crosshairs, measurement lines, data callout bubbles
- Overall aesthetic: Lab report meets Pop Art poster`,
    },
    {
        id: 'retro-pop',
        name: '复古波普网格风',
        description: '社交媒体内容、时尚资讯类，70年代复古波普高对比度',
        colors: {
            background: '#FFF5E6',
            primary: '#FF6B35',
            accent: '#004E89',
            highlight: '#FFCD00',
            text: '#1A1A1A',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Retro Pop Art Grid" style.

Visual Design Requirements:
- Layout: Swiss Grid system with high information density
- Bold outlines (3-4px) around all elements with flat color fills
- Retro 70s color palette: warm oranges, deep blues, bright yellows
- Halftone dot patterns and Ben-Day dots as decorative textures
- Bold, chunky typography with shadow effects
- Mix of illustration and geometric shapes
- Comic-book style speech bubbles for key stats/data
- Sticker-like labels and badges for categories
- 6-7 sub-theme modules packed with specific data and numbers
- Overall aesthetic: 70s magazine meets modern data visualization`,
    },
    {
        id: 'folder',
        name: '文件夹风格',
        description: '整理攻略类、工具合集类，文件夹收纳感',
        colors: {
            background: '#FAFAF5',
            primary: '#E8D5B7',
            accent: '#D4956A',
            highlight: '#7CA982',
            text: '#3D3D3D',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Stationery Folder Archive" style.

Visual Design Requirements:
- Background: Warm off-white paper texture (#FAFAF5), slight grain
- Main containers styled as Manila file folders with visible tabs
- Color-coded index tabs in warm tones (beige #E8D5B7, terracotta #D4956A, sage #7CA982)
- 3D-styled illustrations of office stationery: paper clips, binder clips, sticky notes
- Hand-written style labels on folder tabs
- Visible folder edges and paper stack layering effects
- Content organized as if sorted into different file categories
- Post-it notes with handwritten tips scattered around
- Rubber stamps and wax seal decorative elements
- Y2K Tech-Nostalgia aesthetic: retro meets organized
- 6-7 folder modules each containing structured data`,
    },
    {
        id: 'thermal',
        name: '打印热敏纸风',
        description: '清单推荐类、避坑指南类，收据/热敏纸打印感',
        colors: {
            background: '#FAF8F0',
            primary: '#333333',
            accent: '#CC0000',
            highlight: '#FFEB3B',
            text: '#1A1A1A',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Thermal Receipt Paper" style.

Visual Design Requirements:
- Background: Slightly yellowed receipt paper texture (#FAF8F0) with subtle thermal fade
- Main text and data in monospace/typewriter font style, dark ink (#333333)
- Receipt-style dotted divider lines between sections
- Red stamp marks (#CC0000) for important items (like "APPROVED" or "TOP PICK")
- Yellow highlighter stripes (#FFEB3B) on key data points
- Barcode and QR code decorative elements
- Price tag and discount label styling for recommendations
- Perforated tear-edge effect at top and bottom
- Running total / summary section at bottom
- Cashier receipt column layout with item - description - value format
- 6-7 line-item modules with specific data in each`,
    },
    {
        id: 'archive',
        name: '档案柜风格',
        description: '知识体系类、学习框架类，档案管理专业感',
        colors: {
            background: '#F0EDE6',
            primary: '#5B7065',
            accent: '#C17F59',
            highlight: '#DFC87A',
            text: '#2C2C2C',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Filing Cabinet Archive" style.

Visual Design Requirements:
- Background: Aged paper texture (#F0EDE6), vintage document feel
- Main layout structured as a filing cabinet with labeled drawers
- Deep sage green (#5B7065) drawer handles and frame elements
- Copper/bronze (#C17F59) metal fittings and label holders
- Gold/amber (#DFC87A) highlighted document tabs
- Rubber stamp marks, date stamps, and classification codes
- Visible document edges peeking out of drawers
- Typewriter-style text on document labels
- Red "CLASSIFIED" or "IMPORTANT" stamps for emphasis
- Index card cross-reference system aesthetic
- 6-7 drawer/document modules with structured content`,
    },
    {
        id: 'colorblock',
        name: '色块风',
        description: '对比分析类、功能介绍类，大胆色块几何构图',
        colors: {
            background: '#FFFFFF',
            primary: '#4A90D9',
            accent: '#FFB347',
            highlight: '#FF6B6B',
            text: '#2D2D2D',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Bold Color Block" style.

Visual Design Requirements:
- Clean white background (#FFFFFF) with bold geometric color blocks
- Primary blocks in confident blue (#4A90D9), creating visual anchor
- Accent blocks in warm amber (#FFB347) for secondary information
- Highlight blocks in coral red (#FF6B6B) for key data/warnings
- Sharp geometric shapes: rectangles, circles, triangles as containers
- High contrast between adjacent color blocks
- Modern sans-serif typography, large numbers for statistics
- Overlapping shapes creating depth and visual hierarchy
- Minimal icons inside colored blocks
- Brutalist design influence with strong grid structure
- 6-7 color-coded modules with clear information hierarchy`,
    },
    {
        id: 'receipt',
        name: '票据风',
        description: '评测对比类、性价比分析类，购物小票/发票感',
        colors: {
            background: '#FFFFF0',
            primary: '#4A4A4A',
            accent: '#E63946',
            highlight: '#2196F3',
            text: '#1A1A1A',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Invoice & Receipt" style.

Visual Design Requirements:
- Background: Invoice paper white (#FFFFF0) with subtle ruled lines
- Main layout mimics a detailed invoice/purchase order format
- Dark gray (#4A4A4A) table borders and line items
- Red (#E63946) circle stamps/checkmarks for recommended items
- Blue (#2196F3) underlines and price comparison highlights
- Table-structured data with columns: Item, Specs, Score, Verdict
- Dollar signs, percentage badges, and star ratings for comparisons
- Carbon copy / duplicate paper layering effect
- Official-looking header with company seal and invoice number
- Calculator display showing totals at bottom
- 6-7 line-item comparison modules with detailed specs`,
    },
    {
        id: 'modern-minimal',
        name: '简约现代风',
        description: '通用型、品牌介绍类，苹果风极简主义',
        colors: {
            background: '#FAFAFA',
            primary: '#1D1D1F',
            accent: '#0071E3',
            highlight: '#34C759',
            text: '#1D1D1F',
        },
        promptTemplate: `Create a high-density infographic illustration in a "Modern Minimalist" Apple-inspired style.

Visual Design Requirements:
- Ultra-clean white/light gray background (#FAFAFA) with generous whitespace
- Primary text and elements in near-black (#1D1D1F) for maximum readability
- Accent color: Apple Blue (#0071E3) for interactive elements and highlights
- Success/positive indicators in Apple Green (#34C759)
- SF Pro-inspired typography with precise weight hierarchy
- Card-based layout with subtle shadows (elevation effect)
- Frosted glass / glassmorphism effect on some containers
- Thin, precise iconography (SF Symbols style)
- Smooth gradients on key visual elements
- Generous padding and breathing room between modules
- 6-7 clean card modules with clear typography hierarchy`,
    },
];

/**
 * 根据内容类型自动推荐最适合的配图风格
 */
export function recommendStyle(contentType: string, platform?: string): ImageStyle {
    const type = contentType.toLowerCase();

    // 技术/教程类 → 坐标蓝图
    if (type.includes('教程') || type.includes('技术') || type.includes('原理') || type.includes('拆解')) {
        return IMAGE_STYLES[0]; // blueprint
    }
    // 时尚/社交 → 复古波普
    if (type.includes('时尚') || type.includes('穿搭') || type.includes('美妆') || type.includes('潮流')) {
        return IMAGE_STYLES[1]; // retro-pop
    }
    // 合集/攻略 → 文件夹
    if (type.includes('合集') || type.includes('攻略') || type.includes('整理') || type.includes('推荐')) {
        return IMAGE_STYLES[2]; // folder
    }
    // 清单/避坑 → 热敏纸
    if (type.includes('清单') || type.includes('避坑') || type.includes('必买') || type.includes('榜单')) {
        return IMAGE_STYLES[3]; // thermal
    }
    // 学习/知识 → 档案柜
    if (type.includes('学习') || type.includes('知识') || type.includes('框架') || type.includes('体系')) {
        return IMAGE_STYLES[4]; // archive
    }
    // 对比/功能 → 色块
    if (type.includes('对比') || type.includes('区别') || type.includes('测评') || type.includes('功能')) {
        return IMAGE_STYLES[5]; // colorblock
    }
    // 性价比/评测 → 票据
    if (type.includes('性价比') || type.includes('评测') || type.includes('价格') || type.includes('值不值')) {
        return IMAGE_STYLES[6]; // receipt
    }

    // 小红书默认 → 简约现代; 其他默认 → 色块
    if (platform === 'xhs') return IMAGE_STYLES[7]; // modern-minimal
    return IMAGE_STYLES[5]; // colorblock
}

/**
 * 获取指定风格的配图提示词
 */
export function getStyleById(styleId: string): ImageStyle | undefined {
    return IMAGE_STYLES.find(s => s.id === styleId);
}

/**
 * 获取所有可用的配图风格（供前端选择）
 */
export function getAllStyles(): Pick<ImageStyle, 'id' | 'name' | 'description'>[] {
    return IMAGE_STYLES.map(({ id, name, description }) => ({ id, name, description }));
}
