// Vercel serverless function — proxies an external image to avoid CORS issues.
// GET /api/image?url=<encoded-image-url>
//
// Only allows image/* content types through. Returns the raw image bytes
// with permissive CORS headers so the browser can create a File from it.

const ALLOWED_HOSTS = ['picsum.photos', 'fastly.picsum.photos', 'i.picsum.photos'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return res.status(403).json({ error: 'Host not allowed' });
  }

  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { Accept: 'image/*' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream error' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Not an image' });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return res.status(413).json({ error: 'Image too large' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch image' });
  }
}
