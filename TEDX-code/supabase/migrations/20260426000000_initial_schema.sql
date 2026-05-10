-- Drop existing tables to allow safe re-runs
DROP TABLE IF EXISTS review_items CASCADE;
DROP TABLE IF EXISTS review_sessions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS error_types CASCADE;
DROP TABLE IF EXISTS knowledge_points CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(10) NOT NULL CHECK (role IN ('mom', 'child')),
  is_preset BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(20) NOT NULL,
  grade VARCHAR(10) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  parent_id UUID REFERENCES knowledge_points(id),
  level INTEGER DEFAULT 1
);

CREATE TABLE error_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  category VARCHAR(50),
  description TEXT
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  image_url TEXT,
  text_content TEXT,
  error_reason VARCHAR(100),
  error_scenario VARCHAR(20) CHECK (error_scenario IN ('日常作业', '小测', '月考', '大考')),
  error_date DATE,
  upload_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  knowledge_point_id UUID REFERENCES knowledge_points(id),
  error_type_id UUID REFERENCES error_types(id),
  difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  source VARCHAR(50),
  is_mastered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE review_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  performance_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_session_id UUID NOT NULL REFERENCES review_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
  feedback TEXT,
  answered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert preset subjects
INSERT INTO subjects (name, grade, sort_order) VALUES
('数学', '小学', 1), ('语文', '小学', 2), ('英语', '小学', 3),
('数学', '初中', 4), ('语文', '初中', 5), ('英语', '初中', 6);

-- Insert preset users
INSERT INTO users (username, password, name, role, is_preset) VALUES
('妈妈', '123', '妈妈', 'mom', TRUE),
('邢洲', '456', '邢洲', 'child', TRUE);

-- Insert preset error types
INSERT INTO error_types (name, category) VALUES
('计算错误', '基础'), ('概念混淆', '基础'), ('审题不清', '习惯'), ('思路卡壳', '思维');

-- Insert some preset knowledge points for demo
DO $$ 
DECLARE 
    math_id UUID;
BEGIN
    SELECT id INTO math_id FROM subjects WHERE name = '数学' AND grade = '小学' LIMIT 1;
    IF math_id IS NOT NULL THEN
        INSERT INTO knowledge_points (subject_id, name, level) VALUES
        (math_id, '加减法', 1),
        (math_id, '乘除法', 1),
        (math_id, '分数', 1),
        (math_id, '几何图形', 1);
    END IF;
END $$;

-- For demo purposes and simpler implementation, disable RLS to allow our custom users table to work with the anon key
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE error_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_items DISABLE ROW LEVEL SECURITY;

-- But we also need to make sure the tables are accessible to anon/authenticated roles
GRANT ALL ON users TO anon, authenticated;
GRANT ALL ON subjects TO anon, authenticated;
GRANT ALL ON knowledge_points TO anon, authenticated;
GRANT ALL ON error_types TO anon, authenticated;
GRANT ALL ON questions TO anon, authenticated;
GRANT ALL ON review_sessions TO anon, authenticated;
GRANT ALL ON review_items TO anon, authenticated;
