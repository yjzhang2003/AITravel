import { useEffect, useMemo, useState } from 'react';

import { AuthPage } from './pages/AuthPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';

const emptyForm = {
  destination: '',
  startDate: '',
  endDate: '',
  budget: 10000,
  companions: 2,
  preferences: ['美食'],
  notes: ''
};

export default function App() {
  const [formData, setFormData] = useState(emptyForm);
  const [itinerary, setItinerary] = useState(null);
  const [budget, setBudget] = useState(null);
  const [history, setHistory] = useState([]);
  const [session, setSession] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [configStatus, setConfigStatus] = useState(null);
  const [mapKey, setMapKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/config/status')
      .then((res) => res.json())
      .then(setConfigStatus)
      .catch(() => setConfigStatus(null));
  }, []);

  useEffect(() => {
    fetch('/api/config/map-key')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setMapKey(data.mapKey))
      .catch(() => setMapKey(null));
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchHistory(session.user.id);
    } else if (guestMode) {
      setHistory([]);
    }
  }, [session?.user?.id, guestMode]);

  const fetchHistory = async (userId) => {
    try {
      const response = await fetch(`/api/itineraries?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) {
        throw new Error('无法获取历史行程');
      }
      const data = await response.json();
      setHistory(data.itineraries ?? []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          userId: session?.user?.id
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '行程生成失败');
      }

      const data = await response.json();
      const generated = data.itinerary ?? data;
      setItinerary(generated.itinerary ?? generated);
      setBudget(generated.budget ?? null);
      if (session?.user?.id) {
        fetchHistory(session.user.id);
      }
    } catch (err) {
      setError(err.message ?? '行程生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateBudget = async () => {
    if (!itinerary) return;
    setBudgetLoading(true);
    try {
      const response = await fetch(`/api/itineraries/${itinerary.id ?? 'preview'}/budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itinerary,
          overrides: {
            baseBudget: Number(formData.budget) || undefined,
            companions: Number(formData.companions) || undefined
          }
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '预算估算失败');
      }

      const data = await response.json();
      setBudget(data.budget ?? data);
    } catch (err) {
      setError(err.message ?? '预算估算失败');
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleLogin = async ({ email, password }) => {
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '登录失败');
      }

      const data = await response.json();
      setSession(data);
      setGuestMode(false);
      return data;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async ({ email, password }) => {
    setAuthLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '注册失败');
      }

      return response.json();
    } finally {
      setAuthLoading(false);
    }
  };

  const handleHistorySelect = (item) => {
    setItinerary(item.itinerary ?? item);
    setBudget(item.budget ?? null);
  };

  const normalizedItinerary = useMemo(() => itinerary?.itinerary ?? itinerary, [itinerary]);

  const configHint = useMemo(() => {
    if (!configStatus) return null;
    const items = [];
    if (!configStatus.supabase) items.push('Supabase 未配置，登录功能暂不可用');
    if (!configStatus.llm) items.push('大模型 API Key 未配置，默认返回示例数据');
    if (!configStatus.map) items.push('地图 Key 未配置，地图无法加载');
    if (!configStatus.voice) items.push('语音识别未配置，将使用浏览器语音识别或示例文案');
    if (items.length === 0) return null;
    return items.join('；');
  }, [configStatus]);

  const handleLogout = () => {
    setSession(null);
    setGuestMode(false);
    setHistory([]);
    setItinerary(null);
    setBudget(null);
    setFormData(emptyForm);
  };

  if (!session && !guestMode) {
    return (
      <AuthPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={authLoading}
        configStatus={configStatus}
        onContinue={() => setGuestMode(true)}
      />
    );
  }

  return (
    <DashboardPage
      session={session}
      onLogout={handleLogout}
      formData={formData}
      onChangeForm={setFormData}
      onGenerate={handleGenerate}
      loading={loading}
      history={history}
      onSelectHistory={handleHistorySelect}
      error={error}
      itinerary={normalizedItinerary}
      budget={budget}
      onRecalculateBudget={handleRecalculateBudget}
      budgetLoading={budgetLoading}
      mapKey={mapKey}
      configHint={configHint}
    />
  );
}
