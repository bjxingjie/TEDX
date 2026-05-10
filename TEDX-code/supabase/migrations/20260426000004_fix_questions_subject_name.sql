-- 增加 subject_name 字段
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_name VARCHAR(20);

-- 将已有的 subject_id 映射到 subject_name
UPDATE questions q
SET subject_name = s.name
FROM subjects s
WHERE q.subject_id = s.id AND q.subject_name IS NULL;

-- 使 subject_id 可以为空，以便逐步过渡到只使用 subject_name
ALTER TABLE questions ALTER COLUMN subject_id DROP NOT NULL;
