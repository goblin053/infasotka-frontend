import React, { useMemo, useRef, useState } from 'react';
import { CheckCheck, Image as ImageIcon, Paperclip, Send } from 'lucide-react';

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

const seedConversations = [
  {
    id: 'maria',
    name: 'Мария Петрова',
    initials: 'МП',
    avatarBg: '#6366f1',
    online: true,
    preview: 'Отлично, тогда жду решение до вечера.',
    timeLabel: '14:32',
    unread: 2,
  },
  {
    id: 'ivan',
    name: 'Иван Козлов',
    initials: 'ИК',
    avatarBg: '#0ea5e9',
    online: true,
    preview: 'Посмотрите ещё раз пример из методички.',
    timeLabel: 'Вчера',
    unread: 0,
  },
  {
    id: 'daria',
    name: 'Дарья Ильина',
    initials: 'ДИ',
    avatarBg: '#a855f7',
    online: false,
    preview: 'Спасибо, разобрался!',
    timeLabel: '23 апр',
    unread: 0,
  },
];

const seedMessagesByChat = {
  maria: [
    { id: 1, author: 'tutor', text: 'Привет! Как продвигается задача 27?', time: '14:28' },
    { id: 2, author: 'tutor', text: 'Если что — можно прислать черновик кода, посмотрю.', time: '14:29' },
    { id: 3, author: 'student', text: 'Добрый день! Сейчас допишу ввод-вывод и отправлю.', time: '14:31', read: true },
    {
      id: 4,
      author: 'student',
      kind: 'code',
      code: 'def solve(a, b):\n    return a + b',
      time: '14:33',
      read: true,
    },
    { id: 5, author: 'tutor', text: 'Хорошо, главное — не забудь про граничные случаи.', time: '14:34' },
  ],
  ivan: [
    { id: 1, author: 'tutor', text: 'Добрый день! Готовы к разбору КИМ 2?', time: '10:12' },
    { id: 2, author: 'student', text: 'Да, можно в 18:00?', time: '10:15', read: true },
  ],
  daria: [
    { id: 1, author: 'student', text: 'Здравствуйте, не понимаю условие про граф.', time: '11:02', read: true },
    { id: 2, author: 'tutor', text: 'Нарисуйте вершины так, как в примере на стр. 12.', time: '11:20' },
    { id: 3, author: 'student', text: 'Спасибо, разобрался!', time: '11:35', read: true },
  ],
};

function messagePreview(message) {
  if (!message) return '';
  if (message.kind === 'code') return 'Отправлен фрагмент кода';
  return String(message.text || '').trim();
}

function Avatar({ initials, bg, online, size = 40 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          background: bg,
          color: '#fff',
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

export function ChatPage() {
  const [conversations, setConversations] = useState(seedConversations);
  const [activeId, setActiveId] = useState(seedConversations[0].id);
  const [messagesByChat, setMessagesByChat] = useState(() => ({ ...seedMessagesByChat }));
  const [draft, setDraft] = useState('');
  const [unreadById, setUnreadById] = useState(() => Object.fromEntries(seedConversations.map((c) => [c.id, c.unread || 0])));
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  const active = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);
  const messages = messagesByChat[activeId] || [];

  const openChat = (id) => {
    setActiveId(id);
    setUnreadById((prev) => ({ ...prev, [id]: 0 }));
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const newMsg = {
      id: Date.now(),
      author: 'student',
      text,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      read: true,
    };
    setMessagesByChat((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), newMsg],
    }));
    setConversations((prev) => {
      const updated = prev.map((item) =>
        item.id === activeId
          ? {
              ...item,
              preview: messagePreview(newMsg),
              timeLabel: newMsg.time,
            }
          : item,
      );
      const currentIdx = updated.findIndex((item) => item.id === activeId);
      if (currentIdx <= 0) return updated;
      const [current] = updated.splice(currentIdx, 1);
      return [current, ...updated];
    });
    setDraft('');
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          border: `1px solid ${palette.border}`,
          borderRadius: 14,
          overflow: 'hidden',
          background: palette.card,
          maxWidth: '100%',
        }}
      >
      {/* Список диалогов */}
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: `1px solid ${palette.border}`,
          background: palette.pageBg,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 14px 12px', fontWeight: 800, fontSize: 17, color: palette.text }}>Чат с репетитором</div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations.map((c, index) => {
            const selected = c.id === activeId;
            const unread = unreadById[c.id] || 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openChat(c.id)}
                style={{
                  width: '100%',
                  border: 0,
                  borderTop: index === 0 ? 'none' : `1px solid ${palette.border}`,
                  background: selected ? palette.blueSoft : 'transparent',
                  cursor: 'pointer',
                  padding: '12px 12px',
                  textAlign: 'left',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  boxSizing: 'border-box',
                }}
              >
                <Avatar initials={c.initials} bg={c.avatarBg} online={c.online} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: palette.text }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: palette.muted, flexShrink: 0 }}>{c.timeLabel}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: palette.muted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {c.preview}
                    </span>
                    {unread > 0 ? (
                      <span
                        style={{
                          minWidth: 20,
                          height: 20,
                          padding: '0 6px',
                          borderRadius: 999,
                          background: palette.blue,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
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

      {/* Окно переписки */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: palette.card }}>
        {active ? (
          <>
            <header
              style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${palette.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar initials={active.initials} bg={active.avatarBg} online={active.online} size={44} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: palette.text }}>{active.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 13, color: palette.muted }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: active.online ? palette.online : '#cbd5e1',
                    }}
                  />
                  {active.online ? 'Онлайн' : 'Не в сети'}
                </div>
              </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', background: palette.pageBg }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: palette.muted,
                    background: '#fff',
                    border: `1px solid ${palette.border}`,
                    padding: '6px 14px',
                    borderRadius: 999,
                  }}
                >
                  Сегодня
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((msg, idx) => {
                  const prev = messages[idx - 1];
                  const showTutorAvatar = msg.author === 'tutor' && (!prev || prev.author !== 'tutor');
                  if (msg.author === 'tutor') {
                    return (
                      <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: '85%' }}>
                        {showTutorAvatar ? <Avatar initials={active.initials} bg={active.avatarBg} online={false} size={32} /> : <div style={{ width: 32, flexShrink: 0 }} />}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                          <div
                            style={{
                              background: palette.tutorBubble,
                              color: palette.text,
                              padding: '10px 14px',
                              borderRadius: '14px 14px 14px 4px',
                              fontSize: 14,
                              lineHeight: 1.45,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.text}
                          </div>
                          <span style={{ fontSize: 11, color: palette.muted, paddingLeft: 4 }}>{msg.time}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: '85%' }}>
                        <div
                          style={{
                            background: palette.blue,
                            color: '#fff',
                            padding: msg.kind === 'code' ? '10px 14px' : '10px 14px',
                            borderRadius: '14px 14px 4px 14px',
                            fontSize: 14,
                            lineHeight: 1.45,
                          }}
                        >
                          {msg.kind === 'code' ? (
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontSize: 13,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {msg.code}
                            </pre>
                          ) : (
                            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: palette.muted }}>
                          <span>{msg.time}</span>
                          {msg.read ? <CheckCheck size={14} strokeWidth={2} color={palette.blue} aria-label="Прочитано" /> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <footer style={{ padding: '12px 16px 16px', borderTop: `1px solid ${palette.border}`, background: palette.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input ref={fileRef} type="file" style={{ display: 'none' }} />
                <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} />
                <button
                  type="button"
                  aria-label="Прикрепить файл"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    background: palette.pageBg,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Paperclip size={20} color={palette.muted} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  aria-label="Прикрепить изображение"
                  onClick={() => imageRef.current?.click()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    background: palette.pageBg,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ImageIcon size={20} color={palette.muted} strokeWidth={1.75} />
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
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  aria-label="Отправить"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    border: 0,
                    background: palette.blue,
                    color: '#fff',
                    cursor: draft.trim() ? 'pointer' : 'not-allowed',
                    opacity: draft.trim() ? 1 : 0.45,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Send size={20} strokeWidth={2} />
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
      </div>
    </div>
  );
}
