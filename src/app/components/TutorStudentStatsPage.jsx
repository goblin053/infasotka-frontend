import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Target, TrendingUp } from 'lucide-react';
import { apiRequest } from '../shared/apiClient';

const palette = {
  pageBg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  blue: '#3b82f6',
  blueDeep: '#2563eb',
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

function normalizeDashboardData(dashboardData) {
  const source = dashboardData && typeof dashboardData === 'object' ? dashboardData : {};
  const totalSubmissionAttempts = Number(source.totalSolutionsSubmitted) || 0;
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
  return {
    totalSubmissionAttempts,
    totalTasksWithAttempts,
    totalSolved,
    averageAiScore,
    successRate,
    topicStatistics,
  };
}

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
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.ringTrack} strokeWidth={stroke} strokeLinecap="round" />
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

function StatTile({ icon, value, label }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 14,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ opacity: 0.95 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.92, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

/** Статистика ученика с точки зрения репетитора (тот же DTO, что у /api/students/dashboard). */
export function TutorStudentStatsPage() {
  const { studentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const studentName = location.state?.studentName || 'Ученик';

  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const id = encodeURIComponent(String(studentId || ''));
    if (!id) {
      setError('Не указан ученик.');
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError('');
    apiRequest(`/api/tutors/students/${id}/dashboard`)
      .then((data) => {
        if (!mounted) return;
        setRaw(data && typeof data === 'object' ? data : null);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message || 'Не удалось загрузить статистику.');
        setRaw(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [studentId]);

  const dashboard = useMemo(() => normalizeDashboardData(raw), [raw]);

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
        <button
          type="button"
          onClick={() => navigate('/tutor/dashboard')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            border: `1px solid ${palette.border}`,
            background: '#fff',
            borderRadius: 10,
            padding: '8px 14px',
            fontWeight: 700,
            cursor: 'pointer',
            color: palette.text,
          }}
        >
          <ArrowLeft size={18} />
          К дашборду
        </button>

        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 900, color: palette.text }}>Статистика ученика</h1>
        <p style={{ margin: '0 0 20px', color: palette.muted, fontSize: 15, fontWeight: 600 }}>{studentName}</p>

        {loading ? (
          <p style={{ color: palette.muted }}>Загрузка…</p>
        ) : error ? (
          <div
            style={{
              borderRadius: 12,
              padding: '12px 14px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#9f1239',
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : (
          <>
            <section
              style={{
                borderRadius: 16,
                padding: '22px 20px',
                color: '#fff',
                background: `linear-gradient(135deg, ${palette.blueDeep} 0%, ${palette.blue} 55%, #60a5fa 100%)`,
                boxShadow: '0 10px 40px rgba(37, 99, 235, 0.25)',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 12,
                }}
              >
                <StatTile icon={<Target size={20} strokeWidth={2} />} value={dashboard.totalSolved} label="Решено заданий" />
                <StatTile icon={<TrendingUp size={20} strokeWidth={2} />} value={dashboard.successRate} label="Успеваемость" />
                <StatTile
                  icon={<span style={{ fontSize: 18, fontWeight: 800 }}>∑</span>}
                  value={dashboard.totalSubmissionAttempts}
                  label="Попытки"
                />
                <StatTile
                  icon={<span style={{ fontSize: 18, fontWeight: 800 }}>#</span>}
                  value={dashboard.totalTasksWithAttempts}
                  label="Начатые задачи"
                />
                <StatTile
                  icon={<span style={{ fontSize: 18, fontWeight: 800 }}>AI</span>}
                  value={dashboard.averageAiScore}
                  label="Средняя AI оценка"
                />
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
              <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 800, color: palette.text }}>Прогресс по темам</h2>
              {dashboard.topicStatistics.length === 0 ? (
                <p style={{ margin: 0, color: palette.muted, fontSize: 14 }}>Пока нет данных по темам.</p>
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
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
