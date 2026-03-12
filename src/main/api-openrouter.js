const https = require('https');
const { getSetting } = require('./settings');

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', hi: 'Hindi', fr: 'French', de: 'German',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', pt: 'Portuguese',
  ru: 'Russian', it: 'Italian', nl: 'Dutch', tr: 'Turkish', pl: 'Polish',
  sv: 'Swedish', id: 'Indonesian', th: 'Thai', vi: 'Vietnamese', uk: 'Ukrainian',
  cs: 'Czech', ro: 'Romanian', el: 'Greek', he: 'Hebrew', bn: 'Bengali', ta: 'Tamil',
};

const LANGUAGE_SCRIPTS = {
  hi: 'Devanagari',
  bn: 'Bengali',
  ta: 'Tamil',
  he: 'Hebrew',
  ar: 'Arabic',
  el: 'Greek',
  uk: 'Cyrillic',
  ru: 'Cyrillic',
  ko: 'Hangul',
  ja: 'Japanese (Kanji/Hiragana/Katakana)',
  zh: 'Simplified Chinese characters',
  th: 'Thai',
};

const DEFAULT_SYSTEM_PROMPT = `You are a dictation post-processor. You receive raw speech-to-text output and return clean text ready to be typed into an application.

Your job:
- Remove filler words (um, uh, you know, like) unless they carry meaning.
- Fix spelling, grammar, and punctuation errors.
- When the transcript already contains a word that is a close misspelling of a name or term from the context or custom vocabulary, correct the spelling. Never insert names or terms from context that the speaker did not say.
- Preserve the speaker's intent, tone, and meaning exactly.

Output rules:
- Return ONLY the cleaned transcript text, nothing else.
- If the transcription is empty, return exactly: EMPTY
- Do not add words, names, or content that are not in the transcription. The context is only for correcting spelling of words already spoken.
- Do not change the meaning of what was said.`;

async function postProcessTranscript(transcript, context = '', profile = null, action = null) {
  const openRouterKey = getSetting('openRouterApiKey', '');
  if (!openRouterKey) return transcript;

  // Quick action: skip post-processing entirely
  if (action === 'just-transcribe') return transcript;

  const model = getSetting('openRouterModel', 'meta-llama/llama-3.1-70b-instruct');
  const customVocabulary = getSetting('customVocabulary', '');

  let systemPrompt;
  if (profile && profile.systemPrompt && profile.systemPrompt.trim()) {
    systemPrompt = profile.systemPrompt.trim();
  } else {
    const customPrompt = getSetting('customSystemPrompt', '');
    systemPrompt = customPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  }

  if (customVocabulary.trim()) {
    const terms = customVocabulary
      .split(/[\n,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (terms.length > 0) {
      systemPrompt += `\n\nThe following vocabulary must be treated as high-priority terms while rewriting.\nUse these spellings exactly in the output when relevant:\n${terms.join(', ')}`;
    }
  }

  let actionSuffix = '';
  if (action === 'summarize') {
    actionSuffix = '\n\nAfter cleaning the transcription, summarize it concisely in a few sentences.';
  } else if (action === 'bullets') {
    actionSuffix = '\n\nAfter cleaning the transcription, format it as a bulleted list.';
  } else if (action === 'translate') {
    const translateLang = getSetting('translateTargetLanguage', 'en');
    const translateName = LANGUAGE_NAMES[translateLang] || translateLang;
    actionSuffix = `\n\nAfter cleaning the transcription, translate it to ${translateName}.`;
  } else if (action === 'reply') {
    systemPrompt = 'You are a reply assistant. The user is dictating a reply in the context of the active application. Clean up their dictated reply and make it natural and well-written. Return only the reply text.';
  }

  const transcriptionLanguage = getSetting('transcriptionLanguage', 'auto');
  if (transcriptionLanguage && transcriptionLanguage !== 'auto' && transcriptionLanguage !== 'en' && action !== 'translate') {
    const langName = LANGUAGE_NAMES[transcriptionLanguage] || transcriptionLanguage;
    const script = LANGUAGE_SCRIPTS[transcriptionLanguage];
    let langInstruction = `\n\nIMPORTANT: The transcription is in ${langName}. Clean up the text in ${langName}. Remove filler words appropriate to ${langName}. Fix grammar and punctuation for ${langName}. Do NOT translate to English. Output must be in ${langName}.`;
    if (script) {
      langInstruction += ` You MUST use ${script} script.`;
    }
    systemPrompt += langInstruction;
  }

  const userMessage = `Instructions: Clean up RAW_TRANSCRIPTION and return only the cleaned transcript text without surrounding quotes. Return EMPTY if there should be no result.${actionSuffix}

CONTEXT: "${context}"

RAW_TRANSCRIPTION: "${transcript}"`;

  const payload = JSON.stringify({
    model,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/echo-voice-ai',
          'X-Title': 'Echo Voice AI',
        },
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            console.error('Post-processing failed:', data);
            resolve(transcript);
            return;
          }
          try {
            const json = JSON.parse(data);
            let content = json.choices?.[0]?.message?.content || transcript;
            content = content.trim();
            if (content.startsWith('"') && content.endsWith('"') && content.length > 1) {
              content = content.slice(1, -1).trim();
            }
            if (content === 'EMPTY') content = '';
            resolve(content);
          } catch {
            resolve(transcript);
          }
        });
      }
    );

    req.on('error', () => resolve(transcript));
    req.on('timeout', () => {
      req.destroy();
      resolve(transcript);
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { postProcessTranscript, DEFAULT_SYSTEM_PROMPT };
