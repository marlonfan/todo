import React from 'react';
import { Button } from './Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog';

function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmVariant = 'default',
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel?.();
      }}
    >
      <DialogContent
        showClose={false}
        overlayClassName="z-[100]"
        className="z-[101] w-[min(24rem,calc(100vw-2rem))] gap-0 rounded-lg p-0"
      >
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          {message && (
            <DialogDescription className="leading-6">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="px-4 py-3">
          {cancelLabel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button type="button" variant={confirmVariant} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDialog;
