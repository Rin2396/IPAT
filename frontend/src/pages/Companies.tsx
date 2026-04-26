import { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, CheckOutlined, StopOutlined } from '@ant-design/icons';
import { listCompanies, createCompany, updateCompany, verifyCompany, blockCompany, unblockCompany } from '../api/companies';
import type { Company } from '../types';

export function Companies() {
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    listCompanies().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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
    verifyCompany(id).then(() => {
      message.success('Компания подтверждена');
      load();
    }).catch((e: unknown) => {
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

  return (
    <Card
      title="Компании"
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
          { title: 'Название', dataIndex: 'name' },
          { title: 'ИНН', dataIndex: 'inn' },
          {
            title: 'Статус',
            key: 'status',
            render: (_, r: Company) => (
              <>
                {r.verified && <span style={{ color: 'green' }}>Подтверждена </span>}
                {r.blocked && <span style={{ color: 'red' }}>Заблокирована</span>}
                {!r.verified && !r.blocked && <span>Ожидает</span>}
              </>
            ),
          },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record: Company) => (
              <Space>
                <Button size="small" onClick={() => handleEdit(record)}>Изменить</Button>
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
                  <Button size="small" type="primary" onClick={() => handleUnblock(record.id)}>
                    Разблокировать
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать компанию' : 'Новая компания'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="inn" label="ИНН">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
