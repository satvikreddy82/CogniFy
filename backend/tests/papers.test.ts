import request from 'supertest';
import express from 'express';
import { mockStore } from '../src/utils/mockStore';
import papersRouter from '../src/routes/papers';
import { errorHandler } from '../src/middleware/errorHandler';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

function makeToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role, email: `${role}@test.edu` }, JWT_SECRET, { expiresIn: '1h' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/papers', papersRouter);
  app.use(errorHandler);
  return app;
}

// Ensure required test profiles exist in mockStore
if (!mockStore.profiles.find((p) => p.id === 'usr-faculty-99')) {
  mockStore.profiles.push({
    id: 'usr-faculty-99',
    email: 'otherfaculty@cognify.edu',
    full_name: 'Other Faculty',
    role: 'faculty',
    department_id: 'dept-01',
    password_hash: 'hash',
    is_active: true,
    status: 'approved',
    created_at: new Date().toISOString(),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedEditablePaper() {
  const paperId = 'paper-edit-test-' + Date.now();
  const pqId = 'pq-edit-' + Date.now();

  mockStore.papers.push({
    id: paperId,
    title: 'Edit Test Paper',
    course_id: 'cs301',
    course_name: 'Test Course',
    course_code: 'TC101',
    total_marks: 50,
    duration_minutes: 120,
    status: 'validation_required',
    created_by: 'usr-faculty-01',
    created_at: new Date().toISOString(),
  });

  mockStore.paperQuestions.push({
    id: pqId,
    paper_id: paperId,
    question_id: 'q-test-1',
    order_index: 1,
    section: 'Section A',
    marks: 20,
    question_bank_entries: {
      text: 'Original question text for editing test.',
      question_text: 'Original question text for editing test.',
      bloom_level: 'apply',
      difficulty: 'medium',
      co_id: 'CO1',
      marks: 20,
    },
  });

  // Second question to test total marks consistency
  mockStore.paperQuestions.push({
    id: pqId + '-2',
    paper_id: paperId,
    question_id: 'q-test-2',
    order_index: 2,
    section: 'Section B',
    marks: 30,
    question_bank_entries: {
      text: 'Second question stays unchanged.',
      question_text: 'Second question stays unchanged.',
      bloom_level: 'remember',
      difficulty: 'easy',
      co_id: 'CO2',
      marks: 30,
    },
  });

  return { paperId, pqId };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PATCH /papers/:paperId/questions/:pqId — individual question editing', () => {
  let app: express.Express;
  const facultyToken = makeToken('usr-faculty-01', 'faculty');
  const otherFacultyToken = makeToken('usr-faculty-99', 'faculty');
  const deanToken = makeToken('usr-dean-01', 'dean');

  beforeEach(() => {
    app = makeApp();
  });

  // ── 1. Successful edit ────────────────────────────────────────────────────

  it('saves text edit and returns updated paper_question with stable id', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Updated question text after faculty edit.', bloom_level: 'analyze' });

    expect(res.status).toBe(200);
    expect(res.body.paper_question.id).toBe(pqId); // stable identifier
    expect(res.body.paper_question.question_bank_entries.text).toBe(
      'Updated question text after faculty edit.'
    );
    expect(res.body.paper_question.question_bank_entries.bloom_level).toBe('analyze');
  });

  it('keeps other questions unchanged when one is edited', async () => {
    const { paperId, pqId } = seedEditablePaper();
    const secondPqId = pqId + '-2';

    await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Changed only Q1.', difficulty: 'hard' });

    // Verify second question untouched in mockStore
    const secondPq = mockStore.paperQuestions.find(
      (pq) => pq.id === secondPqId && pq.paper_id === paperId
    );
    expect(secondPq?.question_bank_entries?.text).toBe('Second question stays unchanged.');
    expect(secondPq?.question_bank_entries?.difficulty).toBe('easy');
  });

  it('question identifier (id) remains stable after edit', async () => {
    const { paperId, pqId } = seedEditablePaper();

    await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Stable identifier test — id must not change.' });

    const pq = mockStore.paperQuestions.find((q) => q.id === pqId);
    expect(pq?.id).toBe(pqId); // id unchanged
  });

  // ── 2. Marks validation ───────────────────────────────────────────────────

  it('rejects marks change that would break paper total', async () => {
    const { paperId, pqId } = seedEditablePaper();

    // Total is 50; changing Q1 from 20 to 25 would give 25+30=55 ≠ 50
    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ marks: 25 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('MARKS_MISMATCH');
    expect(res.body.expected_total).toBe(50);
    expect(res.body.new_total).toBe(55);
  });

  it('accepts marks change that preserves paper total', async () => {
    const { paperId, pqId } = seedEditablePaper();
    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ marks: 20, text: 'Same marks but new text is fine.' }); // same mark total = 50

    expect(res.status).toBe(200);
    expect(res.body.paper_total_marks).toBe(50);
  });

  it('rejects missing/short question text', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Hi' });

    expect(res.status).toBe(400);
  });

  it('rejects marks < 1', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ marks: 0 });

    expect(res.status).toBe(400);
  });

  // ── 3. Authorisation checks ───────────────────────────────────────────────

  it('rejects unauthenticated request', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .send({ text: 'Should not work without token.' });

    expect(res.status).toBe(401);
  });

  it('rejects faculty editing another faculty member\'s paper', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${otherFacultyToken}`)
      .send({ text: 'Unauthorised faculty should be rejected here.' });

    expect(res.status).toBe(403);
  });

  it('rejects dean from editing paper questions (dean role not authorised)', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${deanToken}`)
      .send({ text: 'Dean should not be able to edit questions directly.' });

    expect(res.status).toBe(403);
  });

  // ── 4. Lock checks ────────────────────────────────────────────────────────

  it('rejects edit when paper is approved', async () => {
    const { paperId, pqId } = seedEditablePaper();
    const paper = mockStore.papers.find((p) => p.id === paperId)!;
    paper.status = 'approved';

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Approved papers must not be editable by faculty.' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAPER_LOCKED');
  });

  it('rejects edit when paper is pending_review', async () => {
    const { paperId, pqId } = seedEditablePaper();
    const paper = mockStore.papers.find((p) => p.id === paperId)!;
    paper.status = 'pending_review';

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Paper under review must not be editable.' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAPER_LOCKED');
  });

  // ── 5. 404 edge-cases ─────────────────────────────────────────────────────

  it('returns 404 for non-existent paper', async () => {
    const res = await request(app)
      .patch('/api/v1/papers/non-existent-paper-id/questions/pq-1')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'This paper does not exist.' });

    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent pqId in a valid paper', async () => {
    const { paperId } = seedEditablePaper();

    const res = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/pq-does-not-exist`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'This question does not belong to this paper.' });

    expect(res.status).toBe(404);
  });

  // ── 6. Question numbering ─────────────────────────────────────────────────

  it('paper_question id is stable after reload (same id, updated text)', async () => {
    const { paperId, pqId } = seedEditablePaper();

    const editRes = await request(app)
      .patch(`/api/v1/papers/${paperId}/questions/${pqId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ text: 'Persistence check — must survive reload.' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.paper_question.id).toBe(pqId);

    // Simulate reload: fetch the full paper and confirm text persisted
    const paperRes = await request(app)
      .get(`/api/v1/papers/${paperId}`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(paperRes.status).toBe(200);
    const fetchedPqs: any[] = paperRes.body.paper_questions || [];
    const foundPq = fetchedPqs.find((q: any) => q.id === pqId);
    expect(foundPq).toBeDefined();
    expect(foundPq.question_bank_entries?.text).toBe('Persistence check — must survive reload.');
  });
});
