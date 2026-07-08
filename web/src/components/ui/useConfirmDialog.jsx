import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export function useConfirmDialog({
  title,
  cancelLabel,
  confirmLabel,
} = {}) {
  const [dialog, setDialog] = useState(null);
  const activeResolveRef = useRef(null);

  useEffect(() => () => {
    activeResolveRef.current?.(false);
    activeResolveRef.current = null;
  }, []);

  const closeDialog = useCallback((accepted) => {
    const resolve = activeResolveRef.current;
    activeResolveRef.current = null;
    setDialog(null);
    resolve?.(accepted);
  }, []);

  const requestConfirm = useCallback((message, options = {}) => new Promise((resolve) => {
    activeResolveRef.current?.(false);
    activeResolveRef.current = resolve;
    setDialog({
      title: options.title || title,
      message,
      cancelLabel: options.cancelLabel || cancelLabel,
      confirmLabel: options.confirmLabel || confirmLabel,
      confirmVariant: options.confirmVariant || 'default',
    });
  }), [cancelLabel, confirmLabel, title]);

  const confirmDialog = dialog ? (
    <ConfirmDialog
      open
      title={dialog.title}
      message={dialog.message}
      cancelLabel={dialog.cancelLabel}
      confirmLabel={dialog.confirmLabel}
      confirmVariant={dialog.confirmVariant}
      onCancel={() => closeDialog(false)}
      onConfirm={() => closeDialog(true)}
    />
  ) : null;

  return { requestConfirm, confirmDialog };
}
