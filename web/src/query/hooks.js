import { useQuery } from '@tanstack/react-query';
import { caldavAPI, categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from './keys';
import { readCategories, readTasks, replaceCategories, upsertTasks } from '../data/localStore';
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
      const cached = await readTasks();
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
      await upsertTasks(synced);
      scheduleSync();
      return synced;
    },
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const cached = await readCategories();
      if (Array.isArray(cached) && cached.length > 0) {
        scheduleSync();
        return cached;
      }

      const res = await categoriesAPI.list();
      const list = Array.isArray(res.data) ? res.data : [];
      await replaceCategories(list);
      scheduleSync();
      return list;
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
