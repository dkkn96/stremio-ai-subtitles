import { translationInstructions, TRANSLATION_SCHEMA } from './translator.js';
import { validateTranslations } from './subtitles.js';
import { AppError } from './errors.js';

// Optional Chat Completions interface: e.g. xAI or a local compatible server.
// Only explicit configuration enables it; it is never a CLI fallback.
export function createCompatibleTranslator(config, fetchImpl = fetch) {
  return async (cues, context) => {
    if (!config.apiEnabled) throw new AppError('API_DISABLED', 'API mode is disabled.');
    const response = await fetchImpl(`${config.apiBaseUrl}/chat/completions`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.providerTimeoutMs),
      headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: JSON.stringify({ model: config.model, stream: false, max_tokens: Math.min(24000, Math.max(4000, cues.length * 160)),
        messages: [{ role: 'system', content: translationInstructions(config) }, { role: 'user', content: JSON.stringify({ schema: TRANSLATION_SCHEMA, context, cues: cues.map(cue => ({ id: cue.id, text: cue.text, duration_seconds: (cue.end - cue.start) / 1000 })) }) }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new AppError(response.status === 429 ? 'MODEL_RATE_LIMIT' : 'MODEL_HTTP_ERROR', `AI API returned HTTP ${response.status}.`); }
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 4000000) throw new AppError('PROVIDER_OUTPUT_LIMIT', 'AI response too large.');
      chunks.push(chunk);
    }
    let data, translated;
    try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); translated = JSON.parse(data.choices?.[0]?.message?.content); }
    catch { throw new AppError('PROVIDER_INVALID_JSON', 'AI returned invalid JSON.'); }
    if (data.choices?.[0]?.finish_reason !== 'stop' || data.choices[0].message.tool_calls || data.choices[0].message.refusal) throw new AppError('PROVIDER_INCOMPLETE', 'AI did not finish a text-only translation.');
    return { cues: validateTranslations(cues, translated.translations), usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 } };
  };
}
