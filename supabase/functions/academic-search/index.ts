const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NormalizedPaper {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  abstract: string | null;
  doi: string | null;
  url: string | null;
  provider: string;
  providerId: string;
  openAccess: boolean;
  citationCount: number | null;
  keywords: string[];
  relevanceScore?: number;
  relevanceLevel?: "high" | "medium" | "low";
  relevanceReason?: string;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupKey(p: NormalizedPaper): string {
  if (p.doi) return `doi:${p.doi.toLowerCase()}`;
  return `title:${normalizeTitle(p.title)}`;
}

function secondaryDedupKey(p: NormalizedPaper): string {
  const firstAuthor = (p.authors[0] || "").toLowerCase().split(" ").pop() || "";
  return `${firstAuthor}:${p.year || 0}:${normalizeTitle(p.title).slice(0, 60)}`;
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchOpenAlex(query: string, limit: number, offset: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&page=${Math.floor(offset / limit) + 1}&select=id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index,cited_by_count,keywords,open_access_oa`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "ResearchNavigator/1.0 (mailto:contact@research-navigator.app)" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((w: any): NormalizedPaper => {
      let abstract: string | null = null;
      if (w.abstract_inverted_index) {
        const positions: [string, number][] = [];
        for (const [word, idxs] of Object.entries(w.abstract_inverted_index)) {
          for (const idx of idxs as number[]) positions.push([word, idx]);
        }
        positions.sort((a, b) => a[1] - b[1]);
        abstract = positions.map((p) => p[0]).join(" ");
      }
      return {
        title: w.title || "",
        authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
        year: w.publication_year || null,
        journal: w.primary_location?.source?.display_name || null,
        abstract,
        doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
        url: w.doi || w.primary_location?.landing_page_url || null,
        provider: "OpenAlex",
        providerId: w.id || "",
        openAccess: w.open_access_oa?.is_oa || false,
        citationCount: w.cited_by_count || 0,
        keywords: (w.keywords || []).map((k: any) => k.display_name || k.keyword).filter(Boolean),
      };
    });
  } catch {
    return [];
  }
}

async function searchCrossref(query: string, limit: number, offset: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&offset=${offset}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "ResearchNavigator/1.0 (mailto:contact@research-navigator.app)" } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message.items || []).map((w: any): NormalizedPaper => ({
      title: w.title?.[0] || "",
      authors: (w.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean),
      year: w.published?.["date-parts"]?.[0]?.[0] || null,
      journal: w["container-title"]?.[0] || null,
      abstract: w.abstract ? w.abstract.replace(/<[^>]+>/g, "") : null,
      doi: w.DOI || null,
      url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : null),
      provider: "Crossref",
      providerId: w.DOI || "",
      openAccess: !!w.license,
      citationCount: w["is-referenced-by-count"] || null,
      keywords: [],
    }));
  } catch {
    return [];
  }
}

async function searchSemanticScholar(query: string, limit: number, offset: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&fields=title,authors,year,venue,abstract,externalIds,isOpenAccess,citationCount,openAccessPdf`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((w: any): NormalizedPaper => ({
      title: w.title || "",
      authors: (w.authors || []).map((a: any) => a.name).filter(Boolean),
      year: w.year || null,
      journal: w.venue || null,
      abstract: w.abstract || null,
      doi: w.externalIds?.DOI || null,
      url: w.openAccessPdf?.url || (w.externalIds?.DOI ? `https://doi.org/${w.externalIds.DOI}` : null),
      provider: "Semantic Scholar",
      providerId: w.paperId || "",
      openAccess: w.isOpenAccess || false,
      citationCount: w.citationCount || 0,
      keywords: [],
    }));
  } catch {
    return [];
  }
}

async function searchPubMed(query: string, limit: number, offset: number): Promise<NormalizedPaper[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retstart=${offset}&retmode=json`;
    const searchRes = await fetchWithTimeout(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    // Use efetch to get abstracts
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const fetchRes = await fetchWithTimeout(fetchUrl);
    if (!fetchRes.ok) {
      // Fallback to esummary without abstracts
      return await searchPubMedSummary(ids);
    }
    const xmlText = await fetchRes.text();
    return parsePubMedXml(xmlText, ids);
  } catch {
    return [];
  }
}

async function searchPubMedSummary(ids: string[]): Promise<NormalizedPaper[]> {
  try {
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const summaryRes = await fetchWithTimeout(summaryUrl);
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    return ids.map((id: string): NormalizedPaper | null => {
      const w = summaryData.result?.[id];
      if (!w) return null;
      return {
        title: w.title || "",
        authors: (w.authors || []).map((a: any) => a.name).filter(Boolean),
        year: w.pubdate ? parseInt(w.pubdate.match(/\d{4}/)?.[0] || "0") || null : null,
        journal: w.fulljournalname || w.source || null,
        abstract: null,
        doi: w.elocationid?.startsWith("doi:") ? w.elocationid.slice(4) : null,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        provider: "PubMed",
        providerId: id,
        openAccess: false,
        citationCount: null,
        keywords: [],
      };
    }).filter(Boolean) as NormalizedPaper[];
  } catch {
    return [];
  }
}

function parsePubMedXml(xml: string, ids: string[]): NormalizedPaper[] {
  const results: NormalizedPaper[] = [];
  for (const id of ids) {
    const articleRegex = new RegExp(`<PubmedArticle>\\s*<MedlineCitation>\\s*<PMID[^>]*>${id}</PMID>([\\s\\S]*?)</MedlineCitation>`, "i");
    const match = xml.match(articleRegex);
    if (!match) continue;
    const block = match[1];

    const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

    const abstractParts = [...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi)];
    const abstract = abstractParts.length > 0
      ? abstractParts.map((m) => m[1].replace(/<[^>]+>/g, "").trim()).join(" ")
      : null;

    const authorMatches = [...block.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/gi)];
    const authors = authorMatches.map((m) => {
      const lastName = m[1].match(/<LastName>([\s\S]*?)<\/LastName>/i)?.[1] || "";
      const firstName = m[1].match(/<ForeName>([\s\S]*?)<\/ForeName>/i)?.[1] || "";
      return `${firstName} ${lastName}`.trim();
    }).filter(Boolean);

    const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/i);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/i);
    const journal = journalMatch ? journalMatch[1].trim() : null;

    const doiMatch = block.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/i);
    const doi = doiMatch ? doiMatch[1] : null;

    results.push({
      title,
      authors,
      year,
      journal,
      abstract: abstract && abstract.length > 20 ? abstract : null,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      provider: "PubMed",
      providerId: id,
      openAccess: false,
      citationCount: null,
      keywords: [],
    });
  }
  return results;
}

async function searchCORE(query: string, limit: number, offset: number): Promise<NormalizedPaper[]> {
  try {
    const apiKey = Deno.env.get("CORE_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const body = JSON.stringify({
      q: query,
      page_size: limit,
      page: Math.floor(offset / limit) + 1,
    });

    const res = await fetchWithTimeout("https://api.core.ac.uk/v3/search/works", {
      method: "POST",
      headers,
      body,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((w: any): NormalizedPaper => ({
      title: w.title || "",
      authors: (w.authors || []).map((a: any) => typeof a === "string" ? a : a.name).filter(Boolean),
      year: w.year_published || w.published_date ? parseInt(String(w.year_published || w.published_date).match(/\d{4}/)?.[0] || "0") || null : null,
      journal: w.publisher || null,
      abstract: w.abstract || null,
      doi: w.doi || null,
      url: w.download_url || w.source_fulltext_urls?.[0] || (w.doi ? `https://doi.org/${w.doi}` : null),
      provider: "CORE",
      providerId: String(w.id || ""),
      openAccess: !!w.download_url || w.open_access_status === "open",
      citationCount: null,
      keywords: w.keywords || [],
    }));
  } catch {
    return [];
  }
}

// ─── Ranking ────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function computeRelevance(paper: NormalizedPaper, query: string): { score: number; level: "high" | "medium" | "low"; reason: string } {
  const queryTokens = new Set(tokenize(query));
  const titleTokens = new Set(tokenize(paper.title));
  const abstractTokens = paper.abstract ? new Set(tokenize(paper.abstract)) : new Set<string>();
  const keywordTokens = new Set((paper.keywords || []).map((k) => k.toLowerCase()));

  // Title overlap (weighted highest)
  let titleMatches = 0;
  for (const t of queryTokens) {
    if (titleTokens.has(t)) titleMatches++;
  }
  const titleOverlap = queryTokens.size > 0 ? titleMatches / queryTokens.size : 0;

  // Abstract overlap
  let abstractMatches = 0;
  for (const t of queryTokens) {
    if (abstractTokens.has(t)) abstractMatches++;
  }
  const abstractOverlap = queryTokens.size > 0 && abstractTokens.size > 0
    ? abstractMatches / queryTokens.size
    : 0;

  // Keyword overlap
  let keywordMatches = 0;
  for (const t of queryTokens) {
    if (keywordTokens.has(t)) keywordMatches++;
  }
  const keywordOverlap = queryTokens.size > 0 ? keywordMatches / queryTokens.size : 0;

  // Recency boost (newer papers get slight boost, up to 10%)
  const currentYear = new Date().getFullYear();
  const recencyBoost = paper.year ? Math.max(0, (paper.year - currentYear + 10) / 100) : 0;

  // Citation boost (normalized, up to 15%)
  const citationBoost = paper.citationCount ? Math.min(0.15, Math.log10(paper.citationCount + 1) / 100) : 0;

  // Composite score
  const score = (titleOverlap * 0.45 + abstractOverlap * 0.30 + keywordOverlap * 0.10 + recencyBoost + citationBoost);

  // Reason string
  const reasons: string[] = [];
  if (titleOverlap > 0.5) reasons.push("تطابق قوي في العنوان");
  else if (titleOverlap > 0.2) reasons.push("تطابق جزئي في العنوان");
  if (abstractOverlap > 0.4) reasons.push("صلة عالية في الملخص");
  else if (abstractOverlap > 0.2) reasons.push("صلة في الملخص");
  if (keywordOverlap > 0.3) reasons.push("تطابق في الكلمات المفتاحية");

  const reason = reasons.length > 0 ? reasons.join("، ") : "صلة مبدئية بناءً على البيانات المتاحة";

  let level: "high" | "medium" | "low";
  if (score >= 0.45) level = "high";
  else if (score >= 0.20) level = "medium";
  else level = "low";

  return { score, level, reason };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, limit = 20, offset = 0, providers, expandedQueries } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedProviders = providers || ["openalex", "crossref", "semantic_scholar", "pubmed", "core"];
    const maxPerProvider = Math.ceil(limit * 1.8);

    const providerMap: Record<string, (q: string, l: number, o: number) => Promise<NormalizedPaper[]>> = {
      openalex: searchOpenAlex,
      crossref: searchCrossref,
      semantic_scholar: searchSemanticScholar,
      pubmed: searchPubMed,
      core: searchCORE,
    };

    const activeProviders = requestedProviders.filter((p: string) => providerMap[p]);

    // Search with original query + expanded queries if provided
    const allQueries = expandedQueries && Array.isArray(expandedQueries) && expandedQueries.length > 0
      ? [query, ...expandedQueries.slice(0, 3)]
      : [query];

    const searchPromises: Promise<NormalizedPaper[]>[] = [];
    for (const q of allQueries) {
      for (const p of activeProviders) {
        searchPromises.push(
          providerMap[p](q, maxPerProvider, offset).catch(() => [])
        );
      }
    }

    const results = await Promise.allSettled(searchPromises);

    const failedProviders: string[] = [];
    const allPapers: NormalizedPaper[] = [];

    // Track which providers returned empty for all queries
    const providerResults: Record<string, boolean> = {};
    let resultIdx = 0;
    for (const q of allQueries) {
      for (const p of activeProviders) {
        const result = results[resultIdx++];
        if (result.status === "fulfilled" && result.value.length > 0) {
          allPapers.push(...result.value);
          providerResults[p] = true;
        } else if (result.status === "rejected") {
          if (!providerResults[p]) providerResults[p] = false;
        }
      }
    }

    for (const p of activeProviders) {
      if (providerResults[p] === false) failedProviders.push(p);
    }

    // Deduplicate
    const dedupMap = new Map<string, NormalizedPaper & { providers: string[]; providerIds: { provider: string; id: string }[] }>();
    const secondaryMap = new Map<string, string>(); // secondary key -> primary dedup key

    for (const paper of allPapers) {
      const key = dedupKey(paper);
      if (!key) continue;

      const secKey = secondaryDedupKey(paper);
      const existingPrimary = secondaryMap.get(secKey);

      // If we have a DOI-based key and a title-based match exists, merge
      if (existingPrimary && existingPrimary !== key) {
        const existing = dedupMap.get(existingPrimary);
        if (existing) {
          if (!existing.providers.includes(paper.provider)) {
            existing.providers.push(paper.provider);
            existing.providerIds.push({ provider: paper.provider, id: paper.providerId });
          }
          if (!existing.abstract && paper.abstract) existing.abstract = paper.abstract;
          if (!existing.doi && paper.doi) existing.doi = paper.doi;
          if (existing.citationCount === null && paper.citationCount !== null) existing.citationCount = paper.citationCount;
          if (!existing.openAccess && paper.openAccess) existing.openAccess = paper.openAccess;
          if (existing.keywords.length === 0 && paper.keywords.length > 0) existing.keywords = paper.keywords;
          if (!existing.url && paper.url) existing.url = paper.url;
          continue;
        }
      }

      const existing = dedupMap.get(key);
      if (existing) {
        if (!existing.providers.includes(paper.provider)) {
          existing.providers.push(paper.provider);
          existing.providerIds.push({ provider: paper.provider, id: paper.providerId });
        }
        if (!existing.abstract && paper.abstract) existing.abstract = paper.abstract;
        if (!existing.doi && paper.doi) existing.doi = paper.doi;
        if (existing.citationCount === null && paper.citationCount !== null) existing.citationCount = paper.citationCount;
        if (!existing.openAccess && paper.openAccess) existing.openAccess = paper.openAccess;
        if (existing.keywords.length === 0 && paper.keywords.length > 0) existing.keywords = paper.keywords;
        if (!existing.url && paper.url) existing.url = paper.url;
      } else {
        dedupMap.set(key, {
          ...paper,
          providers: [paper.provider],
          providerIds: [{ provider: paper.provider, id: paper.providerId }],
        });
        secondaryMap.set(secKey, key);
      }
    }

    const deduplicated = Array.from(dedupMap.values());

    // Compute relevance scores
    for (const paper of deduplicated) {
      const rel = computeRelevance(paper, query);
      paper.relevanceScore = rel.score;
      paper.relevanceLevel = rel.level;
      paper.relevanceReason = rel.reason;
    }

    // Sort by relevance score (composite)
    deduplicated.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    const finalResults = deduplicated.slice(offset, offset + limit);

    return new Response(JSON.stringify({
      results: finalResults,
      totalFound: deduplicated.length,
      providersQueried: activeProviders,
      providersFailed: failedProviders,
      partialFailure: failedProviders.length > 0 && failedProviders.length < activeProviders.length,
      hasMore: deduplicated.length > offset + limit,
      offset,
      limit,
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
