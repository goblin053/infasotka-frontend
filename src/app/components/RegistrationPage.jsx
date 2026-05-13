import React, { useState } from 'react';
import { apiRequest, setAccessToken } from '../shared/apiClient';
import { decodeJwtPayload, displayNameFromClaims, resolveUserRole, stableStorageUserId, userUuidForApi } from '../shared/authToken';

export function RegistrationPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === 'login';

  const isValidEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());
  const isValidPhone = (value) => /^\+?\d[\d\s\-()]{8,}$/.test(String(value || '').trim());

  const handleSubmit = async (event) => {
    event.preventDefault();
    setInfo('');
    if (!email.trim()) {
      setError('Введите email.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Введите корректный email.');
      return;
    }
    if (!password.trim()) {
      setError('Введите пароль.');
      return;
    }

    if (!isLogin) {
      if (!agreePolicy) {
        setError('Нужно согласиться с политикой конфиденциальности.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Пароли не совпадают.');
        return;
      }
      if (password.length < 8) {
        setError('Пароль должен содержать минимум 8 символов.');
        return;
      }
      if (!phone.trim()) {
        setError('Введите номер телефона.');
        return;
      }
      if (!isValidPhone(phone)) {
        setError('Введите корректный номер телефона.');
        return;
      }
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const loginResponse = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
        const accessToken = loginResponse?.accessToken;
        if (!accessToken) {
          throw new Error('Сервер не вернул accessToken.');
        }
        const payload = decodeJwtPayload(accessToken);
        setAccessToken(accessToken);
        const { role: resolvedRole, profile } = await resolveUserRole(apiRequest, payload);
        const resolvedName =
          profile?.name ||
          profile?.fullName ||
          profile?.displayName ||
          displayNameFromClaims(payload, email.trim());
        const storageUserId = stableStorageUserId(payload);
        const userUuid = userUuidForApi(payload, profile);
        onLogin({
          id: userUuid || payload?.userId || payload?.id || payload?.sub || Date.now(),
          name: resolvedName,
          role: resolvedRole,
          token: accessToken,
          rememberMe,
          ...(storageUserId ? { storageUserId } : {}),
          ...(userUuid ? { userUuid } : {}),
          ...(profile?.avatar ? { avatar: profile.avatar } : {}),
        });
      } else {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            password,
            phone: phone.trim(),
          }),
        });
        setInfo('Пользователь успешно зарегистрирован. Теперь войдите в аккаунт.');
        setMode('login');
        setName('');
        setEmail('');
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
      }
    } catch (submitError) {
      setError(submitError?.message || 'Ошибка при запросе к серверу.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f9fbff',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          margin: 0,
          background: '#fff',
          border: '1px solid #e4ebf7',
          borderRadius: 16,
          padding: '28px 24px 22px',
          boxShadow: '0 6px 16px rgba(17, 53, 111, 0.06)',
        }}
      >
        <h1 style={{ margin: '0 0 8px', textAlign: 'center', color: '#0c2d62', fontSize: 22, lineHeight: 1.2 }}>
          {isLogin ? 'Вход в аккаунт' : 'Регистрация'}
        </h1>
        <p style={{ margin: '0 0 20px', textAlign: 'center', color: '#6f85ad', lineHeight: 1.35, fontSize: 14 }}>
          {isLogin ? 'Добро пожаловать! Войдите, чтобы продолжить подготовку' : 'Начните подготовку к ЕГЭ по информатике с AI-помощником'}
        </p>

        <form onSubmit={handleSubmit}>
          {!isLogin ? (
            <>
              <label htmlFor="name" style={{ display: 'block', marginBottom: 6, color: '#0c2d62', fontWeight: 600, fontSize: 14 }}>
                Имя <span style={{ color: '#a3b4d1' }}>(необязательно)</span>
              </label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb4d5', fontSize: 15 }}>👤</span>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Иван"
                  style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid #d7e3f7', fontSize: 14 }}
                />
              </div>

              <label htmlFor="phone" style={{ display: 'block', marginBottom: 6, color: '#0c2d62', fontWeight: 600, fontSize: 14 }}>
                Телефон
              </label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb4d5', fontSize: 14 }}>📱</span>
                <input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+79991234567"
                  style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid #d7e3f7', fontSize: 14 }}
                />
              </div>
            </>
          ) : null}

          <label htmlFor="email" style={{ display: 'block', marginBottom: 6, color: '#0c2d62', fontWeight: 600, fontSize: 14 }}>
            Email
          </label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb4d5', fontSize: 14 }}>✉</span>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              style={{ width: '100%', padding: '11px 12px 11px 38px', borderRadius: 10, border: '1px solid #d7e3f7', fontSize: 14 }}
            />
          </div>

          <label htmlFor="password" style={{ display: 'block', marginBottom: 6, color: '#0c2d62', fontWeight: 600, fontSize: 14 }}>
            Пароль
          </label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb4d5', fontSize: 14 }}>🔒</span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '11px 40px 11px 38px', borderRadius: 10, border: '1px solid #d7e3f7', fontSize: 14 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', color: '#9fb4d5', fontSize: 14 }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          {!isLogin ? (
            <>
              <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: 6, color: '#0c2d62', fontWeight: 600, fontSize: 14 }}>
                Подтверждение пароля
              </label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb4d5', fontSize: 14 }}>🔒</span>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '11px 40px 11px 38px', borderRadius: 10, border: '1px solid #d7e3f7', fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', color: '#9fb4d5', fontSize: 14 }}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </button>
              </div>
            </>
          ) : null}

          {isLogin ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5c7097', fontSize: 14 }}>
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                Запомнить меня
              </label>
              <button type="button" style={{ background: 'transparent', border: 0, color: '#3a80ff', cursor: 'pointer', fontSize: 14 }}>
                Забыли пароль?
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#5c7097', marginBottom: 12, fontSize: 14 }}>
              <input type="checkbox" checked={agreePolicy} onChange={(event) => setAgreePolicy(event.target.checked)} />
              Я согласен с <span style={{ color: '#3a80ff' }}>политикой конфиденциальности</span>
            </label>
          )}

          {error ? <p style={{ color: '#b00020', marginTop: 0 }}>{error}</p> : null}
          {info ? <p style={{ color: '#157347', marginTop: 0 }}>{info}</p> : null}

          <button
            type="submit"
            style={{
              width: '100%',
              border: 0,
              borderRadius: 12,
              padding: '12px 16px',
              color: '#fff',
              background: '#3a80ff',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              marginBottom: 16,
              opacity: isSubmitting ? 0.7 : 1,
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Отправка...' : isLogin ? 'Войти' : 'Зарегистрироваться'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, color: '#9aaecf', fontSize: 14 }}>
            <div style={{ height: 1, flex: 1, background: '#e3ecfb' }} />
            {isLogin ? 'или войти через' : 'или зарегистрироваться через'}
            <div style={{ height: 1, flex: 1, background: '#e3ecfb' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button type="button" style={{ padding: 10, borderRadius: 12, border: '1px solid #d7e3f7', background: '#fff', fontSize: 15 }}>
              Google
            </button>
            <button type="button" style={{ padding: 10, borderRadius: 12, border: '1px solid #d7e3f7', background: '#fff', fontSize: 15 }}>
              VK
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 18, color: '#5c7097', fontSize: 14 }}>
            {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isLogin ? 'register' : 'login');
                setError('');
                setInfo('');
              }}
              style={{ border: 0, background: 'transparent', color: '#3a80ff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
            >
              {isLogin ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </p>
        </form>
      </div>

      <p style={{ textAlign: 'center', color: '#7387ad', marginTop: 14, fontSize: 13, maxWidth: 420 }}>
        Используя сервис, вы соглашаетесь с <span style={{ color: '#3a80ff', textDecoration: 'underline' }}>условиями использования</span>
      </p>
    </main>
  );
}
