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

async function getAuthenticatedUser(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data } = await supabase.auth.getUser(token);
  return data.user?.id || null;
}

async function verifyProjectMembership(userId: string, projectId: string): Promise<boolean> {
  const { data } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

interface IntentAnalysis {
  type: "terminology" | "gap" | "summarize" | "compare" | "evidence" | "expand" | "methodology" | "general";
  topicFocus: string;
  needsSources: boolean;
  needsEvidence: boolean;
  needsHistory: boolean;
}

function analyzeIntent(message: string): IntentAnalysis {
  const lower = message.toLowerCase();

  if (lower.includes("مصطلح") || lower.includes("إنجليزي") || lower.includes("english") || lower.includes("ترجمة")) {
    return { type: "terminology", topicFocus: "terminology", needsSources: false, needsEvidence: false, needsHistory: true };
  }
  if (lower.includes("فجوة") || lower.includes("gap") || lower.includes("نقص") || lower.includes("ما الذي ينقص")) {
    return { type: "gap", topicFocus: "gaps", needsSources: true, needsEvidence: true, needsHistory: true };
  }
  if (lower.includes("لخص") || lower.includes("ملخص") || lower.includes("summarize") || lower.includes("summary")) {
    return { type: "summarize", topicFocus: "summary", needsSources: true, needsEvidence: false, needsHistory: true };
  }
  if (lower.includes("اختلاف") || lower.includes("قارن") || lower.includes("compare") || lower.includes("فروق") || lower.includes("تباين")) {
    return { type: "compare", topicFocus: "comparison", needsSources: true, needsEvidence: true, needsHistory: true };
  }
  if (lower.includes("ادع") || lower.includes("ادعاء") || lower.includes("تدعم") || lower.includes("دراسات") || lower.includes("أدلة") || lower.includes("دليل")) {
    return { type: "evidence", topicFocus: "evidence", needsSources: true, needsEvidence: true, needsHistory: true };
  }
  if (lower.includes("وسع") || lower.includes("طوّر") || lower.includes("اقترح") || lower.includes("زوايا") || lower.includes("expand") || lower.includes("develop")) {
    return { type: "expand", topicFocus: "expansion", needsSources: true, needsEvidence: false, needsHistory: true };
  }
  if (lower.includes("منهج") || lower.includes("methodology") || lower.includes("طريقة") || lower.includes("أسلوب")) {
    return { type: "methodology", topicFocus: "methodology", needsSources: true, needsEvidence: false, needsHistory: true };
  }
  return { type: "general", topicFocus: "", needsSources: true, needsEvidence: false, needsHistory: true };
}

// ─── Context Retrieval (RAG-lite) ───────────────────────────────────────────

interface ProjectContext {
  projectInfo: string;
  sources: { title: string; authors: string | null; year: number | null; journal: string | null; abstract: string | null; doi: string | null }[];
  evidence: { claim: string; evidence_type: string; evidence_text: string | null; source_title: string | null }[];
  notes: { content: string }[];
  gaps: { gap_type: string; description: string }[];
  brief: { problem: string | null; question: string | null; concepts: string | null } | null;
  tasks: { title: string; status: string; priority: string; due_date: string | null }[];
}

async function fetchProjectContext(projectId: string, intent: IntentAnalysis): Promise<ProjectContext> {
  const [projectRes, sourcesRes, evidenceRes, notesRes, gapsRes, briefRes, tasksRes] = await Promise.all([
    supabase.from("research_projects").select("*").eq("id", projectId).single(),
    supabase.from("sources").select("title, authors, year, journal, abstract, doi").eq("project_id", projectId).limit(15),
    supabase.from("evidence_items").select("claim, evidence_type, evidence_text, source:sources(title)").eq("project_id", projectId).limit(15),
    supabase.from("notes").select("content").eq("project_id", projectId).limit(5),
    supabase.from("research_gaps").select("gap_type, description").eq("project_id", projectId).limit(10),
    supabase.from("research_briefs").select("content").eq("project_id", projectId).maybeSingle(),
    supabase.from("project_tasks").select("title, status, priority, due_date").eq("project_id", projectId).limit(10),
  ]);

  const project = projectRes.data;
  const projectInfo = project
    ? `مشروع البحث: ${project.title}\nالموضوع: ${project.topic || ""}\nالمجال: ${project.field || ""}\nسؤال البحث: ${project.research_question || ""}\nالكلمات المفتاحية: ${(project.keywords || []).join("، ")}`
    : "";

  // RAG: if intent needs sources, retrieve most relevant ones based on message keywords
  let sources = sourcesRes.data || [];
  if (intent.needsSources && sources.length > 5) {
    sources = sources; // Already limited to 15; could do keyword filtering here
  }

  const brief = briefRes.data?.content || null;

  return {
    projectInfo,
    sources: sources || [],
    evidence: (evidenceRes.data || []).map((e: any) => ({
      claim: e.claim,
      evidence_type: e.evidence_type,
      evidence_text: e.evidence_text,
      source_title: e.source?.title || null,
    })),
    notes: notesRes.data || [],
    gaps: gapsRes.data || [],
    brief: brief ? { problem: brief.problem || null, question: brief.question || null, concepts: brief.concepts || null } : null,
    tasks: tasksRes.data || [],
  };
}

// ─── Conversation History ──────────────────────────────────────────────────

async function fetchConversationHistory(conversationId: string | null, maxMessages: number = 10): Promise<ChatMessage[]> {
  if (!conversationId) return [];
  const { data } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(maxMessages * 2);
  return (data || []).map((m) => ({ role: m.role, content: m.content }));
}

function buildContextSummary(history: ChatMessage[]): string {
  if (history.length <= 4) return "";
  // Summarize older messages
  const older = history.slice(0, -4);
  const userMessages = older.filter((m) => m.role === "user").map((m) => m.content);
  const assistantTopics = older.filter((m) => m.role === "assistant").map((m) => m.content.substring(0, 100));
  return `ملخص المحادثة السابقة:\n- أسئلة سابقة: ${userMessages.join("؛ ")}\n- مواضيع نوقشت: ${assistantTopics.join("؛ ")}\n`;
}

// ─── Response Generation ────────────────────────────────────────────────────

const AR_TO_EN_LARGE: Record<string, string[]> = {
  "وسائل التواصل": ["Social Media Use", "Social Networking Sites", "Social Media"],
  "التواصل الاجتماعي": ["Social Media", "Social Networking", "Social Networking Sites"],
  "القلق": ["Anxiety", "Anxiety Symptoms", "Anxiety Disorders", "Trait Anxiety"],
  "الاكتئاب": ["Depression", "Depressive Symptoms", "Major Depressive Disorder"],
  "الاكتئاب": ["Depression", "Depressive Symptoms"],
  "طلاب": ["University Students", "College Students", "Students", "Undergraduate Students"],
  "طلاب الجامعة": ["University Students", "College Students", "Undergraduate Students"],
  "التعليم": ["Education", "Educational", "Learning"],
  "التعلم": ["Learning", "Academic Learning", "Learning Outcomes"],
  "الصحة النفسية": ["Mental Health", "Psychological Well-being", "Mental Wellbeing"],
  "الأداء الأكاديمي": ["Academic Performance", "Academic Achievement", "Academic Success"],
  "الضغط النفسي": ["Stress", "Perceived Stress", "Psychological Stress"],
  "النوم": ["Sleep", "Sleep Quality", "Sleep Disorders", "Insomnia"],
  "الإدمان": ["Addiction", "Substance Abuse", "Substance Use Disorder"],
  "الإجهاد": ["Burnout", "Occupational Burnout", "Job Burnout"],
  "الذكاء الاصطناعي": ["Artificial Intelligence", "AI", "Machine Learning"],
  "التكنولوجيا": ["Technology", "Digital Technology", "ICT"],
  "التحصيل الدراسي": ["Academic Achievement", "Academic Performance"],
  "التفكير الناقد": ["Critical Thinking", "Critical Thinking Skills"],
  "التعلّم الإلكتروني": ["E-Learning", "Online Learning", "Distance Learning"],
  "التعلم عن بعد": ["Distance Learning", "Online Education", "Remote Learning"],
  "الدافعية": ["Motivation", "Academic Motivation", "Intrinsic Motivation"],
  "الذاكرة": ["Memory", "Working Memory", "Cognitive Memory"],
  "القراءة": ["Reading", "Reading Comprehension", "Literacy"],
  "الكتابة": ["Writing", "Academic Writing", "Writing Skills"],
  "الإبداع": ["Creativity", "Creative Thinking", "Innovation"],
  "التغذية": ["Nutrition", "Dietary", "Nutritional Status"],
  "الرياضة": ["Exercise", "Physical Activity", "Sports"],
  "السمنة": ["Obesity", "Overweight", "Body Mass Index"],
  "الأطفال": ["Children", "Child Development", "Pediatric"],
  "المرأة": ["Women", "Female", "Gender"],
  "المنهج": ["Curriculum", "Syllabus", "Educational Program"],
  "المعلم": ["Teacher", "Educator", "Instructor"],
  "التقييم": ["Assessment", "Evaluation", "Measurement"],
  "كوفيد": ["COVID-19", "Coronavirus", "Pandemic"],
  "البيئة": ["Environment", "Environmental Factors"],
  "الأسرة": ["Family", "Family Relationships", "Parenting"],
  "العمل": ["Work", "Employment", "Job Performance"],
  "القيادة": ["Leadership", "Leadership Style", "Transformational Leadership"],
  "الإنتاجية": ["Productivity", "Work Productivity"],
  "الرضا": ["Satisfaction", "Job Satisfaction", "Life Satisfaction"],
  "التسويق": ["Marketing", "Consumer Behavior", "Marketing Strategy"],
  "الإدارة": ["Management", "Organizational Behavior", "Strategic Management"],
};

function generateTerminologyResponse(message: string): string {
  const terms: string[] = [];
  for (const [ar, en] of Object.entries(AR_TO_EN_LARGE)) {
    if (message.includes(ar)) {
      terms.push(`${ar}: ${en.join("، ")}`);
    }
  }
  if (terms.length > 0) {
    return `بناءً على سؤالك، إليك المصطلحات الإنجليزية الأكاديمية المناسبة:\n\n${terms.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nيمكنك استخدام هذه المصطلحات في البحث عبر قواعد البيانات الأكاديمية مثل OpenAlex و Semantic Scholar و PubMed.`;
  }
  return "لمتابعة مساعدتك في توليد المصطلحات الإنجليزية، يرجى تزويدي بموضوع بحثك بشكل أكثر تحديدًا.";
}

function generateGapResponse(ctx: ProjectContext): string {
  const parts: string[] = [];
  const sourceCount = ctx.sources.length;
  const evidenceCount = ctx.evidence.length;

  parts.push("بناءً على تحليل بيانات مشروعك البحثي، إليك الفجوات البحثية المحتملة (وليست مؤكدة):\n");

  if (sourceCount < 5) {
    parts.push(`1. **أدلة محدودة**: لديك ${sourceCount} مصادر فقط. هذا يشير إلى فجوة بحثية محتملة — قد تكون هناك حاجة لدراسات إضافية في هذا المجال.`);
  } else {
    parts.push(`1. **تغطية المصادر**: لديك ${sourceCount} مصادر، لكن قد تكون هناك جوانب غير مغطاة. يُنصح بمراجعة ما إذا كانت المصادر تغطي جميع جوانب سؤال البحث.`);
  }

  const opposes = ctx.evidence.filter((e) => e.evidence_type === "opposes");
  const mixed = ctx.evidence.filter((e) => e.evidence_type === "mixed");
  if (opposes.length > 0 || mixed.length > 0) {
    parts.push(`2. **نتائج متعارضة**: توجد ${opposes.length} ادعاء معارض و ${mixed.length} ادعاء مختلط. هذا يفتح فجوة لدراسة أسباب التعارض.`);
  }

  // Temporal gap
  const recentSources = ctx.sources.filter((s) => s.year && s.year >= 2020);
  if (sourceCount > 0 && recentSources.length < sourceCount * 0.3) {
    parts.push(`3. **فجوة زمنية**: نسبة كبيرة من المصادر (${sourceCount - recentSources.length} من ${sourceCount}) قديمة نسبياً. قد تكون هناك حاجة لدراسات حديثة.`);
  }

  // Check for geographic/population gaps from existing gaps
  const existingGapTypes = ctx.gaps.map((g) => g.gap_type);
  if (!existingGapTypes.includes("gapGeographic")) {
    parts.push("4. **فجوة جغرافية محتملة**: قد تكون الدراسات المتاحة أجريت في سياقات ثقافية مختلفة عن السياق العربي.");
  }
  if (!existingGapTypes.includes("gapMethodological")) {
    parts.push("5. **فجوة منهجية**: قد تكون هناك حاجة لمنهجيات أكثر صرامة أو أدوات قياس موحدة.");
  }

  // List existing gaps if any
  if (ctx.gaps.length > 0) {
    parts.push(`\n**الفجوات المحددة سابقاً في مشروعك:**`);
    ctx.gaps.forEach((g, i) => {
      parts.push(`${i + 1}. [${g.gap_type}] ${g.description}`);
    });
  }

  parts.push("\n**ملاحظة مهمة**: هذه تفسيرات محتملة وليست فجوات مؤكدة. يُنصح بالتحقق منها من خلال مراجعة المزيد من المصادر واستخدام أداة اكتشاف الفجوات للحصول على تحليل أكثر تفصيلاً.");

  return parts.join("\n");
}

function generateSummarizeResponse(ctx: ProjectContext): string {
  if (ctx.sources.length === 0) {
    return "لا توجد مصادر كافية في مشروعك لإجراء ملخص. يُنصح بالبحث وحفظ مصادر أكاديمية أولاً ثم إعادة السؤال.";
  }

  const parts: string[] = [];
  parts.push(`ملخص المصادر المتاحة في مشروعك (${ctx.sources.length} مصادر):\n`);

  ctx.sources.slice(0, 8).forEach((s, i) => {
    parts.push(`${i + 1}. **${s.title}**`);
    if (s.authors) parts.push(`   المؤلفون: ${s.authors}`);
    if (s.year) parts.push(`   السنة: ${s.year}`);
    if (s.journal) parts.push(`   المجلة: ${s.journal}`);
    if (s.abstract) {
      const abstractSnippet = s.abstract.length > 300 ? s.abstract.substring(0, 300) + "..." : s.abstract;
      parts.push(`   الملخص: ${abstractSnippet}`);
    }
    parts.push("");
  });

  if (ctx.brief) {
    parts.push(`**سؤال البحث**: ${ctx.brief.question || "غير محدد"}`);
    parts.push(`**المفاهيم**: ${ctx.brief.concepts || "غير محدد"}\n`);
  }

  // Evidence summary
  if (ctx.evidence.length > 0) {
    const supports = ctx.evidence.filter((e) => e.evidence_type === "supports");
    const opposes = ctx.evidence.filter((e) => e.evidence_type === "opposes");
    parts.push(`**الأدلة**: ${ctx.evidence.length} عنصر (${supports.length} داعم، ${opposes.length} معارض)`);
  }

  parts.push("\n**ملاحظة**: هذا ملخص مبدئي يعتمد على البيانات المتاحة. للحصول على تحليل أعمق، يُنصح بتحليل كل ورقة على حدة.");

  return parts.join("\n");
}

function generateCompareResponse(ctx: ProjectContext): string {
  if (ctx.sources.length < 2) {
    return "تحتاج إلى مصدرين على الأقل لإجراء مقارنة. يُنصح بحفظ مصادر أكاديمية أولاً ثم إعادة السؤال.";
  }

  const parts: string[] = [];
  parts.push("مقارنة أولية بين المصادر المتاحة:\n");

  // Group by evidence type
  const supports = ctx.evidence.filter((e) => e.evidence_type === "supports");
  const opposes = ctx.evidence.filter((e) => e.evidence_type === "opposes");
  const mixed = ctx.evidence.filter((e) => e.evidence_type === "mixed");

  parts.push("**نقاط الاتفاق**:");
  if (supports.length > 0) {
    supports.slice(0, 3).forEach((e, i) => {
      parts.push(`${i + 1}. ${e.claim}${e.source_title ? ` (من: ${e.source_title})` : ""}`);
    });
  } else {
    parts.push("لا توجد نقاط اتفاق واضحة في الأدلة المتاحة");
  }

  parts.push("\n**نقاط الاختلاف**:");
  if (opposes.length > 0 || mixed.length > 0) {
    [...opposes, ...mixed].slice(0, 3).forEach((e, i) => {
      parts.push(`${i + 1}. ${e.claim}${e.source_title ? ` (من: ${e.source_title})` : ""}`);
    });
  } else {
    parts.push("لا توجد نقاط اختلاف واضحة في الأدلة المتاحة");
  }

  // Methodological comparison
  parts.push("\n**ملاحظات منهجية**:");
  const years = ctx.sources.map((s) => s.year).filter(Boolean) as number[];
  if (years.length > 0) {
    parts.push(`- النطاق الزمني: ${Math.min(...years)} - ${Math.max(...years)}`);
  }
  if (ctx.sources.some((s) => s.abstract)) {
    parts.push("- توجد ملخصات لبعض المصادر يمكن تحليلها بمزيد من التفصيل");
  }
  parts.push("- يُنصح بتحليل كل دراسة على حدة لفهم الاختلافات في المنهجية والعينة والأدوات");

  parts.push("\n**ملاحظة**: هذا تحليل مبدئي يعتمد على البيانات المتاحة. للمقارنة الدقيقة، استخدم أداة تحليل الأوراق لكل دراسة.");

  return parts.join("\n");
}

function generateEvidenceResponse(message: string, ctx: ProjectContext): string {
  if (ctx.sources.length === 0) {
    return "لم يتم العثور على مصدر أكاديمي موثوق للتحقق من هذه المعلومة.\n\nيُنصح بالبحث في قواعد البيانات الأكاديمية وحفظ المصادر ذات الصلة، ثم إعادة السؤال.";
  }

  const parts: string[] = [];
  parts.push("بناءً على المصادر والأدلة المتاحة في مشروعك:\n");

  // List relevant sources
  parts.push("**المصادر ذات الصلة**:");
  ctx.sources.slice(0, 5).forEach((s, i) => {
    parts.push(`${i + 1}. ${s.title}${s.year ? ` (${s.year})` : ""}${s.journal ? ` - ${s.journal}` : ""}`);
  });

  // Check evidence
  if (ctx.evidence.length > 0) {
    const supports = ctx.evidence.filter((e) => e.evidence_type === "supports");
    const opposes = ctx.evidence.filter((e) => e.evidence_type === "opposes");

    if (supports.length > 0) {
      parts.push("\n**ادعاءات مدعومة بالأدلة**:");
      supports.slice(0, 3).forEach((e, i) => {
        parts.push(`${i + 1}. ${e.claim}`);
        if (e.source_title) parts.push(`   المصدر: ${e.source_title}`);
      });
    }

    if (opposes.length > 0) {
      parts.push("\n**ادعاءات معارضة بالأدلة**:");
      opposes.slice(0, 3).forEach((e, i) => {
        parts.push(`${i + 1}. ${e.claim}`);
        if (e.source_title) parts.push(`   المصدر: ${e.source_title}`);
      });
    }

    if (supports.length > 0 && opposes.length > 0) {
      parts.push("\n**تنبيه**: توجد أدلة متباينة — بعضها يدعم والبعض يعارض. لا تسمح المصادر المتاحة بالجزم باتجاه واضح.");
    }
  } else {
    parts.push("\nلا توجد أدلة محفوظة مرتبطة بهذه المصادر. يُنصح بإضافة ادعاءات وربطها بالمصادر لتقييم الأدلة بدقة.");
  }

  parts.push("\n**ملاحظة**: لا يمكنني تأكيد أو نفي ادعاءات بناءً على معلومات غير موثقة. هذه تحليل مبدئي يعتمد على المصادر المتاحة فقط.");

  return parts.join("\n");
}

function generateExpandResponse(message: string, ctx: ProjectContext): string {
  const parts: string[] = [];
  const topic = ctx.projectInfo || message;

  parts.push("بناءً على سؤالك وموضوع بحثك، إليك زوايا بحثية بديلة ومقترحات مترابطة:\n");

  // Extract key concepts from project context
  const projectLine = ctx.projectInfo.split("\n").find((l) => l.startsWith("الموضوع:"));
  const questionLine = ctx.projectInfo.split("\n").find((l) => l.startsWith("سؤال البحث:"));
  const keywordsLine = ctx.projectInfo.split("\n").find((l) => l.startsWith("الكلمات المفتاحية:"));

  parts.push("1. **زوايا بحثية بديلة**:");
  if (keywordsLine) {
    const keywords = keywordsLine.replace("الكلمات المفتاحية: ", "").split("، ").filter(Boolean);
    if (keywords.length >= 2) {
      parts.push(`   - العلاقة بين ${keywords[0]} و${keywords[1]} في سياقات مختلفة`);
      parts.push(`   - العوامل المعدلة للتأثير بين ${keywords[0]} و${keywords[1]}`);
      parts.push(`   - الفروق الفردية في الاستجابة لـ${keywords[0]}`);
    }
  }
  parts.push(`   - المقارنة بين فئات عمرية أو ثقافية مختلفة`);

  parts.push("\n2. **متغيرات مرتبطة**:");
  parts.push("   - المتغيرات الوسيطة (mediators) التي قد تفسر العلاقة");
  parts.push("   - المتغيرات المعدلة (moderators) التي قد تؤثر على قوة العلاقة");
  parts.push("   - المتغيرات الضابطة (control variables) التي يجب رصدها");

  parts.push("\n3. **أسئلة فرعية**:");
  if (questionLine) {
    parts.push(`   - ما الآليات الكامنة وراء ${questionLine.replace("سؤال البحث: ", "")}؟`);
    parts.push(`   - ما الظروف التي تتغير فيها العلاقة؟`);
    parts.push(`   - ما الفئات التي تتأثر بشكل أكبر؟`);
  }

  parts.push("\n4. **نظريات ومفاهيم ذات صلة**:");
  parts.push("   - النظرية المعرفية (Cognitive Theory)");
  parts.push("   - النظرية السلوكية (Behavioral Theory)");
  parts.push("   - نماذج الإجهاد والتأقلم (Stress and Coping Models)");

  parts.push("\n5. **كلمات مفتاحية إضافية للبحث**:");
  if (keywordsLine) {
    const keywords = keywordsLine.replace("الكلمات المفتاحية: ", "").split("، ").filter(Boolean);
    parts.push(`   - ${keywords.join(" + mediators")}`);
    parts.push(`   - ${keywords.join(" + moderators")}`);
    parts.push(`   - ${keywords[0] || "المتغير"} + longitudinal`);
  }

  parts.push("\n6. **أنواع دراسات مناسبة**:");
  parts.push("   - دراسة طولية (Longitudinal Study)");
  parts.push("   - دراسة تجريبية (Experimental Study)");
  parts.push("   - مراجعة منهجية (Systematic Review)");

  parts.push("\n**ملاحظة**: هذه اقتراحات مبدئية تحتاج إلى تحقق من المصادر. لكل اقتراح، يُنصح بالبحث في قواعد البيانات الأكاديمية لتقييم مدى توفر أدلة تدعمه.");

  return parts.join("\n");
}

function generateMethodologyResponse(ctx: ProjectContext): string {
  const parts: string[] = [];
  parts.push("بناءً على المصادر المتاحة في مشروعك، إليك تحليل منهجي مبدئي:\n");

  if (ctx.sources.length === 0) {
    return "لا توجد مصادر كافية لتحليل المنهجيات. يُنصح بحفظ مصادر أكاديمية أولاً.";
  }

  parts.push("**المناهج المستخدمة في المصادر المتاحة**:");
  const methodHints: string[] = [];
  ctx.sources.forEach((s) => {
    if (!s.abstract) return;
    const lower = s.abstract.toLowerCase();
    if (lower.includes("qualitative") || lower.includes("نوعي")) methodHints.push(`- ${s.title}: منهج نوعي`);
    if (lower.includes("quantitative") || lower.includes("كمي")) methodHints.push(`- ${s.title}: منهج كمي`);
    if (lower.includes("mixed") || lower.includes("مختلط")) methodHints.push(`- ${s.title}: منهج مختلط`);
    if (lower.includes("survey") || lower.includes("استبانة") || lower.includes("مسح")) methodHints.push(`- ${s.title}: دراسة مسحية`);
    if (lower.includes("experiment") || lower.includes("تجريب")) methodHints.push(`- ${s.title}: دراسة تجريبية`);
    if (lower.includes("cross-sectional") || lower.includes("مقطعي")) methodHints.push(`- ${s.title}: دراسة مقطعية`);
    if (lower.includes("longitudinal") || lower.includes("طولي")) methodHints.push(`- ${s.title}: دراسة طولية`);
  });

  if (methodHints.length > 0) {
    parts.push(...methodHints);
  } else {
    parts.push("لم يتم تحديد المناهج بوضوح من الملخصات المتاحة. يُنصح بمراجعة النصوص الكاملة.");
  }

  parts.push("\n**توصيات منهجية**:");
  parts.push("- إذا كانت الدراسات المتاحة مقطعية، يُنصح بدراسة طولية لتحديد السببية");
  parts.push("- إذا كانت الدراسات تعتمد على التقارير الذاتية، يُنصح بأدوات موضوعية إضافية");
  parts.push("- التنويع بين المناهج الكمية والنوعية قد يعطي صورة أشمل");

  parts.push("\n**ملاحظة**: هذا تحليل مبدئي من الملخصات فقط. للتحليل المنهجي الدقيق، يُنصح بمراجعة النصوص الكاملة.");

  return parts.join("\n");
}

function generateGeneralResponse(message: string, ctx: ProjectContext, history: ChatMessage[]): string {
  const parts: string[] = [];

  // Reference conversation history if available
  if (history.length > 0) {
    const lastUserMsg = history.filter((m) => m.role === "user").slice(-1)[0];
    if (lastUserMsg && lastUserMsg.content !== message) {
      parts.push(`(متابعة لسؤالك السابق: "${lastUserMsg.content.substring(0, 80)}...")\n`);
    }
  }

  parts.push(`سؤالك: "${message}"\n`);

  if (ctx.projectInfo) {
    const titleLine = ctx.projectInfo.split("\n")[0].replace("مشروع البحث: ", "");
    parts.push(`في إطار مشروعك البحثي: ${titleLine}\n`);
  }

  parts.push("يمكنني مساعدتك في:");
  parts.push("- توليد المصطلحات الإنجليزية المناسبة لبحثك");
  parts.push("- تحليل ومقارنة المصادر المتاحة");
  parts.push("- تحليل الأدلة واكتشاف الاتجاهات");
  parts.push("- تحديد الفجوات البحثية المحتملة");
  parts.push("- توسيع فكرتك البحثية بزوايا جديدة");
  parts.push("- تحليل المناهج المستخدمة في مصادرك");

  if (ctx.sources.length > 0) {
    parts.push(`\nلديك ${ctx.sources.length} مصادر محفوظة في هذا المشروع يمكنني تحليلها.`);
  } else {
    parts.push("\nلا توجد مصادر محفوظة بعد. يُنصح بالبحث وحفظ المصادر أولاً.");
  }

  if (ctx.evidence.length > 0) {
    parts.push(`لديك ${ctx.evidence.length} عنصر أدلة محفوظة.`);
  }

  return parts.join("\n");
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authUserId = await getAuthenticatedUser(req);
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, projectId, conversationId } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify project membership
    if (projectId) {
      const isMember = await verifyProjectMembership(authUserId, projectId);
      if (!isMember) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Analyze intent
    const intent = analyzeIntent(message);

    // Fetch conversation history
    const history = await fetchConversationHistory(conversationId || null, 10);

    // Fetch project context (RAG-lite: only fetch what's needed based on intent)
    let ctx: ProjectContext = {
      projectInfo: "",
      sources: [],
      evidence: [],
      notes: [],
      gaps: [],
      brief: null,
      tasks: [],
    };

    if (projectId) {
      ctx = await fetchProjectContext(projectId, intent);
    }

    // Generate response based on intent
    let response = "";

    switch (intent.type) {
      case "terminology":
        response = generateTerminologyResponse(message);
        break;
      case "gap":
        response = generateGapResponse(ctx);
        break;
      case "summarize":
        response = generateSummarizeResponse(ctx);
        break;
      case "compare":
        response = generateCompareResponse(ctx);
        break;
      case "evidence":
        response = generateEvidenceResponse(message, ctx);
        break;
      case "expand":
        response = generateExpandResponse(message, ctx);
        break;
      case "methodology":
        response = generateMethodologyResponse(ctx);
        break;
      default:
        response = generateGeneralResponse(message, ctx, history);
    }

    // Save conversation
    let convId = conversationId;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("ai_conversations")
        .insert({ user_id: authUserId, project_id: projectId || null, title: message.substring(0, 50) })
        .select("id")
        .single();
      convId = newConv?.id;
    }

    if (convId) {
      await supabase.from("ai_messages").insert([
        { user_id: authUserId, conversation_id: convId, role: "user", content: message },
        { user_id: authUserId, conversation_id: convId, role: "assistant", content: response },
      ]);
    }

    return new Response(JSON.stringify({
      response,
      conversationId: convId,
      intent: intent.type,
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
