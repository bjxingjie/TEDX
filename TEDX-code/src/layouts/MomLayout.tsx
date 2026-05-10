import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Button } from 'antd';
import {
  DashboardOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  CalendarOutlined,
  TagsOutlined,
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

const { Header, Sider, Content } = Layout;

export default function MomLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/mom/dashboard',
      icon: <DashboardOutlined />,
      label: '数据总览',
    },
    {
      key: '/mom/question/add',
      icon: <FileAddOutlined />,
      label: '录入错题',
    },
    {
      key: '/mom/question/list',
      icon: <UnorderedListOutlined />,
      label: '错题管理',
    },
    {
      key: '/mom/analytics',
      icon: <BarChartOutlined />,
      label: '学情分析',
    },
    {
      key: '/mom/review/settings',
      icon: <CalendarOutlined />,
      label: '复习任务',
    },
    {
      key: '/mom/tags',
      icon: <TagsOutlined />,
      label: '标签自定义',
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
    <Layout className="min-h-screen">
      <Sider
        theme="light"
        className="shadow-sm"
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div className="h-16 flex items-center justify-center m-4 text-[#FF6B35] font-bold text-xl">
          满分捕手 错题本
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="border-r-0"
        />
      </Sider>
      <Layout>
        <Header className="bg-white shadow-sm px-6 flex justify-between items-center">
          <div className="text-lg font-medium text-gray-800">错题管理后台</div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1 rounded-md transition-colors">
              <Avatar icon={<UserOutlined />} className="bg-[#FF6B35]" />
              <span className="text-sm font-medium">错题小秘</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="m-6 bg-white p-6 rounded-xl shadow-sm min-h-[280px]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
