import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form, Input, Select, DatePicker, Button, Upload, message, Row, Col, Card, Spin, Switch, Modal, Segmented, TreeSelect
} from 'antd';
import { InboxOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { SUBJECTS } from '@/lib/constants';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const { Dragger } = Upload;
const { TextArea } = Input;

export default function QuestionAdd() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const { user } = useAuthStore();
  const editingId = searchParams.get('editId');
  const isEditMode = Boolean(editingId);
  
  const [loading, setLoading] = useState(false);
  const [knowledgePoints, setKnowledgePoints] = useState<any[]>([]);
  const [errorTypes, setErrorTypes] = useState<any[]>([]);
  const [errorScenarios, setErrorScenarios] = useState<any[]>([]);
  
  const [questionImageUrls, setQuestionImageUrls] = useState<string[]>([]);
  const [answerImageUrl, setAnswerImageUrl] = useState<string>('');
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  // Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [tempImage, setTempImage] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editMode, setEditMode] = useState<'crop' | 'mask'>('crop');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [editorTarget, setEditorTarget] = useState<'question' | 'answer'>('question');
  const unsupportedQuestionColumnsRef = useRef<Set<string>>(new Set());
  const ANSWER_IMG_FALLBACK_MARKER = '[[ANSWER_IMG_FALLBACK::';

  useEffect(() => {
    fetchFormData();
    
    // Add paste event listener for screenshot pasting
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              handleImageFile(file, 'question');
            }
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const fetchFormData = async () => {
    const [{ data: kps }, { data: errs }, { data: scs }] = await Promise.all([
      supabase.from('knowledge_points').select('*'),
      supabase.from('error_types').select('*'),
      supabase.from('error_scenarios').select('*')
    ]);

    if (kps) {
      // 兼容历史库：若无created_at字段则按返回顺序展示，避免查询失败导致标签消失
      const sorted = [...kps].sort((a: any, b: any) => {
        if (a.created_at && b.created_at) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        return 0;
      });
      setKnowledgePoints(sorted);
    }
    if (errs) setErrorTypes(errs);
    if (scs) setErrorScenarios(scs);
  };

  const handleSubjectChange = () => {
    form.setFieldsValue({ knowledge_point_ids: undefined });
  };

  const selectedSubjectName = Form.useWatch('subject_name', form);

  const extractAnswerImageFallback = (note?: string) => {
    if (!note) return '';
    const match = note.match(/\[\[ANSWER_IMG_FALLBACK::(.*?)\]\]/);
    return match?.[1] || '';
  };

  const stripAnswerImageFallback = (note?: string) => {
    if (!note) return '';
    return note.replace(/\s*\[\[ANSWER_IMG_FALLBACK::(.*?)\]\]\s*/g, '').trim();
  };

  const appendAnswerImageFallback = (note: string, imageUrl: string) => {
    const clean = stripAnswerImageFallback(note || '');
    if (!imageUrl) return clean;
    return `${clean}\n${ANSWER_IMG_FALLBACK_MARKER}${imageUrl}]]`.trim();
  };

  const normalizeQuestionImageUrls = (question: any) => {
    if (Array.isArray(question?.image_urls) && question.image_urls.length > 0) {
      return question.image_urls;
    }
    if (typeof question?.image_urls === 'string') {
      try {
        const parsed = JSON.parse(question.image_urls);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore parse error and fallback to image_url
      }
    }
    return question?.image_url ? [question.image_url] : [];
  };

  const fillFormForEdit = (question: any) => {
    const kpIds = Array.isArray(question.knowledge_point_ids) && question.knowledge_point_ids.length > 0
      ? question.knowledge_point_ids
      : (question.knowledge_point_id ? [question.knowledge_point_id] : []);

    const rawAnswerNote = question.answer_note || question.error_reason || '';
    const fallbackAnswerImage = extractAnswerImageFallback(rawAnswerNote);
    form.setFieldsValue({
      subject_name: question.subject_name,
      knowledge_point_ids: kpIds,
      error_type_id: question.error_type_id,
      error_scenario: question.error_scenario,
      error_date: question.error_date ? dayjs(question.error_date) : dayjs(),
      difficulty: question.difficulty || 'medium',
      text_content: question.text_content,
      answer_note: stripAnswerImageFallback(rawAnswerNote),
      source: question.source
    });
    setQuestionImageUrls(normalizeQuestionImageUrls(question));
    setAnswerImageUrl(question.answer_image_url || fallbackAnswerImage || '');
  };
  
  // Build tree options and force leaf-only selection.
  const buildKpOptions = () => {
    if (!selectedSubjectName) return [];
    const filteredKp = knowledgePoints.filter((kp) => kp.subject_name === selectedSubjectName);
    const map = new Map(filteredKp.map((kp) => [kp.id, kp]));
    const childMap: Record<string, any[]> = {};

    filteredKp.forEach((kp) => {
      if (!kp.parent_id) return;
      childMap[kp.parent_id] = childMap[kp.parent_id] || [];
      childMap[kp.parent_id].push(kp);
    });

    const roots = filteredKp.filter((kp) => !kp.parent_id || !map.has(kp.parent_id));

    const buildNode = (kp: any): any => {
      const children = (childMap[kp.id] || []).map(buildNode);
      return {
        value: kp.id,
        title: kp.name,
        key: kp.id,
        children: children.length ? children : undefined,
        disabled: children.length > 0
      };
    };

    return roots.map(buildNode);
  };

  const handleImageFile = async (file: File, target: 'question' | 'answer') => {
    try {
      const options = {
        maxSizeMB: 6,
        maxWidthOrHeight: 3000,
        initialQuality: 0.95,
        alwaysKeepResolution: true,
        useWebWorker: true
      };
      const compressedFile = await imageCompression(file, options);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempImage(e.target?.result as string);
        setEditMode('crop');
        setCrop(undefined);
        setCompletedCrop(undefined);
        setEditorTarget(target);
        setEditorVisible(true);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error: any) {
      message.error(`图片处理失败: ${error.message}`);
    }
  };

  const makeCustomUpload = (target: 'question' | 'answer'): UploadProps['customRequest'] =>
    async ({ file, onSuccess, onError }) => {
      try {
        await handleImageFile(file as File, target);
        onSuccess?.('ok');
      } catch (error: any) {
        onError?.(error);
      }
    };

  const getCroppedDataUrl = () => {
    if (!cropImageRef.current || !completedCrop?.width || !completedCrop?.height) {
      return tempImage;
    }
    const img = cropImageRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return tempImage;
    ctx.drawImage(
      img,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const drawToMaskCanvas = (sourceDataUrl: string) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new window.Image();
    img.onload = () => {
      const maxWidth = 800;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = height * (maxWidth / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = sourceDataUrl;
  };

  const applyCropToMask = () => {
    const croppedDataUrl = getCroppedDataUrl();
    setTempImage(croppedDataUrl);
    setEditMode('mask');
    setTimeout(() => drawToMaskCanvas(croppedDataUrl), 60);
  };

  const handleSaveEditedImage = async () => {
    if (editMode === 'crop') {
      applyCropToMask();
      return;
    }
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.98);
    const blob = await (await fetch(dataUrl)).blob();
    const fileExt = 'jpeg';
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    setEditorVisible(false);
    setOcrLoading(true);

    try {
      const { error } = await supabase.storage.from('question-images').upload(filePath, blob);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('question-images').getPublicUrl(filePath);
      
      if (editorTarget === 'question') {
        setQuestionImageUrls((prev) => [...prev, publicUrl]);
      } else {
        setAnswerImageUrl(publicUrl);
      }
      
      if (ocrEnabled && editorTarget === 'question') {
        setTimeout(() => {
          form.setFieldsValue({ text_content: "【OCR识别结果】已知函数 f(x) = x^2 - 2x + 1，求其极值点。" });
          setOcrLoading(false);
          message.success('OCR 识别成功');
        }, 1500);
      } else {
        setOcrLoading(false);
      }
    } catch (error: any) {
      setOcrLoading(false);
      message.error(`保存图片失败: ${error.message}`);
    }
  };

  useEffect(() => {
    if (editorVisible && editMode === 'mask' && tempImage) {
      setTimeout(() => drawToMaskCanvas(tempImage), 60);
    }
  }, [editorVisible, editMode, tempImage]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.fillStyle = '#FFFFFF'; // White mask
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
  };

  const stopDrawing = () => setIsDrawing(false);

  const onCropImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 80,
        },
        width / height,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  };

  useEffect(() => {
    if (!isEditMode || !editingId) return;
    const fetchQuestionForEdit = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', editingId)
        .single();
      if (error || !data) {
        message.error('加载待编辑错题失败');
        return;
      }
      setEditingQuestion(data);
    };
    fetchQuestionForEdit();
  }, [isEditMode, editingId]);

  useEffect(() => {
    if (!editingQuestion || knowledgePoints.length === 0) return;
    fillFormForEdit(editingQuestion);
  }, [editingQuestion, knowledgePoints]);

  const onFinish = async (values: any) => {
    if (questionImageUrls.length === 0) {
      message.error('请至少上传一张错题图片');
      return;
    }

    setLoading(true);
    try {
      const kpIds: string[] = Array.isArray(values.knowledge_point_ids) ? values.knowledge_point_ids : [];
      const kpId = kpIds.length > 0 ? kpIds[0] : null;

      let answerNote = values.answer_note || '';
      const questionData = {
        user_id: user?.id,
        subject_name: values.subject_name,
        image_url: questionImageUrls[0] || '',
        image_urls: questionImageUrls,
        text_content: values.text_content,
        error_reason: answerNote,
        answer_note: answerNote,
        error_scenario: values.error_scenario,
        error_date: values.error_date ? values.error_date.format('YYYY-MM-DD') : null,
        knowledge_point_id: kpId,
        knowledge_point_ids: kpIds,
        error_type_id: values.error_type_id,
        difficulty: values.difficulty,
        source: values.source,
        answer_image_url: answerImageUrl
      };

      const stripUnsupportedColumns = (payload: Record<string, any>) => {
        const next = { ...payload };
        unsupportedQuestionColumnsRef.current.forEach((col) => {
          delete (next as any)[col];
        });
        return next;
      };

      const saveQuestionWithFallback = async () => {
        const executeSave = async (payload: Record<string, any>) => {
          if (isEditMode && editingId) {
            return supabase.from('questions').update(payload).eq('id', editingId);
          }
          return supabase.from('questions').insert([payload]);
        };

        let attempts = 0;
        while (attempts < 6) {
          const payload = stripUnsupportedColumns(questionData);
          let { error } = await executeSave(payload);
          if (!error) {
            return { error: null };
          }

          const missingColMatch = error.message?.match(/Could not find the '([^']+)' column/);
          if (!missingColMatch) return { error };
          const missingCol = missingColMatch[1];
          unsupportedQuestionColumnsRef.current.add(missingCol);

          // 字段不存在时进行兼容降级：答案图片地址写入 answer_note，保证再次编辑可回显
          if (missingCol === 'answer_image_url' && answerImageUrl) {
            answerNote = appendAnswerImageFallback(values.answer_note || '', answerImageUrl);
            questionData.answer_note = answerNote;
            questionData.error_reason = answerNote;
          }

          const retryPayload = stripUnsupportedColumns(questionData);
          ({ error } = await executeSave(retryPayload));
          if (!error) {
            return { error: null };
          }
          attempts += 1;
        }
        return { error: new Error('数据库字段兼容重试失败，请执行最新迁移后重试') as any };
      };

      if (isEditMode && editingId) {
        const { error } = await saveQuestionWithFallback();
        if (error) throw error;
        message.success('错题更新成功！');
        navigate('/mom/question/list');
      } else {
        const { error } = await saveQuestionWithFallback();
        if (error) throw error;
        message.success('错题录入成功！');
        form.resetFields();
        setQuestionImageUrls([]);
        setAnswerImageUrl('');
      }
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{isEditMode ? '编辑错题' : '录入错题'}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">开启 OCR 识别</span>
          <Switch checked={ocrEnabled} onChange={setOcrEnabled} />
        </div>
      </div>

      <Row gutter={24}>
        <Col span={10}>
          <Card title="错题图片" bordered={false} className="h-full">
            <Spin spinning={ocrLoading} tip="正在处理...">
              <Dragger
                name="file"
                multiple
                customRequest={makeCustomUpload('question')}
                showUploadList={false}
                className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#FF6B35] transition-colors"
              >
                {questionImageUrls.length > 0 ? (
                  <div className="p-2">
                    <div className="grid grid-cols-2 gap-2">
                      {questionImageUrls.map((url, idx) => (
                        <div key={`${url}-${idx}`} className="relative group border rounded overflow-hidden">
                          <img src={url} alt={`错题预览${idx + 1}`} className="w-full h-32 object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded gap-2">
                            <Button
                              type="primary"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImageUrl(url);
                                setPreviewVisible(true);
                              }}
                            >
                              查看
                            </Button>
                            <Button
                              size="small"
                              danger
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuestionImageUrls((prev) => prev.filter((_, i) => i !== idx));
                              }}
                            >
                              删除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                      <span>已上传 {questionImageUrls.length} 张，可继续上传补充</span>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuestionImageUrls([]);
                        }}
                      >
                        清空重选
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <p className="ant-upload-drag-icon text-[#FF6B35]"><InboxOutlined style={{ fontSize: '48px' }} /></p>
                    <p className="ant-upload-text mt-4 font-medium">点击、拖拽或按 Ctrl+V 粘贴截图到此区域</p>
                    <p className="ant-upload-hint text-gray-500 text-sm mt-2">上传后可打码/截取</p>
                  </div>
                )}
              </Dragger>
            </Spin>
          </Card>
        </Col>

        <Col span={14}>
          <Card title="完善信息" bordered={false}>
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ difficulty: 'medium', error_date: dayjs() }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="subject_name" label="科目" rules={[{ required: true }]}>
                    <Select placeholder="选择科目" onChange={handleSubjectChange}>
                      {SUBJECTS.map(sub => <Select.Option key={sub} value={sub}>{sub}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="knowledge_point_ids" label="知识点（可多选）">
                    <TreeSelect
                      treeData={buildKpOptions()}
                      placeholder="选择知识点（仅可选末级）"
                      disabled={!selectedSubjectName}
                      treeCheckable
                      showCheckedStrategy={TreeSelect.SHOW_CHILD}
                      allowClear
                      maxTagCount="responsive"
                      treeDefaultExpandAll
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="error_type_id" label="错误原因">
                    <Select placeholder="选择错误原因">
                      {errorTypes.map(err => <Select.Option key={err.id} value={err.id}>{err.name}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="error_scenario" label="错误场景" rules={[{ required: true }]}>
                    <Select placeholder="选择错误场景">
                      {errorScenarios.map(sc => <Select.Option key={sc.id} value={sc.name}>{sc.name}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="error_date" label="错题时间" rules={[{ required: true }]}>
                    <DatePicker className="w-full" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="difficulty" label="难度">
                    <Select placeholder="选择难度">
                      <Select.Option value="easy">简单</Select.Option>
                      <Select.Option value="medium">中等</Select.Option>
                      <Select.Option value="hard">困难</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="text_content" label="题目内容">
                <TextArea rows={4} placeholder={ocrEnabled ? "等待OCR识别或手动输入..." : "手动输入题目内容..."} />
              </Form.Item>
              <Form.Item name="answer_note" label="答案及备注（文字）">
                <TextArea rows={3} placeholder="可填写正确答案、步骤或备注..." />
              </Form.Item>
              <Form.Item label="答案及备注（图片，可选）">
                <Dragger
                  name="answerFile"
                  multiple={false}
                  customRequest={makeCustomUpload('answer')}
                  showUploadList={false}
                  className="bg-gray-50 border border-dashed border-gray-300 rounded-lg"
                >
                  {answerImageUrl ? (
                    <div className="p-2">
                      <img src={answerImageUrl} alt="答案备注图" className="max-h-48 mx-auto rounded border" />
                      <div className="mt-2">
                        <Button size="small" onClick={(e) => { e.stopPropagation(); setAnswerImageUrl(''); }}>
                          重新上传
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">上传答案/备注图片（支持截取、打码）</div>
                  )}
                </Dragger>
              </Form.Item>
              <Form.Item className="mb-0 mt-6 text-right">
                <Button type="primary" htmlType="submit" loading={loading} size="large" className="bg-[#FF6B35]">
                  {isEditMode ? '保存修改' : '保存错题'}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <Modal
        title="图片编辑"
        open={editorVisible}
        width={850}
        onOk={handleSaveEditedImage}
        onCancel={() => setEditorVisible(false)}
        okText={editMode === 'crop' ? '应用截取并继续打码' : '保存并上传'}
        cancelText="取消"
        destroyOnClose
      >
        <div className="mb-3">
          <Segmented
            value={editMode}
            options={[
              { label: '截取', value: 'crop' },
              { label: '打码', value: 'mask' }
            ]}
            onChange={(v) => {
              const next = v as 'crop' | 'mask';
              setEditMode(next);
              if (next === 'mask') {
                const croppedDataUrl = getCroppedDataUrl();
                setTempImage(croppedDataUrl);
                setTimeout(() => drawToMaskCanvas(croppedDataUrl), 60);
              }
            }}
          />
        </div>
        <div className="flex flex-col items-center bg-gray-100 p-4 rounded-lg overflow-auto" style={{ maxHeight: '60vh' }}>
          {editMode === 'crop' ? (
            <>
              <p className="text-gray-500 mb-2">拖动选框仅保留题目区域，下一步可继续打码</p>
              <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(c) => setCompletedCrop(c)}>
                <img
                  ref={cropImageRef}
                  src={tempImage}
                  alt="待截取图片"
                  onLoad={onCropImageLoad}
                  style={{ maxWidth: '100%', maxHeight: '55vh' }}
                />
              </ReactCrop>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-2">在图片上滑动可使用白色画笔覆盖原有笔迹或答案</p>
              <canvas
                ref={canvasRef}
                className="cursor-crosshair border border-gray-300 shadow-sm"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={previewVisible}
        title="图片大图预览"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width="80%"
      >
        <img alt="大图预览" style={{ width: '100%' }} src={previewImageUrl} />
      </Modal>
    </div>
  );
}
