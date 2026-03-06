function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const COALESCE_WINDOW_MS = 15 * 60 * 1000;

function baseStatusPayload(payload) {
  const body = isPlainObject(payload) ? payload : {};
  return !body.instance_id && !body.occurrence_date;
}

function isCoalescibleOp(op) {
  if (!op || !op.op_type) return false;
  if (op.op_type === 'update' || op.op_type === 'schedule') return true;
  if (op.op_type === 'status') return baseStatusPayload(op.payload);
  return false;
}

function pickEarliestRevision(ops, fallback = 0) {
  const list = Array.isArray(ops) ? ops : [];
  for (const op of list) {
    const revision = Number(op?.if_match_revision || 0);
    if (revision > 0) return revision;
  }
  const base = Number(fallback || 0);
  return base > 0 ? base : undefined;
}

function getOpTimestamp(op) {
  const submitted = typeof op?.client_submitted_at === 'string'
    ? Date.parse(op.client_submitted_at)
    : NaN;
  if (Number.isFinite(submitted)) return submitted;
  return Number(op?.created_at || 0);
}

function pickRecentCoalescibleOps(ops, incoming) {
  const base = Array.isArray(ops) ? ops : [];
  if (base.length === 0) return [];
  const incomingTs = getOpTimestamp(incoming);
  if (!Number.isFinite(incomingTs) || incomingTs <= 0) {
    return base;
  }
  return base.filter((item) => {
    const currentTs = getOpTimestamp(item);
    if (!Number.isFinite(currentTs) || currentTs <= 0) return true;
    return Math.abs(incomingTs - currentTs) <= COALESCE_WINDOW_MS;
  });
}

export function getCoalescePlan(existingOps, incomingOp) {
  const current = Array.isArray(existingOps) ? existingOps : [];
  const incoming = incomingOp || {};
  const sameEntity = current
    .filter((item) => item?.entity_type === incoming.entity_type && item?.entity_id === incoming.entity_id)
    .sort((a, b) => Number(a?.created_at || 0) - Number(b?.created_at || 0));

  if (incoming.op_type === 'delete') {
    const pendingCreate = sameEntity.find((item) => item?.op_type === 'create');
    if (pendingCreate) {
      return {
        mode: 'drop_entity_ops',
        normalized: null,
        removeOpIDs: sameEntity.map((item) => item.op_id).filter(Boolean),
        updateCreate: null,
      };
    }
    return {
      mode: 'replace_with_delete',
      normalized: {
        ...incoming,
        if_match_revision: pickEarliestRevision(sameEntity, incoming.if_match_revision),
      },
      removeOpIDs: sameEntity
        .filter((item) => item?.op_type !== 'delete')
        .map((item) => item.op_id)
        .filter(Boolean),
      updateCreate: null,
    };
  }

  const canCoalesceIncoming = isCoalescibleOp(incoming);
  if (!canCoalesceIncoming) {
    return {
      mode: 'enqueue',
      normalized: incoming,
      removeOpIDs: [],
      updateCreate: null,
    };
  }

  const pendingCreate = sameEntity.find((item) => item?.op_type === 'create');
  if (pendingCreate) {
    return {
      mode: 'merge_into_create',
      normalized: incoming,
      removeOpIDs: [],
      updateCreate: {
        op_id: pendingCreate.op_id,
        payload: {
          ...(pendingCreate.payload || {}),
          ...(incoming.payload || {}),
        },
      },
    };
  }

  const existingCoalescible = pickRecentCoalescibleOps(
    sameEntity.filter((item) => isCoalescibleOp(item)),
    incoming,
  );
  if (!existingCoalescible.length) {
    return {
      mode: 'enqueue',
      normalized: incoming,
      removeOpIDs: [],
      updateCreate: null,
    };
  }

  let mergedPayload = {};
  existingCoalescible.forEach((item) => {
    mergedPayload = { ...mergedPayload, ...(item?.payload || {}) };
  });
  mergedPayload = { ...mergedPayload, ...(incoming.payload || {}) };

  return {
    mode: 'replace_coalescible',
    normalized: {
      ...incoming,
      op_type: 'update',
      payload: mergedPayload,
      if_match_revision: pickEarliestRevision(existingCoalescible, incoming.if_match_revision),
    },
    removeOpIDs: existingCoalescible.map((item) => item.op_id).filter(Boolean),
    updateCreate: null,
  };
}
