import { CoreSkills } from '../../../types';
import React, { useState } from 'react';
import {
  X,
  Save,
  Plus,
  Trash2,
  Briefcase,
  GraduationCap,
  Building2,
  Terminal,
  User,
  Globe,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  UserProfile,
  CareerEntry,
  EducationEntry,
  ProjectBrief,
  WorkAuthorizationEntry,
} from '../../../types';

interface EditProfileModalProps {
  isOpen: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

type TabType = 'basic' | 'career' | 'education' | 'projects' | 'skills' | 'workauth';

export default function EditProfileModal({
  isOpen,
  profile,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State clones
  const [basicInfo, setBasicInfo] = useState({
    profileName: profile.profileName || '',
    fullName: profile.fullName || '',
    email: profile.email || '',
    phone: profile.phone || '',
    targetTitle: profile.targetTitle || '',
    targetLevel: profile.targetLevel || '',
    jobTitle: profile.jobTitle || '',
    location: profile.location || '',
    preferredCompensation: profile.preferredCompensation || '',
    linkedinUrl: profile.linkedinUrl || '',
    portfolioUrl: profile.portfolioUrl || '',
  });

  const [careerHistory, setCareerHistory] = useState<CareerEntry[]>([
    ...(profile.careerHistory || []),
  ]);
  const [education, setEducation] = useState<EducationEntry[]>([...(profile.education || [])]);
  const [workAuthorization, setWorkAuthorization] = useState<WorkAuthorizationEntry[]>([
    ...(profile.workAuthorization || []),
  ]);
  const [projects, setProjects] = useState<ProjectBrief[]>([...(profile.projects || [])]);
  const [coreSkills, setCoreSkills] = useState({ ...(profile.coreSkills || {}) });

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        ...basicInfo,
        careerHistory,
        education,
        workAuthorization,
        projects,
        coreSkills,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  // Basic Info Handlers
  const handleBasicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBasicInfo((prev) => ({ ...prev, [name]: value }));
  };

  // Career History Handlers
  const addCareerEntry = () => {
    setCareerHistory([
      { id: Date.now().toString(), company: '', title: '', dates: '', location: '', bullets: [''] },
      ...careerHistory,
    ]);
  };
  const updateCareerEntry = (idx: number, field: keyof CareerEntry, value: any) => {
    const updated = [...careerHistory];
    updated[idx] = { ...updated[idx], [field]: value };
    setCareerHistory(updated);
  };
  const removeCareerEntry = (idx: number) => {
    setCareerHistory(careerHistory.filter((_, i) => i !== idx));
  };
  const updateCareerBullet = (careerIdx: number, bulletIdx: number, value: string) => {
    const updated = [...careerHistory];
    const newBullets = [...updated[careerIdx].bullets];
    newBullets[bulletIdx] = value;
    updated[careerIdx].bullets = newBullets;
    setCareerHistory(updated);
  };
  const addCareerBullet = (careerIdx: number) => {
    const updated = [...careerHistory];
    updated[careerIdx].bullets.push('');
    setCareerHistory(updated);
  };
  const removeCareerBullet = (careerIdx: number, bulletIdx: number) => {
    const updated = [...careerHistory];
    updated[careerIdx].bullets = updated[careerIdx].bullets.filter((_, i) => i !== bulletIdx);
    setCareerHistory(updated);
  };

  // Education Handlers
  const addEducation = () => {
    setEducation([
      {
        id: Date.now().toString(),
        institution: '',
        degree: '',
        fieldOfStudy: '',
        startDate: '',
        endDate: '',
      },
      ...education,
    ]);
  };
  const updateEducation = (idx: number, field: keyof EducationEntry, value: string) => {
    const updated = [...education];
    updated[idx] = { ...updated[idx], [field]: value };
    setEducation(updated);
  };
  const removeEducation = (idx: number) => {
    setEducation(education.filter((_, i) => i !== idx));
  };

  // Work Auth Handlers
  const addWorkAuth = () => {
    setWorkAuthorization([
      { id: Date.now().toString(), country: '', type: '', validity: '' },
      ...workAuthorization,
    ]);
  };
  const updateWorkAuth = (idx: number, field: keyof WorkAuthorizationEntry, value: string) => {
    const updated = [...workAuthorization];
    updated[idx] = { ...updated[idx], [field]: value };
    setWorkAuthorization(updated);
  };
  const removeWorkAuth = (idx: number) => {
    setWorkAuthorization(workAuthorization.filter((_, i) => i !== idx));
  };

  // Project Handlers
  const addProject = () => {
    setProjects([
      {
        id: Date.now().toString(),
        title: '',
        problem: '',
        architecture: '',
        impact: '',
        teamSize: '',
        scaleMetrics: '',
      },
      ...projects,
    ]);
  };
  const updateProject = (idx: number, field: keyof ProjectBrief, value: string) => {
    const updated = [...projects];
    updated[idx] = { ...updated[idx], [field]: value };
    setProjects(updated);
  };
  const removeProject = (idx: number) => {
    setProjects(projects.filter((_, i) => i !== idx));
  };

  // Skills Handler
  const updateSkills = (category: string, value: string) => {
    const list = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setCoreSkills((prev) => ({ ...prev, [category]: list }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl border border-slate-200 dark:border-[#334155] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-[#1E293B]">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Edit Profile</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Update your background, skills, and preferences.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden flex-col sm:flex-row">
          {/* Sidebar Tabs */}
          <div className="w-full sm:w-48 md:w-56 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-[#1E293B] bg-slate-50/50 dark:bg-[#1E293B]/20 p-4 space-y-1 overflow-x-auto flex sm:flex-col shrink-0">
            {[
              { id: 'basic', label: 'Basic Info', icon: User },
              { id: 'career', label: 'Career History', icon: Briefcase },
              { id: 'education', label: 'Education', icon: GraduationCap },
              { id: 'workauth', label: 'Work Authorization', icon: Globe },
              { id: 'projects', label: 'Projects', icon: Building2 },
              { id: 'skills', label: 'Core Skills', icon: Terminal },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Form Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Profile Name
                    </label>
                    <Input
                      name="profileName"
                      value={basicInfo.profileName}
                      onChange={handleBasicChange}
                      placeholder="e.g. Main Profile, Frontend Profile"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <Input
                      name="fullName"
                      value={basicInfo.fullName}
                      onChange={handleBasicChange}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Target Title (Legacy)
                    </label>
                    <Input
                      name="targetTitle"
                      value={basicInfo.targetTitle}
                      onChange={handleBasicChange}
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Target Level
                    </label>
                    <Input
                      name="targetLevel"
                      value={basicInfo.targetLevel}
                      onChange={handleBasicChange}
                      placeholder="e.g. Senior, L5, Staff"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Target Job Title
                    </label>
                    <Input
                      name="jobTitle"
                      value={basicInfo.jobTitle}
                      onChange={handleBasicChange}
                      placeholder="e.g. Software Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email
                    </label>
                    <Input
                      name="email"
                      value={basicInfo.email}
                      onChange={handleBasicChange}
                      placeholder="e.g. jane@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Phone
                    </label>
                    <Input
                      name="phone"
                      value={basicInfo.phone}
                      onChange={handleBasicChange}
                      placeholder="e.g. +1 555-0123"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Location
                    </label>
                    <Input
                      name="location"
                      value={basicInfo.location}
                      onChange={handleBasicChange}
                      placeholder="e.g. San Francisco, CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Preferred Compensation
                    </label>
                    <Input
                      name="preferredCompensation"
                      value={basicInfo.preferredCompensation}
                      onChange={handleBasicChange}
                      placeholder="e.g. $180k - $220k base"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      LinkedIn URL
                    </label>
                    <Input
                      name="linkedinUrl"
                      value={basicInfo.linkedinUrl}
                      onChange={handleBasicChange}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Portfolio/Website URL
                    </label>
                    <Input
                      name="portfolioUrl"
                      value={basicInfo.portfolioUrl}
                      onChange={handleBasicChange}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Career History Tab */}
            {activeTab === 'career' && (
              <div className="space-y-6">
                <Button
                  onClick={addCareerEntry}
                  variant="outline"
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add New Job
                </Button>
                {careerHistory.map((job, idx) => (
                  <div
                    key={job.id || idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-slate-900 dark:text-white">Role {idx + 1}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCareerEntry(idx)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Company</label>
                        <Input
                          value={job.company}
                          onChange={(e) => updateCareerEntry(idx, 'company', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Title</label>
                        <Input
                          value={job.title}
                          onChange={(e) => updateCareerEntry(idx, 'title', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Dates</label>
                        <Input
                          value={job.dates}
                          onChange={(e) => updateCareerEntry(idx, 'dates', e.target.value)}
                          placeholder="e.g. Jan 2020 - Present"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Location</label>
                        <Input
                          value={job.location}
                          onChange={(e) => updateCareerEntry(idx, 'location', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500">
                        Accomplishment Bullets
                      </label>
                      <div className="space-y-2">
                        {job.bullets.map((bullet, bIdx) => (
                          <div key={bIdx} className="flex gap-2">
                            <Input
                              value={bullet}
                              onChange={(e) => updateCareerBullet(idx, bIdx, e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCareerBullet(idx, bIdx)}
                              className="text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addCareerBullet(idx)}
                          className="text-indigo-500"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Bullet
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Education Tab */}
            {activeTab === 'education' && (
              <div className="space-y-6">
                <Button
                  onClick={addEducation}
                  variant="outline"
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Education
                </Button>
                {education.map((edu, idx) => (
                  <div
                    key={edu.id || idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Institution {idx + 1}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEducation(idx)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">
                          Institution Name
                        </label>
                        <Input
                          value={edu.institution}
                          onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Degree</label>
                        <Input
                          value={edu.degree}
                          onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                          placeholder="e.g. B.S., M.S."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Field of Study</label>
                        <Input
                          value={edu.fieldOfStudy}
                          onChange={(e) => updateEducation(idx, 'fieldOfStudy', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-500">Start Date</label>
                          <Input
                            value={edu.startDate}
                            onChange={(e) => updateEducation(idx, 'startDate', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-500">End Date</label>
                          <Input
                            value={edu.endDate}
                            onChange={(e) => updateEducation(idx, 'endDate', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Work Auth Tab */}
            {activeTab === 'workauth' && (
              <div className="space-y-6">
                <Button
                  onClick={addWorkAuth}
                  variant="outline"
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Work Authorization
                </Button>
                {workAuthorization.map((auth, idx) => (
                  <div
                    key={auth.id || idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Authorization {idx + 1}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWorkAuth(idx)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">Country</label>
                        <Input
                          value={auth.country}
                          onChange={(e) => updateWorkAuth(idx, 'country', e.target.value)}
                          placeholder="e.g. United States"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">
                          Authorization Type
                        </label>
                        <Input
                          value={auth.type}
                          onChange={(e) => updateWorkAuth(idx, 'type', e.target.value)}
                          placeholder="e.g. Citizen, H-1B, Green Card"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">
                          Validity / Expiration
                        </label>
                        <Input
                          value={auth.validity}
                          onChange={(e) => updateWorkAuth(idx, 'validity', e.target.value)}
                          placeholder="e.g. Indefinite, Dec 2025"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-6">
                <Button
                  onClick={addProject}
                  variant="outline"
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Project
                </Button>
                {projects.map((proj, idx) => (
                  <div
                    key={proj.id || idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        Project {idx + 1}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProject(idx)}
                        className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 h-8 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs font-medium text-slate-500">Project Title</label>
                        <Input
                          value={proj.title}
                          onChange={(e) => updateProject(idx, 'title', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">
                          Architecture / Tech Stack
                        </label>
                        <Input
                          value={proj.architecture}
                          onChange={(e) => updateProject(idx, 'architecture', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">
                          Impact / Metrics
                        </label>
                        <Input
                          value={proj.impact}
                          onChange={(e) => updateProject(idx, 'impact', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Core Skills Tab */}
            {activeTab === 'skills' && (
              <div className="space-y-6">
                <p className="text-sm text-slate-500">
                  Enter comma-separated skills for each category.
                </p>
                {[
                  'cloudInfrastructure',
                  'programmingLanguages',
                  'frameworks',
                  'certifications',
                  'programMethodologies',
                ].map((category) => (
                  <div key={category} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {category
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())}
                    </label>
                    <Input
                      value={(coreSkills[category as keyof CoreSkills] || []).join(', ')}
                      onChange={(e) => updateSkills(category, e.target.value)}
                      placeholder="e.g. React, Node.js, TypeScript"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-[#1E293B] flex justify-end space-x-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSaving ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Profile
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
