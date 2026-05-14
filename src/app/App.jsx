import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminPanel } from './components/AdminPanel';
import { ChatPage } from './components/ChatPage';
import { LessonsArchive } from './components/LessonsArchive';
import { NotificationDropdown } from './components/NotificationDropdown';
import { RegistrationPage } from './components/RegistrationPage';
import { StudentProfile } from './components/StudentProfile';
import { StudentDashboard } from './components/StudentDashboard';
import { StudentShell } from './components/StudentShell';
import { TaskSolutionPage } from './components/TaskSolutionPage';
import { TasksPage } from './components/TasksPage';
import { TutorChat } from './components/TutorChat';
import { TutorDashboard } from './components/TutorDashboard';
import { TutorTasksHomeworkPage } from './components/TutorTasksHomeworkPage';
import { TutorStudentStatsPage } from './components/TutorStudentStatsPage';
import { TutorProfile } from './components/TutorProfile';
import { TutorShell } from './components/TutorShell';
import { API_URL, apiRequest, clearAccessToken, downloadTaskFile, getAccessToken, healthcheck } from './shared/apiClient';
import {
  decodeJwtPayload,
  displayNameFromClaims,
  isUuidString,
  resolveUserRole,
  stableStorageUserId,
  userUuidForApi,
} from './shared/authToken';
import { readDisplayCache, removeDisplayCacheForPayload, writeDisplayCache } from './shared/sessionDisplayCache';
import { useOutsidePointerClose } from './shared/useOutsidePointerClose';

const homePathByRole = {
  student: '/student/tasks',
  tutor: '/tutor/dashboard',
  admin: '/admin',
};

const profilePathByRole = {
  student: '/student/profile',
  tutor: '/tutor/profile',
  admin: '/admin',
};

function getHomePathByRole(role) {
  return homePathByRole[role] || '/register';
}

function getProfilePathByRole(role) {
  return profilePathByRole[role] || '/register';
}

const roleLabelByKey = {
  student: 'Ученик',
  tutor: 'Репетитор',
  admin: 'Администратор',
};

const sidebarByRole = {
  student: [
    { path: '/student/tasks', label: 'Задания' },
    { path: '/student/chat', label: 'Чат' },
    { path: '/student/profile', label: 'Профиль' },
  ],
  tutor: [
    { path: '/tutor/dashboard', label: 'Панель' },
    { path: '/tutor/tasks', label: 'Задания' },
    { path: '/tutor/chat', label: 'Чат' },
    { path: '/tutor/lessons-archive', label: 'Архив занятий' },
    { path: '/tutor/profile', label: 'Профиль' },
  ],
  admin: [{ path: '/admin', label: 'Админ-панель' }],
};

const taskCatalog = [
  {
    id: 1,
    number: '28922',
    source: 'ЕГКР 18.04.26',
    title: 'Схема дорог',
    topic: 'Графы',
    kimNumber: 1,
    level: 'easy',
    type: 'short',
    solved: false,
    description: 'Найдите сумму протяжённостей всех дорог между городами A и B.',
    correctAnswer: '150',
    starterCode: '# Ваш код здесь\n',
  },
  {
    id: 2,
    number: '29104',
    source: 'ЕГКР 25.03.26',
    title: 'Системы счисления',
    topic: 'Системы счисления',
    kimNumber: 2,
    level: 'hard',
    type: 'short',
    solved: false,
    description: 'Дано число в двоичной системе счисления. Переведите его в десятичную систему.',
    correctAnswer: '42',
    starterCode: '# Ваш код здесь\n',
  },
  {
    id: 3,
    number: '30215',
    source: 'ЕГКР 15.02.26',
    title: 'Логическое выражение',
    topic: 'Логика',
    kimNumber: 3,
    level: 'easy',
    type: 'short',
    solved: false,
    description: 'Определите значение логического выражения (A ∨ B) ∧ ¬C при A = 1, B = 0, C = 1.',
    correctAnswer: '0',
    starterCode: '# Ваш код здесь\n',
  },
  {
    id: 4,
    number: '31456',
    source: 'ЕГКР 10.01.26',
    title: 'Программирование',
    topic: 'Программирование',
    kimNumber: 27,
    level: 'hard',
    type: 'programming',
    solved: false,
    description: 'Напишите программу, которая вычисляет сумму двух целых чисел.',
    inputFormat: 'Два целых числа через пробел: a и b (-10⁹ ≤ a, b ≤ 10⁹)',
    outputFormat: 'Одно целое число — сумма a и b',
    examples: [
      { input: '1 2', output: '3' },
      { input: '10 -5', output: '5' },
    ],
    starterCode: '# Ваш код здесь\n',
  },
  {
    id: 5,
    number: '32678',
    source: 'ЕГКР 05.12.25',
    title: 'Электронные таблицы',
    topic: 'Электронные таблицы',
    kimNumber: 9,
    level: 'easy',
    type: 'table',
    solved: true,
    description: 'В электронной таблице подсчитайте среднее значение ячеек A1:A10.',
    correctAnswer: '7.5',
    starterCode: '# Ваш код здесь\n',
  },
  {
    id: 6,
    number: '33892',
    source: 'ЕГКР 20.11.25',
    title: 'Системы счисления',
    topic: 'Системы счисления',
    kimNumber: 1,
    level: 'easy',
    type: 'short',
    solved: true,
    description: 'Сколько единиц в двоичном представлении числа 255?',
    correctAnswer: '8',
    starterCode: '# Ваш код здесь\n',
  },
];

function extractLessonsArrayFromApi(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.content)) return data.content;
  return [];
}

/** GET /api/students/tutors — закреплённые репетиторы ученика. */
function normalizeStudentTutorFromApi(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id != null ? String(item.id) : '';
  if (!id) return null;
  const name = String(item.name || '').trim() || 'Репетитор';
  const experience = String(item.experience || '').trim();
  const ratingRaw = item.rating;
  const ratingNum = Number(ratingRaw);
  const ratingLine =
    ratingRaw != null && ratingRaw !== '' && Number.isFinite(ratingNum)
      ? `Рейтинг: ${ratingNum.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`
      : '';
  const specialization = [experience, ratingLine].filter(Boolean).join(' · ') || 'Закреплённый репетитор';
  const avatar = String(item.avatar || '').trim();
  const email = String(item.email || '').trim();
  return { id, name, specialization, avatar, email };
}

function combineLocalDateTimeToIso(dateStr, timeStr) {
  const [y, m, d] = String(dateStr || '').split('-').map((n) => Number(n));
  const [hh, mm] = String(timeStr || '').split(':').map((n) => Number(n));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error('Некорректная дата.');
  }
  const dt = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error('Некорректные дата или время.');
  return dt.toISOString();
}

/** Ответ POST /api/lessons, GET /api/lessons/… и GET /api/lessons/{id} → формат календаря. */
function calendarEventFromLessonApi(item, studentNameById = {}) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id != null ? String(item.id) : '';
  if (!id) return null;
  const scheduledRaw = item.scheduledAt ?? item.scheduled_at;
  const d = scheduledRaw ? new Date(scheduledRaw) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const date = `${y}-${mo}-${day}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const studentId = item.studentId != null ? String(item.studentId) : '';
  const student =
    studentId && studentNameById[studentId] ? String(studentNameById[studentId]) : '';
  const tutorId = item.tutorId != null ? String(item.tutorId) : '';
  const tutorName = String(
    item.tutorName || item.tutor?.name || item.tutorFullName || item.tutor_full_name || ''
  ).trim();
  return {
    id,
    date,
    time,
    title: String(item.title || 'Занятие').trim() || 'Занятие',
    student,
    studentId,
    tutorId,
    tutorName,
    meetingLink: String(item.meetingLink ?? item.meeting_link ?? '').trim(),
    description: String(item.description || '').trim(),
    videoLessonLink: String(item.videoLessonLink ?? item.video_lesson_link ?? '').trim(),
  };
}

function solvedTasksStorageKeyForUser(userKey) {
  const safe = userKey != null && String(userKey).trim() !== '' ? String(userKey).trim() : '';
  return safe ? `infostotka_solved_task_ids__${safe}` : null;
}

function loadSolvedTaskIdsForUser(userKey) {
  const key = solvedTasksStorageKeyForUser(userKey);
  if (!key || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function readSolvedTaskIdsFromCurrentToken() {
  const token = getAccessToken();
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  const userKey = stableStorageUserId(payload);
  if (!userKey) return [];
  return loadSolvedTaskIdsForUser(userKey);
}

function normalizeTaskFromApi(item) {
  const difficultyRaw = String(item?.difficulty || '').toLowerCase();
  const levelMap = { easy: 'easy', medium: 'medium', hard: 'hard' };
  const rawId = Number(item?.id);
  return {
    id: Number.isFinite(rawId) && rawId > 0 ? rawId : Math.floor(Math.random() * 1_000_000_000),
    number: String(item?.taskNumber || item?.id || ''),
    source: 'Банк задач',
    title: item?.title || `Задание ${item?.id || ''}`,
    topic: item?.topicId ? `Тема ${item.topicId}` : 'Без темы',
    kimNumber: Number(item?.topicId) || 1,
    level: levelMap[difficultyRaw] || 'medium',
    type: 'short',
    solved: false,
    description: item?.description || 'Описание задачи недоступно.',
    correctAnswer: '',
    starterCode: '# Ваш код здесь\n',
    difficulty: difficultyRaw || 'medium',
    topicId: item?.topicId ?? null,
    fileName: item?.fileName || '',
  };
}

/** Ученик в списке репетитора: GET /api/tutors/students */
function normalizeTutorStudentFromApi(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id != null ? String(item.id) : '';
  if (!id) return null;
  return {
    id,
    name: String(item.name || 'Ученик').trim() || 'Ученик',
    avatar: String(item.avatar || '').trim(),
    level: String(item.level || '').trim(),
    dateExam: item.dateExam || item.date_exam || '',
    solved: 0,
    total: 0,
    progress: 0,
    needsAttention: false,
    dashboardLoaded: false,
  };
}

/** Статистика ученика для карточки: GET /api/tutors/students/{id}/dashboard (тот же DTO, что у ученика). */
function mergeTutorStudentDashboard(student, dashRaw) {
  if (!dashRaw || typeof dashRaw !== 'object') {
    return {
      ...student,
      solved: 0,
      total: 0,
      progress: 0,
      needsAttention: false,
      dashboardLoaded: true,
    };
  }
  const solved = Number(dashRaw.totalSuccessfullySolvedTasks) || 0;
  const started = Number(dashRaw.totalAttemptedTasks) || 0;
  const attempts = Number(dashRaw.totalSolutionsSubmitted) || 0;
  const total = started;
  const progress =
    attempts > 0
      ? Math.round((solved / attempts) * 100)
      : started > 0
        ? Math.min(100, Math.round((solved / started) * 100))
        : 0;
  const clamped = Math.min(100, Math.max(0, progress));
  const needsAttention = (started > 0 || attempts > 0) && clamped < 60;
  return {
    ...student,
    solved,
    total,
    progress: clamped,
    needsAttention,
    dashboardLoaded: true,
  };
}

/** Человекочитаемые заголовки для кодов типа с бэкенда (enum / SCREAMING_SNAKE). */
const NOTIFICATION_TYPE_LABELS = {
  LESSON_REMINDER: 'Напоминание об уроке',
  LESSON_LINK: 'Ссылка на урок',
  LESSON_START: 'Начало урока',
  LESSON_CANCELLED: 'Урок отменён',
  HOMEWORK: 'Домашнее задание',
  HOMEWORK_REMINDER: 'Напоминание о задании',
  REMINDER: 'Напоминание',
  ANNOUNCEMENT: 'Объявление',
  FEEDBACK: 'Обратная связь',
  MESSAGE: 'Сообщение',
  CHAT: 'Чат',
  SYSTEM: 'Системное уведомление',
};

function notificationDisplayTitle(item) {
  const typeKey = String(item?.type ?? '')
    .trim()
    .toUpperCase();
  if (typeKey && NOTIFICATION_TYPE_LABELS[typeKey]) {
    return NOTIFICATION_TYPE_LABELS[typeKey];
  }
  const explicit = String(item?.title ?? item?.subject ?? item?.header ?? '').trim();
  if (explicit) return explicit;
  if (typeKey) return 'Уведомление';
  return 'Уведомление';
}

function normalizeNotificationFromApi(item) {
  if (!item || typeof item !== 'object') return null;
  const id = item.id != null ? String(item.id) : '';
  if (!id) return null;
  const read = Boolean(item.is_read ?? item.isRead ?? item.read);
  const text = String(item.text ?? '').trim() || 'Без текста';
  const type = String(item.type ?? '').trim();
  const title = notificationDisplayTitle(item);
  const rawLink = item.link ?? item.url ?? item.actionUrl ?? item.href;
  const link = rawLink ? String(rawLink).trim() : '';
  const createdAt = item.createdAt ?? item.created_at ?? '';
  return { id, read, text, title, type, link, createdAt };
}

function HomeRedirect({ session, authHydrated }) {
  if (!authHydrated) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
        Загрузка…
      </div>
    );
  }
  if (!session) return <Navigate to="/register" replace />;
  return <Navigate to={getHomePathByRole(session.role)} replace />;
}

function ProtectedRoute({ session, allowedRoles, children, authHydrated }) {
  if (!authHydrated) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontFamily: 'Arial, sans-serif' }}>
        Загрузка…
      </div>
    );
  }
  if (!session) return <Navigate to="/register" replace />;
  if (!allowedRoles.includes(session.role)) return <Navigate to={getHomePathByRole(session.role)} replace />;
  return children;
}

function AppLayout({
  session,
  notifications,
  onMarkAllRead,
  onMarkNotificationRead,
  onLogout,
  hideSidebar,
  hideGlobalHeader,
  children,
}) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const role = session.role;
  const sidebarItems = sidebarByRole[role] || [];
  const unreadCount = notifications.filter((item) => !item.read).length;

  useOutsidePointerClose(avatarMenuRef, avatarMenuOpen, setAvatarMenuOpen);

  const goTo = (path) => {
    setAvatarMenuOpen(false);
    navigate(path);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, sans-serif',
        background: '#fafafa',
      }}
    >
      {!hideGlobalHeader ? (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid #ddd',
            background: '#fff',
          }}
        >
          <button type="button" onClick={() => goTo(getHomePathByRole(role))} style={{ fontWeight: 700 }}>
            ИнфоСотка
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationDropdown
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onOpenLink={(link) => goTo(link)}
            />
            <div ref={avatarMenuRef} style={{ position: 'relative' }}>
              <button type="button" onClick={() => setAvatarMenuOpen((value) => !value)}>
                {session.name} ({roleLabelByKey[role]}) {unreadCount > 0 ? `*${unreadCount}` : ''}
              </button>
              {avatarMenuOpen ? (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', border: '1px solid #ddd', background: '#fff', padding: 8, zIndex: 25, minWidth: 160, borderRadius: 8 }}>
                  <button type="button" onClick={() => goTo(getProfilePathByRole(role))} style={{ display: 'block', width: '100%' }}>
                    Профиль
                  </button>
                  <button type="button" onClick={onLogout} style={{ display: 'block', width: '100%', marginTop: 6 }}>
                    Выход
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
      ) : null}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: hideSidebar ? '1fr' : '220px 1fr',
          flex: 1,
          minHeight: 0,
        }}
      >
        {hideSidebar ? null : (
          <aside style={{ borderRight: '1px solid #ddd', padding: 12, background: '#fff' }}>
            {sidebarItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 8,
                  padding: 8,
                  border: item.path === location.pathname ? '1px solid #99b3ff' : '1px solid #ddd',
                  background: item.path === location.pathname ? '#eef3ff' : '#fff',
                }}
              >
                {item.label}
              </button>
            ))}
          </aside>
        )}
        <section
          style={{
            padding: hideSidebar ? 0 : 16,
            ...(hideSidebar
              ? {
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {children}
        </section>
      </div>
    </div>
  );
}

function StudentTaskSolutionRoute({
  tasks,
  onSubmitSolution,
  onDownloadTaskFile,
  onFetchTaskFile,
  historyStorageUserId,
  onReloadHomework,
}) {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const numericTaskId = Number(taskId);
  const task = useMemo(() => tasks.find((item) => item.id === numericTaskId), [tasks, numericTaskId]);
  const catalogListPosition =
    location.state && typeof location.state === 'object' && location.state.catalogListPosition != null
      ? Number(location.state.catalogListPosition)
      : null;
  return (
    <TaskSolutionPage
      task={task}
      catalogListPosition={Number.isFinite(catalogListPosition) && catalogListPosition > 0 ? catalogListPosition : null}
      onBackToCatalog={() => navigate('/student/tasks')}
      onSubmitSolution={onSubmitSolution}
      onDownloadTaskFile={onDownloadTaskFile}
      onFetchTaskFile={onFetchTaskFile}
      historyStorageUserId={historyStorageUserId}
      onReloadHomework={onReloadHomework}
    />
  );
}

function AppRoutes({
  session,
  onLogin,
  onLogout,
  notifications,
  onMarkAllRead,
  onMarkNotificationRead,
  onProfileUpdated,
  tutorSchedule,
  studentSchedule,
  lessonsLoading,
  lessonsError,
  onAddTutorScheduleEvent,
  onUpdateTutorScheduleEvent,
  onDeleteTutorScheduleEvent,
  studentTasks,
  onFetchStudentTasks,
  onSubmitStudentSolution,
  onSubmitTaskAnswer,
  onDownloadTaskFile,
  onFetchTaskFile,
  studentDashboardData,
  onFetchStudentDashboard,
  tutorStudents,
  tutorStudentsLoading,
  tutorStudentsError,
  studentTutors,
  studentTutorsLoading,
  studentTutorsError,
  onRefreshTutorStudents,
  onFetchLessonById,
  authHydrated,
  lessonsArchiveLessons,
  lessonsArchiveLoading,
  lessonsArchiveError,
  onAddArchiveLesson,
  onSetLessonVideoLink,
  onDeleteArchiveLesson,
  onReloadArchiveLessons,
  tutorHomeworkCatalog,
  tutorHomeworkCatalogLoading,
  onCreateHomework,
  onFetchTutorTasks,
  studentHomeworkBlocks,
  studentHomeworkTaskIds,
  onReloadStudentHomework,
}) {
  const navigate = useNavigate();

  const studentAnswersStorageUserId = useMemo(() => {
    if (!session?.token) return session?.storageUserId || '';
    return session.storageUserId || stableStorageUserId(decodeJwtPayload(session.token)) || '';
  }, [session?.token, session?.storageUserId]);

  return (
    <Routes>
      <Route path="/register" element={session ? <Navigate to={getHomePathByRole(session.role)} replace /> : <RegistrationPage onLogin={onLogin} />} />
      <Route path="/" element={<HomeRedirect session={session} authHydrated={authHydrated} />} />

      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['student']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <StudentShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <StudentDashboard
                  user={session}
                  solutionHistoryUserId={studentAnswersStorageUserId}
                  scheduleEvents={studentSchedule}
                  onFetchLessonDetails={onFetchLessonById}
                  dashboardData={studentDashboardData}
                  onFetchDashboard={onFetchStudentDashboard}
                />
              </StudentShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/tasks"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['student']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <StudentShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TasksPage
                  key={studentAnswersStorageUserId || '_pending_'}
                  tasks={studentTasks}
                  onFetchTasks={onFetchStudentTasks}
                  onSubmitTaskAnswer={onSubmitTaskAnswer}
                  onOpenTask={(taskId, navState) => navigate(`/student/tasks/${taskId}`, { state: navState || {} })}
                  answersStorageUserId={studentAnswersStorageUserId}
                  homeworkBlocks={studentHomeworkBlocks}
                  homeworkTaskIds={studentHomeworkTaskIds}
                  onReloadHomework={onReloadStudentHomework}
                />
              </StudentShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/tasks/:taskId"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['student']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <StudentShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <StudentTaskSolutionRoute
                  key={studentAnswersStorageUserId || '_pending_'}
                  tasks={studentTasks}
                  onSubmitSolution={onSubmitStudentSolution}
                  onDownloadTaskFile={onDownloadTaskFile}
                  onFetchTaskFile={onFetchTaskFile}
                  historyStorageUserId={studentAnswersStorageUserId}
                  onReloadHomework={onReloadStudentHomework}
                />
              </StudentShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/chat"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['student']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <StudentShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <ChatPage />
              </StudentShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['student']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <StudentShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <StudentProfile
                  user={session}
                  onProfileUpdated={onProfileUpdated}
                  onOpenChat={() => navigate('/student/chat')}
                  tutors={studentTutors}
                  tutorsLoading={studentTutorsLoading}
                  tutorsError={studentTutorsError}
                />
              </StudentShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/tutor/dashboard"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TutorDashboard
                  studentsData={tutorStudents}
                  studentsLoading={tutorStudentsLoading}
                  studentsError={tutorStudentsError}
                  onRefreshStudents={onRefreshTutorStudents}
                  scheduleEvents={tutorSchedule}
                  scheduleLoading={lessonsLoading}
                  scheduleError={lessonsError}
                  lessonStudentOptions={tutorStudents.map((s) => ({ id: s.id, name: s.name }))}
                  onAddScheduleEvent={onAddTutorScheduleEvent}
                  onUpdateScheduleEvent={onUpdateTutorScheduleEvent}
                  onDeleteScheduleEvent={onDeleteTutorScheduleEvent}
                  onFetchLessonDetails={onFetchLessonById}
                  onOpenStudentStats={(student) =>
                    navigate(`/tutor/students/${encodeURIComponent(student.id)}`, {
                      state: { studentName: student.name },
                    })
                  }
                />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/tasks"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TutorTasksHomeworkPage
                  scheduleEvents={tutorSchedule}
                  scheduleLoading={lessonsLoading}
                  tasks={tutorHomeworkCatalog}
                  tasksLoading={tutorHomeworkCatalogLoading}
                  onFetchTasks={onFetchTutorTasks}
                  onCreateHomework={onCreateHomework}
                  onReloadTasks={onFetchTutorTasks}
                />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/students/:studentId"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TutorStudentStatsPage />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/chat"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TutorChat />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/lessons-archive"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <LessonsArchive
                  lessons={lessonsArchiveLessons}
                  lessonsLoading={lessonsArchiveLoading}
                  lessonsError={lessonsArchiveError}
                  tutorStudents={tutorStudents}
                  tutorStudentsLoading={tutorStudentsLoading}
                  onAddLesson={onAddArchiveLesson}
                  onSetVideoLink={onSetLessonVideoLink}
                  onDeleteLesson={onDeleteArchiveLesson}
                  onReloadLessons={onReloadArchiveLessons}
                />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tutor/profile"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['tutor']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
              hideSidebar
              hideGlobalHeader
            >
              <TutorShell
                session={session}
                notifications={notifications}
                onMarkAllRead={onMarkAllRead}
                onMarkNotificationRead={onMarkNotificationRead}
                onLogout={onLogout}
              >
                <TutorProfile
                  user={session}
                  onProfileUpdated={onProfileUpdated}
                  onOpenChat={() => navigate('/tutor/chat')}
                  scheduleEvents={tutorSchedule}
                  scheduleLoading={lessonsLoading}
                />
              </TutorShell>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute authHydrated={authHydrated} session={session} allowedRoles={['admin']}>
            <AppLayout
              session={session}
              notifications={notifications}
              onMarkAllRead={onMarkAllRead}
              onMarkNotificationRead={onMarkNotificationRead}
              onLogout={onLogout}
            >
              <AdminPanel />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [solvedTaskIds, setSolvedTaskIds] = useState(() => readSolvedTaskIdsFromCurrentToken());
  const [session, setSession] = useState(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [tutorSchedule, setTutorSchedule] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessonsError, setLessonsError] = useState('');
  const [studentTasks, setStudentTasks] = useState(() =>
    taskCatalog.map((task) => ({
      ...task,
      solved: task.solved || readSolvedTaskIdsFromCurrentToken().includes(Number(task.id)),
    }))
  );
  const [apiStatus, setApiStatus] = useState({ state: 'idle', message: '' });
  const [studentDashboardData, setStudentDashboardData] = useState(null);
  const [tutorStudents, setTutorStudents] = useState([]);
  const [tutorStudentsLoading, setTutorStudentsLoading] = useState(false);
  const [tutorStudentsError, setTutorStudentsError] = useState('');
  const [studentPinnedTutors, setStudentPinnedTutors] = useState([]);
  const [studentPinnedTutorsLoading, setStudentPinnedTutorsLoading] = useState(false);
  const [studentPinnedTutorsError, setStudentPinnedTutorsError] = useState('');
  const [studentHomeworkList, setStudentHomeworkList] = useState([]);
  const [tutorHomeworkCatalog, setTutorHomeworkCatalog] = useState([]);
  const [tutorHomeworkCatalogLoading, setTutorHomeworkCatalogLoading] = useState(false);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const uid = session?.storageUserId || stableStorageUserId(decodeJwtPayload(getAccessToken()));
    const key = solvedTasksStorageKeyForUser(uid);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(solvedTaskIds));
  }, [solvedTaskIds, session?.storageUserId]);

  useEffect(() => {
    setStudentTasks((prev) =>
      prev.map((task) => ({
        ...task,
        solved: solvedTaskIds.includes(Number(task.id)),
      }))
    );
  }, [solvedTaskIds]);

  useEffect(() => {
    let mounted = true;
    const token = getAccessToken();
    if (!token) {
      setAuthHydrated(true);
      return undefined;
    }

    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp || 0);
    if (exp && Date.now() >= exp * 1000) {
      clearAccessToken();
      setAuthHydrated(true);
      return undefined;
    }

    const email = payload?.email || payload?.sub || '';
    const displayName = displayNameFromClaims(payload, email);
    const cached = readDisplayCache(payload);

    resolveUserRole(apiRequest, payload)
      .then(({ role, profile }) => {
        if (!mounted) return;
        const nameFromApi = profile?.name || profile?.fullName || profile?.displayName;
        const avatarFromApi = profile?.avatar;
        const name = nameFromApi || cached?.name || displayName;
        const avatar = avatarFromApi || cached?.avatar || '';
        const storageUserId = stableStorageUserId(payload);
        const userUuid = userUuidForApi(payload, profile);
        setSession({
          id: userUuid || payload?.userId || payload?.id || payload?.sub || Date.now(),
          name,
          role,
          token,
          rememberMe: true,
          ...(storageUserId ? { storageUserId } : {}),
          ...(userUuid ? { userUuid } : {}),
          ...(avatar ? { avatar } : {}),
        });
        if (storageUserId) {
          setSolvedTaskIds(loadSolvedTaskIdsForUser(storageUserId));
        } else {
          setSolvedTaskIds([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
      })
      .finally(() => {
        if (mounted) setAuthHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setApiStatus({ state: 'loading', message: 'Проверяем соединение с API...' });

    healthcheck()
      .then(() => {
        if (!mounted) return;
        setApiStatus({ state: 'ok', message: `API доступен: ${API_URL}` });
      })
      .catch((error) => {
        if (!mounted) return;
        setApiStatus({
          state: 'error',
          message: `API недоступен (${API_URL || 'VITE_API_URL не задан'}): ${error.message}. Проверьте ngrok-туннель и CORS (origin: http://localhost:5173).`,
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = (nextSession) => {
    setSession(nextSession);
    if (nextSession?.storageUserId) {
      setSolvedTaskIds(loadSolvedTaskIdsForUser(nextSession.storageUserId));
    } else {
      setSolvedTaskIds([]);
    }
    if (nextSession?.token && nextSession?.name) {
      const p = decodeJwtPayload(nextSession.token);
      writeDisplayCache(p, {
        name: nextSession.name,
        avatar: nextSession.avatar,
      });
    }
  };

  const updateSessionProfile = (patch) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (next.token && (patch.name !== undefined || patch.avatar !== undefined)) {
        const p = decodeJwtPayload(next.token);
        writeDisplayCache(p, {
          name: patch.name !== undefined ? patch.name : next.name,
          avatar: patch.avatar !== undefined ? patch.avatar : next.avatar,
        });
      }
      return next;
    });
  };

  const logout = () => {
    const token = getAccessToken();
    if (token) {
      removeDisplayCacheForPayload(decodeJwtPayload(token));
    }
    clearAccessToken();
    setSession(null);
    setSolvedTaskIds([]);
    setNotifications([]);
    setTutorStudents([]);
    setTutorStudentsError('');
    setTutorStudentsLoading(false);
    setTutorSchedule([]);
    setLessonsError('');
    setLessonsLoading(false);
  };

  const fetchNotifications = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const data = await apiRequest('/api/notifications');
      const list = Array.isArray(data) ? data : [];
      const mapped = list.map(normalizeNotificationFromApi).filter(Boolean);
      mapped.sort((a, b) => {
        const ta = Date.parse(a.createdAt);
        const tb = Date.parse(b.createdAt);
        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
      });
      setNotifications(mapped);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (!session?.token) {
      setNotifications([]);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) fetchNotifications();
    };
    run();
    const intervalId = window.setInterval(run, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.token, fetchNotifications]);

  const markNotificationRead = useCallback(async (notificationId) => {
    const id = encodeURIComponent(String(notificationId));
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === String(notificationId) ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        apiRequest(`/api/notifications/${encodeURIComponent(n.id)}/read`, { method: 'PATCH' }).catch(() => null)
      )
    );
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, [notifications]);

  const loadTutorLessonsFromApi = useCallback(async () => {
    if (!getAccessToken()) return;
    const path =
      session?.role === 'student' ? '/api/lessons/student' : session?.role === 'tutor' ? '/api/lessons/tutor' : '';
    if (!path) return;
    setLessonsLoading(true);
    setLessonsError('');
    try {
      const data = await apiRequest(path);
      const list = extractLessonsArrayFromApi(data);
      const mapped = list.map((item) => calendarEventFromLessonApi(item, {})).filter(Boolean);
      setTutorSchedule(mapped);
    } catch (error) {
      setTutorSchedule([]);
      setLessonsError(error?.message || 'Не удалось загрузить занятия');
    } finally {
      setLessonsLoading(false);
    }
  }, [session?.role]);

  const loadStudentPinnedTutors = useCallback(async () => {
    if (!getAccessToken()) return;
    setStudentPinnedTutorsLoading(true);
    setStudentPinnedTutorsError('');
    try {
      const data = await apiRequest('/api/students/tutors');
      const list = Array.isArray(data) ? data : extractLessonsArrayFromApi(data);
      setStudentPinnedTutors(list.map(normalizeStudentTutorFromApi).filter(Boolean));
    } catch (error) {
      setStudentPinnedTutors([]);
      setStudentPinnedTutorsError(error?.message || 'Не удалось загрузить репетиторов');
    } finally {
      setStudentPinnedTutorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.token || (session.role !== 'tutor' && session.role !== 'student')) {
      setTutorSchedule([]);
      setLessonsError('');
      setLessonsLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) loadTutorLessonsFromApi();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.token, loadTutorLessonsFromApi]);

  useEffect(() => {
    if (session?.role !== 'student' || !session?.token) {
      setStudentPinnedTutors([]);
      setStudentPinnedTutorsError('');
      setStudentPinnedTutorsLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) loadStudentPinnedTutors();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.token, loadStudentPinnedTutors]);

  const scheduleEventsForCalendar = useMemo(() => {
    const nameById = Object.fromEntries(tutorStudents.map((s) => [String(s.id), s.name]));
    return tutorSchedule.map((ev) => ({
      ...ev,
      student: ev.studentId && nameById[ev.studentId] ? nameById[ev.studentId] : ev.student || '',
    }));
  }, [tutorSchedule, tutorStudents]);

  const fetchTutorTasks = useCallback(
    async ({ topicId, difficulty } = {}) => {
      if (!getAccessToken() || session?.role !== 'tutor') return [];
      setTutorHomeworkCatalogLoading(true);
      try {
        const params = new URLSearchParams();
        if (topicId !== undefined && topicId !== null && String(topicId).trim() !== '' && String(topicId) !== 'all') {
          params.set('topicId', String(topicId));
        }
        if (difficulty && String(difficulty) !== 'all') {
          params.set('difficulty', String(difficulty));
        }
        const query = params.toString();
        const response = await apiRequest(`/api/tasks${query ? `?${query}` : ''}`);
        const list = Array.isArray(response) ? response : [];
        const normalized = list.map(normalizeTaskFromApi).map((task) => ({ ...task, solved: false }));
        setTutorHomeworkCatalog(normalized);
        return normalized;
      } catch {
        setTutorHomeworkCatalog([]);
        return [];
      } finally {
        setTutorHomeworkCatalogLoading(false);
      }
    },
    [session?.role]
  );

  const createHomeworkAssignment = useCallback(async ({ lessonId, textAssignment, deadline, taskIds }) => {
    await apiRequest('/api/homeworks/create', {
      method: 'POST',
      body: JSON.stringify({
        lessonId: String(lessonId || '').trim(),
        textAssignment: String(textAssignment ?? ''),
        deadline: String(deadline || ''),
        taskIds: Array.isArray(taskIds) ? taskIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [],
      }),
    });
  }, []);

  const loadStudentHomeworks = useCallback(async () => {
    if (!getAccessToken() || session?.role !== 'student') return;
    const ids = [...new Set(tutorSchedule.map((ev) => String(ev.id || '').trim()).filter(Boolean))];
    if (!ids.length) {
      setStudentHomeworkList([]);
      return;
    }
    const results = await Promise.all(
      ids.map(async (lessonId) => {
        try {
          return await apiRequest(`/api/homeworks/lesson/${encodeURIComponent(lessonId)}`);
        } catch {
          return null;
        }
      })
    );
    const byLesson = new Map();
    results.forEach((raw) => {
      if (!raw || typeof raw !== 'object') return;
      const lid = String(raw.lessonId ?? '').trim();
      if (lid) byLesson.set(lid, raw);
    });
    setStudentHomeworkList(Array.from(byLesson.values()));
  }, [session?.role, tutorSchedule]);

  const studentHomeworkBundle = useMemo(() => {
    const blocks = (Array.isArray(studentHomeworkList) ? studentHomeworkList : [])
      .filter((h) => h && typeof h === 'object')
      .map((h) => ({
        id: String(h.id ?? ''),
        lessonId: String(h.lessonId ?? ''),
        textAssignment: String(h.textAssignment ?? ''),
        deadline: h.deadline != null ? String(h.deadline) : '',
        isCompleted: Boolean(h.isCompleted),
        taskIds: Array.isArray(h.taskIds) ? h.taskIds.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [],
      }));
    const idSet = new Set();
    blocks.forEach((b) => b.taskIds.forEach((tid) => idSet.add(tid)));
    return { blocks, homeworkTaskIds: [...idSet] };
  }, [studentHomeworkList]);

  useEffect(() => {
    if (session?.role !== 'tutor' || !session?.token) {
      setTutorHomeworkCatalog([]);
      setTutorHomeworkCatalogLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) fetchTutorTasks();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.token, fetchTutorTasks]);

  useEffect(() => {
    if (session?.role !== 'student' || !session?.token) {
      setStudentHomeworkList([]);
      return undefined;
    }
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await loadStudentHomeworks();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.token, tutorSchedule, loadStudentHomeworks]);

  const addTutorScheduleEvent = async (draft) => {
    const tutorId = String(session?.userUuid || userUuidForApi(session?.token ? decodeJwtPayload(session.token) : null, null) || '').trim();
    if (!tutorId || !isUuidString(tutorId)) {
      throw new Error('Не найден UUID репетитора в профиле или токене. Проверьте, что JWT содержит claim с UUID (например userId).');
    }
    const studentId = String(draft.studentId || '').trim();
    if (!studentId) throw new Error('Выберите ученика.');
    const title = String(draft.title || '').trim();
    if (!title) throw new Error('Укажите тему занятия.');
    const scheduledAt = combineLocalDateTimeToIso(draft.date, draft.time);
    const description = String(draft.description || '').trim();
    const created = await apiRequest('/api/lessons', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        tutorId,
        studentId,
        scheduledAt,
      }),
    });
    const nameById = Object.fromEntries(tutorStudents.map((s) => [String(s.id), s.name]));
    const ev = calendarEventFromLessonApi(created, nameById);
    if (ev) {
      setTutorSchedule((prev) => {
        const sid = String(ev.id);
        if (prev.some((p) => String(p.id) === sid)) return prev;
        return [...prev, ev];
      });
    }
  };

  const updateTutorScheduleEvent = async (eventId, patch) => {
    const idStr = String(eventId);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'meetingLink')) {
      const link = String(patch.meetingLink || '').trim();
      const updated = await apiRequest(`/api/lessons/${encodeURIComponent(idStr)}/link?link=${encodeURIComponent(link)}`, {
        method: 'PATCH',
      });
      const nameById = Object.fromEntries(tutorStudents.map((s) => [String(s.id), s.name]));
      const ev = calendarEventFromLessonApi(updated, nameById);
      setTutorSchedule((prev) =>
        prev.map((item) => {
          if (String(item.id) !== idStr) return item;
          if (ev) return { ...item, ...ev };
          return { ...item, meetingLink: link };
        })
      );
      return;
    }
    setTutorSchedule((prev) => prev.map((item) => (String(item.id) === idStr ? { ...item, ...patch } : item)));
  };

  const patchLessonVideoLink = async (lessonId, videoLink) => {
    const idStr = encodeURIComponent(String(lessonId));
    const link = String(videoLink || '').trim();
    if (!link) throw new Error('Вставьте ссылку на видео (URL).');
    const updated = await apiRequest(`/api/lessons/${idStr}/video-link?videoLink=${encodeURIComponent(link)}`, {
      method: 'PATCH',
    });
    const nameById = Object.fromEntries(tutorStudents.map((s) => [String(s.id), s.name]));
    const ev = calendarEventFromLessonApi(updated, nameById);
    setTutorSchedule((prev) =>
      prev.map((item) => {
        if (String(item.id) !== String(lessonId)) return item;
        if (ev) return { ...item, ...ev };
        return { ...item, videoLessonLink: link };
      })
    );
    return updated;
  };

  const deleteTutorScheduleEvent = async (eventId) => {
    const idStr = String(eventId);
    await apiRequest(`/api/lessons/${encodeURIComponent(idStr)}`, { method: 'DELETE' });
    setTutorSchedule((prev) => prev.filter((item) => String(item.id) !== idStr));
  };

  const fetchLessonById = useCallback(async (lessonId) => {
    const raw = await apiRequest(`/api/lessons/${encodeURIComponent(String(lessonId))}`);
    const nameById = Object.fromEntries(tutorStudents.map((s) => [String(s.id), s.name]));
    const ev = calendarEventFromLessonApi(raw, nameById);
    if (!ev) throw new Error('Некорректный ответ сервера');
    return ev;
  }, [tutorStudents]);

  const fetchStudentTasks = async ({ topicId, difficulty } = {}) => {
    const params = new URLSearchParams();
    if (topicId !== undefined && topicId !== null && String(topicId).trim() !== '' && String(topicId) !== 'all') {
      params.set('topicId', String(topicId));
    }
    if (difficulty && String(difficulty) !== 'all') {
      params.set('difficulty', String(difficulty));
    }
    const query = params.toString();
    const response = await apiRequest(`/api/tasks${query ? `?${query}` : ''}`);
    const list = Array.isArray(response) ? response : [];
    const normalized = list.map(normalizeTaskFromApi).map((task) => ({
      ...task,
      solved: solvedTaskIds.includes(Number(task.id)),
    }));
    setStudentTasks(normalized);
    return normalized;
  };

  const fetchStudentDashboard = useCallback(async () => {
    const response = await apiRequest('/api/students/dashboard');
    setStudentDashboardData(response && typeof response === 'object' ? response : null);
    return response;
  }, []);

  /** Список учеников репетитора и статистика по каждому (см. Swagger: GET /api/tutors/students и …/dashboard). */
  const loadTutorStudentsDashboard = useCallback(async () => {
    if (!getAccessToken()) return;
    setTutorStudentsLoading(true);
    setTutorStudentsError('');
    try {
      const list = await apiRequest('/api/tutors/students');
      const base = (Array.isArray(list) ? list : []).map(normalizeTutorStudentFromApi).filter(Boolean);
      const merged = await Promise.all(
        base.map(async (s) => {
          try {
            const dash = await apiRequest(`/api/tutors/students/${encodeURIComponent(s.id)}/dashboard`);
            return mergeTutorStudentDashboard(s, dash);
          } catch {
            return mergeTutorStudentDashboard(s, null);
          }
        })
      );
      setTutorStudents(merged);
    } catch (error) {
      setTutorStudents([]);
      setTutorStudentsError(error?.message || 'Не удалось загрузить учеников');
    } finally {
      setTutorStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.role !== 'tutor' || !session?.token) {
      setTutorStudents([]);
      setTutorStudentsError('');
      setTutorStudentsLoading(false);
      return undefined;
    }
    let cancelled = false;
    const run = () => {
      if (!cancelled) loadTutorStudentsDashboard();
    };
    run();
    const intervalId = window.setInterval(run, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [session?.role, session?.token, loadTutorStudentsDashboard]);

  const executeStudentCode = async ({ taskId, file }) => {
    const formData = new FormData();
    formData.append('file', file);
    const result = await apiRequest(`/api/code/execute/python/${taskId}`, {
      method: 'POST',
      body: formData,
    });
    if (result?.isAnswerCorrect === true) {
      const numericId = Number(taskId);
      if (Number.isFinite(numericId)) {
        setSolvedTaskIds((prev) => (prev.includes(numericId) ? prev : [...prev, numericId]));
        setStudentTasks((prev) => prev.map((item) => (Number(item.id) === numericId ? { ...item, solved: true } : item)));
      }
    }
    return result;
  };

  const submitTaskAnswer = async ({ taskId, answer }) => {
    const encoded = encodeURIComponent(String(answer || '').trim());
    const response = await apiRequest(`/api/tasks/${taskId}/submit-answer?answer=${encoded}`, {
      method: 'POST',
      headers: {
        accept: '*/*',
      },
    });

    const payload = response && typeof response === 'object' && response.data && typeof response.data === 'object' ? response.data : response;
    const rawFlag = payload?.correct ?? payload?.isCorrect ?? payload?.is_correct ?? payload?.answerCorrect;
    const correct =
      rawFlag === true ||
      rawFlag === 1 ||
      (typeof rawFlag === 'string' && ['true', '1', 'yes', 'да'].includes(String(rawFlag).toLowerCase()));
    const numericId = Number(taskId);
    if (correct && Number.isFinite(numericId)) {
      setSolvedTaskIds((prev) => (prev.includes(numericId) ? prev : [...prev, numericId]));
      setStudentTasks((prev) => prev.map((item) => (Number(item.id) === numericId ? { ...item, solved: true } : item)));
    }

    const message =
      payload?.message ||
      response?.message ||
      (correct ? 'Ответ верный' : 'Ответ неверный');

    return {
      correct,
      message,
    };
  };

  const downloadStudentTaskFile = async ({ taskId, fileName }) => {
    const { blob, fileName: resolvedName } = await downloadTaskFile(taskId, fileName || `task-${taskId}.dat`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resolvedName || fileName || `task-${taskId}.dat`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return { fileName: link.download };
  };

  const fetchStudentTaskFile = async ({ taskId, fileName }) => {
    return downloadTaskFile(taskId, fileName || `task-${taskId}.dat`);
  };

  return (
    <BrowserRouter>
      {apiStatus.state === 'error' ? (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 80,
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#9f1239',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {apiStatus.message}
        </div>
      ) : null}
      <AppRoutes
        session={session}
        onLogin={login}
        onLogout={logout}
        notifications={notifications}
        onMarkAllRead={markAllNotificationsRead}
        onMarkNotificationRead={markNotificationRead}
        onProfileUpdated={updateSessionProfile}
        tutorSchedule={scheduleEventsForCalendar}
        studentSchedule={scheduleEventsForCalendar}
        lessonsLoading={lessonsLoading}
        lessonsError={lessonsError}
        onAddTutorScheduleEvent={addTutorScheduleEvent}
        onUpdateTutorScheduleEvent={updateTutorScheduleEvent}
        onDeleteTutorScheduleEvent={deleteTutorScheduleEvent}
        onFetchLessonById={fetchLessonById}
        studentTasks={studentTasks}
        onFetchStudentTasks={fetchStudentTasks}
        onSubmitStudentSolution={executeStudentCode}
        onSubmitTaskAnswer={submitTaskAnswer}
        onDownloadTaskFile={downloadStudentTaskFile}
        onFetchTaskFile={fetchStudentTaskFile}
        studentDashboardData={studentDashboardData}
        onFetchStudentDashboard={fetchStudentDashboard}
        tutorStudents={tutorStudents}
        tutorStudentsLoading={tutorStudentsLoading}
        tutorStudentsError={tutorStudentsError}
        studentTutors={studentPinnedTutors}
        studentTutorsLoading={session?.role === 'student' && studentPinnedTutorsLoading}
        studentTutorsError={session?.role === 'student' ? studentPinnedTutorsError : ''}
        onRefreshTutorStudents={loadTutorStudentsDashboard}
        authHydrated={authHydrated}
        lessonsArchiveLessons={scheduleEventsForCalendar}
        lessonsArchiveLoading={lessonsLoading}
        lessonsArchiveError={lessonsError}
        onAddArchiveLesson={addTutorScheduleEvent}
        onSetLessonVideoLink={patchLessonVideoLink}
        onDeleteArchiveLesson={deleteTutorScheduleEvent}
        onReloadArchiveLessons={loadTutorLessonsFromApi}
        tutorHomeworkCatalog={tutorHomeworkCatalog}
        tutorHomeworkCatalogLoading={tutorHomeworkCatalogLoading}
        onCreateHomework={createHomeworkAssignment}
        onFetchTutorTasks={fetchTutorTasks}
        studentHomeworkBlocks={studentHomeworkBundle.blocks}
        studentHomeworkTaskIds={studentHomeworkBundle.homeworkTaskIds}
        onReloadStudentHomework={loadStudentHomeworks}
      />
    </BrowserRouter>
  );
}