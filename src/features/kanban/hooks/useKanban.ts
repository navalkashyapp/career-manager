import { useData } from '../../../hooks/useData';

export const useKanban = () => {
  const { applications, updateApplication, loading, error } = useData();

  return {
    applications,
    isLoading: loading,
    isError: !!error,
    error,
    updateStage: (id: string, stage: string) => updateApplication(id, { stage })
  };
};
