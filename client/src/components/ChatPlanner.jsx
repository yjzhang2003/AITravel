import { useEffect, useRef, useState } from 'react';

export const ChatPlanner = ({ messages, onSend, loading, onReset, onVoice }) => {
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
        <div className="chat-input-field">
          <textarea
            rows={1}
            value={input}
            placeholder={loading ? '请稍候...' : '描述你的旅行想法，例如“想去西安玩三天”。'}
            onChange={(event) => setInput(event.target.value)}
            disabled={loading}
          />
          <div className="chat-input-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="语音输入"
              onClick={onVoice}
              disabled={loading}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 15c1.933 0 3.5-1.567 3.5-3.5v-5C15.5 4.567 13.933 3 12 3S8.5 4.567 8.5 6.5v5C8.5 13.433 10.067 15 12 15Z"
                  fill="currentColor"
                />
                <path
                  d="M18 11.5C18 14.538 15.538 17 12.5 17h-1C8.462 17 6 14.538 6 11.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M12 17v3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M9 21h6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button className="primary" type="submit" disabled={loading || !input.trim()}>
              发送
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
