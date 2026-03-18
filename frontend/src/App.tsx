import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Companies } from './pages/Companies';
import { Periods } from './pages/Periods';
import { Assignments } from './pages/Assignments';
import { Tasks } from './pages/Tasks';
import { Reports } from './pages/Reports';
import { Diary } from './pages/Diary';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
        <Route path="companies" element={<Companies />} />
        <Route path="periods" element={<ProtectedRoute allowedRoles={['admin']}><Periods /></ProtectedRoute>} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="assignments/:assignmentId/tasks" element={<Tasks />} />
        <Route path="assignments/:assignmentId/diary" element={<Diary />} />
        <Route path="assignments/:assignmentId/reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
