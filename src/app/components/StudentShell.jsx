import React from 'react';
import { useLocation } from 'react-router-dom';
import { StudentAppHeader } from './StudentAppHeader';

function activeNavFromPath(pathname) {
  if (pathname.startsWith('/student/profile')) return 'profile';
  if (pathname.startsWith('/student/chat')) return 'chat';
  if (pathname.startsWith('/student/dashboard')) return 'dashboard';
  if (pathname.startsWith('/student/tasks')) return 'tasks';
  return 'tasks';
}

/** Единая шапка ученика для всех страниц раздела /student/*. Контент растягивается на оставшуюся высоту окна. */
export function StudentShell({ session, notifications, onMarkAllRead, onMarkNotificationRead, onLogout, children }) {
  const { pathname } = useLocation();
  const activeNav = activeNavFromPath(pathname);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <StudentAppHeader
        activeNav={activeNav}
        session={session}
        notifications={notifications}
        onMarkAllRead={onMarkAllRead}
        onMarkNotificationRead={onMarkNotificationRead}
        onLogout={onLogout}
      />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
