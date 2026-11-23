import { Route, Routes } from 'react-router';
import RequireAuth from './auth/RequireAuth.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import Availability from './pages/Availability.jsx';
import BookCourt from './pages/BookCourt.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

// Pages of the app (SDD 5.2).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/book" element={<Availability />} />
      <Route
        path="/book/new"
        element={
          <RequireAuth>
            <BookCourt />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireAuth>
            <AdminSettings />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
