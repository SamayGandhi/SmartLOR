import { FileSearch } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', text = 'There are no records to show.' }) {
  return <div className="empty-state"><div className="empty-icon"><FileSearch size={24} /></div><h3>{title}</h3><p>{text}</p></div>;
}
