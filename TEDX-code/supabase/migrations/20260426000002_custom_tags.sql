-- 1. Remove old error_scenario constraint
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_error_scenario_check;

-- 3. Create error_scenarios table
CREATE TABLE IF NOT EXISTS error_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE
);
ALTER TABLE error_scenarios DISABLE ROW LEVEL SECURITY;
GRANT ALL ON error_scenarios TO anon, authenticated;

INSERT INTO error_scenarios (name) VALUES
('日常作业'),
('小测'),
('月考'),
('大考')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE questions ALTER COLUMN error_scenario TYPE VARCHAR(50);
