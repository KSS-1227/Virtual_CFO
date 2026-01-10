export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DocumentProcessingError';
  }
}

export const handleOpenAIError = (error: any): DocumentProcessingError => {
  if (error.status === 401) {
    return new DocumentProcessingError(
      'Invalid OpenAI API key. Please check your configuration.',
      'INVALID_API_KEY'
    );
  }
  
  if (error.status === 429) {
    return new DocumentProcessingError(
      'Rate limit exceeded. Please try again in a few minutes.',
      'RATE_LIMIT'
    );
  }
  
  if (error.status === 413) {
    return new DocumentProcessingError(
      'File too large. Please use a smaller image.',
      'FILE_TOO_LARGE'
    );
  }
  
  return new DocumentProcessingError(
    'Failed to process document. Please try again.',
    'PROCESSING_FAILED',
    error
  );
};

export const compressImage = (file: File, maxSizeMB: number = 2): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      const maxWidth = 1024;
      const maxHeight = 1024;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.8
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};