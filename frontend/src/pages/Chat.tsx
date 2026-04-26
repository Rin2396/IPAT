import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Input, List, Space, Typography, message as toast } from 'antd';
import { ArrowLeftOutlined, SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { getOrCreateChatThread, listChatMessages, listChatMessagesSince, markChatRead, sendChatMessage, getChatUnreadCount } from '../api/chat';
import { useAuthStore } from '../stores/authStore';
import type { ChatMessage } from '../types';

const { Text } = Typography;

type UiMessage = ChatMessage & { _pending?: boolean };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  student: 'Студент',
  college_supervisor: 'Руководитель (колледж)',
  company_supervisor: 'Руководитель (компания)',
};

function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
}

export function Chat() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const visible = usePageVisible();

  const assignmentIdNum = assignmentId ? parseInt(assignmentId, 10) : 0;

  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);

  const listRef = useRef<HTMLDivElement | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  const lastId = useMemo(() => {
    const ids = messages.map((m) => m.id).filter((id) => id > 0);
    return ids.length ? Math.max(...ids) : 0;
  }, [messages]);

  const firstId = useMemo(() => {
    const ids = messages.map((m) => m.id).filter((id) => id > 0);
    return ids.length ? Math.min(...ids) : null;
  }, [messages]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const refreshUnread = async () => {
    if (!assignmentIdNum) return;
    try {
      const r = await getChatUnreadCount(assignmentIdNum);
      setUnread(r.unread);
    } catch {
      // ignore
    }
  };

  const loadLatest = async () => {
    if (!assignmentIdNum) return;
    setLoading(true);
    try {
      const thread = await getOrCreateChatThread(assignmentIdNum);
      setThreadId(thread.id);
      const items = await listChatMessages(thread.id, { limit: 50 });
      // backend returns newest-first for paging; reverse for display ascending
      const asc = [...items].reverse();
      setMessages(asc);
      await refreshUnread();
      // mark read to last message we loaded
      const last = asc.length ? asc[asc.length - 1].id : undefined;
      if (last && last > 0) await markChatRead(thread.id, last);
      setUnread(0);
      requestAnimationFrame(scrollToBottom);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? 'Ошибка загрузки чата');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreUp = async () => {
    if (!threadId || !firstId) return;
    try {
      const el = listRef.current;
      const prevHeight = el?.scrollHeight ?? 0;
      const items = await listChatMessages(threadId, { before_id: firstId, limit: 50 });
      const asc = [...items].reverse();
      setMessages((cur) => [...asc, ...cur]);
      requestAnimationFrame(() => {
        const el2 = listRef.current;
        if (!el2) return;
        const newHeight = el2.scrollHeight;
        el2.scrollTop = newHeight - prevHeight + (el?.scrollTop ?? 0);
      });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail ?? 'Ошибка загрузки истории');
    }
  };

  const pollNew = async () => {
    if (!threadId) return;
    try {
      const items = await listChatMessagesSince(threadId, lastId);
      if (!items.length) return;
      setMessages((cur) => [...cur, ...items]);
      if (stickToBottom) {
        requestAnimationFrame(scrollToBottom);
        const last = items[items.length - 1]?.id;
        if (last) await markChatRead(threadId, last);
        setUnread(0);
      } else {
        await refreshUnread();
      }
    } catch {
      // ignore transient polling errors
    }
  };

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentIdNum]);

  useEffect(() => {
    if (!threadId) return;
    if (!visible) return;
    const t = setInterval(pollNew, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, visible, lastId, stickToBottom]);

  useEffect(() => {
    // lightweight unread refresh when user is on page but not sticking to bottom
    if (!threadId) return;
    const t = setInterval(() => {
      if (!stickToBottom) refreshUnread();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, stickToBottom]);

  if (!assignmentIdNum) {
    return (
      <Card>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>
          К назначениям
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <span>Чат по назначению #{assignmentIdNum}</span>
          <Badge count={unread} size="small" />
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/assignments`)}>
            Назад
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadLatest} disabled={loading}>
            Обновить
          </Button>
          <Button
            onClick={async () => {
              if (threadId && lastId > 0) {
                await markChatRead(threadId, lastId);
                setUnread(0);
                toast.success('Помечено как прочитанное');
              }
            }}
            disabled={!threadId || lastId <= 0}
          >
            Пометить прочитанным
          </Button>
        </Space>
      }
    >
      <div
        ref={listRef}
        style={{ height: 420, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          setStickToBottom(nearBottom);
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
          <Button size="small" onClick={loadMoreUp} disabled={!firstId || loading}>
            Загрузить ещё
          </Button>
        </Space>
        <List
          dataSource={messages}
          loading={loading}
          renderItem={(m) => {
            const mine = user?.id === m.author_id;
            const name = mine ? 'Вы' : (m.author?.full_name ?? `Пользователь #${m.author_id}`);
            const role = !mine ? (m.author?.role ? (ROLE_LABELS[m.author.role] ?? m.author.role) : null) : null;
            return (
              <List.Item style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: 560,
                    background: mine ? '#e6f4ff' : '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 10,
                    padding: '8px 12px',
                    opacity: m._pending ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <Text strong>
                      {name}
                      {role ? <Text type="secondary"> ({role})</Text> : null}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(m.created_at).toLocaleString()}
                    </Text>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 4 }}>{m.body}</div>
                </div>
              </List.Item>
            );
          }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <Space style={{ width: '100%' }} align="start">
          <Input.TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder="Введите сообщение..."
            onPressEnter={(e) => {
              if (e.shiftKey) return;
              e.preventDefault();
              if (!sending) {
                void (async () => {
                  if (!threadId) return;
                  const body = text.trim();
                  if (!body) return;
                  setText('');
                  setSending(true);
                  const tempId = -Date.now();
                  const temp: UiMessage = {
                    id: tempId,
                    thread_id: threadId,
                    author_id: user?.id ?? 0,
                    author: user ? { id: user.id, full_name: user.full_name, role: user.role } : undefined,
                    body,
                    created_at: new Date().toISOString(),
                    _pending: true,
                  };
                  setMessages((cur) => [...cur, temp]);
                  requestAnimationFrame(scrollToBottom);
                  try {
                    const saved = await sendChatMessage(threadId, body);
                    setMessages((cur) => cur.map((m) => (m.id === tempId ? saved : m)));
                    await markChatRead(threadId, saved.id);
                    setUnread(0);
                  } catch (err: unknown) {
                    setMessages((cur) => cur.filter((m) => m.id !== tempId));
                    const e2 = err as { response?: { data?: { detail?: string } } };
                    toast.error(e2.response?.data?.detail ?? 'Ошибка отправки');
                    setText(body);
                  } finally {
                    setSending(false);
                  }
                })();
              }
            }}
            disabled={!threadId}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            disabled={!threadId || !text.trim()}
            onClick={async () => {
              if (!threadId) return;
              const body = text.trim();
              if (!body) return;
              setText('');
              setSending(true);
              const tempId = -Date.now();
              const temp: UiMessage = {
                id: tempId,
                thread_id: threadId,
                author_id: user?.id ?? 0,
                author: user ? { id: user.id, full_name: user.full_name, role: user.role } : undefined,
                body,
                created_at: new Date().toISOString(),
                _pending: true,
              };
              setMessages((cur) => [...cur, temp]);
              requestAnimationFrame(scrollToBottom);
              try {
                const saved = await sendChatMessage(threadId, body);
                setMessages((cur) => cur.map((m) => (m.id === tempId ? saved : m)));
                await markChatRead(threadId, saved.id);
                setUnread(0);
              } catch (err: unknown) {
                setMessages((cur) => cur.filter((m) => m.id !== tempId));
                const e2 = err as { response?: { data?: { detail?: string } } };
                toast.error(e2.response?.data?.detail ?? 'Ошибка отправки');
                setText(body);
              } finally {
                setSending(false);
              }
            }}
          >
            Отправить
          </Button>
        </Space>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          Enter — отправить, Shift+Enter — новая строка.
        </div>
      </div>
    </Card>
  );
}

