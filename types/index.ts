export interface User {
  id: string;
  email: string;
  full_name: string | null;
  country: string;
  currency: string;
  plan: 'free' | 'premium';
  show_decimals: boolean;
  trial_ends_at: string;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
  type: 'individual' | 'family';
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface FinancialProfile {
  id: string;
  household_id: string;
  total_income: number;
  income_type: 'fixed' | 'variable' | 'mixed';
  total_fixed_expenses: number;
  total_debt: number;
  total_savings: number;
  savings_cash: number;
  savings_investments: number;
  has_emergency_fund: boolean;
  health_score: number;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  household_id: string;
  name: string;
  bucket: 'needs' | 'wants' | 'savings';
  budgeted_amount: number;
  is_custom: boolean;
}

export interface BudgetSubItem {
  id: string;
  category_id: string;
  household_id: string;
  name: string;
  amount: number;
  is_fixed: boolean;
  payment_method: 'efectivo' | 'tarjeta' | 'cheque' | 'transferencia';
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  category_id: string;
  amount: number;
  description: string | null;
  date: string;
  source: 'manual' | 'voice' | 'ocr' | 'csv';
  voice_raw_text: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  household_id: string;
  name: string;
  type: 'credit' | 'loan' | 'informal';
  balance: number;
  interest_rate: number;
  min_payment: number;
  due_day: number;
  strategy: 'snowball' | 'avalanche';
  is_paid: boolean;
  created_at: string;
}

export interface ActionPlan {
  id: string;
  household_id: string;
  month: string;
  steps: ActionStep[];
  completed_steps: ActionStep[];
  generated_by: 'rule' | 'ai';
  created_at: string;
}

export interface ActionStep {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MonthlySnapshot {
  id: string;
  household_id: string;
  month: string;
  health_score: number;
  income: number;
  expenses: number;
  savings: number;
  plan_completed: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  plan: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_end: string;
}

// Onboarding state
export interface OnboardingData {
  householdName: string;
  householdType: 'individual' | 'family';
  totalIncome: number;
  incomeType: 'fixed' | 'variable' | 'mixed';
  fixedExpenses: {
    vivienda: number;
    transporte: number;
    servicios: number;
    alimentacion: number;
    salud: number;
    educacion: number;
  };
  hasDebts: boolean;
  debts: {
    name: string;
    type: 'credit' | 'loan' | 'informal';
    balance: number;
    interestRate: number;
    minPayment: number;
  }[];
  totalSavings: number;
  savingsCash: number;
  savingsInvestments: number;
  hasEmergencyFund: boolean;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  input_mode: 'text' | 'voice';
  model_used: string | null;
  created_at: string;
}

// Voice types
export interface ExtractedTransaction {
  amount: number;
  description: string;
  category: string;
  category_id?: string;
  date: string;
  confidence: number;
}

export interface VoiceExtractionResult {
  transactions: ExtractedTransaction[];
  raw_text: string;
  ambiguous: boolean;
  clarification?: string;
}

export type VoiceState = 'idle' | 'recording' | 'processing' | 'extracting' | 'confirming' | 'saving' | 'done' | 'error';

// Education types
export interface CapsuleModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order_index: number;
  is_premium: boolean;
  total_capsules: number;
  created_at: string;
}

export interface Capsule {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content_md: string;
  key_takeaway: string | null;
  read_time_minutes: number;
  order_index: number;
  is_premium: boolean;
  tags: string[];
  related_score_component: string | null;
  score_threshold: number | null;
  created_at: string;
}

export interface UserCapsuleProgress {
  user_id: string;
  capsule_id: string;
  read_at: string;
  bookmarked: boolean;
}

export interface CapsuleRecommendation {
  capsule_id: string;
  title: string;
  subtitle: string;
  module_title: string;
  module_slug: string;
  slug: string;
  read_time_minutes: number;
  reason: string;
}

// Income entry (stored in localStorage)
export interface IncomeEntry {
  id: string;
  source: string;
  member: string;
  amount: number;
  frequency: 'mensual' | 'quincenal' | 'semanal' | 'anual';
}

// Legacy formatCurrency — new code should use formatMoney from @/lib/format
export function formatCurrency(amount: number, currency = 'GTQ'): string {
  if (currency === 'GTQ') {
    return `Q ${amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency }).format(amount);
}

// Default budget categories
export const DEFAULT_CATEGORIES: Omit<BudgetCategory, 'id' | 'household_id'>[] = [
  // Necesidades (50%)
  { name: 'Vivienda/alquiler', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  { name: 'Alimentación', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  { name: 'Transporte', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  { name: 'Salud/medicinas', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  { name: 'Servicios', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  { name: 'Educación', bucket: 'needs', budgeted_amount: 0, is_custom: false },
  // Gustos (30%)
  { name: 'Restaurantes y salidas', bucket: 'wants', budgeted_amount: 0, is_custom: false },
  { name: 'Ropa', bucket: 'wants', budgeted_amount: 0, is_custom: false },
  { name: 'Entretenimiento', bucket: 'wants', budgeted_amount: 0, is_custom: false },
  { name: 'Suscripciones', bucket: 'wants', budgeted_amount: 0, is_custom: false },
  { name: 'Varios personales', bucket: 'wants', budgeted_amount: 0, is_custom: false },
  // Ahorro/Deudas (20%)
  { name: 'Fondo de emergencia', bucket: 'savings', budgeted_amount: 0, is_custom: false },
  { name: 'Ahorro para metas', bucket: 'savings', budgeted_amount: 0, is_custom: false },
  { name: 'Pago extra de deudas', bucket: 'savings', budgeted_amount: 0, is_custom: false },
];
