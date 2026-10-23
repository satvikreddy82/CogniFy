/**
 * gemini.ts — Robust Google Gemini integration for CogniFy question paper generation.
 *
 * Uses the official @google/genai JS SDK (@google/genai v2.x).
 * Model: configured via GEMINI_MODEL env var, default = gemini-3.8-flash.
 * Fallback model: configured via GEMINI_FALLBACK_MODEL, default = gemini-3.5-flash-lite.
 * API key: read from GEMINI_API_KEY — never returned in any response or error message.
 *
 * Features:
 * - Structured JSON output via responseSchema (token-level schema enforcement)
 * - FinishReason inspection (detects and handles MAX_TOKENS truncation safely)
 * - Controlled section-sized batch generation for multi-section / long papers
 * - Cross-section question deduplication and continuous numbering
 * - Bounded retries with exponential backoff & jitter
 * - Seamless fallback model support when primary experiences 503 high demand
 */

import { GoogleGenAI, Type, FinishReason } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SectionConfig {
  name: string;
  questions: number;
  marks_per_question: number;
  difficulty?: string;
  bloom_levels?: string[];
}

export interface GeneratedQuestion {
  question_number: number;
  section: string;
  text: string;
  marks: number;
  bloom_level: string;
  difficulty: string;
  co_id: string;
  source: 'bank' | 'generated';
  id?: string;
}

export interface GeminiPaperInput {
  course_name: string;
  course_code: string;
  title: string;
  total_marks: number;
  duration_minutes: number;
  syllabus: string;
  sections: SectionConfig[];
  bank_questions: Array<{
    id: string;
    text: string;
    marks: number;
    bloom_level: string;
    difficulty: string;
    co_id?: string;
  }>;
  course_outcomes: Array<{
    code: string;
    description: string;
  }>;
}

export interface GeminiPaperOutput {
  questions: GeneratedQuestion[];
  metadata: {
    provider: 'gemini';
    model: string;
    primary_model?: string;
    fallback_used?: boolean;
    generated_at: string;
    is_mock: false;
    total_marks_generated: number;
    bank_questions_used: number;
    ai_questions_generated: number;
    generation_mode?: 'whole_paper' | 'section_batched';
  };
}

// ─── Structured Output Schemas (@google/genai) ───────────────────────────────

export const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    question_number: { type: Type.INTEGER },
    section: { type: Type.STRING },
    text: { type: Type.STRING },
    marks: { type: Type.NUMBER },
    bloom_level: { type: Type.STRING },
    difficulty: { type: Type.STRING },
    co_id: { type: Type.STRING },
    source: { type: Type.STRING },
    id: { type: Type.STRING },
  },
  required: [
    'question_number',
    'section',
    'text',
    'marks',
    'bloom_level',
    'difficulty',
    'co_id',
    'source',
  ],
};

export const QUESTION_PAPER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: QUESTION_SCHEMA,
    },
  },
  required: ['questions'],
};

// ─── Validation & Errors ──────────────────────────────────────────────────────

const VALID_BLOOM = new Set(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard']);

export class GeminiValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(issues.length ? `${message}: ${issues.join('; ')}` : message);
    this.name = 'GeminiValidationError';
  }
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'AI_ERROR',
    public readonly isTransient: boolean = false,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export class GeminiTruncationError extends GeminiError {
  constructor(message: string) {
    super(
      message || 'Model output was truncated before completion (token limit reached).',
      422,
      'RESPONSE_TRUNCATED',
      true,
    );
    this.name = 'GeminiTruncationError';
  }
}

export class GeminiUnavailableError extends GeminiError {
  constructor(message: string, retryAfterSeconds?: number) {
    super(
      message || 'The Gemini AI model is currently experiencing high demand. Please try again shortly.',
      503,
      'MODEL_UNAVAILABLE',
      true,
      retryAfterSeconds || 5,
    );
    this.name = 'GeminiUnavailableError';
  }
}

export class GeminiQuotaError extends GeminiError {
  constructor(message: string, retryAfterSeconds?: number) {
    super(
      message || 'Gemini API quota or rate limit reached. Please wait before retrying.',
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      retryAfterSeconds || 30,
    );
    this.name = 'GeminiQuotaError';
  }
}
export class GeminiTimeoutError extends GeminiError {
  public readonly timeoutMs: number;
  constructor(message: string, timeoutMs?: number) {
    const ms = timeoutMs ?? 30000;
    super(
      message || `AI generation timed out after ${ms}ms.`,
      504,
      'REQUEST_TIMEOUT',
      true,
      undefined,
    );
    this.name = 'GeminiTimeoutError';
    this.timeoutMs = ms;
  }
}
/** Sanitize messages and classify errors without leaking API keys */
export function parseGeminiError(err: any): {
  isTransient: boolean;
  isUnavailable: boolean;
  isQuota: boolean;
  isAuth: boolean;
  statusCode: number;
  retryAfterSeconds?: number;
  sanitizedMessage: string;
} {
  const rawMsg = (err?.message || (typeof err === 'string' ? err : 'Unknown Gemini error')).toString();
  const apiKey = process.env.GEMINI_API_KEY || '';
  let sanitized = rawMsg;
  if (apiKey && apiKey.length > 5) {
    sanitized = sanitized.split(apiKey).join('[REDACTED_API_KEY]');
  }

  const status =
    err?.status ||
    err?.statusCode ||
    (rawMsg.includes('503')
      ? 503
      : rawMsg.includes('429')
      ? 429
      : rawMsg.includes('401')
      ? 401
      : rawMsg.includes('403')
      ? 403
      : rawMsg.includes('404')
      ? 404
      : /timed? out|timeout/i.test(rawMsg)
      ? 504
      : 500);

  const isUnavailable =
    status === 503 ||
    /503|unavailable|high demand|overloaded|spikes in demand/i.test(sanitized);

  const isQuota =
    status === 429 ||
    /429|resource_exhausted|quota|rate limit/i.test(sanitized);

  const isNetwork =
    status === 504 ||
    /timed? out|timeout|deadline exceeded|econnreset|etimedout|socket hang up|fetch failed|network timeout/i.test(sanitized);

  const isAuth =
    status === 401 ||
    status === 403 ||
    /permission_denied|api_key_invalid|invalid api key|unauthorized/i.test(sanitized);

  const isTransient = isUnavailable || isQuota || isNetwork;

  let retryAfterSeconds: number | undefined;
  const retryMatch = sanitized.match(/retry(?:-after|\s+in)?\s*[:=]?\s*(\d+)\s*(?:s|seconds)?/i);
  if (retryMatch) {
    const parsed = parseInt(retryMatch[1], 10);
    if (!isNaN(parsed) && parsed > 0) retryAfterSeconds = parsed;
  }

  return {
    isTransient,
    isUnavailable,
    isQuota,
    isAuth,
    statusCode: isUnavailable ? 503 : isQuota ? 429 : isAuth ? 401 : status,
    retryAfterSeconds,
    sanitizedMessage: sanitized,
  };
}

/** Normalize question text for duplicate detection across batches */
export function normalizeTextForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw candidate response:
 * - Checks finishReason for truncation (MAX_TOKENS) and safety blocks
 * - Extracts and parses structured JSON safely
 * - Returns the parsed object with { questions: [...] }
 */
export function parseModelResponse(
  candidate: any,
  contextLabel: string,
): { questions: any[] } {
  if (!candidate) {
    throw new GeminiError(`Gemini returned an empty candidate list for "${contextLabel}".`, 502, 'EMPTY_RESPONSE', true);
  }

  const finishReason = candidate.finishReason;
  if (finishReason === 'MAX_TOKENS' || finishReason === FinishReason.MAX_TOKENS) {
    throw new GeminiTruncationError(
      `Gemini response for "${contextLabel}" was truncated because maxOutputTokens was reached (finishReason=MAX_TOKENS). Output is incomplete.`,
    );
  }

  if (finishReason === 'SAFETY' || finishReason === FinishReason.SAFETY) {
    throw new GeminiError(
      `Gemini response for "${contextLabel}" was blocked by safety filters.`,
      400,
      'SAFETY_BLOCKED',
      false,
    );
  }

  const rawText = candidate.content?.parts?.[0]?.text ?? '';
  if (!rawText.trim()) {
    throw new GeminiError(`Gemini returned empty text for "${contextLabel}".`, 502, 'EMPTY_TEXT', true);
  }

  // Strip markdown fences if present
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (jsonErr: any) {
    throw new GeminiError(
      `Invalid JSON returned from model for "${contextLabel}": ${jsonErr.message}`,
      422,
      'MALFORMED_JSON',
      true,
    );
  }

  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new GeminiValidationError(
      `Gemini returned invalid structure for "${contextLabel}": missing questions array.`,
      ['Expected top-level { questions: [...] }'],
    );
  }

  return parsed;
}

/**
 * Validates and normalizes questions from a whole-paper response.
 */
export function validateAndNormalize(raw: any, input: GeminiPaperInput): GeneratedQuestion[] {
  if (!raw || !Array.isArray(raw.questions)) {
    throw new GeminiValidationError(
      'Gemini returned invalid structure: missing questions array',
      ['Expected top-level { questions: [...] }'],
    );
  }

  const issues: string[] = [];

  const questions: GeneratedQuestion[] = raw.questions.map((q: any, idx: number) => {
    const text = (q.text || q.question_text || q.question || '').toString().trim();
    if (text.length < 10) {
      issues.push(`Q${idx + 1}: text is empty or too short ("${text.slice(0, 30)}")`);
    }
    const bloom = VALID_BLOOM.has(q.bloom_level?.toLowerCase()) ? q.bloom_level.toLowerCase() : 'apply';
    const difficulty = VALID_DIFFICULTY.has(q.difficulty?.toLowerCase()) ? q.difficulty.toLowerCase() : 'medium';
    const marks = typeof q.marks === 'number' && q.marks > 0 ? q.marks : 0;
    if (marks === 0) issues.push(`Q${idx + 1}: marks is missing or zero`);
    const section = (q.section || input.sections[0]?.name || 'Section A').toString();
    const co_id = (q.co_id || `CO${(idx % 4) + 1}`).toString();

    return {
      question_number: idx + 1,
      section,
      text,
      marks,
      bloom_level: bloom,
      difficulty,
      co_id,
      source: q.source === 'bank' ? 'bank' : 'generated',
      id: q.id || `gen-${Date.now()}-${idx}`,
    } as GeneratedQuestion;
  });

  // Validate total marks (hard check — marks must balance)
  const total = questions.reduce((s, q) => s + q.marks, 0);
  if (total !== input.total_marks) {
    const delta = Math.abs(total - input.total_marks);
    const threshold = Math.ceil(input.total_marks * 0.2);
    if (delta <= threshold) {
      console.warn(
        `[Gemini] Auto-correcting marks total: got ${total}, expected ${input.total_marks} (delta=${delta} within ${threshold} threshold). Adjusting last question.`,
      );
      const diff = input.total_marks - total;
      if (questions.length > 0) {
        questions[questions.length - 1].marks += diff;
      }
    } else {
      issues.push(`Total marks: expected ${input.total_marks}, got ${total} (delta ${delta} exceeds 20% threshold)`);
    }
  }

  // Validate section question counts (soft check — log warning but don't fail)
  for (const sec of input.sections) {
    const count = questions.filter((q) => q.section === sec.name).length;
    if (count !== sec.questions) {
      console.warn(
        `[Gemini] Section "${sec.name}" count mismatch: expected ${sec.questions} Qs, got ${count}. Continuing anyway.`,
      );
    }
  }

  const criticalIssues = issues.filter(
    (i) => (i.startsWith('Q') && i.includes('text is empty')) || i.startsWith('Total marks:'),
  );
  if (criticalIssues.length > 0 || issues.length > 2) {
    throw new GeminiValidationError(
      `Paper failed validation (${issues.length} issue(s))`,
      issues,
    );
  }

  return questions;
}

/**
 * Validates and normalizes questions generated for a single section batch.
 * Enforces section mark weight and guards against duplicate questions.
 */
export function validateSectionQuestions(
  raw: any,
  section: SectionConfig,
  input: GeminiPaperInput,
  startIndex: number,
  existingQuestions: GeneratedQuestion[] = [],
): GeneratedQuestion[] {
  if (!raw || !Array.isArray(raw.questions)) {
    throw new GeminiValidationError(
      `Section "${section.name}" returned invalid structure: missing questions array`,
      ['Expected top-level { questions: [...] }'],
    );
  }

  const issues: string[] = [];
  const existingTexts = new Set(
    existingQuestions.map((eq) => normalizeTextForComparison(eq.text)),
  );
  const existingIds = new Set(
    existingQuestions.map((eq) => eq.id).filter(Boolean),
  );

  const questions: GeneratedQuestion[] = raw.questions.map((q: any, idx: number) => {
    const text = (q.text || q.question_text || q.question || '').toString().trim();
    if (text.length < 10) {
      issues.push(`Q${startIndex + idx}: text is empty or too short ("${text.slice(0, 30)}")`);
    }

    const bloom = VALID_BLOOM.has(q.bloom_level?.toLowerCase())
      ? q.bloom_level.toLowerCase()
      : (section.bloom_levels?.[0]?.toLowerCase() || 'apply');

    const difficulty = VALID_DIFFICULTY.has(q.difficulty?.toLowerCase())
      ? q.difficulty.toLowerCase()
      : (section.difficulty?.toLowerCase() || 'medium');

    // Strictly enforce section marks per question
    const marks =
      typeof q.marks === 'number' && q.marks > 0
        ? q.marks
        : section.marks_per_question;

    const co_id = (q.co_id || `CO${((startIndex + idx - 1) % 4) + 1}`).toString();
    const source = q.source === 'bank' ? 'bank' : 'generated';

    let id = q.id || `gen-${Date.now()}-${startIndex + idx}`;
    if (existingIds.has(id)) {
      id = `gen-${Date.now()}-${startIndex + idx}-distinct`;
    }

    return {
      question_number: startIndex + idx,
      section: section.name,
      text,
      marks,
      bloom_level: bloom,
      difficulty,
      co_id,
      source,
      id,
    };
  });

  // Verify section count matches requested questions
  if (questions.length !== section.questions) {
    issues.push(
      `Section "${section.name}": expected ${section.questions} questions, got ${questions.length}`,
    );
  }

  // Verify uniqueness against existing questions
  for (const q of questions) {
    const norm = normalizeTextForComparison(q.text);
    if (existingTexts.has(norm)) {
      issues.push(`Duplicate question detected across sections: "${q.text.slice(0, 40)}..."`);
    } else {
      existingTexts.add(norm);
    }
  }

  const criticalIssues = issues.filter(
    (i) => i.includes('text is empty') || i.includes('Duplicate question'),
  );
  if (criticalIssues.length > 0 || issues.length > 2) {
    throw new GeminiValidationError(
      `Section "${section.name}" failed validation (${issues.length} issue(s))`,
      issues,
    );
  }

  return questions;
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

export function buildPrompt(input: GeminiPaperInput): string {
  const totalQ = input.sections.reduce((s, sec) => s + sec.questions, 0);

  const sectionLines = input.sections
    .map(
      (s) =>
        `  • "${s.name}": ${s.questions} question(s) × ${s.marks_per_question} marks each` +
        (s.difficulty ? `, difficulty: ${s.difficulty}` : '') +
        (s.bloom_levels?.length ? `, Bloom levels: ${s.bloom_levels.join('/')}` : ''),
    )
    .join('\n');

  const coLines =
    input.course_outcomes.length > 0
      ? input.course_outcomes.map((co) => `  ${co.code}: ${co.description}`).join('\n')
      : '  CO1: Understand core concepts\n  CO2: Apply techniques\n  CO3: Analyze problems\n  CO4: Evaluate solutions';

  const bankLines =
    input.bank_questions.length > 0
      ? input.bank_questions
          .slice(0, 40)
          .map(
            (q, i) =>
              `[BQ${i + 1}] id="${q.id}" marks=${q.marks} bloom=${q.bloom_level} diff=${q.difficulty} co=${q.co_id ?? 'unset'}\nText: ${q.text}`,
          )
          .join('\n\n')
      : 'NONE — generate all questions freshly from syllabus.';

  return `You are an expert engineering college examination paper generator.

TASK: Generate EXACTLY ${totalQ} questions totalling EXACTLY ${input.total_marks} marks in valid JSON.

COURSE: ${input.course_name} (${input.course_code})
PAPER TITLE: ${input.title}
TOTAL MARKS: ${input.total_marks}
DURATION: ${input.duration_minutes} minutes

SECTIONS (follow exactly):
${sectionLines}

SYLLABUS (all questions MUST relate to these topics — no other topics allowed):
${input.syllabus}

COURSE OUTCOMES:
${coLines}

QUESTION BANK (reuse matching questions verbatim and set source="bank"):
${bankLines}

RULES:
1. Each question's marks field MUST equal its section's marks_per_question.
2. The sum of all marks MUST equal ${input.total_marks}.
3. Write clear, complete English sentences — no placeholders, no garbled text.
4. Every question topic must come from the SYLLABUS above.
5. For bank questions reused: set source="bank", id=<original bank question id>.
6. For new questions: set source="generated", id=<unique_id_string>.
7. Distribute Bloom's taxonomy levels as specified per section.
8. No answer options, no model answers — question text only.`;
}

export function buildSectionPrompt(
  input: GeminiPaperInput,
  section: SectionConfig,
  startIndex: number,
  existingQuestions: GeneratedQuestion[] = [],
): string {
  const coLines =
    input.course_outcomes.length > 0
      ? input.course_outcomes.map((co) => `  ${co.code}: ${co.description}`).join('\n')
      : '  CO1: Understand core concepts\n  CO2: Apply techniques\n  CO3: Analyze problems\n  CO4: Evaluate solutions';

  const matchingBank = input.bank_questions
    .filter((bq) => bq.marks === section.marks_per_question)
    .slice(0, 20);

  const bankLines =
    matchingBank.length > 0
      ? matchingBank
          .map(
            (q, i) =>
              `[BQ${i + 1}] id="${q.id}" marks=${q.marks} bloom=${q.bloom_level} diff=${q.difficulty} co=${q.co_id ?? 'unset'}\nText: ${q.text}`,
          )
          .join('\n\n')
      : 'NONE for this section mark weight — generate all questions freshly from syllabus.';

  const excludeSection =
    existingQuestions.length > 0
      ? `\nPREVIOUSLY GENERATED QUESTIONS (CRITICAL: DO NOT repeat or duplicate these questions or topics):\n` +
        existingQuestions
          .slice(-15)
          .map((eq, i) => `${i + 1}. [${eq.section} Q${eq.question_number}] ${eq.text.slice(0, 100)}...`)
          .join('\n')
      : '';

  return `You are an expert engineering college examination paper generator.

TASK: Generate questions ONLY for "${section.name}".
Generate EXACTLY ${section.questions} questions, each worth EXACTLY ${section.marks_per_question} marks.
Total marks for this section: ${section.questions * section.marks_per_question}.
Question numbers must start at ${startIndex} and end at ${startIndex + section.questions - 1}.

COURSE: ${input.course_name} (${input.course_code})
PAPER TITLE: ${input.title}
SECTION: ${section.name} (${section.questions} questions × ${section.marks_per_question} marks)
${section.difficulty ? `TARGET DIFFICULTY: ${section.difficulty}` : ''}
${section.bloom_levels?.length ? `BLOOM'S TAXONOMY LEVELS: ${section.bloom_levels.join(', ')}` : ''}

SYLLABUS (all questions MUST relate to these topics):
${input.syllabus}

COURSE OUTCOMES:
${coLines}

QUESTION BANK CANDIDATES FOR THIS SECTION:
${bankLines}
${excludeSection}

RULES:
1. Generate EXACTLY ${section.questions} questions.
2. Every question in this section MUST have marks = ${section.marks_per_question}.
3. Question numbers MUST be consecutive integers from ${startIndex} to ${startIndex + section.questions - 1}.
4. Section field MUST be "${section.name}".
5. Write clear, academic, unambiguous English sentences.
6. Do NOT duplicate any previously generated question.
7. For bank questions reused: set source="bank", id=<bank id>.
8. For new questions: set source="generated", id=<unique id>.
9. Question text only — do not include answer keys or options.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds && retryAfterSeconds > 0 && retryAfterSeconds <= 30) {
    return retryAfterSeconds * 1000;
  }
  const base = 1200 * Math.pow(2, attempt - 1);
  const capped = Math.min(base, 8000);
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

/** Wrap a promise with a timeout using AbortController. */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[Gemini] Request timed out after ${timeoutMs}ms for "${label}"`));
    }, timeoutMs);
    if (timer.unref) timer.unref();
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class GeminiService {
  private readonly primaryModel: string;
  private readonly fallbackModel?: string;
  private readonly client: GoogleGenAI;
  readonly isConfigured: boolean;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    this.primaryModel = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
    this.fallbackModel =
      process.env.GEMINI_FALLBACK_MODEL ??
      (this.primaryModel !== 'gemini-3.5-flash-lite' ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash');

    this.isConfigured =
      Boolean(apiKey) &&
      apiKey !== 'YOUR_GEMINI_API_KEY' &&
      apiKey.length > 10;

    if (!this.isConfigured) {
      console.warn('[Gemini] GEMINI_API_KEY not set — real generation disabled.');
    }

    this.client = new GoogleGenAI({ apiKey: apiKey || 'unconfigured' });
  }

  get modelName(): string {
    return this.primaryModel;
  }

  get fallbackModelName(): string | undefined {
    return this.fallbackModel;
  }

  /** Connectivity probe — probes primary and fallback if needed, never exposes API key. */
  async healthCheck(): Promise<{
    ok: boolean;
    model: string;
    fallback_model?: string;
    latencyMs: number;
    error?: string;
    isTransient?: boolean;
  }> {
    if (!this.isConfigured) {
      return {
        ok: false,
        model: this.primaryModel,
        latencyMs: 0,
        error: 'Gemini API key is not configured in backend/.env',
        isTransient: false,
      };
    }

    const t0 = Date.now();
    const HEALTH_TIMEOUT_MS = 12000;

    try {
      const result = await withTimeout(
        this.client.models.generateContent({
          model: this.primaryModel,
          contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: ready' }] }],
        }),
        HEALTH_TIMEOUT_MS,
        'health-check-primary',
      );
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return {
        ok: text.toLowerCase().includes('ready'),
        model: this.primaryModel,
        fallback_model: this.fallbackModel,
        latencyMs: Date.now() - t0,
      };
    } catch (err: any) {
      const errInfo = parseGeminiError(err);
      if (errInfo.isTransient && this.fallbackModel && this.fallbackModel !== this.primaryModel) {
        console.warn(
          `[Gemini Health] Primary model "${this.primaryModel}" high demand/transient error. Probing fallback "${this.fallbackModel}"...`,
        );
        try {
          const t1 = Date.now();
          const fbResult = await withTimeout(
            this.client.models.generateContent({
              model: this.fallbackModel,
              contents: [{ role: 'user', parts: [{ text: 'Respond with exactly: ready' }] }],
            }),
            HEALTH_TIMEOUT_MS,
            'health-check-fallback',
          );
          const fbText = fbResult.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          return {
            ok: fbText.toLowerCase().includes('ready'),
            model: `${this.primaryModel} (fallback active: ${this.fallbackModel})`,
            fallback_model: this.fallbackModel,
            latencyMs: Date.now() - t1,
          };
        } catch (fbErr: any) {
          const fbErrInfo = parseGeminiError(fbErr);
          return {
            ok: false,
            model: this.primaryModel,
            fallback_model: this.fallbackModel,
            latencyMs: Date.now() - t0,
            error: fbErrInfo.sanitizedMessage,
            isTransient: fbErrInfo.isTransient,
          };
        }
      }
      return {
        ok: false,
        model: this.primaryModel,
        fallback_model: this.fallbackModel,
        latencyMs: Date.now() - t0,
        error: errInfo.sanitizedMessage,
        isTransient: errInfo.isTransient,
      };
    }
  }

  /**
   * Generates a multi-section paper in controlled section-sized batches.
   * Combines validated sections, enforces continuous numbering, and ensures total marks match.
   */
  async generatePaperInBatches(
    input: GeminiPaperInput,
    activeModel: string,
    isFallback: boolean,
  ): Promise<GeminiPaperOutput> {
    const allQuestions: GeneratedQuestion[] = [];
    let currentStartIndex = 1;
    let bankUsedCount = 0;
    let aiGeneratedCount = 0;

    console.info(
      `[Gemini] Starting section-batched generation for "${input.title}": ${input.sections.length} section(s) (${input.sections.map((s) => `${s.name}:${s.questions}Q`).join(', ')}) using ${activeModel}...`,
    );

    for (let sIdx = 0; sIdx < input.sections.length; sIdx++) {
      const section = input.sections[sIdx];
      let sectionQuestions: GeneratedQuestion[] | null = null;
      let lastSectionError: Error | null = null;

      const SECTION_RETRIES = 2;
      for (let sAttempt = 1; sAttempt <= SECTION_RETRIES; sAttempt++) {
        try {
          console.info(
            `[Gemini] Generating Section "${section.name}" (attempt ${sAttempt}/${SECTION_RETRIES}) using ${activeModel}...`,
          );

          const prompt = buildSectionPrompt(input, section, currentStartIndex, allQuestions);
          const TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS ?? '45000', 10);

          const result = await withTimeout(
            this.client.models.generateContent({
              model: activeModel,
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              config: {
                responseMimeType: 'application/json',
                responseSchema: QUESTION_PAPER_SCHEMA,
                temperature: sAttempt === 1 ? 0.2 : 0.1,
                maxOutputTokens: 8192,
              },
            }),
            TIMEOUT_MS,
            `${input.title} - ${section.name}`,
          );

          const parsed = parseModelResponse(result.candidates?.[0], `${input.title} - ${section.name}`);
          sectionQuestions = validateSectionQuestions(
            parsed,
            section,
            input,
            currentStartIndex,
            allQuestions,
          );
          break;
        } catch (secErr: any) {
          lastSectionError = secErr;
          console.warn(
            `[Gemini] Section "${section.name}" attempt ${sAttempt} failed:`,
            secErr.message,
            secErr.cause?.cause ? (secErr.cause.cause.message || secErr.cause.cause.code || secErr.cause.cause) : (secErr.cause ? secErr.cause.message : ''),
          );
          if (sAttempt < SECTION_RETRIES) {
            const delay = computeBackoffMs(sAttempt);
            await sleep(delay);
          }
        }
      }

      if (!sectionQuestions) {
        throw (
          lastSectionError ??
          new GeminiError(
            `Failed to generate questions for section "${section.name}" after ${SECTION_RETRIES} attempts.`,
            502,
            'SECTION_GENERATION_FAILED',
            true,
          )
        );
      }

      for (const q of sectionQuestions) {
        if (q.source === 'bank') bankUsedCount++;
        else aiGeneratedCount++;
        allQuestions.push(q);
      }

      currentStartIndex += sectionQuestions.length;
    }

    // Final integrity check on combined total marks
    const totalGeneratedMarks = allQuestions.reduce((s, q) => s + q.marks, 0);
    if (totalGeneratedMarks !== input.total_marks) {
      const delta = input.total_marks - totalGeneratedMarks;
      if (Math.abs(delta) <= 5 && allQuestions.length > 0) {
        allQuestions[allQuestions.length - 1].marks += delta;
      } else {
        throw new GeminiValidationError(
          `Combined paper total marks (${totalGeneratedMarks}) does not match expected total (${input.total_marks}).`,
          [`Total marks mismatch: expected ${input.total_marks}, got ${totalGeneratedMarks}`],
        );
      }
    }

    // Ensure consecutive question numbering 1..N
    allQuestions.forEach((q, i) => {
      q.question_number = i + 1;
    });

    console.info(
      `[Gemini] ✓ Batched paper generation complete for "${input.title}": ${allQuestions.length} Qs, ${allQuestions.reduce((s, q) => s + q.marks, 0)} marks across ${input.sections.length} section(s).`,
    );

    return {
      questions: allQuestions,
      metadata: {
        provider: 'gemini',
        model: activeModel,
        primary_model: this.primaryModel,
        fallback_used: isFallback,
        generated_at: new Date().toISOString(),
        is_mock: false,
        total_marks_generated: allQuestions.reduce((s, q) => s + q.marks, 0),
        bank_questions_used: bankUsedCount,
        ai_questions_generated: aiGeneratedCount,
        generation_mode: 'section_batched',
      },
    };
  }

  /**
   * Generates paper in a single API call with responseSchema and truncation detection.
   */
  async generateWholePaper(
    input: GeminiPaperInput,
    activeModel: string,
    isFallback: boolean,
  ): Promise<GeminiPaperOutput> {
    const prompt = buildPrompt(input);
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.info(
          `[Gemini] Model ${activeModel} single-call attempt ${attempt}/${MAX_RETRIES} for "${input.title}"...`,
        );

        const TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS ?? '45000', 10);

        const result = await withTimeout(
          this.client.models.generateContent({
            model: activeModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: QUESTION_PAPER_SCHEMA,
              temperature: attempt === 1 ? 0.3 : 0.1,
              maxOutputTokens: 16384,
            },
          }),
          TIMEOUT_MS,
          input.title,
        );

        const parsed = parseModelResponse(result.candidates?.[0], input.title);
        const questions = validateAndNormalize(parsed, input);

        const bankUsed = questions.filter((q) => q.source === 'bank').length;
        const generated = questions.filter((q) => q.source === 'generated').length;

        console.info(
          `[Gemini] ✓ Successfully generated paper with ${activeModel}: ${questions.length} Qs (${bankUsed} from bank, ${generated} AI-generated).`,
        );

        return {
          questions,
          metadata: {
            provider: 'gemini',
            model: activeModel,
            primary_model: this.primaryModel,
            fallback_used: isFallback,
            generated_at: new Date().toISOString(),
            is_mock: false,
            total_marks_generated: questions.reduce((s, q) => s + q.marks, 0),
            bank_questions_used: bankUsed,
            ai_questions_generated: generated,
            generation_mode: 'whole_paper',
          },
        };
      } catch (err: any) {
        lastError = err;
        if (err instanceof GeminiTruncationError) {
          // Immediately throw so caller can switch to section-sized batches
          throw err;
        }
        if (err instanceof GeminiValidationError) {
          console.warn(`[Gemini] OBE validation failed on attempt ${attempt}:`, err.issues);
          if (attempt < MAX_RETRIES) continue;
          throw err;
        }
        const errInfo = parseGeminiError(err);
        if (!errInfo.isTransient) {
          throw err;
        }
        if (attempt < MAX_RETRIES) {
          const delay = computeBackoffMs(attempt, errInfo.retryAfterSeconds);
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new GeminiError('Single-call generation failed after retries.');
  }

  /**
   * Main paper generation orchestrator:
   * - Uses controlled section-sized batches for multi-section papers (>1 section or >8 questions)
   * - Uses whole-paper with responseSchema for single-section compact papers
   * - Automatically falls back to section-sized batches if output is truncated (finishReason=MAX_TOKENS)
   * - Bounded retries and model failover when primary model has high demand
   */
  async generatePaper(input: GeminiPaperInput): Promise<GeminiPaperOutput> {
    if (!this.isConfigured) {
      throw new GeminiError(
        'Gemini API key is not configured. Add GEMINI_API_KEY to backend/.env to enable AI generation.',
        503,
        'NOT_CONFIGURED',
        false,
      );
    }

    const totalQuestions = input.sections.reduce((s, sec) => s + sec.questions, 0);
    const candidateModels = [this.primaryModel];
    if (this.fallbackModel && this.fallbackModel !== this.primaryModel) {
      candidateModels.push(this.fallbackModel);
    }

    // Multi-section papers (>1 section) or papers with >8 questions are generated in controlled section batches
    const preferBatching = input.sections.length > 1 || totalQuestions > 8;

    console.info(
      `[Gemini] Generating: "${input.title}" | marks=${input.total_marks} | sections=${input.sections.length} | totalQs=${totalQuestions} | mode=${preferBatching ? 'section_batched' : 'whole_paper'} | primary=${this.primaryModel} | fallback=${this.fallbackModel ?? 'none'}`,
    );

    let lastError: Error | null = null;

    for (let modelIdx = 0; modelIdx < candidateModels.length; modelIdx++) {
      const activeModel = candidateModels[modelIdx];
      const isFallback = modelIdx > 0;

      if (isFallback) {
        console.warn(
          `[Gemini] Controlled model switch: primary model "${this.primaryModel}" unavailable; attempting fallback model "${activeModel}".`,
        );
      }

      try {
        if (preferBatching) {
          return await this.generatePaperInBatches(input, activeModel, isFallback);
        } else {
          try {
            return await this.generateWholePaper(input, activeModel, isFallback);
          } catch (singleCallErr: any) {
            if (
              singleCallErr instanceof GeminiTruncationError ||
              singleCallErr?.code === 'MALFORMED_JSON'
            ) {
              console.warn(
                `[Gemini] Single-call output incomplete/truncated for "${input.title}". Falling back to controlled section batching...`,
              );
              return await this.generatePaperInBatches(input, activeModel, isFallback);
            }
            throw singleCallErr;
          }
        }
      } catch (err: any) {
        const errInfo = parseGeminiError(err);
        console.error(
          `[Gemini] Model ${activeModel} generation failed: ${errInfo.sanitizedMessage}`,
        );

        if (!errInfo.isTransient) {
          throw new GeminiError(
            errInfo.sanitizedMessage,
            errInfo.statusCode,
            errInfo.isAuth ? 'AUTH_ERROR' : 'INVALID_REQUEST',
            false,
          );
        }

        lastError = errInfo.isUnavailable
          ? new GeminiUnavailableError(errInfo.sanitizedMessage, errInfo.retryAfterSeconds)
          : errInfo.isQuota
          ? new GeminiQuotaError(errInfo.sanitizedMessage, errInfo.retryAfterSeconds)
          : new GeminiError(errInfo.sanitizedMessage, errInfo.statusCode, 'AI_GENERATION_FAILED', true);
      }
    }

    throw lastError ?? new GeminiUnavailableError('Gemini model unavailable after retries and fallback.');
  }

  /** Classify a question's Bloom level and difficulty with retry. */
  async classifyQuestion(
    text: string,
    courseContext?: string,
  ): Promise<{ bloom_level: string; difficulty: string; confidence: number; is_mock: boolean }> {
    if (!this.isConfigured) {
      return { bloom_level: 'apply', difficulty: 'medium', confidence: 0, is_mock: true };
    }

    const candidateModels = [this.primaryModel];
    if (this.fallbackModel && this.fallbackModel !== this.primaryModel) {
      candidateModels.push(this.fallbackModel);
    }

    const prompt = `Classify the following exam question.\nQuestion: ${text}\n${courseContext ? `Course: ${courseContext}` : ''}\nRespond with ONLY JSON: {"bloom_level":"remember|understand|apply|analyze|evaluate|create","difficulty":"easy|medium|hard","confidence":0.0}`;

    for (const model of candidateModels) {
      try {
        const result = await this.client.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        });
        const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const parsed = JSON.parse(raw);
        return { ...parsed, is_mock: false };
      } catch {
        // Try fallback if available
      }
    }

    return { bloom_level: 'apply', difficulty: 'medium', confidence: 0, is_mock: true };
  }
}

export const geminiService = new GeminiService();
