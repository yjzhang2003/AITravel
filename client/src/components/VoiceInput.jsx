import { useEffect, useRef, useState } from 'react';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition.js';

export const VoiceInput = ({ onTranscript }) => {
  const [mode, setMode] = useState('webSpeech');
  const [recording, setRecording] = useState(false);
  const [backendError, setBackendError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const speech = useSpeechRecognition({
    onResult: onTranscript,
    lang: 'zh-CN'
  });

  useEffect(() => {
    if (!speech.supported) {
      setMode('backend');
    }
  }, [speech.supported]);

  useEffect(() => {
    if (!recording) {
      return;
    }

    return () => {
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, [recording]);

  const startBackendRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const base64 = await blobToBase64(blob);
        await sendToBackend(base64, blob.type || mediaRecorder.mimeType);
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const stopBackendRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const sendToBackend = async (audioBase64, mimeType) => {
    try {
      setBackendError(null);
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioBase64,
          mimeType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      if (data?.text) {
        onTranscript(data.text);
      }
    } catch (error) {
      setBackendError(error.message);
    }
  };

  const handleWebSpeech = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      speech.start();
    }
  };

  const handleBackend = () => {
    if (recording) {
      stopBackendRecording();
    } else {
      startBackendRecording();
    }
  };

  return (
    <div className="voice-input panel">
      <div className="panel-header">
        <span>语音输入</span>
        <small className="muted">
          {mode === 'webSpeech'
            ? '使用浏览器语音识别'
            : '录音后由后端转写（需配置语音 API）'}
        </small>
      </div>
      {speech.supported && (
        <button className="primary" type="button" onClick={handleWebSpeech}>
          {speech.listening ? '停止识别' : '开始语音'}
        </button>
      )}
      {!speech.supported && (
        <button className="primary" type="button" onClick={handleBackend}>
          {recording ? '停止录音' : '开始录音'}
        </button>
      )}
      {speech.transcript && <p className="muted">识别结果：{speech.transcript}</p>}
      {backendError && <p className="error-text">语音接口报错：{backendError}</p>}
    </div>
  );
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.split(',')[1]);
      } else {
        reject(new Error('无法读取音频数据'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
