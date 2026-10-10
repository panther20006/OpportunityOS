import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const Navbar: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-lg shadow-xs group-hover:bg-brand-700 transition-colors">
              O
            </div>
            <div className="flex items-baseline">
              <span className="text-xl font-black tracking-tight text-slate-900">Opportunity</span>
              <span className="text-xl font-black text-brand-600">OS</span>
            </div>
          </Link>

          {/* Public Action Area */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-xs transition-colors"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-3.5 py-2 min-h-[44px] inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-xs transition-colors"
                >
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
