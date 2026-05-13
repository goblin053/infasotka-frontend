import React, { useMemo, useRef, useState } from 'react';
import { CalendarPlus, CheckCheck, Image as ImageIcon, Paperclip, Search, Send } from 'lucide-react';

const palette = {
  pageBg: '#f8fafc',
  card: '#ffffff',
  border: '#e6edf7',
  text: '#0f2a52',
  muted: '#6b7f9f',
  blue: '#2f6bff',
  blueSoft: '#eaf1ff',
  tutorBubble: '#eef2f7',
  online: '#22c55e',
};

const seedStudents = [
  { id: 'alexey', initials: 'АС', name: 'Алексей Смирнов', group: '11 «А»', preview: 'Спасибо за подсказку!', timeLabel: '15:42', unread: 3, online: true },
  { id: 'maria', initials: 'МК', name: 'Мария Кузнецова', group: '10 «Б»', preview: 'Я решила задачу №27', timeLabel: '14:20', unread: 1, online: false },
  { id: 'dmitry', initials: 'ДС', name: 'Дмитрий Сидоров', group: '11 «Б»', preview: 'Хорошо, посмотрю', timeLabel: 'Вчера', unread: 0, online: false },
  { id: 'ekaterina', initials: 'ЕИ', name: 'Екатерина Иванова', group: '11 «А»', preview: 'До встречи!', timeLabel: '22 апр', unread: 0, online: true },
];

const seedMessagesByStudent = {
  alexey: [
    { id: 1, author: 'student', text: 'Добрый день! Не могу разобраться с задачей №27', time: '14:16' },
    { id: 2, author: 'tutor', text: 'Здравствуй! Давай разберёмся. Что именно вызывает затруднения?', time: '14:17', read: true },
    { id: 3, author: 'student', text: 'Не понимаю, как оптимизировать алгоритм', time: '14:18' },
    {
      id: 4,
      author: 'tutor',
      kind: 'code',
      code: 'Попробуй использовать динамическое программирование. Вот пример:\n\ndef solve(n):\n    dp = [0] * (n + 1)\n    for i in range(1, n + 1):\n        dp[i] = dp[i - 1] + 1\n    return dp[n]',
      time: '14:20',
      read: true,
    },
    { id: 5, author: 'student', text: 'Ого, теперь понятно! Спасибо большое!', time: '15:40' },
    { id: 6, author: 'student', text: 'Попробую реализовать', time: '15:42' },
  ],
  maria: [
    { id: 1, author: 'student', text: 'Я решила задачу №27, можете проверить?', time: '14:19' },
    { id: 2, author: 'tutor', text: 'Да, отправляй решение и разберём ошибки.', time: '14:20', read: true },
  ],
  dmitry: [
    { id: 1, author: 'student', text: 'Скинул домашнее задание', time: '17:02' },
    { id: 2, author: 'tutor', text: 'Хорошо, посмотрю', time: '17:10', read: true },
  ],
  ekaterina: [{ id: 1, author: 'student', text: 'До встречи!', time: '13:45' }],
};

function messagePreview(message) {
  if (!message) return '';
  if (message.kind === 'code') return 'Отправлен фрагмент кода';
  return String(message.text || '').trim();
}

function Avatar({ initials, online, size = 40 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: palette.blueSoft,
          color: '#4b5d7a',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: size > 36 ? 14 : 12,
        }}
      >
        {initials}
      </div>
      {online ? (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 11,
            height: 11,
            borderRadius: 999,
            background: palette.online,
            border: '2px solid #fff',
          }}
        />
      ) : null}
    </div>
  );
}

export function TutorChat() {
  const [students, setStudents] = useState(seedStudents);
  const [activeId, setActiveId] = useState(seedStudents[0].id);
  const [messagesByStudent, setMessagesByStudent] = useState(() => ({ ...seedMessagesByStudent }));
  const [unreadById, setUnreadById] = useState(() => Object.fromEntries(seedStudents.map((s) => [s.id, s.unread || 0])));
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  const filteredStudents = useMemo(() => students.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase())), [students, search]);
  const active = useMemo(() => students.find((s) => s.id === activeId) || students[0], [students, activeId]);
  const messages = messagesByStudent[active.id] || [];

  const openChat = (id) => {
    setActiveId(id);
    setUnreadById((prev) => ({ ...prev, [id]: 0 }));
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const next = {
      id: Date.now(),
      author: 'tutor',
      text,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };
    setMessagesByStudent((prev) => ({ ...prev, [active.id]: [...(prev[active.id] || []), next] }));
    setStudents((prev) => {
      const updated = prev.map((item) =>
        item.id === active.id
          ? {
              ...item,
              preview: messagePreview(next),
              timeLabel: next.time,
            }
          : item,
      );
      const currentIdx = updated.findIndex((item) => item.id === active.id);
      if (currentIdx <= 0) return updated;
      const [current] = updated.splice(currentIdx, 1);
      return [current, ...updated];
    });
    setDraft('');
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 0 16px', boxSizing: 'border-box' }}>
      <div style={{ flex: 1, minHeight: 0, border: `1px solid ${palette.border}`, background: palette.card, overflow: 'hidden', display: 'flex' }}>
        <aside style={{ width: 310, flexShrink: 0, borderRight: `1px solid ${palette.border}`, background: '#fbfdff', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 14px 12px', fontWeight: 800, fontSize: 24, color: palette.text }}>Чат с учениками</div>
          <div style={{ padding: '0 12px 10px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color={palette.muted} style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск учеников..."
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 10px 10px 32px', fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredStudents.map((s) => {
              const selected = s.id === active.id;
              const unread = unreadById[s.id] || 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openChat(s.id)}
                  style={{
                    width: 'calc(100% - 12px)',
                    margin: '0 6px 10px',
                    border: `1px solid ${selected ? '#93c5fd' : 'transparent'}`,
                    background: selected ? '#f0f7ff' : 'transparent',
                    borderRadius: 12,
                    cursor: 'pointer',
                    padding: '10px 10px',
                    textAlign: 'left',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    boxSizing: 'border-box',
                  }}
                >
                  <Avatar initials={s.initials} online={s.online} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: palette.text }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: palette.muted }}>{s.timeLabel}</span>
                    </div>
                    <div style={{ fontSize: 12, color: palette.muted, marginTop: 1 }}>{s.group}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#4e5d79', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.preview}</span>
                      {unread > 0 ? (
                        <span style={{ minWidth: 20, height: 20, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 5px' }}>
                          {unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header style={{ padding: '12px 16px', borderBottom: `1px solid ${palette.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={active.initials} online={active.online} size={42} />
              <div>
                <div style={{ fontWeight: 800, color: palette.text, fontSize: 16 }}>{active.name}</div>
                <div style={{ color: palette.muted, fontSize: 13 }}>{active.group}</div>
              </div>
            </div>
            <button
              type="button"
              style={{ border: 0, borderRadius: 10, background: palette.blue, color: '#fff', fontWeight: 700, cursor: 'pointer', padding: '10px 14px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <CalendarPlus size={16} />
              Пригласить на занятие
            </button>
          </header>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', background: palette.pageBg }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: palette.muted, background: '#fff', border: `1px solid ${palette.border}`, padding: '5px 12px', borderRadius: 999 }}>Сегодня</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, idx) => {
                const prev = messages[idx - 1];
                const showStudentAvatar = msg.author === 'student' && (!prev || prev.author !== 'student');
                if (msg.author === 'student') {
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: '86%' }}>
                      {showStudentAvatar ? <Avatar initials={active.initials} online={false} size={28} /> : <div style={{ width: 28 }} />}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        <div style={{ background: palette.tutorBubble, color: palette.text, padding: '10px 14px', borderRadius: '14px 14px 14px 4px', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {msg.text}
                        </div>
                        <span style={{ fontSize: 11, color: palette.muted, paddingLeft: 4 }}>{msg.time}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '86%' }}>
                      <div style={{ background: palette.blue, color: '#fff', padding: '10px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 14, lineHeight: 1.45 }}>
                        {msg.kind === 'code' ? (
                          <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>{msg.code}</pre>
                        ) : (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: palette.muted }}>
                        <span>{msg.time}</span>
                        {msg.read ? <CheckCheck size={14} strokeWidth={2} color={palette.blue} /> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <footer style={{ padding: '10px 16px 12px', borderTop: `1px solid ${palette.border}`, background: palette.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input ref={fileRef} type="file" style={{ display: 'none' }} />
              <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${palette.border}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                <Paperclip size={16} color={palette.muted} />
              </button>
              <button type="button" onClick={() => imageRef.current?.click()} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${palette.border}`, background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
                <ImageIcon size={16} color={palette.muted} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Введите сообщение..."
                style={{ flex: 1, minWidth: 0, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, outline: 'none' }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!draft.trim()}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: 0,
                  background: palette.blue,
                  color: '#fff',
                  cursor: draft.trim() ? 'pointer' : 'not-allowed',
                  opacity: draft.trim() ? 1 : 0.45,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
                }}
              >
                <Send size={16} strokeWidth={2} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
