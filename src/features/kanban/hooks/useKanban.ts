import { useMutation } from '@tanstack/react-query';
import { prepInterview } from '../api/prepInterview';
import { draftOutreach } from '../api/draftOutreach';
import { useData } from '../../../hooks/useData';

export const useKanban = () => {
  const { applications, updateApplication, loading, error } = useData();

  const generatePrepMutation = useMutation({
    mutationFn: prepInterview
  });

  return {
    applications,
    isLoading: loading,
    isError: !!error,
    error,
    updateStage: (id: string, stage: string) => updateApplication(id, { stage }),
    generatePrep: generatePrepMutation.mutateAsync,
    isPrepLoading: generatePrepMutation.isPending
  };
};
