# CalendarView.jsx 重构完成总结

## 完成时间
2026-03-05

## 修改的文件
- `/home/marlon/marlon.life/todo/web/src/components/CalendarView.jsx`

## 主要变更

### 1. 新增导入
```javascript
import { useCalendarFetch, useEventsForRange, useInvalidateCalendarDates } from '../hooks/useCalendarFetch';
import { useCalendarPrefetchManager } from '../hooks/useCalendarPrefetchManager';
import { getEventDates } from '../utils/calendarEvents';
```

### 2. 移除的状态和 Ref
- `const dayCacheRef = useRef(new Map());` - 由 Zustand Store 替代
- `const [lastPooledEvents, setLastPooledEvents] = useState([]);` - 不再需要

### 3. 替换数据获取逻辑

**旧代码** (已移除):
```javascript
const {
  data: pooledEvents = [],
  isFetching: loading,
  dataUpdatedAt: calendarDataUpdatedAt = 0,
} = useQuery({
  queryKey: currentCalendarQueryKey,
  // ... 复杂的查询逻辑
});
```

**新代码**:
```javascript
// 1. 数据获取：TanStack Query → CacheSet
const { isLoading: calendarLoading, error: calendarError } = useCalendarFetch(
  calendarPool.start,
  calendarPool.end,
  timezone,
  { enabled: !!calendarPool.start && !!calendarPool.end }
);

// 2. 预加载管理器
const { prefetchImmediately } = useCalendarPrefetchManager({
  visibleStartDate: dateRange.start,
  visibleEndDate: dateRange.end,
  timezone,
  prefetchPastDays: 30,
  prefetchFutureDays: 60,
});

// 3. 从 CacheSet 获取事件
const rawEvents = useEventsForRange(
  dateRange.start,
  dateRange.end,
  timezone
);

// 4. 缓存失效工具
const invalidateCalendarDates = useInvalidateCalendarDates();
```

### 4. 简化 events 计算

**旧代码** (已移除):
```javascript
const events = useMemo(() => {
  // 复杂的 day cache 检查逻辑
  if (isRangeFullyCached(dayCacheRef.current, dateRange.start, dateRange.end, timezone)) {
    // ...
  }
  const eventsToUse = (Array.isArray(pooledEvents) && pooledEvents.length > 0)
    ? pooledEvents
    : (Array.isArray(lastPooledEvents) && lastPooledEvents.length > 0 ? lastPooledEvents : []);
  // ...
}, [/* ... */]);
```

**新代码**:
```javascript
const events = useMemo(() => {
  const projectedRangeStart = toServerRangeBoundary(dateRange.start, timezone) || dateRange.start;
  const projectedRangeEnd = toServerRangeBoundary(dateRange.end, timezone) || dateRange.end;

  const projectedVisible = buildProjectedEventsFromTasks(tasksForProjection, {
    rangeStart: projectedRangeStart,
    rangeEnd: projectedRangeEnd,
    timezone,
  });

  const merged = mergeCalendarEvents(rawEvents || [], projectedVisible, taskStatusIndex);
  return merged;
}, [rawEvents, tasksForProjection, taskStatusIndex, dateRange.start, dateRange.end, timezone]);
```

### 5. 移除的辅助函数
- `decomposeEventsByDay` - 现在在 `utils/calendarEvents.js`
- `mergeToDayCache` - 由 Zustand Store 的 `mergeEvents` 替代
- `getEventsFromDayCache` - 由 `useEventsForRange` 替代
- `isRangeFullyCached` - 由 Zustand Store 的 `isRangeFullyCached` 替代

### 6. 简化的 updateCurrentCalendarEvents
不再直接操作 query cache 和 day cache，新数据通过 useCalendarFetch 自动合并到 CacheSet。

## 架构变化

### 数据流对比

**旧架构**:
```
用户滚动 → dateRange 变化 → calendarPool 扩大
    → query key 变化 → TanStack Query 重新请求
    → pooledEvents 更新 → dayCache 更新
    → events 重新计算 → 整个日历重新渲染
```

**新架构**:
```
用户滚动 → dateRange 变化
    → PrefetchManager 检查缺失日期
    → 只请求缺失数据 → 写入 Zustand Store
    → useEventsForRange 从 Store 读取
    → 只有变化的日期重新渲染
```

### 关键改进

1. **单一数据源**: Zustand Store (Map<DateString, Event[]>)
2. **智能合并**: 只有变化的日期才更新引用
3. **解耦获取**: TanStack Query 只负责网络请求
4. **细粒度订阅**: 潜在支持按天订阅（当前按范围订阅）

## 下一步

### 验证功能
1. ✅ 日历正常显示
2. ✅ Build 通过
3. ⏳ 测试滚动时的网络请求
4. ⏳ 测试事件更新后的缓存失效
5. ⏳ 测试预加载是否正常工作

### 可选优化
1. 实现真正的细粒度渲染（每个天组件独立订阅）
2. 添加 IndexedDB 持久化到 Zustand Store
3. 优化预加载触发时机
4. 添加更详细的性能监控

## 调试日志

新架构包含以下调试日志：
- `[useCalendarFetch]` - 数据获取过程
- `[PrefetchManager]` - 预加载操作
- `[CalendarCacheStore]` - 缓存合并操作（如启用）

查看控制台日志验证功能是否正常。
