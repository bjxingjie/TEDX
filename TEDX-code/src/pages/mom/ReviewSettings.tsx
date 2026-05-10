import React, { useState, useEffect } from 'react';
import { Card, Table, Button, message, DatePicker, Select, Tag, Row, Col, Space, Image } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import dayjs from 'dayjs';
import { SUBJECTS } from '@/lib/constants';

export default function ReviewSettings() {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [scheduledAt, setScheduledAt] = useState<any>(dayjs().add(1, 'day'));
  const [childId, setChildId] = useState<string>('');
  const [knowledgePoints, setKnowledgePoints] = useState<any[]>([]);
  const [errorTypes, setErrorTypes] = useState<any[]>([]);
  const [errorScenarios, setErrorScenarios] = useState<any[]>([]);

  const [subjectFilter, setSubjectFilter] = useState<string>();
  const [knowledgeFilter, setKnowledgeFilter] = useState<string>();
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>();
  const [scenarioFilter, setScenarioFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<any>();

  useEffect(() => {
    fetchOptions();
    fetchChildUser();
  }, []);

  useEffect(() => {
    fetchUnmasteredQuestions();
  }, [subjectFilter, knowledgeFilter, errorTypeFilter, scenarioFilter, statusFilter, dateRange]);

  const fetchChildUser = async () => {
    const { data } = await supabase.from('users').select('id').eq('role', 'child').single();
    if (data) setChildId(data.id);
  };

  const fetchOptions = async () => {
    const [{ data: kp }, { data: et }, { data: sc }] = await Promise.all([
      supabase.from('knowledge_points').select('id,name'),
      supabase.from('error_types').select('id,name'),
      supabase.from('error_scenarios').select('id,name')
    ]);
    setKnowledgePoints(kp || []);
    setErrorTypes(et || []);
    setErrorScenarios(sc || []);
  };

  const fetchUnmasteredQuestions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('questions')
        .select(`
          *,
          knowledge_points(name),
          error_types(name)
        `)
        .order('error_date', { ascending: false, nullsFirst: false });

      if (subjectFilter) {
        query = query.eq('subject_name', subjectFilter);
      }
      if (knowledgeFilter) {
        query = query.eq('knowledge_point_id', knowledgeFilter);
      }
      if (errorTypeFilter) {
        query = query.eq('error_type_id', errorTypeFilter);
      }
      if (scenarioFilter) {
        query = query.eq('error_scenario', scenarioFilter);
      }
      if (statusFilter === 'mastered') {
        query = query.eq('is_mastered', true);
      } else if (statusFilter === 'unmastered') {
        query = query.eq('is_mastered', false);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        query = query
          .gte('error_date', dateRange[0].format('YYYY-MM-DD'))
          .lte('error_date', dateRange[1].format('YYYY-MM-DD'));
      }

      const { data, error } = await query;

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      message.error(`获取数据失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createReviewSession = async () => {
    if (selectedRowKeys.length === 0) {
      return message.warning('请至少选择一道错题');
    }
    if (!scheduledAt) {
      return message.warning('请选择复习时间');
    }

    try {
      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('review_sessions')
        .insert([{
          child_id: childId,
          scheduled_at: scheduledAt.format('YYYY-MM-DD HH:mm:ss'),
          status: 'pending'
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create items
      const items = selectedRowKeys.map(qId => ({
        review_session_id: session.id,
        question_id: qId,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase.from('review_items').insert(items);
      if (itemsError) throw itemsError;

      message.success('复习任务创建成功！');
      setSelectedRowKeys([]);
    } catch (error: any) {
      message.error(`创建失败: ${error.message}`);
    }
  };

  const columns = [
    {
      title: '题目预览',
      key: 'preview',
      render: (_: any, record: any) => {
        if (record.image_url) {
          return <Image src={record.image_url} width={80} className="rounded border" />;
        }
        const text = record.text_content || '看图作答';
        return <span>{text.length > 20 ? `${text.slice(0, 20)}...` : text}</span>;
      }
    },
    {
      title: '科目',
      dataIndex: 'subject_name',
      key: 'subject_name',
    },
    {
      title: '知识点',
      key: 'knowledge',
      render: (_: any, record: any) => record.knowledge_points?.name || '-',
    },
    {
      title: '错误类型',
      key: 'error_type',
      render: (_: any, record: any) => record.error_types?.name || '-',
    },
    {
      title: '错题场景',
      dataIndex: 'error_scenario',
      key: 'error_scenario',
    },
    {
      title: '错题日期',
      dataIndex: 'error_date',
      key: 'error_date',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) =>
        record.is_mastered ? (
          <Tag icon={<CheckCircleOutlined />} color="success">已掌握</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">待复习</Tag>
        )
    },
  ];

  return (
    <Card className="shadow-sm">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">复习任务</h2>
        <Space>
          <DatePicker
            showTime
            value={scheduledAt}
            onChange={setScheduledAt}
            className="w-56"
          />
          <Button
            type="primary"
            onClick={createReviewSession}
            disabled={selectedRowKeys.length === 0}
            className="bg-[#FF6B35]"
          >
            生成复习卷 ({selectedRowKeys.length}题)
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="mb-4">
        <Col span={4}>
          <Select
            className="w-full"
            placeholder="所有科目"
            allowClear
            onChange={setSubjectFilter}
          >
            {SUBJECTS.map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            className="w-full"
            placeholder="知识点"
            allowClear
            onChange={setKnowledgeFilter}
          >
            {knowledgePoints.map((kp) => (
              <Select.Option key={kp.id} value={kp.id}>{kp.name}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            className="w-full"
            placeholder="错误类型"
            allowClear
            onChange={setErrorTypeFilter}
          >
            {errorTypes.map((et) => (
              <Select.Option key={et.id} value={et.id}>{et.name}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            className="w-full"
            placeholder="错题场景"
            allowClear
            onChange={setScenarioFilter}
          >
            {errorScenarios.map((sc) => (
              <Select.Option key={sc.id} value={sc.name}>{sc.name}</Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Select
            className="w-full"
            placeholder="状态"
            allowClear
            onChange={setStatusFilter}
          >
            <Select.Option value="unmastered">待复习</Select.Option>
            <Select.Option value="mastered">已掌握</Select.Option>
          </Select>
        </Col>
        <Col span={4}>
          <DatePicker.RangePicker
            className="w-full"
            onChange={setDateRange as any}
            placeholder={['开始日期', '结束日期']}
          />
        </Col>
      </Row>

      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={columns}
        dataSource={questions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Card>
  );
}
