const crypto = require('crypto');
const https = require('https');
const { getSetting } = require('./settings');

async function transcribeAudio(audioBuffer, mimeType = 'audio/webm', language = 'auto') {
  const groqKey = getSetting('groqApiKey', '');
  const groqBaseUrl = getSetting('groqBaseUrl', 'https://api.groq.com/openai/v1');
  if (!groqKey) throw new Error('Groq API key not configured');

  const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('wav') ? 'wav' : 'webm';
  const boundary = '----FormBoundary' + crypto.randomBytes(16).toString('hex');

  const parts = [];
  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
    )
  );
  parts.push(Buffer.from(audioBuffer));
  parts.push(Buffer.from('\r\n'));

  parts.push(
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-large-v3\r\n`
    )
  );

  if (language && language !== 'auto') {
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `${language}\r\n`
    ));
  }

  if (getSetting('developerMode', false)) {
    const devPrompt = 'process.env, index.tsx, package.json, src/components/App.tsx, const myFunc = () =>, import { useState } from "react", ./utils/helpers, __dirname, API_KEY, camelCase, snake_case';
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
      `${devPrompt}\r\n`
    ));
  } else {
    const plainPrompt = 'Transcribe speech exactly as spoken words. Write out punctuation and symbols as words: "dot" for period, "slash" for /, "underscore" for _, "dash" for hyphen. Do not convert spoken words into code notation or programming syntax.';
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
      `${plainPrompt}\r\n`
    ));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  const url = new URL(`${groqBaseUrl}/audio/transcriptions`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: 30000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Transcription failed (${res.statusCode}): ${data}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            resolve(json.text || '');
          } catch {
            resolve(data.trim());
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Transcription request timed out'));
    });
    req.write(body);
    req.end();
  });
}

module.exports = { transcribeAudio };
