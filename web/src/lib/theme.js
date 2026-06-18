// 设计系统 token 工具（阶段 0）
// 供无法走 Tailwind utility 的场景（canvas / 动态 inline style）读取语义色，
// 并把散落的分类色 alpha / fallback 计算收口到单点。逻辑等价、可单点维护。

// 分类色无值时的回退（替代散落的硬编码 #94a3b8）。
export const FALLBACK_CATEGORY_COLOR = 'hsl(var(--muted-foreground))';

// 将 hex 颜色附加 alpha，兼容带/不带 '#'、3/6 位写法。
// 例：hexWithAlpha('#2563eb', 0.125) -> 'rgba(37,99,235,0.125)'
// 收口现有 `${cat.color}20`（8 位 hex 拼接，0x20 ≈ 0.125）技巧，逻辑等价、更健壮。
// 无法解析时返回 null。
export function hexWithAlpha(hex, alpha) {
  if (typeof hex !== 'string' || !hex) return null;
  let value = hex.trim().replace(/^#/, '');
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) return null;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const a = typeof alpha === 'number' && Number.isFinite(alpha) ? alpha : 1;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// 解析分类颜色：有值用值（原样 hex），无值回退到 token。
export function resolveCategoryColor(cat) {
  const color = cat && typeof cat === 'object' ? cat.color : cat;
  return color && typeof color === 'string' ? color : FALLBACK_CATEGORY_COLOR;
}
