import React, { useEffect, useMemo, useState } from 'react';

function taskAnswersStorageKey(userKey) {
  const safe = userKey != null && String(userKey).trim() !== '' ? String(userKey).trim() : '';
  return safe ? `infostotka_task_answers__${safe}` : null;
}

const palette = {
  pageBg: '#f5f7fb',
  card: '#ffffff',
  border: '#e6edf7',
  text: '#0f2a52',
  muted: '#6b7f9f',
  blue: '#2f6bff',
  blueSoft: '#eaf1ff',
  green: '#16a34a',
  greenSoft: '#e8f7ec',
  red: '#ef4444',
  redSoft: '#fde8ea',
};

const levelMeta = {
  easy: { label: 'Базовый', tone: 'green' },
  medium: { label: 'Средний', tone: 'blue' },
  hard: { label: 'Профильный', tone: 'red' },
};

/** Номер КИМ в квадрате карточки; если нет — номер в банке, затем id. */
function taskTopicSquareLabel(task) {
  if (task?.kimNumber != null && String(task.kimNumber).trim() !== '') return String(task.kimNumber);
  if (task?.number != null && String(task.number).trim() !== '') return String(task.number);
  if (task?.id != null) return String(task.id);
  return '—';
}

function formatHomeworkDeadline(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

function Badge({ tone, children }) {
  const bg = tone === 'green' ? palette.greenSoft : tone === 'red' ? palette.redSoft : palette.blueSoft;
  const fg = tone === 'green' ? palette.green : tone === 'red' ? palette.red : palette.blue;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function TasksPage({
  tasks,
  onFetchTasks,
  onSubmitTaskAnswer,
  onOpenTask,
  answersStorageUserId = '',
  homeworkBlocks = [],
  homeworkTaskIds = [],
  onReloadHomework,
}) {
  const answersStorageKey = useMemo(() => taskAnswersStorageKey(answersStorageUserId), [answersStorageUserId]);

  const [searchNumber, setSearchNumber] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [homeworkOnly, setHomeworkOnly] = useState(false);
  const [viewMode, setViewMode] = useState('cards');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [checkingTaskId, setCheckingTaskId] = useState(null);

  const [answers, setAnswers] = useState({});
  const [feedbackByTaskId, setFeedbackByTaskId] = useState({});
  /** После «Проверить»: correct | wrong */
  const [reviewStatusByTaskId, setReviewStatusByTaskId] = useState({});

  useEffect(() => {
    if (typeof localStorage === 'undefined' || !answersStorageKey) {
      setAnswers({});
      return;
    }
    try {
      const raw = localStorage.getItem(answersStorageKey);
      if (!raw) {
        setAnswers({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setAnswers(parsed);
      else setAnswers({});
    } catch {
      setAnswers({});
    }
  }, [answersStorageKey]);

  useEffect(() => {
    if (typeof localStorage === 'undefined' || !answersStorageKey) return;
    localStorage.setItem(answersStorageKey, JSON.stringify(answers));
  }, [answers, answersStorageKey]);

  const topicOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      const topicId = task.topicId;
      if (topicId === undefined || topicId === null || String(topicId).trim() === '') return;
      const key = String(topicId);
      if (!map.has(key)) {
        const displayNum = String(topicId);
        map.set(key, {
          value: key,
          label: task.topic && String(task.topic).trim() ? task.topic : `Тема ${displayNum}`,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(a.value) - Number(b.value) || a.label.localeCompare(b.label, 'ru'));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchNumber && !String(task.number).includes(searchNumber.trim())) return false;
      if (selectedTopic !== 'all' && String(task.topicId ?? '') !== String(selectedTopic)) return false;
      if (selectedDifficulty !== 'all' && String(task.difficulty || task.level || '').toLowerCase() !== selectedDifficulty) return false;
      return true;
    });
  }, [tasks, searchNumber, selectedTopic, selectedDifficulty]);

  const homeworkIdSet = useMemo(() => new Set((homeworkTaskIds || []).map((n) => Number(n)).filter((n) => Number.isFinite(n))), [homeworkTaskIds]);

  const displayedTasks = useMemo(() => {
    if (!homeworkOnly) return filteredTasks;
    return filteredTasks.filter((task) => homeworkIdSet.has(Number(task.id)));
  }, [filteredTasks, homeworkOnly, homeworkIdSet]);

  const loadTasks = async () => {
    if (!onFetchTasks) return;
    setLoadError('');
    setIsLoading(true);
    try {
      const numericTopicId = selectedTopic === 'all' ? undefined : Number(selectedTopic);
      await onFetchTasks({
        topicId: Number.isNaN(numericTopicId) ? undefined : numericTopicId,
        difficulty: selectedDifficulty === 'all' ? undefined : selectedDifficulty,
      });
    } catch (error) {
      setLoadError(error?.message || 'Не удалось загрузить список задач.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!onFetchTasks) return;
    loadTasks();
  }, []);

  const resetFilters = () => {
    setSearchNumber('');
    setSelectedTopic('all');
    setSelectedDifficulty('all');
    setHomeworkOnly(false);
  };

  const setAnswer = (taskId, value) => {
    const key = String(taskId);
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setFeedbackByTaskId((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setReviewStatusByTaskId((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const checkAnswer = async (task) => {
    const taskKey = String(task.id);
    const raw = (answers[taskKey] || answers[task.id] || '').trim();
    if (!raw) return;
    if (onSubmitTaskAnswer) {
      setCheckingTaskId(task.id);
      try {
        const result = await onSubmitTaskAnswer({ taskId: task.id, answer: raw });
        const ok = Boolean(result?.correct);
        setReviewStatusByTaskId((prev) => ({
          ...prev,
          [taskKey]: ok ? 'correct' : 'wrong',
        }));
        setFeedbackByTaskId((prev) => ({
          ...prev,
          [taskKey]: result?.message || (ok ? 'Верно!' : 'Неверно.'),
        }));
        if (ok && typeof onReloadHomework === 'function') {
          void Promise.resolve(onReloadHomework()).catch(() => {});
        }
      } catch (error) {
        setFeedbackByTaskId((prev) => ({
          ...prev,
          [taskKey]: error?.message || 'Не удалось проверить ответ. Попробуйте позже.',
        }));
      } finally {
        setCheckingTaskId((prev) => (prev === task.id ? null : prev));
      }
      return;
    }
    const expectedStr = String(task.correctAnswer ?? '').trim();
    if (!expectedStr) {
      setFeedbackByTaskId((prev) => ({
        ...prev,
        [taskKey]: 'Для этой задачи проверка по короткому ответу не настроена. Откройте задание и отправьте код.',
      }));
      return;
    }
    const expected = expectedStr.toLowerCase();
    const ok = raw.toLowerCase() === expected;
    setReviewStatusByTaskId((prev) => ({
      ...prev,
      [taskKey]: ok ? 'correct' : 'wrong',
    }));
    setFeedbackByTaskId((prev) => ({
      ...prev,
      [taskKey]: ok ? `Верно! Ответ: ${task.correctAnswer}` : `Неверно. Правильный ответ: ${task.correctAnswer}`,
    }));
  };

  const levelTone = (task) => levelMeta[task.level]?.tone || 'blue';

  const taskStatusDisplay = (task) => {
    const taskKey = String(task.id);
    const reviewed = reviewStatusByTaskId[taskKey];
    if (reviewed === 'correct') return { text: 'Решено', fg: palette.green, mark: '✓' };
    if (reviewed === 'wrong') return { text: 'Неверно', fg: palette.red, mark: '✕' };
    if (task.solved) return { text: 'Решено', fg: palette.green, mark: '✓' };
    return { text: 'Не решено', fg: palette.muted, mark: '○' };
  };

  return (
    <div
      style={{
        background: palette.pageBg,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 18, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box', flex: 1 }}>
        {Array.isArray(homeworkBlocks) && homeworkBlocks.length > 0 ? (
          <section
            style={{
              marginBottom: 16,
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: palette.text }}>Домашнее задание</div>
              {onReloadHomework ? (
                <button
                  type="button"
                  onClick={() => onReloadHomework()}
                  style={{
                    border: `1px solid ${palette.border}`,
                    background: '#fff',
                    color: palette.blue,
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Обновить
                </button>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {homeworkBlocks.map((hw) => (
                <article
                  key={hw.id || hw.lessonId}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${palette.border}`,
                    padding: '12px 14px',
                    background: hw.isCompleted ? palette.greenSoft : palette.blueSoft,
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <Badge tone={hw.isCompleted ? 'green' : 'blue'}>{hw.isCompleted ? 'Сдано' : 'К выполнению'}</Badge>
                    {hw.deadline ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>до {formatHomeworkDeadline(hw.deadline)}</span>
                    ) : null}
                  </div>
                  {hw.textAssignment ? (
                    <p style={{ margin: 0, fontSize: 14, color: palette.text, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{hw.textAssignment}</p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: palette.muted }}>Задачи отмечены в списке ниже значком «ДЗ».</p>
                  )}
                  {hw.taskIds?.length ? (
                    <div style={{ marginTop: 8, fontSize: 12, color: palette.muted, fontWeight: 600 }}>Задачи (id): {hw.taskIds.join(', ')}</div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <aside
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: 14,
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontWeight: 800, color: palette.text, marginBottom: 10 }}>Поиск задания</div>
            <label style={{ display: 'block', fontSize: 12, color: palette.muted, marginBottom: 6 }}>Номер задачи</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 8,
                alignItems: 'stretch',
                width: '100%',
              }}
            >
              <input
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="1"
                style={{
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  padding: '10px 10px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={loadTasks}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: '10px 14px',
                  background: palette.blue,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {isLoading ? 'Загрузка...' : 'Показать'}
              </button>
            </div>

            <div style={{ height: 1, background: palette.border, margin: '14px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: palette.text }}>Фильтры</div>
              <span style={{ color: palette.muted }}>⏷</span>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: palette.muted, marginBottom: 6 }}>Тема</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              style={{ width: '100%', border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10, marginBottom: 10 }}
            >
              <option value="all">Все…</option>
              {topicOptions.map((topic) => (
                <option key={topic.value} value={topic.value}>
                  {topic.label}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: 12, color: palette.muted, marginBottom: 6 }}>Сложность</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              style={{ width: '100%', border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10, marginBottom: 10 }}
            >
              <option value="all">Все…</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>

            {homeworkIdSet.size > 0 ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: palette.text,
                  marginBottom: 10,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={homeworkOnly}
                  onChange={(e) => setHomeworkOnly(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                Только из ДЗ
              </label>
            ) : null}

            {loadError ? (
              <div
                style={{
                  marginBottom: 10,
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: palette.redSoft,
                  color: palette.red,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {loadError}
              </div>
            ) : null}

            <button
              type="button"
              onClick={resetFilters}
              style={{
                width: '100%',
                border: `1px solid ${palette.blue}`,
                background: '#fff',
                color: palette.blue,
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Сбросить фильтры
            </button>

            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                padding: '10px 12px',
                background: palette.blueSoft,
                color: palette.blue,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Найдено заданий: {displayedTasks.length}
            </div>
          </aside>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: palette.text }}>Список заданий</div>
              <div
                style={{
                  display: 'inline-flex',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    border: 0,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: viewMode === 'cards' ? palette.blueSoft : '#fff',
                    color: viewMode === 'cards' ? palette.blue : palette.muted,
                    fontWeight: 800,
                  }}
                >
                  Карточки
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    border: 0,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background: viewMode === 'table' ? palette.blueSoft : '#fff',
                    color: viewMode === 'table' ? palette.blue : palette.muted,
                    fontWeight: 800,
                  }}
                >
                  Таблица
                </button>
              </div>
            </div>

            {viewMode === 'table' ? (
              <div
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fbfcff' }}>
                      {['Пор.', 'Банк №', 'Источник', 'Тема', 'КИМ', 'Уровень', 'Статус'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTasks.map((task, idx) => {
                      const st = taskStatusDisplay(task);
                      const inHw = homeworkIdSet.has(Number(task.id));
                      const meta = levelMeta[task.level] || { label: task.level || '—', tone: 'blue' };
                      return (
                        <tr
                          key={task.id}
                          onClick={() => onOpenTask(task.id)}
                          style={{
                            cursor: 'pointer',
                            background: inHw ? '#f0fdf4' : undefined,
                          }}
                        >
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 900, fontSize: 16 }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 800 }}>
                            <span style={{ marginRight: 8 }}>{task.number}</span>
                            {inHw ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  background: palette.greenSoft,
                                  color: palette.green,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                ДЗ
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>{task.source}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>{task.topic}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>КИМ {task.kimNumber}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>
                            <Badge tone={levelTone(task)}>{meta.label}</Badge>
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}`, color: st.fg, fontWeight: 800 }}>
                            <span style={{ marginRight: 6 }}>{st.mark}</span>
                            {st.text}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {displayedTasks.map((task) => {
                  const meta = levelMeta[task.level] || { label: task.level, tone: 'blue' };
                  const st = taskStatusDisplay(task);
                  const inHw = homeworkIdSet.has(Number(task.id));
                  return (
                    <article
                      key={task.id}
                      style={{
                        background: palette.card,
                        border: `1px solid ${inHw ? palette.green : palette.border}`,
                        borderRadius: 14,
                        padding: 14,
                        boxShadow: inHw ? '0 0 0 2px rgba(22, 163, 74, 0.15)' : undefined,
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenTask(task.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenTask(task.id);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                flexShrink: 0,
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                border: `2px solid ${palette.border}`,
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 18,
                                fontWeight: 900,
                                color: palette.text,
                                background: '#fff',
                              }}
                              aria-hidden
                            >
                              {taskTopicSquareLabel(task)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                              {task.id != null ? (
                                <div style={{ fontSize: 12, color: palette.muted, fontWeight: 700 }}>
                                  Задача <span style={{ color: palette.text }}>№{task.id}</span>
                                  {task.number != null && String(task.number).trim() !== '' ? (
                                    <span style={{ fontWeight: 600, color: palette.muted }}>{` · банк №${task.number}`}</span>
                                  ) : null}
                                </div>
                              ) : null}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              {inHw ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    padding: '4px 10px',
                                    borderRadius: 999,
                                    background: palette.greenSoft,
                                    color: palette.green,
                                    fontWeight: 800,
                                    fontSize: 12,
                                  }}
                                >
                                  ДЗ
                                </span>
                              ) : null}
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: palette.blueSoft,
                                  color: palette.blue,
                                  fontWeight: 800,
                                  fontSize: 12,
                                }}
                              >
                                {task.source}
                              </span>
                              <Badge tone={levelTone(task)}>{meta.label}</Badge>
                            </div>

                            <div style={{ fontSize: 17, fontWeight: 900, color: palette.text, lineHeight: 1.25 }}>
                              {task.title || `Задание ${task.id ?? ''}`}
                            </div>

                            <div style={{ color: palette.text, lineHeight: 1.35 }}>{task.description}</div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: '#f3f6fb',
                                  color: palette.muted,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                КИМ {task.kimNumber}
                              </span>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  background: '#f3f6fb',
                                  color: palette.muted,
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {task.topic}
                              </span>
                            </div>
                          </div>
                        </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: st.fg, fontWeight: 800 }}>
                            <span aria-hidden>{st.mark}</span>
                            <span>{st.text}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: 10, alignItems: 'center' }}>
                          <div style={{ color: palette.muted, fontWeight: 800 }}>Ответ:</div>
                          <input
                            value={answers[String(task.id)] || ''}
                            onChange={(e) => setAnswer(task.id, e.target.value)}
                            placeholder="Введите ответ"
                            style={{
                              width: '100%',
                              border: `1px solid ${palette.border}`,
                              borderRadius: 10,
                              padding: '10px 10px',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => checkAnswer(task)}
                            disabled={checkingTaskId === task.id}
                            style={{
                              border: 0,
                              borderRadius: 10,
                              padding: '0 14px',
                              height: 40,
                              background: palette.blueSoft,
                              color: palette.blue,
                              fontWeight: 900,
                              cursor: checkingTaskId === task.id ? 'not-allowed' : 'pointer',
                              opacity: checkingTaskId === task.id ? 0.65 : 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {checkingTaskId === task.id ? 'Проверка...' : 'Проверить'}
                          </button>
                        </div>
                        {feedbackByTaskId[String(task.id)] ? (
                          <div style={{ marginTop: 8, color: palette.text, fontSize: 13 }}>{feedbackByTaskId[String(task.id)]}</div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
