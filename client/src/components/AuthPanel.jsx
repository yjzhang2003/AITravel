import { useState } from 'react';

export const AuthPanel = ({ onLogin, onRegister, loading, session }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'login') {
        await onLogin({ email, password });
        setMessage('登录成功');
      } else {
        await onRegister({ email, password });
        setMessage('注册成功');
        setMode('login');
      }
    } catch (error) {
      setMessage(error.message ?? '操作失败');
    }
  };

  if (session) {
    return (
      <section className="panel">
        <div className="panel-header">
          <span>当前用户</span>
        </div>
        <p>{session.user?.email}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span>{mode === 'login' ? '登录' : '注册'}账号</span>
        <button
          type="button"
          className="text-button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          切换到{mode === 'login' ? '注册' : '登录'}
        </button>
      </div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          <span>邮箱</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="primary" type="submit" disabled={loading}>
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>
      {message && <p className="muted">{message}</p>}
    </section>
  );
};
