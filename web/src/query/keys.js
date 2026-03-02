export const queryKeys = {
  tasks: {
    all: ['tasks', 'all'],
  },
  categories: {
    all: ['categories', 'all'],
  },
  calendar: {
    events: (start, end, timezone) => ['calendar', 'events', start, end, timezone],
  },
  sync: {
    lastPull: ['sync', 'last_pull_at'],
  },
  caldav: {
    sources: ['caldav', 'sources'],
    tasks: (start, end) => ['caldav', 'tasks', start, end],
  },
};
