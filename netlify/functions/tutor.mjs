// Hosted tutor on Netlify: POST /api/tutor, the same service the local tutor
// server uses (server/tutorService.mjs). The keys come from the site's
// environment variables (ANTHROPIC_API_KEY, or TUTOR_PROVIDER=gemini with
// GEMINI_API_KEY), never from the repo. The rate limit is per instance, so it
// is looser than on the local server.
import { MAX_BODY_BYTES } from '../../server/tutorCore.mjs'
import { createTutorService, log } from '../../server/tutorService.mjs'

// A warm instance keeps the service and its rate limiter between requests.
const tutor = createTutorService(process.env)
const ready = tutor.setUp({ label: 'Hosted tutor', check: false })

export const config = { path: '/api/tutor', method: 'POST' }

const json = (status, body) => Response.json(body, { status })

export default async function handler(request, context) {
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
  const key = (context && context.ip) || (request.headers.get('x-nf-client-connection-ip') || '')
  const reply = await tutor.answer(body, key)
  return json(reply.status, reply.body)
}
