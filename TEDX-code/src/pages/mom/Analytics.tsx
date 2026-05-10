import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Spin, Empty } from 'antd';
import ReactECharts from 'echarts-for-react';
import { supabase } from '@/supabase/client';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [rankingData, setRankingData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*, knowledge_points(name), subjects(name)');

      if (error) throw error;

      // Calculate knowledge points error count
      const kpMap: Record<string, { count: number, name: string, subject: string }> = {};
      data.forEach(q => {
        if (q.knowledge_points) {
          const kpName = q.knowledge_points.name;
          if (!kpMap[kpName]) {
            kpMap[kpName] = { count: 0, name: kpName, subject: q.subjects?.name || '' };
          }
          kpMap[kpName].count += 1;
        }
      });

      const sortedKps = Object.values(kpMap).sort((a, b) => b.count - a.count);
      setRankingData(sortedKps.slice(0, 10)); // Top 10

      // Heatmap Data (Simulated matrix based on data for echarts)
      // Since ECharts heatmap requires [x, y, value], we just show a bar chart of top errors for simplicity,
      // or a heatmap if we had daily data per subject.
      setHeatmapData(sortedKps.slice(0, 5)); // Just using bar chart to represent heat for prototype

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const heatmapOption = {
    title: { text: '知识点薄弱度 (Top 5)', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: heatmapData.map(d => d.name)
    },
    yAxis: { type: 'value' },
    visualMap: {
      orient: 'horizontal',
      left: 'center',
      min: 0,
      max: Math.max(...heatmapData.map(d => d.count), 5),
      text: ['高', '低'],
      dimension: 1,
      inRange: {
        color: ['#FFD8B8', '#FF6B35', '#D83A00']
      }
    },
    series: [
      {
        data: heatmapData.map(d => d.count),
        type: 'bar',
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }
    ]
  };

  const columns = [
    { title: '排名', key: 'index', render: (_: any, __: any, index: number) => index + 1, width: 80 },
    { title: '科目', dataIndex: 'subject', width: 120 },
    { title: '知识点', dataIndex: 'name' },
    { title: '错题次数', dataIndex: 'count', width: 120, render: (val: number) => <span className="text-[#FF6B35] font-bold">{val}</span> },
  ];

  return (
    <Spin spinning={loading}>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="薄弱知识点分析" className="h-full shadow-sm">
            {heatmapData.length > 0 ? (
              <ReactECharts option={heatmapOption} style={{ height: 400 }} />
            ) : (
              <Empty description="暂无足够数据生成图表" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="高频错误知识点 TOP10" className="h-full shadow-sm">
            <Table
              dataSource={rankingData}
              columns={columns}
              rowKey="name"
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
