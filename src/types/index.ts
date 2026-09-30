export interface ResearchProject {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  field: string | null;
  language: string;
  description: string | null;
  research_question: string | null;
  keywords: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  authors: string | null;
  year: number | null;
  journal: string | null;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  provider: string | null;
  provider_id: string | null;
  open_access: boolean;
  citation_count: number | null;
  keywords: string[];
  notes: string | null;
  tags: string[];
  saved: boolean;
  created_at: string;
}

export interface EvidenceItem {
  id: string;
  user_id: string;
  project_id: string;
  source_id: string | null;
  claim: string;
  evidence_type: 'supports' | 'opposes' | 'mixed' | 'insufficient';
  evidence_text: string | null;
  notes: string | null;
  confidence: string;
  created_at: string;
}

export interface ResearchGap {
  id: string;
  user_id: string;
  project_id: string;
  gap_type: string;
  description: string;
  supporting_sources: string | null;
  created_at: string;
}

export interface ResearchBrief {
  id: string;
  user_id: string;
  project_id: string;
  content: BriefContent;
  created_at: string;
  updated_at: string;
}

export interface BriefContent {
  title?: string;
  problem?: string;
  question?: string;
  concepts?: string;
  keyStudies?: string;
  availableEvidence?: string;
  agreementPoints?: string;
  disagreementPoints?: string;
  limitations?: string;
  potentialGap?: string;
  suggestedQuestions?: string;
  references?: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  created_at: string;
}

export interface AIMessage {
  id: string;
  user_id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  project_id: string | null;
  source_id: string | null;
  content: string;
  created_at: string;
}

export interface SearchResult {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  provider: string;
  providerIds: { provider: string; id: string }[];
  openAccess: boolean;
  citationCount: number | null;
  keywords: string[];
  providers: string[];
}

export interface QueryExpansion {
  concepts: string[];
  keywords: string[];
  englishTerms: string[];
  synonyms: string[];
  researchQuestions: string[];
  axes: string[];
}

export interface PaperAnalysis {
  objective: string;
  researchQuestion: string;
  hypotheses: string;
  methodology: string;
  sample: string;
  instruments: string;
  variables: string;
  results: string;
  limitations: string;
  recommendations: string;
  relationToUserTopic: string;
  evidenceLevel: 'full_text' | 'abstract_only';
}
