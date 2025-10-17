import { useMemo, useState } from 'react';

export const AuthPage = ({ onLogin, onRegister, loading, configStatus, onContinue }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const supabaseReady = configStatus?.supabase ?? true;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'login') {
        await onLogin({ email, password });
        setMessage('登录成功，正在进入主页…');
      } else {
        await onRegister({ email, password });
        setMessage('注册成功，请使用新账号登录');
        setMode('login');
      }
    } catch (error) {
      setMessage(error.message ?? '操作失败，请稍后再试');
    }
  };

  const statusHint = useMemo(() => {
    if (!configStatus) return null;
    if (!supabaseReady) {
      return '未配置用户系统，登录将不可用，可选择体验模式。';
    }
    return null;
  }, [configStatus, supabaseReady]);

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <h1>AI 旅行规划师</h1>
        <p>用 AI 减轻旅行规划负担，语音描述需求，自动生成行程、预算和地图导航。</p>
      </div>
      <div className="auth-card">
        <div className="auth-card__header">
          <h2>{mode === 'login' ? '登录账号' : '注册新账号'}</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage('');
            }}
          >
            切换到{mode === 'login' ? '注册' : '登录'}
          </button>
        </div>
        {statusHint && <p className="muted">{statusHint}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={!supabaseReady}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={!supabaseReady}
            />
          </label>
          <button className="primary" type="submit" disabled={loading || !supabaseReady}>
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
        {message && <p className="muted">{message}</p>}
        <div className="divider" role="presentation">
          <span>或</span>
        </div>
        <button className="secondary block-button" type="button" onClick={onContinue}>
          直接体验演示模式
        </button>
        <p className="fine-print">演示模式不会保存数据，生成的行程仅供临时参考。</p>
      </div>
    </div>
  );
};
