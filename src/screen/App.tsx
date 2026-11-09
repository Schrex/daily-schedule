import { seedRoster } from '../seed/seedRoster';
import { seedSchedule } from '../seed/seedSchedule';
import { ScheduleScreen } from './ScheduleScreen';

/** For now the app always shows the seeded Daily Schedule, read-only. */
export function App() {
  return <ScheduleScreen roster={seedRoster} schedule={seedSchedule} />;
}
