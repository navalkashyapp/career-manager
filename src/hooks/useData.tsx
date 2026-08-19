import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { UserProfile, JobApplication, JobSearchHistoryEntry } from '../types';
import { auth, db } from '../store/firebase';
import { doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
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
    programMethodologies: []
  },
  projects: [],
  resumeVersions: [],
  education: []
};

interface DataContextType {
  profile: UserProfile;
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

export const DataProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [searchHistory, setSearchHistory] = useState<JobSearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollerRef = useRef<TaskPollingService | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setProfile(null);
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
      const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
        try {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Initialize with empty profile
            const initProfile = { ...defaultProfile, id: userId };
            await setDoc(profileRef, initProfile);
            setProfile(initProfile);
          }
        } catch (err: any) {
          console.error("Error fetching/initializing profile:", err);
          setError(err.message || 'Failed to load profile');
        } finally {
          setLoading(false);
        }
      }, (err) => {
        console.error("Profile snapshot error:", err);
        setError(err.message || 'Failed to load profile');
        setLoading(false);
      });

      const appsRef = collection(db, 'users', userId, 'applications');
      const unsubApps = onSnapshot(appsRef, (querySnapshot) => {
        const apps: JobApplication[] = [];
        querySnapshot.forEach((doc) => {
          apps.push(doc.data() as JobApplication);
        });
        setApplications(apps);
      }, (err) => {
        console.error("Applications snapshot error:", err);
        setError(err.message || 'Failed to load applications');
      });

      const historyRef = collection(db, 'users', userId, 'jobsearchhistory');
      const unsubHistory = onSnapshot(historyRef, (querySnapshot) => {
        const h: JobSearchHistoryEntry[] = [];
        querySnapshot.forEach((doc) => {
          h.push(doc.data() as JobSearchHistoryEntry);
        });
        // Sort history by timestamp descending
        h.sort((a, b) => b.timestamp - a.timestamp);
        setSearchHistory(h);
      }, (err) => {
        console.error("Search history snapshot error:", err);
      });

      return () => {
        unsubProfile();
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

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const profileRef = doc(db, 'users', user.uid);
      await updateDoc(profileRef, updates);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(err.message || 'Failed to update profile');
      throw err;
    }
  };

  const addApplication = async (app: JobApplication) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const appsRef = doc(collection(db, 'users', user.uid, 'applications'));
      await setDoc(appsRef, { ...app, id: appsRef.id });
    } catch (err: any) {
      console.error("Error adding application:", err);
      setError(err.message || 'Failed to add application');
      throw err;
    }
  };

  const updateApplication = async (id: string, updates: Partial<JobApplication>) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const appRef = doc(db, 'users', user.uid, 'applications', id);
      await updateDoc(appRef, { ...updates, updatedAt: Date.now() });
    } catch (err: any) {
      console.error("Error updating application:", err);
      setError(err.message || 'Failed to update application');
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
      if (!user) throw new Error("Not authenticated");
      const appRef = doc(db, 'users', user.uid, 'applications', id);
      await deleteDoc(appRef);
    } catch (err: any) {
      console.error("Error deleting application:", err);
      setError(err.message || 'Failed to delete application');
      throw err;
    }
  };

  const addSearchHistory = async (entry: JobSearchHistoryEntry) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const ref = doc(db, 'users', user.uid, 'jobsearchhistory', entry.id);
      await setDoc(ref, entry);
    } catch (err: any) {
      console.error("Error adding search history:", err);
    }
  };

  const deleteSearchHistory = async (id: string) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const ref = doc(db, 'users', user.uid, 'jobsearchhistory', id);
      await deleteDoc(ref);
    } catch (err: any) {
      console.error("Error deleting search history:", err);
    }
  };

  const clearSearchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not authenticated");
      const batch = writeBatch(db);
      searchHistory.forEach(entry => {
        const ref = doc(db, 'users', user.uid, 'jobsearchhistory', entry.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Error clearing search history:", err);
    }
  };

  return (
    <DataContext.Provider value={{
      profile: profile || defaultProfile,
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
      clearSearchHistory
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
