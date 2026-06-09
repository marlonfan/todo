import { useQuery, useQueryClient } from '@tanstack/react-query';
import { caldavAPI, categoriesAPI, promptsAPI, tasksAPI } from '../api/client';
import { queryKeys } from './keys';
import {
  readCategories,
  readTaskActivities,
  readTasks,
  replaceCategories,
  replaceTaskActivitiesForTask,
  upsertTasks,
} from '../data/localStore';
import { scheduleSync } from '../data/syncEngine';

const CALDAV_TASKS_CACHE_KEY = 'caldav_tasks_cache_v1';

function readCaldavTasksCache(start, end) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CALDAV_TASKS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.range_start !== start || parsed.range_end !== end) return [];
    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  } catch {
    return [];
  }
}

function writeCaldavTasksCache(start, end, tasks) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CALDAV_TASKS_CACHE_KEY, JSON.stringify({
      range_start: start,
      range_end: end,
      updated_at: Date.now(),
      tasks: Array.isArray(tasks) ? tasks : [],
    }));
  } catch {
    // Ignore localStorage failures (quota/privacy mode)
  }
}

export function useTasksQuery() {
  return useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      let cached = [];
      try {
        cached = await readTasks();
      } catch (error) {
        console.error('Failed to read tasks from local cache, falling back to server:', error);
      }
      if (Array.isArray(cached) && cached.length > 0) {
        scheduleSync();
        return cached;
      }

      const res = await tasksAPI.list();
      const list = Array.isArray(res.data) ? res.data : [];
      const synced = list.map((task) => ({
        ...task,
        sync_state: 'synced',
        client_updated_at: task?.updated_at || new Date().toISOString(),
        last_error: '',
      }));
      try {
        await upsertTasks(synced);
      } catch (error) {
        console.error('Failed to persist server tasks into local cache:', error);
      }
      scheduleSync();
      return synced;
    },
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      let cached = [];
      try {
        cached = await readCategories();
      } catch (error) {
        console.error('Failed to read categories from local cache, falling back to server:', error);
      }
      if (Array.isArray(cached) && cached.length > 0) {
        scheduleSync();
        return cached;
      }

      const res = await categoriesAPI.list();
      const list = Array.isArray(res.data) ? res.data : [];
      try {
        await replaceCategories(list);
      } catch (error) {
        console.error('Failed to persist server categories into local cache:', error);
      }
      scheduleSync();
      return list;
    },
  });
}

export function usePromptsQuery() {
  return useQuery({
    queryKey: queryKeys.prompts.all,
    queryFn: async () => {
      const res = await promptsAPI.list();
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function usePromptHistoryQuery() {
  return useQuery({
    queryKey: queryKeys.prompts.history,
    queryFn: async () => {
      const res = await promptsAPI.listHistory({ limit: 100 });
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCaldavSourcesQuery() {
  return useQuery({
    queryKey: queryKeys.caldav.sources,
    queryFn: async () => {
      const res = await caldavAPI.listSources();
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCaldavTasksQuery(start, end) {
  return useQuery({
    queryKey: queryKeys.caldav.tasks(start || '', end || ''),
    enabled: Boolean(start && end),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialData: () => readCaldavTasksCache(start, end),
    queryFn: async () => {
      try {
        const res = await caldavAPI.listTasks({ start, end });
        const tasks = Array.isArray(res.data) ? res.data : [];
        writeCaldavTasksCache(start, end, tasks);
        return tasks;
      } catch (err) {
        const fallback = readCaldavTasksCache(start, end);
        if (fallback.length > 0) return fallback;
        throw err;
      }
    },
  });
}

const taskActivitiesRefreshMap = new Map();

function normalizeTaskActivities(items) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => Number(item?.id || 0) > 0)
    .sort((a, b) => {
      const timeA = Date.parse(a?.occurred_at || '') || 0;
      const timeB = Date.parse(b?.occurred_at || '') || 0;
      if (timeA !== timeB) return timeB - timeA;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
}

function refreshTaskActivitiesInBackground(taskID, limit, queryClient) {
  const key = Number(taskID) || 0;
  if (!key) return;
  if (taskActivitiesRefreshMap.get(key)) return;
  taskActivitiesRefreshMap.set(key, true);
  void (async () => {
    try {
      const res = await tasksAPI.listActivities(key, { limit });
      const list = normalizeTaskActivities(res?.data);
      await replaceTaskActivitiesForTask(key, list);
      queryClient.setQueryData(queryKeys.tasks.activities(key), list);
    } catch (error) {
      console.error('Failed to refresh task activities:', error);
    } finally {
      taskActivitiesRefreshMap.delete(key);
    }
  })();
}

export function useTaskActivitiesQuery(taskID, options = {}) {
  const queryClient = useQueryClient();
  const numericTaskID = Number(taskID) || 0;
  const limit = Number(options?.limit || 200) || 200;
  const enabled = options?.enabled !== false && numericTaskID > 0;

  return useQuery({
    queryKey: queryKeys.tasks.activities(numericTaskID),
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const cached = await readTaskActivities(numericTaskID, limit);
      if (cached.length > 0) {
        refreshTaskActivitiesInBackground(numericTaskID, limit, queryClient);
        return normalizeTaskActivities(cached);
      }
      const res = await tasksAPI.listActivities(numericTaskID, { limit });
      const list = normalizeTaskActivities(res?.data);
      await replaceTaskActivitiesForTask(numericTaskID, list);
      return list;
    },
  });
}
