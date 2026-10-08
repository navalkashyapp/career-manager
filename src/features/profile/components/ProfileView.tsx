import React, { useState } from 'react';
import { useData } from '../../../hooks/useData';
import { Briefcase, MapPin, Building2, Terminal, ShieldAlert, Linkedin, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import ImportLinkedInModal from './ImportLinkedInModal';
import EditProfileModal from './EditProfileModal';
import { Button } from '../../../components/ui/button';
import { Card as ShadcnCard } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { apiUrl, apiFetch } from '../../../config/api';

export default function ProfileView() {
  const {
    profile,
    profiles,
    activeProfileId,
    setActiveProfileId,
    addProfile,
    deleteProfile,
    updateProfile,
    loading,
    error,
  } = useData();
  const [isLinkedInModalOpen, setIsLinkedInModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleAddProfile = async () => {
    const newName = prompt('Enter a name for the new profile (e.g., Frontend Profile):');
    if (!newName) return;
    try {
      const newId = await addProfile({
        ...profile, // Copy data from current active profile
        profileName: newName,
      });
      setActiveProfileId(newId);
    } catch (err) {
      console.error(err);
      alert('Failed to add profile');
    }
  };

  const handleDeleteProfile = async () => {
    if (activeProfileId === 'default') {
      alert('Cannot delete the main profile');
      return;
    }
    if (confirm('Are you sure you want to delete this profile?')) {
      try {
        await deleteProfile(activeProfileId);
      } catch (err) {
        console.error(err);
        alert('Failed to delete profile');
      }
    }
  };

  const handleLinkedInImport = async (data: string) => {
    const res = await apiFetch(apiUrl('/api/gemini/parse-linkedin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedinData: data }),
    });

    if (!res.ok) {
      throw new Error('Failed to parse LinkedIn data');
    }

    const parsedData = await res.json();
    await updateProfile(parsedData);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-4 w-48 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 w-24 bg-white dark:bg-[#1E293B] rounded-lg"></div>
            <div className="h-10 w-28 bg-white dark:bg-[#1E293B] rounded-lg"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-96 bg-white dark:bg-[#1E293B] rounded-2xl"></div>
            <div className="h-64 bg-white dark:bg-[#1E293B] rounded-2xl"></div>
          </div>
          <div className="h-96 bg-white dark:bg-[#1E293B] rounded-2xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-rose-400">Error loading data: {error}</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <Tabs
          value={activeProfileId}
          onValueChange={setActiveProfileId}
          className="w-full overflow-x-auto"
        >
          <div className="flex items-center space-x-2">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              {profiles.map((p) => (
                <TabsTrigger
                  key={p.id}
                  value={p.id}
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700"
                >
                  {p.profileName || (p.isDefault ? 'Main Profile' : 'Untitled Profile')}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              variant="outline"
              onClick={handleAddProfile}
              className="h-9 px-3 shrink-0 text-slate-600 dark:text-slate-300"
            >
              <Plus size={16} className="mr-2" />
              New Profile
            </Button>
          </div>
        </Tabs>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
            {profile.fullName}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {profile.targetTitle} • {profile.location}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsLinkedInModalOpen(true)}
            className="text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-transparent hover:border-transparent"
          >
            <Linkedin size={16} className="mr-2" />
            Import LinkedIn
          </Button>
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            Edit Profile
          </Button>

          <Button className="bg-indigo-500 hover:bg-indigo-600 text-white">Export JSON</Button>
          {activeProfileId !== 'default' && (
            <Button
              variant="outline"
              onClick={handleDeleteProfile}
              className="text-rose-500 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ShadcnCard className="p-6 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
            <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
              <Briefcase size={20} className="text-indigo-400" />
              <span>Career History</span>
            </h2>
            <div className="space-y-8">
              {profile.careerHistory.map((job, idx) => (
                <div
                  key={job.id}
                  className="relative pl-6 border-l border-slate-200 dark:border-[#334155]"
                >
                  <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[6.5px] top-1.5" />
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                        {job.title}
                      </h3>
                      <p className="text-indigo-400">{job.company}</p>
                    </div>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{job.dates}</span>
                  </div>
                  <ul className="space-y-2 mt-4 text-slate-600 dark:text-slate-300 text-sm">
                    {job.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2 mt-1.5 text-indigo-400/50">•</span>
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ShadcnCard>

          <ShadcnCard className="p-6 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
            <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
              <Building2 size={20} className="text-emerald-400" />
              <span>Key Projects</span>
            </h2>
            <div className="space-y-6">
              {profile.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-slate-100 dark:bg-[#0F172A] rounded-xl p-5 border border-slate-200 dark:border-[#334155]/50"
                >
                  <h3 className="text-slate-900 dark:text-white font-medium mb-3">{proj.title}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-slate-500 mb-1">Architecture</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {proj.architecture}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-500 mb-1">Impact</span>
                      <span className="text-emerald-400 font-medium">{proj.impact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ShadcnCard>
        </div>

        <div className="space-y-6">
          <ShadcnCard className="p-6 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
            <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
              <Terminal size={20} className="text-pink-400" />
              <span>Core Skills</span>
            </h2>
            <div className="space-y-6">
              {Object.entries(profile.coreSkills).map(([category, skills]) => (
                <div key={category}>
                  <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    {category.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="font-normal border-slate-200 dark:border-[#334155]"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ShadcnCard>

          {profile.education && profile.education.length > 0 && (
            <ShadcnCard className="p-6 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
              <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
                <Briefcase size={20} className="text-blue-400" />
                <span>Education</span>
              </h2>
              <div className="space-y-6">
                {profile.education.map((edu) => (
                  <div
                    key={edu.id}
                    className="border-l-2 border-slate-200 dark:border-[#334155] pl-4"
                  >
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                      {edu.institution}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {edu.degree} in {edu.fieldOfStudy}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {edu.startDate} {edu.endDate ? `- ${edu.endDate}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </ShadcnCard>
          )}

          {profile.workAuthorization && profile.workAuthorization.length > 0 && (
            <ShadcnCard className="p-6 bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-md">
              <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6 flex items-center space-x-2">
                <Globe size={20} className="text-amber-400" />
                <span>Work Authorization</span>
              </h2>
              <div className="space-y-6">
                {profile.workAuthorization.map((auth) => (
                  <div
                    key={auth.id}
                    className="border-l-2 border-slate-200 dark:border-[#334155] pl-4"
                  >
                    <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                      {auth.country}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{auth.type}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Valid until: {auth.validity || 'Indefinite'}
                    </p>
                  </div>
                ))}
              </div>
            </ShadcnCard>
          )}
        </div>
      </div>
      <ImportLinkedInModal
        isOpen={isLinkedInModalOpen}
        onClose={() => setIsLinkedInModalOpen(false)}
        onImport={handleLinkedInImport}
      />
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        onSave={updateProfile}
      />
    </div>
  );
}
