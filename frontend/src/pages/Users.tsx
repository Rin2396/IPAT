import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Form,
  Select,
  Modal,
  Input,
  message,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { listUsers, createUser, updateUser, deleteUser } from '../api/users';
import {
  listStudentGroupsAdmin,
  createStudentGroup,
  updateStudentGroup,
  deleteStudentGroup,
  bulkAddStudentsToGroup,
} from '../api/studentGroups';
import { listCompanies } from '../api/companies';
import type { User, UserRole, StudentGroup, Company } from '../types';

const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор' },
  { value: 'college_supervisor', label: 'Руководитель от колледжа' },
  { value: 'company_supervisor', label: 'Руководитель от предприятия' },
  { value: 'student', label: 'Студент' },
] as const;

const ROLE_TABS: { key: UserRole; label: string }[] = [
  { key: 'admin', label: 'Администраторы' },
  { key: 'college_supervisor', label: 'Руководители от колледжа' },
  { key: 'company_supervisor', label: 'Руководители от предприятия' },
  { key: 'student', label: 'Студенты' },
];

function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

export function Users() {
  const [activeRole, setActiveRole] = useState<UserRole>('admin');
  const [rows, setRows] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
  const [groupForm] = Form.useForm();
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkGroup, setBulkGroup] = useState<StudentGroup | null>(null);
  const [bulkForm] = Form.useForm();
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const watchedRole = Form.useWatch('role', form);

  const loadUsers = useCallback(() => {
    setLoading(true);
    listUsers({ role: activeRole })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [activeRole]);

  const loadGroups = useCallback(() => {
    listStudentGroupsAdmin().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    listCompanies().then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    listStudentGroupsAdmin().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    if (groupsModalOpen) loadGroups();
  }, [groupsModalOpen, loadGroups]);

  const handleCreateUser = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, role: activeRole });
    setUserModalOpen(true);
  };

  const handleEditUser = (record: User) => {
    setEditing(record);
    form.setFieldsValue({
      email: record.email,
      full_name: record.full_name,
      role: record.role,
      is_active: record.is_active,
      student_group_id: record.student_group_id ?? undefined,
      company_id: record.company_id ?? undefined,
    });
    setUserModalOpen(true);
  };

  const handleSubmitUser = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        const patch: Parameters<typeof updateUser>[1] = {
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active,
        };
        if (values.role === 'student') {
          patch.student_group_id = values.student_group_id ?? null;
        }
        if (values.role === 'company_supervisor') {
          patch.company_id = values.company_id ?? null;
        }
        await updateUser(editing.id, patch);
        message.success('Пользователь обновлён');
      } else {
        await createUser({
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          role: values.role,
          is_active: values.is_active ?? true,
          student_group_id:
            values.role === 'student' ? values.student_group_id ?? undefined : undefined,
          company_id:
            values.role === 'company_supervisor' ? values.company_id ?? undefined : undefined,
        });
        message.success('Пользователь создан');
      }
      setUserModalOpen(false);
      loadUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDeleteUser = (id: number) => {
    Modal.confirm({
      title: 'Удалить пользователя?',
      onOk: async () => {
        await deleteUser(id);
        message.success('Удалено');
        loadUsers();
      },
    });
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    setGroupModalOpen(true);
  };

  const openEditGroup = (g: StudentGroup) => {
    setEditingGroup(g);
    groupForm.setFieldsValue({ name: g.name });
    setGroupModalOpen(true);
  };

  const submitGroup = async () => {
    const v = await groupForm.validateFields();
    try {
      if (editingGroup) {
        await updateStudentGroup(editingGroup.id, { name: v.name.trim() });
        message.success('Группа обновлена');
      } else {
        await createStudentGroup({ name: v.name.trim() });
        message.success('Группа создана');
      }
      setGroupModalOpen(false);
      loadGroups();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDeleteGroup = (g: StudentGroup) => {
    Modal.confirm({
      title: 'Удалить группу?',
      content: 'Студенты будут отвязаны от группы.',
      onOk: async () => {
        await deleteStudentGroup(g.id);
        message.success('Группа удалена');
        loadGroups();
        if (activeRole === 'student') loadUsers();
      },
    });
  };

  const openBulkAdd = async (g: StudentGroup) => {
    setBulkGroup(g);
    bulkForm.resetFields();
    setBulkModalOpen(true);
    const studs = await listUsers({ role: 'student', limit: 500 });
    setAllStudents(studs);
  };

  const submitBulk = async () => {
    if (!bulkGroup) return;
    const v = await bulkForm.validateFields();
    const ids: number[] = v.user_ids;
    if (!ids?.length) {
      message.warning('Выберите студентов');
      return;
    }
    try {
      await bulkAddStudentsToGroup(bulkGroup.id, ids);
      message.success('Студенты добавлены в группу');
      setBulkModalOpen(false);
      loadGroups();
      loadUsers();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));
  const companyOptions = companies.filter((c) => !c.blocked).map((c) => ({ value: c.id, label: c.name }));

  const columns = [
    { title: 'ФИО', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email (логин)', dataIndex: 'email', key: 'email' },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (r: string) => <Tag>{roleLabel(r)}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Активен' : 'Неактивен'}</Tag>,
    },
    ...(activeRole === 'student'
      ? [
          {
            title: 'Группа',
            key: 'group',
            render: (_: unknown, r: User) => r.student_group?.name ?? <Text type="secondary">—</Text>,
          },
        ]
      : []),
    ...(activeRole === 'company_supervisor'
      ? [
          {
            title: 'Компания',
            key: 'company',
            render: (_: unknown, r: User) =>
              r.supervisor_company?.name ?? <Text type="secondary">—</Text>,
          },
        ]
      : []),
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: User) => (
        <Space>
          <Button size="small" onClick={() => handleEditUser(record)}>
            Изменить
          </Button>
          <Button size="small" danger onClick={() => handleDeleteUser(record.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Пользователи"
      extra={
        <Space>
          <Button icon={<TeamOutlined />} onClick={() => setGroupsModalOpen(true)}>
            Учебные группы
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateUser}>
            Добавить пользователя
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={activeRole}
        onChange={(k) => setActiveRole(k as UserRole)}
        items={ROLE_TABS.map((t) => ({ key: t.key, label: t.label }))}
      />
      <Table loading={loading} dataSource={rows} rowKey="id" columns={columns} pagination={{ pageSize: 20 }} />

      <Modal
        title={editing ? 'Редактировать пользователя' : 'Новый пользователь'}
        open={userModalOpen}
        onOk={handleSubmitUser}
        onCancel={() => setUserModalOpen(false)}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="Пароль" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, whitespace: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
          </Form.Item>
          {watchedRole === 'student' ? (
            <Form.Item name="student_group_id" label="Учебная группа">
              <Select allowClear placeholder="Не выбрана" options={groupOptions} />
            </Form.Item>
          ) : null}
          {watchedRole === 'company_supervisor' ? (
            <Form.Item
              name="company_id"
              label="Компания"
              rules={[{ required: true, message: 'Выберите компанию' }]}
            >
              <Select allowClear placeholder="Компания" options={companyOptions} />
            </Form.Item>
          ) : null}
          {editing ? (
            <Form.Item name="is_active" label="Статус" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: true, label: 'Активен' },
                  { value: false, label: 'Неактивен' },
                ]}
              />
            </Form.Item>
          ) : (
            <Form.Item name="is_active" label="Статус" initialValue={true}>
              <Select
                options={[
                  { value: true, label: 'Активен' },
                  { value: false, label: 'Неактивен' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Учебные группы"
        open={groupsModalOpen}
        onCancel={() => setGroupsModalOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateGroup}>
            Новая группа
          </Button>
        </Space>
        <Table
          rowKey="id"
          dataSource={groups}
          pagination={false}
          columns={[
            { title: 'Название', dataIndex: 'name' },
            {
              title: 'Действия',
              key: 'ga',
              render: (_: unknown, g: StudentGroup) => (
                <Space>
                  <Button size="small" onClick={() => openEditGroup(g)}>
                    Переименовать
                  </Button>
                  <Button size="small" onClick={() => openBulkAdd(g)}>
                    Добавить студентов
                  </Button>
                  <Button size="small" danger onClick={() => handleDeleteGroup(g)}>
                    Удалить
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        title={editingGroup ? 'Редактировать группу' : 'Новая учебная группа'}
        open={groupModalOpen}
        onOk={submitGroup}
        onCancel={() => setGroupModalOpen(false)}
        destroyOnClose
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, whitespace: true }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={bulkGroup ? `Добавить студентов в «${bulkGroup.name}»` : ''}
        open={bulkModalOpen}
        onOk={submitBulk}
        onCancel={() => setBulkModalOpen(false)}
        destroyOnClose
        width={560}
      >
        <Form form={bulkForm} layout="vertical">
          <Form.Item
            name="user_ids"
            label="Студенты"
            rules={[{ required: true, message: 'Выберите хотя бы одного студента' }]}
          >
            <Select
              mode="multiple"
              placeholder="Выберите студентов"
              optionFilterProp="label"
              options={allStudents.map((u) => ({
                value: u.id,
                label: `${u.full_name} (${u.email})${u.student_group ? ` — ${u.student_group.name}` : ''}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
