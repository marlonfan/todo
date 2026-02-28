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
};

