export function getRejectedMutationTaskPatch(op, message) {
  const patch = {
    sync_state: 'error',
    last_error: String(message || 'sync failed'),
  };
  const confirmedRevision = Number(op?.if_match_revision || 0);
  if (confirmedRevision > 0) {
    patch.revision = confirmedRevision;
  }
  return patch;
}
