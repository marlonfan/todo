import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarRangeEntryContainsTask } from './localStore.js';

function makeEvent(taskID) {
  return {
    extendedProps: {
      taskId: taskID,
    },
  };
}

test('calendarRangeEntryContainsTask checks events_by_date cache entries', () => {
  const entry = {
    events_by_date: {
      '2026-03-01': [makeEvent(12)],
      '2026-03-02': [],
    },
  };

  assert.equal(calendarRangeEntryContainsTask(entry, 12), true);
  assert.equal(calendarRangeEntryContainsTask(entry, 99), false);
});
