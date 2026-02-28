import React from 'react';

function BaseIcon({ className = 'h-4 w-4', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconStatus({ className }) {
  return (
    <BaseIcon className={className}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M8 12.5L10.8 15.2L16.2 9.8" />
    </BaseIcon>
  );
}

export function IconFlag({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M5 4V20" />
      <path d="M5 5H16L13.5 9L16 13H5" />
    </BaseIcon>
  );
}

export function IconClock({ className }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7V12L15.5 14" />
    </BaseIcon>
  );
}

export function IconRepeat({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M17 4L21 8L17 12" />
      <path d="M3 11V9A5 5 0 0 1 8 4H21" />
      <path d="M7 20L3 16L7 12" />
      <path d="M21 13V15A5 5 0 0 1 16 20H3" />
    </BaseIcon>
  );
}

export function IconCalendar({ className }) {
  return (
    <BaseIcon className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3V7" />
      <path d="M16 3V7" />
      <path d="M3 10H21" />
    </BaseIcon>
  );
}

export function IconTag({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M20.2 11.4L12.6 19a2 2 0 0 1-2.8 0L4.9 14.1a2 2 0 0 1 0-2.8L12.5 3.7a2 2 0 0 1 1.4-.6H20v6.1a2 2 0 0 1-.6 1.4Z" />
      <circle cx="15.5" cy="8.5" r="1" />
    </BaseIcon>
  );
}

export function IconList({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M9 6H20" />
      <path d="M9 12H20" />
      <path d="M9 18H20" />
      <circle cx="5" cy="6" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="5" cy="18" r="1" />
    </BaseIcon>
  );
}

export function IconInbox({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M3 12V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 12l2.5 6a2 2 0 0 0 1.9 1.3h9.2a2 2 0 0 0 1.9-1.3L21 12" />
      <path d="M9 12a3 3 0 0 0 6 0" />
    </BaseIcon>
  );
}

export function IconSettings({ className }) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1 1 0 0 1 0 1.4l-1.1 1.1a1 1 0 0 1-1.4 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1 1 0 0 1-1 1h-1.6a1 1 0 0 1-1-1v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1 1 0 0 1-1.4 0l-1.1-1.1a1 1 0 0 1 0-1.4l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1 1 0 0 1-1-1v-1.6a1 1 0 0 1 1-1h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1 1 0 0 1 1-1h1.6a1 1 0 0 1 1 1v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1 1 0 0 1 1 1v1.6a1 1 0 0 1-1 1h-.1a1 1 0 0 0-.5.6Z" />
    </BaseIcon>
  );
}

export function IconLogout({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" />
      <path d="M14 7l5 5-5 5" />
      <path d="M19 12H9" />
    </BaseIcon>
  );
}

export function IconTrash({ className }) {
  return (
    <BaseIcon className={className}>
      <path d="M4 7H20" />
      <path d="M9 3H15" />
      <path d="M6 7L7 20H17L18 7" />
      <path d="M10 11V17" />
      <path d="M14 11V17" />
    </BaseIcon>
  );
}
