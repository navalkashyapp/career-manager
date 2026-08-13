export const draftOutreach = async ({ 
  jdText, 
  profileData, 
  messageType 
}: { 
  jdText: string; 
  profileData: any; 
  messageType: string;
}): Promise<{ subject: string; body: string }> => {
  const res = await fetch('/api/gemini/draft-outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jdText, profileData, messageType })
  });
  
  if (!res.ok) {
    throw new Error('Failed to generate outreach draft');
  }
  
  return await res.json();
};
