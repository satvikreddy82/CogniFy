/**
 * AI Provider Adapter
 * -------------------
 * All AI calls go through this abstraction so the provider can be swapped
 * without touching the business logic. Currently implements a Google Gemini
 * stub that returns schema-validated mock data. Wire up the real Gemini SDK
 * by setting GEMINI_API_KEY in the environment.
 */

export interface PaperGenerationInput {
  config: {
    course_id: string;
    title: string;
    total_marks: number;
    duration_minutes: number;
    sections: Array<{
      name: string;
      questions: number;
      marks_per_question: number;
      bloom_levels?: string[];
      difficulty?: string;
    }>;
    co_distribution?: Record<string, number>;
  };
  questions: Array<{
    id: string;
    text: string;
    bloom_level: string;
    difficulty: string;
    marks: number;
    co_id?: string;
  }>;
  outcomes: Array<{ id: string; code: string; description: string }>;
}

export interface PaperGenerationOutput {
  questions: Array<{
    id: string;
    marks: number;
    section: string;
    source: 'bank' | 'generated';
  }>;
  metadata: {
    provider: string;
    model: string;
    generated_at: string;
    is_mock: boolean;
  };
}

export interface ClassificationInput {
  text: string;
  course_context?: string;
}

export interface ClassificationOutput {
  bloom_level: string;
  difficulty: string;
  suggested_co?: string;
  confidence: number;
  is_mock: boolean;
}

export interface AIProvider {
  generatePaper(input: PaperGenerationInput): Promise<PaperGenerationOutput>;
  classifyQuestion(input: ClassificationInput): Promise<ClassificationOutput>;
}

// ─── Google Gemini Provider ────────────────────────────────────────────────────
class GeminiProvider implements AIProvider {
  private apiKey = process.env.GEMINI_API_KEY ?? '';
  private model = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey !== 'YOUR_GEMINI_API_KEY');
  }

  async generatePaper(input: PaperGenerationInput): Promise<PaperGenerationOutput> {
    if (!this.isConfigured) {
      console.warn('[AI] GEMINI_API_KEY not configured — returning mock paper generation');
      return this.mockGeneratePaper(input);
    }

    try {
      // Build structured prompt
      const prompt = this.buildPaperPrompt(input);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        // Classify common HTTP errors with actionable messages
        if (response.status === 404) {
          throw new Error(
            `Gemini model "${this.model}" not found (404). Update GEMINI_MODEL in backend/.env. ` +
            `API response: ${errBody.slice(0, 200)}`,
          );
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `Gemini API key rejected (${response.status}). Verify GEMINI_API_KEY in backend/.env.`,
          );
        }
        if (response.status === 429) {
          throw new Error(
            `Gemini quota/rate-limit exceeded (429). Wait and retry or upgrade your API plan.`,
          );
        }
        if (response.status === 503) {
          throw new Error(
            `Gemini model temporarily unavailable (503). Retry in a few seconds.`,
          );
        }
        throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 300)}`);
      }

      const raw = await response.json();
      const content = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Empty response from Gemini');

      const parsed = JSON.parse(content);
      return this.validatePaperOutput(parsed);
    } catch (err) {
      // Re-throw — do NOT silently fall back to mock when the API key is configured.
      // The caller (papers.ts route) handles error classification and user-facing messages.
      console.error('[AI/provider] generatePaper failed:', (err as Error).message);
      throw err;
    }
  }


  async classifyQuestion(input: ClassificationInput): Promise<ClassificationOutput> {
    if (!this.isConfigured) {
      return {
        bloom_level: 'understand',
        difficulty: 'medium',
        confidence: 0,
        is_mock: true,
      };
    }

    try {
      const prompt = `Classify the following exam question into Bloom's Revised Taxonomy level and difficulty.
Question: ${input.text}
${input.course_context ? `Course context: ${input.course_context}` : ''}

Respond with JSON: { "bloom_level": "remember|understand|apply|analyze|evaluate|create", "difficulty": "easy|medium|hard", "confidence": 0.0-1.0 }`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        }
      );

      const raw = await response.json();
      const content = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(content);

      return { ...parsed, is_mock: false };
    } catch (err) {
      return {
        bloom_level: 'understand',
        difficulty: 'medium',
        confidence: 0,
        is_mock: true,
      };
    }
  }

  private buildPaperPrompt(input: PaperGenerationInput): string {
    return `You are an academic exam paper generator. Create a question paper configuration based on the following:

Course: ${input.config.title}
Total Marks: ${input.config.total_marks}
Duration: ${input.config.duration_minutes} minutes

Sections: ${JSON.stringify(input.config.sections, null, 2)}

Available questions in the bank (select from these):
${JSON.stringify(input.questions.slice(0, 50), null, 2)}

Course Outcomes: ${JSON.stringify(input.outcomes, null, 2)}

Instructions:
1. Prefer selecting existing questions from the bank when they match the requirements
2. Mark source as "bank" for existing questions, "generated" for new ones
3. Ensure marks sum exactly to ${input.config.total_marks}
4. Cover multiple Bloom's taxonomy levels
5. Map questions to Course Outcomes where possible

Respond with JSON matching this schema:
{
  "questions": [
    { "id": "<existing_id_or_new_uuid>", "marks": <number>, "section": "<section_name>", "source": "bank" | "generated" }
  ],
  "metadata": { "provider": "gemini", "model": "${this.model}", "generated_at": "<iso_date>", "is_mock": false }
}`;
  }

  private validatePaperOutput(raw: any): PaperGenerationOutput {
    if (!Array.isArray(raw?.questions)) {
      throw new Error('Invalid AI output: missing questions array');
    }
    return {
      questions: raw.questions,
      metadata: {
        provider: raw.metadata?.provider ?? 'gemini',
        model: raw.metadata?.model ?? this.model,
        generated_at: raw.metadata?.generated_at ?? new Date().toISOString(),
        is_mock: false,
      },
    };
  }

  private mockGeneratePaper(input: PaperGenerationInput): PaperGenerationOutput {
    // Select existing questions from the bank in order
    const selected = input.questions.slice(0, 10).map((q, i) => ({
      id: q.id,
      marks: q.marks || Math.floor(input.config.total_marks / Math.max(input.questions.length, 1)),
      section: input.config.sections[0]?.name || 'Section A',
      source: 'bank' as const,
    }));

    return {
      questions: selected,
      metadata: {
        provider: 'mock',
        model: 'mock-stub',
        generated_at: new Date().toISOString(),
        is_mock: true,
      },
    };
  }
}

export const aiProvider: AIProvider = new GeminiProvider();
