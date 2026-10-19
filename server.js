const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const QUOTES_PATH = path.join(DATA_DIR, 'quotes.json');
const shipments = {
  'NSF-2026-001': { status: 'In transit', location: 'Rotterdam, NL · departed port', eta: '2026-09-20' },
  'NSF-2026-002': { status: 'Customs clearance', location: 'Singapore · import processing', eta: '2026-09-18' },
  'NSF-2026-003': { status: 'Delivered', location: 'Chicago, US · proof of delivery available', eta: null }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

async function sendQuoteNotification(entry) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[QUOTE RECEIVED] Saved to quotes.json: ${entry.id}. Set RESEND_API_KEY in Render to send email notifications.`);
    return;
  }

  const recipient = process.env.NOTIFICATION_EMAIL || 'info@devexss.com';
  const sender = process.env.EMAIL_FROM || 'Devex Shipping Site <info@devexss.com>';
  const subject = `[New Quote Request ${entry.id}] ${String(entry.name).replace(/[\r\n]+/g, ' ')} - ${String(entry.tradeType).replace(/[\r\n]+/g, ' ')}`;
  const htmlContent = `
    <h2>New Quote Request Received: ${escapeHtml(entry.id)}</h2>
    <p><b>Received At:</b> ${escapeHtml(new Date(entry.createdAt).toLocaleString())}</p>
    <hr>
    <h3>Customer Details</h3>
    <ul>
      <li><b>Name:</b> ${escapeHtml(entry.name)}</li>
      <li><b>Company:</b> ${escapeHtml(entry.company || 'N/A')}</li>
      <li><b>Phone:</b> ${escapeHtml(entry.phone)}</li>
      <li><b>Email:</b> ${escapeHtml(entry.email || 'N/A')}</li>
    </ul>
    <h3>Shipment Details</h3>
    <ul>
      <li><b>Trade Type:</b> ${escapeHtml(entry.tradeType)}</li>
      <li><b>Freight Mode:</b> ${escapeHtml(entry.freightMode)}</li>
      <li><b>Origin:</b> ${escapeHtml(entry.origin)}</li>
      <li><b>Destination:</b> ${escapeHtml(entry.destination)}</li>
      <li><b>Cargo Type:</b> ${escapeHtml(entry.cargoType)}</li>
      <li><b>Approx. Weight/Volume:</b> ${escapeHtml(entry.measurement || 'N/A')}</li>
      <li><b>Ready Date:</b> ${escapeHtml(entry.readyDate || 'N/A')}</li>
    </ul>
    <h3>Message</h3>
    <p>${escapeHtml(entry.message || 'No additional message.')}</p>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject,
      html: htmlContent,
      reply_to: entry.email || undefined
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend API ${response.status}: ${result.message || result.name || 'email request failed'}`);
  }
  console.log(`[QUOTE NOTIFICATION] Resend accepted email ${result.id || ''} for ${recipient}`);
}
function send(res, code, payload, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
  res.end(type === 'application/json' ? JSON.stringify(payload) : payload);
}
function getBody(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 20_000) reject(new Error('Payload too large')); }); req.on('end', () => resolve(body)); req.on('error', reject); }); }
function serveFile(res, filename, type) { fs.readFile(path.join(ROOT, filename), (err, file) => err ? send(res, 404, 'Not found', 'text/plain') : send(res, 200, file, type)); }

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, service: 'devex-shipping-solutions' });
  if (req.method === 'GET' && url.pathname === '/') return serveFile(res, 'index.html', 'text/html');
  if (req.method === 'GET' && url.pathname === '/styles.css') return serveFile(res, 'styles.css', 'text/css');
  if (req.method === 'GET' && url.pathname === '/script.js') return serveFile(res, 'script.js', 'application/javascript');
  if (req.method === 'GET' && url.pathname === '/devex_logo.png') return serveFile(res, 'devex_logo.png', 'image/png');
  if (req.method === 'GET' && url.pathname.startsWith('/images/')) return serveFile(res, url.pathname.slice(1), url.pathname.endsWith('.png') ? 'image/png' : 'image/jpeg');
  if (req.method === 'GET' && url.pathname.startsWith('/api/track/')) {
    const reference = decodeURIComponent(url.pathname.split('/').pop()).toUpperCase();
    const shipment = shipments[reference];
    return send(res, 200, shipment ? { found: true, reference, ...shipment } : { found: false, reference });
  }
  if (req.method === 'POST' && url.pathname === '/api/quotes') {
    try {
      const quote = JSON.parse(await getBody(req));
      const required = ['name', 'phone', 'tradeType', 'origin', 'destination', 'cargoType', 'freightMode'];
      if (required.some(key => !String(quote[key] || '').trim()) || quote.consent !== true) return send(res, 400, { ok: false, error: 'Please complete the required shipment details and consent checkbox.' });
      const phone = String(quote.phone || '').trim();
      const phoneDigits = phone.replace(/\D/g, '').length;
      if (!/^\+?[0-9().\s-]+$/.test(phone) || phoneDigits < 7 || phoneDigits > 15) return send(res, 400, { ok: false, error: 'Please enter a valid phone number using digits and standard phone formatting only.' });
      if (quote.email && !/^\S+@\S+\.\S+$/.test(String(quote.email))) return send(res, 400, { ok: false, error: 'Please enter a valid email address.' });
      const fields = [...required, 'company', 'email', 'measurement', 'readyDate', 'message'];
      const entry = { id: `Q-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, createdAt: new Date().toISOString(), consent: true, ...Object.fromEntries(fields.map(key => [key, String(quote[key] || '').trim()])) };
      fs.mkdirSync(path.dirname(QUOTES_PATH), { recursive: true });
      const existing = fs.existsSync(QUOTES_PATH) ? JSON.parse(fs.readFileSync(QUOTES_PATH, 'utf8')) : [];
      existing.push(entry); fs.writeFileSync(QUOTES_PATH, JSON.stringify(existing, null, 2));

      sendQuoteNotification(entry).catch(err => console.error('[QUOTE EMAIL ERROR]', err));

      return send(res, 201, { ok: true, reference: entry.id });
    } catch { return send(res, 400, { ok: false, error: 'Invalid request.' }); }
  }
  send(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`Devex Shipping Solutions is running at http://localhost:${PORT}`));
