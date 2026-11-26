import { Calendar, Clock, Download, Fingerprint, Radio } from 'lucide-react';
import AdminSectionStub from '../../components/ui/AdminSectionStub';

const HIGHLIGHTS = [
  {
    title: 'Live ADMS Punch Stream',
    description: 'View real-time facial verification punches pushed from the ZKFace V4.0 terminal.',
    icon: Radio,
  },
  {
    title: 'Check-In / Check-Out Pairing',
    description: 'Track daily entry and exit timestamps alongside remaining membership validity.',
    icon: Clock,
  },
  {
    title: 'Biometric Device Sync',
    description: 'Monitor device serial numbers, command acknowledgments, and enrollment logs.',
    icon: Fingerprint,
  },
];

/**
 * Biometric attendance logs skeleton route (/admin/attendance).
 */
export default function Attendance() {
  return (
    <AdminSectionStub
      title="Attendance"
      description="Inspect daily biometric check-ins and live ADMS punch records from ZKFace V4.0."
      badgeText="ADMS Sync"
      primaryActionLabel="Export Logs"
      primaryActionIcon={Download}
      secondaryActionLabel="Select Date"
      secondaryActionIcon={Calendar}
      highlights={HIGHLIGHTS}
    />
  );
}
