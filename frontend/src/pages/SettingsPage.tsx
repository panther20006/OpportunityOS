import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  User,
  Sliders,
  LogOut,
  Sparkles,
  Info,
  CheckCircle2,
  UserCheck,
  Award,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';

export const SettingsPage: React.FC = () => {
  const { user, logout, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [demoSwitching, setDemoSwitching] = useState(false);

  const handleLogout = () => {
    logout();
    showToast('Signed out successfully', 'info');
    navigate('/login');
  };

  const handleSwitchToDemo = async () => {
    setDemoSwitching(true);
    try {
      await loginAsDemo();
      showToast('Switched to Demo Account (Mitva Satani)', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      showToast(err.message || 'Failed to switch to demo user', 'error');
    } finally {
      setDemoSwitching(false);
    }
  };

  const isDemo = user?.email?.includes('mitva') || user?.email?.includes('riya') || user?.email === 'demo@example.com';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 space-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-900">Settings & Matching Rules</h1>
        </div>
        <p className="text-sm text-slate-500">
          Manage your account, preferences, and inspect how deterministic matching calculates scores.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Account & Preferences (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          {/* Account Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-600" />
              <span>Account Details</span>
            </h2>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Full Name</span>
                <span className="font-bold text-slate-900">{user?.full_name || 'Student User'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-200/70 pt-2">
                <span className="text-slate-500 font-medium">Email Address</span>
                <span className="font-mono text-slate-800">{user?.email || 'student@example.com'}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-200/70 pt-2">
                <span className="text-slate-500 font-medium">Account Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Link to="/profile" className="text-xs font-semibold text-brand-600 hover:text-brand-800">
                Edit profile & skills in My Profile →
              </Link>

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Section: How Matching Works */}
          <div id="how-matching-works" className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-bold text-slate-900">How Matching Works</h2>
              </div>
              <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-md border border-brand-200">
                Formula v1.0
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              OpportunityOS relies on transparent arithmetic rather than opaque black-box AI scores. Match percentages reflect profile alignment across 5 balanced pillars:
            </p>

            <div className="space-y-3.5">
              {[
                { name: 'Skills Match', weight: 50, color: 'bg-indigo-600', desc: 'Coverage of required skills (1.0x) and preferred skills (0.5x) extracted from the job description.' },
                { name: 'Role Alignment', weight: 15, color: 'bg-blue-600', desc: 'Keyword and title alignment between your target role and the opening.' },
                { name: 'Location Fit', weight: 15, color: 'bg-emerald-600', desc: 'Proximity to your preferred city or remote work compatibility.' },
                { name: 'Experience Level', weight: 10, color: 'bg-amber-500', desc: 'Suitability for students, freshers, or entry-level applicants.' },
                { name: 'Opportunity Type', weight: 10, color: 'bg-purple-600', desc: 'Alignment with your preferred format (internship, full-time, hackathon).' },
              ].map((pillar) => (
                <div key={pillar.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>{pillar.name}</span>
                    <span>{pillar.weight}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${pillar.color} rounded-full`} style={{ width: `${pillar.weight}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">{pillar.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-800">Arithmetic Formula:</span>
              <p className="font-mono text-slate-700">
                Score = round(0.50*Skills + 0.15*Role + 0.15*Location + 0.10*Exp + 0.10*Type)
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                Notice: Match scores describe alignment with listing attributes, not hiring probability.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Demo Persona & Info (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          {/* Demo Persona Switcher */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-slate-900">Demo Persona</h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              If evaluating the platform during testing or hackathon review, you can switch to the pre-seeded student persona with populated applications, skills, and roadmap.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <p className="font-bold text-slate-800">Mitva Satani (B.Tech CS Student)</p>
              <p className="text-slate-500">Target Role: Software Engineer • Bengaluru</p>
              {isDemo && (
                <span className="inline-block mt-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                  Currently active persona
                </span>
              )}
            </div>

            <button
              onClick={handleSwitchToDemo}
              disabled={demoSwitching}
              className="w-full btn-secondary text-xs"
            >
              <UserCheck className="w-4 h-4 text-brand-600" />
              <span>{demoSwitching ? 'Switching...' : 'Switch to Demo Persona'}</span>
            </button>
          </div>

          {/* Quick Help Card */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-brand-600" />
              <span>Need to change target role?</span>
            </div>
            <p className="leading-relaxed">
              To update your target career role, claimed skills, or weekly commitment, visit your Profile page. The matching engine recalculates alignment whenever your profile changes.
            </p>
            <div className="pt-1">
              <Link to="/profile" className="font-bold text-brand-600 hover:text-brand-800">
                Go to Profile Settings →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
