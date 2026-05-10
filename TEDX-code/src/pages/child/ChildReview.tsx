import React, { useState, useEffect } from 'react';
import { Card, Button, message, Empty, Spin, Typography, Image, Input, Select, Row, Col, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { SUBJECTS } from '@/lib/constants';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

export default function ChildReview() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [reviewItems, setReviewItems] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerContent, setAnswerContent] = useState('');
  const [showReference, setShowReference] = useState(false);
  const [reviewCountMap, setReviewCountMap] = useState<Record<string, number>>({});
  const [kps, setKps] = useState<any[]>([]);
  const [errTypes, setErrTypes] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>();
  const [kpFilter, setKpFilter] = useState<string>();
  const [errTypeFilter, setErrTypeFilter] = useState<string>();
  const [scenarioFilter, setScenarioFilter] = useState<string>();

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
    fetchReviewTask();
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    const [{ data: kpData }, { data: errData }, { data: scData }] = await Promise.all([
      supabase.from('knowledge_points').select('*'),
      supabase.from('error_types').select('*'),
      supabase.from('error_scenarios').select('*')
    ]);
    if (kpData) setKps(kpData);
    if (errData) setErrTypes(errData);
    if (scData) setScenarios(scData);
  };

  const getLevel1KpNameById = (kpId?: string) => {
    if (!kpId) return '';
    const map = new Map(kps.map((kp: any) => [kp.id, kp]));
    let current = map.get(kpId);
    while (current?.parent_id && map.get(current.parent_id)) {
      current = map.get(current.parent_id);
    }
    return current?.name || '';
  };

  const getLevel1KpIdById = (kpId?: string) => {
    if (!kpId) return '';
    const map = new Map(kps.map((kp: any) => [kp.id, kp]));
    let current = map.get(kpId);
    while (current?.parent_id && map.get(current.parent_id)) {
      current = map.get(current.parent_id);
    }
    return current?.id || '';
  };

  const getQuestionKpIds = (question: any): string[] => {
    if (Array.isArray(question?.knowledge_point_ids)) return question.knowledge_point_ids;
    if (question?.knowledge_point_id) return [question.knowledge_point_id];
    return [];
  };

  const getQuestionLevel1KpName = (question: any) => {
    const ids = getQuestionKpIds(question);
    if (ids.length === 0) return '';
    return getLevel1KpNameById(ids[0]);
  };

  const applyFilters = (items: any[]) => {
    return items.filter((item) => {
      const q = item.questions;
      if (!q) return false;
      if (subjectFilter && q.subject_name !== subjectFilter) return false;
      if (scenarioFilter && q.error_scenario !== scenarioFilter) return false;
      if (errTypeFilter && q.error_types?.id !== errTypeFilter) return false;
      if (kpFilter) {
        const ids = getQuestionKpIds(q);
        const matched = ids.some((id) => id === kpFilter || getLevel1KpIdById(id) === kpFilter);
        if (!matched) return false;
      }
      return true;
    });
  };

  const fetchReviewTask = async () => {
    setLoading(true);
    try {
      // Get the earliest pending or in_progress session for this child
      const { data: sessions, error: sessionError } = await supabase
        .from('review_sessions')
        .select('*')
        .eq('child_id', user?.id)
        .in('status', ['pending', 'in_progress'])
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (sessionError) throw sessionError;

      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        setCurrentSession(session);

        // Fetch items with knowledge_points parent lookup
        const { data: items, error: itemsError } = await supabase
          .from('review_items')
          .select(`
            id, 
            status, 
            feedback,
            question_id,
            questions(
              *,
              error_types(id, name)
            )
          `)
          .eq('review_session_id', session.id)
          .in('status', ['pending', 'failed']);

        if (itemsError) throw itemsError;
        setReviewItems(items || []);

        const { data: historyItems } = await supabase
          .from('review_items')
          .select('question_id, status, review_sessions!inner(child_id)')
          .eq('review_sessions.child_id', user?.id)
          .in('status', ['failed', 'passed']);

        const countMap: Record<string, number> = {};
        (historyItems || []).forEach((h: any) => {
          countMap[h.question_id] = (countMap[h.question_id] || 0) + 1;
        });
        setReviewCountMap(countMap);

        if (session.status === 'pending') {
          await supabase
            .from('review_sessions')
            .update({ status: 'in_progress' })
            .eq('id', session.id);
        }
      }
    } catch (error: any) {
      message.error(`获取任务失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isPassed: boolean) => {
    const filteredItems = applyFilters(reviewItems);
    const item = filteredItems[currentIndex];
    if (!item) return;
    try {
      const status = isPassed ? 'passed' : 'failed';
      
      // Update review item
      await supabase
        .from('review_items')
        .update({ status, answered_at: new Date().toISOString(), feedback: answerContent })
        .eq('id', item.id);

      // If passed, update question as mastered
      if (isPassed) {
        await supabase
          .from('questions')
          .update({ is_mastered: true })
          .eq('id', item.questions.id);
      }

      if (!isPassed) {
        setReviewCountMap((prev) => ({
          ...prev,
          [item.questions.id]: (prev[item.questions.id] || 0) + 1
        }));
      }

      message.success(isPassed ? '太棒了！已掌握' : '没关系，下次继续努力');
      setAnswerContent('');
      setShowReference(false);
      const allItems = [...reviewItems];
      const sourceIndex = allItems.findIndex((i) => i.id === item.id);
      if (sourceIndex === -1) return;

      if (isPassed) {
        allItems.splice(sourceIndex, 1);
      } else {
        const [failedItem] = allItems.splice(sourceIndex, 1);
        allItems.push({ ...failedItem, status: 'failed' });
      }

      setReviewItems(allItems);

      const nextFiltered = applyFilters(allItems);
      if (nextFiltered.length === 0) {
        await supabase
          .from('review_sessions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', currentSession.id);
        message.success('本轮复习任务已完成！');
      }
      setCurrentIndex(0);
    } catch (error: any) {
      message.error(`提交失败: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center mt-20"><Spin size="large" /></div>;
  }

  const filteredReviewItems = applyFilters(reviewItems);

  if (!currentSession || reviewItems.length === 0) {
    return (
      <Card className="shadow-sm rounded-2xl text-center py-20">
        <Empty description="太棒啦！暂无需要复习的错题" />
      </Card>
    );
  }

  if (filteredReviewItems.length === 0) {
    return (
      <Card className="shadow-sm rounded-2xl">
        <Row gutter={[12, 12]} className="mb-3">
          <Col span={6}>
            <Select placeholder="科目" className="w-full" allowClear onChange={setSubjectFilter} value={subjectFilter}>
              {SUBJECTS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="知识点" className="w-full" allowClear onChange={setKpFilter} value={kpFilter} disabled={!subjectFilter}>
              {kps.filter(k => k.subject_name === subjectFilter && !k.parent_id).map(k => <Select.Option key={k.id} value={k.id}>{k.name}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="错误原因" className="w-full" allowClear onChange={setErrTypeFilter} value={errTypeFilter}>
              {errTypes.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
            </Select>
          </Col>
          <Col span={6}>
            <Select placeholder="错误场景" className="w-full" allowClear onChange={setScenarioFilter} value={scenarioFilter}>
              {scenarios.map(s => <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>)}
            </Select>
          </Col>
        </Row>
        <Empty description="当前筛选条件下暂无复习题目" />
      </Card>
    );
  }

  const safeIndex = Math.min(currentIndex, filteredReviewItems.length - 1);
  const currentItem = filteredReviewItems[safeIndex];
  const question = currentItem.questions;
  const level1KpName = getQuestionLevel1KpName(question);
  const textPreview = question.text_content
    ? (question.text_content.length > 18 ? `${question.text_content.slice(0, 18)}...` : question.text_content)
    : '看图作答';
  const reviewedCount = reviewCountMap[question.id] || 0;

  return (
    <div className="flex flex-col items-center">
      <Row gutter={[12, 12]} className="w-full mb-3">
        <Col span={6}>
          <Select placeholder="科目" className="w-full" allowClear onChange={setSubjectFilter} value={subjectFilter}>
            {SUBJECTS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
          </Select>
        </Col>
        <Col span={6}>
          <Select placeholder="知识点" className="w-full" allowClear onChange={setKpFilter} value={kpFilter} disabled={!subjectFilter}>
            {kps.filter(k => k.subject_name === subjectFilter).map(k => <Select.Option key={k.id} value={k.id}>{k.name}</Select.Option>)}
          </Select>
        </Col>
        <Col span={6}>
          <Select placeholder="错误原因" className="w-full" allowClear onChange={setErrTypeFilter} value={errTypeFilter}>
            {errTypes.map(e => <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>)}
          </Select>
        </Col>
        <Col span={6}>
          <Select placeholder="错误场景" className="w-full" allowClear onChange={setScenarioFilter} value={scenarioFilter}>
            {scenarios.map(s => <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>)}
          </Select>
        </Col>
      </Row>
      <div className="w-full flex justify-between items-center mb-4 text-gray-500">
        <span className="bg-white px-3 py-1 rounded-full shadow-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[70%]">
          {question.subject_name}{level1KpName ? ` | ${level1KpName}` : ''}
        </span>
        <span className="font-medium whitespace-nowrap">
          进度: {safeIndex + 1} / {filteredReviewItems.length}
        </span>
      </div>

      <Card className="w-full shadow-md rounded-2xl mb-8 overflow-hidden">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <Tag color="processing">题目内容：{textPreview}</Tag>
          <Tag color={currentItem.status === 'failed' ? 'error' : 'default'}>已复习次数：{reviewedCount}</Tag>
        </div>
        
        {question.image_url && (
          <div className="flex justify-center mb-6">
            <Image
              src={question.image_url}
              alt="错题"
              className="max-w-full rounded-lg"
              style={{ maxHeight: '50vh' }}
            />
          </div>
        )}

        <div className="mt-4">
          <h4 className="text-gray-600 mb-2 font-medium">填写答案（选填）</h4>
          <TextArea 
            rows={4} 
            value={answerContent}
            onChange={e => setAnswerContent(e.target.value)}
            placeholder="可以在这里写下你的解题思路或最终答案..."
            className="rounded-lg"
          />
        </div>
        <div className="mt-3">
          <Button size="small" onClick={() => setShowReference((v) => !v)}>
            {showReference ? '隐藏正确答案及备注' : '查看正确答案及备注'}
          </Button>
          {showReference && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="font-medium text-amber-800 mb-2">正确答案及备注</p>
              <p className="text-gray-700 whitespace-pre-wrap">{stripAnswerImageFallback(question.answer_note) || '暂无'}</p>
              {(question.answer_image_url || extractAnswerImageFallback(question.answer_note)) && (
                <Image
                  src={question.answer_image_url || extractAnswerImageFallback(question.answer_note)}
                  alt="答案备注图"
                  className="mt-3 rounded"
                  style={{ maxHeight: '40vh' }}
                />
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-8 w-full justify-center px-4">
        <Button
          size="large"
          danger
          shape="round"
          icon={<CloseCircleOutlined />}
          className="h-16 px-12 text-lg font-bold shadow-sm whitespace-nowrap"
          onClick={() => handleFeedback(false)}
        >
          有问题
        </Button>
        <Button
          size="large"
          type="primary"
          shape="round"
          icon={<CheckCircleOutlined />}
          className="h-16 px-12 text-lg font-bold bg-[#10B981] hover:bg-[#059669] border-none shadow-sm whitespace-nowrap"
          onClick={() => handleFeedback(true)}
        >
          已通过
        </Button>
      </div>
    </div>
  );
}
