ALTER TABLE knowledge_points ADD COLUMN subject_name VARCHAR(20);

UPDATE knowledge_points kp
SET subject_name = s.name
FROM subjects s
WHERE kp.subject_id = s.id;

-- Make subject_name nullable for now to avoid breaking inserts
-- It's already nullable by default when adding column
