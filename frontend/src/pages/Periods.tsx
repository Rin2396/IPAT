import { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Form, Input, DatePicker, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listPeriods, createPeriod, updatePeriod, deletePeriod } from '../api/periods';
import type { Period } from '../types';
import dayjs from 'dayjs';

export function Periods() {
  const [data, setData] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    listPeriods().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Period) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      start_date: dayjs(record.start_date),
      end_date: dayjs(record.end_date),
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      const payload = {
        name: values.name,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
        is_active: values.is_active ?? true,
      };
      if (editing) {
        await updatePeriod(editing.id, payload);
        message.success('Период обновлён');
      } else {
        await createPeriod(payload);
        message.success('Период создан');
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Удалить период?',
      onOk: async () => {
        await deletePeriod(id);
        message.success('Удалено');
        load();
      },
    });
  };

  return (
    <Card
      title="Периоды практики"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Добавить
        </Button>
      }
    >
      <Table
        loading={loading}
        dataSource={data}
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Название', dataIndex: 'name' },
          { title: 'Начало', dataIndex: 'start_date' },
          { title: 'Конец', dataIndex: 'end_date' },
          { title: 'Активен', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Да' : 'Нет') },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record: Period) => (
              <>
                <Button size="small" onClick={() => handleEdit(record)}>Изменить</Button>
                <Button size="small" danger onClick={() => handleDelete(record.id)}>Удалить</Button>
              </>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать период' : 'Новый период'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="start_date" label="Дата начала" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_date" label="Дата окончания" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
