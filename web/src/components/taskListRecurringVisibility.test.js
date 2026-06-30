import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTaskUnsyncedLocally,
  shouldHideRecurringSeriesAnchorInPending,
} from './taskListRecurringVisibility.js';

test('isTaskUnsyncedLocally treats pending/syncing/staged/error as unsynced', () => {
  assert.equal(isTaskUnsyncedLocally({ sync_state: 'pending' }), true);
  assert.equal(isTaskUnsyncedLocally({ sync_state: 'syncing' }), true);
  assert.equal(isTaskUnsyncedLocally({ sync_state: 'staged' }), true);
  assert.equal(isTaskUnsyncedLocally({ sync_state: 'error' }), true);
});

test('isTaskUnsyncedLocally treats synced as synced', () => {
  assert.equal(isTaskUnsyncedLocally({ sync_state: 'synced' }), false);
  assert.equal(isTaskUnsyncedLocally({ sync_state: '' }), false);
  assert.equal(isTaskUnsyncedLocally({}), false);
});

test('should hide recurring anchor only when next occurrences are fetched and task is synced pending', () => {
  assert.equal(shouldHideRecurringSeriesAnchorInPending({
    task: { status: 'pending', sync_state: 'synced' },
    hasNextPending: false,
    nextOccurrencesFetched: true,
  }), true);

  assert.equal(shouldHideRecurringSeriesAnchorInPending({
    task: { status: 'pending', sync_state: 'pending' },
    hasNextPending: false,
    nextOccurrencesFetched: true,
  }), false);

  assert.equal(shouldHideRecurringSeriesAnchorInPending({
    task: { status: 'pending', sync_state: 'synced' },
    hasNextPending: false,
    nextOccurrencesFetched: false,
  }), false);

  assert.equal(shouldHideRecurringSeriesAnchorInPending({
    task: { status: 'completed', sync_state: 'synced' },
    hasNextPending: false,
    nextOccurrencesFetched: true,
  }), false);

  assert.equal(shouldHideRecurringSeriesAnchorInPending({
    task: { status: 'pending', sync_state: 'synced' },
    hasNextPending: true,
    nextOccurrencesFetched: true,
  }), false);
});
