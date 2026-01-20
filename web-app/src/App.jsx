import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import VocalTest from './pages/tests/VocalTest';
import TapTest from './pages/tests/TapTest';
import DualTask from './pages/tests/DualTask';
import StroopTest from './pages/tests/StroopTest';
import Lifestyle from './pages/Lifestyle';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vocal-test" element={<VocalTest />} />
        <Route path="/tap-test" element={<TapTest />} />
        <Route path="/dual-task" element={<DualTask />} />
        <Route path="/cognitive-test" element={<StroopTest />} />
        <Route path="/lifestyle" element={<Lifestyle />} />
      </Routes>
    </Router>
  );
};

export default App;
