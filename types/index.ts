export type Role = 'admin' | 'partner' | 'employee';

export interface Employee {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  role: Role;
  avatar_url?: string;
  joined_at: string;
  is_active: boolean;
  access_crm_leads: boolean;
  access_crm_clients: boolean;
  access_accounting: boolean;
  access_marketing: boolean;
  access_operations: boolean;
  access_tasks: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'offer_sent' | 'negotiation' | 'won' | 'lost';
export type LeadSource = 'manual' | 'csv' | 'lemlist' | 'clay' | 'form';
export type ContactStatus = 'not_contacted' | 'in_sequence' | 'replied' | 'bounced' | 'unsubscribed' | 'meeting_booked';

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  source: LeadSource;
  external_id?: string;
  status: LeadStatus;
  owner_id?: string;
  owner?: Employee;
  tags: string[];
  is_archived: boolean;
  currency: 'PLN' | 'EUR' | 'USD';
  estimated_value?: number;
  contact_status: ContactStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  last_activity_at?: string;
}

export type LeadActivityType = 'note' | 'call' | 'email' | 'meeting' | 'status_change';

export interface LeadActivity {
  id: string;
  lead_id: string;
  type: LeadActivityType;
  content?: string;
  old_value?: string;
  new_value?: string;
  created_by: string;
  created_by_employee?: Employee;
  created_at: string;
}

export type ClientStatus = 'active' | 'needs_attention' | 'closed';

export interface Client {
  id: string;
  lead_id?: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  nip?: string;
  regon?: string;
  contract_number?: string;
  contract_date?: string;
  status: ClientStatus;
  total_value: number;
  currency: 'PLN' | 'EUR' | 'USD';
  owner_id?: string;
  owner?: Employee;
  tags: string[];
  is_archived: boolean;
  notes?: string;
  google_drive_folder_id?: string;
  google_drive_shared_folder_id?: string;
  onboarding_done_at?: string;
  created_at: string;
  updated_at: string;
}

export type RevenueStatus = 'paid' | 'pending' | 'overdue';

export interface RevenueCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Revenue {
  id: string;
  title: string;
  description?: string;
  amount: number;        // brutto
  amount_net?: number;   // netto
  vat_rate?: number;     // stawka VAT w %, null = zw.
  vat_amount?: number;   // kwota VAT
  amount_pln?: number;
  currency: 'PLN' | 'EUR' | 'USD';
  exchange_rate: number;
  category_id?: string;
  category?: RevenueCategory;
  revenue_date: string;
  client_id?: string;
  invoice_number?: string;
  status: RevenueStatus;
  project_name?: string;
  note?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CostCategory {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Cost {
  id: string;
  title: string;
  description?: string;
  amount: number;        // brutto
  amount_net?: number;   // netto
  vat_rate?: number;     // stawka VAT w %, null = zw.
  vat_amount?: number;   // kwota VAT
  amount_pln?: number;
  currency: 'PLN' | 'EUR' | 'USD';
  exchange_rate: number;
  category_id?: string;
  category?: CostCategory;
  cost_date: string;
  paid_by: string;
  paid_by_employee?: Employee;
  client_id?: string;
  client?: Client;
  project_name?: string;
  attachment_url?: string;
  note?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface Task {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
  position: number;
  client_id?: string;
  client?: Client;
  lead_id?: string;
  lead?: Lead;
  assignees: Employee[];
  comments_count: number;
  checklist_total: number;
  checklist_done: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
}

export type CampaignStatus = 'planning' | 'active' | 'paused' | 'done';
export type CampaignType = 'social' | 'email' | 'mixed';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  start_date?: string;
  end_date?: string;
  budget?: number;
  budget_currency: 'PLN' | 'EUR' | 'USD';
  status: CampaignStatus;
  created_by: string;
  created_at: string;
}

// ─── Quotes ──────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

export interface QuoteLineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: 'szt' | 'godz' | 'mies' | 'projekt' | 'dzień';
  unit_price_net: number;
  vat_rate: number; // 0, 5, 8, 23
  amount_net: number;
  vat_amount: number;
  amount_gross: number;
}

export interface Quote {
  id: string;
  number: string;
  title: string;
  client_name: string;
  status: QuoteStatus;
  created_at: string;
  valid_until: string;
  items: QuoteLineItem[];
  discount_percent: number;
  notes?: string;
  total_net: number;
  total_vat: number;
  total_gross: number;
  currency: 'PLN' | 'EUR' | 'USD';
}

export interface Notification {
  id: string;
  employee_id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

// ─── Email Campaigns ──────────────────────────────────────────────────────────

export type EmailCampaignStatus = 'draft' | 'active' | 'paused' | 'completed';

export type RecipientFilterType = 'all' | 'status' | 'source';

export interface RecipientFilter {
  type: RecipientFilterType;
  value?: string;
}

export interface EmailCampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  subject: string;
  body_html: string;
  delay_days: number;
  created_at: string;
}

export type RecipientStatus = 'pending' | 'active' | 'completed' | 'bounced' | 'replied' | 'unsubscribed';

export interface EmailCampaignRecipient {
  id: string;
  campaign_id: string;
  lead_id: string;
  lead?: Lead;
  status: RecipientStatus;
  current_step: number;
  next_send_at?: string;
  last_sent_at?: string;
  created_at: string;
}

export interface SendWindow {
  days: number[];  // 0=Ndz 1=Pon 2=Wt 3=Śr 4=Czw 5=Pt 6=Sob
  from: string;    // "HH:MM"
  to: string;      // "HH:MM"
  tz: string;      // IANA, np. "Europe/Warsaw"
}

export interface EmailCampaign {
  id: string;
  name: string;
  from_name: string;
  from_email: string;
  signature_html?: string | null;
  status: EmailCampaignStatus;
  recipient_filter: RecipientFilter;
  stop_on_open: boolean;
  stop_on_reply: boolean;
  send_window: SendWindow | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  bounced_count: number;
  steps?: EmailCampaignStep[];
  recipients?: EmailCampaignRecipient[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  leads_total: number;
  leads_new: number;
  leads_won_month: number;
  clients_active: number;
  tasks_pending: number;
  tasks_overdue: number;
  costs_month: number;
  costs_month_eur: number;
  costs_month_usd: number;
  campaigns_active: number;
}
