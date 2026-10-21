import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth } from './components/RequireAuth';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterFacultyPage from './pages/auth/RegisterFacultyPage';
import RegisterDeanPage from './pages/auth/RegisterDeanPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Layouts
import FacultyLayout from './layouts/FacultyLayout';
import DeanLayout from './layouts/DeanLayout';
import AdminLayout from './layouts/AdminLayout';

// Faculty pages
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import CoursesPage from './pages/faculty/CoursesPage';
import CourseDetailPage from './pages/faculty/CourseDetailPage';
import QuestionBankPage from './pages/faculty/QuestionBankPage';
import PaperGeneratorPage from './pages/faculty/PaperGeneratorPage';
import PreviousPapersPage from './pages/faculty/PreviousPapersPage';
import MarksAnalysisPage from './pages/faculty/MarksAnalysisPage';
import AdaptivePlanningPage from './pages/faculty/AdaptivePlanningPage';
import NotificationsPage from './pages/shared/NotificationsPage';
import AppearanceSettingsPage from './pages/shared/AppearanceSettingsPage';
import ProfilePage from './pages/faculty/ProfilePage';

// Dean pages
import DeanDashboard from './pages/dean/DeanDashboard';
import FacultyApplicationsPage from './pages/dean/FacultyApplicationsPage';
import PaperReviewPage from './pages/dean/PaperReviewPage';
import DeanAnalyticsPage from './pages/dean/DeanAnalyticsPage';
import DeanProfilePage from './pages/dean/DeanProfilePage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import DeanApplicationsPage from './pages/admin/DeanApplicationsPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import DepartmentsPage from './pages/admin/DepartmentsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

// Misc
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register/faculty" element={<RegisterFacultyPage />} />
              <Route path="/register/dean" element={<RegisterDeanPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Faculty routes */}
              <Route path="/dashboard" element={
                <RequireAuth allowedRoles={['faculty']}>
                  <FacultyLayout />
                </RequireAuth>
              }>
                <Route index element={<FacultyDashboard />} />
                <Route path="courses" element={<CoursesPage />} />
                <Route path="courses/:courseId" element={<CourseDetailPage />} />
                <Route path="question-bank" element={<QuestionBankPage />} />
                <Route path="generate" element={<PaperGeneratorPage />} />
                <Route path="generate-paper" element={<Navigate to="/dashboard/generate" replace />} />
                <Route path="papers" element={<PreviousPapersPage />} />
                <Route path="marks" element={<MarksAnalysisPage />} />
                <Route path="adaptive" element={<AdaptivePlanningPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<AppearanceSettingsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Faculty route aliases for direct URL navigation */}
              <Route path="/faculty/profile" element={<Navigate to="/dashboard/profile" replace />} />
              <Route path="/faculty/generate-paper" element={<Navigate to="/dashboard/generate" replace />} />
              <Route path="/faculty/generate" element={<Navigate to="/dashboard/generate" replace />} />
              <Route path="/generate-paper" element={<Navigate to="/dashboard/generate" replace />} />
              <Route path="/faculty/courses" element={<Navigate to="/dashboard/courses" replace />} />
              <Route path="/faculty/*" element={<Navigate to="/dashboard" replace />} />
              <Route path="/faculty" element={<Navigate to="/dashboard" replace />} />

              {/* Dean routes */}
              <Route path="/dean" element={
                <RequireAuth allowedRoles={['dean']}>
                  <DeanLayout />
                </RequireAuth>
              }>
                <Route index element={<DeanDashboard />} />
                <Route path="applications" element={<FacultyApplicationsPage />} />
                <Route path="papers" element={<PaperReviewPage />} />
                <Route path="analytics" element={<DeanAnalyticsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<DeanProfilePage />} />
                <Route path="settings" element={<AppearanceSettingsPage />} />
              </Route>

              {/* Admin routes */}
              <Route path="/admin" element={
                <RequireAuth allowedRoles={['admin']}>
                  <AdminLayout />
                </RequireAuth>
              }>
                <Route index element={<AdminDashboard />} />
                <Route path="dean-applications" element={<DeanApplicationsPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<AdminProfilePage />} />
                <Route path="settings" element={<AppearanceSettingsPage />} />
              </Route>

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
