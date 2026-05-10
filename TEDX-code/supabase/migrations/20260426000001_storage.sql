-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can update images" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can delete images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'question-images');

-- Since we are doing a local app prototype with minimal auth, we can just allow anon as well
CREATE POLICY "Anon users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Anon users can update images" 
ON storage.objects FOR UPDATE 
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Anon users can delete images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'question-images');
