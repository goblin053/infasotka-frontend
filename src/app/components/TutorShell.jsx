import React from 'react';
import { useLocation } from 'react-router-dom';
import { TutorAppHeader } from './TutorAppHeader';

function activeNavFromPath(pathname) {
  if (pathname.startsWith('/tutor/profile')) return 'profile';
  if (pathname.startsWith('/tutor/chat')) return 'chat';
  if (pathname.startsWith('/tutor/lessons-archive')) return 'lessons';
  if (pathname.startsWith('/tutor/tasks')) return 'tasks';
  if (pathname.startsWith('/tutor/students/')) return 'dashboard';
  if (pathname.startsWith('/tutor/dashboard')) return 'dashboard';
  return 'dashboard';
}

export function TutorShell({ session, notifications, onMarkAllRead, onMarkNotificationRead, onLogout, children }) {
  const { pathname } = useLocation();
  const activeNav = activeNavFromPath(pathname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}>
      <TutorAppHeader
        activeNav={activeNav}
        session={session}
        notifications={notifications}
        onMarkAllRead={onMarkAllRead}
        onMarkNotificationRead={onMarkNotificationRead}
        onLogout={onLogout}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', minWidth: 0 }}>{children}</div>
    </div>
  );
}
