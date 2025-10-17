import crypto from 'crypto';
import { Buffer } from 'node:buffer';

import WebSocket from 'ws';

import '../config/env.js';

const isWebSocketUrl = (url) => /^wss?:\/\//i.test(url ?? '');

export const voiceService = {
  async transcribe(body) {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      language = 'zh-CN'
    } = body ?? {};

    if (!audioBase64) {
      return { text: '', error: 'Missing audio payload.' };
    }

    const voiceKey = process.env.VOICE_API_KEY;
    const voiceSecret = process.env.VOICE_SECRET_KEY;
    const voiceUrl = process.env.VOICE_API_URL;
    const voiceAppId = process.env.VOICE_APP_ID;

    if (!voiceKey || !voiceUrl) {
      return {
        text: body?.mockTranscript ?? '（此处将显示语音识别结果，当前为示例文本）',
        provider: 'mock',
        error: 'Voice provider not fully configured on server.'
      };
    }

    if (isWebSocketUrl(voiceUrl)) {
      if (!voiceSecret || !voiceAppId) {
        throw new Error('Voice websocket requires VOICE_SECRET_KEY and VOICE_APP_ID.');
      }
      return transcribeViaXfyunWebsocket({
        url: voiceUrl,
        apiKey: voiceKey,
        apiSecret: voiceSecret,
        appId: voiceAppId,
        audioBase64,
        mimeType,
        language
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: voiceSecret
        ? `Basic ${Buffer.from(`${voiceKey}:${voiceSecret}`).toString('base64')}`
        : `Bearer ${voiceKey}`
    };

    const response = await fetch(voiceUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audio: audioBase64,
        format: mimeType,
        language
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice provider error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      text: data?.text ?? '',
      provider: data?.provider ?? 'custom'
    };
  }
};

const transcribeViaXfyunWebsocket = ({
  url,
  apiKey,
  apiSecret,
  appId,
  audioBase64,
  mimeType,
  language
}) =>
  new Promise((resolve, reject) => {
    try {
      const signedUrl = buildXfyunSignedUrl(url, apiKey, apiSecret);
      const ws = new WebSocket(signedUrl);
      let transcript = '';
      let completed = false;

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            common: { app_id: appId },
            business: {
              language: normalizeLanguage(language),
              domain: 'iat',
              accent: 'mandarin',
              vad_eos: 5000
            },
            data: {
              status: 2,
              format: mapMimeTypeToFormat(mimeType),
              encoding: 'base64',
              audio: audioBase64
            }
          })
        );
      });

      ws.on('message', (message) => {
        const payload = parseMessage(message);
        if (!payload) {
          return;
        }

        if (payload.code !== 0) {
          completed = true;
          ws.close();
          reject(new Error(`Voice provider error: ${payload.code} ${payload.message}`));
          return;
        }

        if (payload.data?.result?.ws) {
          transcript += payload.data.result.ws
            .map((w) => w.cw?.map((cw) => cw.w).join('') ?? '')
            .join('');
        }

        if (payload.data?.status === 2) {
          completed = true;
          ws.close();
          resolve({
            text: transcript,
            provider: 'xfyun'
          });
        }
      });

      ws.on('error', (error) => {
        if (!completed) {
          completed = true;
          reject(error);
        }
      });

      ws.on('close', () => {
        if (!completed) {
          reject(new Error('Voice websocket closed before completion.'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });

const buildXfyunSignedUrl = (rawUrl, apiKey, apiSecret) => {
  const url = new URL(rawUrl);
  const host = url.host;
  const path = url.pathname;
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  url.searchParams.set('authorization', authorization);
  url.searchParams.set('date', date);
  url.searchParams.set('host', host);

  return url.toString();
};

const mapMimeTypeToFormat = (mimeType) => {
  if (!mimeType) return 'audio/L16;rate=16000';
  if (mimeType.includes('wav')) return 'audio/wav';
  if (mimeType.includes('mp3')) return 'audio/mp3';
  if (mimeType.includes('m4a')) return 'audio/m4a';
  if (mimeType.includes('opus') || mimeType.includes('webm')) return 'audio/opus';
  return 'audio/L16;rate=16000';
};

const normalizeLanguage = (language) => {
  if (!language) return 'zh_cn';
  return language.toLowerCase().replace('-', '_');
};

const parseMessage = (message) => {
  try {
    const text = typeof message === 'string' ? message : message.toString();
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
};
