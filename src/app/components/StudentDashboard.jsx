import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CircleAlert,
  Clock,
  Flame,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ScheduleCalendar } from './ScheduleCalendar';

const palette = {
  pageBg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#3b82f6',
  blueDeep: '#2563eb',
  orange: '#f97316',
  orangeSoft: '#fff7ed',
  ringTrack: '#e8eef7',
  ringLow: '#dc2626',
  ringMid: '#f97316',
  ringHigh: '#16a34a',
};

function ringStrokeForSuccessRate(rate) {
  if (rate < 20) return palette.ringLow;
  if (rate <= 50) return palette.ringMid;
  return palette.ringHigh;
}

/** Заглушка под будущий ответ ИИ: один объект — и рекомендация, и список типичных ошибок. */
const defaultAiInsight = {
  focusTopic: 'системы счисления',
  recommendation:
    'Рекомендуем повторить: {{topic}}. На этой неделе вы допустили 3 ошибки в заданиях на перевод чисел.',
  typicalMistakes: ['Ошибки в переводе чисел', 'Логические операции', 'Рекурсивные алгоритмы'],
};

const defaultStats = {
  solvedTasks: 142,
  successRate: '87%',
  streakDays: 7,
  hoursInApp: '24',
};

function pickFirstFiniteNumber(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (const k of keys) {
    if (source[k] == null || source[k] === '') continue;
    const n = Number(source[k]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Склонение для «N дней» на плитке дашборда. */
function formatStreakDaysLine(days) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 0) return '—';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return `${n} дня`;
  return `${n} дней`;
}

/** Время в системе: целые часы или минуты, если не целое число часов. */
function formatMinutesLine(totalMinutes) {
  const m = Math.round(Number(totalMinutes));
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m === 0) return '0 мин';
  const mod10 = m % 10;
  const mod100 = m % 100;
  if (mod10 === 1 && mod100 !== 11) return `${m} минута`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return `${m} минуты`;
  return `${m} минут`;
}

function formatWholeHoursLine(n) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x < 0) return '—';
  const mod10 = x % 10;
  const mod100 = x % 100;
  let unit = 'часов';
  if (mod10 === 1 && mod100 !== 11) unit = 'час';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) unit = 'часа';
  return `${x} ${unit}`;
}

function formatTimeInSystemLine(hoursTotal) {
  const h = Number(hoursTotal);
  if (!Number.isFinite(h) || h < 0) return '—';
  const minutesTotal = Math.round(h * 60);
  if (minutesTotal === 0) return '0 мин';
  const wholeHours = minutesTotal / 60;
  const isWholeHour = Math.abs(wholeHours - Math.round(wholeHours)) < 0.02;
  if (minutesTotal >= 60 && isWholeHour) {
    return formatWholeHoursLine(Math.round(wholeHours));
  }
  return formatMinutesLine(minutesTotal);
}

/** Сколько пунктов показывать в блоке «Типичные ошибки», чтобы не перегружать экран. */
const TYPICAL_MISTAKES_DISPLAY_LIMIT = 4;

function coerceAiMistakesList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|•|;/g)
      .map((s) => s.replace(/^[\-\s•]+/, '').trim())
      .filter(Boolean);
  }
  return [];
}

function collectMistakesFromSolutionHistoryStorage(userKey) {
  if (typeof localStorage === 'undefined') return [];
  const safe = userKey != null && String(userKey).trim() !== '' ? String(userKey).trim() : '_';
  const prefix = `infostotka_task_solution_history__${safe}__`;
  const allEntries = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((entry) => {
        if (entry && typeof entry === 'object') allEntries.push(entry);
      });
    } catch {
      /* ignore */
    }
  }
  allEntries.sort((a, b) => {
    const ta = Date.parse(a.at) || 0;
    const tb = Date.parse(b.at) || 0;
    return tb - ta;
  });
  const recent = allEntries.slice(0, 50);
  const lines = [];
  const seen = new Set();
  const addLine = (s) => {
    const t = String(s || '').trim();
    if (!t || t.length > 220) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    lines.push(t);
  };
  for (const entry of recent) {
    const fb = entry.aiFeedback;
    if (fb && typeof fb === 'object') {
      if (Array.isArray(fb.mistakes)) fb.mistakes.forEach(addLine);
      if (Array.isArray(fb.recommendations)) fb.recommendations.forEach(addLine);
    }
  }
  return lines.slice(0, TYPICAL_MISTAKES_DISPLAY_LIMIT);
}

/** Поля из GET /api/students/dashboard (и вложенные aiInsight): типичные ошибки по разборам ИИ. */
function collectTypicalMistakesFromPayload(source) {
  if (!source || typeof source !== 'object') return [];
  const nested = source.aiInsight || source.ai_insight || source.aiAnalysis || source.analysis || {};
  const buckets = [
    source.typicalMistakes,
    source.typical_mistakes,
    source.commonMistakes,
    source.common_mistakes,
    source.aiTypicalMistakes,
    source.studentTypicalMistakes,
    source.mistakesFromAi,
    source.aiMistakes,
    source.mistakes,
    nested.typicalMistakes,
    nested.typical_mistakes,
    nested.commonMistakes,
  ];
  const out = [];
  const seen = new Set();
  for (const b of buckets) {
    for (const line of coerceAiMistakesList(b)) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(line);
      }
    }
  }
  if (!out.length && source.weaknesses != null) {
    for (const line of coerceAiMistakesList(source.weaknesses)) {
      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(line);
      }
    }
  }
  return out.slice(0, TYPICAL_MISTAKES_DISPLAY_LIMIT);
}

function pickAiRecommendationText(source) {
  if (!source || typeof source !== 'object') return '';
  const nested = source.aiInsight || source.ai_insight || source.aiAnalysis || source.analysis || {};
  return String(
    source.recommendation ||
      source.aiRecommendation ||
      source.ai_recommendation ||
      source.studentRecommendation ||
      nested.recommendation ||
      nested.aiRecommendation ||
      ''
  ).trim();
}

function pickAiFocusTopic(source) {
  if (!source || typeof source !== 'object') return '';
  const nested = source.aiInsight || source.ai_insight || source.aiAnalysis || source.analysis || {};
  return String(
    source.focusTopic ||
      source.focus_topic ||
      source.recommendedTopic ||
      source.weakestTopic ||
      source.weakestTopicName ||
      nested.focusTopic ||
      nested.focus_topic ||
      ''
  ).trim();
}

function normalizeDashboardData(dashboardData) {
  const source = dashboardData && typeof dashboardData === 'object' ? dashboardData : {};
  /** Сколько раз отправляли решение (в БД — totalSolutionsSubmitted). На UI называем «попытки». */
  const totalSubmissionAttempts = Number(source.totalSolutionsSubmitted) || 0;
  /** Начатые задачи: сколько разных заданий затронули (totalAttemptedTasks). */
  const totalTasksWithAttempts = Number(source.totalAttemptedTasks) || 0;
  const totalSolved = Number(source.totalSuccessfullySolvedTasks) || 0;
  const averageAiScoreRaw = Number(source.averageAiScore);
  const averageAiScore = Number.isFinite(averageAiScoreRaw) ? averageAiScoreRaw.toFixed(1) : '—';
  const topicStatisticsSource = Array.isArray(source.topicStatistics) ? source.topicStatistics : [];
  const topicStatistics = topicStatisticsSource
    .map((item, idx) => {
      const tasksTouched = Number(item?.totalAttemptedTasks) || 0;
      const solved = Number(item?.totalSuccessfullySolvedTasks) || 0;
      const submissionAttempts = Number(item?.totalSolutionsSubmitted) || 0;
      const rate = submissionAttempts > 0 ? Math.round((solved / submissionAttempts) * 100) : 0;
      return {
        id: `${item?.topicName || 'topic'}-${idx}`,
        topicName: String(item?.topicName || `Тема ${idx + 1}`),
        tasksTouched,
        submissionAttempts,
        solved,
        rate,
      };
    })
    .sort((a, b) => b.solved - a.solved);

  const successRate =
    totalSubmissionAttempts > 0 ? `${Math.round((totalSolved / totalSubmissionAttempts) * 100)}%` : '0%';

  const streakDaysFromApi = pickFirstFiniteNumber(source, [
    'currentStreakDays',
    'streakDays',
    'loginStreak',
    'streak',
    'consecutiveLoginDays',
    'dailyStreak',
    'current_streak_days',
    'streak_days',
  ]);

  let timeInSystemHoursFromApi = null;
  const minutesTotal = pickFirstFiniteNumber(source, [
    'totalSessionMinutes',
    'totalTimeMinutesInApp',
    'minutesInApp',
    'sessionMinutesTotal',
    'timeInAppMinutes',
    'total_time_minutes_in_app',
  ]);
  if (minutesTotal != null) {
    timeInSystemHoursFromApi = minutesTotal / 60;
  } else {
    const hoursOnly = pickFirstFiniteNumber(source, [
      'totalHoursInApp',
      'hoursInApp',
      'timeInSystemHours',
      'total_hours_in_app',
      'hours_in_app',
    ]);
    if (hoursOnly != null) timeInSystemHoursFromApi = hoursOnly;
  }

  return {
    totalSubmissionAttempts,
    totalTasksWithAttempts,
    totalSolved,
    averageAiScore,
    successRate,
    topicStatistics,
    streakDaysFromApi,
    timeInSystemHoursFromApi,
    typicalMistakesFromApi: collectTypicalMistakesFromPayload(source),
    aiRecommendationFromApi: pickAiRecommendationText(source),
    aiFocusTopicFromApi: pickAiFocusTopic(source),
  };
}

/** Кольцевая диаграмма: доля «решено / попытки» (по числу отправок). */
function TopicProgressRing({ topic }) {
  const size = 120;
  const stroke = 12;
  const r = size / 2 - stroke / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const hasAttempts = topic.submissionAttempts > 0;
  const rateClamped = hasAttempts ? Math.min(100, Math.max(0, topic.rate)) : 0;
  const dash = (rateClamped / 100) * circumference;
  const progressStroke = ringStrokeForSuccessRate(rateClamped);
  const title = hasAttempts
    ? `${topic.topicName}: решено ${topic.solved} из ${topic.submissionAttempts} попыток (${rateClamped}%)`
    : `${topic.topicName}: пока нет попыток`;

  return (
    <div style={{ position: 'relative', width: size, height: size }} title={title}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={palette.ringTrack}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {hasAttempts && rateClamped > 0 ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={progressStroke}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
          ) : null}
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 900, color: palette.text, lineHeight: 1 }}>
          {hasAttempts ? `${rateClamped}%` : '—'}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: palette.muted, marginTop: 2 }}>успех</span>
      </div>
    </div>
  );
}

function firstName(displayName) {
  const s = String(displayName || 'Ученик').trim();
  return s.split(/\s+/)[0] || s;
}

/**
 * Дашборд ученика: статистика с GET /api/students/dashboard; блоки ИИ подставляются из того же ответа
 * (типичные ошибки, рекомендация, фокус-тема), если бэкенд их отдаёт.
 */
export function StudentDashboard({
  user,
  aiInsight = defaultAiInsight,
  stats = defaultStats,
  scheduleEvents = [],
  onFetchLessonDetails,
  dashboardData = null,
  onFetchDashboard,
  solutionHistoryUserId = '',
}) {
  const navigate = useNavigate();
  const name = firstName(user?.name);
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [localInsightRevision, setLocalInsightRevision] = useState(0);

  useEffect(() => {
    const bump = () => setLocalInsightRevision((n) => n + 1);
    window.addEventListener('focus', bump);
    const onVis = () => {
      if (!document.hidden) bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (!onFetchDashboard) return;
    let mounted = true;
    setDashboardLoading(true);
    setDashboardError('');
    onFetchDashboard()
      .catch((error) => {
        if (!mounted) return;
        setDashboardError(error?.message || 'Не удалось загрузить статистику по темам.');
      })
      .finally(() => {
        if (!mounted) return;
        setDashboardLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [onFetchDashboard]);

  const dashboard = useMemo(() => normalizeDashboardData(dashboardData), [dashboardData]);
  const dashboardLoaded = dashboardData != null && !dashboardLoading;

  const statsView = useMemo(() => {
    const streakLine =
      dashboard.streakDaysFromApi != null
        ? formatStreakDaysLine(dashboard.streakDaysFromApi)
        : dashboardLoaded
          ? '—'
          : formatStreakDaysLine(stats.streakDays);
    const hoursLine =
      dashboard.timeInSystemHoursFromApi != null
        ? formatTimeInSystemLine(dashboard.timeInSystemHoursFromApi)
        : dashboardLoaded
          ? '—'
          : `${stats.hoursInApp} часа`;
    return {
      solvedTasks: dashboard.totalSolved || stats.solvedTasks,
      successRate: dashboardData ? dashboard.successRate : stats.successRate,
      streakLine,
      hoursLine,
    };
  }, [dashboard, dashboardData, dashboardLoading, dashboardLoaded, stats]);
  const recommendationHtml = useMemo(() => {
    const topic = (dashboard.aiFocusTopicFromApi || aiInsight.focusTopic || 'тему для повторения').trim();
    const raw =
      dashboard.aiRecommendationFromApi ||
      (!dashboardData && !dashboardLoading ? aiInsight.recommendation : '') ||
      aiInsight.recommendation ||
      defaultAiInsight.recommendation;
    const text = String(raw || '').replace(/\{\{topic\}\}/g, topic);
    if (dashboardData && !dashboard.aiRecommendationFromApi.trim() && !dashboardLoading) {
      return 'Персональная рекомендация появится здесь, когда анализ ИИ будет включён в ответ дашборда.';
    }
    const parts = text.split(topic);
    if (parts.length === 2 && topic) {
      return (
        <>
          {parts[0]}
          <strong>{topic}</strong>
          {parts[1]}
        </>
      );
    }
    return text;
  }, [dashboard, aiInsight, dashboardData, dashboardLoading]);

  const mistakesFromLocalHistory = useMemo(
    () => collectMistakesFromSolutionHistoryStorage(solutionHistoryUserId),
    [solutionHistoryUserId, localInsightRevision]
  );

  const mistakesState = useMemo(() => {
    const fromApi = dashboard.typicalMistakesFromApi;
    if (fromApi.length > 0) return { items: fromApi, kind: 'api' };
    if (mistakesFromLocalHistory.length > 0) return { items: mistakesFromLocalHistory, kind: 'local' };
    if (dashboardLoading) return { items: [], kind: 'loading' };
    if (dashboardData != null) return { items: [], kind: 'empty' };
    return { items: defaultAiInsight.typicalMistakes, kind: 'demo' };
  }, [dashboard.typicalMistakesFromApi, dashboardLoading, dashboardData, mistakesFromLocalHistory]);

  const statTile = (icon, value, label) => (
    <div
      style={{
        background: 'rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 14,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ opacity: 0.95 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92, lineHeight: 1.3 }}>{label}</div>
    </div>
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: palette.pageBg,
        padding: '20px 22px 28px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Приветствие и метрики */}
            <section
              style={{
                borderRadius: 16,
                padding: '24px 22px',
                color: '#fff',
                background: `linear-gradient(135deg, ${palette.blueDeep} 0%, ${palette.blue} 55%, #60a5fa 100%)`,
                boxShadow: '0 10px 40px rgba(37, 99, 235, 0.25)',
              }}
            >
              <h1 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>
                Привет, {name}! Готов к тренировке?
              </h1>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 12,
                }}
              >
                {statTile(<Target size={22} strokeWidth={2} />, statsView.solvedTasks, 'Решено заданий')}
                {statTile(<TrendingUp size={22} strokeWidth={2} />, statsView.successRate, 'Успеваемость')}
                {statTile(<Flame size={22} strokeWidth={2} />, statsView.streakLine, 'Текущая серия')}
                {statTile(<Clock size={22} strokeWidth={2} />, statsView.hoursLine, 'Время в системе')}
              </div>
            </section>

            <section
              style={{
                background: palette.card,
                border: `1px solid ${palette.border}`,
                borderRadius: 14,
                padding: '18px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: palette.text }}>Прогресс по темам</h2>
                {dashboardLoading ? <span style={{ color: palette.muted, fontSize: 12 }}>Обновляем…</span> : null}
              </div>
              {dashboardError ? (
                <div style={{ borderRadius: 10, padding: '8px 10px', background: '#fff1f2', color: '#be123c', fontSize: 13, marginBottom: 10 }}>
                  {dashboardError}
                </div>
              ) : null}
              {dashboard.topicStatistics.length === 0 ? (
                <p style={{ margin: 0, color: palette.muted, fontSize: 14 }}>
                  Пока нет данных по решенным задачам. Решите хотя бы одну задачу, и здесь появится график.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 14,
                    }}
                  >
                    {dashboard.topicStatistics.map((topic) => (
                      <article
                        key={topic.id}
                        style={{
                          background: '#fbfcff',
                          border: `1px solid ${palette.border}`,
                          borderRadius: 14,
                          padding: '14px 14px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 10,
                          minWidth: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 13,
                            fontWeight: 800,
                            color: palette.text,
                            lineHeight: 1.35,
                            width: '100%',
                            minHeight: '4.05em',
                            textAlign: 'center',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {topic.topicName}
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                          <TopicProgressRing topic={topic} />
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: palette.muted,
                            lineHeight: 1.55,
                            width: '100%',
                            borderTop: `1px solid ${palette.border}`,
                            paddingTop: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          {[
                            ['Решено', topic.solved],
                            ['Попытки', topic.submissionAttempts],
                            ['Начатые задачи', topic.tasksTouched],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: 10,
                              }}
                            >
                              <span style={{ flexShrink: 0 }}>{label}</span>
                              <span
                                style={{
                                  color: palette.text,
                                  fontWeight: 800,
                                  fontVariantNumeric: 'tabular-nums',
                                  textAlign: 'right',
                                }}
                              >
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div style={{ color: palette.muted, fontSize: 12 }}>
                    Всего — попытки: {dashboard.totalSubmissionAttempts} · решено: {dashboard.totalSolved} · начатых
                    задач: {dashboard.totalTasksWithAttempts} · средняя AI оценка: {dashboard.averageAiScore}
                  </div>
                </div>
              )}
            </section>

            {/* Рекомендации ИИ — сюда позже подставится анализ с OpenRouter */}
            <section
              style={{
                background: palette.card,
                border: `1px solid ${palette.border}`,
                borderRadius: 14,
                padding: '20px 22px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Lightbulb size={22} strokeWidth={2} color={palette.orange} aria-hidden />
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: palette.text }}>Рекомендации от AI</h2>
              </div>
              <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.55, color: palette.text }}>{recommendationHtml}</p>
              <button
                type="button"
                onClick={() => navigate('/student/tasks')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  borderRadius: 12,
                  border: 0,
                  background: palette.blue,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Перейти к заданиям
                <ArrowRight size={18} strokeWidth={2} />
              </button>
            </section>
          </div>

          {/* Правая колонка */}
          <div style={{ flex: '1 1 260px', maxWidth: 320, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section
              style={{
                background: palette.card,
                border: `1px solid ${palette.border}`,
                borderRadius: 14,
                padding: '18px 18px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CircleAlert size={20} strokeWidth={2} color={palette.orange} aria-hidden />
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: palette.text }}>Типичные ошибки</h2>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mistakesState.kind === 'loading' ? (
                  <li style={{ color: palette.muted, fontSize: 14, fontWeight: 600 }}>Загрузка данных ИИ…</li>
                ) : null}
                {mistakesState.kind === 'empty' ? (
                  <li style={{ color: palette.muted, fontSize: 14, lineHeight: 1.45, fontWeight: 600, padding: '4px 0' }}>
                    Пока нет данных о типичных ошибках от ИИ. Они появятся здесь после того, как сервер начнёт включать их в ответ дашборда по вашим отправленным решениям.
                  </li>
                ) : null}
                {(mistakesState.kind === 'api' || mistakesState.kind === 'demo' || mistakesState.kind === 'local') &&
                  mistakesState.items.map((item, idx) => (
                    <li
                      key={`${mistakesState.kind}-${idx}-${item}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '11px 12px',
                        borderRadius: 12,
                        background: palette.orangeSoft,
                        border: `1px solid #ffedd5`,
                        fontSize: 14,
                        fontWeight: 600,
                        color: palette.text,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: palette.orange,
                          flexShrink: 0,
                        }}
                      />
                      {item}
                    </li>
                  ))}
              </ul>
            </section>

          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <ScheduleCalendar title="Мое расписание" events={scheduleEvents} onFetchLessonDetails={onFetchLessonDetails} />
        </div>
      </div>
    </div>
  );
}
