export const updateApplication = async ({ id, data }: { id: string; data: any }): Promise<void> => {
  const response = await fetch('/api/career-ops/tracker/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, data })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update application');
  }
};
