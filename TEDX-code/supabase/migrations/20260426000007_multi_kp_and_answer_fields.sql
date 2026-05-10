-- 支持一道题多个知识点标签
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS knowledge_point_ids UUID[] DEFAULT '{}';

-- 兼容历史数据：将旧的单知识点写入数组
UPDATE questions
SET knowledge_point_ids = ARRAY[knowledge_point_id]
WHERE knowledge_point_id IS NOT NULL
  AND (knowledge_point_ids IS NULL OR array_length(knowledge_point_ids, 1) IS NULL);

-- 支持录入“答案及备注”文字与图片
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS answer_note TEXT,
ADD COLUMN IF NOT EXISTS answer_image_url TEXT;

