import { randomUUID } from 'node:crypto';

// L3: correlation id. Echo a sane client X-Request-ID, otherwise mint one;
// expose it as req.id for the error middleware's logs and always answer with
// the header so clients can quote it in bug reports. The length/charset guard
// is a trust boundary: the client value flows into a response header.
const SAFE_ID = /^[\w.-]{1,128}$/;

export default function requestId(req, res, next) {
  const provided = req.headers['x-request-id'];
  req.id = typeof provided === 'string' && SAFE_ID.test(provided) ? provided : randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}
