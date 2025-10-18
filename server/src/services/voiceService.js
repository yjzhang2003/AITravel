import crypto from 'crypto';
import { Buffer } from 'node:buffer';

import WebSocket from 'ws';

import '../config/env.js';

const isWebSocketUrl = (url) => /^wss?:\/\//i.test(url ?? '');

export const voiceService = {
  async transcribe(body) {
    const { audioBase64, language = 'zh-CN' } = body ?? {};

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

    if (!isWebSocketUrl(voiceUrl)) {
      throw new Error('VOICE_API_URL 必须配置为科大讯飞语音听写 WebSocket 地址 (wss://...)');
    }

    if (!voiceSecret || !voiceAppId) {
      throw new Error('语音接口需要 VOICE_SECRET_KEY 与 VOICE_APP_ID。');
    }

    return transcribeViaXfyunWebsocket({
      url: voiceUrl,
      apiKey: voiceKey,
      apiSecret: voiceSecret,
      appId: voiceAppId,
      audioBase64,
      language
    });
  }
};

const transcribeViaXfyunWebsocket = ({
  url,
  apiKey,
  apiSecret,
  appId,
  audioBase64,
  language
}) =>
  new Promise((resolve, reject) => {
    try {
      const signedUrl = buildXfyunSignedUrl(url, apiKey, apiSecret);
      const ws = new WebSocket(signedUrl, {
        perMessageDeflate: false
      });

      let transcript = '';
      let completed = false;
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const chunkSize = 1280;
      const chunks = [];
      for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
        chunks.push(audioBuffer.subarray(offset, Math.min(offset + chunkSize, audioBuffer.length)));
      }
      const format = 'audio/L16;rate=16000';
      let timer = null;

      ws.on('open', () => {
        let index = 0;

        const sendFrame = () => {
          if (completed) {
            clearInterval(timer);
            return;
          }

          if (index === 0) {
            const firstChunk = chunks[0] ?? Buffer.alloc(0);
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
                  status: chunks.length > 0 ? 0 : 2,
                  format,
                  encoding: 'raw',
                  audio: firstChunk.toString('base64')
                }
              })
            );

            if (chunks.length === 0) {
              clearInterval(timer);
            }
          } else if (index < chunks.length) {
            const chunk = chunks[index];
            const isLast = index === chunks.length - 1;
            ws.send(
              JSON.stringify({
                data: {
                  status: isLast ? 2 : 1,
                  format,
                  encoding: 'raw',
                  audio: chunk.toString('base64')
                }
              })
            );

            if (isLast) {
              clearInterval(timer);
              return;
            }
          } else {
            clearInterval(timer);
            return;
          }

          index += 1;
        };

        sendFrame();
        timer = setInterval(sendFrame, 40);
      });

      ws.on('message', (message) => {
        const payload = parseMessage(message);
        if (!payload) {
          return;
        }

        if (typeof payload.code === 'number' && payload.code !== 0) {
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

      ws.on('unexpected-response', (req, res) => {
        const chunksResponse = [];
        res.on('data', (chunk) => chunksResponse.push(chunk));
        res.on('end', () => {
          if (!completed) {
            completed = true;
            const body = Buffer.concat(chunksResponse).toString();
            reject(new Error(`Voice websocket unexpected response: ${res.statusCode} ${body}`));
          }
        });
      });

      ws.on('close', () => {
        if (timer) {
          clearInterval(timer);
        }
        if (!completed) {
          completed = true;
          if (transcript) {
            resolve({ text: transcript, provider: 'xfyun' });
          } else {
            reject(new Error('Voice websocket closed before completion.'));
          }
        }
      });
    } catch (error) {
      reject(error);
    }
  });

const buildXfyunSignedUrl = (rawUrl, apiKey, apiSecret, method = 'GET') => {
  const url = new URL(rawUrl);
  const host = url.host;
  const path = url.pathname;
  const date = new Date().toUTCString();

  const signatureOrigin = `host: ${host}\ndate: ${date}\n${method.toUpperCase()} ${path} HTTP/1.1`;
  const signatureSha = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');

  url.searchParams.set('authorization', authorization);
  url.searchParams.set('date', date);
  url.searchParams.set('host', host);

  return url.toString();
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
