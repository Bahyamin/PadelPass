import { Route, Routes } from 'react-router';
import RequireAuth from './auth/RequireAuth.jsx';
import { ADMIN } from './auth/roles.js';
import AdminCourts from './pages/AdminCourts.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import Availability from './pages/Availability.jsx';
import BookCourt from './pages/BookCourt.jsx';
import BookingEquipment from './pages/BookingEquipment.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import RentEquipment from './pages/RentEquipment.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';

// Pages of the app (SDD 5.2).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/equipment" element={<RentEquipment />} />
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
        path="/my-bookings"
        element={
          <RequireAuth>
            <MyBookings />
          </RequireAuth>
        }
      />
      <Route
        path="/my-bookings/:id/equipment"
        element={
          <RequireAuth>
            <BookingEquipment />
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
          <RequireAuth roles={ADMIN}>
            <AdminSettings />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/courts"
        element={
          <RequireAuth roles={ADMIN}>
            <AdminCourts />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
