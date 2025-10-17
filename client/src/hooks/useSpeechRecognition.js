import { useCallback, useEffect, useRef, useState } from 'react';

export const useSpeechRecognition = (options = {}) => {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const onResultRef = useRef(options.onResult);

  useEffect(() => {
    onResultRef.current = options.onResult;
  }, [options.onResult]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = options.lang ?? 'zh-CN';
    recognition.interimResults = options.interimResults ?? false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const [result] = event.results[event.resultIndex];
      if (result?.transcript) {
        setTranscript(result.transcript);
        onResultRef.current?.(result.transcript);
      }
    };

    recognition.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setSupported(true);
  }, [options.lang, options.interimResults]);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) {
      return;
    }
    setTranscript('');
    setError(null);
    recognitionRef.current.start();
    setListening(true);
  }, [listening]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return {
    supported,
    listening,
    transcript,
    error,
    start,
    stop,
    reset: () => setTranscript('')
  };
};
