import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  message,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listPeriods, createPeriod, updatePeriod, deletePeriod } from '../api/periods';
import type { Period } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

type PeriodTab = 'all' | 'active' | 'inactive';

const PERIOD_TABS: { key: PeriodTab; label: string }[] = [
  { key: 'all', label: 'Все периоды' },
  { key: 'active', label: 'Активные' },
  { key: 'inactive', label: 'Неактивные' },
];

export function Periods() {
  const [data, setData] = useState<Period[]>([]);
  const [activeTab, setActiveTab] = useState<PeriodTab>('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Period | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    const params =
      activeTab === 'all' ? undefined : activeTab === 'active' ? { is_active: true } : { is_active: false };
    listPeriods(params)
      .then(setData)
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
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

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Начало', dataIndex: 'start_date', key: 'start_date', width: 130 },
    { title: 'Конец', dataIndex: 'end_date', key: 'end_date', width: 130 },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 140,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Активен' : 'Неактивен'}</Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: Period) => (
        <Space wrap size="small">
          <Button size="small" onClick={() => handleEdit(record)}>
            Изменить
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Периоды практики"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Добавить период
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as PeriodTab)}
        items={PERIOD_TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <Table
        loading={loading}
        dataSource={data}
        rowKey="id"
        columns={columns}
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        locale={{ emptyText: <Text type="secondary">Нет периодов в этой категории</Text> }}
      />

      <Modal
        title={editing ? 'Редактировать период' : 'Новый период'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true }]}>
            <Input placeholder="Например, Весна 2026" />
          </Form.Item>
          <Form.Item name="start_date" label="Дата начала" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="end_date" label="Дата окончания" rules={[{ required: true, message: 'Укажите дату' }]}>
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
