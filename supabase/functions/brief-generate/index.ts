import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getAuthenticatedUser(req: Request): Promise<string | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data } = await supabase.auth.getUser(header.slice(7));
  return data.user?.id ?? null;
}

async function canAccessProject(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const userId = await getAuthenticatedUser(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId } = await req.json();
    if (typeof projectId !== "string" || !projectId) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await canAccessProject(userId, projectId))) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project, error: projectError } = await supabase
      .from("research_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sources } = await supabase
      .from("sources")
      .select("title, authors, year, journal, doi")
      .eq("project_id", projectId)
      .order("citation_count", { ascending: false })
      .limit(10);

    const { data: evidence } = await supabase
      .from("evidence_items")
      .select("claim, evidence_type")
      .eq("project_id", projectId);

    const { data: gaps } = await supabase
      .from("research_gaps")
      .select("*")
      .eq("project_id", projectId);

    const supports = evidence?.filter((e) => e.evidence_type === "supports") || [];
    const opposes = evidence?.filter((e) => e.evidence_type === "opposes") || [];

    const brief = {
      title: project.title || "",
      problem: `تتمحور مشكلة البحث حول: ${project.topic || ""}. ${project.description || ""}`,
      question: project.research_question || "لم يتم تحديد سؤال بحثي بعد",
      concepts: (project.keywords || []).join("، "),
      keyStudies: sources && sources.length > 0
        ? sources.slice(0, 5).map((s, i) =>
            `${i + 1}. ${s.title} - ${s.authors || ""} (${s.year || ""}) - ${s.journal || ""}`
          ).join("\n")
        : "لا توجد مصادر كافية بعد",
      availableEvidence: evidence && evidence.length > 0
        ? `يتوفر ${evidence.length} عنصر أدلة في هذا البحث. ${supports.length} تدعم، ${opposes.length} تعارض.`
        : "لا توجد أدلة كافية بعد",
      agreementPoints: supports.length > 0
        ? supports.slice(0, 5).map((e) => `- ${e.claim}`).join("\n")
        : "لا توجد نقاط اتفاق واضحة بعد",
      disagreementPoints: opposes.length > 0
        ? opposes.slice(0, 5).map((e) => `- ${e.claim}`).join("\n")
        : "لا توجد نقاط اختلاف واضحة بعد",
      limitations: "تشير المصادر المتاحة إلى وجود قيود منهجية محتملة. يُنصح بمراجعة النصوص الكاملة للدراسات لتحديد القيود بدقة.",
      potentialGap: gaps && gaps.length > 0
        ? gaps.map((g) => `- [${g.gap_type}] ${g.description}`).join("\n")
        : "لم يتم تحديد فجوات بحثية محتملة بعد. استخدم أداة اكتشاف الفجوات لتحديدها.",
      suggestedQuestions: [
        `ما العلاقة بين ${project.keywords?.[0] || "المتغير الأول"} و${project.keywords?.[1] || "المتغير الثاني"}؟`,
        `ما الفروق في ${project.topic || "الموضوع"} باختلاف المتغيرات الديموغرافية؟`,
        `ما تأثير ${project.keywords?.[0] || "العامل الأول"} على ${project.keywords?.[1] || "النتيجة"}؟`,
      ].join("\n"),
      references: sources && sources.length > 0
        ? sources.map((s, i) => {
            const ref = `${s.authors || ""} (${s.year || ""}). ${s.title}. ${s.journal || ""}`;
            return `${i + 1}. ${ref}${s.doi ? ` DOI: ${s.doi}` : ""}`;
          }).join("\n")
        : "لا توجد مراجع كافية بعد",
    };

    // Save or update brief
    const { data: existingBrief } = await supabase
      .from("research_briefs")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    if (existingBrief) {
      await supabase
        .from("research_briefs")
        .update({ content: brief })
        .eq("id", existingBrief.id);
    } else {
      await supabase
        .from("research_briefs")
        .insert({ project_id: projectId, user_id: userId, content: brief });
    }

    return new Response(JSON.stringify({
      brief,
      projectId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
