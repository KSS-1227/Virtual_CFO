-- Create document_fingerprints table for duplicate detection
CREATE TABLE public.document_fingerprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_hash TEXT NOT NULL,
  content_hash TEXT,
  visual_hash TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  extracted_data JSONB,
  processed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.document_fingerprints ENABLE ROW LEVEL SECURITY;

-- Create policies for document_fingerprints
CREATE POLICY "Users can view own fingerprints" 
ON public.document_fingerprints 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fingerprints" 
ON public.document_fingerprints 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fingerprints" 
ON public.document_fingerprints 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fingerprints" 
ON public.document_fingerprints 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER on_fingerprints_updated
  BEFORE UPDATE ON public.document_fingerprints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_fingerprints_user_id ON public.document_fingerprints(user_id);
CREATE INDEX idx_fingerprints_file_hash ON public.document_fingerprints(file_hash);
CREATE INDEX idx_fingerprints_content_hash ON public.document_fingerprints(content_hash);
CREATE INDEX idx_fingerprints_processed_at ON public.document_fingerprints(processed_at DESC);

-- Create composite index for duplicate checking
CREATE INDEX idx_fingerprints_user_file_hash ON public.document_fingerprints(user_id, file_hash);
CREATE INDEX idx_fingerprints_user_content_hash ON public.document_fingerprints(user_id, content_hash);

-- Add comments for documentation
COMMENT ON TABLE public.document_fingerprints IS 'Stores document fingerprints for duplicate detection';
COMMENT ON COLUMN public.document_fingerprints.file_hash IS 'SHA256 hash of the original file content';
COMMENT ON COLUMN public.document_fingerprints.content_hash IS 'MD5 hash of extracted business data for similarity matching';
COMMENT ON COLUMN public.document_fingerprints.visual_hash IS 'Perceptual hash for image similarity detection';
COMMENT ON COLUMN public.document_fingerprints.extracted_data IS 'JSON object containing the extracted business data';
COMMENT ON COLUMN public.document_fingerprints.processed_at IS 'When the document was processed and fingerprinted';