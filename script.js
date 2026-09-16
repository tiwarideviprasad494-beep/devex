const trackingForm = document.querySelector('#tracking-form');
const trackingResult = document.querySelector('#tracking-result');
trackingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const reference = document.querySelector('#tracking-number').value.trim().toUpperCase();
  trackingResult.textContent = 'Looking up your shipment…';
  trackingResult.classList.add('visible');
  fetch(`/api/track/${encodeURIComponent(reference)}`)
    .then((response) => response.json())
    .then((shipment) => {
      trackingResult.textContent = shipment.found
        ? `${shipment.reference} · ${shipment.status} — ${shipment.location}`
        : `${reference} · No shipment found. Please check the reference and try again.`;
    })
    .catch(() => { trackingResult.textContent = 'Tracking is temporarily unavailable. Please try again shortly.'; });
});

document.querySelector('#quote-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#quote-message');
  const data = Object.fromEntries(new FormData(form));
  message.textContent = 'Sending your request…';
  fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .then((response) => response.json())
    .then((result) => {
      if (!result.ok) throw new Error('invalid quote');
      message.textContent = `Request ${result.reference} received. Our freight desk will contact you within one business day.`;
      form.reset();
    })
    .catch(() => { message.textContent = 'We could not send your request. Please email hello@devexlogistics.example.'; });
});

document.querySelector('.menu-toggle').addEventListener('click', () => {
  const nav = document.querySelector('nav');
  nav.style.display = nav.style.display === 'flex' ? '' : 'flex';
  nav.style.position = 'absolute'; nav.style.top = '68px'; nav.style.left = '0'; nav.style.right = '0';
  nav.style.padding = '20px'; nav.style.background = '#f5f3ed'; nav.style.flexDirection = 'column';
});
