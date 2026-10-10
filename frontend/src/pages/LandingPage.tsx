import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Search,
  BookOpen,
  Award,
  AlertCircle,
  Building,
  Check
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { MatchRing } from '../components/MatchRing';

export const LandingPage: React.FC = () => {
  const { loginAsDemo, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const handleDemoClick = async () => {
    setDemoError(null);
    setDemoLoading(true);
    try {
      await loginAsDemo();
      navigate('/dashboard');
    } catch (err: any) {
      setDemoError(err.message || 'Unable to launch demo mode. Please try again.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Hero Section */}
      <section className="pt-16 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-brand-600" />
          <span>For students and early-career job seekers</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-none max-w-4xl mx-auto">
          Find opportunities that match your skills.
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Discover relevant openings tailored to students and freshers, understand your profile match with clear, transparent criteria, and follow practical next steps to bridge any missing skills.
        </p>

        {/* Demo error alert if any */}
        {demoError && (
          <div className="max-w-md mx-auto p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{demoError}</span>
          </div>
        )}

        {/* Action Buttons: "Create your profile" primary, "Explore demo" secondary */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-7 py-3 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              to="/signup"
              className="w-full sm:w-auto px-7 py-3 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>Create your profile</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}

          <button
            type="button"
            onClick={handleDemoClick}
            disabled={demoLoading}
            className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm border border-slate-300 shadow-2xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{demoLoading ? 'Loading demo profile...' : 'Explore demo'}</span>
          </button>
        </div>
      </section>

      {/* Example Opportunity Preview Card */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-md border border-brand-200">
                Example opportunity
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Junior Frontend Developer
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Acme Technologies
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Bengaluru · Remote Eligible
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center p-3 bg-slate-50 rounded-xl border border-slate-200">
              <MatchRing score={85} size="md" />
              <div>
                <div className="text-xs font-bold text-slate-900">85% Alignment</div>
                <div className="text-[11px] text-slate-500">Based on your skills</div>
              </div>
            </div>
          </div>

          {/* Skill Breakdown in Preview */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Profile Alignment Comparison
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
                <Check className="w-3 h-3 text-emerald-600" />
                HTML / CSS
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
                <Check className="w-3 h-3 text-emerald-600" />
                JavaScript
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
                <Check className="w-3 h-3 text-emerald-600" />
                React
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold">
                <span className="text-slate-400 font-bold">+</span>
                TypeScript (Skill to develop)
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="font-bold text-slate-800">Suggested next step: </span>
            <span className="text-slate-600">
              Complete a 3-hour TypeScript project milestone to increase your alignment score and strengthen your portfolio.
            </span>
          </div>
        </div>
      </section>

      {/* Three Short Explanations Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            How OpportunityOS works for you
          </h2>
          <p className="text-sm text-slate-500">
            A focused system designed to help you answer: “What should I do next?”
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Find opportunities */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Find opportunities</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Discover curated internships, entry-level jobs, and student programs matched directly to your current education, location preferences, and target role.
            </p>
          </div>

          {/* 2. Understand your match */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Understand your match</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every opening includes a transparent match calculation showing which skills you already have, how your role aligns, and which areas employers require.
            </p>
          </div>

          {/* 3. Build missing skills */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Build missing skills</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Follow a personalized Learn → Build → Apply roadmap tailored to your weekly commitment so you can gain high-demand skills with measurable progress.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
