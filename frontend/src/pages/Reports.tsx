import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Card, Space, Upload, Select, message } from 'antd';
import { ArrowLeftOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { listReports, uploadReport, updateReportStatus, getReportDownloadUrl } from '../api/reports';
import type { Report } from '../types';
import { useAuthStore } from '../stores/authStore';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  submitted: 'На проверке',
  under_review: 'На согласовании',
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
    const { url } = await getReportDownloadUrl(report.id);
    window.open(url, '_blank');
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
            <Upload beforeUpload={handleUpload} showUploadList={false} accept=".pdf,.doc,.docx">
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
            render: (status: string, record: Report) =>
              canReview && (status === 'submitted' || status === 'under_review') ? (
                <Select
                  value={status}
                  options={[
                    { value: 'under_review', label: STATUS_LABELS.under_review },
                    { value: 'approved', label: STATUS_LABELS.approved },
                    { value: 'revision_requested', label: STATUS_LABELS.revision_requested },
                  ]}
                  onChange={(v) => handleStatusChange(record, v)}
                  style={{ width: 180 }}
                />
              ) : (
                STATUS_LABELS[status] ?? status
              ),
          },
          { title: 'Дата загрузки', dataIndex: 'uploaded_at', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: 'Действия',
            key: 'actions',
            render: (_, record: Report) => (
              <Space>
                <Button size="small" onClick={() => handleStatusChange(record, 'submitted')} disabled={record.status !== 'draft' || (user?.role !== 'student' && user?.role !== 'admin')}>
                  На согласование
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
