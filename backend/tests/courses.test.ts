import request from 'supertest';
import app from '../src/index';
import { generateToken } from '../src/services/authService';
import { mockStore } from '../src/utils/mockStore';

describe('Courses API Flow & Validation', () => {
  const facultyUser = {
    id: 'usr-faculty-01',
    email: 'faculty@cognify.edu',
    role: 'faculty' as const,
    department_id: 'dept-01',
  };
  const facultyToken = generateToken(facultyUser.id, facultyUser.role);

  it('allows faculty to create a new course and automatically attaches their department', async () => {
    const uniqueCode = 'CS' + Math.floor(Math.random() * 800 + 100);
    const payload = {
      code: uniqueCode,
      name: 'Advanced Software Engineering',
      term: 'Fall 2026',
      description: 'Design patterns and microservices architecture',
    };

    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.code).toBe(uniqueCode);
    expect(res.body.name).toBe(payload.name);
    expect(res.body.department_id).toBe('dept-01');
    expect(res.body.created_by).toBe('usr-faculty-01');

    // Verify course is immediately retrievable in GET /api/v1/courses
    const listRes = await request(app)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(listRes.status).toBe(200);
    const found = listRes.body.find((c: any) => c.code === uniqueCode);
    expect(found).toBeDefined();
    expect(found.id).toBe(res.body.id);
  });

  it('rejects duplicate course codes in the same department with 409 Conflict', async () => {
    // CS301 is already seeded in dept-01
    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        code: 'CS301',
        name: 'Another Algorithms Course',
        term: 'Spring 2027',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('rejects invalid inputs with 400 and actionable error messages', async () => {
    const res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        code: 'A', // too short (< 2)
        name: '',  // empty
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.details).toBeDefined();
  });

  it('requires authentication to create, list, or delete courses', async () => {
    const unauthPost = await request(app)
      .post('/api/v1/courses')
      .send({ code: 'CS999', name: 'Unauthorized Course' });
    expect(unauthPost.status).toBe(401);

    const unauthGet = await request(app).get('/api/v1/courses');
    expect(unauthGet.status).toBe(401);

    const unauthDel = await request(app).delete('/api/v1/courses/some-course-id');
    expect(unauthDel.status).toBe(401);
  });

  describe('DELETE /api/v1/courses/:courseId (BUG 4 Regression Tests)', () => {
    it('returns 404 Not Found when attempting to delete a nonexistent course', async () => {
      const res = await request(app)
        .delete('/api/v1/courses/course-does-not-exist-999')
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('successfully deletes an unlinked course and refreshes the course list', async () => {
      // 1. Create a course with no question papers
      const uniqueCode = 'DEL' + Math.floor(Math.random() * 800 + 100);
      const createRes = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          code: uniqueCode,
          name: 'Temporary Course To Delete',
          term: 'Fall 2026',
        });

      expect(createRes.status).toBe(201);
      const courseId = createRes.body.id;

      // 2. Delete the course
      const deleteRes = await request(app)
        .delete(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toContain('deleted successfully');
      expect(deleteRes.body.course_id).toBe(courseId);

      // 3. Verify it is removed from GET /api/v1/courses
      const listRes = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${facultyToken}`);

      const found = listRes.body.find((c: any) => c.id === courseId);
      expect(found).toBeUndefined();
    });

    it('safely blocks deletion (409 Conflict) when a course has linked question papers', async () => {
      // CS301 is seeded with linked question papers
      const listRes = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${facultyToken}`);

      const cs301 = listRes.body.find((c: any) => c.code === 'CS301');
      expect(cs301).toBeDefined();

      const res = await request(app)
        .delete(`/api/v1/courses/${cs301.id}`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('COURSE_HAS_LINKED_RECORDS');
      expect(res.body.error).toContain('academic integrity');
      expect(res.body.error).toContain('examination records cannot be deleted');
    });
  });
});

