const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AR_TO_EN_MAP: Record<string, string[]> = {
  "وسائل التواصل الاجتماعي": ["Social Media", "Social Media Use", "Social Media Usage", "Social Networking Sites"],
  "القلق": ["Anxiety", "Anxiety Symptoms", "Anxiety Disorders"],
  "الاكتئاب": ["Depression", "Depressive Symptoms", "Depression Disorders"],
  "طلاب الجامعة": ["University Students", "College Students", "Undergraduate Students"],
  "التعليم": ["Education", "Educational", "Learning"],
  "الصحة النفسية": ["Mental Health", "Psychological Well-being"],
  "النوم": ["Sleep", "Sleep Quality", "Sleep Disorders"],
  "الإدمان": ["Addiction", "Substance Abuse", "Dependency"],
  "الأداء الأكاديمي": ["Academic Performance", "Academic Achievement", "Academic Success"],
  "الذكاء الاصطناعي": ["Artificial Intelligence", "AI", "Machine Learning"],
  "البيانات": ["Data", "Big Data", "Data Analytics"],
  "التكنولوجيا": ["Technology", "Digital Technology", "ICT"],
  "المرأة": ["Women", "Female", "Gender"],
  "الأطفال": ["Children", "Pediatric", "Child Development"],
  "كوفيد": ["COVID-19", "Coronavirus", "Pandemic"],
  "التغذية": ["Nutrition", "Dietary", "Food Intake"],
  "الرياضة": ["Exercise", "Physical Activity", "Sports"],
  "السمنة": ["Obesity", "Overweight", "Body Mass Index"],
  "الضغط النفسي": ["Stress", "Psychological Stress", "Perceived Stress"],
  "الذاكرة": ["Memory", "Working Memory", "Cognitive Memory"],
  "اللغة": ["Language", "Linguistics", "Language Acquisition"],
  "القراءة": ["Reading", "Reading Comprehension", "Literacy"],
  "الكتابة": ["Writing", "Writing Skills", "Academic Writing"],
  "التفكير": ["Thinking", "Cognitive Processes", "Reasoning"],
  "الإبداع": ["Creativity", "Creative Thinking", "Innovation"],
  "الدافعية": ["Motivation", "Academic Motivation", "Intrinsic Motivation"],
  "المعلم": ["Teacher", "Educator", "Instructor"],
  "المنهج": ["Curriculum", "Syllabus", "Educational Program"],
  "التقييم": ["Assessment", "Evaluation", "Measurement"],
  "الجودة": ["Quality", "Quality Assurance", "Standards"],
};

const COMMON_SYNONYMS: Record<string, string[]> = {
  "علاقة": ["association", "relationship", "correlation", "link", "connection"],
  "تأثير": ["effect", "impact", "influence", "association"],
  "تحليل": ["analysis", "examination", "investigation", "study"],
  "دراسة": ["study", "research", "investigation", "examination"],
  "تقييم": ["assessment", "evaluation", "measurement"],
  "مقارنة": ["comparison", "comparative", "contrast"],
};

function extractConcepts(query: string): string[] {
  const stopWords = ["ما", "هل", "كيف", "لماذا", "ماذا", "بين", "على", "في", "من", "إلى", "مع", "أو", "و", "ال", "that", "the", "a", "an", "of", "between", "among", "what", "is", "are", "how", "why"];
  const words = query.split(/[\s,،؟?]+/).filter((w) => w.length > 2 && !stopWords.includes(w.toLowerCase()));
  return [...new Set(words)];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, field } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const concepts = extractConcepts(query);
    const englishTerms: string[] = [];
    const synonyms: string[] = [];
    const keywords: string[] = [...concepts];

    for (const concept of concepts) {
      const conceptKey = Object.keys(AR_TO_EN_MAP).find((k) => concept.includes(k) || k.includes(concept));
      if (conceptKey) {
        englishTerms.push(...AR_TO_EN_MAP[conceptKey]);
      }

      const synKey = Object.keys(COMMON_SYNONYMS).find((k) => concept.includes(k) || k.includes(concept));
      if (synKey) {
        synonyms.push(...COMMON_SYNONYMS[synKey]);
      }
    }

    // Generate boolean search combinations
    if (englishTerms.length > 0) {
      const mainTerms = englishTerms.slice(0, 4);
      keywords.push(`"${mainTerms[0]}" AND "${mainTerms[1] || concepts[1] || ''}"`);
    }

    // Generate potential research questions
    const researchQuestions: string[] = [];
    const mainConcept = concepts[0] || "";
    const secondConcept = concepts[1] || "";

    if (mainConcept && secondConcept) {
      researchQuestions.push(`ما العلاقة بين ${mainConcept} و${secondConcept}؟`);
      researchQuestions.push(`ما تأثير ${mainConcept} على ${secondConcept}؟`);
      researchQuestions.push(`كيف يؤثر ${mainConcept} في ${secondConcept} لدى الطلاب؟`);
      researchQuestions.push(`ما الفروق في ${secondConcept} باختلاف ${mainConcept}؟`);
    }

    // Research axes
    const axes: string[] = [];
    if (concepts.length >= 2) {
      axes.push(`البعد النظري: المفاهيم والتعريفات المرتبطة بـ${concepts.join(" و")}`);
      axes.push(`البعد التطبيقي: الدراسات الميدانية حول ${concepts.join(" و")}`);
      axes.push(`البعد المنهجي: الأدوات والأساليب المستخدمة في قياس ${concepts.join(" و")}`);
    }
    if (field) {
      axes.push(`البعد المجالي: ${field} وانعكاساته على ${concepts.join(" و")}`);
    }

    return new Response(JSON.stringify({
      concepts: [...new Set(concepts)],
      keywords: [...new Set(keywords)],
      englishTerms: [...new Set(englishTerms)],
      synonyms: [...new Set(synonyms)],
      researchQuestions,
      axes,
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
