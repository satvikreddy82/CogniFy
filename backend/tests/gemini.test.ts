import dotenv from 'dotenv';
dotenv.config();

import { getGlobalDispatcher, setGlobalDispatcher } from 'undici';
try {
  const d = getGlobalDispatcher();
  if (d) setGlobalDispatcher(d);
} catch {}

jest.setTimeout(60000);

import {
  geminiService,
  parseGeminiError,
  parseModelResponse,
  validateAndNormalize,
  validateSectionQuestions,
  normalizeTextForComparison,
  GeminiTruncationError,
  GeminiValidationError,
  GeminiError,
  GeminiPaperInput,
} from '../src/ai/gemini';
import { extractTextFromBuffer } from '../src/utils/extractText';

// ─── GeminiService configuration & probe tests ────────────────────────────────
describe('Gemini AI Service Configuration & Integration', () => {
  it('identifies whether GEMINI_API_KEY is configured from environment', () => {
    expect(typeof geminiService.isConfigured).toBe('boolean');
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
      expect(geminiService.isConfigured).toBe(true);
    }
  });

  it('exposes a configurable model name — defaults to gemini-3.8-flash when GEMINI_MODEL is unset', () => {
    expect(geminiService.modelName).toBeDefined();
    expect(typeof geminiService.modelName).toBe('string');
    expect(geminiService.modelName.length).toBeGreaterThan(0);
    if (!process.env.GEMINI_MODEL) {
      expect(geminiService.modelName).toBe('gemini-3.8-flash');
    } else {
      expect(geminiService.modelName).toBe(process.env.GEMINI_MODEL);
    }
  });

  it('performs health check probe without exposing the API key in the result', async () => {
    if (!geminiService.isConfigured) {
      const res = await geminiService.healthCheck();
      expect(res.ok).toBe(false);
      expect(res.error).toContain('not configured');
    } else {
      const res = await geminiService.healthCheck();
      expect(res).toHaveProperty('ok');
      expect(res).toHaveProperty('model');
      expect(res).toHaveProperty('latencyMs');
      expect(JSON.stringify(res)).not.toContain(process.env.GEMINI_API_KEY || '');
    }
  }, 50000);
});

// ─── parseGeminiError — error classification (no real API calls) ───────────────
describe('parseGeminiError — HTTP status classification', () => {
  it('classifies 404 as a non-transient model-not-found error', () => {
    const err = { status: 404, message: 'models/gemini-2.0-flash is no longer available. Update to models/gemini-3.8-flash.' };
    const result = parseGeminiError(err);
    expect(result.statusCode).toBe(404);
    expect(result.isTransient).toBe(false);
    expect(result.isAuth).toBe(false);
    expect(result.isUnavailable).toBe(false);
    expect(result.sanitizedMessage).not.toContain(process.env.GEMINI_API_KEY || 'REDACTED');
  });

  it('classifies 429 as a transient quota error with retryAfterSeconds', () => {
    const err = { status: 429, message: 'RESOURCE_EXHAUSTED: rate limit exceeded. retry-after: 30s' };
    const result = parseGeminiError(err);
    expect(result.isQuota).toBe(true);
    expect(result.isTransient).toBe(true);
    expect(result.statusCode).toBe(429);
    expect(result.retryAfterSeconds).toBe(30);
  });

  it('classifies 503 as a transient unavailability error', () => {
    const err = { status: 503, message: 'Service temporarily unavailable due to high demand.' };
    const result = parseGeminiError(err);
    expect(result.isUnavailable).toBe(true);
    expect(result.isTransient).toBe(true);
    expect(result.statusCode).toBe(503);
  });

  it('classifies 401 as a non-transient auth error', () => {
    const err = { status: 401, message: 'API_KEY_INVALID: invalid api key' };
    const result = parseGeminiError(err);
    expect(result.isAuth).toBe(true);
    expect(result.isTransient).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it('redacts the API key from error messages when present', () => {
    const fakeKey = 'FAKE_KEY_12345_FOR_TEST';
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = fakeKey;
    const err = { status: 403, message: `Request with key ${fakeKey} rejected` };
    const result = parseGeminiError(err);
    expect(result.sanitizedMessage).not.toContain(fakeKey);
    expect(result.sanitizedMessage).toContain('[REDACTED_API_KEY]');
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
    else delete process.env.GEMINI_API_KEY;
  });
});

// ─── Response Parsing & Truncation Safety Tests (CRITICAL FIX) ─────────────────
describe('Response Parsing & FinishReason Inspection', () => {
  it('parses valid structured JSON candidate with finishReason STOP', () => {
    const candidate = {
      finishReason: 'STOP',
      content: {
        parts: [
          {
            text: JSON.stringify({
              questions: [
                {
                  question_number: 1,
                  section: 'Section A',
                  text: 'Explain the difference between stack and queue data structures.',
                  marks: 5,
                  bloom_level: 'understand',
                  difficulty: 'easy',
                  co_id: 'CO1',
                  source: 'generated',
                },
              ],
            }),
          },
        ],
      },
    };

    const parsed = parseModelResponse(candidate, 'test-paper');
    expect(parsed).toHaveProperty('questions');
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].text).toContain('stack and queue');
  });

  it('strips markdown fences and parses valid JSON cleanly', () => {
    const candidate = {
      finishReason: 'STOP',
      content: {
        parts: [
          {
            text: '```json\n{"questions": [{"question_number": 1, "section": "A", "text": "What is asymptotic notation?", "marks": 5, "bloom_level": "remember", "difficulty": "easy", "co_id": "CO1", "source": "generated"}]}\n```',
          },
        ],
      },
    };

    const parsed = parseModelResponse(candidate, 'test-paper');
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].marks).toBe(5);
  });

  it('detects truncated output with finishReason MAX_TOKENS and throws GeminiTruncationError without JSON parsing', () => {
    // Simulates output that was abruptly cut off at token limit (e.g. line 89 col 29)
    const truncatedCandidate = {
      finishReason: 'MAX_TOKENS',
      content: {
        parts: [
          {
            text: '{"questions": [{"question_number": 1, "section": "A", "text": "Explain the working of quick sort and trace ',
          },
        ],
      },
    };

    expect(() => parseModelResponse(truncatedCandidate, 'truncated-test')).toThrow(
      GeminiTruncationError,
    );
    expect(() => parseModelResponse(truncatedCandidate, 'truncated-test')).toThrow(
      /truncated because maxOutputTokens was reached/i,
    );
  });

  it('handles malformed JSON by throwing GeminiError with MALFORMED_JSON instead of crashing', () => {
    const malformedCandidate = {
      finishReason: 'STOP',
      content: {
        parts: [
          {
            text: '{"questions": [{"question_number": 1, "text": "Incomplete string...',
          },
        ],
      },
    };

    try {
      parseModelResponse(malformedCandidate, 'malformed-test');
      fail('Expected GeminiError to be thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(GeminiError);
      expect(err.code).toBe('MALFORMED_JSON');
      expect(err.statusCode).toBe(422);
      expect(err.isTransient).toBe(true);
    }
  });

  it('handles safety-blocked candidates with actionable error', () => {
    const safetyCandidate = {
      finishReason: 'SAFETY',
      content: { parts: [] },
    };

    expect(() => parseModelResponse(safetyCandidate, 'safety-test')).toThrow(
      /blocked by safety filters/i,
    );
  });

  it('handles empty response gracefully', () => {
    expect(() => parseModelResponse(null, 'empty-test')).toThrow(/empty candidate list/i);
    expect(() => parseModelResponse({ finishReason: 'STOP', content: { parts: [{ text: '   ' }] } }, 'empty-text')).toThrow(/empty text/i);
  });
});

// ─── Validation, Normalization & Auto-Correction Tests ─────────────────────────
describe('Question Paper Validation & OBE Constraints', () => {
  const dummyInput: GeminiPaperInput = {
    course_name: 'Data Structures',
    course_code: 'CS201',
    title: 'Midterm Exam',
    total_marks: 30,
    duration_minutes: 60,
    syllabus: 'Arrays, Stacks, Queues, Trees',
    sections: [
      { name: 'Section A', questions: 2, marks_per_question: 5 },
      { name: 'Section B', questions: 2, marks_per_question: 10 },
    ],
    bank_questions: [],
    course_outcomes: [{ code: 'CO1', description: 'Core principles' }],
  };

  it('validates and normalizes valid questions structure', () => {
    const raw = {
      questions: [
        { question_number: 1, section: 'Section A', text: 'Define abstract data type with an example.', marks: 5, bloom_level: 'Remember', difficulty: 'Easy', co_id: 'CO1', source: 'generated' },
        { question_number: 2, section: 'Section A', text: 'Explain circular queue operations in detail.', marks: 5, bloom_level: 'Understand', difficulty: 'Medium', co_id: 'CO1', source: 'generated' },
        { question_number: 3, section: 'Section B', text: 'Construct an AVL tree for the keys [10, 20, 30, 40, 50].', marks: 10, bloom_level: 'Apply', difficulty: 'Hard', co_id: 'CO2', source: 'generated' },
        { question_number: 4, section: 'Section B', text: 'Compare DFS and BFS traversal with diagrams.', marks: 10, bloom_level: 'Analyze', difficulty: 'Medium', co_id: 'CO2', source: 'generated' },
      ],
    };

    const questions = validateAndNormalize(raw, dummyInput);
    expect(questions).toHaveLength(4);
    expect(questions[0].bloom_level).toBe('remember'); // Case-insensitive normalized
    expect(questions[0].difficulty).toBe('easy');
    expect(questions.reduce((s, q) => s + q.marks, 0)).toBe(30);
  });

  it('auto-balances minor marks discrepancy within threshold (<= 20%)', () => {
    // 29 marks generated instead of 30 (delta=1, threshold=6)
    const raw = {
      questions: [
        { question_number: 1, section: 'Section A', text: 'Explain array indexing and address calculation.', marks: 5, bloom_level: 'understand', difficulty: 'easy' },
        { question_number: 2, section: 'Section A', text: 'Implement postfix evaluation using a stack.', marks: 5, bloom_level: 'apply', difficulty: 'medium' },
        { question_number: 3, section: 'Section B', text: 'Describe binary search tree insertion and deletion.', marks: 10, bloom_level: 'analyze', difficulty: 'hard' },
        { question_number: 4, section: 'Section B', text: 'Analyze time complexity of heapsort algorithm.', marks: 9, bloom_level: 'analyze', difficulty: 'hard' },
      ],
    };

    const questions = validateAndNormalize(raw, dummyInput);
    const total = questions.reduce((s, q) => s + q.marks, 0);
    expect(total).toBe(30);
    // Last question adjusted from 9 to 10
    expect(questions[3].marks).toBe(10);
  });

  it('rejects severe marks discrepancy exceeding threshold with GeminiValidationError', () => {
    // Only 15 marks generated for a 30 marks paper (delta=15, 50% discrepancy)
    const raw = {
      questions: [
        { question_number: 1, section: 'Section A', text: 'Explain singly linked list operations.', marks: 5, bloom_level: 'understand', difficulty: 'easy' },
        { question_number: 2, section: 'Section B', text: 'Analyze AVL rotation cases in detail.', marks: 10, bloom_level: 'analyze', difficulty: 'hard' },
      ],
    };

    expect(() => validateAndNormalize(raw, dummyInput)).toThrow(GeminiValidationError);
    expect(() => validateAndNormalize(raw, dummyInput)).toThrow(/Total marks/i);
  });

  it('rejects questions with empty or placeholder text', () => {
    const raw = {
      questions: [
        { question_number: 1, section: 'Section A', text: 'Too short', marks: 5, bloom_level: 'understand', difficulty: 'easy' },
        { question_number: 2, section: 'Section A', text: 'Also short', marks: 5, bloom_level: 'understand', difficulty: 'easy' },
        { question_number: 3, section: 'Section B', text: 'Short', marks: 10, bloom_level: 'analyze', difficulty: 'hard' },
      ],
    };

    expect(() => validateAndNormalize(raw, dummyInput)).toThrow(GeminiValidationError);
  });
});

// ─── Multi-Section Batched Generation & Deduplication Tests ───────────────────
describe('Multi-Section Batched Generation & Deduplication', () => {
  const input: GeminiPaperInput = {
    course_name: 'Operating Systems',
    course_code: 'CS301',
    title: 'Final Examination',
    total_marks: 40,
    duration_minutes: 90,
    syllabus: 'Processes, Threads, CPU Scheduling, Synchronization, Deadlocks, Memory Management',
    sections: [
      { name: 'Section A', questions: 2, marks_per_question: 5, difficulty: 'easy' },
      { name: 'Section B', questions: 3, marks_per_question: 10, difficulty: 'medium' },
    ],
    bank_questions: [],
    course_outcomes: [{ code: 'CO1', description: 'OS Architecture' }],
  };

  it('validates section questions with correct section marks and continuous numbering', () => {
    const secARaw = {
      questions: [
        { text: 'Define process control block and its key attributes in memory.', marks: 5, bloom_level: 'remember', difficulty: 'easy', co_id: 'CO1', source: 'generated' },
        { text: 'Differentiate between preemptive and non-preemptive CPU scheduling.', marks: 5, bloom_level: 'understand', difficulty: 'easy', co_id: 'CO1', source: 'generated' },
      ],
    };

    const secAQuestions = validateSectionQuestions(secARaw, input.sections[0], input, 1, []);
    expect(secAQuestions).toHaveLength(2);
    expect(secAQuestions[0].question_number).toBe(1);
    expect(secAQuestions[1].question_number).toBe(2);
    expect(secAQuestions[0].section).toBe('Section A');
    expect(secAQuestions[0].marks).toBe(5);

    // Section B starts at question index 3
    const secBRaw = {
      questions: [
        { text: 'Explain the Producer-Consumer problem using counting semaphores.', marks: 10, bloom_level: 'apply', difficulty: 'medium', co_id: 'CO2', source: 'generated' },
        { text: 'Apply Bankers algorithm to determine if the given system state is safe.', marks: 10, bloom_level: 'apply', difficulty: 'hard', co_id: 'CO2', source: 'generated' },
        { text: 'Compare paging and segmentation memory allocation schemes with diagrams.', marks: 10, bloom_level: 'analyze', difficulty: 'medium', co_id: 'CO3', source: 'generated' },
      ],
    };

    const secBQuestions = validateSectionQuestions(secBRaw, input.sections[1], input, 3, secAQuestions);
    expect(secBQuestions).toHaveLength(3);
    expect(secBQuestions[0].question_number).toBe(3);
    expect(secBQuestions[1].question_number).toBe(4);
    expect(secBQuestions[2].question_number).toBe(5);
    expect(secBQuestions[0].section).toBe('Section B');
    expect(secBQuestions[0].marks).toBe(10);

    // Combine sections
    const combined = [...secAQuestions, ...secBQuestions];
    expect(combined).toHaveLength(5);
    expect(combined.reduce((s, q) => s + q.marks, 0)).toBe(40);
  });

  it('normalizes text and detects duplicate questions across sections', () => {
    const textA = 'Explain the Producer-Consumer problem using semaphores in OS.';
    const textADup = '  explain the   producer-consumer problem USING semaphores in os! ';

    expect(normalizeTextForComparison(textA)).toBe(normalizeTextForComparison(textADup));

    const existingQuestions = [
      {
        question_number: 1,
        section: 'Section A',
        text: textA,
        marks: 5,
        bloom_level: 'understand',
        difficulty: 'easy',
        co_id: 'CO1',
        source: 'generated' as const,
      },
    ];

    const duplicateRaw = {
      questions: [
        { text: textADup, marks: 10, bloom_level: 'apply', difficulty: 'medium' },
      ],
    };

    expect(() =>
      validateSectionQuestions(duplicateRaw, input.sections[1], input, 2, existingQuestions),
    ).toThrow(GeminiValidationError);
    expect(() =>
      validateSectionQuestions(duplicateRaw, input.sections[1], input, 2, existingQuestions),
    ).toThrow(/Duplicate question detected/i);
  });
});

// ─── Real End-to-End Generation Test (Live API) ───────────────────────────────
describe('Live Gemini Generation Integration Test', () => {
  it('generates a real 2-section paper via live Gemini API with zero JSON parsing errors', async () => {
    if (!geminiService.isConfigured) {
      console.warn('Skipping live test: GEMINI_API_KEY is not configured in environment.');
      return;
    }

    const testInput: GeminiPaperInput = {
      course_name: 'Computer Networks',
      course_code: 'CS401',
      title: 'Unit Assessment Test',
      total_marks: 20,
      duration_minutes: 45,
      syllabus: 'OSI Reference Model, TCP/IP, Flow Control, Error Detection, Framing',
      sections: [
        { name: 'Part A', questions: 2, marks_per_question: 4, difficulty: 'easy' },
        { name: 'Part B', questions: 2, marks_per_question: 6, difficulty: 'medium' },
      ],
      bank_questions: [],
      course_outcomes: [
        { code: 'CO1', description: 'Network Layering' },
        { code: 'CO2', description: 'Data Link Protocols' },
      ],
    };

    const output = await geminiService.generatePaper(testInput);

    expect(output).toBeDefined();
    expect(output.questions).toHaveLength(4);
    expect(output.metadata.is_mock).toBe(false);

    // Assert marks match requested total exactly
    const totalMarks = output.questions.reduce((sum, q) => sum + q.marks, 0);
    expect(totalMarks).toBe(20);

    // Assert consecutive question numbers
    expect(output.questions[0].question_number).toBe(1);
    expect(output.questions[1].question_number).toBe(2);
    expect(output.questions[2].question_number).toBe(3);
    expect(output.questions[3].question_number).toBe(4);

    // Assert every question has valid academic content
    for (const q of output.questions) {
      expect(q.text.length).toBeGreaterThan(15);
      expect(typeof q.marks).toBe('number');
      expect(q.marks).toBeGreaterThan(0);
      expect(['Part A', 'Part B']).toContain(q.section);
      expect(q.bloom_level).toBeDefined();
    }
  }, 180000);
});

// ─── Text Extraction Utility (extractTextFromBuffer) ──────────────────────────
describe('Text Extraction Utility (extractTextFromBuffer)', () => {
  it('extracts plain text from text buffers', async () => {
    const sample = 'Unit 1: Dynamic Programming\nQ1. Explain the 0/1 Knapsack problem [10 Marks]\nQ2. Solve Matrix Chain Multiplication [15 Marks]';
    const buf = Buffer.from(sample, 'utf-8');
    const result = await extractTextFromBuffer(buf, 'text/plain', 'syllabus.txt');
    expect(result.extractionMethod).toBe('plain-text');
    expect(result.text).toContain('0/1 Knapsack');
  });

  it('warns gracefully for image files without failing', async () => {
    const dummyImageBuffer = Buffer.from('fake-image-bytes');
    const result = await extractTextFromBuffer(dummyImageBuffer, 'image/jpeg', 'questions.jpg');
    expect(result.extractionMethod).toBe('raw-body');
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain('Image file');
  });
});
