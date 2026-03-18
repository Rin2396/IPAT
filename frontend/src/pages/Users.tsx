import { useState, useEffect } from 'react';
import { Table, Button, Card, Space, Form, Select, Modal, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listUsers, createUser, updateUser, deleteUser } from '../api/users';
import type { User } from '../types';

const ROLES = [
  { value: 'admin', label: 'Администратор' },
  { value: 'student', label: 'Студент' },
  { value: 'college_supervisor', label: 'Руководитель от колледжа' },
  { value: 'company_supervisor', label: 'Руководитель от компании' },
];

export function Users() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [roleFilter, setRoleFilter] = useState<string | undefined>();

  const load = () => {
    setLoading(true);
    listUsers({ role: roleFilter }).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [roleFilter]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: User) => {
    setEditing(record);
    form.setFieldsValue({
      email: record.email,
      full_name: record.full_name,
      role: record.role,
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateUser(editing.id, {
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active,
        });
        message.success('Пользователь обновлён');
      } else {
        await createUser({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active ?? true,
        });
        message.success('Пользователь создан');
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
      title: 'Удалить пользователя?',
      onOk: async () => {
        await deleteUser(id);
        message.success('Удалено');
        load();
      },
    });
  };

  return (
    <Card
      title="Пользователи"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Добавить
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Роль"
          allowClear
          style={{ width: 200 }}
          value={roleFilter}
          onChange={setRoleFilter}
          options={ROLES}
        />
      </Space>
      <Table
        loading={loading}
        dataSource={data}
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Email', dataIndex: 'email' },
          { title: 'ФИО', dataIndex: 'full_name' },
          {
            title: 'Роль',
            dataIndex: 'role',
            render: (r: string) => ROLES.find((o) => o.value === r)?.label ?? r,
          },
          { title: 'Активен', dataIndex: 'is_active', render: (v: boolean) => (v ? 'Да' : 'Нет') },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record) => (
              <Space>
                <Button size="small" onClick={() => handleEdit(record)}>Изменить</Button>
                <Button size="small" danger onClick={() => handleDelete(record.id)}>Удалить</Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать пользователя' : 'Новый пользователь'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="Пароль" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={ROLES} />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Активен">
              <Select options={[{ value: true, label: 'Да' }, { value: false, label: 'Нет' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
