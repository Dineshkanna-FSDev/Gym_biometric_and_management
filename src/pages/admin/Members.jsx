import { Filter, RefreshCw, ScanFace, UserPlus, Users } from 'lucide-react';
import AdminSectionStub from '../../components/ui/AdminSectionStub';

const HIGHLIGHTS = [
  {
    title: 'Member Directory & Search',
    description: 'Filter gym members by Active, Expiring Soon, or Expired subscription status.',
    icon: Users,
  },
  {
    title: 'ZKFace PIN Binding',
    description: 'Assign biometric terminal PINs and track face enrollment confirmation status.',
    icon: ScanFace,
  },
  {
    title: 'One-Click Renewals',
    description: 'Extend Monthly, Quarterly, or Annual plans and recalculate expiry dates automatically.',
    icon: RefreshCw,
  },
];

/**
 * Members management skeleton route (/admin/members).
 */
export default function Members() {
  return (
    <AdminSectionStub
      title="Members"
      description="Manage gym member profiles, biometric PIN mappings, and subscription renewals."
      badgeText="Member Directory"
      primaryActionLabel="Add Member"
      primaryActionIcon={UserPlus}
      secondaryActionLabel="Filter Status"
      secondaryActionIcon={Filter}
      highlights={HIGHLIGHTS}
    />
  );
}
