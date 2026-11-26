import { CreditCard, FileSpreadsheet, Plus, Receipt, Wallet } from 'lucide-react';
import AdminSectionStub from '../../components/ui/AdminSectionStub';

const HIGHLIGHTS = [
  {
    title: 'Subscription Invoices',
    description: 'Record Monthly, Quarterly, and Annual membership payments with receipt tracking.',
    icon: Receipt,
  },
  {
    title: 'Pending Balances',
    description: 'Track partial payments and automatically surface due balances during check-in.',
    icon: Wallet,
  },
  {
    title: 'Payment Modes',
    description: 'Categorize collections across UPI, card, cash, and bank transfer.',
    icon: CreditCard,
  },
];

/**
 * Payments & dues skeleton route (/admin/payments).
 */
export default function Payments() {
  return (
    <AdminSectionStub
      title="Payments"
      description="Track membership fee collections, pending balances, and renewal receipts."
      badgeText="Billing"
      primaryActionLabel="Record Payment"
      primaryActionIcon={Plus}
      secondaryActionLabel="Export CSV"
      secondaryActionIcon={FileSpreadsheet}
      highlights={HIGHLIGHTS}
    />
  );
}
