import { corsHeaders } from '../_shared/cors.ts'
import { supabase } from '../_shared/db.ts'
import { json, text, idFromPath } from '../_shared/http.ts'

/**
 * Part 3 - open a research plan, see its interviews and the research questions
 *
 * method + path: GET /research-plans/:id
 *
 * request expects: id in the path, nothing else. No body on a GET.
 *
 * fetch + response shape:
 *   One query. research_questions hang off the plan in the schema, not off each
 *   interview, so they come back once at plan level. Copying the same questions
 *   into every interview object would be the same data N times.
 *
 *   {
 *     id, name, description,
 *     interviews: [ { id, interviewee_name, scheduled_at, status } ],
 *     research_questions: [
 *       { id, content, interview_questions: [ { id, content } ] }
 *     ]
 *   }
 *
 * [TBR] design này đúng bài học lesson 5 đó em - research_questions thuộc về research_plan chứ
 * không lồng theo từng interview, mấy bạn khác hay nhầm chỗ này lắm. Giữ nguyên vậy là chuẩn.
 *
 * failures:
 *   405 wrong method
 *   400 missing id
 *   404 no plan with that id
 *   500 database error
 */

// same deal as interviews/index.ts: runs on request, nothing to keep alive
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return text('Method not allowed', 405)
  }

  const id = idFromPath(req, 'research-plans')
  if (!id) {
    return text('Missing id', 400)
  }

  const { data, error } = await supabase
    .from('research_plans')
    .select(`
      id,
      name,
      description,
      interviews (
        id,
        interviewee_name,
        scheduled_at,
        status
      ),
      research_questions (
        id,
        content,
        interview_questions (
          id,
          content
        )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return text(error.message, 500)
  }

  if (!data) {
    return text('Research plan not found', 404)
  }

  return json(data)
})
