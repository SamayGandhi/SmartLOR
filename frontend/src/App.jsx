import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminOverview from './pages/AdminOverview';
import RequestLOR from './pages/RequestLOR';
import MyRequests from './pages/MyRequests';
import ProfessorRequests from './pages/ProfessorRequests';
import AdminUsers from './pages/AdminUsers';
import AdminRequests from './pages/AdminRequests';
import Profile from './pages/Profile';
import Feedback from './pages/Feedback';
import ProfessorVerification from './pages/ProfessorVerification';
import Notifications from './pages/Notifications';
import RequestDocuments from './pages/RequestDocuments';
import RecommendationWorkspace from './pages/RecommendationWorkspace';

export default function App() {
  const { user } = useAuth();
  const home = user ? (user.role === 'admin' ? '/admin' : user.role === 'professor' && user.professorVerification?.status !== 'verified' ? '/professor-verification' : '/dashboard') : '/login';
  return <Routes>
    <Route path="/" element={<Navigate to={home} replace />} />
    <Route path="/login" element={user ? <Navigate to={home} replace /> : <Login />} />
    <Route path="/register" element={user ? <Navigate to={home} replace /> : <Register />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route element={<ProtectedRoute roles={['professor']} />}><Route path="/professor-verification" element={<ProfessorVerification />} /></Route>
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route element={<ProtectedRoute roles={['student']} />}>
          <Route path="/request-lor" element={<RequestLOR />} />
          <Route path="/my-requests" element={<MyRequests />} />
          <Route path="/request-documents" element={<RequestDocuments />} />
        </Route>
        <Route element={<ProtectedRoute roles={['professor']} />}>
          <Route path="/requests" element={<ProfessorRequests />} />
          <Route path="/recommendation-workspace/:id" element={<RecommendationWorkspace />} />
        </Route>
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/requests" element={<AdminRequests />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<Navigate to={home} replace />} />
  </Routes>;
}
