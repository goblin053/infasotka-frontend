import React, { useEffect, useRef, useState } from 'react';
import { useOutsidePointerClose } from '../shared/useOutsidePointerClose';

function formatNotificationTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function NotificationDropdown({
  notifications,
  onOpenLink,
  onMarkAllRead,
  onMarkNotificationRead,
  variant = 'default',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useOutsidePointerClose(rootRef, open, setOpen);

  const triggerStyle =
    variant === 'icon'
      ? {
          width: 42,
          height: 42,
          borderRadius: 999,
          border: '1px solid #f0e4c4',
          background: '#fffbeb',
          cursor: 'pointer',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
        }
      : { padding: '6px 10px', cursor: 'pointer' };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)} style={triggerStyle} aria-label="Уведомления">
        {variant === 'icon' ? (
          <>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
            {unreadCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#f59e0b',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {unreadCount}
              </span>
            ) : null}
          </>
        ) : (
          <>
            🔔 {unreadCount > 0 ? `(${unreadCount})` : ''}
          </>
        )}
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 320,
            border: '1px solid #ddd',
            borderRadius: 10,
            background: '#fff',
            padding: 12,
            zIndex: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <strong>Уведомления</strong>
            <button type="button" onClick={() => onMarkAllRead?.()}>
              Прочитать все
            </button>
          </div>
          {notifications.length === 0 ? <p style={{ margin: 0 }}>Новых уведомлений нет.</p> : null}
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={async () => {
                  if (!item.read && onMarkNotificationRead) {
                    try {
                      await onMarkNotificationRead(item.id);
                    } catch {
                      // остаёмся на списке; статус обновит родитель при успехе
                    }
                  }
                  setOpen(false);
                  if (item.link) onOpenLink?.(item.link);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  border: '1px solid #eee',
                  borderRadius: 8,
                  padding: 8,
                  background: item.read ? '#fff' : '#f3f7ff',
                }}
              >
                <strong>{item.title}</strong>
                <div style={{ fontSize: 13, color: '#444' }}>{item.text}</div>
                {item.createdAt ? (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{formatNotificationTime(item.createdAt)}</div>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
