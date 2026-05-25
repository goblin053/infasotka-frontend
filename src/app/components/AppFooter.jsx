import React from 'react';
import { useNavigate } from 'react-router-dom';

const palette = {
  bg: '#ffffff',
  border: '#e6edf7',
  text: '#5c7097',
  heading: '#0f2a52',
  link: '#2f6bff',
  muted: '#9aaecf',
};

/** Ширина колонки и контейнера: 3 колонки + 2 равных промежутка через space-between */
const COL_WIDTH = 220;
const COL_COUNT = 3;
const FOOTER_INNER_GAP = 64;
const footerRowWidth = COL_WIDTH * COL_COUNT + FOOTER_INNER_GAP * (COL_COUNT - 1);

const columnShellStyle = {
  width: COL_WIDTH,
  minWidth: COL_WIDTH,
  maxWidth: COL_WIDTH,
  flexShrink: 0,
  boxSizing: 'border-box',
};

function FooterLink({ children, onClick, href }) {
  const base = {
    border: 0,
    background: 'transparent',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    color: palette.text,
    fontSize: 13,
    lineHeight: 1.5,
    textAlign: 'left',
    display: 'block',
    maxWidth: '100%',
  };

  if (href) {
    return (
      <a href={href} style={{ ...base, textDecoration: 'none' }}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} style={base}>
      {children}
    </button>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div style={columnShellStyle}>
      {title ? (
        <div style={{ fontWeight: 700, fontSize: 13, color: palette.heading, marginBottom: 10 }}>{title}</div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

const studentLinks = [
  { label: 'Задания', path: '/student/tasks' },
  { label: 'Дашборд', path: '/student/dashboard' },
  { label: 'Профиль', path: '/student/profile' },
  { label: 'Чат', path: '/student/chat' },
];

const tutorLinks = [
  { label: 'Панель репетитора', path: '/tutor/dashboard' },
  { label: 'Задания и ДЗ', path: '/tutor/tasks' },
  { label: 'Архив занятий', path: '/tutor/lessons-archive' },
  { label: 'Профиль', path: '/tutor/profile' },
  { label: 'Чат', path: '/tutor/chat' },
];

function BrandColumn({ go }) {
  return (
    <FooterColumn>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: palette.link,
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          И
        </span>
        <span style={{ fontWeight: 800, fontSize: 15, color: palette.heading }}>ИнфаСотка</span>
      </div>
      <p style={{ margin: '0 0 10px', lineHeight: 1.45, color: palette.text }}>
        Онлайн-школа подготовки к ЕГЭ по информатике.
      </p>
      <FooterLink onClick={go('/register')}>Пользовательское соглашение</FooterLink>
      <FooterLink onClick={go('/register')}>Политика обработки данных</FooterLink>
      <FooterLink onClick={go('/register')}>Контакты</FooterLink>
      <FooterLink href="mailto:support@infasotka.ru">support@infasotka.ru</FooterLink>
    </FooterColumn>
  );
}

function EgeColumn() {
  return (
    <FooterColumn title="Подготовка к ЕГЭ">
      <span style={{ color: palette.text }}>Информатика</span>
      <span style={{ color: palette.text }}>Банк заданий</span>
      <span style={{ color: palette.text }}>Проверка решений</span>
      <span style={{ color: palette.text }}>Домашние задания</span>
    </FooterColumn>
  );
}

/** Подвал сервиса: на всех страницах с AppLayout (не на /register). */
export function AppFooter({ role }) {
  const navigate = useNavigate();
  const go = (path) => () => navigate(path);

  let roleColumn = null;
  if (role === 'student') {
    roleColumn = (
      <FooterColumn title="Ученику">
        {studentLinks.map((item) => (
          <FooterLink key={item.path} onClick={go(item.path)}>
            {item.label}
          </FooterLink>
        ))}
      </FooterColumn>
    );
  } else if (role === 'tutor') {
    roleColumn = (
      <FooterColumn title="Репетитору">
        {tutorLinks.map((item) => (
          <FooterLink key={item.path} onClick={go(item.path)}>
            {item.label}
          </FooterLink>
        ))}
      </FooterColumn>
    );
  } else if (role === 'admin') {
    roleColumn = (
      <FooterColumn title="Администрирование">
        <FooterLink onClick={go('/admin')}>Админ-панель</FooterLink>
      </FooterColumn>
    );
  }

  const columnsRowStyle = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: FOOTER_INNER_GAP,
    width: footerRowWidth,
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  return (
    <footer
      style={{
        marginTop: 'auto',
        flexShrink: 0,
        borderTop: `1px solid ${palette.border}`,
        background: palette.bg,
        padding: '28px 24px 24px',
        color: palette.text,
        fontSize: 13,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={columnsRowStyle}>
          <BrandColumn go={go} />
          <EgeColumn />
          {roleColumn}
        </div>
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 20 }}>
        <div
          style={{
            width: footerRowWidth,
            flexShrink: 0,
            paddingTop: 16,
            borderTop: `1px solid ${palette.border}`,
            color: palette.muted,
            fontSize: 12,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          © {new Date().getFullYear()} ИнфаСотка
        </div>
      </div>
    </footer>
  );
}
