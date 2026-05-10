-- Add parent_id for cascading knowledge points
ALTER TABLE knowledge_points ADD COLUMN parent_id UUID REFERENCES knowledge_points(id) ON DELETE CASCADE;
