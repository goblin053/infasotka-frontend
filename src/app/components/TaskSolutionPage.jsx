import React, { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { History, Send, Upload, X } from 'lucide-react';

const palette = {
  pageBg: '#f5f7fb',
  card: '#ffffff',
  border: '#e6edf7',
  text: '#0f2a52',
  muted: '#6b7f9f',
  blue: '#2f6bff',
  editorBg: '#0b1220',
  success: '#16a34a',
  danger: '#ef4444',
};

const monacoLanguageByTaskType = {
  programming: 'python',
  short: 'python',
  table: 'python',
};

function codeStorageKey(taskId) {
  return `infostotka_solution_code_${taskId}`;
}

function solutionHistoryStorageKey(taskId, userKey) {
  const safeUser = userKey != null && String(userKey).trim() !== '' ? String(userKey).trim() : '_';
  return `infostotka_task_solution_history__${safeUser}__${taskId}`;
}

const SOLUTION_HISTORY_MAX = 30;

function readSolutionHistory(taskId, userKey) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(solutionHistoryStorageKey(taskId, userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSolutionHistory(taskId, userKey, list) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(solutionHistoryStorageKey(taskId, userKey), JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function buildMockAiFeedback(task, sourceCode) {
  const codeText = String(sourceCode || '');
  const lines = codeText.split('\n').filter((line) => line.trim()).length;
  const hasInput = /input\s*\(/.test(codeText);
  const hasPrint = /print\s*\(/.test(codeText);
  const hasLoop = /\b(for|while)\b/.test(codeText);

  const mistakes = [];
  const recommendations = [];

  if (!hasInput) mistakes.push('Не обрабатываются входные данные из условия задачи.');
  if (!hasPrint) mistakes.push('В решении не найден явный вывод результата.');
  if (lines < 4) mistakes.push('Решение выглядит слишком коротким и может не покрывать все случаи.');

  if (!mistakes.length) mistakes.push('Критичных синтаксических ошибок не обнаружено (предварительная оценка).');

  recommendations.push(`Проверьте решение на граничных значениях по теме «${task?.topic || 'задание'}».`);
  if (!hasLoop) recommendations.push('Добавьте проверку на наборе из нескольких тестов, включая нестандартные случаи.');
  recommendations.push('Сверьте формат вывода с условием: лишние пробелы/переносы строк могут влиять на результат.');

  return {
    summary: 'Предварительный разбор от ИИ сформирован на основе отправленного кода. Финальная оценка появится после серверной проверки.',
    mistakes: mistakes.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
  };
}

function splitToPoints(value) {
  return String(value || '')
    .split(/\n|•|;| - /g)
    .map((item) => item.replace(/^[\-\s]+/, '').trim())
    .filter(Boolean);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Англоязычные ответы ИИ/бэкенда: переводим строку «типы ошибок» для отображения. */
const ERROR_TYPE_PHRASE_RU = [
  ['module_not_found_error', 'модуль не найден'],
  ['file_not_found_error', 'файл не найден'],
  ['zero_division_error', 'деление на ноль'],
  ['indentation_error', 'ошибка отступов'],
  ['assertion_error', 'ошибка утверждения'],
  ['attribute_error', 'ошибка атрибута'],
  ['recursion_error', 'ошибка рекурсии (переполнение стека)'],
  ['compilation_error', 'ошибка компиляции'],
  ['wrong_answer_error', 'неверный ответ'],
  ['wrong_output_error', 'неверный вывод'],
  ['wrong_answer', 'неверный ответ'],
  ['wrong_output', 'неверный вывод'],
  ['runtime_error', 'ошибка времени выполнения'],
  ['semantic_error', 'семантическая ошибка'],
  ['syntax_error', 'синтаксическая ошибка'],
  ['logic_error', 'логическая ошибка'],
  ['timeout_error', 'тайм-аут'],
  ['memory_error', 'ошибка памяти'],
  ['import_error', 'ошибка импорта'],
  ['index_error', 'ошибка индекса'],
  ['value_error', 'ошибка значения'],
  ['type_error', 'ошибка типа'],
  ['name_error', 'ошибка имени (переменная не определена)'],
  ['key_error', 'ошибка ключа'],
  ['io_error', 'ошибка ввода-вывода'],
  ['format_error', 'ошибка формата'],
  ['output_error', 'ошибка вывода'],
  ['efficiency_error', 'ошибка по эффективности'],
  ['style_error', 'ошибка стиля'],
  ['edge_case_error', 'ошибка на граничном случае'],
  ['zero division error', 'деление на ноль'],
  ['zerodivisionerror', 'деление на ноль'],
  ['indentation error', 'ошибка отступов'],
  ['indentationerror', 'ошибка отступов'],
  ['syntax error', 'синтаксическая ошибка'],
  ['syntaxerror', 'синтаксическая ошибка'],
  ['name error', 'ошибка имени (переменная не определена)'],
  ['nameerror', 'ошибка имени (переменная не определена)'],
  ['type error', 'ошибка типа'],
  ['typeerror', 'ошибка типа'],
  ['value error', 'ошибка значения'],
  ['valueerror', 'ошибка значения'],
  ['key error', 'ошибка ключа'],
  ['keyerror', 'ошибка ключа'],
  ['index error', 'ошибка индекса'],
  ['indexerror', 'ошибка индекса'],
  ['attribute error', 'ошибка атрибута'],
  ['attributeerror', 'ошибка атрибута'],
  ['import error', 'ошибка импорта'],
  ['importerror', 'ошибка импорта'],
  ['modulenotfounderror', 'модуль не найден'],
  ['file not found error', 'файл не найден'],
  ['filenotfounderror', 'файл не найден'],
  ['runtime error', 'ошибка времени выполнения'],
  ['recursion error', 'ошибка рекурсии (переполнение стека)'],
  ['recursionerror', 'ошибка рекурсии (переполнение стека)'],
  ['timeout error', 'тайм-аут'],
  ['memory error', 'ошибка памяти'],
  ['off-by-one', 'ошибка на единицу'],
  ['off by one', 'ошибка на единицу'],
  ['infinite loop', 'бесконечный цикл'],
  ['race condition', 'состояние гонки'],
  ['undefined behavior', 'неопределённое поведение'],
  ['wrong answer', 'неверный ответ'],
  ['wrong output', 'неверный вывод'],
  ['incorrect output', 'неверный вывод'],
  ['incorrect answer', 'неверный ответ'],
  ['logical error', 'логическая ошибка'],
  ['logic error', 'логическая ошибка'],
  ['semantic error', 'семантическая ошибка'],
  ['compile error', 'ошибка компиляции'],
  ['compilation error', 'ошибка компиляции'],
  ['syntax errors', 'синтаксические ошибки'],
  ['logical errors', 'логические ошибки'],
  ['runtime errors', 'ошибки времени выполнения'],
  ['no errors', 'ошибок нет'],
  ['no error', 'ошибок нет'],
  ['none', 'нет'],
  ['n/a', '—'],
  ['miscellaneous', 'прочее'],
  ['misc', 'прочее'],
  ['boundary', 'граничные значения'],
  ['edge case', 'граничный случай'],
  ['floating point', 'числа с плавающей точкой'],
  ['division by zero', 'деление на ноль'],
  ['null pointer', 'нулевой указатель'],
  ['null reference', 'нулевая ссылка'],
  ['input/output', 'ввод-вывод'],
  ['i/o', 'ввод-вывод'],
  ['performance', 'производительность'],
  ['complexity', 'сложность алгоритма'],
  ['algorithm', 'алгоритм'],
  ['style', 'стиль кода'],
  ['naming', 'именование'],
  ['indentation', 'отступы'],
  ['type errors', 'ошибки типов'],
  ['exceptions', 'исключения'],
  ['exception', 'исключение'],
  ['syntax', 'синтаксис'],
  ['semantic', 'семантика'],
  ['logical', 'логика'],
  ['logic', 'логика'],
  ['runtime', 'время выполнения'],
  ['overflow', 'переполнение'],
  ['underflow', 'потеря разрядности'],
  ['timeout', 'тайм-аут'],
  ['deadlock', 'взаимная блокировка'],
];

const ERROR_TYPE_PHRASE_RU_SORTED = [...ERROR_TYPE_PHRASE_RU].sort((a, b) => b[0].length - a[0].length);

function applyErrorTypePhraseReplacements(s) {
  let out = String(s || '');
  for (const [en, ru] of ERROR_TYPE_PHRASE_RU_SORTED) {
    out = out.replace(new RegExp(escapeRegex(en), 'gi'), ru);
  }
  /* артефакт после частичной замены «syntax» внутри SYNTAX_ERROR */
  out = out.replace(/синтаксис_ERROR/gi, 'синтаксическая ошибка');
  out = out.replace(/логика_ERROR/gi, 'логическая ошибка');
  out = out.replace(/синтаксис_error/gi, 'синтаксическая ошибка');
  out = out.replace(/логика_error/gi, 'логическая ошибка');
  return out;
}

function localizeErrorTypesString(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (!/[a-zA-Z]/.test(s)) return s;

  const parts = s.split(/\s*[;,|]\s*|\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  const translated = parts.map((part) => applyErrorTypePhraseReplacements(part).trim());

  return translated.join(', ');
}

/** Полный текст разбора ИИ: заменяем коды ошибок и англ. фразы, чтобы сводная строка тоже была по-русски. */
function localizeAiRecommendationDisplayText(text) {
  const s = String(text || '');
  if (!/[a-zA-Z]/.test(s)) return s;
  return applyErrorTypePhraseReplacements(s);
}

function parseAiStructuredFeedback(aiRecommendationText, fallback) {
  const text = String(aiRecommendationText || '').trim();
  if (!text) {
    return {
      score: null,
      errorTypes: '',
      efficiency: '',
      resultText: fallback?.summary || '',
      strengths: [],
      weaknesses: fallback?.mistakes || [],
      recommendations: fallback?.recommendations || [],
    };
  }

  const score = Number((text.match(/Оценка:\s*(\d+)/i) || [])[1] || '');
  let errorTypes =
    (text.match(/Типы ошибок:\s*([^\n]+)/i) || [])[1]?.trim() ||
    (text.match(/Error types?:\s*([^\n]+)/i) || [])[1]?.trim() ||
    (text.match(/Types?\s+of\s+errors?:\s*([^\n]+)/i) || [])[1]?.trim() ||
    '';
  errorTypes = localizeErrorTypesString(errorTypes);
  const efficiency = (text.match(/Эффективность:\s*([^\n]+)/i) || [])[1] || '';
  const strengthsRaw = (text.match(/Сильные стороны:\s*([\s\S]*?)(Слабые стороны:|Рекомендации:|$)/i) || [])[1] || '';
  const weaknessesRaw = (text.match(/Слабые стороны:\s*([\s\S]*?)(Рекомендации:|$)/i) || [])[1] || '';
  const recommendationsRaw = (text.match(/Рекомендации:\s*([\s\S]*)$/i) || [])[1] || '';

  return {
    score: Number.isFinite(score) ? score : null,
    errorTypes,
    efficiency,
    resultText: localizeAiRecommendationDisplayText(text),
    strengths: splitToPoints(strengthsRaw),
    weaknesses: splitToPoints(weaknessesRaw).length ? splitToPoints(weaknessesRaw) : fallback?.mistakes || [],
    recommendations: splitToPoints(recommendationsRaw).length ? splitToPoints(recommendationsRaw) : fallback?.recommendations || [],
  };
}

function normalizeExecutionResponse(rawResult) {
  let value = rawResult;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {
        success: true,
        output: rawResult,
        error: '',
        isAnswerCorrect: undefined,
        aiRecommendation: '',
      };
    }
  }

  if (!value || typeof value !== 'object') return null;

  const output = value.output || value.stdout || '';
  const error = value.error || value.stderr || '';
  const aiRecommendation = value.aiRecommendation || value.ai_recommendation || value.recommendation || '';
  const isAnswerCorrect = typeof value.isAnswerCorrect === 'boolean' ? value.isAnswerCorrect : value.is_answer_correct;

  return {
    success: Boolean(value.success ?? !error),
    output: String(output || ''),
    error: String(error || ''),
    isAnswerCorrect: typeof isAnswerCorrect === 'boolean' ? isAnswerCorrect : undefined,
    aiRecommendation: String(aiRecommendation || ''),
  };
}

function InfoBlock({ title, children }) {
  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: 12,
        background: '#fbfcff',
      }}
    >
      <div style={{ fontWeight: 900, color: palette.text, marginBottom: 6 }}>{title}</div>
      <div style={{ color: palette.text, lineHeight: 1.35, fontSize: 14 }}>{children}</div>
    </div>
  );
}

function StructuredAiPanel({ structuredAi, aiFeedback, compact }) {
  const fz = compact ? 12 : 13;
  const h3fz = compact ? 14 : 15;
  return (
    <section
      style={{
        marginTop: compact ? 0 : 12,
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: '#f8fbff',
        padding: compact ? '10px 10px 8px' : '12px 12px 10px',
      }}
    >
      <h3 style={{ margin: '0 0 8px', color: palette.text, fontSize: h3fz, fontWeight: 900 }}>Разбор от ИИ</h3>
      {structuredAi.score !== null || structuredAi.errorTypes || structuredAi.efficiency ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
          {structuredAi.score !== null ? (
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
              <div style={{ color: palette.muted, fontSize: 11, fontWeight: 700 }}>Оценка</div>
              <div style={{ color: palette.text, fontSize: compact ? 14 : 16, fontWeight: 900 }}>{structuredAi.score}</div>
            </div>
          ) : null}
          {structuredAi.errorTypes ? (
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
              <div style={{ color: palette.muted, fontSize: 11, fontWeight: 700 }}>Типы ошибок</div>
              <div style={{ color: palette.text, fontSize: fz, fontWeight: 700 }}>{structuredAi.errorTypes}</div>
            </div>
          ) : null}
          {structuredAi.efficiency ? (
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: '8px 10px', background: '#fff' }}>
              <div style={{ color: palette.muted, fontSize: 11, fontWeight: 700 }}>Эффективность</div>
              <div style={{ color: palette.text, fontSize: fz, fontWeight: 700 }}>{structuredAi.efficiency}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <p style={{ margin: '0 0 10px', color: palette.muted, fontSize: fz, lineHeight: 1.4 }}>
        {structuredAi.resultText || aiFeedback?.summary}
      </p>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: fz }}>Сильные стороны</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: palette.text, fontSize: fz, lineHeight: 1.45 }}>
          {(structuredAi.strengths.length ? structuredAi.strengths : ['Требуется больше данных от выполнения для точного определения сильных сторон.']).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: fz }}>Слабые стороны</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: palette.text, fontSize: fz, lineHeight: 1.45 }}>
          {(structuredAi.weaknesses || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: fz }}>Рекомендации</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: palette.text, fontSize: fz, lineHeight: 1.45 }}>
          {(structuredAi.recommendations || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CodePane({ code, onChange, language }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 380,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${palette.border}`,
        minWidth: 0,
        background: palette.editorBg,
      }}
    >
      <Editor
        height="100%"
        language={language}
        value={code}
        theme="vs-dark"
        onChange={(value) => onChange(value || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}

function isImageFileName(fileName) {
  const value = String(fileName || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].some((ext) => value.endsWith(ext));
}

export function TaskSolutionPage({
  task,
  catalogListPosition = null,
  onBackToCatalog,
  onSubmitSolution,
  onDownloadTaskFile,
  onFetchTaskFile,
  historyStorageUserId,
  onReloadHomework,
}) {
  const [code, setCode] = useState('');
  const [lastSubmitAt, setLastSubmitAt] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [solutionHistory, setSolutionHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!task) return;
    const savedCode = typeof localStorage !== 'undefined' ? localStorage.getItem(codeStorageKey(task.id)) : '';
    setCode(savedCode || task.starterCode || '# Ваш код здесь\n');
    setAiFeedback(null);
    setExecutionResult(null);
    setSubmitError('');
    setDownloadError('');
    setImagePreviewError('');
    setImagePreviewUrl('');
    setLastSubmitAt(null);
    setHistoryOpen(false);
    setSolutionHistory(typeof localStorage !== 'undefined' ? readSolutionHistory(task.id, historyStorageUserId) : []);
  }, [task?.id, historyStorageUserId]);

  useEffect(() => {
    if (!task || typeof localStorage === 'undefined') return;
    localStorage.setItem(codeStorageKey(task.id), code);
  }, [task, code]);

  const hasIoBlocks = task && (task.inputFormat || task.outputFormat || (task.examples && task.examples.length > 0));
  const monacoLanguage = monacoLanguageByTaskType[task?.type] || 'python';
  const hasAttachment = Boolean(task?.fileName);
  const attachmentLooksImage = isImageFileName(task?.fileName);
  const structuredAi = useMemo(
    () => parseAiStructuredFeedback(executionResult?.aiRecommendation || '', aiFeedback),
    [executionResult?.aiRecommendation, aiFeedback]
  );

  const buildCodeFile = () => {
    const ext = monacoLanguage === 'python' ? 'py' : monacoLanguage === 'javascript' ? 'js' : 'txt';
    const filename = `task-${task.number || task.id}-solution.${ext}`;
    return new File([code], filename, { type: 'text/plain;charset=utf-8' });
  };

  if (!task) {
    return (
      <div style={{ background: palette.pageBg, flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: 18, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <h1 style={{ marginTop: 0, color: palette.text }}>Задача не найдена</h1>
          <button type="button" onClick={onBackToCatalog}>
            Назад к каталогу
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const codeFile = buildCodeFile();
      const formData = new FormData();
      formData.append('taskId', String(task.id));
      formData.append('taskNumber', String(task.number || ''));
      formData.append('language', monacoLanguage);
      formData.append('solutionFile', codeFile);

      let submitResult = null;
      if (onSubmitSolution) {
        submitResult = await onSubmitSolution({
          taskId: task.id,
          code,
          language: monacoLanguage,
          file: codeFile,
          formData,
        });
      }
      const normalizedExecution = normalizeExecutionResponse(submitResult);
      setExecutionResult(normalizedExecution);
      const nextFeedback = submitResult?.aiFeedback || buildMockAiFeedback(task, code);
      setAiFeedback(nextFeedback);
      setLastSubmitAt(new Date());

      const entry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        at: new Date().toISOString(),
        code,
        executionResult: normalizedExecution,
        aiFeedback: nextFeedback,
      };
      const prev = readSolutionHistory(task.id, historyStorageUserId);
      const nextList = [entry, ...prev].slice(0, SOLUTION_HISTORY_MAX);
      writeSolutionHistory(task.id, historyStorageUserId, nextList);
      setSolutionHistory(nextList);

      if (normalizedExecution?.isAnswerCorrect === true && typeof onReloadHomework === 'function') {
        void Promise.resolve(onReloadHomework()).catch(() => {});
      }
    } catch (error) {
      setSubmitError(error?.message || 'Не удалось отправить решение. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadFile = async () => {
    if (!task || !onDownloadTaskFile) return;
    setDownloadError('');
    setIsDownloading(true);
    try {
      await onDownloadTaskFile({ taskId: task.id, fileName: task.fileName || '' });
    } catch (error) {
      setDownloadError(error?.message || 'Не удалось скачать файл задачи.');
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (!task || !hasAttachment || !attachmentLooksImage || !onFetchTaskFile) return;
    let mounted = true;
    let objectUrl = '';
    setIsLoadingImage(true);
    setImagePreviewError('');

    onFetchTaskFile({ taskId: task.id, fileName: task.fileName || '' })
      .then(({ blob, contentType }) => {
        if (!mounted) return;
        const type = String(contentType || blob?.type || '').toLowerCase();
        if (!type.startsWith('image/')) {
          setImagePreviewError('Вложение не является изображением.');
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImagePreviewUrl(objectUrl);
      })
      .catch((error) => {
        if (!mounted) return;
        setImagePreviewError(error?.message || 'Не удалось загрузить изображение.');
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingImage(false);
      });

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [task?.id, hasAttachment, attachmentLooksImage, onFetchTaskFile]);

  return (
    <div style={{ background: palette.pageBg, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <div style={{ padding: 18, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'stretch' }}>
          <section
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: `2px solid ${palette.border}`,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  fontWeight: 900,
                  color: palette.text,
                  background: '#fff',
                }}
                aria-hidden
              >
                {String(task.number ?? task.id ?? '').trim() || '—'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                {catalogListPosition != null ? (
                  <div style={{ fontSize: 12, color: palette.muted, fontWeight: 600, marginBottom: 4 }}>
                    В списке заданий: <span style={{ color: palette.text, fontWeight: 800 }}>№{catalogListPosition}</span>
                  </div>
                ) : null}
                <div style={{ fontSize: 13, color: palette.muted, fontStyle: 'italic', lineHeight: 1.35 }}>
                  № {task.id} · {task.source || 'Банк задач'} · КИМ {task.kimNumber}
                  {task.level ? ` · уровень: ${task.level}` : ''}
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: palette.text, marginTop: 6, lineHeight: 1.25 }}>
                  {task.title || 'Задача'}
                </div>
              </div>
            </div>
            <div style={{ color: palette.text, lineHeight: 1.35, marginBottom: 12 }}>{task.description}</div>

            {hasIoBlocks ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {task.inputFormat ? <InfoBlock title="Формат входных данных">{task.inputFormat}</InfoBlock> : null}
                {task.outputFormat ? <InfoBlock title="Формат выходных данных">{task.outputFormat}</InfoBlock> : null}
                {task.examples && task.examples.length > 0 ? (
                  <InfoBlock title="Примеры">
                    <div style={{ display: 'grid', gap: 8 }}>
                      {task.examples.map((ex, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                          <div>
                            <div style={{ color: palette.muted, fontWeight: 800, marginBottom: 6, fontSize: 12 }}>Ввод</div>
                            <pre
                              style={{
                                margin: 0,
                                padding: 10,
                                borderRadius: 10,
                                background: palette.editorBg,
                                color: '#d7e3ff',
                                fontSize: 13,
                              }}
                            >
                              {ex.input}
                            </pre>
                          </div>
                          <div>
                            <div style={{ color: palette.muted, fontWeight: 800, marginBottom: 6, fontSize: 12 }}>Вывод</div>
                            <pre
                              style={{
                                margin: 0,
                                padding: 10,
                                borderRadius: 10,
                                background: palette.editorBg,
                                color: '#d7e3ff',
                                fontSize: 13,
                              }}
                            >
                              {ex.output}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </InfoBlock>
                ) : null}
              </div>
            ) : null}

            {hasAttachment ? (
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  disabled={isDownloading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: '#fff',
                    color: palette.text,
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: isDownloading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Upload size={18} strokeWidth={1.75} aria-hidden />
                  {isDownloading ? 'Скачиваем файл...' : 'Скачать файл к задаче'}
                </button>
                {downloadError ? <div style={{ marginTop: 8, color: palette.danger, fontSize: 13 }}>{downloadError}</div> : null}
              </div>
            ) : null}

            {hasAttachment && attachmentLooksImage ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, color: palette.text, marginBottom: 6 }}>Изображение к заданию</div>
                {isLoadingImage ? <div style={{ color: palette.muted, fontSize: 13 }}>Загружаем изображение...</div> : null}
                {imagePreviewError ? <div style={{ color: palette.danger, fontSize: 13 }}>{imagePreviewError}</div> : null}
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Вложение к задаче"
                    style={{
                      width: '100%',
                      maxHeight: 340,
                      objectFit: 'contain',
                      border: `1px solid ${palette.border}`,
                      borderRadius: 12,
                      background: '#fff',
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </section>

          <section
            style={{
              background: palette.card,
              border: `1px solid ${palette.border}`,
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 520,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: palette.text, marginBottom: 10 }}>Ваше решение</div>

            <CodePane code={code} onChange={setCode} language={monacoLanguage} />

            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              style={{
                marginTop: 12,
                width: '100%',
                boxSizing: 'border-box',
                border: `1px solid ${palette.border}`,
                borderRadius: 12,
                padding: '11px 14px',
                background: '#fff',
                color: palette.text,
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <History size={18} strokeWidth={1.75} aria-hidden />
              {solutionHistory.length
                ? `Предыдущие решения и разборы ИИ (${solutionHistory.length})`
                : 'Предыдущие решения и разборы ИИ'}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!code.trim() || isSubmitting}
              style={{
                marginTop: 12,
                width: '100%',
                border: 0,
                borderRadius: 12,
                padding: '12px 14px',
                background: palette.blue,
                color: '#fff',
                fontWeight: 900,
                cursor: code.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                opacity: code.trim() && !isSubmitting ? 1 : 0.55,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Send size={18} strokeWidth={2} aria-hidden />
              {isSubmitting ? 'Отправка...' : 'Отправить на проверку'}
            </button>

            {submitError ? (
              <div style={{ marginTop: 10, color: palette.danger, fontSize: 13 }}>{submitError}</div>
            ) : null}

            {lastSubmitAt ? (
              <div style={{ marginTop: 10, color: palette.success, fontSize: 13 }}>
                Отправлено: {lastSubmitAt.toLocaleString('ru-RU')}
              </div>
            ) : null}

            {executionResult ? (
              <section
                style={{
                  marginTop: 12,
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: '#f8fbff',
                  padding: '12px 12px 10px',
                }}
              >
                <h3 style={{ margin: '0 0 8px', color: palette.text, fontSize: 15, fontWeight: 900 }}>Результат выполнения</h3>
                <div style={{ fontSize: 13, marginBottom: 8, color: executionResult.success ? palette.success : palette.danger, fontWeight: 800 }}>
                  {executionResult.success ? 'Код выполнен успешно' : 'Код выполнен с ошибками'}
                  {typeof executionResult.isAnswerCorrect === 'boolean'
                    ? ` • ${executionResult.isAnswerCorrect ? 'Ответ корректный' : 'Ответ некорректный'}`
                    : ''}
                </div>
                {executionResult.output ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: 13 }}>Output</div>
                    <pre style={{ margin: 0, padding: 10, borderRadius: 10, background: palette.editorBg, color: '#d7e3ff', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {executionResult.output}
                    </pre>
                  </div>
                ) : null}
                {executionResult.error ? (
                  <div>
                    <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: 13 }}>Error</div>
                    <pre style={{ margin: 0, padding: 10, borderRadius: 10, background: '#fff1f2', color: '#9f1239', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                      {executionResult.error}
                    </pre>
                  </div>
                ) : null}
              </section>
            ) : null}

            {aiFeedback ? <StructuredAiPanel structuredAi={structuredAi} aiFeedback={aiFeedback} compact={false} /> : null}
          </section>
        </div>
      </div>

      {historyOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="solution-history-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 42, 82, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
          }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            style={{
              width: 'min(720px, 100%)',
              maxHeight: 'min(88vh, 900px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: palette.card,
              borderRadius: 14,
              border: `1px solid ${palette.border}`,
              boxShadow: '0 18px 48px rgba(15, 42, 82, 0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 16px',
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              <div id="solution-history-title" style={{ fontWeight: 900, color: palette.text, fontSize: 17 }}>
                История отправок и разборы ИИ
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Закрыть"
                style={{
                  border: 0,
                  background: '#f0f4fa',
                  borderRadius: 10,
                  padding: 8,
                  cursor: 'pointer',
                  color: palette.text,
                  display: 'inline-flex',
                }}
              >
                <X size={20} strokeWidth={2} aria-hidden />
              </button>
            </div>
            <div style={{ overflow: 'auto', padding: 14, flex: 1, minHeight: 0 }}>
              {solutionHistory.length === 0 ? (
                <div style={{ color: palette.muted, fontSize: 14, lineHeight: 1.5 }}>
                  Пока нет сохранённых отправок по этой задаче. После нажатия «Отправить на проверку» здесь появятся копия кода, результат
                  выполнения и разбор ИИ.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  {solutionHistory.map((item) => {
                    const ex = item.executionResult;
                    const histStructured = parseAiStructuredFeedback(ex?.aiRecommendation || '', item.aiFeedback);
                    const when = item.at ? new Date(item.at) : null;
                    return (
                      <article
                        key={item.id}
                        style={{
                          border: `1px solid ${palette.border}`,
                          borderRadius: 12,
                          padding: 12,
                          background: '#fbfcff',
                        }}
                      >
                        <div style={{ fontWeight: 900, color: palette.text, marginBottom: 8, fontSize: 14 }}>
                          {when ? when.toLocaleString('ru-RU') : 'Без даты'}
                        </div>
                        {ex ? (
                          <div style={{ fontSize: 13, marginBottom: 10, color: ex.success ? palette.success : palette.danger, fontWeight: 800 }}>
                            {ex.success ? 'Код выполнен успешно' : 'Код выполнен с ошибками'}
                            {typeof ex.isAnswerCorrect === 'boolean'
                              ? ` • ${ex.isAnswerCorrect ? 'Ответ корректный' : 'Ответ некорректный'}`
                              : ''}
                          </div>
                        ) : null}
                        {ex?.output ? (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: 12 }}>Output</div>
                            <pre
                              style={{
                                margin: 0,
                                padding: 10,
                                borderRadius: 10,
                                background: palette.editorBg,
                                color: '#d7e3ff',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                maxHeight: 160,
                                overflow: 'auto',
                              }}
                            >
                              {ex.output}
                            </pre>
                          </div>
                        ) : null}
                        {ex?.error ? (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: 12 }}>Error</div>
                            <pre
                              style={{
                                margin: 0,
                                padding: 10,
                                borderRadius: 10,
                                background: '#fff1f2',
                                color: '#9f1239',
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                maxHeight: 120,
                                overflow: 'auto',
                              }}
                            >
                              {ex.error}
                            </pre>
                          </div>
                        ) : null}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 800, color: palette.text, marginBottom: 5, fontSize: 12 }}>Отправленный код</div>
                          <pre
                            style={{
                              margin: 0,
                              padding: 10,
                              borderRadius: 10,
                              background: palette.editorBg,
                              color: '#d7e3ff',
                              fontSize: 12,
                              whiteSpace: 'pre-wrap',
                              maxHeight: 220,
                              overflow: 'auto',
                            }}
                          >
                            {item.code || ''}
                          </pre>
                        </div>
                        {item.aiFeedback ? <StructuredAiPanel structuredAi={histStructured} aiFeedback={item.aiFeedback} compact /> : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
