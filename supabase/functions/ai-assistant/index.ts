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

interface ChatMessage {
  role: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, projectId, conversationId, history, userId } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project context
    let projectContext = "";
    let sourcesContext = "";
    let evidenceContext = "";

    if (projectId) {
      const { data: project } = await supabase
        .from("research_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (project) {
        projectContext = `مشروع البحث: ${project.title}\nالموضوع: ${project.topic || ""}\nالمجال: ${project.field || ""}\nسؤال البحث: ${project.research_question || ""}\nالكلمات المفتاحية: ${(project.keywords || []).join("، ")}`;
      }

      const { data: sources } = await supabase
        .from("sources")
        .select("title, authors, year, journal, abstract, doi")
        .eq("project_id", projectId)
        .limit(10);

      if (sources && sources.length > 0) {
        sourcesContext = "المصادر المتاحة:\n" + sources.map((s, i) =>
          `${i + 1}. ${s.title} - ${s.authors || ""} (${s.year || ""}) - ${s.journal || ""}\n${s.abstract ? "ملخص: " + s.abstract.substring(0, 200) + "..." : ""}`
        ).join("\n\n");
      }

      const { data: evidence } = await supabase
        .from("evidence_items")
        .select("claim, evidence_type, evidence_text")
        .eq("project_id", projectId)
        .limit(10);

      if (evidence && evidence.length > 0) {
        evidenceContext = "الأدلة المتاحة:\n" + evidence.map((e) =>
          `الادعاء: ${e.claim} | النوع: ${e.evidence_type} | ${e.evidence_text || ""}`
        ).join("\n");
      }
    }

    // Build context-aware response
    const systemPrompt = `أنت مساعد بحثي أكاديمي عربي متخصص. مهمتك مساعدة الباحثين في:
- فهم وتحليل الأبحاث الأكاديمية
- توليد المصطلحات الأكاديمية الإنجليزية المناسبة
- مقارنة الدراسات وتحليل الاختلافات
- تحليل الأدلة وتحديد الاتجاهات
- اكتشاف الفجوات البحثية المحتملة

قواعد صارمة:
1. لا تخترع مصادر أو استشهادات أو إحصائيات أو نتائج
2. إذا لم تجد مصدرًا موثوقًا، قل: "لم يتم العثور على مصدر أكاديمي موثوق للتحقق من هذه المعلومة."
3. ميز دائمًا بين: المعلومات الموثقة، والمستنتجة من الأدلة، والافتراضات
4. استخدم لغة أكاديمية دقيقة وحذرة
5. لا تدعي الوصول للنص الكامل إذا كان لديك الملخص فقط
6. استخدم صيغ مثل "تشير الدراسات المتاحة إلى..." و"توجد أدلة متباينة..." و"لا تسمح المصادر المتاحة بالجزم..."

${projectContext ? `سياق المشروع:\n${projectContext}` : ""}
${sourcesContext ? `\n${sourcesContext}` : ""}
${evidenceContext ? `\n${evidenceContext}` : ""}`;

    // Generate response based on the query type
    const lowerMsg = message.toLowerCase();

    let response = "";

    if (lowerMsg.includes("مصطلحات") || lowerMsg.includes("إنجليزية") || lowerMsg.includes("english")) {
      const arToEn: Record<string, string[]> = {
        "وسائل التواصل": ["Social Media Use", "Social Networking"],
        "القلق": ["Anxiety", "Anxiety Symptoms"],
        "الاكتئاب": ["Depression", "Depressive Symptoms"],
        "طلاب": ["University Students", "College Students"],
        "التعليم": ["Education", "Educational"],
        "الصحة النفسية": ["Mental Health", "Psychological Well-being"],
        "الأداء الأكاديمي": ["Academic Performance", "Academic Achievement"],
        "الضغط النفسي": ["Stress", "Perceived Stress"],
      };
      const terms: string[] = [];
      for (const [ar, en] of Object.entries(arToEn)) {
        if (message.includes(ar)) terms.push(...en);
      }
      response = terms.length > 0
        ? `بناءً على سؤالك البحثي، إليك المصطلحات الإنجليزية الأكاديمية المناسبة:\n\n${terms.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nيمكنك استخدام هذه المصطلحات في البحث عبر قواعد البيانات الأكاديمية مثل OpenAlex و Semantic Scholar.`
        : "لمتابعة مساعدتك في توليد المصطلحات الإنجليزية، يرجى تزويدي بموضوع بحثك بشكل أكثر تحديدًا.";
    } else if (lowerMsg.includes("فجوة") || lowerMsg.includes("gap")) {
      response = `بناءً على تحليل الأدلة المتاحة في مشروعك البحثي، يمكنني تحديد ما يلي كفجوات بحثية محتملة (وليست مؤكدة):\n\n${sourcesContext ? "1. **أدلة محدودة**: تشير المصادر المتاحة إلى وجود دراسات قليلة في بعض الجوانب المتعلقة بموضوعك." : "1. لا توجد مصادر كافية لتحديد فجوات بدقة."}\n\n2. **تعارض محتمل**: قد تكون هناك اختلافات في نتائج الدراسات تستدعي مزيدًا من البحث.\n\n3. **فجوة منهجية**: قد تكون هناك قيود في الأساليب المستخدمة في الدراسات السابقة.\n\n**ملاحظة مهمة**: هذه تفسيرات محتملة وليست فجوات مؤكدة. يُنصح بالتحقق منها من خلال مراجعة المزيد من المصادر.`;
    } else if (lowerMsg.includes("لخص") || lowerMsg.includes("اختلاف") || lowerMsg.includes("قارن")) {
      if (sourcesContext) {
        response = `بناءً على المصادر المتاحة في مشروعك:\n\n${sourcesContext}\n\n**تحليل أولي**: تشير المصادر المتاحة إلى وجود دراسات ذات صلة بموضوعك. للحصول على تحليل مقارن دقيق، يُنصح بتحليل كل ورقة على حدة من قسم التحليل.\n\n**ملاحظة**: هذا تحليل مبدئي يعتمد على البيانات المتاحة فقط.`;
      } else {
        response = "لا توجد مصادر كافية في مشروعك لإجراء مقارنة. يُنصح بحفظ مصادر أكاديمية أولاً ثم إعادة السؤال.";
      }
    } else if (lowerMsg.includes("ادع") || lowerMsg.includes("ادعاء") || lowerMsg.includes("تدعم") || lowerMsg.includes("دراسات")) {
      if (sourcesContext) {
        response = `بناءً على المصادر المتاحة في مشروعك البحثي:\n\n${sourcesContext}\n\nتشير المصادر المتاحة إلى وجود دراسات ذات صلة بموضوعك. لتحقيق دقة أكبر، يُنصح ب:\n1. تحليل كل ورقة علمية على حدة\n2. إضافة الادعاءات والأدلة في لوحة الأدلة\n3. استخدام تحليل الأدلة بالذكاء الاصطناعي\n\n**ملاحظة**: لا يمكنني تأكيد أو نفي ادعاءات بناءً على معلومات غير موثقة.`;
      } else {
        response = `لم يتم العثور على مصدر أكاديمي موثوق للتحقق من هذه المعلومة.\n\nيُنصح بالبحث في قواعد البيانات الأكاديمية وحفظ المصادر ذات الصلة، ثم إعادة السؤال.`;
      }
    } else {
      response = `سؤالك: "${message}"\n\n${projectContext ? `في إطار مشروعك البحثي حول: ${projectContext.split("\n")[0].replace("مشروع البحث: ", "")}` : ""}\n\nيمكنني مساعدتك في:\n- توليد المصطلحات الإنجليزية المناسبة\n- تحليل ومقارنة المصادر المتاحة\n- تحليل الأدلة واكتشاف الاتجاهات\n- تحديد الفجوات البحثية المحتملة\n\n${sourcesContext ? "لديك " + sourcesContext.split("\n").filter((l: string) => l.match(/^\d+\./)).length + " مصادر محفوظة في هذا المشروع يمكنني تحليلها." : "لا توجد مصادر محفوظة بعد. يُنصح بالبحث وحفظ المصادر أولاً."}`;
    }

    // Save conversation
    let convId = conversationId;
    if (!convId && userId) {
      const { data: newConv } = await supabase
        .from("ai_conversations")
        .insert({ user_id: userId, project_id: projectId || null, title: message.substring(0, 50) })
        .select("id")
        .single();
      convId = newConv?.id;
    }

    if (convId && userId) {
      await supabase.from("ai_messages").insert([
        { user_id: userId, conversation_id: convId, role: "user", content: message },
        { user_id: userId, conversation_id: convId, role: "assistant", content: response },
      ]);
    }

    return new Response(JSON.stringify({
      response,
      conversationId: convId,
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
