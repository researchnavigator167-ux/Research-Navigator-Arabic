/*
# Research Navigator - Complete Schema

## Overview
Arabic-first academic research platform. Multi-user app with authentication.
Each user owns their research projects and all child data.

## New Tables
1. research_projects - Main research project container
2. sources - Academic papers/sources saved by users
3. evidence_items - Evidence entries linked to claims and sources
4. research_gaps - Potential research gaps identified
5. research_briefs - Structured research brief documents
6. ai_conversations - AI assistant conversation threads
7. ai_messages - Individual messages in AI conversations
8. notes - Personal notes on sources or projects

## Security
- RLS enabled on all tables, owner-scoped via user_id DEFAULT auth.uid()
- 4 separate CRUD policies per table
*/

CREATE TABLE IF NOT EXISTS research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  topic text,
  field text,
  language text DEFAULT 'ar',
  description text,
  research_question text,
  keywords text[] DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_projects" ON research_projects;
CREATE POLICY "select_own_projects" ON research_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON research_projects;
CREATE POLICY "insert_own_projects" ON research_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON research_projects;
CREATE POLICY "update_own_projects" ON research_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON research_projects;
CREATE POLICY "delete_own_projects" ON research_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES research_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  authors text,
  year int,
  journal text,
  abstract text,
  doi text,
  url text,
  provider text,
  provider_id text,
  open_access boolean DEFAULT false,
  citation_count int,
  keywords text[] DEFAULT '{}',
  notes text,
  tags text[] DEFAULT '{}',
  saved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_sources" ON sources;
CREATE POLICY "select_own_sources" ON sources FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_sources" ON sources;
CREATE POLICY "insert_own_sources" ON sources FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_sources" ON sources;
CREATE POLICY "update_own_sources" ON sources FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_sources" ON sources;
CREATE POLICY "delete_own_sources" ON sources FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  claim text NOT NULL,
  evidence_type text DEFAULT 'supports',
  evidence_text text,
  notes text,
  confidence text DEFAULT 'insufficient',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_evidence" ON evidence_items;
CREATE POLICY "select_own_evidence" ON evidence_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_evidence" ON evidence_items;
CREATE POLICY "insert_own_evidence" ON evidence_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_evidence" ON evidence_items;
CREATE POLICY "update_own_evidence" ON evidence_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_evidence" ON evidence_items;
CREATE POLICY "delete_own_evidence" ON evidence_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS research_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  gap_type text NOT NULL,
  description text NOT NULL,
  supporting_sources text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE research_gaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_gaps" ON research_gaps;
CREATE POLICY "select_own_gaps" ON research_gaps FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_gaps" ON research_gaps;
CREATE POLICY "insert_own_gaps" ON research_gaps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_gaps" ON research_gaps;
CREATE POLICY "update_own_gaps" ON research_gaps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_gaps" ON research_gaps;
CREATE POLICY "delete_own_gaps" ON research_gaps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS research_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE research_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_briefs" ON research_briefs;
CREATE POLICY "select_own_briefs" ON research_briefs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_briefs" ON research_briefs;
CREATE POLICY "insert_own_briefs" ON research_briefs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_briefs" ON research_briefs;
CREATE POLICY "update_own_briefs" ON research_briefs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_briefs" ON research_briefs;
CREATE POLICY "delete_own_briefs" ON research_briefs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES research_projects(id) ON DELETE CASCADE,
  title text DEFAULT 'محادثة جديدة',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_conversations" ON ai_conversations;
CREATE POLICY "select_own_conversations" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_conversations" ON ai_conversations;
CREATE POLICY "insert_own_conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_conversations" ON ai_conversations;
CREATE POLICY "update_own_conversations" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_conversations" ON ai_conversations;
CREATE POLICY "delete_own_conversations" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_messages" ON ai_messages;
CREATE POLICY "select_own_messages" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_messages" ON ai_messages;
CREATE POLICY "insert_own_messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_messages" ON ai_messages;
CREATE POLICY "update_own_messages" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_messages" ON ai_messages;
CREATE POLICY "delete_own_messages" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES research_projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_notes" ON notes;
CREATE POLICY "select_own_notes" ON notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notes" ON notes;
CREATE POLICY "insert_own_notes" ON notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notes" ON notes;
CREATE POLICY "update_own_notes" ON notes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notes" ON notes;
CREATE POLICY "delete_own_notes" ON notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON research_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON research_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_project_id ON sources(project_id);
CREATE INDEX IF NOT EXISTS idx_sources_doi ON sources(doi);
CREATE INDEX IF NOT EXISTS idx_evidence_project_id ON evidence_items(project_id);
CREATE INDEX IF NOT EXISTS idx_gaps_project_id ON research_gaps(project_id);
CREATE INDEX IF NOT EXISTS idx_briefs_project_id ON research_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON ai_messages(conversation_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON research_projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON research_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_briefs_updated_at ON research_briefs;
CREATE TRIGGER trg_briefs_updated_at BEFORE UPDATE ON research_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();