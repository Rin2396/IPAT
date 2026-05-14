import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined, CheckOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import {
  listCompanies,
  createCompany,
  updateCompany,
  verifyCompany,
  blockCompany,
  unblockCompany,
} from '../api/companies';
import type { Company } from '../types';

const { Text } = Typography;

type CompanyTab = 'all' | 'pending' | 'verified' | 'blocked';

const COMPANY_TABS: { key: CompanyTab; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'pending', label: 'Ожидают подтверждения' },
  { key: 'verified', label: 'Подтверждённые' },
  { key: 'blocked', label: 'Заблокированные' },
];

function statusTags(record: Company) {
  if (record.blocked) {
    return <Tag color="red">Заблокирована</Tag>;
  }
  if (record.verified) {
    return <Tag color="green">Подтверждена</Tag>;
  }
  return <Tag color="orange">Ожидает подтверждения</Tag>;
}

export function Companies() {
  const [data, setData] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<CompanyTab>('all');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(() => {
    setLoading(true);
    listCompanies()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'pending':
        return data.filter((c) => !c.verified && !c.blocked);
      case 'verified':
        return data.filter((c) => c.verified && !c.blocked);
      case 'blocked':
        return data.filter((c) => c.blocked);
      default:
        return data;
    }
  }, [data, activeTab]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Company) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      inn: record.inn ?? '',
      description: record.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateCompany(editing.id, {
          name: values.name,
          inn: values.inn || undefined,
          description: values.description || undefined,
        });
        message.success('Компания обновлена');
      } else {
        await createCompany({
          name: values.name,
          inn: values.inn || undefined,
          description: values.description || undefined,
        });
        message.success('Компания создана');
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleVerify = (id: number) => {
    verifyCompany(id)
      .then(() => {
        message.success('Компания подтверждена');
        load();
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { detail?: string } } };
        message.error(err.response?.data?.detail ?? 'Ошибка');
      });
  };

  const handleBlock = (id: number) => {
    Modal.confirm({
      title: 'Заблокировать компанию?',
      onOk: () =>
        blockCompany(id).then(() => {
          message.success('Компания заблокирована');
          load();
        }),
    });
  };

  const handleUnblock = (id: number) => {
    Modal.confirm({
      title: 'Разблокировать компанию?',
      onOk: () =>
        unblockCompany(id).then(() => {
          message.success('Компания разблокирована');
          load();
        }),
    });
  };

  const columns = [
    { title: 'Название', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'ИНН',
      dataIndex: 'inn',
      key: 'inn',
      width: 140,
      render: (inn: string | null) => (inn ? inn : <Text type="secondary">—</Text>),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (d: string | null) =>
        d ? <Text ellipsis={{ tooltip: d }}>{d}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Статус',
      key: 'status',
      width: 200,
      render: (_: unknown, r: Company) => statusTags(r),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 320,
      render: (_: unknown, record: Company) => (
        <Space wrap size="small">
          <Button size="small" onClick={() => handleEdit(record)}>
            Изменить
          </Button>
          {!record.verified && !record.blocked && (
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleVerify(record.id)}>
              Подтвердить
            </Button>
          )}
          {!record.blocked && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => handleBlock(record.id)}>
              Заблокировать
            </Button>
          )}
          {record.blocked && (
            <Button size="small" type="primary" icon={<UnlockOutlined />} onClick={() => handleUnblock(record.id)}>
              Разблокировать
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Компании"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Добавить компанию
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as CompanyTab)}
        items={COMPANY_TABS.map((t) => ({
          key: t.key,
          label: t.label,
        }))}
      />
      <Table
        loading={loading}
        dataSource={filtered}
        rowKey="id"
        columns={columns}
        pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        locale={{ emptyText: <Text type="secondary">Нет компаний в этой категории</Text> }}
      />

      <Modal
        title={editing ? 'Редактировать компанию' : 'Новая компания'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="inn" label="ИНН">
            <Input placeholder="Необязательно" />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={4} placeholder="Краткое описание организации" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
