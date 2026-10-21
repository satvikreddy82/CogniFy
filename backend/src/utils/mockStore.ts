import bcrypt from 'bcryptjs';

export interface DepartmentItem {
  id: string;
  name: string;
}

export interface ProfileItem {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'dean' | 'faculty';
  department_id?: string;
  designation?: string;
  employee_id?: string;
  password_hash: string;
  is_active: boolean;
  status: 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  created_at: string;
  theme?: string;
  appearance?: string;
}

export interface ApplicationItem {
  id: string;
  applicant_id: string;
  applicant_role: 'faculty' | 'dean';
  department_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_by?: string;
  decision_reason?: string;
  decided_at?: string;
  created_at: string;
}

export interface QuestionBankItem {
  id: string;
  title: string;
  file_name: string;
  file_type: 'pdf' | 'jpeg' | 'jpg' | 'png' | 'manual';
  file_size?: number;
  course_name: string;
  course_code: string;
  syllabus_text?: string;
  question_count: number;
  created_at: string;
  created_by?: string;
}

export const DEPARTMENTS: DepartmentItem[] = [
  { id: 'dept-01', name: 'Computer Science & Engineering (CSE)' },
  { id: 'dept-02', name: 'Information Technology (IT)' },
  { id: 'dept-03', name: 'Electronics & Communication Engineering (ECE)' },
  { id: 'dept-04', name: 'Electrical & Electronics Engineering (EEE)' },
  { id: 'dept-05', name: 'Mechanical Engineering' },
  { id: 'dept-06', name: 'Civil Engineering' },
  { id: 'dept-07', name: 'Artificial Intelligence & Data Science (AI & DS)' },
  { id: 'dept-08', name: 'Biotechnology' },
  { id: 'dept-09', name: 'Chemical Engineering' },
  { id: 'dept-10', name: 'Aerospace Engineering' },
  { id: 'dept-11', name: 'Mechatronics' },
  { id: 'dept-12', name: 'Robotics & Artificial Intelligence' },
  { id: 'dept-13', name: 'Electronics & Instrumentation Engineering (EIE)' },
  { id: 'dept-14', name: 'Bioinformatics' },
];

class MockStore {
  departments: DepartmentItem[] = [...DEPARTMENTS];
  profiles: ProfileItem[] = [];
  applications: ApplicationItem[] = [];
  courses: any[] = [];
  courseOutcomes: any[] = [];
  questions: any[] = [];
  questionBanks: QuestionBankItem[] = [];
  papers: any[] = [];
  paperQuestions: any[] = [];
  assessments: any[] = [];
  assessmentMarks: any[] = [];
  notifications: any[] = [];
  auditLogs: any[] = [];

  constructor() {
    this.seedDefaultUsers();
    this.seedSampleCourses();
  }

  private seedDefaultUsers() {
    const adminHash = bcrypt.hashSync('Admin@123', 10);
    const deanHash = bcrypt.hashSync('Dean@123', 10);
    const facultyHash = bcrypt.hashSync('Faculty@123', 10);

    this.profiles = [
      {
        id: 'usr-admin-01',
        email: 'admin@cognify.edu',
        full_name: 'System Administrator',
        role: 'admin',
        password_hash: adminHash,
        is_active: true,
        status: 'approved',
        created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        id: 'usr-dean-01',
        email: 'dean@cognify.edu',
        full_name: 'Dr. Katherine Vance',
        role: 'dean',
        department_id: 'dept-01',
        employee_id: 'DEAN-CSE-01',
        password_hash: deanHash,
        is_active: true,
        status: 'approved',
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
      },
      {
        id: 'usr-faculty-01',
        email: 'faculty@cognify.edu',
        full_name: 'Prof. Alan Turing',
        role: 'faculty',
        department_id: 'dept-01',
        designation: 'Associate Professor',
        employee_id: 'FAC-CSE-101',
        password_hash: facultyHash,
        is_active: true,
        status: 'approved',
        created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      },
    ];

    this.notifications = [
      {
        id: 'notif-1',
        recipient_id: 'usr-admin-01',
        type: 'system_welcome',
        payload: { message: 'Welcome to CogniFy Assessment Platform' },
        is_read: false,
        created_at: new Date().toISOString(),
      },
    ];

    this.auditLogs = [
      {
        id: 'log-1',
        actor_id: 'usr-admin-01',
        action: 'system_init',
        target_table: 'system',
        target_id: 'root',
        details: { message: 'Initialized with 14 academic departments and default roles' },
        created_at: new Date().toISOString(),
      },
    ];
  }

  private seedSampleCourses() {
    this.courses = [
      {
        id: 'course-cse-101',
        code: 'CS301',
        name: 'Design and Analysis of Algorithms',
        department_id: 'dept-01',
        term: 'Fall 2026',
        description: 'Algorithmic paradigms, asymptotic complexity, dynamic programming, and graph algorithms.',
        created_by: 'usr-faculty-01',
        created_at: new Date().toISOString(),
      },
      {
        id: 'course-cse-102',
        code: 'CS402',
        name: 'Artificial Intelligence & Machine Learning',
        department_id: 'dept-01',
        term: 'Fall 2026',
        description: 'Supervised and unsupervised learning, search heuristics, deep networks.',
        created_by: 'usr-faculty-01',
        created_at: new Date().toISOString(),
      },
    ];

    this.courseOutcomes = [
      {
        id: 'co-1',
        course_id: 'course-cse-101',
        code: 'CO1',
        description: 'Analyze the asymptotic performance of algorithms using standard notations.',
        target_attainment: 70,
      },
      {
        id: 'co-2',
        course_id: 'course-cse-101',
        code: 'CO2',
        description: 'Apply divide-and-conquer and dynamic programming techniques to real-world problems.',
        target_attainment: 65,
      },
      {
        id: 'co-3',
        course_id: 'course-cse-101',
        code: 'CO3',
        description: 'Synthesize greedy approaches for minimum spanning trees and shortest paths.',
        target_attainment: 60,
      },
      {
        id: 'co-4',
        course_id: 'course-cse-101',
        code: 'CO4',
        description: 'Evaluate NP-complete problems and design heuristic approximation bounds.',
        target_attainment: 60,
      },
    ];

    this.questionBanks = [
      {
        id: 'bank-01',
        title: 'CS301 Question Bank - Algorithms & Complexity (PDF)',
        file_name: 'CS301_Algorithms_QuestionBank.pdf',
        file_type: 'pdf',
        file_size: 342000,
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        syllabus_text: 'Unit 1: Asymptotic Analysis and Recurrences. Unit 2: Divide and Conquer, Dynamic Programming. Unit 3: Greedy Algorithms and Graph Traversal. Unit 4: NP-Completeness and Approximation.',
        question_count: 4,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_by: 'usr-faculty-01',
      },
    ];

    this.questions = [
      {
        id: 'q-1',
        course_id: 'course-cse-101',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        bank_id: 'bank-01',
        text: 'Derive the Master Theorem recurrence solution for T(n) = 4T(n/2) + n^2 and state its Big-Theta asymptotic complexity.',
        question_text: 'Derive the Master Theorem recurrence solution for T(n) = 4T(n/2) + n^2 and state its Big-Theta asymptotic complexity.',
        marks: 10,
        bloom_level: 'apply',
        difficulty: 'medium',
        co_id: 'co-1',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_by: 'usr-faculty-01',
      },
      {
        id: 'q-2',
        course_id: 'course-cse-101',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        bank_id: 'bank-01',
        text: 'Differentiate between 0/1 Knapsack and Fractional Knapsack problem using dynamic programming vs greedy paradigms.',
        question_text: 'Differentiate between 0/1 Knapsack and Fractional Knapsack problem using dynamic programming vs greedy paradigms.',
        marks: 15,
        bloom_level: 'analyze',
        difficulty: 'hard',
        co_id: 'co-2',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_by: 'usr-faculty-01',
      },
      {
        id: 'q-3',
        course_id: 'course-cse-101',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        bank_id: 'bank-01',
        text: 'Define Dijkstra algorithm and state its limitations regarding negative edge weights and graph cycles.',
        question_text: 'Define Dijkstra algorithm and state its limitations regarding negative edge weights and graph cycles.',
        marks: 5,
        bloom_level: 'remember',
        difficulty: 'easy',
        co_id: 'co-3',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_by: 'usr-faculty-01',
      },
      {
        id: 'q-4',
        course_id: 'course-cse-101',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        bank_id: 'bank-01',
        text: 'Prove that the Vertex Cover problem is NP-Complete by reduction from 3-SAT.',
        question_text: 'Prove that the Vertex Cover problem is NP-Complete by reduction from 3-SAT.',
        marks: 20,
        bloom_level: 'evaluate',
        difficulty: 'hard',
        co_id: 'co-4',
        is_active: true,
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_by: 'usr-faculty-01',
      },
    ];

    // Seed sample examination paper with full OBE questions
    const samplePaperId = 'paper-sample-01';
    this.papers = [
      {
        id: samplePaperId,
        title: 'Mid-Semester Assessment — Design & Analysis of Algorithms',
        course_id: 'course-cse-101',
        course_name: 'Design and Analysis of Algorithms',
        course_code: 'CS301',
        syllabus: 'Unit 1: Mathematical Foundations & Asymptotic Complexity. Unit 2: Divide-and-Conquer & Dynamic Programming. Unit 3: Greedy Techniques & Graph Algorithms. Unit 4: Intractability & NP-Completeness.',
        total_marks: 50,
        duration_minutes: 120,
        status: 'approved',
        created_by: 'usr-faculty-01',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        courses: { name: 'Design and Analysis of Algorithms', code: 'CS301' },
        question_count: 4,
      },
    ];

    this.paperQuestions = [
      {
        id: 'pq-s-1',
        paper_id: samplePaperId,
        question_id: 'q-1',
        order_index: 1,
        section: 'Section A (Analytical Recurrences)',
        marks: 10,
        question_bank_entries: {
          text: 'Derive the Master Theorem recurrence solution for T(n) = 4T(n/2) + n^2 and state its Big-Theta asymptotic complexity.',
          question_text: 'Derive the Master Theorem recurrence solution for T(n) = 4T(n/2) + n^2 and state its Big-Theta asymptotic complexity.',
          bloom_level: 'apply',
          difficulty: 'medium',
          co_id: 'CO1',
          marks: 10,
        },
      },
      {
        id: 'pq-s-2',
        paper_id: samplePaperId,
        question_id: 'q-3',
        order_index: 2,
        section: 'Section A (Analytical Recurrences)',
        marks: 5,
        question_bank_entries: {
          text: 'State the Greedy Choice property and optimal substructure property required for greedy algorithmic correctness.',
          question_text: 'State the Greedy Choice property and optimal substructure property required for greedy algorithmic correctness.',
          bloom_level: 'remember',
          difficulty: 'easy',
          co_id: 'CO3',
          marks: 5,
        },
      },
      {
        id: 'pq-s-3',
        paper_id: samplePaperId,
        question_id: 'q-2',
        order_index: 3,
        section: 'Section B (Optimization & Design)',
        marks: 15,
        question_bank_entries: {
          text: 'Differentiate between 0/1 Knapsack and Fractional Knapsack problem using dynamic programming vs greedy paradigms.',
          question_text: 'Differentiate between 0/1 Knapsack and Fractional Knapsack problem using dynamic programming vs greedy paradigms.',
          bloom_level: 'analyze',
          difficulty: 'medium',
          co_id: 'CO2',
          marks: 15,
        },
      },
      {
        id: 'pq-s-4',
        paper_id: samplePaperId,
        question_id: 'q-4',
        order_index: 4,
        section: 'Section C (NP-Completeness & Complexity)',
        marks: 20,
        question_bank_entries: {
          text: 'Prove that the Vertex Cover problem is NP-Complete by reduction from 3-SAT.',
          question_text: 'Prove that the Vertex Cover problem is NP-Complete by reduction from 3-SAT.',
          bloom_level: 'evaluate',
          difficulty: 'hard',
          co_id: 'CO4',
          marks: 20,
        },
      },
    ];
  }
}

export const mockStore = new MockStore();

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || '';
  if (
    !url ||
    url.includes('example.supabase.co') ||
    url.includes('your-supabase-url') ||
    url.includes('your-project')
  ) {
    return false;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const isServiceValid = Boolean(serviceKey && !serviceKey.includes('placeholder') && !serviceKey.includes('your-'));
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const isAnonValid = Boolean(anonKey && !anonKey.includes('placeholder') && !anonKey.includes('your-'));

  return isServiceValid || isAnonValid;
}
