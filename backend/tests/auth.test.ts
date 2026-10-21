import request from 'supertest';
import app from '../src/index';
import { registerFacultySchema, registerDeanSchema } from '../src/validators/auth';

describe('Auth & Department Registration (BUG 1 Regression Tests)', () => {
  beforeAll(() => {
    jest.setTimeout(30000);
  });
  it('validates faculty schema with accredited department string ID (dept-01)', () => {
    const payload = {
      full_name: 'Dr. Katherine Vance',
      employee_id: 'FAC-CSE-99',
      email: 'katherine.vance.test@cognify.edu',
      department_id: 'dept-01',
      designation: 'Associate Professor',
      password: 'Password@123',
      confirm_password: 'Password@123',
    };
    const parsed = registerFacultySchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('validates dean schema with accredited department string ID (dept-02)', () => {
    const payload = {
      full_name: 'Dr. Jonathan Wells',
      employee_id: 'DEAN-IT-01',
      email: 'jonathan.wells.test@cognify.edu',
      department_id: 'dept-02',
      password: 'Password@123',
      confirm_password: 'Password@123',
    };
    const parsed = registerDeanSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects faculty registration with empty or whitespace-only department', () => {
    const payload = {
      full_name: 'Dr. Missing Dept',
      employee_id: 'FAC-000',
      email: 'missing.dept@cognify.edu',
      department_id: '   ',
      designation: 'Lecturer',
      password: 'Password@123',
      confirm_password: 'Password@123',
    };
    const parsed = registerFacultySchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('POST /api/v1/auth/register/faculty succeeds with valid department dept-01 and assigns pending_approval', async () => {
    const uniqueEmail = `fac_${Date.now()}@cognify.edu`;
    const res = await request(app)
      .post('/api/v1/auth/register/faculty')
      .send({
        full_name: 'Dr. Turing Test',
        employee_id: `FAC-${Date.now().toString().slice(-4)}`,
        email: uniqueEmail,
        department_id: 'dept-01',
        designation: 'Assistant Professor',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending_approval');
  });

  it('POST /api/v1/auth/register/dean succeeds with valid department dept-03 and assigns pending_approval', async () => {
    const uniqueEmail = `dean_${Date.now()}@cognify.edu`;
    const res = await request(app)
      .post('/api/v1/auth/register/dean')
      .send({
        full_name: 'Dr. Dean Test',
        employee_id: `DEAN-${Date.now().toString().slice(-4)}`,
        email: uniqueEmail,
        department_id: 'dept-03',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending_approval');
  });

  it('POST /api/v1/auth/register/faculty rejects invalid/non-existent department with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/faculty')
      .send({
        full_name: 'Dr. Invalid Dept',
        employee_id: 'FAC-9999',
        email: `invalid_${Date.now()}@cognify.edu`,
        department_id: 'non-existent-dept-xyz',
        designation: 'Assistant Professor',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Please select a valid accredited academic department');
  });

  it('POST /api/v1/auth/register/dean rejects invalid/non-existent department with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/dean')
      .send({
        full_name: 'Dr. Invalid Dean Dept',
        employee_id: 'DEAN-9999',
        email: `invalid_dean_${Date.now()}@cognify.edu`,
        department_id: 'fake-department-1234',
        password: 'Password@123',
        confirm_password: 'Password@123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Please select a valid accredited academic department');
  });

  describe('Password Recovery OTP & Verification Flow (PRIORITY 2 Tests)', () => {
    it('POST /api/v1/auth/request-otp rejects malformed email with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/v1/auth/request-otp accepts valid email and dispatches recovery code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/request-otp')
        .send({ email: 'faculty@cognify.edu' });

      expect([200, 429]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.message).toBeDefined();
        // NEVER expose dev OTP or passwords in response
        expect(res.body.message).not.toContain('Dev OTP');
        expect(res.body.message).not.toContain('123456');
      }
    });

    it('POST /api/v1/auth/verify-otp rejects OTP with non-6-digit length with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: 'faculty@cognify.edu', otp: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('6 digits');
    });

    it('POST /api/v1/auth/verify-otp rejects invalid or expired OTP code with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/verify-otp')
        .send({ email: 'faculty@cognify.edu', otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/v1/auth/reset-password rejects mismatched passwords with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'faculty@cognify.edu',
          otp: '123456',
          password: 'NewStrongPassword123!',
          confirm_password: 'MismatchPassword999!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Passwords do not match');
    });

    it('POST /api/v1/auth/reset-password rejects short password with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'faculty@cognify.edu',
          otp: '123456',
          password: 'short',
          confirm_password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 8 characters');
    });
  });
});

