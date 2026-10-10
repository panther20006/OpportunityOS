import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Compass,
  Bookmark,
  Briefcase,
  TrendingUp,
  MapPin,
  User,
  History,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../context/ToastContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Handle outside click and Escape key for Profile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (profileDropdownOpen) {
          setProfileDropdownOpen(false);
          profileTriggerRef.current?.focus();
        }
        if (mobileDrawerOpen) {
          setMobileDrawerOpen(false);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileDropdownOpen &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node) &&
        profileTriggerRef.current &&
        !profileTriggerRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen, mobileDrawerOpen]);

  // Navigation Groups specified in UI/UX requirements:
  // Overview: Dashboard
  // Opportunities: Discover, Saved
  // Progress: Applications, Skill gaps, Roadmap
  // Account: Profile, Search history, Settings
  const navSections = [
    {
      title: 'Overview',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: Compass },
      ],
    },
    {
      title: 'Opportunities',
      items: [
        { to: '/opportunities', label: 'Discover', icon: Sparkles },
        { to: '/saved', label: 'Saved', icon: Bookmark },
      ],
    },
    {
      title: 'Progress',
      items: [
        { to: '/applications', label: 'Applications', icon: Briefcase },
        { to: '/skill-gap', label: 'Skill gaps', icon: TrendingUp },
        { to: '/roadmap', label: 'Roadmap', icon: MapPin },
      ],
    },
    {
      title: 'Account',
      items: [
        { to: '/profile', label: 'Profile', icon: User },
        { to: '/history', label: 'Search history', icon: History },
        { to: '/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  // Mobile Bottom Bar Primary Tabs
  const mobileBottomTabs = [
    { to: '/dashboard', label: 'Home', icon: Compass },
    { to: '/opportunities', label: 'Discover', icon: Sparkles },
    { to: '/applications', label: 'Applications', icon: Briefcase },
  ];

  const handleSignOut = () => {
    logout();
    showToast('Signed out successfully', 'info');
    navigate('/login');
  };

  const isDemo = user?.email?.includes('mitva') || user?.email?.includes('riya') || user?.email === 'demo@example.com';

  // Determine current section heading for top bar
  const getCurrentPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard')) return 'Dashboard';
    if (path.startsWith('/opportunities/')) return 'Opportunity Details';
    if (path.startsWith('/opportunities')) return 'Discover Opportunities';
    if (path.startsWith('/saved')) return 'Saved Opportunities';
    if (path.startsWith('/applications')) return 'Applications';
    if (path.startsWith('/skill-gap')) return 'Skill Gaps & Demand';
    if (path.startsWith('/roadmap')) return 'Learning Roadmap';
    if (path.startsWith('/profile')) return 'My Profile';
    if (path.startsWith('/history')) return 'Search History';
    if (path.startsWith('/settings')) return 'Settings & Weights';
    if (path.startsWith('/agent')) return 'Discovery Pipeline';
    if (path.startsWith('/onboarding')) return 'Profile Onboarding';
    return 'OpportunityOS';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 1. Desktop Sidebar (approx 232px wide) */}
      <aside
        className="hidden md:flex md:flex-col md:w-[232px] bg-white border-r border-slate-200 shrink-0 select-none z-30 sticky top-0 h-screen"
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-200 justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-base shadow-xs group-hover:bg-brand-700 transition-colors">
              O
            </div>
            <div className="flex items-baseline">
              <span className="text-base font-extrabold tracking-tight text-slate-900">Opportunity</span>
              <span className="text-base font-extrabold text-brand-600">OS</span>
            </div>
          </Link>
        </div>

        {/* Grouped Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.to === '/dashboard'
                      ? location.pathname === '/dashboard'
                      : location.pathname.startsWith(item.to);

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-bold border-l-2 border-brand-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-brand-600 stroke-[2.5]' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Demo Persona Indicator (if applicable) */}
        {isDemo && (
          <div className="p-3 mx-3 mb-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Demo Persona</span>
            </div>
            <p className="text-[11px] text-amber-700">Pre-seeded student profile</p>
          </div>
        )}

        {/* User Mini Profile in Sidebar Bottom */}
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.full_name ? user.full_name.charAt(0) : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                  {user?.full_name || 'Student'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'student@example.com'}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Compact Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle for drawer */}
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile Brand Mark */}
            <div className="md:hidden flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center">
                O
              </div>
              <span className="font-extrabold text-slate-900 text-sm">OpportunityOS</span>
            </div>

            {/* Desktop Current View Breadcrumb / Title */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">OpportunityOS</span>
              <span className="text-xs text-slate-300">/</span>
              <h2 className="text-sm font-bold text-slate-800">{getCurrentPageTitle()}</h2>
            </div>
          </div>

          {/* Right Top Bar Area: Profile menu & Quick Status */}
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Demo Profile</span>
              </span>
            )}

            {/* Click- and Keyboard-operated Profile Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                ref={profileTriggerRef}
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={profileDropdownOpen}
                aria-controls="user-profile-menu"
                className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {user?.full_name ? user.full_name.charAt(0) : 'U'}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-slate-700 max-w-[120px] truncate">
                  {user?.full_name?.split(' ')[0] || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Accessible Dropdown Modal */}
              {profileDropdownOpen && (
                <div
                  id="user-profile-menu"
                  role="menu"
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100"
                >
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.full_name}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  </div>

                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    to="/history"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    <span>Search history</span>
                  </Link>

                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings & Matching</span>
                  </Link>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto">{children}</main>

        {/* App Footer */}
        <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">OpportunityOS</span>
              <span>— Deterministic Match Engine & Opportunity Discovery</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Empowering students & freshers to take the next career step
            </div>
          </div>
        </footer>
      </div>

      {/* 2. Mobile Drawer Sheet (Accessible, slide over before tablet width is cramped) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col z-10 shadow-2xl p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-600 text-white font-extrabold text-sm flex items-center justify-center">
                  O
                </div>
                <span className="font-black text-slate-900 text-base">OpportunityOS</span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {navSections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {section.title}
                  </div>
                  <nav className="space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.to === '/dashboard'
                          ? location.pathname === '/dashboard'
                          : location.pathname.startsWith(item.to);

                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            isActive
                              ? 'bg-brand-50 text-brand-700 font-bold border-l-4 border-brand-600'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Mobile Drawer Footer with Sign Out */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Bottom Navigation Bar (Phones: Home, Discover, Applications, More) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)' }}
        aria-label="Mobile Navigation"
      >
        {mobileBottomTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.to === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(tab.to);

          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-1 px-3 min-w-[60px] min-h-[44px] rounded-xl text-xs font-semibold transition-colors ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600 stroke-[2.5]' : 'text-slate-400'}`} />
              <span className="text-[11px] mt-0.5">{tab.label}</span>
            </Link>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 min-w-[60px] min-h-[44px] rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800"
          aria-label="Open more options"
        >
          <MoreHorizontal className="w-5 h-5 text-slate-400" />
          <span className="text-[11px] mt-0.5">More</span>
        </button>
      </nav>
    </div>
  );
};
