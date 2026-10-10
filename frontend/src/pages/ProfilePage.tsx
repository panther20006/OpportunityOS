import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  GraduationCap,
  Briefcase,
  MapPin,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Target,
  RefreshCw,
  Search
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ProfileResponse, SkillItem } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile fields
  const [educationLevel, setEducationLevel] = useState('undergraduate');
  const [degree, setDegree] = useState('B.Tech');
  const [fieldOfStudy, setFieldOfStudy] = useState('Computer Science');
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [institution, setInstitution] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('fresher');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('India');
  const [openToRemote, setOpenToRemote] = useState(true);
  const [weeklyHours, setWeeklyHours] = useState(10);

  // Goal fields
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [timelineMonths, setTimelineMonths] = useState(6);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['job', 'internship', 'hackathon']);

  // Skills
  const [userSkills, setUserSkills] = useState<SkillItem[]>([]);
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string; category: string }>>([]);
  const [skillSearch, setSkillSearch] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [profRes, skillsRes] = await Promise.all([
          apiClient.get<ProfileResponse>('/profile'),
          apiClient.get<Array<{ id: string; name: string; category: string }>>('/skills'),
        ]);

        const data = profRes.data;
        if (data.profile) {
          setEducationLevel(data.profile.education_level || 'undergraduate');
          setDegree(data.profile.degree || '');
          setFieldOfStudy(data.profile.field_of_study || '');
          setGraduationYear(data.profile.graduation_year || 2026);
          setInstitution(data.profile.institution || '');
          setExperienceLevel(data.profile.experience_level || 'fresher');
          setLocationCity(data.profile.location_city || '');
          setLocationState(data.profile.location_state || '');
          setLocationCountry(data.profile.location_country || 'India');
          setOpenToRemote(data.profile.open_to_remote ?? true);
          setWeeklyHours(data.profile.weekly_learning_hours || 10);
        }

        if (data.career_goal) {
          setTargetRole(data.career_goal.target_role || 'Software Engineer');
          setTimelineMonths(data.career_goal.timeline_months || 6);
          setSelectedTypes(data.career_goal.opportunity_types || ['job', 'internship']);
        }

        setUserSkills(data.skills || []);
        setAvailableSkills(skillsRes.data || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const handleToggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleAddSkill = (skillName: string) => {
    if (!skillName.trim()) return;
    const exists = userSkills.some((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (exists) return;

    setUserSkills((prev) => [
      ...prev,
      { name: skillName.trim(), proficiency: 3 },
    ]);
    setSkillSearch('');
  };

  const handleRemoveSkill = (skillName: string) => {
    setUserSkills((prev) => prev.filter((s) => s.name !== skillName));
  };

  const handleProficiencyChange = (skillName: string, level: number) => {
    setUserSkills((prev) =>
      prev.map((s) => (s.name === skillName ? { ...s, proficiency: level } : s))
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await apiClient.put('/profile', {
        profile: {
          education_level: educationLevel,
          degree,
          field_of_study: fieldOfStudy,
          graduation_year: Number(graduationYear),
          institution,
          experience_level: experienceLevel,
          location_city: locationCity,
          location_state: locationState,
          location_country: locationCountry,
          open_to_remote: openToRemote,
          weekly_learning_hours: Number(weeklyHours),
        },
        skills: userSkills.map((s) => ({
          name: s.name,
          proficiency: s.proficiency || 3,
        })),
        career_goal: {
          target_role: targetRole,
          timeline_months: Number(timelineMonths),
          opportunity_types: selectedTypes,
        },
      });

      setSuccessMsg('Profile successfully saved & updated!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      const res = await apiClient.post('/agent/search', {});
      const sessionId = res.data.session_id;
      navigate(`/agent/sessions/${sessionId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start opportunity discovery agent');
      setRunningAgent(false);
    }
  };

  const filteredSkillSuggestions = skillSearch.trim()
    ? availableSkills
        .filter(
          (s) =>
            s.name.toLowerCase().includes(skillSearch.toLowerCase()) &&
            !userSkills.some((us) => us.name.toLowerCase() === s.name.toLowerCase())
        )
        .slice(0, 8)
    : [];

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading your profile and verified skills...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Profile & Goals</h1>
          </div>
          <p className="text-sm text-slate-600">
            Keep your skills and target roles up to date to get accurate match scoring and relevant opportunities.
          </p>
        </div>

        <button
          onClick={handleRunAgent}
          disabled={runningAgent}
          className="btn-primary min-h-[44px] px-4 text-xs font-semibold shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} />
          <span>{runningAgent ? 'Searching...' : 'Find opportunities'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Section 1: Career Goals */}
        <div className="card-base rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <Target className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900">Career Targets & Target Role</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="target-role" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Target Role Title <span className="text-brand-600">*</span>
              </label>
              <input
                id="target-role"
                type="text"
                required
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Frontend Developer, ML Engineer, Full Stack"
                className="form-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="target-timeline" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Target Timeline
              </label>
              <select
                id="target-timeline"
                value={timelineMonths}
                onChange={(e) => setTimelineMonths(Number(e.target.value))}
                className="form-select text-sm"
              >
                <option value={1}>1 Month (Immediate)</option>
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months (Graduation Year)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Opportunity Types of Interest
            </label>
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: 'job', label: 'Full-Time Job' },
                { id: 'internship', label: 'Internship' },
                { id: 'hackathon', label: 'Hackathon' },
                { id: 'grant', label: 'Grant / Funding' },
                { id: 'fellowship', label: 'Fellowship' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleToggleType(opt.id)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    selectedTypes.includes(opt.id)
                      ? 'bg-brand-50 text-brand-700 border-brand-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Verified Skills & Proficiencies */}
        <div className="card-base rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-bold text-slate-900">Your Skills & Proficiencies</h2>
            </div>
            <span className="badge-neutral font-semibold">
              {userSkills.length} Verified Skills
            </span>
          </div>

          {/* Autocomplete Skill Search */}
          <div className="space-y-2 relative">
            <label htmlFor="skill-search" className="block text-sm font-semibold text-slate-700">
              Add Skills from Catalog (220+ Pre-mapped Skills)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="skill-search"
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredSkillSuggestions.length > 0) {
                      handleAddSkill(filteredSkillSuggestions[0].name);
                    } else if (skillSearch.trim()) {
                      handleAddSkill(skillSearch.trim());
                    }
                  }
                }}
                placeholder="Type to search e.g. React, Python, PostgreSQL, Docker, FastAPI..."
                className="form-input pl-10 text-sm"
              />
            </div>

            {filteredSkillSuggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                {filteredSkillSuggestions.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => handleAddSkill(s.name)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-brand-50 hover:text-brand-700 flex items-center justify-between"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-slate-400 capitalize">{s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Skills Pills with Proficiency selector */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">
              Current Profile Skills <span className="text-xs text-slate-500 font-normal">(select 1-5 to update level)</span>
            </label>
            {userSkills.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">No skills added yet. Search skills above to add them.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {userSkills.map((skill) => (
                  <div
                    key={skill.name}
                    className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{skill.name}</div>
                      <div className="flex items-center gap-1.5 mt-1.5" role="group" aria-label={`Proficiency level for ${skill.name}`}>
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <button
                            type="button"
                            key={lvl}
                            onClick={() => handleProficiencyChange(skill.name, lvl)}
                            className={`w-3.5 h-3.5 rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                              lvl <= (skill.proficiency || 3)
                                ? 'bg-brand-600'
                                : 'bg-slate-200 hover:bg-slate-300'
                            }`}
                            title={`Set ${skill.name} proficiency to ${lvl}/5`}
                            aria-label={`Level ${lvl} of 5`}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill.name)}
                      className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
                      title="Remove skill"
                      aria-label={`Remove ${skill.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Education & Academic Details */}
        <div className="card-base rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <GraduationCap className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900">Education & Background</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="education-level" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Education Level
              </label>
              <select
                id="education-level"
                value={educationLevel}
                onChange={(e) => setEducationLevel(e.target.value)}
                className="form-select text-sm"
              >
                <option value="undergraduate">Undergraduate (B.Tech / BS)</option>
                <option value="postgraduate">Postgraduate (MS / M.Tech)</option>
                <option value="bootcamp">Bootcamp Graduate</option>
                <option value="self_taught">Self-Taught</option>
              </select>
            </div>

            <div>
              <label htmlFor="degree" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Degree & Major
              </label>
              <input
                id="degree"
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. B.Tech Computer Science"
                className="form-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="grad-year" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Graduation Year
              </label>
              <input
                id="grad-year"
                type="number"
                value={graduationYear}
                onChange={(e) => setGraduationYear(Number(e.target.value))}
                className="form-input text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="institution" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Institution / University
              </label>
              <input
                id="institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Stanford University / IIT Bombay / State College"
                className="form-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="exp-level" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Experience Level
              </label>
              <select
                id="exp-level"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="form-select text-sm"
              >
                <option value="student">Student / Intern</option>
                <option value="fresher">Fresher (0 - 1 Years)</option>
                <option value="junior">Junior (1 - 2 Years)</option>
                <option value="mid">Mid-Level (3+ Years)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Location & Availability */}
        <div className="card-base rounded-2xl p-6 sm:p-7 border border-slate-200 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <MapPin className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900">Location & Availability</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="city" className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
              <input
                id="city"
                type="text"
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g. San Francisco, Bengaluru, London"
                className="form-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-semibold text-slate-700 mb-1.5">Country</label>
              <input
                id="country"
                type="text"
                value={locationCountry}
                onChange={(e) => setLocationCountry(e.target.value)}
                placeholder="e.g. USA, India, UK"
                className="form-input text-sm"
              />
            </div>

            <div>
              <label htmlFor="weekly-hours" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Weekly Learning Commitment
              </label>
              <select
                id="weekly-hours"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="form-select text-sm"
              >
                <option value={5}>~5 Hours/Week</option>
                <option value={10}>~10 Hours/Week</option>
                <option value={15}>~15 Hours/Week</option>
                <option value={20}>20+ Hours/Week</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openToRemote}
                onChange={(e) => setOpenToRemote(e.target.checked)}
                className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span className="text-sm font-medium text-slate-800">
                Open to Remote Opportunities (Includes hybrid & global remote listings)
              </span>
            </label>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary min-h-[44px] px-6 text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
