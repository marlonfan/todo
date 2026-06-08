export function resolveTaskListSelection({
  selectedTaskID,
  filteredTaskIDs,
  allTaskIDs,
  equivalentTaskID = 0,
  preserveCurrent = false,
}) {
  const currentFilteredIDs = Array.isArray(filteredTaskIDs) ? filteredTaskIDs : [];
  const selectedID = selectedTaskID || 0;
  const selectedIDText = String(selectedID || '');
  const equivalentID = equivalentTaskID || 0;
  const equivalentIDText = String(equivalentID || '');
  const selectedExistsInAllTasks = (Array.isArray(allTaskIDs) ? allTaskIDs : [])
    .some((id) => String(id || '') === selectedIDText);
  const selectedExistsInFilteredTasks = currentFilteredIDs
    .some((id) => String(id || '') === selectedIDText);
  const equivalentExistsInFilteredTasks = equivalentIDText
    && equivalentIDText !== selectedIDText
    && currentFilteredIDs.some((id) => String(id || '') === equivalentIDText);

  if (currentFilteredIDs.length === 0) {
    if (preserveCurrent && selectedID && selectedExistsInAllTasks) {
      return { action: 'keep', selectedTaskID: selectedID };
    }
    return { action: 'clear', selectedTaskID: 0 };
  }

  if (selectedExistsInFilteredTasks) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  if (equivalentExistsInFilteredTasks) {
    return { action: 'select', selectedTaskID: equivalentID };
  }

  if (Number(selectedID) < 0) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  if (preserveCurrent && selectedID && selectedExistsInAllTasks) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  return { action: 'select', selectedTaskID: currentFilteredIDs[0] };
}
