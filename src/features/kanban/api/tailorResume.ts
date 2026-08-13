import type { UserProfile } from '../../../types';

export const tailorResume = async ({ 
  userProfile, 
  jobDescription,
  archetype = 'Software Engineer' 
}: { 
  userProfile: UserProfile; 
  jobDescription: string;
  archetype?: string;
}): Promise<any> => {
  const res = await fetch('/api/career-ops/tailor-cv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userProfile, 
      jobDescription, 
      masterCvText: JSON.stringify(userProfile), // Just stringify the profile for masterCvText as a fallback
      archetype 
    })
  });
  
  if (!res.ok) {
    throw new Error('Failed to tailor resume');
  }
  
  return await res.json();
};
