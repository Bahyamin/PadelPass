import { Route, Routes } from 'react-router';
import RequireAuth from './auth/RequireAuth.jsx';
import Availability from './pages/Availability.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
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
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
