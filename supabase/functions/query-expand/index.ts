const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const AR_TO_EN_MAP: Record<string, string[]> = {
  "وسائل التواصل الاجتماعي": ["Social Media", "Social Media Use", "Social Media Usage", "Social Networking Sites", "Social Networking"],
  "وسائل التواصل": ["Social Media", "Social Networking Sites"],
  "التواصل الاجتماعي": ["Social Media", "Social Networking"],
  "القلق": ["Anxiety", "Anxiety Symptoms", "Anxiety Disorders", "Trait Anxiety", "State Anxiety"],
  "الاكتئاب": ["Depression", "Depressive Symptoms", "Depression Disorders", "Major Depressive Disorder"],
  "طلاب الجامعة": ["University Students", "College Students", "Undergraduate Students", "Graduate Students"],
  "طلاب": ["Students", "University Students", "College Students"],
  "التعليم": ["Education", "Educational", "Learning", "Academic Learning"],
  "التعلم": ["Learning", "Academic Learning", "Learning Outcomes"],
  "الصحة النفسية": ["Mental Health", "Psychological Well-being", "Mental Wellbeing"],
  "النوم": ["Sleep", "Sleep Quality", "Sleep Disorders", "Sleep Patterns", "Insomnia"],
  "الإدمان": ["Addiction", "Substance Abuse", "Dependency", "Substance Use Disorder"],
  "الأداء الأكاديمي": ["Academic Performance", "Academic Achievement", "Academic Success", "Academic Outcomes"],
  "الذكاء الاصطناعي": ["Artificial Intelligence", "AI", "Machine Learning", "Deep Learning", "Neural Networks"],
  "البيانات": ["Data", "Big Data", "Data Analytics", "Data Mining"],
  "التكنولوجيا": ["Technology", "Digital Technology", "ICT", "Information Technology"],
  "المرأة": ["Women", "Female", "Gender", "Gender Differences"],
  "الأطفال": ["Children", "Pediatric", "Child Development", "Child Psychology"],
  "كوفيد": ["COVID-19", "Coronavirus", "Pandemic", "SARS-CoV-2"],
  "التغذية": ["Nutrition", "Dietary", "Food Intake", "Nutritional Status"],
  "الرياضة": ["Exercise", "Physical Activity", "Sports", "Physical Fitness"],
  "السمنة": ["Obesity", "Overweight", "Body Mass Index", "Adiposity"],
  "الضغط النفسي": ["Stress", "Psychological Stress", "Perceived Stress", "Occupational Stress"],
  "الذاكرة": ["Memory", "Working Memory", "Cognitive Memory", "Memory Consolidation"],
  "اللغة": ["Language", "Linguistics", "Language Acquisition", "Language Processing"],
  "القراءة": ["Reading", "Reading Comprehension", "Literacy", "Reading Skills"],
  "الكتابة": ["Writing", "Writing Skills", "Academic Writing", "Written Expression"],
  "التفكير": ["Thinking", "Cognitive Processes", "Reasoning", "Critical Thinking"],
  "الإبداع": ["Creativity", "Creative Thinking", "Innovation", "Divergent Thinking"],
  "الدافعية": ["Motivation", "Academic Motivation", "Intrinsic Motivation", "Extrinsic Motivation"],
  "المعلم": ["Teacher", "Educator", "Instructor", "Teaching Quality"],
  "المنهج": ["Curriculum", "Syllabus", "Educational Program", "Curriculum Design"],
  "التقييم": ["Assessment", "Evaluation", "Measurement", "Educational Assessment"],
  "الجودة": ["Quality", "Quality Assurance", "Standards", "Quality Management"],
  "الإجهاد": ["Burnout", "Burnout Syndrome", "Occupational Burnout", "Job Burnout"],
  "الرضا": ["Satisfaction", "Job Satisfaction", "Life Satisfaction"],
  "الأسرة": ["Family", "Family Relationships", "Parenting", "Family Functioning"],
  "العمل": ["Work", "Employment", "Job Performance", "Workplace"],
  "الإنتاجية": ["Productivity", "Work Productivity", "Academic Productivity"],
  "التحصيل الدراسي": ["Academic Achievement", "Academic Performance", "Student Achievement"],
  "التفكير الناقد": ["Critical Thinking", "Critical Thinking Skills", "Higher-Order Thinking"],
  "التعلّم الإلكتروني": ["E-Learning", "Online Learning", "Distance Learning", "Electronic Learning"],
  "التعلم عن بعد": ["Distance Learning", "Online Education", "Remote Learning", "Distance Education"],
  "المنصات الرقمية": ["Digital Platforms", "Online Platforms", "Educational Technology"],
  "الألعاب الإلكترونية": ["Video Games", "Gaming", "Online Gaming", "Digital Games"],
  "الإساءة": ["Abuse", "Substance Abuse", "Domestic Violence", "Maltreatment"],
  "العنف": ["Violence", "Aggression", "Violent Behavior"],
  "الصحة العامة": ["Public Health", "Community Health", "Population Health"],
  "التدخين": ["Smoking", "Tobacco Use", "Cigarette Smoking", "Nicotine Dependence"],
  "الكحول": ["Alcohol", "Alcohol Consumption", "Alcohol Use Disorder", "Binge Drinking"],
  "العمر": ["Age", "Aging", "Age Differences", "Developmental Age"],
  "الجنسية": ["Nationality", "Citizenship", "Cultural Identity"],
  "الثقافة": ["Culture", "Cultural Differences", "Cross-Cultural", "Cultural Identity"],
  "الدين": ["Religion", "Religiosity", "Religious Beliefs", "Spirituality"],
  "الزواج": ["Marriage", "Marital Satisfaction", "Marital Quality"],
  "الطلاق": ["Divorce", "Marital Separation", "Family Dissolution"],
  "القيادة": ["Leadership", "Leadership Style", "Transformational Leadership"],
  "المؤسسات": ["Institutions", "Organizations", "Institutional"],
  "الاقتصاد": ["Economics", "Economic Impact", "Financial Factors"],
  "الفقر": ["Poverty", "Socioeconomic Status", "Economic Deprivation"],
  "البطالة": ["Unemployment", "Job Loss", "Employment Status"],
  "الهجرة": ["Migration", "Immigration", "Refugees", "Displacement"],
  "البيئة": ["Environment", "Environmental Factors", "Ecological"],
  "التلوث": ["Pollution", "Air Pollution", "Environmental Pollution"],
  "الطاقة": ["Energy", "Renewable Energy", "Energy Consumption"],
  "الماء": ["Water", "Water Quality", "Water Resources"],
  "الزراعة": ["Agriculture", "Farming", "Agricultural Practices"],
  "الصناعة": ["Industry", "Manufacturing", "Industrial Production"],
  "السياحة": ["Tourism", "Tourism Industry", "Tourist Behavior"],
  "التسويق": ["Marketing", "Marketing Strategy", "Consumer Behavior"],
  "الإدارة": ["Management", "Strategic Management", "Organizational Behavior"],
  "المحاسبة": ["Accounting", "Financial Accounting", "Auditing"],
  "التمويل": ["Finance", "Financial Management", "Corporate Finance"],
  "الاستثمار": ["Investment", "Foreign Direct Investment", "Portfolio Investment"],
  "التضخم": ["Inflation", "Consumer Price Index", "Economic Inflation"],
  "النمو الاقتصادي": ["Economic Growth", "GDP Growth", "Economic Development"],
};

const COMMON_SYNONYMS: Record<string, string[]> = {
  "علاقة": ["association", "relationship", "correlation", "link", "connection"],
  "تأثير": ["effect", "impact", "influence", "association"],
  "أثر": ["effect", "impact", "influence"],
  "تحليل": ["analysis", "examination", "investigation", "study"],
  "دراسة": ["study", "research", "investigation", "examination"],
  "تقييم": ["assessment", "evaluation", "measurement"],
  "مقارنة": ["comparison", "comparative", "contrast"],
  "علاقة بين": ["relationship between", "association between", "correlation between"],
  "تأثير على": ["effect on", "impact on", "influence on"],
  "دور": ["role", "function", "contribution"],
  "عوامل": ["factors", "determinants", "predictors"],
  "أنواع": ["types", "categories", "classifications"],
  "مستوى": ["level", "degree", "extent"],
  "نوعية": ["quality", "standard", "caliber"],
  "فاعلية": ["effectiveness", "efficacy", "efficiency"],
  "محددات": ["determinants", "predictors", "factors"],
  "مظاهر": ["manifestations", "symptoms", "signs"],
  "أسباب": ["causes", "reasons", "factors"],
  "نتائج": ["results", "outcomes", "findings"],
  "استراتيجيات": ["strategies", "approaches", "methods", "tactics"],
  "برامج": ["programs", "interventions", "schemes"],
  "أنشطة": ["activities", "practices", "tasks"],
  "اتجاهات": ["trends", "attitudes", "orientations"],
  "ممارسات": ["practices", "behaviors", "practices"],
  "معتقدات": ["beliefs", "attitudes", "perceptions"],
  "قيم": ["values", "principles", "standards"],
  "أخلاق": ["ethics", "morality", "ethical behavior"],
  "معرفة": ["knowledge", "understanding", "awareness"],
  "مهارات": ["skills", "competencies", "abilities"],
  "اتصال": ["communication", "interaction", "dialogue"],
};

function extractConcepts(query: string): string[] {
  const stopWords = new Set([
    "ما", "هل", "كيف", "لماذا", "ماذا", "بين", "على", "في", "من", "إلى", "مع", "أو", "و",
    "ال", "أن", "إن", "قد", "كان", "هو", "هي", "هم", "هناك", "هذا", "هذه", "ذلك", "تلك",
    "that", "the", "a", "an", "of", "between", "among", "what", "is", "are", "how", "why",
    "effect", "impact", "relationship", "between", "on", "and", "in", "of", "the", "to",
    "study", "studies", "research", "analysis",
  ]);
  const words = query.split(/[\s,،؟?.;:]+/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
  return [...new Set(words)];
}

function generateSearchQueries(concepts: string[], englishTerms: string[], synonyms: string[]): string[] {
  const queries: string[] = [];

  // Query 1: Main English terms combined
  if (englishTerms.length >= 2) {
    queries.push(`${englishTerms[0]} AND ${englishTerms[1]}`);
  } else if (englishTerms.length === 1) {
    queries.push(englishTerms[0]);
  }

  // Query 2: English terms with synonyms
  if (englishTerms.length >= 1 && synonyms.length > 0) {
    const mainEng = englishTerms[0].split(" ")[0];
    queries.push(`${mainEng} AND ${synonyms[0]}`);
  }

  // Query 3: Broader English combination
  if (englishTerms.length >= 3) {
    queries.push(`${englishTerms[0]} OR ${englishTerms[2]}`);
  }

  // Query 4: Alternative English terms
  if (englishTerms.length >= 4) {
    queries.push(`${englishTerms[1]} AND ${englishTerms[3]}`);
  }

  return [...new Set(queries)].slice(0, 4);
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
      for (const [key, values] of Object.entries(AR_TO_EN_MAP)) {
        if (concept.includes(key) || key.includes(concept)) {
          englishTerms.push(...values);
          break;
        }
      }
      for (const [key, values] of Object.entries(COMMON_SYNONYMS)) {
        if (concept.includes(key) || key.includes(concept)) {
          synonyms.push(...values);
          break;
        }
      }
    }

    // Generate search queries for multi-query search
    const searchQueries = generateSearchQueries(concepts, englishTerms, synonyms);

    // Generate potential research questions
    const researchQuestions: string[] = [];
    const mainConcept = concepts[0] || "";
    const secondConcept = concepts[1] || "";

    if (mainConcept && secondConcept) {
      researchQuestions.push(`ما العلاقة بين ${mainConcept} و${secondConcept}؟`);
      researchQuestions.push(`ما تأثير ${mainConcept} على ${secondConcept}؟`);
      researchQuestions.push(`كيف يؤثر ${mainConcept} في ${secondConcept} لدى الطلاب؟`);
      researchQuestions.push(`ما الفروق في ${secondConcept} باختلاف ${mainConcept}؟`);
      researchQuestions.push(`ما العوامل المحددة للعلاقة بين ${mainConcept} و${secondConcept}؟`);
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
      searchQueries,
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
