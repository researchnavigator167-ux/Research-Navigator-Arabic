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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project } = await supabase
      .from("research_projects")
      .select("title, topic, field, research_question, keywords")
      .eq("id", projectId)
      .single();

    const { data: sources } = await supabase
      .from("sources")
      .select("title, authors, year, journal, abstract")
      .eq("project_id", projectId)
      .limit(20);

    const { data: evidence } = await supabase
      .from("evidence_items")
      .select("claim, evidence_type")
      .eq("project_id", projectId);

    const { data: existingGaps } = await supabase
      .from("research_gaps")
      .select("*")
      .eq("project_id", projectId);

    const gaps: { gap_type: string; description: string; supporting_sources: string }[] = [];

    const sourceCount = sources?.length || 0;
    const evidenceCount = evidence?.length || 0;

    // Analyze potential gaps based on available data
    if (sourceCount < 5) {
      gaps.push({
        gap_type: "gapLimited",
        description: `الأدلة المتاحة محدودة (${sourceCount} مصادر فقط). هذا يشير إلى فجوة بحثية محتملة في دراسة "${project?.topic || "الموضوع"}" - قد تكون هناك حاجة لدراسات إضافية في هذا المجال.`,
        supporting_sources: sources?.slice(0, 3).map((s) => s.title).join("؛ ") || "لا توجد مصادر كافية",
      });
    }

    const supports = evidence?.filter((e) => e.evidence_type === "supports") || [];
    const opposes = evidence?.filter((e) => e.evidence_type === "opposes") || [];
    const mixed = evidence?.filter((e) => e.evidence_type === "mixed") || [];

    if (opposes.length > 0 || mixed.length > 0) {
      gaps.push({
        gap_type: "gapContradictory",
        description: `توجد نتائج متعارضة حول "${project?.research_question || project?.topic || ""}". تشير الأدلة إلى وجود اختلاف بين الدراسات، مما يفتح فجوة بحثية محتملة لدراسة الأسباب وراء هذا التعارض.`,
        supporting_sources: [...opposes, ...mixed].slice(0, 3).map((e) => e.claim).join("؛ ") || "غير متوفر",
      });
    }

    // Check for methodological gaps
    if (sourceCount > 0) {
      gaps.push({
        gap_type: "gapMethodological",
        description: `قد تكون هناك فجوة منهجية في دراسة "${project?.topic || ""}". تختلف الدراسات المتاحة في منهجياتها، وقد تكون هناك حاجة لدراسات تستخدم منهجيات أكثر صرامة أو أدوات قياس موحدة.`,
        supporting_sources: sources?.slice(0, 3).map((s) => s.title).join("؛ ") || "غير متوفر",
      });
    }

    // Check for geographic/cultural gaps
    if (project?.field && ["العلوم الاجتماعية", "علم النفس", "التربية", "العلوم الإنسانية", "Psychology", "Education", "Social Sciences", "Humanities"].includes(project.field)) {
      gaps.push({
        gap_type: "gapGeographic",
        description: `قد تكون هناك فجوة جغرافية وثقافية في دراسة "${project?.topic || ""}". معظم الدراسات المتاحة قد تكون أجريت في سياقات ثقافية مختلفة عن السياق العربي، مما يخلق فجوة محتملة لتطبيق الدراسة في السياق المحلي.`,
        supporting_sources: sources?.slice(0, 3).map((s) => s.title).join("؛ ") || "غير متوفر",
      });
    }

    // Check for population gaps
    gaps.push({
      gap_type: "gapPopulation",
      description: `قد تكون هناك فجوة في العينة المدروسة. قد تكون الدراسات المتاحة ركزت على فئات معينة دون أخرى. يُنصح بمراجعة عينات الدراسات المتاحة لتحديد الفئات التي لم تتم دراستها بشكل كافٍ.`,
      supporting_sources: sources?.slice(0, 3).map((s) => s.title).join("؛ ") || "غير متوفر",
    });

    // Check for temporal gaps
    if (sources && sources.length > 0) {
      const years = sources.map((s) => s.year).filter((y) => y !== null) as number[];
      const recentCount = years.filter((y) => y >= 2020).length;
      if (recentCount < sourceCount * 0.3) {
        gaps.push({
          gap_type: "gapTemporal",
          description: `قد تكون هناك فجوة زمنية. نسبة كبيرة من المصادر المتاحة قديمة نسبيًا. قد تكون هناك حاجة لدراسات حديثة تعكس التغيرات في "${project?.topic || ""}".`,
          supporting_sources: `${recentCount} من ${sourceCount} مصادر حديثة (2020+)`,
        });
      }
    }

    // Save gaps to database
    const gapsToInsert = gaps.filter((g) => {
      return !existingGaps?.some((eg) => eg.gap_type === g.gap_type && eg.description === g.description);
    });

    if (gapsToInsert.length > 0) {
      const gapsWithProject = gapsToInsert.map((g) => ({
        ...g,
        project_id: projectId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      })).filter((g) => g.user_id);

      if (gapsWithProject.length > 0) {
        await supabase.from("research_gaps").insert(gapsWithProject);
      }
    }

    return new Response(JSON.stringify({
      gaps,
      totalGaps: gaps.length,
      newGaps: gapsToInsert.length,
      note: "هذه فجوات بحثية محتملة وليست مؤكدة. كل فجوة مرتبطة بالمصادر المتاحة ويُنصح بالتحقق منها.",
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
