import { useQuery } from '@tanstack/react-query';
import { categoriesAPI, tasksAPI } from '../api/client';
import { queryKeys } from './keys';

export function useTasksQuery() {
  return useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: async () => {
      const res = await tasksAPI.list();
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const res = await categoriesAPI.list();
      return Array.isArray(res.data) ? res.data : [];
    },
  });
}

