import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar } from 'antd';
import {
  CheckCircleOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

const { Header, Content } = Layout;

export default function ChildLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/child/review',
      icon: <CheckCircleOutlined />,
      label: '复习中心',
    },
    {
      key: '/child/history',
      icon: <HistoryOutlined />,
      label: '历史记录',
    },
  ];

  const userMenu = {
    items: [
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Layout className="min-h-screen bg-[#F3F4F6]">
      <Header className="bg-white shadow-sm px-4 flex justify-between items-center fixed w-full z-10 h-16">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold text-[#FF6B35]">满分捕手 错题本</div>
          <Menu
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className="border-b-0 min-w-[300px]"
          />
        </div>
        <Dropdown menu={userMenu} placement="bottomRight">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1 rounded-md transition-colors">
            <Avatar icon={<UserOutlined />} className="bg-[#10B981]" />
              <span className="text-sm font-medium">学霸在线</span>
          </div>
        </Dropdown>
      </Header>
      <Content className="mt-16 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <Outlet />
      </Content>
    </Layout>
  );
}
