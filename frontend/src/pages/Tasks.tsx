import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Card, Space, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { listTasks, createTask, updateTask, deleteTask } from '../api/tasks';
import type { Task } from '../types';

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнено',
  accepted: 'Принято',
};

function statusOption(value: string) {
  return { value, label: STATUS_LABELS[value] ?? value };
}

export function Tasks() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const assignmentIdNum = assignmentId ? parseInt(assignmentId, 10) : 0;

  const load = () => {
    if (!assignmentIdNum) return;
    setLoading(true);
    listTasks(assignmentIdNum).then(setTasks).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [assignmentIdNum]);

  const handleCreate = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      await createTask(assignmentIdNum, {
        title: values.title,
        description: values.description,
        order: values.order,
      });
      message.success('Задача создана');
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    try {
      await updateTask(task.id, { status: newStatus });
      message.success('Статус обновлён');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Удалить задачу?',
      onOk: async () => {
        await deleteTask(id);
        message.success('Удалено');
        load();
      },
    });
  };

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
      title="Задачи назначения"
      extra={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>
            Назад
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Добавить задачу
          </Button>
        </Space>
      }
    >
      <Table
        loading={loading}
        dataSource={tasks}
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Название', dataIndex: 'title' },
          { title: 'Описание', dataIndex: 'description', ellipsis: true },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (status: string, record: Task) => {
              const allowed = record.allowed_transitions ?? [];
              if (!allowed.length) {
                return STATUS_LABELS[status] ?? status;
              }
              const options = [status, ...allowed].filter((v, i, arr) => arr.indexOf(v) === i).map(statusOption);
              return (
                <Select
                  value={status}
                  options={options}
                  onChange={(v) => handleStatusChange(record, v)}
                  style={{ width: 180 }}
                />
              );
            },
          },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record: Task) => (
              <Button size="small" danger onClick={() => handleDelete(record.id)}>
                Удалить
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="Новая задача"
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="order" label="Порядок" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
