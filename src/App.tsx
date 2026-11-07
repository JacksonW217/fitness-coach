import { BarChart3, CalendarDays, CircleUserRound, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useActiveProgram, useProfile } from './lib/data';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import ProgramScreen from './screens/Program';
import ProgramDayEdit from './screens/ProgramDayEdit';
import ProgramHistory from './screens/ProgramHistory';
import Workout from './screens/Workout';
import WorkoutSummary from './screens/WorkoutSummary';
import Progress from './screens/Progress';
import ExerciseDetail from './screens/ExerciseDetail';
import ProfileScreen from './screens/Profile';
import ProgramReview from './screens/ProgramReview';

const TABS = [
  { to: '/', label: 'Today', icon: Sun },
  { to: '/program', label: 'Program', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: CircleUserRound },
];

function TabBar() {
  return (
    <div className="tabbar">
      <nav>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <t.icon size={24} strokeWidth={1.8} />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const profile = useProfile();
  const program = useActiveProgram();
  const loc = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (profile === null || program === null) return <div className="app" />; // loading
  const onboarded = !!profile && !!program;
  const showTabs = onboarded && ['/', '/program', '/progress', '/profile'].includes(loc.pathname);

  return (
    <div className="app">
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/review" element={<ProgramReview />} />
        {!onboarded ? (
          <Route path="*" element={<Navigate to={profile ? '/review' : '/onboarding'} replace />} />
        ) : (
          <>
            <Route path="/" element={<Today />} />
            <Route path="/program" element={<ProgramScreen />} />
            <Route path="/program/day/:id" element={<ProgramDayEdit />} />
            <Route path="/program/history" element={<ProgramHistory />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/workout/:id/summary" element={<WorkoutSummary />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/progress/exercise/:id" element={<ExerciseDetail />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      {showTabs && <TabBar />}
    </div>
  );
}
