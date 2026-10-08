import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserProfile, JobApplication, JobSearchHistoryEntry } from '../types';
import { auth, db } from '../store/firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { TaskPollingService } from '../services/TaskPollingService';

const defaultProfile: UserProfile = {
  id: '',
  fullName: '',
  targetTitle: '',
  location: '',
  preferredCompensation: '',
  linkedinUrl: '',
  portfolioUrl: '',
  careerHistory: [],
  coreSkills: {
    cloudInfrastructure: [],
    programmingLanguages: [],
    frameworks: [],
    certifications: [],
    programMethodologies: [],
  },
  projects: [],
  resumeVersions: [],
  education: [],
  workAuthorization: [],
};

interface DataContextType {
  profile: UserProfile;
  profiles: UserProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  addProfile: (profile: Partial<UserProfile>) => Promise<string>;
  deleteProfile: (id: string) => Promise<void>;
  applications: JobApplication[];
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  addApplication: (app: JobApplication) => Promise<void>;
  updateApplication: (id: string, updates: Partial<JobApplication>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  searchHistory: JobSearchHistoryEntry[];
  addSearchHistory: (entry: JobSearchHistoryEntry) => Promise<void>;
  deleteSearchHistory: (id: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mainProfile, setMainProfile] = useState<UserProfile | null>(null);
  const [alternateProfiles, setAlternateProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('default');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [searchHistory, setSearchHistory] = useState<JobSearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollerRef = useRef<TaskPollingService | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setMainProfile(null);
        setAlternateProfiles([]);
        setApplications([]);
        setSearchHistory([]);
        setLoading(false);
        if (pollerRef.current) {
          pollerRef.current.stopPolling();
          pollerRef.current = null;
        }
        return;
      }
      const userId = user.uid;

      const profileRef = doc(db, 'users', userId);
      const unsubProfile = onSnapshot(
        profileRef,
        async (docSnap) => {
          try {
            if (docSnap.exists()) {
              setMainProfile({ ...docSnap.data(), isDefault: true } as UserProfile);
            } else {
              // Initialize with empty profile
              const initProfile = { ...defaultProfile, id: userId };
              await setDoc(profileRef, initProfile);
              setMainProfile({ ...initProfile, isDefault: true });
            }
          } catch (err: any) {
            console.error('Error fetching/initializing profile:', err);
            setError(err.message || 'Failed to load profile');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error('Profile snapshot error:', err);
          setError(err.message || 'Failed to load profile');
          setLoading(false);
        },
      );

      const profilesRef = collection(db, 'users', userId, 'profiles');
      const unsubProfiles = onSnapshot(
        profilesRef,
        (querySnapshot) => {
          const p: UserProfile[] = [];
          querySnapshot.forEach((doc) => {
            p.push({ ...doc.data(), id: doc.id, isDefault: false } as UserProfile);
          });
          setAlternateProfiles(p);
        },
        (err) => {
          console.error('Profiles snapshot error:', err);
        },
      );

      const appsRef = collection(db, 'users', userId, 'applications');
      const unsubApps = onSnapshot(
        appsRef,
        (querySnapshot) => {
          const apps: JobApplication[] = [];
          querySnapshot.forEach((doc) => {
            apps.push(doc.data() as JobApplication);
          });
          setApplications(apps);
        },
        (err) => {
          console.error('Applications snapshot error:', err);
          setError(err.message || 'Failed to load applications');
        },
      );

      const historyRef = collection(db, 'users', userId, 'jobsearchhistory');
      const unsubHistory = onSnapshot(
        historyRef,
        (querySnapshot) => {
          const h: JobSearchHistoryEntry[] = [];
          querySnapshot.forEach((doc) => {
            h.push(doc.data() as JobSearchHistoryEntry);
          });
          // Sort history by timestamp descending
          h.sort((a, b) => b.timestamp - a.timestamp);
          setSearchHistory(h);
        },
        (err) => {
          console.error('Search history snapshot error:', err);
        },
      );

      return () => {
        unsubProfile();
        unsubProfiles();
        unsubApps();
        unsubHistory();
        if (pollerRef.current) {
          pollerRef.current.stopPolling();
          pollerRef.current = null;
        }
      };
    });

    return () => unsubscribeAuth();
  }, []);

  // Recursively sanitize objects for setDoc by omitting any keys with undefined values
  const sanitizeFirestoreSet = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) {
        continue;
      }
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        result[key] = sanitizeFirestoreSet(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  // Convert top-level undefined fields to deleteField() for updateDoc, and sanitize nested structures
  const sanitizeFirestoreUpdate = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) {
        result[key] = deleteField();
      } else if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        result[key] = sanitizeFirestoreSet(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const cleanUpdates = sanitizeFirestoreUpdate(updates);
      if (activeProfileId === 'default' || activeProfileId === user.uid) {
        const ref = doc(db, 'users', user.uid);
        await updateDoc(ref, cleanUpdates);
      } else {
        const ref = doc(db, 'users', user.uid, 'profiles', activeProfileId);
        await updateDoc(ref, cleanUpdates);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  const addProfile = async (profileData: Partial<UserProfile>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const ref = doc(collection(db, 'users', user.uid, 'profiles'));
    const cleanData = sanitizeFirestoreSet({ ...profileData, id: ref.id });
    await setDoc(ref, cleanData);
    return ref.id;
  };

  const deleteProfile = async (id: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    if (id === 'default' || id === user.uid) throw new Error('Cannot delete main profile');
    const ref = doc(db, 'users', user.uid, 'profiles', id);
    await deleteDoc(ref);
    if (activeProfileId === id) setActiveProfileId('default');
  };

  const addApplication = async (app: JobApplication) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const appsRef = doc(collection(db, 'users', user.uid, 'applications'));
      const cleanApp = sanitizeFirestoreSet({ ...app, id: appsRef.id });
      await setDoc(appsRef, cleanApp);
    } catch (err: any) {
      console.error('Error adding application:', err);
      throw err;
    }
  };

  const updateApplication = async (id: string, updates: Partial<JobApplication>) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const appRef = doc(db, 'users', user.uid, 'applications', id);
      const cleanUpdates = sanitizeFirestoreUpdate({ ...updates, updatedAt: Date.now() });
      await updateDoc(appRef, cleanUpdates);
    } catch (err: any) {
      console.error('Error updating application:', err);
      throw err;
    }
  };

  useEffect(() => {
    // Google Task polling temporarily disabled
    /*
    if (auth.currentUser && applications.length > 0) {
      if (!pollerRef.current) {
        pollerRef.current = new TaskPollingService(applications, updateApplication);
        pollerRef.current.startPolling(60000); // 1 minute
      } else {
        pollerRef.current.updateDependencies(applications);
      }
    }
    */
  }, [applications]);

  const deleteApplication = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const appRef = doc(db, 'users', user.uid, 'applications', id);
      await deleteDoc(appRef);
    } catch (err: any) {
      console.error('Error deleting application:', err);
      throw err;
    }
  };

  const addSearchHistory = async (entry: JobSearchHistoryEntry) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'jobsearchhistory', entry.id);
      await setDoc(ref, entry);
    } catch (err: any) {
      console.error('Error adding search history:', err);
    }
  };

  const deleteSearchHistory = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const ref = doc(db, 'users', user.uid, 'jobsearchhistory', id);
      await deleteDoc(ref);
    } catch (err: any) {
      console.error('Error deleting search history:', err);
    }
  };

  const clearSearchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');
      const batch = writeBatch(db);
      searchHistory.forEach((entry) => {
        const ref = doc(db, 'users', user.uid, 'jobsearchhistory', entry.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (err: any) {
      console.error('Error clearing search history:', err);
    }
  };

  const activeProfile =
    activeProfileId === 'default'
      ? mainProfile || defaultProfile
      : alternateProfiles.find((p) => p.id === activeProfileId) || mainProfile || defaultProfile;

  return (
    <DataContext.Provider
      value={{
        profile: activeProfile,
        profiles: mainProfile ? [mainProfile, ...alternateProfiles] : alternateProfiles,
        activeProfileId,
        setActiveProfileId,
        addProfile,
        deleteProfile,
        applications,
        searchHistory,
        loading,
        error,
        updateProfile,
        addApplication,
        updateApplication,
        deleteApplication,
        addSearchHistory,
        deleteSearchHistory,
        clearSearchHistory,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
