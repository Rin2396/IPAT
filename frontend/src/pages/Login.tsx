import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { login } from '../api/auth';

export function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login: storeLogin } = useAuthStore();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { user, tokens } = await login(values);
      storeLogin(user, tokens.access_token, tokens.refresh_token);
      message.success('Вход выполнен');
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string | unknown }; status?: number } };
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((x: { msg?: string; loc?: unknown[] }) => x.msg ?? JSON.stringify(x)).join('; ')
          : detail != null ? String(detail) : 'Ошибка входа';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto' }}>
      <Card title="Вход в систему">
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Введите email' }]}
          >
            <Input placeholder="admin@college.local" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
