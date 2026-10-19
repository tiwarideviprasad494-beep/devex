const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const QUOTES_PATH = path.join(DATA_DIR, 'quotes.json');
const shipments = {
  'NSF-2026-001': { status: 'In transit', location: 'Rotterdam, NL · departed port', eta: '2026-09-20' },
  'NSF-2026-002': { status: 'Customs clearance', location: 'Singapore · import processing', eta: '2026-09-18' },
  'NSF-2026-003': { status: 'Delivered', location: 'Chicago, US · proof of delivery available', eta: null }
};

function getTransporter() {
  if (!process.env.SMTP_PASS) {
    return null;
  }
  const smtpUser = process.env.SMTP_USER || 'info@devexss.com';
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: smtpUser,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendQuoteNotification(entry) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[QUOTE RECEIVED] Saved to quotes.json: ${entry.id}. (To enable instant email alerts to owner, set the Google Workspace SMTP_PASS app-password in Render (SMTP_USER defaults to info@devexss.com)).`);
    return;
  }

  const recipient = process.env.NOTIFICATION_EMAIL || 'info@devexss.com';
  const htmlContent = `
    <h2>New Quote Request Received: ${entry.id}</h2>
    <p><b>Received At:</b> ${new Date(entry.createdAt).toLocaleString()}</p>
    <hr>
    <h3>Customer Details</h3>
    <ul>
      <li><b>Name:</b> ${entry.name}</li>
      <li><b>Company:</b> ${entry.company || 'N/A'}</li>
      <li><b>Phone:</b> ${entry.phone}</li>
      <li><b>Email:</b> ${entry.email || 'N/A'}</li>
    </ul>
    <h3>Shipment Details</h3>
    <ul>
      <li><b>Trade Type:</b> ${entry.tradeType}</li>
      <li><b>Freight Mode:</b> ${entry.freightMode}</li>
      <li><b>Origin:</b> ${entry.origin}</li>
      <li><b>Destination:</b> ${entry.destination}</li>
      <li><b>Cargo Type:</b> ${entry.cargoType}</li>
      <li><b>Approx. Weight/Volume:</b> ${entry.measurement || 'N/A'}</li>
      <li><b>Ready Date:</b> ${entry.readyDate || 'N/A'}</li>
    </ul>
    <h3>Message</h3>
    <p>${entry.message || 'No additional message.'}</p>
  `;

  await transporter.sendMail({
    from: `"Devex Shipping Site" <${process.env.SMTP_USER || 'info@devexss.com'}>`,
    to: recipient,
    subject: `[New Quote Request ${entry.id}] ${entry.name} - ${entry.tradeType} (${entry.origin} -> ${entry.destination})`,
    html: htmlContent
  });
  console.log(`[QUOTE NOTIFICATION] Email sent successfully to ${recipient} for quote ${entry.id}`);
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
