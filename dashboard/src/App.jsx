import { Routes, Route } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import StatusPage from './pages/StatusPage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    // reducedMotion="user": animations switch off for users who requested it in their OS.
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<StatusPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MotionConfig>
  );
}