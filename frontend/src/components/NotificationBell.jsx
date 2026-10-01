import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronRight, Clock3 } from 'lucide-react';
import api from '../api';

function timeAgo(value) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.items || []);
      setUnread(data.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30000);
    const handler = () => load();
    window.addEventListener('smartlor:notifications-refresh', handler);
    return () => { window.clearInterval(interval); window.removeEventListener('smartlor:notifications-refresh', handler); };
  }, []);

  useEffect(() => {
    const onClick = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const refreshNotificationSurfaces = () => {
    window.dispatchEvent(new Event('smartlor:notifications-refresh'));
  };

  const markRead = async (item) => {
    try {
      await api.patch(`/notifications/${item._id}/read`);
      setItems(prev => prev.filter(n => n._id !== item._id));
      setUnread(prev => Math.max(0, prev - 1));
      refreshNotificationSurfaces();
    } catch {
      return;
    }
    if (item.link) { setOpen(false); navigate(item.link); }
  };

  const markAll = async () => {
    if (!unread) return;
    try {
      await api.patch('/notifications/read-all');
      setItems([]);
      setUnread(0);
      refreshNotificationSurfaces();
    } catch {}
  };

  return <div className="notification-wrap" ref={ref}>
    <button className={`notification-button ${unread ? 'has-unread' : ''}`} onClick={() => setOpen(v => !v)} aria-label="Notifications" aria-expanded={open}>
      <Bell size={19}/>{unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div className="notification-popover">
      <div className="notification-head"><div><strong>Notifications</strong><span>{unread ? `${unread} unread update${unread === 1 ? '' : 's'}` : 'You’re all caught up'}</span></div><button className="icon-btn" title="Mark all as read" onClick={markAll}><CheckCheck size={16}/></button></div>
      <div className="notification-list">
        {items.length ? items.map(item => <button key={item._id} className={`notification-item ${!item.readAt ? 'unread' : ''}`} onClick={() => markRead(item)}>
          <span className={`notification-dot ${item.type}`} />
          <span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small><Clock3 size={11}/> {timeAgo(item.createdAt)}</small></span>
          <ChevronRight size={15} className="notification-arrow"/>
        </button>) : <div className="notification-empty"><Check size={20}/><strong>No new notifications</strong><span>Request updates and workflow events will appear here.</span></div>}
      </div>
      {items.length > 0 && <div className="notification-footer">Unread updates disappear after you open them or mark them as read.</div>}
    </div>}
  </div>;
}
