import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Card, Space, Upload, Select, message } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { listReports, uploadReport, updateReportStatus, downloadReport, deleteReport } from '../api/reports';
import type { Report } from '../types';
import { useAuthStore } from '../stores/authStore';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  submitted: 'Ожидает проверки',
  under_review: 'На рассмотрении',
  approved: 'Утверждён',
  revision_requested: 'На доработку',
};

export function Reports() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const assignmentIdNum = assignmentId ? parseInt(assignmentId, 10) : 0;
  const canReview = user?.role === 'admin' || user?.role === 'college_supervisor' || user?.role === 'company_supervisor';

  const canTransition = (report: Report, status: string) => (report.allowed_transitions ?? []).includes(status as any);

  const statusOption = (value: string) => ({ value, label: STATUS_LABELS[value] ?? value });

  const load = () => {
    if (!assignmentIdNum) return;
    setLoading(true);
    listReports(assignmentIdNum).then(setReports).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [assignmentIdNum]);

  const handleUpload = (file: File) => {
    if (!assignmentIdNum) return;
    uploadReport(assignmentIdNum, file)
      .then(() => {
        message.success('Отчёт загружен');
        load();
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { detail?: string } } };
        message.error(err.response?.data?.detail ?? 'Ошибка загрузки');
      });
    return false;
  };

  const handleStatusChange = async (report: Report, newStatus: string) => {
    try {
      await updateReportStatus(report.id, newStatus);
      message.success('Статус обновлён');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка');
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      const { blob, filename } = await downloadReport(report.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `report-${report.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка скачивания');
    }
  };

  const handleDelete = async (report: Report) => {
    try {
      await deleteReport(report.id);
      message.success('Отчёт удалён');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail ?? 'Ошибка удаления');
    }
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
      title="Отчёты по назначению"
      extra={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/assignments')}>
            Назад
          </Button>
          {(user?.role === 'student' || user?.role === 'admin') && (
            <Upload beforeUpload={handleUpload} showUploadList accept=".pdf,.doc,.docx" maxCount={1}>
              <Button type="primary" icon={<UploadOutlined />}>
                Загрузить отчёт
              </Button>
            </Upload>
          )}
        </Space>
      }
    >
      <Table
        loading={loading}
        dataSource={reports}
        rowKey="id"
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: 'Итерация', dataIndex: 'iteration', width: 100 },
          { title: 'Файл', dataIndex: 'file_key', ellipsis: true },
          {
            title: 'Статус',
            dataIndex: 'status',
            render: (status: string, record: Report) => {
              const allowed = record.allowed_transitions ?? [];
              if (!canReview || !allowed.length) {
                return STATUS_LABELS[status] ?? status;
              }
              const options = [status, ...allowed].filter((v, i, arr) => arr.indexOf(v) === i).map(statusOption);
              return (
                <Select
                  value={status}
                  options={options}
                  onChange={(v) => handleStatusChange(record, v)}
                  style={{ width: 200 }}
                />
              );
            },
          },
          { title: 'Дата загрузки', dataIndex: 'uploaded_at', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record: Report) => (
              <Space>
                <Button size="small" onClick={() => handleStatusChange(record, 'submitted')} disabled={!canTransition(record, 'submitted')}>
                  На согласование
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => handleDelete(record)}
                  disabled={record.status !== 'draft' || !(user?.role === 'student' || user?.role === 'admin')}
                >
                  Удалить
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
                  Скачать
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  );
}
