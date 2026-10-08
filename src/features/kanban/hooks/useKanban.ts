import { JobStage } from '../../../types';
import { useData } from '../../../hooks/useData';

export const useKanban = () => {
  const { applications, updateApplication, addApplication, loading, error } = useData();

  return {
    applications,
    isLoading: loading,
    isError: !!error,
    error,
    updateStage: (id: string, stage: JobStage) => updateApplication(id, { stage }),
    addApplication,
  };
};
