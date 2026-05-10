import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, message, Space, Typography } from 'antd';
import { UserOutlined, SmileOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (username: string, role: 'mom' | 'child') => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        throw new Error('User not found');
      }

      // Since we don't actually check password for this prototype (preset login directly),
      // we just log them in based on selection.
      login({
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role as 'mom' | 'child',
      });

      if (role === 'mom') {
        navigate('/mom/dashboard');
      } else {
        navigate('/child/review');
      }
    } catch (err: any) {
      message.error(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md shadow-lg border-0 rounded-2xl">
        <div className="text-center mb-8">
          <Title level={2} style={{ color: '#FF6B35', marginBottom: 8 }}>满分捕手 错题本</Title>
          <Text type="secondary">高效管理，轻松复习</Text>
        </div>

        <div className="flex flex-col gap-4">
          <Button
            type="primary"
            size="large"
            icon={<UserOutlined />}
            loading={loading}
            onClick={() => handleLogin('妈妈', 'mom')}
            className="h-14 text-lg bg-[#FF6B35] hover:bg-[#ff8559]"
          >
            错题小秘书
          </Button>
          <Button
            size="large"
            icon={<SmileOutlined />}
            loading={loading}
            onClick={() => handleLogin('邢洲', 'child')}
            className="h-14 text-lg"
          >
            学霸请进
          </Button>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          测试版本 - 直接点击角色登录
        </div>
      </Card>
    </div>
  );
}
