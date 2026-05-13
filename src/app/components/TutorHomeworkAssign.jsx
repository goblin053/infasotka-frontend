import React, { useMemo, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';

const palette = {
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
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

export function TutorHomeworkAssign({
  scheduleEvents = [],
  scheduleLoading = false,
  tasks = [],
  tasksLoading = false,
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

  const [lessonId, setLessonId] = useState('');
  const [deadlineLocal, setDeadlineLocal] = useState(() => defaultDeadlineLocal());
  const [textAssignment, setTextAssignment] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState(() => new Set());
  const [searchNumber, setSearchNumber] = useState('');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

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
      if (topicFilter !== 'all' && String(task.topicId ?? '') !== String(topicFilter)) return false;
      if (difficultyFilter !== 'all' && String(task.difficulty || task.level || '').toLowerCase() !== difficultyFilter) return false;
      return true;
    });
  }, [tasks, searchNumber, topicFilter, difficultyFilter]);

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

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (!onCreateHomework) {
      setError('Создание ДЗ недоступно.');
      return;
    }
    if (!String(lessonId).trim()) {
      setError('Выберите занятие из расписания.');
      return;
    }
    const ids = [...selectedTaskIds];
    if (!ids.length) {
      setError('Отметьте хотя бы одну задачу (галочки не сбрасываются при фильтрации).');
      return;
    }
    const iso = new Date(deadlineLocal);
    if (Number.isNaN(iso.getTime())) {
      setError('Укажите корректный срок сдачи.');
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
      setOk('Домашнее задание отправлено. Ученик увидит задачи на вкладке «Задания».');
      setTextAssignment('');
      setSelectedTaskIds(new Set());
      setDeadlineLocal(defaultDeadlineLocal());
    } catch (err) {
      setError(err?.message || 'Не удалось создать домашнее задание.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      style={{
        marginTop: 20,
        background: palette.card,
        border: `1px solid ${palette.border}`,
        borderRadius: 14,
        padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpenCheck size={22} strokeWidth={2} color={palette.blue} aria-hidden />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: palette.text }}>Домашнее задание</h2>
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
            {tasksLoading ? 'Загрузка задач…' : 'Обновить список задач'}
          </button>
        ) : null}
      </div>
      <p style={{ margin: '0 0 16px', color: palette.muted, fontSize: 13, lineHeight: 1.45 }}>
        Выберите занятие с учеником, отметьте задачи из банка и нажмите «Отправить». Выбранные задачи сохраняются при смене фильтров ниже.
      </p>

      {error ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#fff1f2', color: '#9f1239', fontWeight: 600, fontSize: 13 }}>
          {error}
        </div>
      ) : null}
      {ok ? (
        <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: '#ecfdf5', color: '#166534', fontWeight: 600, fontSize: 13 }}>
          {ok}
        </div>
      ) : null}

      <form onSubmit={submit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
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

        <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: palette.text }}>Комментарий для ученика</span>
          <textarea
            value={textAssignment}
            onChange={(e) => setTextAssignment(e.target.value)}
            placeholder="Формулировка задания, что сделать, на что обратить внимание…"
            rows={3}
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

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${palette.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: palette.text, marginBottom: 10 }}>Задачи</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
            <input
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="Номер задачи"
              style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '9px 12px' }}
            />
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '9px 12px' }}
            >
              <option value="all">Все темы</option>
              {topicOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '9px 12px' }}
            >
              <option value="all">Вся сложность</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </div>
          <div style={{ fontSize: 12, color: palette.muted, marginBottom: 8 }}>
            Выбрано задач: <strong style={{ color: palette.text }}>{selectedTaskIds.size}</strong> (показано в списке: {filteredTasks.length})
          </div>
          <div
            style={{
              maxHeight: 280,
              overflow: 'auto',
              border: `1px solid ${palette.border}`,
              borderRadius: 12,
              background: palette.blueSoft,
            }}
          >
            {tasksLoading ? (
              <div style={{ padding: 14, color: palette.muted, fontWeight: 600 }}>Загрузка каталога задач…</div>
            ) : !tasks.length ? (
              <div style={{ padding: 14, color: palette.muted, fontWeight: 600 }}>Не удалось загрузить задачи. Нажмите «Обновить список задач».</div>
            ) : (
              filteredTasks.map((task) => {
                const checked = selectedTaskIds.has(Number(task.id));
                return (
                  <label
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderBottom: `1px solid ${palette.border}`,
                      cursor: 'pointer',
                      background: checked ? '#fff' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTask(task.id)}
                      style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: palette.text, fontSize: 14 }}>
                        № {task.number}{' '}
                        <span style={{ fontWeight: 600, color: palette.muted, fontSize: 12 }}>(id {task.id})</span>
                      </div>
                      <div style={{ fontSize: 12, color: palette.muted, marginTop: 2, lineHeight: 1.35 }}>{task.topic}</div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="submit"
            disabled={pending}
            style={{
              border: 0,
              borderRadius: 12,
              padding: '12px 22px',
              background: palette.blue,
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.75 : 1,
            }}
          >
            {pending ? 'Отправка…' : 'Отправить домашнее задание'}
          </button>
        </div>
      </form>
    </section>
  );
}
