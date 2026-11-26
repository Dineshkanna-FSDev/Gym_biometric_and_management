import { BarChart3, CalendarRange, Download, TrendingUp, Users } from 'lucide-react';
import AdminSectionStub from '../../components/ui/AdminSectionStub';

const HIGHLIGHTS = [
  {
    title: 'Peak Hour Heatmap',
    description: 'Identify busiest morning and evening gym check-in windows from biometric logs.',
    icon: BarChart3,
  },
  {
    title: 'Retention & Churn',
    description: 'Monitor renewal conversion rates and expired membership recovery trends.',
    icon: TrendingUp,
  },
  {
    title: 'Demographic Breakdown',
    description: 'Compare plan tier adoption and active attendance streaks across member segments.',
    icon: Users,
  },
];

/**
 * Analytics & reporting skeleton route (/admin/analytics).
 */
export default function Analytics() {
  return (
    <AdminSectionStub
      title="Analytics"
      description="Analyze attendance trends, peak floor hours, and subscription retention metrics."
      badgeText="Insights"
      primaryActionLabel="Export Report"
      primaryActionIcon={Download}
      secondaryActionLabel="Last 30 Days"
      secondaryActionIcon={CalendarRange}
      highlights={HIGHLIGHTS}
    />
  );
}
