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

    const { data: evidence } = await supabase
      .from("evidence_items")
      .select("claim, evidence_type, evidence_text, source:sources(title, authors, year)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (!evidence || evidence.length === 0) {
      return new Response(JSON.stringify({
        generalTrend: "لا توجد أدلة كافية لتحديد الاتجاه العام. يُنصح بإضافة ادعاءات وربطها بالمصادر.",
        agreement: "لا توجد بيانات كافية",
        disagreement: "لا توجد بيانات كافية",
        reasonsForDisagreement: "لا توجد بيانات كافية",
        methodologicalLimitations: "لا توجد بيانات كافية",
        insufficientEvidence: "لا توجد بيانات كافية لتحديد ما لا تزال الأدلة غير كافية لإثباته",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supports = evidence.filter((e) => e.evidence_type === "supports");
    const opposes = evidence.filter((e) => e.evidence_type === "opposes");
    const mixed = evidence.filter((e) => e.evidence_type === "mixed");
    const insufficient = evidence.filter((e) => e.evidence_type === "insufficient");

    let generalTrend = "";
    if (supports.length > opposes.length && supports.length > mixed.length) {
      generalTrend = `تشير الدراسات المتاحة إلى أن ${supports.length} من ${evidence.length} ادعاء تدعم الاتجاه العام. توجد أدلة متباينة في بعض الجوانب.`;
    } else if (opposes.length > supports.length) {
      generalTrend = `تشير الأدلة المتاحة إلى وجود معارضة أكثر من الدعم. ${opposes.length} من ${evidence.length} ادعاء تعارض الاتجاه العام.`;
    } else if (mixed.length > 0 || (supports.length === opposes.length)) {
      generalTrend = `توجد أدلة متباينة. لا تسمح المصادر المتاحة بالجزم باتجاه واضح. يتوزع الأدلة بين الدعم (${supports.length}) والمعارضة (${opposes.length}) والمختلط (${mixed.length}).`;
    } else {
      generalTrend = "الأدلة المتاحة غير كافية لتحديد اتجاه عام واضح.";
    }

    const agreement = supports.length > 0
      ? `نقاط الاتفاق تشمل: ${supports.slice(0, 3).map((e) => e.claim).join("؛ ")}.`
      : "لا توجد نقاط اتفاق واضحة في الأدلة المتاحة";

    const disagreement = opposes.length > 0 || mixed.length > 0
      ? `نقاط الاختلاف تشمل: ${[...opposes, ...mixed].slice(0, 3).map((e) => e.claim).join("؛ ")}.`
      : "لا توجد نقاط اختلاف واضحة في الأدلة المتاحة";

    const reasonsForDisagreement = "قد تعود أسباب الاختلاف إلى: اختلاف العينات، اختلاف الأدوات المستخدمة، اختلاف السياق الثقافي أو الجغرافي، أو اختلاف المنهجية. يُنصح بمراجعة النصوص الكاملة للدراسات لفهم أسباب الاختلاف بدقة.";

    const methodologicalLimitations = "القيود المنهجية المتكررة قد تشمل: حجم العينة، نوع التصميم (مقطعي مقابل طولي)، الاعتماد على التقارير الذاتية، ومحدودية التعميم. هذه استنتاجات محتملة بناءً على طبيعة الأدلة المتاحة.";

    const insufficientEvidence = insufficient.length > 0
      ? `الأدلة غير كافية لإثبات: ${insufficient.slice(0, 3).map((e) => e.claim).join("؛ ")}. يُنصح بالبحث عن مصادر إضافية.`
      : "لا توجد قضايا محددة يمكن القول إن الأدلة غير كافية لإثباتها بشكل قاطع في الوقت الحالي.";

    return new Response(JSON.stringify({
      generalTrend,
      agreement,
      disagreement,
      reasonsForDisagreement,
      methodologicalLimitations,
      insufficientEvidence,
      evidenceCount: evidence.length,
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
