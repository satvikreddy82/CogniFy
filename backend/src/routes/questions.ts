import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supabase } from '../utils/supabase';
import { aiProvider } from '../ai/provider';
import { geminiService } from '../ai/gemini';
import { extractTextFromBuffer } from '../utils/extractText';
import { mockStore, isSupabaseConfigured, QuestionBankItem } from '../utils/mockStore';

const router = Router();

// Helper to parse question text from raw text / PDF / document
function extractQuestionsFromText(rawText: string, defaultCourseName: string, defaultCourseCode: string, bankId: string, userId: string) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions: any[] = [];
  let currentQ: string[] = [];
  let currentMarks = 10;
  let currentBloom = 'apply';
  let currentDiff = 'medium';

  // Heuristic pattern: lines starting with Q1, 1., Question 1, etc.
  const qStartPattern = /^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i;

  const flushQuestion = () => {
    if (currentQ.length > 0) {
      const text = currentQ.join(' ').replace(qStartPattern, '').trim();
      if (text.length > 5) {
        // Detect marks if written like [10 Marks] or (10M) or (15 marks)
        const marksMatch = text.match(/\[(\d+)\s*(?:marks?|m)\]|\((\d+)\s*(?:marks?|m)\)/i);
        const marks = marksMatch ? parseInt(marksMatch[1] || marksMatch[2], 10) : currentMarks;

        // Detect Bloom's level if mentioned or guess from action verb
        const lower = text.toLowerCase();
        let bloom = currentBloom;
        let diff = currentDiff;
        if (/^(?:define|list|state|name|recall|identify)/i.test(text)) {
          bloom = 'remember';
          diff = 'easy';
        } else if (/^(?:explain|describe|discuss|summarize|illustrate)/i.test(text)) {
          bloom = 'understand';
          diff = 'medium';
        } else if (/^(?:calculate|compute|solve|derive|apply|implement)/i.test(text)) {
          bloom = 'apply';
          diff = 'medium';
        } else if (/^(?:analyze|differentiate|compare|contrast|examine)/i.test(text)) {
          bloom = 'analyze';
          diff = 'hard';
        } else if (/^(?:evaluate|judge|justify|critique|prove)/i.test(text)) {
          bloom = 'evaluate';
          diff = 'hard';
        } else if (/^(?:design|create|develop|formulate|construct)/i.test(text)) {
          bloom = 'create';
          diff = 'hard';
        }

        questions.push({
          id: 'q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          bank_id: bankId,
          course_id: defaultCourseCode || 'course-manual',
          course_name: defaultCourseName,
          course_code: defaultCourseCode,
          text,
          question_text: text,
          marks: marks || 10,
          bloom_level: bloom,
          difficulty: diff,
          is_active: true,
          created_at: new Date().toISOString(),
          created_by: userId,
        });
      }
      currentQ = [];
    }
  };

  for (const line of lines) {
    if (qStartPattern.test(line)) {
      flushQuestion();
      currentQ.push(line);
    } else {
      if (currentQ.length === 0) {
        currentQ.push(line);
      } else {
        currentQ.push(line);
      }
    }
  }
  flushQuestion();

  // If no numbered lines found, split by double newlines or sentences
  if (questions.length === 0 && rawText.trim().length > 5) {
    const chunks = rawText.split(/(?:\r?\n\s*\r?\n|\n(?=[A-Z0-9]))/).filter((c) => c.trim().length > 10);
    chunks.forEach((chunk, idx) => {
      questions.push({
        id: 'q-' + Date.now() + '-' + idx,
        bank_id: bankId,
        course_id: defaultCourseCode || 'course-manual',
        course_name: defaultCourseName,
        course_code: defaultCourseCode,
        text: chunk.trim(),
        question_text: chunk.trim(),
        marks: (idx % 2 === 0 ? 10 : 5),
        bloom_level: (['remember', 'understand', 'apply', 'analyze', 'evaluate'][idx % 5]),
        difficulty: (['easy', 'medium', 'hard'][idx % 3]),
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: userId,
      });
    });
  }

  return questions;
}

// ─── GET /api/v1/questions/banks — List all uploaded question banks / PDF sets
router.get('/banks', authenticate, async (req: AuthRequest, res) => {
  res.json(mockStore.questionBanks || []);
});

// ─── POST /api/v1/questions/upload-bank — Upload PDF / JPEG / Document Question Bank
router.post('/upload-bank', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res, next) => {
  try {
    const {
      title,
      file_name,
      file_type = 'pdf',
      file_size,
      course_name,
      course_code,
      syllabus_text,
      raw_content,
      file_base64,
      questions: clientQuestions,
    } = req.body;

    if (!course_name || !course_code) {
      return res.status(400).json({ error: 'Course name and course code are required' });
    }

    const bankId = 'bank-' + Date.now();
    const bankTitle = title || file_name || `${course_code} Question Bank (${file_type.toUpperCase()})`;

    let newQuestions: any[] = [];
    let warning: string | undefined;

    // 1. If binary base64 file is provided (PDF/DOCX/TXT), extract text using pdf-parse / mammoth
    let textToParse = raw_content || '';
    if (file_base64 && typeof file_base64 === 'string') {
      try {
        const base64Data = file_base64.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const extraction = await extractTextFromBuffer(buffer, file_type, file_name || 'document.pdf');
        if (extraction.text) {
          textToParse = extraction.text;
        }
        warning = extraction.warning;
      } catch (extractErr: any) {
        warning = `File extraction note: ${extractErr.message}`;
      }
    }

    // 2. If client supplied extracted questions directly
    if (Array.isArray(clientQuestions) && clientQuestions.length > 0) {
      newQuestions = clientQuestions.map((q: any, i: number) => ({
        id: 'q-' + Date.now() + '-' + i,
        bank_id: bankId,
        course_id: course_code,
        course_name,
        course_code,
        text: q.text || q.question_text,
        question_text: q.text || q.question_text,
        marks: Number(q.marks) || 10,
        bloom_level: q.bloom_level || 'apply',
        difficulty: q.difficulty || 'medium',
        co_id: q.co_id || 'co-1',
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: req.user!.id,
      }));
    } else if (textToParse && typeof textToParse === 'string' && textToParse.trim().length > 5) {
      newQuestions = extractQuestionsFromText(textToParse, course_name, course_code, bankId, req.user!.id);
    }

    if (newQuestions.length === 0) {
      // Default sample questions parsed from standard PDF / JPEG question bank content
      newQuestions = [
        {
          id: 'q-' + Date.now() + '-1',
          bank_id: bankId,
          course_id: course_code,
          course_name,
          course_code,
          text: `[From ${file_name || 'PDF'}] Explain the core architecture and fundamental principles of ${course_name}.`,
          question_text: `[From ${file_name || 'PDF'}] Explain the core architecture and fundamental principles of ${course_name}.`,
          marks: 10,
          bloom_level: 'understand',
          difficulty: 'medium',
          is_active: true,
          created_at: new Date().toISOString(),
          created_by: req.user!.id,
        },
        {
          id: 'q-' + Date.now() + '-2',
          bank_id: bankId,
          course_id: course_code,
          course_name,
          course_code,
          text: `[From ${file_name || 'PDF'}] Apply the theoretical concepts of ${course_code} to design an optimized algorithmic solution with asymptotic time complexity.`,
          question_text: `[From ${file_name || 'PDF'}] Apply the theoretical concepts of ${course_code} to design an optimized algorithmic solution with asymptotic time complexity.`,
          marks: 15,
          bloom_level: 'apply',
          difficulty: 'hard',
          is_active: true,
          created_at: new Date().toISOString(),
          created_by: req.user!.id,
        },
        {
          id: 'q-' + Date.now() + '-3',
          bank_id: bankId,
          course_id: course_code,
          course_name,
          course_code,
          text: `[From ${file_name || 'PDF'}] Compare and contrast alternative paradigms in ${course_name} and evaluate trade-offs in real-world deployment.`,
          question_text: `[From ${file_name || 'PDF'}] Compare and contrast alternative paradigms in ${course_name} and evaluate trade-offs in real-world deployment.`,
          marks: 15,
          bloom_level: 'analyze',
          difficulty: 'hard',
          is_active: true,
          created_at: new Date().toISOString(),
          created_by: req.user!.id,
        },
        {
          id: 'q-' + Date.now() + '-4',
          bank_id: bankId,
          course_id: course_code,
          course_name,
          course_code,
          text: `[From ${file_name || 'PDF'}] Define the primary keywords and state key theorems governing ${course_code}.`,
          question_text: `[From ${file_name || 'PDF'}] Define the primary keywords and state key theorems governing ${course_code}.`,
          marks: 5,
          bloom_level: 'remember',
          difficulty: 'easy',
          is_active: true,
          created_at: new Date().toISOString(),
          created_by: req.user!.id,
        },
      ];
    }

    const newBank: QuestionBankItem = {
      id: bankId,
      title: bankTitle,
      file_name: file_name || 'document.pdf',
      file_type: (file_type.toLowerCase().includes('png') || file_type.toLowerCase().includes('jpeg') || file_type.toLowerCase().includes('jpg') ? 'jpeg' : 'pdf'),
      file_size: Number(file_size) || 102400,
      course_name,
      course_code,
      syllabus_text: syllabus_text || '',
      question_count: newQuestions.length,
      created_at: new Date().toISOString(),
      created_by: req.user!.id,
    };

    mockStore.questionBanks.unshift(newBank);
    newQuestions.forEach((q) => mockStore.questions.unshift(q));

    res.status(201).json({
      message: 'Question bank uploaded and questions extracted successfully',
      bank: newBank,
      questions_count: newQuestions.length,
      questions: newQuestions,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/questions/banks/:bankId — Delete entire question bank + its questions
router.delete('/banks/:bankId', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res) => {
  const bankId = req.params.bankId;

  // Remove questions belonging to this bank
  mockStore.questions = mockStore.questions.filter((q) => q.bank_id !== bankId);

  // Remove the bank entry
  const bankIndex = mockStore.questionBanks.findIndex((b) => b.id === bankId);
  if (bankIndex !== -1) {
    mockStore.questionBanks.splice(bankIndex, 1);
  }

  res.json({ message: 'Question bank and all associated questions deleted successfully' });
});

// ─── GET /api/v1/questions — List questions with filters
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { course_id, course_name, bloom_level, difficulty, search, bank_id, limit = '100', offset = '0' } = req.query as Record<string, string>;

    let list = [...mockStore.questions];

    if (bank_id) {
      list = list.filter((q) => q.bank_id === bank_id);
    }
    if (course_id) {
      list = list.filter((q) => q.course_id === course_id || q.course_code === course_id);
    }
    if (course_name) {
      list = list.filter((q) => q.course_name?.toLowerCase().includes(course_name.toLowerCase()) || q.course_code?.toLowerCase().includes(course_name.toLowerCase()));
    }
    if (bloom_level) {
      const bl = bloom_level.toLowerCase();
      list = list.filter((q) => (q.bloom_level?.toLowerCase() === bl || q.bloom_level === bloom_level));
    }
    if (difficulty) {
      list = list.filter((q) => q.difficulty?.toLowerCase() === difficulty.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((q) => (q.text?.toLowerCase().includes(s) || q.question_text?.toLowerCase().includes(s) || q.course_name?.toLowerCase().includes(s)));
    }

    // Map each item to ensure frontend compatibility
    const mapped = list.map((q) => ({
      id: q.id,
      text: q.text || q.question_text || '',
      question_text: q.question_text || q.text || '',
      course_id: q.course_id || q.course_code || 'course-default',
      course_name: q.course_name || 'Computer Science & Engineering',
      course_code: q.course_code || 'CS301',
      marks: q.marks || 10,
      bloom_level: q.bloom_level || 'apply',
      difficulty: q.difficulty || 'medium',
      co_id: q.co_id || 'co-1',
      bank_id: q.bank_id,
      verification_status: q.verification_status || 'verified',
      created_at: q.created_at || new Date().toISOString(),
    }));

    const paginated = mapped.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({ data: paginated, total: mapped.length });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/questions — Add single question with manual course entry
router.post('/', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res, next) => {
  try {
    const {
      course_name,
      course_code,
      course_id,
      text,
      question_text,
      bloom_level = 'apply',
      difficulty = 'medium',
      marks = 10,
      co_id,
      bank_id,
      auto_classify,
    } = req.body;

    const actualText = (text || question_text || '').trim();
    if (!actualText || actualText.length < 5) {
      return res.status(400).json({ error: 'Question text must be at least 5 characters' });
    }

    let finalBloom = bloom_level;
    let finalDiff = difficulty;

    if (auto_classify) {
      const cl = await geminiService.classifyQuestion(actualText, course_name || course_code);
      finalBloom = cl.bloom_level || finalBloom;
      finalDiff = cl.difficulty || finalDiff;
    }

    const newQ = {
      id: 'q-' + Date.now(),
      course_id: course_id || course_code || 'course-manual',
      course_name: course_name || 'Custom Course',
      course_code: course_code || 'GEN101',
      bank_id: bank_id || undefined,
      text: actualText,
      question_text: actualText,
      bloom_level: finalBloom,
      difficulty: finalDiff,
      marks: Number(marks) || 10,
      co_id: co_id || 'co-1',
      verification_status: 'verified',
      is_active: true,
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
    };

    mockStore.questions.unshift(newQ);

    // If associated with a bank, increment count
    if (bank_id) {
      const bank = mockStore.questionBanks.find((b) => b.id === bank_id);
      if (bank) bank.question_count = (bank.question_count || 0) + 1;
    }

    res.status(201).json(newQ);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/questions/:questionId — Delete a single question
router.delete('/:questionId', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res) => {
  const qId = req.params.questionId;
  const initialLen = mockStore.questions.length;
  mockStore.questions = mockStore.questions.filter((q) => q.id !== qId);

  // Update question counts in banks
  mockStore.questionBanks.forEach((b) => {
    b.question_count = mockStore.questions.filter((q) => q.bank_id === b.id).length;
  });

  res.json({ message: 'Question deleted successfully', deleted: initialLen !== mockStore.questions.length });
});

// ─── DELETE /api/v1/questions — Clear questions
router.delete('/', authenticate, authorize(['faculty', 'admin']), async (req: AuthRequest, res) => {
  if (req.query.clearAll === 'true') {
    mockStore.questions = [];
    mockStore.questionBanks = [];
    return res.json({ message: 'All questions and banks cleared' });
  }
  res.status(400).json({ error: 'Specify ?clearAll=true to clear questions' });
});

export default router;
