import { corsHeaders } from '../_shared/cors.ts'
import { supabase } from '../_shared/db.ts'
import { json, text, idFromPath } from '../_shared/http.ts'

/**
 * Part 2 - mark an interview as completed from the Interview List page
 *
 * method + path: PATCH /interviews/:id
 *   id in the path, not a query string. It identifies the resource, it is not a filter.
 *
 * request body: { "status": "completed" }
 *   Sending status instead of a hard-coded /complete route means the same endpoint
 *   handles cancelled later without another function.
 *
 * server steps:
 *   1. reject anything that is not PATCH (405)
 *   2. read id from the path, reject if missing (400)
 *   3. parse the body, reject if it is not json or status is not one of the allowed values (400)
 *   4. update interviews set status where id = :id, ask for the row back
 *   5. no row came back -> that id does not exist (404)
 *   6. return the updated row (200)
 *
 * success: 200 { id, interviewee_name, status, ... }
 *   The list page can swap the row in place without refetching.
 *
 * failures:
 *   405 wrong method
 *   400 missing id / bad json / status not allowed
 *   404 no interview with that id
 *   500 database error, message passed through
 */

const ALLOWED_STATUS = ['planned', 'completed', 'cancelled']

// edge function = just this handler, no server of our own. Supabase spins it up
// per request, on a node close to the caller, and tears it down after. One
// function per endpoint (or a few related ones), which is why the url is
// /functions/v1/interviews and the method decides what happens.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'PATCH') {
    return text('Method not allowed', 405)
  }

  const id = idFromPath(req, 'interviews')
  if (!id) {
    return text('Missing id', 400)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return text('Body must be json', 400)
  }

  // nếu client gửi body là "null" (vẫn valid json, req.json() không throw), thì body.status
  // ở dòng dưới sẽ throw TypeError chứ không rơi vào catch ở trên. Deno.serve tự bắt và trả 500,
  // không phải 400 như doc comment ghi. Check thêm `!body || typeof body !== 'object'` trước khi
  // đọc body.status nha em.
  if (!ALLOWED_STATUS.includes(body.status)) {
    return text(`status must be one of ${ALLOWED_STATUS.join(', ')}`, 400)
  }

  const { data, error } = await supabase
    .from('interviews')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    return text(error.message, 500)
  }

  if (!data) {
    return text('Interview not found', 404)
  }

  return json(data)
})
