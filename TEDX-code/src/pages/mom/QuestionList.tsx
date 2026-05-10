import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  DatePicker,
  Row,
  Col,
  Modal,
  Image,
  message
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import dayjs from 'dayjs';
import { SUBJECTS } from '@/lib/constants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { RangePicker } = DatePicker;

export default function QuestionList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<string[]>(SUBJECTS);
  const [errorScenarios, setErrorScenarios] = useState<any[]>([]);
  
  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();
  const [scenarioFilter, setScenarioFilter] = useState<string>();
  const [dateRange, setDateRange] = useState<any>();
  
  useEffect(() => {
    fetchData();
    fetchScenarios();
  }, [subjectFilter, statusFilter, scenarioFilter, dateRange]);

  const fetchScenarios = async () => {
    const { data } = await supabase.from('error_scenarios').select('*');
    if (data) setErrorScenarios(data);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch questions
      let query = supabase
        .from('questions')
        .select(`
          *,
          knowledge_points(name),
          error_types(name)
        `)
        .order('created_at', { ascending: false });

      if (subjectFilter) {
        query = query.eq('subject_name', subjectFilter);
      }
      if (statusFilter === 'mastered') {
        query = query.eq('is_mastered', true);
      } else if (statusFilter === 'unmastered') {
        query = query.eq('is_mastered', false);
      }
      if (scenarioFilter) {
        query = query.eq('error_scenario', scenarioFilter);
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        query = query.gte('error_date', dateRange[0].format('YYYY-MM-DD'))
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

  const toggleMasterStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_mastered: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      message.success('状态更新成功');
      fetchData();
    } catch (error: any) {
      message.error(`更新失败: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      message.success('错题已删除');
      fetchData();
    } catch (error: any) {
      message.error(`删除失败: ${error.message}`);
    }
  };

  const handleExportPDF = async () => {
    if (questions.length === 0) {
      return message.warning('暂无错题可导出');
    }
    
    const element = document.getElementById('question-list-container');
    if (!element) return;
    
    setLoading(true);
    message.loading({ content: '正在生成PDF，请稍候...', key: 'pdf_export' });
    
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`错题本导出_${dayjs().format('YYYYMMDD')}.pdf`);
      
      message.success({ content: '导出成功！', key: 'pdf_export' });
    } catch (error) {
      console.error(error);
      message.error({ content: '导出失败，请重试', key: 'pdf_export' });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '题目预览',
      dataIndex: 'image_url',
      key: 'image_url',
      render: (url: string) => <Image src={url} width={80} className="rounded border" />,
    },
    {
      title: '科目',
      dataIndex: 'subject_name',
      key: 'subject',
    },
    {
      title: '知识点/错误类型',
      key: 'tags',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          {record.knowledge_points?.name && (
            <Tag color="blue">{record.knowledge_points.name}</Tag>
          )}
          {record.error_types?.name && (
            <Tag color="volcano">{record.error_types.name}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '错题场景',
      dataIndex: 'error_scenario',
      key: 'scenario',
    },
    {
      title: '错题日期',
      dataIndex: 'error_date',
      key: 'date',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: any) => (
        record.is_mastered ? 
          <Tag icon={<CheckCircleOutlined />} color="success">已掌握</Tag> :
          <Tag icon={<CloseCircleOutlined />} color="error">待复习</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="link" 
            className="px-0"
            onClick={() => toggleMasterStatus(record.id, record.is_mastered)}
          >
            {record.is_mastered ? '标为待复习' : '标为已掌握'}
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/mom/question/add?editId=${record.id}`)}
          />
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => {
              Modal.confirm({
                title: '确定要删除这道错题吗？',
                content: '删除后无法恢复',
                onOk: () => handleDelete(record.id)
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">错题管理</h2>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleExportPDF}
            loading={loading}
          >
            导出为PDF
          </Button>
        </div>
        <Row gutter={[16, 16]} className="mb-4">
          <Col span={6}>
            <Select
              className="w-full"
              placeholder="所有科目"
              allowClear
              onChange={setSubjectFilter}
            >
              {subjects.map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              className="w-full"
              placeholder="所有状态"
              allowClear
              onChange={setStatusFilter}
            >
              <Select.Option value="unmastered">待复习</Select.Option>
              <Select.Option value="mastered">已掌握</Select.Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              className="w-full"
              placeholder="错题场景"
              allowClear
              onChange={setScenarioFilter}
            >
              {errorScenarios.map(sc => (
                <Select.Option key={sc.id} value={sc.name}>{sc.name}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker 
              className="w-full" 
              onChange={setDateRange as any}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
        </Row>
        
        <div id="question-list-container" className="bg-white p-4">
          <Table
            columns={columns}
            dataSource={questions}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </div>
      </Card>
    </div>
  );
}
