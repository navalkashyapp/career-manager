import { auth, db } from '../store/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile, CareerEntry, EducationEntry, CoreSkills } from '../types';

/**
 * Parses a LinkedIn profile export (JSON format) and maps the skills, roles, 
 * and education history.
 */
export function mapLinkedInDataToProfile(linkedInJSON: any): Partial<UserProfile> {
  const profileUpdates: Partial<UserProfile> = {};

  try {
    if (linkedInJSON.firstName || linkedInJSON.lastName) {
      profileUpdates.fullName = `${linkedInJSON.firstName || ''} ${linkedInJSON.lastName || ''}`.trim();
    }
    
    if (linkedInJSON.headline) {
      profileUpdates.targetTitle = linkedInJSON.headline;
    }
    
    if (linkedInJSON.address || linkedInJSON.location) {
      profileUpdates.location = linkedInJSON.address || linkedInJSON.location?.name || '';
    }

    if (Array.isArray(linkedInJSON.positions) || Array.isArray(linkedInJSON.experience)) {
      const positions = linkedInJSON.positions || linkedInJSON.experience;
      profileUpdates.careerHistory = positions.map((pos: any, idx: number) => {
        const startDate = pos.startDate ? `${pos.startDate.month || ''}/${pos.startDate.year || ''}`.replace(/^\//, '') : '';
        const endDate = pos.endDate ? `${pos.endDate.month || ''}/${pos.endDate.year || ''}`.replace(/^\//, '') : 'Present';
        
        return {
          id: `job-${Date.now()}-${idx}`,
          company: pos.companyName || pos.company || '',
          title: pos.title || pos.role || '',
          dates: startDate ? `${startDate} - ${endDate}` : '',
          location: pos.location || '',
          bullets: pos.description ? pos.description.split('\n').map((b: string) => b.trim()).filter(Boolean) : [],
        } as CareerEntry;
      });
    }

    if (Array.isArray(linkedInJSON.education) || Array.isArray(linkedInJSON.educations)) {
      const educations = linkedInJSON.education || linkedInJSON.educations;
      profileUpdates.education = educations.map((edu: any, idx: number) => {
        return {
          id: `edu-${Date.now()}-${idx}`,
          institution: edu.schoolName || edu.school || '',
          degree: edu.degreeName || edu.degree || '',
          fieldOfStudy: edu.fieldOfStudy || '',
          startDate: edu.startDate?.year ? edu.startDate.year.toString() : '',
          endDate: edu.endDate?.year ? edu.endDate.year.toString() : '',
        } as EducationEntry;
      });
    }

    if (Array.isArray(linkedInJSON.skills)) {
      const coreSkills: CoreSkills = {
        cloudInfrastructure: [],
        programmingLanguages: [],
        frameworks: [],
        certifications: [],
        programMethodologies: [],
      };
      
      const allSkills = linkedInJSON.skills.map((s: any) => typeof s === 'string' ? s : s.name);
      
      allSkills.forEach((skill: string) => {
        if (!skill) return;
        const s = skill.toLowerCase();
        if (s.includes('aws') || s.includes('cloud') || s.includes('azure') || s.includes('gcp')) {
          coreSkills.cloudInfrastructure.push(skill);
        } else if (s.includes('java') || s.includes('python') || s.includes('script') || s.includes('c++')) {
          coreSkills.programmingLanguages.push(skill);
        } else if (s.includes('react') || s.includes('angular') || s.includes('spring') || s.includes('node')) {
          coreSkills.frameworks.push(skill);
        } else if (s.includes('agile') || s.includes('scrum') || s.includes('kanban') || s.includes('management')) {
          coreSkills.programMethodologies.push(skill);
        } else {
          coreSkills.programMethodologies.push(skill);
        }
      });
      
      profileUpdates.coreSkills = coreSkills;
    }
  } catch (error) {
    console.error("Error mapping LinkedIn JSON to Profile:", error);
  }

  return profileUpdates;
}

/**
 * Automates profile creation by taking a LinkedIn JSON export and directly
 * writing the mapped skills, roles, and education history into Firestore for the current user.
 */
export async function importLinkedInDataToFirestore(linkedInJSON: any): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Cannot import LinkedIn data: User is not authenticated.");
  }
  
  const mappedData = mapLinkedInDataToProfile(linkedInJSON);
  
  if (Object.keys(mappedData).length === 0) {
    throw new Error("No valid profile data could be extracted from the provided JSON.");
  }

  const profileRef = doc(db, 'users', user.uid);
  
  // Note: we use updateDoc so we don't overwrite existing non-LinkedIn fields like id, 
  // unless we want to fully replace the document.
  await updateDoc(profileRef, mappedData);
}
