import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, Input, List, Modal, Form, Select, message, Popconfirm, Tree, Typography, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { supabase } from '@/supabase/client';
import { SUBJECTS } from '@/lib/constants';

const { TabPane } = Tabs;
const { Text } = Typography;

export default function TagSettings() {
  const [activeKey, setActiveKey] = useState('1');
  
  // Knowledge Points State
  const [kpList, setKpList] = useState<any[]>([]);
  const [kpModalVisible, setKpModalVisible] = useState(false);
  const [editingKp, setEditingKp] = useState<any>(null);
  
  // Error Types State
  const [errorTypes, setErrorTypes] = useState<any[]>([]);
  const [errModalVisible, setErrModalVisible] = useState(false);
  const [editingErr, setEditingErr] = useState<any>(null);
  
  // Error Scenarios State
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [scModalVisible, setScModalVisible] = useState(false);
  const [editingSc, setEditingSc] = useState<any>(null);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const buildKnowledgePointTree = () => {
    const bySubject = SUBJECTS.map((subject) => {
      const subjectKps = kpList.filter((kp) => kp.subject_name === subject);
      const level1 = subjectKps.filter((kp) => !kp.parent_id);
      const childrenMap: Record<string, any[]> = {};
      subjectKps.forEach((kp) => {
        if (!kp.parent_id) return;
        childrenMap[kp.parent_id] = childrenMap[kp.parent_id] || [];
        childrenMap[kp.parent_id].push(kp);
      });
      return {
        title: subject,
        key: `subject-${subject}`,
        children: level1.map((l1) => ({
          title: l1.name,
          key: l1.id,
          children: (childrenMap[l1.id] || []).map((l2) => ({
            title: l2.name,
            key: l2.id,
          })),
        })),
      };
    });
    return bySubject.filter((node) => node.children.length > 0);
  };

  useEffect(() => {
    fetchData();
  }, [activeKey]);

  const fetchData = async () => {
    setLoading(true);
    if (activeKey === '1') {
      const { data } = await supabase.from('knowledge_points').select('*');
      if (data) {
        const sorted = [...data].sort((a: any, b: any) => {
          if (a.created_at && b.created_at) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return 0;
        });
        setKpList(sorted);
      } else {
        setKpList([]);
      }
    } else if (activeKey === '2') {
      const { data } = await supabase.from('error_types').select('*').order('name');
      setErrorTypes(data || []);
    } else if (activeKey === '3') {
      const { data } = await supabase.from('error_scenarios').select('*').order('name');
      setScenarios(data || []);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    setEditingKp(null);
    setEditingErr(null);
    setEditingSc(null);
    form.resetFields();
    if (activeKey === '1') setKpModalVisible(true);
    if (activeKey === '2') setErrModalVisible(true);
    if (activeKey === '3') setScModalVisible(true);
  };

  const handleEdit = (record: any) => {
    form.setFieldsValue(record);
    if (activeKey === '1') {
      // In knowledge points, subject_id might need to be matched to subject name if we changed it, 
      // but currently kp table relies on subject_id. Wait, we changed subjects to hardcoded.
      // So we'll map subject_name directly to knowledge_points in our new approach.
      // Let's just use a simple text field `subject_name` for kp.
      setEditingKp(record);
      setKpModalVisible(true);
    }
    if (activeKey === '2') {
      setEditingErr(record);
      setErrModalVisible(true);
    }
    if (activeKey === '3') {
      setEditingSc(record);
      setScModalVisible(true);
    }
  };

  const handleDelete = async (id: string) => {
    let table = '';
    if (activeKey === '1') table = 'knowledge_points';
    if (activeKey === '2') table = 'error_types';
    if (activeKey === '3') table = 'error_scenarios';

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) message.error(error.message);
    else {
      message.success('删除成功');
      fetchData();
    }
  };

  const onFinish = async (values: any) => {
    let table = '';
    let payload = { ...values };
    let editingId = null;

    if (activeKey === '1') {
      table = 'knowledge_points';
      editingId = editingKp?.id;
      // if it's level 1, parent_id should be null
      if (payload.level === 1) {
        payload.parent_id = null;
      }
    } else if (activeKey === '2') {
      table = 'error_types';
      editingId = editingErr?.id;
    } else if (activeKey === '3') {
      table = 'error_scenarios';
      editingId = editingSc?.id;
    }

    try {
      if (editingId) {
        await supabase.from(table).update(payload).eq('id', editingId);
      } else {
        await supabase.from(table).insert([payload]);
      }
      message.success('保存成功');
      setKpModalVisible(false);
      setErrModalVisible(false);
      setScModalVisible(false);
      fetchData();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  return (
    <Card title="标签自定义设置" className="shadow-sm">
      <Tabs activeKey={activeKey} onChange={setActiveKey} tabBarExtraContent={<Button type="primary" onClick={handleAdd} icon={<PlusOutlined />}>添加标签</Button>}>
        <TabPane tab="知识点管理" key="1">
          <Card size="small" className="mb-4" title="知识点结构（科目 → 一级标签 → 二级标签）">
            {buildKnowledgePointTree().length > 0 ? (
              <Tree treeData={buildKnowledgePointTree()} defaultExpandAll selectable={false} />
            ) : (
              <Text type="secondary">暂无知识点数据</Text>
            )}
            <Divider className="my-3" />
            <Text type="secondary">提示：录入错题时仅可选择最末级标签（若存在二级标签，则一级标签不可直接选择）。</Text>
          </Card>
          <List
            loading={loading}
            dataSource={kpList}
            renderItem={item => {
              const parentName = item.parent_id ? kpList.find(k => k.id === item.parent_id)?.name : '无';
              return (
              <List.Item
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>,
                  <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta title={item.name} description={`关联科目：${item.subject_name || '未指定'} | 级别：${item.level === 1 ? '一级' : '二级'} | 父级：${parentName}`} />
              </List.Item>
            )}}
          />
        </TabPane>
        <TabPane tab="错误原因管理" key="2">
          <List
            loading={loading}
            dataSource={errorTypes}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>,
                  <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta title={item.name} />
              </List.Item>
            )}
          />
        </TabPane>
        <TabPane tab="错误场景管理" key="3">
          <List
            loading={loading}
            dataSource={scenarios}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(item)}>编辑</Button>,
                  <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta title={item.name} />
              </List.Item>
            )}
          />
        </TabPane>
      </Tabs>

      {/* Common Modal for Forms */}
      <Modal
        title={editingKp || editingErr || editingSc ? '编辑标签' : '新增标签'}
        open={kpModalVisible || errModalVisible || scModalVisible}
        onCancel={() => { setKpModalVisible(false); setErrModalVisible(false); setScModalVisible(false); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="标签名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {activeKey === '1' && (
            <>
              <Form.Item name="subject_name" label="关联科目" rules={[{ required: true }]}>
                <Select>
                  {SUBJECTS.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="level" label="知识点级别" initialValue={1}>
                <Select>
                  <Select.Option value={1}>一级知识点</Select.Option>
                  <Select.Option value={2}>二级知识点</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.level !== currentValues.level || prevValues.subject_name !== currentValues.subject_name
                }
              >
                {({ getFieldValue }) => {
                  const level = getFieldValue('level');
                  const subName = getFieldValue('subject_name');
                  if (level === 2) {
                    const parents = kpList.filter(k => k.level === 1 && k.subject_name === subName);
                    return (
                      <Form.Item name="parent_id" label="父级知识点" rules={[{ required: true, message: '请选择父级知识点' }]}>
                        <Select placeholder="选择一级知识点">
                          {parents.map(p => (
                            <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    );
                  }
                  return null;
                }}
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
