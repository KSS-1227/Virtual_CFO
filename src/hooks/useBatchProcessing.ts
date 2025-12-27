import { useState, useCallback } from 'react';
import { openaiVisionService, type BatchProcessingResult } from '@/services/openaiVision';

interface BatchProcessingState {
  isProcessing: boolean;
  progress: {
    completed: number;
    total: number;
    currentFile: string;
  };
  results: BatchProcessingResult | null;
  error: string | null;
}

export const useBatchProcessing = () => {
  const [state, setState] = useState<BatchProcessingState>({
    isProcessing: false,
    progress: { completed: 0, total: 0, currentFile: '' },
    results: null,
    error: null
  });

  const processBatch = useCallback(async (files: File[]) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      error: null,
      results: null,
      progress: { completed: 0, total: files.length, currentFile: '' }
    }));

    try {
      const results = await openaiVisionService.analyzeBatchDocuments(
        files,
        (completed, total, currentFile) => {
          setState(prev => ({
            ...prev,
            progress: { completed, total, currentFile }
          }));
        }
      );

      setState(prev => ({
        ...prev,
        results,
        isProcessing: false
      }));

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch processing failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isProcessing: false
      }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: { completed: 0, total: 0, currentFile: '' },
      results: null,
      error: null
    });
  }, []);

  return {
    ...state,
    processBatch,
    reset
  };
};