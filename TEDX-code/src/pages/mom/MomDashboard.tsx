import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Select } from 'antd';
import { FileTextOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { supabase } from '@/supabase/client';
import dayjs from 'dayjs';

const { Option } = Select;

export default function MomDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, mastered: 0, pending: 0 });
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<number | 'all'>(30); // days or 'all'

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      let query = supabase.from('questions').select('*, subjects(name)');
      
      if (timeRange !== 'all') {
        const startDate = dayjs().subtract(timeRange as number, 'day').format('YYYY-MM-DD');
        query = query.gte('error_date', startDate);
      }

      const { data: questions, error } = await query;

      if (error) throw error;

      const total = questions.length;
      const mastered = questions.filter(q => q.is_mastered).length;
      const pending = total - mastered;
      setStats({ total, mastered, pending });

      // Group by subject
      const subMap: Record<string, number> = {};
      questions.forEach(q => {
        const subName = q.subject_name || '未知';
        subMap[subName] = (subMap[subName] || 0) + 1;
      });
      const subChartData = Object.keys(subMap).map(k => ({ name: k, value: subMap[k] }));
      setSubjectData(subChartData);

      // Group by date for trend
      const dateMap: Record<string, number> = {};
      
      if (timeRange !== 'all') {
        for (let i = (timeRange as number) - 1; i >= 0; i--) {
          dateMap[dayjs().subtract(i, 'day').format('MM-DD')] = 0;
        }
      }
      
      questions.forEach(q => {
        if (!q.error_date) return;
        const d = dayjs(q.error_date).format('MM-DD');
        if (dateMap[d] !== undefined || timeRange === 'all') {
          dateMap[d] = (dateMap[d] || 0) + 1;
        }
      });
      
      // For 'all' range, sort the dates chronologically
      let sortedDates = Object.keys(dateMap);
      if (timeRange === 'all') {
        sortedDates.sort((a, b) => a.localeCompare(b));
      }
      
      setTrendData(sortedDates.map(k => ({ date: k, count: dateMap[k] })));
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const subjectOption = {
    title: { text: '各科目错题分布', left: 'center' },
    tooltip: { trigger: 'item' },
    series: [
      {
        name: '错题数量',
        type: 'pie',
        radius: '50%',
        data: subjectData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  const trendOption = {
    title: { text: '错题时间趋势' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: trendData.map(item => item.date)
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        data: trendData.map(item => item.count),
        type: 'line',
        smooth: true,
        areaStyle: {},
        itemStyle: { color: '#FF6B35' }
      }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">数据总览</h2>
        <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
          <Option value={7}>最近7天</Option>
          <Option value={30}>最近30天</Option>
          <Option value={90}>最近3个月</Option>
          <Option value={365}>最近一年</Option>
          <Option value="all">全部</Option>
        </Select>
      </div>

      <Spin spinning={loading}>
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总错题数"
                value={stats.total}
                prefix={<FileTextOutlined className="text-blue-500" />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="待复习题目"
                value={stats.pending}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="已掌握题目"
                value={stats.mastered}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} className="mt-6">
          <Col span={12}>
            <Card className="h-full">
              {subjectData.length > 0 ? (
                <ReactECharts option={subjectOption} style={{ height: 300 }} />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">暂无数据</div>
              )}
            </Card>
          </Col>
          <Col span={12}>
            <Card className="h-full">
              {trendData.some(d => d.count > 0) ? (
                <ReactECharts option={trendOption} style={{ height: 300 }} />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-400">暂无数据</div>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
