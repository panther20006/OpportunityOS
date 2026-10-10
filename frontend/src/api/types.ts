export interface User {
  id: string;
  full_name: string;
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
  profile_complete: boolean;
}

export interface ProfileData {
  education_level: string;
  degree?: string | null;
  field_of_study?: string | null;
  graduation_year?: number | null;
  institution?: string | null;
  experience_level: string;
  location_city?: string | null;
  location_state?: string | null;
  location_country: string;
  open_to_remote: boolean;
  weekly_learning_hours: number;
  updated_at?: string | null;
}

export interface SkillItem {
  skill_id?: string;
  name: string;
  proficiency: number;
}

export interface SkillAutocompleteItem {
  id: string;
  name: string;
  category?: string;
  aliases?: string[];
}

export interface CareerGoalData {
  id?: string;
  target_role: string;
  goal_statement?: string | null;
  timeline_months: number;
  opportunity_types: string[];
}

export interface ProfileResponse {
  user: User;
  profile?: ProfileData | null;
  skills: SkillItem[];
  career_goal?: CareerGoalData | null;
  profile_complete: boolean;
}

export interface TopSkillItem {
  name: string;
  has: boolean;
  requirement: string;
}

export interface OpportunityListItem {
  id: string;
  title: string;
  company_name?: string | null;
  location?: string | null;
  is_remote: boolean;
  opportunity_type: string;
  source_engine: string;
  source_via?: string | null;
  posted_at_text?: string | null;
  salary_text?: string | null;
  match_score?: number | null;
  low_confidence: boolean;
  top_skills: TopSkillItem[];
  saved: boolean;
  application_status?: string | null;
  application_id?: string | null;
  is_demo?: boolean;
}

export interface OpportunityListResponse {
  session_id?: string | null;
  items: OpportunityListItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface BreakdownComponent {
  key: string;
  weight: number;
  score: number;
  points: number;
}

export interface MatchBreakdown {
  weights_version: string;
  components: BreakdownComponent[];
}

export interface SkillRequirementItem {
  id: string;
  name: string;
  requirement: string;
}

export interface MatchDetail {
  match_score?: number | null;
  low_confidence: boolean;
  breakdown?: MatchBreakdown | null;
  matched_skills: SkillRequirementItem[];
  missing_skills: SkillRequirementItem[];
}

export interface OpportunityDetailData {
  id: string;
  title: string;
  company_name?: string | null;
  location?: string | null;
  is_remote: boolean;
  opportunity_type: string;
  schedule_type?: string | null;
  source_engine: string;
  source_via?: string | null;
  apply_url?: string | null;
  posted_at_text?: string | null;
  salary_text?: string | null;
  description?: string | null;
  highlights?: Array<{ title: string; items: string[] }> | null;
  first_seen_at?: string | null;
  is_demo?: boolean;
}

export interface OpportunityDetailResponse {
  opportunity: OpportunityDetailData;
  match?: MatchDetail | null;
  saved: boolean;
  application?: { id: string; status: string } | null;
}

export interface StageDetail {
  key: string;
  status: 'pending' | 'running' | 'done' | 'warn' | 'failed';
  started_at?: string;
  duration_ms?: number;
  detail?: any;
}

export interface AgentSessionResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  created_at: string;
  stages: StageDetail[];
  warnings: Array<{ code: string; message: string; engine?: string }>;
  result_summary?: {
    opportunity_count: number;
    best_score: number;
    news?: Array<{ title: string; link: string; source: string; date: string }>;
  } | null;
}

export interface SkillGapItem {
  rank: number;
  skill: { id: string; name: string };
  priority: 'high' | 'medium' | 'low';
  demand_count: number;
  demand_pct: number;
  avg_uplift: number;
  priority_score: number;
  opportunity_ids: string[];
}

export interface SkillGapResponse {
  session_id: string;
  top_n: number;
  items: SkillGapItem[];
}

export interface RoadmapStepItem {
  id: string;
  step_order: number;
  step_type: 'learn' | 'build' | 'apply';
  title: string;
  description?: string | null;
  reason?: string | null;
  estimated_hours?: number | null;
  action?: string | null;
  resource_query?: string | null;
  resources?: any[];
  is_completed: boolean;
  completed_at?: string | null;
  skill?: { id: string; name: string } | null;
  opportunity?: { id: string; title: string } | null;
}

export interface RoadmapResponse {
  id: string;
  session_id: string;
  title: string;
  summary?: string | null;
  total_weeks?: number | null;
  generation_method: string;
  progress_pct: number;
  steps: RoadmapStepItem[];
}

export interface ApplicationItem {
  id: string;
  status: 'planned' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';
  applied_on?: string | null;
  notes?: string | null;
  opportunity?: {
    id: string;
    title: string;
    company_name?: string | null;
    match_score?: number | null;
  } | null;
  updated_at: string;
}

export interface ApplicationListResponse {
  items: ApplicationItem[];
  page: number;
  page_size: number;
  total: number;
}

export interface QueryLogItem {
  engine: string;
  query: string;
  location?: string | null;
  result_count: number;
  cached: boolean;
  latency_ms?: number | null;
}

export interface SearchHistorySessionItem {
  session_id: string;
  status: string;
  created_at: string;
  target_role?: string | null;
  opportunity_count: number;
  best_score: number;
  queries: QueryLogItem[];
}

export interface SearchHistoryResponse {
  items: SearchHistorySessionItem[];
  page: number;
  page_size: number;
  total: number;
}
