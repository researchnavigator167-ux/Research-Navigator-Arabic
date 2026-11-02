import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Unauthorized" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return response({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const [projectFiles, submissionFiles] = await Promise.all([
      supabase.from("project_files").select("file_path").eq("uploaded_by", userId),
      supabase.from("assignment_submissions").select("file_path").eq("student_id", userId),
    ]);

    if (projectFiles.error || submissionFiles.error) return response({ error: "Account cleanup failed" }, 500);

    const paths = [...(projectFiles.data || []), ...(submissionFiles.data || [])]
      .map((row) => row.file_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);
    const uniquePaths = [...new Set(paths)];

    if (uniquePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from("project-files").remove(uniquePaths);
      if (storageError) return response({ error: "Account cleanup failed" }, 500);
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) return response({ error: "Account deletion failed" }, 500);

    return response({ success: true });
  } catch {
    return response({ error: "Account deletion failed" }, 500);
  }
});
