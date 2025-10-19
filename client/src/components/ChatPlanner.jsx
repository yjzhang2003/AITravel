import { useEffect, useRef, useState } from 'react';

export const ChatPlanner = ({ messages, onSend, loading, onReset }) => {
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  const startRecording = async () => {
    try {
      setVoiceError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持语音输入。');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      streamRef.current = stream;
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleRecorderStop;
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      setVoiceError(error?.message ?? '无法访问麦克风，请检查浏览器权限设置。');
      stopStream();
      setRecording(false);
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopStream();
    setRecording(false);
  };

  const handleRecorderStop = async () => {
    const blob = new Blob(chunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm'
    });
    mediaRecorderRef.current = null;

    chunksRef.current = [];
    setVoiceLoading(true);
    try {
      const { base64, format } = await encodeBlobToPCM(blob);
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: format,
          language: 'zh-CN'
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '语音识别失败');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.text) {
        setInput((prev) => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : '';
          return `${prev}${separator}${data.text}`.trimStart();
        });
      }
    } catch (error) {
      setVoiceError(error.message ?? '语音识别失败，请重试');
    } finally {
      setVoiceLoading(false);
    }
  };

  const handleVoiceClick = () => {
    if (loading || voiceLoading) return;
    if (!recording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return (
    <section className="panel chat-planner">
      <div className="panel-header">
        <span>AI 旅行顾问</span>
        <button className="text-button" type="button" onClick={onReset} disabled={loading}>
          重新开始
        </button>
      </div>
      <div className="chat-messages" role="log" aria-live="polite">
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
            placeholder={
              loading ? '请稍候...' : recording ? '录音中...点击话筒结束录音。' : '描述你的旅行想法，例如“想去西安玩三天”。'
            }
            onChange={(event) => setInput(event.target.value)}
            disabled={loading || recording || voiceLoading}
          />
          <div className="chat-input-actions">
            <button
              type="button"
              className={`icon-button${recording ? ' recording' : ''}`}
              aria-label={recording ? '停止录音' : '语音输入'}
              aria-pressed={recording}
              onClick={handleVoiceClick}
              disabled={loading || voiceLoading}
            >
              {voiceLoading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
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
              )}
            </button>
            <button className="primary" type="submit" disabled={loading || voiceLoading || !input.trim()}>
              发送
            </button>
          </div>
          {voiceError && <p className="error-text" style={{ margin: '0', fontSize: '0.85rem' }}>{voiceError}</p>}
        </div>
      </form>
    </section>
  );
};

const encodeBlobToPCM = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const sampleRate = 16000;
  const duration = decodedBuffer.duration;
  const offlineContext = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

  const monoBuffer = offlineContext.createBuffer(1, decodedBuffer.length, decodedBuffer.sampleRate);
  const monoData = monoBuffer.getChannelData(0);
  const channelData = decodedBuffer.getChannelData(0);

  if (decodedBuffer.numberOfChannels === 1) {
    monoData.set(channelData);
  } else {
    const tmp = new Float32Array(decodedBuffer.length);
    for (let channel = 0; channel < decodedBuffer.numberOfChannels; channel += 1) {
      const data = decodedBuffer.getChannelData(channel);
      for (let i = 0; i < decodedBuffer.length; i += 1) {
        tmp[i] += data[i];
      }
    }
    for (let i = 0; i < tmp.length; i += 1) {
      monoData[i] = tmp[i] / decodedBuffer.numberOfChannels;
    }
  }

  const source = offlineContext.createBufferSource();
  source.buffer = monoBuffer;
  source.connect(offlineContext.destination);
  source.start(0);
  const renderedBuffer = await offlineContext.startRendering();

  audioContext.close();

  const pcmData = renderedBuffer.getChannelData(0);
  const pcm16 = floatTo16BitPCM(pcmData);
  const base64 = arrayBufferToBase64(pcm16.buffer);

  return {
    base64,
    format: 'audio/L16;rate=16000'
  };
};

const floatTo16BitPCM = (float32Array) => {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
};

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
};
