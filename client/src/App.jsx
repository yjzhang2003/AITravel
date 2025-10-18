import { useEffect, useMemo, useState } from 'react';

import { AuthPage } from './pages/AuthPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';

const initialAssistantMessage = {
  role: 'assistant',
  content: '你好，我是你的 AI 旅行顾问。告诉我想去哪里、什么时候出发，我会一步步帮你制定行程！'
};

export default function App() {
  const [chatMessages, setChatMessages] = useState([initialAssistantMessage]);
  const [chatLoading, setChatLoading] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [budget, setBudget] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentRequest, setCurrentRequest] = useState({});
  const [session, setSession] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
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
            baseBudget: Number(currentRequest.budget) || undefined,
            companions: Number(currentRequest.companions ?? currentRequest.travelers) || undefined
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
    if (item.request) {
      setCurrentRequest(item.request);
    }
  };

  const handleHistoryDelete = async (item) => {
    if (!item?.id) return;
    try {
      const response = await fetch(`/api/itineraries/${item.id}?userId=${encodeURIComponent(session?.user?.id ?? '')}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '删除行程失败');
      }

      setHistory((prev) => prev.filter((historyItem) => historyItem.id !== item.id));
      if (itinerary?.id === item.id) {
        setItinerary(null);
        setBudget(null);
      }
    } catch (err) {
      setError(err.message ?? '删除行程失败，请稍后重试');
    }
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
    setCurrentRequest({});
    setChatMessages([initialAssistantMessage]);
    setError('');
  };

  const handleChatSend = async (text) => {
    const newHistory = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newHistory);
    setChatLoading(true);
    setError('');
    try {
      const response = await fetch('/api/itineraries/chat/converse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newHistory,
          userContext: {
            destination: currentRequest.destination
          }
        })
      });

      if (!response.ok) {
        const textBody = await response.text();
        throw new Error(textBody || '对话失败，请稍后再试');
      }

      const data = await response.json();
      setChatMessages((prev) => [...newHistory, { role: 'assistant', content: data.reply ?? '' }]);

      if (data.itineraryRequest) {
        setCurrentRequest((prev) => ({ ...prev, ...data.itineraryRequest }));
      }

      if (data.itinerary) {
        setItinerary(data.itinerary);
        setBudget(data.budget ?? null);
      }
    } catch (err) {
      setError(err.message ?? '对话出现问题，请稍后重试');
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatReset = () => {
    setChatMessages([initialAssistantMessage]);
    setItinerary(null);
    setBudget(null);
    setCurrentRequest({});
    setError('');
  };

  const handleSaveItinerary = async () => {
    if (!session?.user?.id) {
      setError('登录后才能保存行程。');
      return;
    }

    if (!currentRequest.destination) {
      setError('当前行程缺少目的地信息，暂无法保存。');
      return;
    }

    setSavingItinerary(true);
    setError('');

    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...currentRequest,
          userId: session?.user?.id
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '保存行程失败');
      }

      const data = await response.json();
      const generated = data.itinerary ?? data;
      setItinerary(generated.itinerary ?? generated);
      setBudget(generated.budget ?? null);
      if (session?.user?.id) {
        fetchHistory(session.user.id);
      }
    } catch (err) {
      setError(err.message ?? '保存失败，请稍后重试');
    } finally {
      setSavingItinerary(false);
    }
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
      chatMessages={chatMessages}
      onChatSend={handleChatSend}
      onChatReset={handleChatReset}
      chatLoading={chatLoading}
      history={history}
      onSelectHistory={handleHistorySelect}
      onDeleteHistory={session?.user?.id ? handleHistoryDelete : null}
      error={error}
      itinerary={normalizedItinerary}
      budget={budget}
      onRecalculateBudget={handleRecalculateBudget}
      budgetLoading={budgetLoading}
      mapKey={mapKey}
      configHint={configHint}
      onSaveItinerary={handleSaveItinerary}
      canSaveItinerary={Boolean(session?.user?.id && normalizedItinerary && Object.keys(currentRequest).length > 0)}
      savingItinerary={savingItinerary}
    />
  );
}
