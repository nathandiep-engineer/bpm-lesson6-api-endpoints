# HW6 - API endpoints

Two edge functions against the `clra-homework` database from HW5.

## Run

```
npx supabase start
npx supabase functions serve --env-file supabase/functions/.env --no-verify-jwt
```

`supabase/functions/.env` needs `DB_URL` and `DB_ANON_KEY` (see `.env.example`).

## Part 1 - reading the examples

### A. `PATCH /interviews/:id`

1. PATCH only. OPTIONS is answered for CORS, everything else gets 405.
2. `id` as a query param (`?id=...`, the title says `/:id` but the code reads `searchParams`), and a json body with `status`.
3. 200 with `{ "success": true }`. The updated row is not returned.
4. No `id` -> 400 "Missing id". A body without `status` is not checked - `update({ status: undefined })` sends an empty update, which postgrest rejects, so that surfaces as 500 not 400. A non-json body makes `req.json()` throw, also 500.

### B. `GET /research-questions/:id`

1. GET only, 405 otherwise.
2. `id` as a query param. No body.
3. 200 with the research question and its interview questions nested: `{ id, content, interview_questions: [{ id, content }] }`.
4. No `id` -> 400 "Missing id". An id that does not exist never reaches the 404 branch: `.single()` errors on zero rows, so it comes back as 500. The `if (!data)` check is dead code.

## Part 2 - `PATCH /interviews/:id`

Design is in the doc block at the top of `supabase/functions/interviews/index.ts`.

```
curl -X PATCH http://127.0.0.1:54321/functions/v1/interviews/<id> \
  -H 'content-type: application/json' \
  -d '{"status":"completed"}'
```

## Part 3 - `GET /research-plans/:id`

Design is in the doc block at the top of `supabase/functions/research-plans/index.ts`.

```
curl http://127.0.0.1:54321/functions/v1/research-plans/<id>
```

## Questions for mentors

- Example A passes an unhandled Postgres error straight to the client as `error.message`. Is that ever fine in a real product, or is logging server-side + a generic client message the actual practice - where's the line?

> Thường thì không nên trả `error.message` thẳng ra client á em, vì Postgres error hay leak thông tin schema/constraint name, khá nhạy cảm. Best practice: log full error kèm request id ở server, trả generic message + error code cho client. Trả raw message chỉ ok khi là internal tool, không có end-user thật.

- Our `GET /research-plans/:id` returns interviews and nested research questions in one response. At what size or nesting depth does CLRA split that into paginated requests, and who decides - frontend or backend first?

> Ở CLRA thật thì không có use case giả định này nha Long, mà kể cả có thì chưa cần paginate cho tới khi 1 plan có kiểu vài chục interviews hoặc payload lên tới vài trăm KB. Best practice thì nên làm ở BE nhen em, nhưng mà khi lượng data chưa quá nhiều thì có thể để cho FE làm, tối ưu trải nghiệm người dùng, load từng trang nhanh hơn

- Homework skipped auth, but marking an interview completed should really only be allowed by that plan's owner. Is that an RLS policy checking `auth.uid()`, or an explicit ownership check inside the edge function - or both?

> Cả hai á em, nhưng RLS là lớp bắt buộc - policy check `auth.uid() = research_plans.owner_id` qua join, để lỡ code trong edge function có bug thì DB vẫn chặn được. Check trong edge function chỉ để trả 403 sớm với message rõ ràng hơn, không thay được RLS.

- If the same PATCH request gets sent twice (double click, or a retried request on a flaky connection), does this need to be idempotent, and how does CLRA actually handle that?

> PATCH set `status='completed'` tự nó đã idempotent về data rồi (chạy 2 lần vẫn ra cùng state cuối), nên không cần thêm gì. Cái cần lo hơn là double side-effect (ví dụ sau này thêm gửi email khi complete) thì lúc đó mới cần idempotency key hoặc check status hiện tại trước khi trigger side effect.
