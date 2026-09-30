const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const evidenceLevel = hasAbstract ? "abstract_only" : "abstract_only";

    // Structured extraction from available metadata
    const analysis: Record<string, string> = {
      objective: hasAbstract
        ? extractObjective(abstract)
        : "غير متوفر - لا يوجد ملخص كافٍ للتحليل",
      researchQuestion: hasAbstract
        ? extractResearchQuestion(abstract)
        : "غير متوفر",
      hypotheses: hasAbstract
        ? extractHypotheses(abstract)
        : "غير متوفر",
      methodology: hasAbstract
        ? extractMethodology(abstract)
        : "غير متوفر",
      sample: hasAbstract
        ? extractSample(abstract)
        : "غير متوفر",
      instruments: hasAbstract
        ? extractInstruments(abstract)
        : "غير متوفر",
      variables: hasAbstract
        ? extractVariables(abstract, title)
        : "غير متوفر",
      results: hasAbstract
        ? extractResults(abstract)
        : "غير متوفر",
      limitations: hasAbstract
        ? extractLimitations(abstract)
        : "غير متوفر",
      recommendations: hasAbstract
        ? "يُنصح بمراجعة النص الكامل للحصول على التوصيات التفصيلية"
        : "غير متوفر",
      relationToUserTopic: researchTopic
        ? extractRelation(abstract, title, researchTopic)
        : "لم يتم تحديد موضوع بحثك",
    };

    return new Response(JSON.stringify({
      ...analysis,
      evidenceLevel,
      evidenceLevelText: hasAbstract
        ? "تم التحليل من الملخص والبيانات المتاحة فقط"
        : "تم التحليل من البيانات المتاحة فقط - يُنصح بالاطلاع على النص الكامل",
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

function extractSentence(text: string, keywords: string[]): string | null {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  for (const sentence of sentences) {
    if (keywords.some((k) => sentence.toLowerCase().includes(k.toLowerCase()))) {
      return sentence.trim();
    }
  }
  return null;
}

function extractObjective(abstract: string): string {
  const enKeywords = ["aim", "objective", "purpose", "goal", "this study", "this research", "we examine", "we investigate"];
  const arKeywords = ["هدف", "تهدف", "يهدف", "الغرض", "هدفت", "نهدف"];
  const found = extractSentence(abstract, [...enKeywords, ...arKeywords]);
  return found || `بناءً على عنوان الدراسة، يبدو أن الهدف مرتبط بـ: ${abstract.substring(0, 150)}...`;
}

function extractResearchQuestion(abstract: string): string {
  const qKeywords = ["question", "whether", "how does", "what is", "what are", "investigate", "examine"];
  const arQKeywords = ["سؤال", "ما العلاقة", "ما تأثير", "هل", "كيف"];
  const found = extractSentence(abstract, [...qKeywords, ...arQKeywords]);
  return found || "لم يتم العثور على سؤال بحثي صريح في الملخص المتاح";
}

function extractHypotheses(abstract: string): string {
  const hKeywords = ["hypothesis", "hypotheses", "expect", "predict", "assume"];
  const arHKeywords = ["فرضية", "فرضيات", "نفترض", "توقع"];
  const found = extractSentence(abstract, [...hKeywords, ...arHKeywords]);
  return found || "لم يتم العثور على فرضيات صريحة في الملخص المتاح";
}

function extractMethodology(abstract: string): string {
  const mKeywords = ["method", "methodology", "approach", "design", "qualitative", "quantitative", "mixed", "survey", "experiment", "cross-sectional", "longitudinal", "randomized", "control"];
  const arMKeywords = ["منهج", "أسلوب", "طريقة", "تصميم", "وصفي", "تجريبي", "مقارنة", "مسح"];
  const found = extractSentence(abstract, [...mKeywords, ...arMKeywords]);
  return found || "لم يتم تحديد المنهج بوضوح من الملخص المتاح";
}

function extractSample(abstract: string): string {
  const sKeywords = ["sample", "participants", "subjects", "patients", "students", "n=", "respondents"];
  const arSKeywords = ["عينة", "مشاركين", "مبحوثين", "طلاب", "أفراد"];
  const found = extractSentence(abstract, [...sKeywords, ...arSKeywords]);
  return found || "لم يتم تحديد العينة بوضوح من الملخص المتاح";
}

function extractInstruments(abstract: string): string {
  const iKeywords = ["questionnaire", "scale", "instrument", "measure", "tool", "test", "survey", "interview"];
  const arIKeywords = ["استبانة", "مقياس", "أداة", "أدوات", "اختبار", "مقابلة"];
  const found = extractSentence(abstract, [...iKeywords, ...arIKeywords]);
  return found || "لم يتم تحديد الأدوات بوضوح من الملخص المتاح";
}

function extractVariables(abstract: string, title: string): string {
  const text = `${title}. ${abstract}`;
  const vKeywords = ["variable", "independent", "dependent", "factor", "predictor", "outcome"];
  const arVKeywords = ["متغير", "متغيرات", "عامل", "عوامل"];
  const found = extractSentence(text, [...vKeywords, ...arVKeywords]);
  return found || "لم يتم تحديد المتغيرات بوضوح. يُنصح بمراجعة النص الكامل";
}

function extractResults(abstract: string): string {
  const rKeywords = ["result", "finding", "showed", "found", "demonstrated", "significant", "p<", "p =", "effect"];
  const arRKeywords = ["نتيجة", "نتائج", "أظهرت", "وجدت", "تبين", "دلالة", "معنوي"];
  const found = extractSentence(abstract, [...rKeywords, ...arRKeywords]);
  return found || "لم يتم العثور على نتائج واضحة في الملخص المتاح";
}

function extractLimitations(abstract: string): string {
  const lKeywords = ["limitation", "however", "but", "constraint", "small sample", "cross-sectional"];
  const arLKeywords = ["قيد", "قيود", "لكن", "محذور", "عيب"];
  const found = extractSentence(abstract, [...lKeywords, ...arLKeywords]);
  return found || "لم يتم ذكر القيود في الملخص. قد تكون موجودة في النص الكامل";
}

function extractRelation(abstract: string, title: string, topic: string): string {
  const titleLower = title.toLowerCase();
  const topicLower = topic.toLowerCase();
  const words = topicLower.split(/\s+/).filter((w) => w.length > 3);
  const matches = words.filter((w) => titleLower.includes(w));
  if (matches.length > 0) {
    return `هذه الدراسة لها صلة بموضوع بحثك من حيث: ${matches.join("، ")}. يُنصح بمراجعة الملخص والنص الكامل لتقييم مدى الصلة بدقة.`;
  }
  return `لا تتوفر معلومات كافية لتحديد العلاقة الدقيقة بين هذه الدراسة وموضوع بحثك. يُنصح بمراجعة النص الكامل.`;
}
