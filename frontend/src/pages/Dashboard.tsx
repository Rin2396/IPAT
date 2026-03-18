import { Card, Row, Col, Typography, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  TeamOutlined,
  BankOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  return (
    <div>
      <Title level={3}>Добро пожаловать, {user.full_name}</Title>
      <Paragraph type="secondary">Роль: {user.role}</Paragraph>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {isAdmin && (
          <>
            <Col xs={24} sm={12} md={8}>
              <Card
                title="Пользователи"
                extra={<Button type="link" onClick={() => navigate('/users')}>Перейти</Button>}
                hoverable
              >
                <TeamOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card
                title="Компании"
                extra={<Button type="link" onClick={() => navigate('/companies')}>Перейти</Button>}
                hoverable
              >
                <BankOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Card
                title="Периоды"
                extra={<Button type="link" onClick={() => navigate('/periods')}>Перейти</Button>}
                hoverable
              >
                <CalendarOutlined style={{ fontSize: 32, color: '#fa8c16' }} />
              </Card>
            </Col>
          </>
        )}
        <Col xs={24} sm={12} md={8}>
          <Card
            title="Назначения"
            extra={<Button type="link" onClick={() => navigate('/assignments')}>Перейти</Button>}
            hoverable
          >
            <FileTextOutlined style={{ fontSize: 32, color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
