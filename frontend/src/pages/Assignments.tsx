import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Card, Space, Modal, Form, Select, Badge, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listAssignments, createAssignment, updateAssignment, updateAssignmentGrade } from '../api/assignments';
import { listPeriods as fetchPeriods } from '../api/periods';
import { listUsers as fetchUsers } from '../api/users';
import { listCompanies as fetchCompanies } from '../api/companies';
import { getChatUnreadCounts } from '../api/chat';
import { useAuthStore } from '../stores/authStore';
import type { Assignment, Period, User, Company } from '../types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активна',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

const GRADE_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));

function formatPeriodLabel(periods: Period[], periodId: number): string {
  const p = periods.find((x) => x.id === periodId);
  if (!p) return String(periodId);
  return `${p.name} (${p.start_date} — ${p.end_date})`;
}

function AssignmentGradeCell({
  record,
  supervisorUserId,
  onSaved,
}: {
  record: Assignment;
  supervisorUserId: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState<number | undefined>(record.college_grade ?? undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(record.college_grade ?? undefined);
  }, [record.college_grade, record.id]);

  const canEdit =
    record.status === 'completed' && record.college_supervisor_id === supervisorUserId;

  if (canEdit) {
    return (
      <Space wrap size="small">
        <Select
          allowClear
          placeholder="1–10"
          style={{ width: 88 }}
          value={value}
          onChange={(v) => setValue(v ?? undefined)}
          options={GRADE_OPTIONS}
        />
        <Button
          size="small"
          type="primary"
          loading={saving}
          disabled={value == null}
          onClick={async () => {
            if (value == null) return;
            setSaving(true);
            try {
              await updateAssignmentGrade(record.id, value);
              message.success('Оценка сохранена');
              onSaved();
            } catch (e: unknown) {
              const err = e as { response?: { data?: { detail?: string } } };
              message.error(err.response?.data?.detail ?? 'Ошибка');
            } finally {
              setSaving(false);
            }
          }}
        >
          Сохранить
        </Button>
      </Space>
    );
  }

  if (record.college_grade != null) {
    return <span>{record.college_grade}</span>;
  }
  return <span>—</span>;
}

export function Assignments() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const isCollegeSupervisor = user?.role === 'college_supervisor';

  const [data, setData] = useState<Assignment[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form] = Form.useForm();
  const [chatUnread, setChatUnread] = useState<Record<number, number>>({});

  const load = () => {
    setLoading(true);
    listAssignments().then(setData).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchPeriods().then(setPeriods);
    fetchUsers().then(setUsers);
    fetchCompanies().then(setCompanies);
    const loadUnread = () => {
      getChatUnreadCounts()
        .then((rows) => {
          const map: Record<number, number> = {};
          for (const r of rows) map[r.assignment_id] = r.unread;
          setChatUnread(map);
        })
        .catch(() => {});
    };
    loadUnread();
    const t = setInterval(loadUnread, 60000);
    return () => clearInterval(t);
  }, []);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Assignment) => {
    setEditing(record);
    form.setFieldsValue({
      student_id: record.student_id,
      company_id: record.company_id,
      period_id: record.period_id,
      college_supervisor_id: record.college_supervisor_id ?? undefined,
      company_supervisor_id: record.company_supervisor_id ?? undefined,
      status: record.status,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateAssignment(editing.id, {
          college_supervisor_id: values.college_supervisor_id ?? null,
          company_supervisor_id: values.company_supervisor_id ?? null,
          status: values.status,
        });
        message.success('Назначение обновлено');
      } else {
        await createAssignment({
          student_id: values.student_id,
          company_id: values.company_id,
          period_id: values.period_id,
          college_supervisor_id: values.college_supervisor_id,
          company_supervisor_id: values.company_supervisor_id,
        });
        message.success('Назначение создано');
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const studentOptions = users.filter((u) => u.role === 'student').map((u) => ({ value: u.id, label: u.full_name }));
  const supervisorOptions = users
    .filter((u) => u.role === 'college_supervisor' || u.role === 'company_supervisor')
    .map((u) => ({ value: u.id, label: `${u.full_name} (${u.role})` }));
  const periodOptions = periods.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.start_date} — ${p.end_date})`,
  }));
  const companyOptions = companies.filter((c) => !c.blocked).map((c) => ({ value: c.id, label: c.name }));

  return (
    <Card
      title="Назначения"
      extra={
        isAdmin ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Добавить
          </Button>
        ) : null
      }
    >
      <Table
        loading={loading}
        dataSource={data}
        rowKey="id"
        columns={[
          {
            title: 'Студент',
            dataIndex: 'student_id',
            render: (id: number, record: Assignment) =>
              record.student?.full_name ?? users.find((u) => u.id === id)?.full_name ?? id,
          },
          {
            title: 'Компания',
            dataIndex: 'company_id',
            render: (id: number) => companies.find((c) => c.id === id)?.name ?? id,
          },
          {
            title: 'Период',
            dataIndex: 'period_id',
            render: (id: number) => formatPeriodLabel(periods, id),
          },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (s: string) => STATUS_LABELS[s] ?? s,
          },
          ...(isCollegeSupervisor && user
            ? [
                {
                  title: 'Оценка',
                  key: 'grade',
                  width: 220,
                  render: (_: unknown, record: Assignment) => (
                    <AssignmentGradeCell
                      record={record}
                      supervisorUserId={user.id}
                      onSaved={load}
                    />
                  ),
                },
              ]
            : [
                {
                  title: 'Оценка',
                  dataIndex: 'college_grade',
                  width: 100,
                  render: (g: number | null | undefined) =>
                    g != null ? <span>{g}</span> : <span>—</span>,
                },
              ]),
          {
            title: 'Действия',
            key: 'actions',
            render: (_: unknown, record: Assignment) => (
              <Space>
                {isAdmin ? (
                  <Button size="small" onClick={() => handleEdit(record)}>
                    Изменить
                  </Button>
                ) : null}
                <Button size="small" type="link" onClick={() => navigate(`/assignments/${record.id}/tasks`)}>
                  Задачи
                </Button>
                <Button size="small" type="link" onClick={() => navigate(`/assignments/${record.id}/diary`)}>
                  Дневник
                </Button>
                <Button size="small" type="link" onClick={() => navigate(`/assignments/${record.id}/reports`)}>
                  Отчёты
                </Button>
                <Badge count={chatUnread[record.id] ?? 0} size="small" offset={[6, -2]}>
                  <Button size="small" type="link" onClick={() => navigate(`/assignments/${record.id}/chat`)}>
                    Чат
                  </Button>
                </Badge>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? 'Редактировать назначение' : 'Новое назначение'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Студент" rules={[{ required: !editing }]}>
            <Select options={studentOptions} disabled={!!editing} placeholder="Выберите студента" />
          </Form.Item>
          <Form.Item name="company_id" label="Компания" rules={[{ required: true }]}>
            <Select options={companyOptions} disabled={!!editing} placeholder="Выберите компанию" />
          </Form.Item>
          <Form.Item name="period_id" label="Период" rules={[{ required: true }]}>
            <Select options={periodOptions} disabled={!!editing} placeholder="Выберите период" />
          </Form.Item>
          <Form.Item name="college_supervisor_id" label="Руководитель от колледжа">
            <Select allowClear options={supervisorOptions} placeholder="Опционально" />
          </Form.Item>
          <Form.Item name="company_supervisor_id" label="Руководитель от компании">
            <Select allowClear options={supervisorOptions} placeholder="Опционально" />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="Статус">
              <Select
                options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
