# 日历组件重构架构文档

## 概述

本次重构解决了按「起止日期」作为 TanStack Query 缓存 Key 导致的数据冗余、无法复用和页面全量重渲染问题。

## 核心架构

### 1. 全局标准化缓存池 (Normalized CacheSet)

**文件**: `src/stores/calendarCacheStore.js`

```javascript
// 数据结构
{
  eventsByDate: Map<DateString, Event[]>,  // 按日期索引的事件
  metadata: {
    lastSyncAt: timestamp,
    loadedRanges: Array<{start, end, timezone}>
  }
}
```

**核心方法**:
- `mergeEvents(newEventsByDate)` - 智能合并，只更新变化的日期
- `getEventsForDate(dateString)` - 获取单日事件
- `getEventsForRange(start, end)` - 获取范围事件
- `isRangeFullyCached(start, end)` - 检查是否完全缓存

### 2. 解耦 Fetching 与 Storage

**文件**: `src/hooks/useCalendarFetch.js`

```javascript
// TanStack Query 只负责网络请求
const { isLoading, error } = useCalendarFetch(startDate, endDate, timezone);

// 数据自动写入 CacheSet
useEffect(() => {
  if (data?.events) {
    const eventsByDate = decomposeEventsByDay(events, timezone);
    cacheStore.mergeEvents(eventsByDate);  // 智能合并
  }
}, [data]);
```

### 3. 细粒度渲染 (Granular Reactivity)

**文件**: `src/components/CalendarDayCell.jsx`

```javascript
// 每个天组件只订阅自己的日期
const CalendarDayCell = memo(({ date }) => {
  const events = useEventsForDate(date);  // 精准订阅
  return <div>{events.map(...)}</div>;
});
```

**关键**: 只有该日期的事件引用变化时，组件才重新渲染。

### 4. 智能预加载

**文件**: `src/hooks/useCalendarPrefetchManager.js`

```javascript
// 后台预加载用户可能滚动到的数据
useCalendarPrefetchManager({
  visibleStartDate,
  visibleEndDate,
  timezone,
  prefetchPastDays: 30,
  prefetchFutureDays: 60,
});
```

## 集成步骤

### 步骤 1: 安装依赖

```bash
npm install zustand immer
```

### 步骤 2: 在 CalendarView 中替换数据获取逻辑

找到现有的 `useQuery` 调用，替换为：

```javascript
// 旧代码
const { data: pooledEvents } = useQuery({
  queryKey: ['calendar', 'events', calendarPool.start, calendarPool.end, timezone],
  queryFn: async () => { /* ... */ },
});

// 新代码
const { isLoading } = useCalendarFetch(
  calendarPool.start,
  calendarPool.end,
  timezone
);

// 从 CacheSet 获取事件
const events = useEventsForRange(
  dateRange.start,
  dateRange.end,
  timezone
);
```

### 步骤 3: 添加预加载管理器

```javascript
const { prefetchImmediately } = useCalendarPrefetchManager({
  visibleStartDate: dateRange.start,
  visibleEndDate: dateRange.end,
  timezone,
});

// 组件挂载时立即预加载
useEffect(() => {
  prefetchImmediately();
}, [prefetchImmediately]);
```

### 步骤 4: 更新事件处理逻辑

```javascript
const invalidateDates = useInvalidateCalendarDates();

const handleEventUpdate = async (event) => {
  // 使相关日期的缓存失效
  const affectedDates = getEventDates(event, timezone);
  invalidateDates(affectedDates);

  // 发送 API 请求
  // ...

  // 新数据会自动合并到缓存
};
```

## 文件结构

```
src/
├── stores/
│   └── calendarCacheStore.js          # Zustand 缓存池
├── hooks/
│   ├── useCalendarFetch.js            # 数据获取 Hook
│   └── useCalendarPrefetchManager.js  # 预加载管理器
├── components/
│   ├── CalendarDayCell.jsx            # 细粒度天组件
│   └── CalendarView.integration.example.jsx  # 集成示例
└── utils/
    └── calendarEvents.js              # 事件处理工具函数
```

## 关键优势

| 旧架构 | 新架构 |
|--------|--------|
| Query Key = 日期范围 | Query Key 只是请求标识 |
| 相同范围重复请求 | CacheSet 自动去重 |
| 滚动时整个日历重渲染 | 只有变化的日期重渲染 |
| 内存中多份相同数据 | 单一数据源，无冗余 |

## 调试日志

所有模块都包含详细的控制台日志，前缀为：
- `[useCalendarFetch]` - 数据获取
- `[PrefetchManager]` - 预加载
- `[CalendarCacheStore]` - 缓存操作
- `[CalendarDayCell]` - 组件渲染

## 下一步

1. 将 `useCalendarFetch` 集成到现有 `CalendarView.jsx`
2. 替换现有的 `pooledEvents` 逻辑
3. 测试滚动性能和缓存行为
4. 根据需要调整预加载参数
