import { loginSchema, registerFacultySchema, registerDeanSchema } from '../src/validators/auth';

describe('Auth Validation Schemas', () => {
  it('validates a correct faculty registration payload', () => {
    const validFaculty = {
      full_name: 'Dr. Alan Turing',
      employee_id: 'FAC-1001',
      email: 'alan.turing@cambridge.edu',
      department_id: '11111111-1111-1111-1111-111111111111',
      designation: 'Associate Professor',
      password: 'StrongPassword123!',
      confirm_password: 'StrongPassword123!',
    };
    const parsed = registerFacultySchema.safeParse(validFaculty);
    expect(parsed.success).toBe(true);
  });

  it('rejects mismatched passwords during faculty registration', () => {
    const mismatch = {
      full_name: 'Dr. Alan Turing',
      employee_id: 'FAC-1001',
      email: 'alan.turing@cambridge.edu',
      department_id: '11111111-1111-1111-1111-111111111111',
      designation: 'Associate Professor',
      password: 'StrongPassword123!',
      confirm_password: 'DifferentPassword456!',
    };
    const parsed = registerFacultySchema.safeParse(mismatch);
    expect(parsed.success).toBe(false);
  });

  it('validates a correct dean registration payload', () => {
    const validDean = {
      full_name: 'Prof. Ada Lovelace',
      employee_id: 'DEAN-2001',
      email: 'ada.lovelace@oxford.edu',
      department_id: '22222222-2222-2222-2222-222222222222',
      password: 'SecureDeanPass123!',
      confirm_password: 'SecureDeanPass123!',
    };
    const parsed = registerDeanSchema.safeParse(validDean);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid email formats in login schema', () => {
    const invalidLogin = {
      email: 'not-an-email',
      password: 'password123',
    };
    const parsed = loginSchema.safeParse(invalidLogin);
    expect(parsed.success).toBe(false);
  });
});

describe('Deterministic OBE Validation Logic', () => {
  function validatePaperQuestions(totalExpectedMarks: number, questions: any[]) {
    const issues: { type: string; severity: 'error' | 'warning'; message: string }[] = [];

    const totalMarks = questions.reduce((s: number, pq: any) => s + (pq.marks || 0), 0);
    if (totalMarks !== totalExpectedMarks) {
      issues.push({
        type: 'marks_mismatch',
        severity: 'error',
        message: `Total marks mismatch: expected ${totalExpectedMarks}, got ${totalMarks}`,
      });
    }

    const bloomLevels = questions.map((pq: any) => pq.bloom_level).filter(Boolean);
    const uniqueBloom = new Set(bloomLevels);
    if (uniqueBloom.size < 3) {
      issues.push({
        type: 'bloom_coverage',
        severity: 'warning',
        message: `Low Bloom's taxonomy diversity: only ${uniqueBloom.size} level(s) covered`,
      });
    }

    const coIds = questions.map((pq: any) => pq.co_id).filter(Boolean);
    if (coIds.length === 0) {
      issues.push({
        type: 'co_mapping',
        severity: 'error',
        message: 'No questions are mapped to Course Outcomes',
      });
    }

    const hasDuplicates = questions.length !== new Set(questions.map((pq: any) => pq.question_id)).size;
    if (hasDuplicates) {
      issues.push({
        type: 'duplicate_questions',
        severity: 'error',
        message: 'Duplicate questions detected in the paper',
      });
    }

    const status = issues.some((i) => i.severity === 'error') ? 'failed' : issues.length > 0 ? 'warning' : 'passed';
    return { status, issues, totalMarks };
  }

  it('passes a compliant OBE question paper specification', () => {
    const questions = [
      { question_id: 'q1', marks: 25, bloom_level: 'L1', co_id: 'co1' },
      { question_id: 'q2', marks: 25, bloom_level: 'L2', co_id: 'co2' },
      { question_id: 'q3', marks: 25, bloom_level: 'L3', co_id: 'co3' },
      { question_id: 'q4', marks: 25, bloom_level: 'L4', co_id: 'co4' },
    ];
    const result = validatePaperQuestions(100, questions);
    expect(result.status).toBe('passed');
    expect(result.issues).toHaveLength(0);
    expect(result.totalMarks).toBe(100);
  });

  it('fails with marks_mismatch when question scores do not equal target total', () => {
    const questions = [
      { question_id: 'q1', marks: 20, bloom_level: 'L1', co_id: 'co1' },
      { question_id: 'q2', marks: 20, bloom_level: 'L2', co_id: 'co2' },
      { question_id: 'q3', marks: 20, bloom_level: 'L3', co_id: 'co3' },
    ];
    const result = validatePaperQuestions(100, questions);
    expect(result.status).toBe('failed');
    expect(result.issues.some((i) => i.type === 'marks_mismatch')).toBe(true);
  });

  it('detects duplicate questions in the paper assembly', () => {
    const questions = [
      { question_id: 'q1', marks: 50, bloom_level: 'L1', co_id: 'co1' },
      { question_id: 'q1', marks: 50, bloom_level: 'L2', co_id: 'co2' },
    ];
    const result = validatePaperQuestions(100, questions);
    expect(result.status).toBe('failed');
    expect(result.issues.some((i) => i.type === 'duplicate_questions')).toBe(true);
  });
});
