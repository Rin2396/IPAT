import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, List, Button, Tag, Spin, Space, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { listTasks } from '../api/tasks';
import { getAssignment } from '../api/assignments';
import type { Task, Assignment } from '../types';

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнено',
  accepted: 'Принято',
};

export function Diary() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const assignmentIdNum = assignmentId ? parseInt(assignmentId, 10) : 0;

  useEffect(() => {
    if (!assignmentIdNum) return;
    setLoading(true);
    Promise.all([listTasks(assignmentIdNum), getAssignment(assignmentIdNum)])
      .then(([t, a]) => {
        setTasks(t);
        setAssignment(a);
      })
      .catch(() => message.error('Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, [assignmentIdNum]);

  if (!assignmentIdNum) {
    return (
      <Card>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>
          К назначениям
        </Button>
      </Card>
    );
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;

  return (
    <Card
      title="Дневник практики"
      extra={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>
            Назад
          </Button>
          <Button type="primary" onClick={() => navigate(`/assignments/${assignmentIdNum}/tasks`)}>
            Управление задачами
          </Button>
        </Space>
      }
    >
      {assignment && (
        <p style={{ marginBottom: 16, color: '#666' }}>
          Назначение #{assignment.id}, статус: {assignment.status}
        </p>
      )}
      <List
        dataSource={tasks}
        rowKey="id"
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space>
                  <span>{item.title}</span>
                  <Tag color={item.status === 'accepted' ? 'green' : item.status === 'done' ? 'blue' : 'default'}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Tag>
                </Space>
              }
              description={item.description}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
