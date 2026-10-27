// Hosted tutor: POST /api/tutor on Vercel, the same service the local tutor
// server uses (server/tutorService.mjs). The keys come from the project's
// environment variables (ANTHROPIC_API_KEY, or TUTOR_PROVIDER=gemini with
// GEMINI_API_KEY), never from the repo. The rate limit is per instance, so it
// is looser than on the local server.
import { MAX_BODY_BYTES } from '../server/tutorCore.mjs'
import { createTutorService, log } from '../server/tutorService.mjs'

// A warm instance keeps the service and its rate limiter between requests.
const tutor = createTutorService(process.env)
const ready = tutor.setUp({ label: 'Hosted tutor', check: false })

// Long enough for a slow reply with tools; the chat waits for it.
export const maxDuration = 60

const json = (status, body) => Response.json(body, { status })

export async function POST(request) {
  await ready
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    log(413)
    return json(413, { error: 'too_large' })
  }
  let body
  try {
    body = JSON.parse(text)
  } catch {
    log(400)
    return json(400, { error: 'bad_request' })
  }
  const key = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  const reply = await tutor.answer(body, key)
  return json(reply.status, reply.body)
}
