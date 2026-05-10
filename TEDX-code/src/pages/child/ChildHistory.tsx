import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Statistic, Row, Col, Empty, Button, Modal, Image, Typography, message, Select, Space, Input } from 'antd';
import { CheckCircleOutlined, StarOutlined, EditOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import { SUBJECTS } from '@/lib/constants';

const { Paragraph } = Typography;
const { TextArea } = Input;

export default function ChildHistory() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, mastered: 0, masteryRate: 0 });

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [editFeedback, setEditFeedback] = useState('');
  
  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>();
  const [kpFilter, setKpFilter] = useState<string>();
  const [errTypeFilter, setErrTypeFilter] = useState<string>();
  const [scenarioFilter, setScenarioFilter] = useState<string>();

  const [kps, setKps] = useState<any[]>([]);
  const [errTypes, setErrTypes] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);

  const stripAnswerImageFallback = (note?: string) => {
    if (!note) return '';
    return note.replace(/\s*\[\[ANSWER_IMG_FALLBACK::(.*?)\]\]\s*/g, '').trim();
  };

  const extractAnswerImageFallback = (note?: string) => {
    if (!note) return '';
    const match = note.match(/\[\[ANSWER_IMG_FALLBACK::(.*?)\]\]/);
    return match?.[1] || '';
  };

  useEffect(() => {
    fetchHistory();
    fetchFilters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [history, subjectFilter, kpFilter, errTypeFilter, scenarioFilter]);

  const fetchFilters = async () => {
    const [{ data: kps }, { data: errs }, { data: scs }] = await Promise.all([
      supabase.from('knowledge_points').select('*'),
      supabase.from('error_types').select('*'),
      supabase.from('error_scenarios').select('*')
    ]);
    if (kps) setKps(kps);
    if (errs) setErrTypes(errs);
    if (scs) setScenarios(scs);
  };

  const getLevel1KpById = (kpId?: string) => {
    if (!kpId) return null;
    const map = new Map(kps.map((kp: any) => [kp.id, kp]));
    let current = map.get(kpId);
    while (current?.parent_id && map.get(current.parent_id)) {
      current = map.get(current.parent_id);
    }
    return current || null;
  };

  const getQuestionKpIds = (question: any): string[] => {
    if (Array.isArray(question?.knowledge_point_ids)) return question.knowledge_point_ids;
    if (question?.knowledge_point_id) return [question.knowledge_point_id];
    return [];
  };

  const getLevel1KpName = (record: any) => {
    const ids = getQuestionKpIds(record.questions);
    if (ids.length === 0) return '-';
    return getLevel1KpById(ids[0])?.name || '-';
  };

  const getKnowledgeTags = (record: any) => {
    const ids = getQuestionKpIds(record.questions);
    return ids
      .map((id) => kps.find((kp) => kp.id === id)?.name)
      .filter(Boolean);
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_items')
        .select(`
          id,
          status,
          answered_at,
          feedback,
          question_id,
          questions(
            *,
            error_types(id, name),
            error_type_id
          ),
          review_sessions!inner(child_id, status)
        `)
        .eq('review_sessions.child_id', user?.id)
        .neq('status', 'pending')
        .order('answered_at', { ascending: false });

      if (error) throw error;
      
      const items = data || [];
      setHistory(items);
    } catch (error: any) {
      console.error('Error fetching history:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...history];

    if (subjectFilter) {
      filtered = filtered.filter(i => i.questions?.subject_name === subjectFilter);
    }
    if (scenarioFilter) {
      filtered = filtered.filter(i => i.questions?.error_scenario === scenarioFilter);
    }
    if (errTypeFilter) {
      filtered = filtered.filter(i => i.questions?.error_types?.id === errTypeFilter);
    }
    if (kpFilter) {
      filtered = filtered.filter(i => {
        const ids = getQuestionKpIds(i.questions);
        return ids.some((id) => id === kpFilter || getLevel1KpById(id)?.id === kpFilter);
      });
    }

    setFilteredHistory(filtered);

    // Compute stats
    const total = filtered.length;
    const mastered = filtered.filter(i => i.status === 'passed').length;
    const masteryRate = total > 0 ? Math.round((mastered / total) * 100) : 0;
    setStats({ total, mastered, masteryRate });
  };

  const handleViewDetail = (record: any) => {
    setCurrentRecord(record);
    setEditFeedback(record.feedback || '');
    setDetailVisible(true);
  };

  const handleSaveFeedback = async () => {
    if (!currentRecord) return;
    try {
      await supabase.from('review_items').update({ feedback: editFeedback }).eq('id', currentRecord.id);
      message.success('答案修改成功');
      fetchHistory();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const toggleStatus = async () => {
    if (!currentRecord) return;
    const newStatus = currentRecord.status === 'passed' ? 'failed' : 'passed';
    
    try {
      await supabase.from('review_items').update({ status: newStatus }).eq('id', currentRecord.id);
      await supabase.from('questions').update({ is_mastered: newStatus === 'passed' }).eq('id', currentRecord.question_id);
      
      message.success('状态已更新');
      setDetailVisible(false);
      fetchHistory();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    {
      title: '复习时间',
      dataIndex: 'answered_at',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '科目',
      render: (_: any, record: any) => (
        <span className="whitespace-nowrap">{record.questions?.subject_name || '-'}</span>
      ),
    },
    {
      title: '一级知识点',
      render: (_: any, record: any) => {
        return <span className="whitespace-nowrap">{getLevel1KpName(record)}</span>;
      }
    },
    {
      title: '题目内容',
      render: (_: any, record: any) => {
        const text = record.questions?.text_content;
        const preview = text ? (text.length > 16 ? `${text.substring(0, 16)}...` : text) : '看图作答';
        return <span className="block max-w-[220px] truncate">{preview}</span>;
      },
    },
    {
      title: '复习结果',
      dataIndex: 'status',
      render: (status: string) => (
        status === 'passed' 
          ? <Tag color="success" icon={<CheckCircleOutlined />}>已掌握</Tag> 
          : <Tag color="error">待加强</Tag>
      ),
    },
    {
      title: '操作',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>查看详情</Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Row gutter={16}>
        <Col span={8}>
          <Card className="text-center shadow-sm rounded-xl">
            <Statistic title="累计复习题数" value={stats.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="text-center shadow-sm rounded-xl">
            <Statistic 
              title="成功掌握题数" 
              value={stats.mastered} 
              valueStyle={{ color: '#10B981' }} 
              prefix={<StarOutlined />} 
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="text-center shadow-sm rounded-xl">
            <Statistic 
              title="整体掌握率" 
              value={stats.masteryRate} 
              suffix="%" 
              valueStyle={{ color: '#FF6B35' }} 
            />
          </Card>
        </Col>
      </Row>

      <Card title="复习记录" className="shadow-sm rounded-xl">
        <Row gutter={[16, 16]} className="mb-4">
          <Col span={6}>
            <Select placeholder="选择科目" className="w-full" allowClear onChange={setSubjectFilter}>
              {SUBJECTS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="选择知识点" className="w-full" allowClear onChange={setKpFilter} disabled={!subjectFilter}>
              {kps.filter(k => k.subject_name === subjectFilter && !k.parent_id).map(k => <Select.Option key={k.id} value={k.id}>{k.name}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="选择错误原因" className="w-full" allowClear onChange={setErrTypeFilter}>
              {errTypes.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="选择错误场景" className="w-full" allowClear onChange={setScenarioFilter}>
              {scenarios.map(s => <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>)}
            </Select>
          </Col>
        </Row>
        <Table
          dataSource={filteredHistory}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="暂无复习记录" /> }}
        />
      </Card>

      <Modal
        title="错题复习详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button key="toggle" type="primary" onClick={toggleStatus}>
            标记为{currentRecord?.status === 'passed' ? '待加强' : '已掌握'}
          </Button>,
        ]}
        width={600}
      >
        {currentRecord && (
          <div className="space-y-4 mt-4">
            <div>
              <h4 className="font-bold text-gray-700 mb-2">原题</h4>
              {currentRecord.questions.text_content && (
                <Paragraph className="bg-gray-50 p-3 rounded">{currentRecord.questions.text_content}</Paragraph>
              )}
              {currentRecord.questions.image_url && (
                <Image src={currentRecord.questions.image_url} alt="原题图片" className="max-w-full rounded border" />
              )}
            </div>
            
            <div>
              <h4 className="font-bold text-gray-700 mb-2">标签信息</h4>
              <div className="flex flex-wrap gap-2">
                <Tag color="blue">{currentRecord.questions.subject_name || '-'}</Tag>
                {(getKnowledgeTags(currentRecord)).map((name: string) => (
                  <Tag key={name} color="processing">{name}</Tag>
                ))}
                {currentRecord.questions?.error_types?.name && (
                  <Tag color="volcano">{currentRecord.questions.error_types.name}</Tag>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-gray-700">你的复习答案</h4>
                <Button type="link" size="small" onClick={handleSaveFeedback}>保存修改</Button>
              </div>
              <TextArea 
                rows={4}
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                className="bg-blue-50"
              />
            </div>
            <div>
              <h4 className="font-bold text-gray-700 mb-2">正确答案</h4>
              <Paragraph className="bg-green-50 p-3 rounded whitespace-pre-wrap">
                {stripAnswerImageFallback(currentRecord.questions.answer_note) || '暂无'}
              </Paragraph>
              {(currentRecord.questions.answer_image_url || extractAnswerImageFallback(currentRecord.questions.answer_note)) && (
                <Image
                  src={currentRecord.questions.answer_image_url || extractAnswerImageFallback(currentRecord.questions.answer_note)}
                  alt="正确答案图片"
                  className="max-w-full rounded border"
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
