import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import VocalTest from './pages/tests/VocalTest';
import TapTest from './pages/tests/TapTest';
import DualTask from './pages/tests/DualTask';
import StroopTest from './pages/tests/StroopTest';
import TremorTest from './pages/tests/TremorTest';
import FullAssessment from './pages/FullAssessment';
import Lifestyle from './pages/Lifestyle';
import { SerialProvider } from './context/SerialContext';

function App() {
  return (
    <SerialProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/full-assessment" element={<FullAssessment />} />
          <Route path="/vocal-test" element={<VocalTest />} />
          <Route path="/tremor-test" element={<TremorTest />} />
          <Route path="/tap-test" element={<TapTest />} />
          <Route path="/dual-task" element={<DualTask />} />
          <Route path="/cognitive-test" element={<StroopTest />} />
          <Route path="/lifestyle" element={<Lifestyle />} />
        </Routes>
      </Router>
    </SerialProvider>
  );
}

export default App;
