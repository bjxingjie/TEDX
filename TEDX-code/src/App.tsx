import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Login from '@/pages/Login';
import MomLayout from '@/layouts/MomLayout';
import ChildLayout from '@/layouts/ChildLayout';
import { useAuthStore } from '@/store/authStore';
import QuestionAddPage from '@/pages/mom/QuestionAdd';

import MomDashboardPage from '@/pages/mom/MomDashboard';
import QuestionListPage from '@/pages/mom/QuestionList';
import ReviewSettingsPage from '@/pages/mom/ReviewSettings';
import ChildReviewPage from '@/pages/child/ChildReview';
import ChildHistoryPage from '@/pages/child/ChildHistory';
import AnalyticsPage from '@/pages/mom/Analytics';
import TagSettingsPage from '@/pages/mom/TagSettings';

function RequireAuth({ children, role }: { children: JSX.Element; role: 'mom' | 'child' }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'mom' ? '/mom/dashboard' : '/child/review'} replace />;
  }
  return children;
}

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#FF6B35' } }}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/mom" element={<RequireAuth role="mom"><MomLayout /></RequireAuth>}>
            <Route path="dashboard" element={<MomDashboardPage />} />
            <Route path="question/add" element={<QuestionAddPage />} />
            <Route path="question/list" element={<QuestionListPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="review/settings" element={<ReviewSettingsPage />} />
              <Route path="tags" element={<TagSettingsPage />} />
            </Route>
            
            <Route path="/child" element={<RequireAuth role="child"><ChildLayout /></RequireAuth>}>
              <Route path="review" element={<ChildReviewPage />} />
              <Route path="history" element={<ChildHistoryPage />} />
          </Route>
          
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;
