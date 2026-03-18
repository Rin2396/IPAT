import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Layout, Menu, Dropdown, Badge, Button, Space, Typography } from 'antd';
import {
  UserOutlined,
  BellOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
  BankOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { listNotifications, getUnreadCount, markNotificationRead, markAllRead } from '../api/notifications';
import { logout } from '../api/auth';
import type { MenuProps } from 'antd';
import type { UserRole } from '../types';
import type { Notification } from '../types';

const { Header, Content } = Layout;
const { Text } = Typography;

function getMenuItems(role: UserRole): MenuProps['items'] {
  const base: MenuProps['items'] = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Главная' },
  ];
  if (role === 'admin') {
    return [
      ...base,
      { key: '/users', icon: <TeamOutlined />, label: 'Пользователи' },
      { key: '/companies', icon: <BankOutlined />, label: 'Компании' },
      { key: '/periods', icon: <CalendarOutlined />, label: 'Периоды' },
      { key: '/assignments', icon: <FileTextOutlined />, label: 'Назначения' },
    ];
  }
  return [
    ...base,
    { key: '/assignments', icon: <FileTextOutlined />, label: 'Назначения' },
  ];
}

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout: storeLogout } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = () => {
    listNotifications({ unread_only: false }).then(setNotifications).catch(() => {});
    getUnreadCount().then((r) => setUnreadCount(r.count)).catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 30000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      storeLogout();
      navigate('/login');
    }
  };

  const notificationMenu = {
    items: [
      ...notifications.slice(0, 10).map((n) => ({
        key: String(n.id),
        label: (
          <div style={{ maxWidth: 320 }}>
            <Text strong={!n.read}>{n.title}</Text>
            {n.body && <div style={{ fontSize: 12, color: '#666' }}>{n.body}</div>}
          </div>
        ),
        onClick: () => {
          if (!n.read) markNotificationRead(n.id).then(loadNotifications);
        },
      })),
      notifications.length > 0
        ? {
            key: 'read-all',
            label: 'Прочитать все',
            onClick: () => markAllRead().then(loadNotifications),
          }
        : null,
    ].filter(Boolean) as MenuProps['items'],
  };

  if (!user) return null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={getMenuItems(user.role)}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space>
          <Dropdown menu={notificationMenu} trigger={['click']} placement="bottomRight">
            <Badge count={unreadCount} size="small">
              <Button type="text" icon={<BellOutlined />} style={{ color: '#fff' }} />
            </Badge>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: user.full_name },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Выход', danger: true, onClick: handleLogout },
              ],
            }}
            placement="bottomRight"
          >
            <Button type="text" style={{ color: '#fff' }}>
              <UserOutlined /> {user.full_name}
            </Button>
          </Dropdown>
        </Space>
      </Header>
      <Content style={{ padding: 24 }}>{children ?? <Outlet />}</Content>
    </Layout>
  );
}
