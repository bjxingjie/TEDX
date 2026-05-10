-- 为知识点补充创建时间，便于按创建顺序稳定排序
ALTER TABLE knowledge_points
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 为历史数据补写创建时间（若为空）
UPDATE knowledge_points
SET created_at = NOW()
WHERE created_at IS NULL;

