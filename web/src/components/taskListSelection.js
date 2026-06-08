export function resolveTaskListSelection({
  selectedTaskID,
  filteredTaskIDs,
  allTaskIDs,
  preserveCurrent = false,
}) {
  const currentFilteredIDs = Array.isArray(filteredTaskIDs) ? filteredTaskIDs : [];
  const selectedID = selectedTaskID || 0;
  const selectedIDText = String(selectedID || '');
  const selectedExistsInAllTasks = (Array.isArray(allTaskIDs) ? allTaskIDs : [])
    .some((id) => String(id || '') === selectedIDText);
  const selectedExistsInFilteredTasks = currentFilteredIDs
    .some((id) => String(id || '') === selectedIDText);

  if (currentFilteredIDs.length === 0) {
    if (preserveCurrent && selectedID && selectedExistsInAllTasks) {
      return { action: 'keep', selectedTaskID: selectedID };
    }
    return { action: 'clear', selectedTaskID: 0 };
  }

  if (selectedExistsInFilteredTasks) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  if (Number(selectedID) < 0) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  if (preserveCurrent && selectedID && selectedExistsInAllTasks) {
    return { action: 'keep', selectedTaskID: selectedID };
  }

  return { action: 'select', selectedTaskID: currentFilteredIDs[0] };
}
