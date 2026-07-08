import React from 'react';

function EditorLoadingSkeleton() {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-card p-3" aria-hidden="true">
      <div className="h-full min-h-[17.5rem] rounded-md border border-border bg-card p-3">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-full rounded-md bg-muted" />
          <div className="space-y-2 pt-2">
            <div className="h-3 w-11/12 rounded-full bg-muted" />
            <div className="h-3 w-9/12 rounded-full bg-muted" />
            <div className="h-3 w-10/12 rounded-full bg-muted" />
            <div className="h-3 w-7/12 rounded-full bg-muted" />
          </div>
          <div className="mt-5 h-24 rounded-md bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export default EditorLoadingSkeleton;
