import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ").replace(/\s+/g, " ").trim();
}

function dedupKey(p: NormalizedPaper): string {
  if (p.doi) return `doi:${p.doi.toLowerCase()}`;
  return `title:${normalizeTitle(p.title)}`;
}

async function searchOpenAlex(query: string, limit: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&select=id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index,cited_by_count,keywords,open_access_oa`;
    const res = await fetch(url, { headers: { "User-Agent": "ResearchNavigator/1.0 (mailto:contact@research-navigator.app)" } });
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

async function searchCrossref(query: string, limit: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}`;
    const res = await fetch(url, { headers: { "User-Agent": "ResearchNavigator/1.0 (mailto:contact@research-navigator.app)" } });
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

async function searchSemanticScholar(query: string, limit: number): Promise<NormalizedPaper[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,venue,abstract,externalIds,isOpenAccess,citationCount,openAccessPdf`;
    const res = await fetch(url);
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

async function searchPubMed(query: string, limit: number): Promise<NormalizedPaper[]> {
  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    const result = ids.map((id: string): NormalizedPaper => {
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
      } as NormalizedPaper;
    }).filter(Boolean) as NormalizedPaper[];

    return result;
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, limit = 10, providers } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedProviders = providers || ["openalex", "crossref", "semantic_scholar", "pubmed"];
    const maxPerProvider = Math.ceil(limit * 1.5);

    const providerMap: Record<string, (q: string, l: number) => Promise<NormalizedPaper[]>> = {
      openalex: searchOpenAlex,
      crossref: searchCrossref,
      semantic_scholar: searchSemanticScholar,
      pubmed: searchPubMed,
    };

    const activeProviders = requestedProviders.filter((p: string) => providerMap[p]);
    const results = await Promise.allSettled(
      activeProviders.map((p: string) => providerMap[p](query, maxPerProvider))
    );

    const failedProviders: string[] = [];
    const allPapers: NormalizedPaper[] = [];

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        allPapers.push(...result.value);
      } else {
        failedProviders.push(activeProviders[i]);
      }
    });

    // Deduplicate
    const dedupMap = new Map<string, NormalizedPaper & { providers: string[]; providerIds: { provider: string; id: string }[] }>();

    for (const paper of allPapers) {
      const key = dedupKey(paper);
      if (!key) continue;
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
      } else {
        dedupMap.set(key, {
          ...paper,
          providers: [paper.provider],
          providerIds: [{ provider: paper.provider, id: paper.providerId }],
        });
      }
    }

    const deduplicated = Array.from(dedupMap.values());

    // Rank: citation count (normalized) + title relevance
    const maxCitations = Math.max(...deduplicated.map((p) => p.citationCount || 0), 1);
    const queryLower = query.toLowerCase();
    deduplicated.sort((a, b) => {
      const aTitleMatch = a.title.toLowerCase().includes(queryLower) ? 1 : 0;
      const bTitleMatch = b.title.toLowerCase().includes(queryLower) ? 1 : 0;
      if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;
      const aCitations = (a.citationCount || 0) / maxCitations;
      const bCitations = (b.citationCount || 0) / maxCitations;
      return bCitations - aCitations;
    });

    const finalResults = deduplicated.slice(0, limit);

    return new Response(JSON.stringify({
      results: finalResults,
      totalFound: deduplicated.length,
      providersQueried: activeProviders,
      providersFailed: failedProviders,
      partialFailure: failedProviders.length > 0 && failedProviders.length < activeProviders.length,
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
