const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
export default function StatusBadge({ status }) { return <span className={`badge badge-${status}`}>{labels[status] || status}</span>; }
