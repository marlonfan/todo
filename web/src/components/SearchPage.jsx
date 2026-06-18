import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import TaskModal from './TaskModal';
import { useTasksQuery } from '../query/hooks';
import { getUserTimezone } from '../utils/time';

function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const timezone = getUserTimezone();
  const { data: tasks = [], isLoading } = useTasksQuery();
  const [selectedTask, setSelectedTask] = useState(null);

  const params = new URLSearchParams(location.search);
  const query = String(params.get('q') || '');

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return [];
    return tasks.filter((task) => {
      const title = String(task.title || '').toLowerCase();
      const description = String(task.description || '').toLowerCase();
      const categoryText = (task.categories || [])
        .map((cat) => String(cat.name || '').toLowerCase())
        .join(' ');
      return title.includes(keyword) || description.includes(keyword) || categoryText.includes(keyword);
    });
  }, [query, tasks]);

  const submit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const next = String(formData.get('keyword') || '').trim();
    if (!next) {
      navigate('/search');
      return;
    }
    navigate(`/search?q=${encodeURIComponent(next)}`);
  };

  return (
    <div className="h-full overflow-auto bg-muted p-3 md:p-6">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={submit} className="mb-3 border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input
              name="keyword"
              defaultValue={query}
              placeholder={t('task.searchPlaceholder')}
              className="w-full border border-border-strong px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
            <button type="submit" className="bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-strong">
              {t('common.search')}
            </button>
          </div>
        </form>

        {!query.trim() && (
          <div className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {t('task.searchHint')}
          </div>
        )}

        {!!query.trim() && (
          <div className="border border-border bg-card p-2">
            {isLoading && <div className="px-3 py-6 text-sm text-muted-foreground">{t('common.loading')}</div>}
            {!isLoading && results.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                <p>{t('task.searchNoResults')}</p>
                <p className="mt-1 text-xs">{t('task.searchHint')}</p>
              </div>
            )}
            {!isLoading && results.length > 0 && (
              <div className="space-y-1">
                {results.map((task) => {
                  const timeValue = task.start_time || task.due_date || '';
                  const timeLabel = timeValue ? dayjs(timeValue).tz(timezone).format('MM-DD HH:mm') : t('task.noDate');
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className="block w-full border border-border px-3 py-2 text-left hover:bg-muted"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="truncate text-sm font-semibold text-foreground">{task.title || '-'}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{timeLabel}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSaved={(savedTask) => {
            setSelectedTask(savedTask || null);
          }}
        />
      )}
    </div>
  );
}

export default SearchPage;
