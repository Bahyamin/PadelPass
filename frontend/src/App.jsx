import { Route, Routes } from 'react-router';
import Availability from './pages/Availability.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

// Pages of the app (SDD 5.2).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/book" element={<Availability />} />
    </Routes>
  );
}
