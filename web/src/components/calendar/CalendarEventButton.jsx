import React from 'react';

// Pointer gestures are owned by the canvas, including click-vs-drag detection.
// Native keyboard activation is handled here so all views use one contract and
// a pointer release followed by click cannot open an event twice.
export default function CalendarEventButton({ calendarEvent, onOpen, pointerHandledByCanvas = true, children, ...props }) {
  return (
    <button
      {...props}
      type="button"
      aria-label={calendarEvent.title || 'Untitled'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!pointerHandledByCanvas || event.detail === 0) onOpen?.(calendarEvent);
      }}
    >
      {children}
    </button>
  );
}
