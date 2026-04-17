import { cn } from '@/utils/cn';

const colorMap: Record<string, string> = {
  // Lead stages
  New: 'bg-blue-100 text-blue-800',
  'OEM Submitted': 'bg-yellow-100 text-yellow-800',
  'OEM Approved': 'bg-green-100 text-green-800',
  'OEM Rejected': 'bg-red-100 text-red-800',
  'OEM Expired': 'bg-gray-100 text-gray-600',
  'Technical Done': 'bg-cyan-100 text-cyan-800',
  'Quotation Sent': 'bg-indigo-100 text-indigo-800',
  Negotiation: 'bg-orange-100 text-orange-800',
  'PO Received': 'bg-purple-100 text-purple-800',
  Converted: 'bg-green-200 text-green-900',
  Lost: 'bg-red-200 text-red-900',
  // OEM
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Expired: 'bg-gray-100 text-gray-600',
  // Invoice
  Unpaid: 'bg-yellow-100 text-yellow-800',
  'Partially Paid': 'bg-orange-100 text-orange-800',
  Paid: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800',
  Cancelled: 'bg-gray-100 text-gray-600',
  // Support
  Open: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Resolved: 'bg-green-100 text-green-800',
  Closed: 'bg-gray-100 text-gray-600',
  // Priority
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-yellow-100 text-yellow-800',
  High: 'bg-orange-100 text-orange-800',
  Critical: 'bg-red-100 text-red-800',
  // HR Status
  'HR Pending': 'bg-yellow-100 text-yellow-800',
  // Generic
  Active: 'bg-green-100 text-green-800',
  Inactive: 'bg-gray-100 text-gray-600',
  Scheduled: 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  Calculated: 'bg-indigo-100 text-indigo-800',
};

interface Props {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  const color = colorMap[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={cn('badge', color, className)}>{status}</span>
  );
}
