import { useEffect, useRef, useState } from 'react';

export const ChatPlanner = ({ messages, onSend, loading, onReset }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  return (
    <section className="panel chat-planner">
      <div className="panel-header">
        <span>AI 旅行顾问</span>
        <button className="text-button" type="button" onClick={onReset} disabled={loading}>
          重新开始
        </button>
      </div>
      <div className="chat-window" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'assistant' ? 'chat-bubble assistant' : 'chat-bubble user'}>
            <span>{message.content}</span>
          </div>
        ))}
        {loading && <div className="chat-bubble assistant loading">正在思考...</div>}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          placeholder={loading ? '请稍候...' : '描述你的旅行想法，例如“想去西安玩三天”。'}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
        />
        <button className="primary" type="submit" disabled={loading || !input.trim()}>
          发送
        </button>
      </form>
    </section>
  );
};
