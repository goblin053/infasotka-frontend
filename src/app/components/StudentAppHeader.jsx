import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LayoutGrid, MessageCircle, User } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { useOutsidePointerClose } from '../shared/useOutsidePointerClose';

const palette = {
  card: '#ffffff',
  border: '#e6edf7',
  brandText: '#0f1f3d',
  nav: '#4a6fa8',
  navActive: '#2f6bff',
  logoBlue: '#2f6bff',
};

function NavLink({ active, icon: Icon, label, onClick }) {
  const color = active ? palette.navActive : palette.nav;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 10,
        color,
        fontWeight: active ? 700 : 600,
        fontSize: 14,
      }}
    >
      <Icon size={18} strokeWidth={1.75} color={color} aria-hidden />
      {label}
    </button>
  );
}

/** Шапка: логотип слева, навигация по центру, уведомления и профиль справа. */
export function StudentAppHeader({
  activeNav = 'tasks',
  session,
  notifications = [],
  onMarkAllRead,
  onMarkNotificationRead,
  onLogout,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useOutsidePointerClose(profileMenuRef, menuOpen, setMenuOpen);

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <header
      style={{
        background: palette.card,
        borderBottom: `1px solid ${palette.border}`,
        padding: '12px 22px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          gap: 16,
        }}
      >
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
          <button
            type="button"
            onClick={() => go('/student/tasks')}
            style={{
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: 0,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: palette.logoBlue,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 17,
                flexShrink: 0,
              }}
            >
              И
            </span>
            <span style={{ fontWeight: 800, fontSize: 17, color: palette.brandText, letterSpacing: 0.02 }}>ИнфаСотка</span>
          </button>
        </div>

        <nav
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <NavLink active={activeNav === 'tasks'} icon={BookOpen} label="Задания" onClick={() => go('/student/tasks')} />
          <NavLink active={activeNav === 'dashboard'} icon={LayoutGrid} label="Дашборд" onClick={() => go('/student/dashboard')} />
          <NavLink active={activeNav === 'profile'} icon={User} label="Профиль" onClick={() => go('/student/profile')} />
          <NavLink active={activeNav === 'chat'} icon={MessageCircle} label="Чат" onClick={() => go('/student/chat')} />
        </nav>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
          }}
        >
          <NotificationDropdown
            variant="icon"
            notifications={notifications}
            onMarkAllRead={onMarkAllRead}
            onMarkNotificationRead={onMarkNotificationRead}
            onOpenLink={(link) => go(link)}
          />
          <div ref={profileMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню профиля"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: `1px solid ${palette.border}`,
                background: '#dde6f2',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                padding: 0,
              }}
            >
              <User size={22} strokeWidth={1.75} color="#5a6b85" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  minWidth: 180,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  background: '#fff',
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(15,42,82,0.12)',
                  zIndex: 30,
                }}
              >
                {session?.name ? (
                  <div style={{ padding: '6px 10px 8px', fontSize: 13, color: '#6b7f9f', fontWeight: 600 }}>{session.name}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => go('/student/profile')}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Профиль
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout?.();
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  Выход
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
