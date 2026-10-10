import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Wrench,
  Compass,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SkillAutocompleteItem } from '../api/types';
import { useToast } from '../context/ToastContext';

const DRAFT_STORAGE_KEY = 'opportunityos_onboarding_draft_v1';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setProfileComplete } = useAuth();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  // Step 1: Career Goal
  const [targetRole, setTargetRole] = useState('');
  const [goalStatement, setGoalStatement] = useState('');
  const [timelineMonths, setTimelineMonths] = useState(3);
  const [opportunityTypes, setOpportunityTypes] = useState<string[]>(['internship', 'full_time']);
  const [step1Errors, setStep1Errors] = useState<{ role?: string; types?: string }>({});

  // Step 2: Skills
  const [searchSkillQuery, setSearchSkillQuery] = useState('');
  const [suggestedSkills, setSuggestedSkills] = useState<SkillAutocompleteItem[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<
    Array<{ skill_id?: string; name: string; proficiency: number }>
  >([]);
  const [step2Errors, setStep2Errors] = useState<{ skills?: string }>({});

  // Step 3: Preferences
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [openToRemote, setOpenToRemote] = useState(true);
  const [experienceLevel, setExperienceLevel] = useState('student');
  const [weeklyHours, setWeeklyHours] = useState(12);
  const [step3Errors, setStep3Errors] = useState<{ location?: string }>({});

  const userDraftKey = user?.id ? `opportunityos_onboarding_draft_${user.id}` : null;

  // Safe draft recovery from sessionStorage or pre-fill existing user profile
  useEffect(() => {
    if (!userDraftKey) return;
    try {
      const savedDraft = sessionStorage.getItem(userDraftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.targetRole !== undefined) setTargetRole(parsed.targetRole);
        if (parsed.goalStatement !== undefined) setGoalStatement(parsed.goalStatement);
        if (parsed.timelineMonths !== undefined) setTimelineMonths(parsed.timelineMonths);
        if (parsed.opportunityTypes !== undefined) setOpportunityTypes(parsed.opportunityTypes);
        if (parsed.selectedSkills && parsed.selectedSkills.length > 0) setSelectedSkills(parsed.selectedSkills);
        if (parsed.locationCity !== undefined) setLocationCity(parsed.locationCity);
        if (parsed.locationState !== undefined) setLocationState(parsed.locationState);
        if (parsed.openToRemote !== undefined) setOpenToRemote(parsed.openToRemote);
        if (parsed.experienceLevel !== undefined) setExperienceLevel(parsed.experienceLevel);
        if (parsed.weeklyHours !== undefined) setWeeklyHours(parsed.weeklyHours);
        return;
      }
    } catch {}

    // No draft found for this user: load existing profile if available
    apiClient.get('/profile')
      .then((res) => {
        const data = res.data;
        if (!data) return;
        if (data.career_goal?.target_role) setTargetRole(data.career_goal.target_role);
        if (data.career_goal?.goal_statement) setGoalStatement(data.career_goal.goal_statement);
        if (data.career_goal?.timeline_months) setTimelineMonths(data.career_goal.timeline_months);
        if (data.career_goal?.opportunity_types?.length) setOpportunityTypes(data.career_goal.opportunity_types);
        if (data.skills?.length) {
          setSelectedSkills(
            data.skills.map((s: any) => ({
              skill_id: s.skill_id,
              name: s.name,
              proficiency: s.proficiency || 3,
            }))
          );
        }
        if (data.profile?.location_city) setLocationCity(data.profile.location_city);
        if (data.profile?.location_state) setLocationState(data.profile.location_state);
        if (data.profile?.open_to_remote !== undefined) setOpenToRemote(data.profile.open_to_remote);
        if (data.profile?.experience_level) setExperienceLevel(data.profile.experience_level);
        if (data.profile?.weekly_learning_hours) setWeeklyHours(data.profile.weekly_learning_hours);
      })
      .catch(() => {});
  }, [userDraftKey]);

  // Save non-sensitive draft on change scoped to current user
  useEffect(() => {
    if (!userDraftKey) return;
    try {
      const draft = {
        targetRole,
        goalStatement,
        timelineMonths,
        opportunityTypes,
        selectedSkills,
        locationCity,
        locationState,
        openToRemote,
        experienceLevel,
        weeklyHours,
      };
      sessionStorage.setItem(userDraftKey, JSON.stringify(draft));
    } catch {}
  }, [
    userDraftKey,
    targetRole,
    goalStatement,
    timelineMonths,
    opportunityTypes,
    selectedSkills,
    locationCity,
    locationState,
    openToRemote,
    experienceLevel,
    weeklyHours,
  ]);

  // Debounced skill autocomplete lookup with race condition prevention
  useEffect(() => {
    const query = searchSkillQuery.trim();
    if (query.length < 1) {
      setSuggestedSkills([]);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(() => {
      apiClient
        .get(`/skills?q=${encodeURIComponent(query)}&limit=8`)
        .then((res) => {
          if (isCurrent) {
            setSuggestedSkills(res.data.items || []);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setSuggestedSkills([]);
          }
        });
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchSkillQuery]);

  const addSkill = (name: string, skill_id?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSkills([...selectedSkills, { name: trimmed, skill_id, proficiency: 3 }]);
      setStep2Errors({});
    }
    setSearchSkillQuery('');
    setSuggestedSkills([]);
  };

  const removeSkill = (name: string) => {
    const next = selectedSkills.filter((s) => s.name !== name);
    setSelectedSkills(next);
    if (next.length === 0) {
      setStep2Errors({ skills: 'Please add at least 1 skill to calculate your match score.' });
    }
  };

  const updateProficiency = (name: string, prof: number) => {
    setSelectedSkills(
      selectedSkills.map((s) => (s.name === name ? { ...s, proficiency: prof } : s))
    );
  };

  const toggleType = (type: string) => {
    if (opportunityTypes.includes(type)) {
      if (opportunityTypes.length > 1) {
        setOpportunityTypes(opportunityTypes.filter((t) => t !== type));
      }
    } else {
      setOpportunityTypes([...opportunityTypes, type]);
    }
    setStep1Errors((prev) => ({ ...prev, types: undefined }));
  };

  // Step Validations
  const validateStep1 = () => {
    const errors: { role?: string; types?: string } = {};
    if (!targetRole.trim() || targetRole.trim().length < 2) {
      errors.role = 'Please specify your target role (minimum 2 characters).';
    }
    if (opportunityTypes.length === 0) {
      errors.types = 'Please select at least one opportunity type.';
    }
    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = () => {
    const errors: { skills?: string } = {};
    if (selectedSkills.length === 0) {
      errors.skills = 'Please add at least 1 skill to compute your alignment scores.';
    }
    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = () => {
    const errors: { location?: string } = {};
    if (!openToRemote && !locationCity.trim()) {
      errors.location = 'Please specify a preferred city or enable remote opportunities.';
    }
    setStep3Errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    } else if (currentStep === 3) {
      if (validateStep3()) setCurrentStep(4);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Save profile if not already saved
      if (!profileSaved) {
        await apiClient.put('/profile', {
          profile: {
            experience_level: experienceLevel,
            location_city: locationCity.trim() || null,
            location_state: locationState.trim() || null,
            location_country: 'IN',
            open_to_remote: openToRemote,
            weekly_learning_hours: weeklyHours,
          },
          skills: selectedSkills,
          career_goal: {
            target_role: targetRole.trim(),
            goal_statement: goalStatement.trim() || null,
            timeline_months: timelineMonths,
            opportunity_types: opportunityTypes,
          },
        });
        setProfileSaved(true);
        setProfileComplete(true);
      }

      // 2. Trigger Discovery search
      const searchRes = await apiClient.post('/agent/search', {
        overrides: {
          location_city: locationCity.trim() || null,
          open_to_remote: openToRemote,
          opportunity_types: opportunityTypes,
        },
        include_news: false,
      });

      // Clear draft on success
      if (userDraftKey) {
        sessionStorage.removeItem(userDraftKey);
      }
      const sessionId = searchRes.data.session_id;
      showToast('Profile saved! Initiating opportunity search...', 'success');
      navigate(`/agent/${sessionId}`);
    } catch (err: any) {
      setSubmitError(
        err.message || 'Error executing search. Your profile is preserved; please retry the search.'
      );
      setSubmitting(false);
    }
  };

  const handleRetrySearchOnly = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const searchRes = await apiClient.post('/agent/search', {
        overrides: {
          location_city: locationCity.trim() || null,
          open_to_remote: openToRemote,
          opportunity_types: opportunityTypes,
        },
        include_news: false,
      });
      if (userDraftKey) {
        sessionStorage.removeItem(userDraftKey);
      }
      navigate(`/agent/${searchRes.data.session_id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to start discovery search. Please check your network.');
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Career goal', icon: Target },
    { num: 2, title: 'Skills', icon: Wrench },
    { num: 3, title: 'Preferences', icon: Compass },
    { num: 4, title: 'Review', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Wizard Header */}
        <div className="text-center space-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full border border-brand-200">
            {currentStep === 4 ? 'Step 4 of 4 — Review' : `Step ${currentStep} of 4`}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {currentStep === 4
              ? 'Review your opportunity profile'
              : currentStep === 1
              ? 'What career role are you targeting?'
              : currentStep === 2
              ? 'What skills do you currently possess?'
              : 'Where and how do you prefer to work?'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
            {currentStep === 4
              ? 'Review what will be submitted before running your opportunity discovery.'
              : 'Provide your background to power transparent profile alignment.'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4 sm:px-10 py-2">
          {steps.map((st) => {
            const Icon = st.icon;
            const isPast = currentStep > st.num;
            const isCurrent = currentStep === st.num;

            return (
              <div key={st.num} className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${
                    isPast
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-xs font-semibold mt-1.5 ${
                    isCurrent ? 'text-brand-700 font-bold' : isPast ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {st.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Wizard Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {submitError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">
                    {profileSaved ? 'Profile Saved Successfully' : 'Submission Notice'}
                  </p>
                  <p className="mt-0.5 text-rose-700">{submitError}</p>
                </div>
              </div>
              {profileSaved && (
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                  >
                    <span>Go to dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRetrySearchOnly}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold text-xs shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
                    <span>Retry search</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Career Goal */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Target role title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={targetRole}
                  onChange={(e) => {
                    setTargetRole(e.target.value);
                    setStep1Errors((prev) => ({ ...prev, role: undefined }));
                  }}
                  placeholder="e.g. Frontend Developer, Python Engineer, Data Analyst"
                  className="form-input"
                />
                {step1Errors.role && (
                  <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {step1Errors.role}
                  </p>
                )}
                {/* Role Suggestions */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">Examples:</span>
                  {['Frontend Developer', 'Backend Engineer', 'Full-Stack Developer', 'Data Analyst', 'AI/ML Engineer'].map(
                    (role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          setTargetRole(role);
                          setStep1Errors((prev) => ({ ...prev, role: undefined }));
                        }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        {role}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Preferred opportunity types <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'internship', label: 'Internships' },
                    { id: 'full_time', label: 'Full-Time' },
                    { id: 'hackathon', label: 'Hackathons' },
                    { id: 'fellowship', label: 'Fellowships' },
                    { id: 'grant', label: 'Grants' },
                    { id: 'contract', label: 'Contract' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleType(t.id)}
                      className={`p-3 min-h-[44px] rounded-xl text-xs font-bold border transition-colors text-center ${
                        opportunityTypes.includes(t.id)
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {step1Errors.types && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">
                    {step1Errors.types}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Goal statement <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={goalStatement}
                  onChange={(e) => setGoalStatement(e.target.value)}
                  placeholder="e.g. Secure a summer internship before starting 6th semester"
                  className="form-input"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Helps focus your learning roadmap on your specific milestone.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Target timeline
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTimelineMonths(m)}
                      className={`py-2.5 min-h-[44px] rounded-xl text-xs font-bold border transition-colors ${
                        timelineMonths === m
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m} {m === 1 ? 'Month' : 'Months'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Skills */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Search & add skills <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchSkillQuery}
                    onChange={(e) => setSearchSkillQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (suggestedSkills.length > 0) {
                          addSkill(suggestedSkills[0].name, suggestedSkills[0].id);
                        } else if (searchSkillQuery.trim()) {
                          addSkill(searchSkillQuery.trim());
                        }
                      }
                    }}
                    placeholder="Search e.g. React, Python, SQL, Git, TypeScript, HTML, CSS..."
                    className="form-input"
                  />

                  {suggestedSkills.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {suggestedSkills.map((sk) => (
                        <button
                          key={sk.id}
                          type="button"
                          onClick={() => addSkill(sk.name, sk.id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-brand-50 text-xs sm:text-sm flex items-center justify-between"
                        >
                          <span className="font-bold text-slate-900">{sk.name}</span>
                          {sk.category && (
                            <span className="text-xs text-slate-400 capitalize px-2 py-0.5 bg-slate-100 rounded-md">
                              {sk.category}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick skill suggestions */}
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Popular skills:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['React', 'Python', 'TypeScript', 'Node.js', 'SQL', 'Git', 'Java', 'HTML', 'CSS', 'PostgreSQL', 'Tailwind CSS'].map(
                    (skName) => {
                      const alreadyAdded = selectedSkills.some(
                        (s) => s.name.toLowerCase() === skName.toLowerCase()
                      );
                      return (
                        <button
                          key={skName}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addSkill(skName)}
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                            alreadyAdded
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          {!alreadyAdded && <Plus className="w-3 h-3 text-brand-600" />}
                          <span>{skName}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Selected skills list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    Selected skills ({selectedSkills.length})
                  </span>
                  <span className="text-xs text-slate-400">Rate level: 1 (Beginner) to 5 (Expert)</span>
                </div>

                {step2Errors.skills && (
                  <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {step2Errors.skills}
                  </p>
                )}

                {selectedSkills.length === 0 ? (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No skills added yet. Add at least one skill above to compute your match score.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedSkills.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        <span className="text-sm font-bold text-slate-900">{s.name}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-xs mr-1">Level:</span>
                            {[1, 2, 3, 4, 5].map((lvl) => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => updateProficiency(s.name, lvl)}
                                className={`w-5 h-5 rounded-md text-[11px] font-bold transition-colors ${
                                  s.proficiency >= lvl
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSkill(s.name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                            aria-label={`Remove skill ${s.name}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Preferences */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Preferred city
                  </label>
                  <input
                    type="text"
                    value={locationCity}
                    onChange={(e) => {
                      setLocationCity(e.target.value);
                      setStep3Errors({});
                    }}
                    placeholder="e.g. Bengaluru, Pune, Delhi NCR"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={locationState}
                    onChange={(e) => setLocationState(e.target.value)}
                    placeholder="e.g. Karnataka, Maharashtra"
                    className="form-input"
                  />
                </div>
              </div>

              {step3Errors.location && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {step3Errors.location}
                </p>
              )}

              {/* Remote Toggle */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Include remote opportunities</p>
                  <p className="text-xs text-slate-500">
                    Matches work-from-home openings across India and worldwide.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={openToRemote}
                  onChange={(e) => {
                    setOpenToRemote(e.target.checked);
                    setStep3Errors({});
                  }}
                  className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 cursor-pointer"
                />
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Current experience level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="form-select"
                >
                  <option value="student">College Student / Enrolled</option>
                  <option value="fresher">Fresh Graduate (0 years experience)</option>
                  <option value="0_1_years">0 - 1 Years Industry Experience</option>
                  <option value="1_2_years">1 - 2 Years Industry Experience</option>
                </select>
              </div>

              {/* Weekly Learning Commitment */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Weekly learning commitment
                  </label>
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md border border-brand-200">
                    {weeklyHours} hrs / week
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(parseInt(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Roadmap pacing will be structured realistically around this commitment.
                </p>
              </div>
            </div>
          )}

          {/* FINAL REVIEW STEP */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500 font-medium">Target role:</span>
                  <span className="font-bold text-slate-900">{targetRole}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500 font-medium">Opportunity types:</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {opportunityTypes.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-slate-200 rounded text-xs font-semibold text-slate-800 capitalize">
                        {t.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500 font-medium">Location preferences:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {locationCity || 'Any'} {locationState ? `(${locationState})` : ''} {openToRemote ? '+ Remote' : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-slate-500 font-medium">Experience & weekly hours:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {experienceLevel.replace('_', ' ')} • {weeklyHours} hrs/week
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block mb-1.5">
                    Selected skills ({selectedSkills.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSkills.map((s) => (
                      <span
                        key={s.name}
                        className="px-2.5 py-1 bg-brand-50 text-brand-800 border border-brand-200 rounded-md text-xs font-semibold"
                      >
                        {s.name} (L{s.proficiency})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Profile is ready. Clicking <strong>"Find my opportunities"</strong> will index matches and calculate your alignment scores.
                </span>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{currentStep === 4 ? 'Edit details' : 'Back'}</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="btn-primary"
              >
                <span>{currentStep === 3 ? 'Review profile' : 'Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinish}
                className="btn-primary"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching opportunities...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Find my opportunities</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
