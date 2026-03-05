# CalendarView 重构 - 集成指南

## 概述

已完成日历组件核心架构的重构，创建了以下新文件：

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/stores/calendarCacheStore.js` | Zustand 全局缓存池 |
| `src/hooks/useCalendarFetch.js` | 数据获取 Hook |
| `src/hooks/useCalendarPrefetchManager.js` | 预加载管理器 |
| `src/utils/calendarEvents.js` | 事件处理工具函数 |
| `src/components/CalendarDayCell.jsx` | 细粒度天组件 |
| `src/components/CalendarViewNew.jsx` | 完整重构示例 |
| `src/components/CalendarView.refactor.patch` | 集成补丁 |

### 安装的依赖

```bash
npm install zustand immer
```

## 集成步骤

### 方法 A：渐进式集成（推荐）

按照 `CalendarView.refactor.patch` 中的步骤，逐步修改现有 `CalendarView.jsx`：

1. **添加新导入**
2. **移除不再需要的代码**
3. **替换数据获取逻辑**
4. **添加预加载管理器**
5. **替换 events 计算逻辑**
6. **添加缓存失效工具**
7. **更新事件处理函数**
8. **移除不再需要的 useEffect**
9. **简化 pool 扩展逻辑**
10. **更新 hasCalendarDataLoaded 逻辑**

### 方法 B：直接替换

使用 `CalendarViewNew.jsx` 替换现有的 `CalendarView.jsx`（需要手动添加回移动端相关代码）。

## 核心变更

### 1. 数据流变化

**旧架构**:
```
用户滚动 → dateRange 变化 → calendarPool 扩大
    → query key 变化 → TanStack Query 重新请求
    → pooledEvents 更新 → events 重新计算
    → 整个日历重新渲染
```

**新架构**:
```
用户滚动 → dateRange 变化
    → PrefetchManager 检查缺失日期
    → 只请求缺失数据 → 写入 CacheSet
    → useEventsForRange 从 CacheSet 读取
    → 只有变化的日期重新渲染
```

### 2. 关键 Hook 说明

#### useCalendarFetch

```javascript
const { isLoading, error } = useCalendarFetch(
  calendarPool.start,
  calendarPool.end,
  timezone
);
```

- 使用 TanStack Query 获取数据
- 自动按天分解并写入 CacheSet
- 智能合并，只更新变化的日期

#### useEventsForRange

```javascript
const events = useEventsForRange(
  dateRange.start,
  dateRange.end,
  timezone
);
```

- 从 CacheSet 获取指定范围的事件
- 订阅整个 CacheSet，但返回过滤后的结果
- 配合 useMemo 使用以获得最佳性能

#### useCalendarPrefetchManager

```javascript
const { prefetchImmediately } = useCalendarPrefetchManager({
  visibleStartDate: dateRange.start,
  visibleEndDate: dateRange.end,
  timezone,
  prefetchPastDays: 30,
  prefetchFutureDays: 60,
});
```

- 后台预加载用户可能滚动到的数据
- 检查 CacheSet 中已缓存的日期
- 只请求缺失的数据

#### useInvalidateCalendarDates

```javascript
const invalidateDates = useInvalidateCalendarDates();

// 使指定日期的缓存失效
invalidateDates(['2026-03-05', '2026-03-06']);
```

- 使指定日期的缓存失效
- 用于事件更新后

### 3. 工具函数

#### getEventDates

```javascript
import { getEventDates } from '../utils/calendarEvents';

const dates = getEventDates(event, timezone);
// ['2026-03-05', '2026-03-06']
```

获取事件涉及的所有日期。

#### decomposeEventsByDay

```javascript
import { decomposeEventsByDay } from '../utils/calendarEvents';

const eventsByDate = decomposeEventsByDay(events, timezone);
// Map<DateString, Event[]>
```

将事件数组按天分解。

## 调试

### 控制台日志

新架构包含详细的调试日志：

| 前缀 | 说明 |
|------|------|
| `[useCalendarFetch]` | 数据获取过程 |
| `[PrefetchManager]` | 预加载操作 |
| `[CalendarCacheStore]` | 缓存合并操作 |

### 验证功能

1. **基本功能**
   - 日历正常显示
   - 事件正确加载
   - 任务状态正确

2. **滚动性能**
   - 控制台查看预加载日志
   - 滚动时无空白闪烁
   - 已滚动过的日期不再请求

3. **事件更新**
   - 拖拽事件后正确更新
   - 任务状态变化后正确显示
   - 缓存正确失效

## 架构优势

| 方面 | 改进 |
|------|------|
| **缓存命中率** | 按天缓存，同一数据不重复请求 |
| **渲染性能** | 只有变化的日期重新渲染 |
| **内存使用** | 单一数据源，无冗余 |
| **代码复杂度** | 职责分离，更易维护 |
| **用户体验** | 无空白闪烁，滚动流畅 |

## 常见问题

### Q: 如何清空所有缓存？

```javascript
useCalendarCacheStore.getState().clear();
```

### Q: 如何检查某天是否有缓存？

```javascript
const isCached = useCalendarCacheStore(
  (state) => state.eventsByDate.has('2026-03-05')
);
```

### Q: 如何获取缓存的元数据？

```javascript
const metadata = useCalendarCacheStore(
  (state) => state.metadata
);
```

## 下一步

1. 按照 `CalendarView.refactor.patch` 修改现有 `CalendarView.jsx`
2. 测试所有功能
3. 根据需要调整预加载参数
4. 监控控制台日志验证性能

如有问题，请提供控制台日志以便调试。
