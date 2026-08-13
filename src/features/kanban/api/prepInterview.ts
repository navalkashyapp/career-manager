export const prepInterview = async ({ jdText, companyName }: { jdText: string; companyName: string }): Promise<any> => {
  const res = await fetch('/api/gemini/prep-interview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jdText, companyName })
  });
  
  if (!res.ok) {
    throw new Error('Failed to generate interview prep');
  }
  
  return await res.json();
};
