import { useQuery } from '@tanstack/react-query';
import { categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from './keys';
import { readCategories, readTasks, replaceCategories, upsertTasks } from '../data/localStore';
import { scheduleSync } from '../data/syncEngine';

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
