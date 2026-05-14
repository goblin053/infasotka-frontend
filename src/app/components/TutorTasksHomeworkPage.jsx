import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function defaultDeadlineLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function lessonLabel(ev) {
  const st = String(ev.student || '').trim() || 'Ученик';
  const title = String(ev.title || 'Занятие').trim();
  return `${ev.date || ''} ${ev.time || ''} — ${st} — ${title}`;
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

/**
 * Зеркало вкладки «Задания» ученика: тот же каталог и фильтры, без решений и проверки ответов.
 * Репетитор отмечает задачи и оформляет ДЗ (занятие, срок, комментарий).
 */
export function TutorTasksHomeworkPage({
  scheduleEvents = [],
  scheduleLoading = false,
  tasks = [],
  tasksLoading = false,
  onFetchTasks,
  onCreateHomework,
  onReloadTasks,
}) {
  const events = Array.isArray(scheduleEvents) ? scheduleEvents : [];
  const lessonOptions = useMemo(
    () =>
      events
        .filter((ev) => String(ev.id || '').trim() && String(ev.studentId || '').trim())
        .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`)),
    [events]
  );

  const [searchNumber, setSearchNumber] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [viewMode, setViewMode] = useState('cards');
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [lessonId, setLessonId] = useState('');
  const [deadlineLocal, setDeadlineLocal] = useState(() => defaultDeadlineLocal());
  const [textAssignment, setTextAssignment] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');

  const topicOptions = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => {
      const topicId = task.topicId;
      if (topicId === undefined || topicId === null || String(topicId).trim() === '') return;
      const key = String(topicId);
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: task.topic && String(task.topic).trim() ? task.topic : `Тема ${key}`,
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
  };

  const toggleTask = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const levelTone = (task) => levelMeta[task.level]?.tone || 'blue';

  const submitHomework = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormOk('');
    if (!onCreateHomework) {
      setFormError('Создание ДЗ недоступно.');
      return;
    }
    if (!String(lessonId).trim()) {
      setFormError('Выберите занятие из расписания.');
      return;
    }
    const ids = [...selectedTaskIds];
    if (!ids.length) {
      setFormError('Отметьте хотя бы одну задачу. Выбор сохраняется при смене фильтров.');
      return;
    }
    const iso = new Date(deadlineLocal);
    if (Number.isNaN(iso.getTime())) {
      setFormError('Укажите корректный срок сдачи.');
      return;
    }
    setPending(true);
    try {
      await onCreateHomework({
        lessonId: String(lessonId).trim(),
        textAssignment: String(textAssignment || ''),
        deadline: iso.toISOString(),
        taskIds: ids,
      });
      setFormOk('Домашнее задание отправлено. Ученик увидит задачи на вкладке «Задания».');
      setTextAssignment('');
      setSelectedTaskIds(new Set());
      setDeadlineLocal(defaultDeadlineLocal());
    } catch (err) {
      setFormError(err?.message || 'Не удалось создать домашнее задание.');
    } finally {
      setPending(false);
    }
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
        <section
          style={{
            marginBottom: 16,
            background: palette.card,
            border: `1px solid ${palette.border}`,
            borderRadius: 14,
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpenCheck size={22} strokeWidth={2} color={palette.blue} aria-hidden />
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: palette.text }}>Задания и домашняя работа</h1>
            </div>
            {onReloadTasks ? (
              <button
                type="button"
                onClick={() => onReloadTasks()}
                disabled={tasksLoading}
                style={{
                  border: `1px solid ${palette.border}`,
                  background: '#fff',
                  borderRadius: 10,
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: tasksLoading ? 'wait' : 'pointer',
                }}
              >
                {tasksLoading ? 'Загрузка…' : 'Обновить каталог'}
              </button>
            ) : null}
          </div>
          <p style={{ margin: '0 0 12px', color: palette.muted, fontSize: 14, lineHeight: 1.5 }}>
            Тот же список задач, что видит ученик. Отправка решений и проверка ответов здесь недоступны — отметьте задачи для домашнего задания и заполните форму ниже.
          </p>

          {formError ? (
            <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: palette.redSoft, color: palette.red, fontWeight: 600, fontSize: 13 }}>
              {formError}
            </div>
          ) : null}
          {formOk ? (
            <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: palette.greenSoft, color: palette.green, fontWeight: 600, fontSize: 13 }}>
              {formOk}
            </div>
          ) : null}

          <form onSubmit={submitHomework}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Занятие *</span>
                <select
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  disabled={scheduleLoading || !lessonOptions.length}
                  style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px', background: '#fff' }}
                >
                  <option value="">
                    {scheduleLoading ? 'Загрузка расписания…' : lessonOptions.length ? 'Выберите занятие' : 'Нет занятий с учеником'}
                  </option>
                  {lessonOptions.map((ev) => (
                    <option key={String(ev.id)} value={String(ev.id)}>
                      {lessonLabel(ev)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Срок сдачи *</span>
                <input
                  type="datetime-local"
                  value={deadlineLocal}
                  onChange={(e) => setDeadlineLocal(e.target.value)}
                  style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '10px 12px' }}
                />
              </label>
            </div>
            <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Комментарий для ученика</span>
              <textarea
                value={textAssignment}
                onChange={(e) => setTextAssignment(e.target.value)}
                placeholder="Формулировка задания, что сделать, на что обратить внимание…"
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ fontSize: 12, color: palette.muted, marginTop: 8 }}>
              Выбрано для ДЗ: <strong style={{ color: palette.text }}>{selectedTaskIds.size}</strong> · в списке ниже: {filteredTasks.length}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="submit"
                disabled={pending}
                style={{
                  border: 0,
                  borderRadius: 12,
                  padding: '11px 20px',
                  background: palette.blue,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  opacity: pending ? 0.8 : 1,
                }}
              >
                {pending ? 'Отправка…' : 'Отправить домашнее задание'}
              </button>
            </div>
          </form>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
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
            <div style={{ fontWeight: 800, color: palette.text, marginBottom: 10 }}>Поиск и фильтры</div>
            <label style={{ display: 'block', fontSize: 12, color: palette.muted, marginBottom: 6 }}>Номер задачи</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'stretch', width: '100%' }}>
              <input
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="Номер"
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
                }}
              >
                {isLoading ? '…' : 'Показать'}
              </button>
            </div>
            <div style={{ height: 1, background: palette.border, margin: '14px 0' }} />
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
            {loadError ? (
              <div style={{ marginBottom: 10, borderRadius: 10, padding: '8px 10px', background: palette.redSoft, color: palette.red, fontSize: 12, fontWeight: 700 }}>
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
            <div style={{ marginTop: 12, borderRadius: 12, padding: '10px 12px', background: palette.blueSoft, color: palette.blue, fontWeight: 700, fontSize: 13 }}>
              В списке: {filteredTasks.length}
            </div>
          </aside>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: palette.text }}>Каталог заданий</div>
              <div style={{ display: 'inline-flex', border: `1px solid ${palette.border}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
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

            {tasksLoading && !tasks.length ? (
              <div style={{ color: palette.muted, fontWeight: 600 }}>Загрузка каталога…</div>
            ) : null}

            {viewMode === 'table' ? (
              <div style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#fbfcff' }}>
                      {['', 'Пор.', 'Банк №', 'Источник', 'Тема', 'КИМ'].map((h, i) => (
                        <th key={String(i)} style={{ textAlign: 'left', padding: '10px 12px', color: palette.muted, borderBottom: `1px solid ${palette.border}` }}>
                          {h || ' '}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task, idx) => {
                      const meta = levelMeta[task.level] || { label: task.level, tone: 'blue' };
                      const checked = selectedTaskIds.has(Number(task.id));
                      return (
                        <tr key={task.id} style={{ background: checked ? palette.greenSoft : undefined }}>
                          <td style={{ padding: '8px 12px', borderBottom: `1px solid ${palette.border}` }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTask(task.id)}
                              aria-label={`Включить задачу ${task.number} в ДЗ`}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 800 }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}`, fontWeight: 800 }}>{task.number}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>{task.source}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>{task.topic}</td>
                          <td style={{ padding: '10px 12px', borderBottom: `1px solid ${palette.border}` }}>
                            <span style={{ marginRight: 8 }}>КИМ {task.kimNumber}</span>
                            <Badge tone={levelTone(task)}>{meta.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filteredTasks.map((task, idx) => {
                  const meta = levelMeta[task.level] || { label: task.level, tone: 'blue' };
                  const checked = selectedTaskIds.has(Number(task.id));
                  return (
                    <article
                      key={task.id}
                      style={{
                        background: palette.card,
                        border: `1px solid ${checked ? palette.green : palette.border}`,
                        borderRadius: 14,
                        padding: 14,
                        boxShadow: checked ? '0 0 0 2px rgba(22, 163, 74, 0.12)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTask(task.id)}
                          aria-label={`Включить задачу ${task.number} в ДЗ`}
                          style={{ width: 20, height: 20, marginTop: 4, flexShrink: 0, cursor: 'pointer' }}
                        />
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
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: palette.muted, fontStyle: 'italic', marginBottom: 6 }}>
                            Задача в банке: <strong style={{ color: palette.text, fontStyle: 'normal' }}>№{task.number}</strong>
                            {task.id != null ? ` · id ${task.id}` : ''}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
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
                          <div style={{ color: palette.text, lineHeight: 1.35, marginBottom: 8 }}>{task.description}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: palette.muted }}>КИМ {task.kimNumber}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: palette.muted }}>{task.topic}</span>
                          </div>
                          <div style={{ fontSize: 12, color: palette.muted, fontStyle: 'italic' }}>Решение и проверка ответа недоступны для роли репетитора.</div>
                        </div>
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
