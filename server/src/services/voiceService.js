import { Buffer } from 'node:buffer';

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

    if (!voiceKey || !voiceUrl) {
      return {
        text: body?.mockTranscript ?? '（此处将显示语音识别结果，当前为示例文本）',
        provider: 'mock',
        error: 'Voice provider not fully configured on server.'
      };
    }

    const headers = {
      'Content-Type': 'application/json'
    };

    if (voiceSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${voiceKey}:${voiceSecret}`).toString('base64')}`;
    } else {
      headers.Authorization = `Bearer ${voiceKey}`;
    }

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
