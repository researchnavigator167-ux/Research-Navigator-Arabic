const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisResult {
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
  evidenceLevel: "full_text" | "abstract_only";
  evidenceLevelText: string;
}

function extractSentence(text: string, keywords: string[], maxLen = 400): string | null {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  for (const sentence of sentences) {
    if (keywords.some((k) => sentence.toLowerCase().includes(k.toLowerCase()))) {
      return sentence.length > maxLen ? sentence.substring(0, maxLen) + "..." : sentence;
    }
  }
  return null;
}

function extractMultipleSentences(text: string, keywords: string[], maxSentences = 3): string | null {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  const matched: string[] = [];
  for (const sentence of sentences) {
    if (keywords.some((k) => sentence.toLowerCase().includes(k.toLowerCase()))) {
      matched.push(sentence);
      if (matched.length >= maxSentences) break;
    }
  }
  return matched.length > 0 ? matched.join(". ") : null;
}

function detectMethodology(abstract: string, title: string): string {
  const text = `${title} ${abstract}`.toLowerCase();
  const methods: string[] = [];

  const methodPatterns: Record<string, string[]> = {
    "تجريبي (Experimental)": ["experiment", "experimental", "randomized", "control group", "تجريب", "تجريبي", "عشوائي", "مجموعة ضابطة"],
    "وصفي (Descriptive)": ["descriptive", "describe", "وصفي", "وصف"],
    "مسحي (Survey)": ["survey", "questionnaire", "استبانة", "استبيان", "مسح"],
    "مقطعي (Cross-sectional)": ["cross-sectional", "cross sectional", "مقطعي"],
    "طولي (Longitudinal)": ["longitudinal", "panel", "cohort", "طولي", "تتبعي"],
    "نوعي (Qualitative)": ["qualitative", "interview", "focus group", "thematic analysis", "نوعي", "مقابلة", "مجموعة بؤرية"],
    "كمي (Quantitative)": ["quantitative", "statistical analysis", "كمي", "تحليل إحصائي"],
    "مختلط (Mixed Methods)": ["mixed method", "mixed-method", "مختلط", "منهج مختلط"],
    "مراجعة منهجية (Systematic Review)": ["systematic review", "meta-analysis", "مراجعة منهجية", "تحليل تلوي"],
    "دراسة حالة (Case Study)": ["case study", "case-study", "دراسة حالة"],
    "ارتباطي (Correlational)": ["correlation", "correlational", "association", "ارتباط", "علاقة ارتباطية"],
  };

  for (const [method, patterns] of Object.entries(methodPatterns)) {
    if (patterns.some((p) => text.includes(p))) {
      methods.push(method);
    }
  }

  return methods.length > 0 ? methods.join("، ") : "لم يتم تحديد المنهج بوضوح من الملخص المتاح";
}

function detectSample(abstract: string): string {
  const patterns: RegExp[] = [
    /n\s*=\s*(\d+)/i,
    /(\d{2,6})\s*(?:participants|subjects|patients|students|individuals|respondents)/i,
    /sample\s*(?:of|size)?\s*(?:was|of|comprised|consisted)?\s*(\d{2,6})/i,
    /(\d{2,6})\s*(?:مشارك|مبحوث|طالب|أفراد|عينة)/,
    /عينة\s*(?:من|تتكون من|قوامها)?\s*(\d{2,6})/,
  ];

  for (const pattern of patterns) {
    const match = abstract.match(pattern);
    if (match) {
      return `تم تحديد حجم العينة: ${match[1] || match[0]}`;
    }
  }

  const sampleKeywords = ["sample", "participants", "subjects", "patients", "students", "عينة", "مشاركين", "مبحوثين", "طلاب"];
  const found = extractSentence(abstract, sampleKeywords);
  return found || "لم يتم تحديد العينة بوضوح من الملخص المتاح";
}

function detectVariables(abstract: string, title: string): string {
  const text = `${title}. ${abstract}`;
  const variables: string[] = [];

  const ivKeywords = ["independent variable", "predictor", "manipulated", "متغير مستقل", "متغير تنبؤي", "العامل المستقل"];
  const dvKeywords = ["dependent variable", "outcome", "criterion", "متغير تابع", "النتيجة", "المتغير المعتمد"];
  const mediatorKeywords = ["mediator", "mediating", "وسيط", "متغير وسيط"];
  const moderatorKeywords = ["moderator", "moderating", "معدل", "متغير معدل"];

  const iv = extractSentence(text, ivKeywords);
  const dv = extractSentence(text, dvKeywords);
  const med = extractSentence(text, mediatorKeywords);
  const mod = extractSentence(text, moderatorKeywords);

  if (iv) variables.push(`المتغير المستقل: ${iv}`);
  if (dv) variables.push(`المتغير التابع: ${dv}`);
  if (med) variables.push(`متغير وسيط: ${med}`);
  if (mod) variables.push(`متغير معدل: ${mod}`);

  return variables.length > 0 ? variables.join("\n") : "لم يتم تحديد المتغيرات بوضوح. يُنصح بمراجعة النص الكامل";
}

function detectResults(abstract: string): string {
  const keywords = [
    "result", "finding", "showed", "found", "demonstrated", "significant", "p<", "p =", "p=", "effect",
    "نتيجة", "نتائج", "أظهرت", "وجدت", "تبين", "دلالة", "معنوي", "فرق دال",
  ];
  const found = extractMultipleSentences(abstract, keywords, 3);
  if (found) return found;

  // Try to find statistical significance mentions
  const statsMatch = abstract.match(/(?:p\s*[<=>]\s*0?\.\d+|p\s*<\s*0\.0\d+|significantly|دالة إحصائيا)/i);
  if (statsMatch) {
    const sentence = extractSentence(abstract, [statsMatch[0]]);
    return sentence || `تم العثور على إشارة لدلالة إحصائية: ${statsMatch[0]}`;
  }

  return "لم يتم العثور على نتائج واضحة في الملخص المتاح";
}

function detectLimitations(abstract: string): string {
  const keywords = [
    "limitation", "however", "but", "constraint", "small sample", "cross-sectional", "self-report", "self-report",
    "قيد", "قيود", "لكن", "محذور", "عيب", "تقرير ذاتي",
  ];
  const found = extractMultipleSentences(abstract, keywords, 2);
  return found || "لم يتم ذكر القيود في الملخص. قد تكون موجودة في النص الكامل";
}

function extractRelation(abstract: string, title: string, topic: string): string {
  const titleLower = title.toLowerCase();
  const abstractLower = (abstract || "").toLowerCase();
  const topicLower = topic.toLowerCase();
  const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);

  const titleMatches = topicWords.filter((w) => titleLower.includes(w));
  const abstractMatches = topicWords.filter((w) => abstractLower.includes(w));

  if (titleMatches.length >= 2) {
    return `هذه الدراسة لها صلة قوية بموضوع بحثك. تتطابق الكلمات التالية في العنوان: ${titleMatches.join("، ")}. يُنصح بمراجعة الملخص والنص الكامل لتقييم مدى الصلة بدقة.`;
  } else if (titleMatches.length > 0 || abstractMatches.length >= 2) {
    const allMatches = [...new Set([...titleMatches, ...abstractMatches])];
    return `هذه الدراسة لها صلة متوسطة بموضوع بحثك. تتطابق الكلمات: ${allMatches.join("، ")}. يُنصح بمراجعة النص الكامل لتأكيد الصلة.`;
  } else if (abstractMatches.length > 0) {
    return `هذه الدراسة لها صلة محدودة بموضوع بحثك. توجد بعض الكلمات المتطابقة في الملخص: ${abstractMatches.join("، ")}. قد لا تكون ذات صلة مباشرة.`;
  }

  return `لا تتوفر معلومات كافية لتحديد العلاقة الدقيقة بين هذه الدراسة وموضوع بحثك. يُنصح بمراجعة النص الكامل.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { title, abstract, authors, year, journal, researchTopic } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasAbstract = abstract && abstract.length > 50;
    const evidenceLevel: "full_text" | "abstract_only" = hasAbstract ? "abstract_only" : "abstract_only";

    const analysis: AnalysisResult = {
      objective: hasAbstract
        ? (() => {
            const enKw = ["aim", "objective", "purpose", "goal", "this study", "this research", "we examine", "we investigate", "investigate", "explore"];
            const arKw = ["هدف", "تهدف", "يهدف", "الغرض", "هدفت", "نهدف", "استهدف"];
            return extractSentence(abstract, [...enKw, ...arKw]) || `بناءً على عنوان الدراسة، يبدو أن الهدف مرتبط بمجال: ${title.substring(0, 200)}`;
          })()
        : "غير متوفر - لا يوجد ملخص كافٍ للتحليل",

      researchQuestion: hasAbstract
        ? (() => {
            const kw = ["question", "whether", "how does", "what is", "what are", "investigate", "examine", "test"];
            const arKw = ["سؤال", "ما العلاقة", "ما تأثير", "هل", "كيف", "فحص", "اختبار"];
            return extractSentence(abstract, [...kw, ...arKw]) || "لم يتم العثور على سؤال بحثي صريح في الملخص المتاح";
          })()
        : "غير متوفر",

      hypotheses: hasAbstract
        ? (() => {
            const kw = ["hypothesis", "hypotheses", "expect", "predict", "assume", "propose"];
            const arKw = ["فرضية", "فرضيات", "نفترض", "توقع", "نطرح"];
            return extractSentence(abstract, [...kw, ...arKw]) || "لم يتم العثور على فرضيات صريحة في الملخص المتاح";
          })()
        : "غير متوفر",

      methodology: hasAbstract
        ? detectMethodology(abstract, title)
        : "غير متوفر",

      sample: hasAbstract
        ? detectSample(abstract)
        : "غير متوفر",

      instruments: hasAbstract
        ? (() => {
            const kw = ["questionnaire", "scale", "instrument", "measure", "tool", "test", "survey", "interview", "inventory", "checklist"];
            const arKw = ["استبانة", "مقياس", "أداة", "أدوات", "اختبار", "مقابلة", "قائمة"];
            return extractSentence(abstract, [...kw, ...arKw]) || "لم يتم تحديد الأدوات بوضوح من الملخص المتاح";
          })()
        : "غير متوفر",

      variables: hasAbstract
        ? detectVariables(abstract, title)
        : "غير متوفر",

      results: hasAbstract
        ? detectResults(abstract)
        : "غير متوفر",

      limitations: hasAbstract
        ? detectLimitations(abstract)
        : "غير متوفر",

      recommendations: hasAbstract
        ? (() => {
            const kw = ["recommend", "suggest", "should", "future research", "implication"];
            const arKw = ["توصية", "توصيات", "نوصي", "نقترح", "بحوث مستقبلية", "تطبيقات"];
            return extractSentence(abstract, [...kw, ...arKw]) || "لم يتم العثور على توصيات صريحة في الملخص. يُنصح بمراجعة النص الكامل";
          })()
        : "غير متوفر",

      relationToUserTopic: researchTopic
        ? extractRelation(abstract || "", title, researchTopic)
        : "لم يتم تحديد موضوع بحثك",

      evidenceLevel,
      evidenceLevelText: hasAbstract
        ? "تم التحليل من الملخص والبيانات المتاحة فقط"
        : "تم التحليل من البيانات المتاحة فقط - يُنصح بالاطلاع على النص الكامل",
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
