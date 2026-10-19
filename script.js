const menu = document.querySelector('.menu'); const nav = document.querySelector('nav');
menu.addEventListener('click', () => { const open = menu.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? '×' : '☰'; });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.classList.remove('open'); menu.setAttribute('aria-expanded','false'); menu.textContent='☰'; }));

const phoneInput = document.querySelector('#quote-form [name="phone"]');
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/[^0-9+().\s-]/g, '');
});
document.querySelector('#quote-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector('#quote-message');
  const data = Object.fromEntries(new FormData(form));
  data.consent = form.elements.consent.checked;
  message.textContent = 'Sending your enquiry…';
  try {
    const response = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    message.textContent = `Thank you. Your enquiry ${result.reference} has been received. Our team will contact you shortly.`;
    form.reset();
  } catch (error) {
    message.textContent = error.message || 'We could not send your enquiry. Please try submitting the form again.';
  }
});

// --- Interactive Background Images Controller ---
const serviceGrid = document.querySelector('.service-grid');
const modeBtns = document.querySelectorAll('.interactive-toolbar .mode-btn');
const serviceCards = document.querySelectorAll('.service-card');

// Mode Switcher
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    if (serviceGrid) serviceGrid.dataset.gridMode = mode;
  });
});

// Card Mouse Move & Interactive Parallax + Spotlight + Magnifier
serviceCards.forEach(card => {
  const bg = card.querySelector('.service-bg');
  const lens = card.querySelector('.magnifier-lens');

  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const xOffset = (x - 0.5) * 2;
    const yOffset = (y - 0.5) * 2;

    // Set CSS Variables for spotlight layer
    card.style.setProperty('--mouse-x', `${x * 100}%`);
    card.style.setProperty('--mouse-y', `${y * 100}%`);

    const currentMode = serviceGrid ? serviceGrid.dataset.gridMode : 'spotlight';

    if (currentMode === 'magnifier' && lens) {
      const lensX = e.clientX - rect.left - 60;
      const lensY = e.clientY - rect.top - 60;
      lens.style.left = `${lensX}px`;
      lens.style.top = `${lensY}px`;
      lens.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
    }

    if (bg) {
      const tiltX = yOffset * -10;
      const tiltY = xOffset * 10;
      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(10px)`;
      bg.style.transform = `scale(1.18) translate(${xOffset * -16}px, ${yOffset * -16}px)`;
    }
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    if (bg) bg.style.transform = '';
  });

  // Attach tooltips dynamically to Hotspots
  card.querySelectorAll('.img-hotspot').forEach(hotspot => {
    const title = hotspot.dataset.title;
    const detail = hotspot.dataset.detail;
    if (title && !hotspot.querySelector('.hotspot-tooltip')) {
      const tooltip = document.createElement('div');
      tooltip.className = 'hotspot-tooltip';
      tooltip.innerHTML = `<h6>${title}</h6><p>${detail}</p>`;
      hotspot.appendChild(tooltip);
    }

    hotspot.addEventListener('click', e => {
      e.stopPropagation();
      openModal(card.dataset.serviceId, title);
    });
  });

  // Inspect Button / Image Click to Open Modal Lightbox
  const inspectBtn = card.querySelector('.inspect-btn');
  if (inspectBtn) {
    inspectBtn.addEventListener('click', e => {
      e.stopPropagation();
      openModal(card.dataset.serviceId);
    });
  }
});

// --- Modal Lightbox Inspector Logic ---
const modal = document.querySelector('#image-modal');
const modalCloseBtn = document.querySelector('#modal-close-btn');
const modalImg = document.querySelector('#modal-img');
const modalTitle = document.querySelector('#modal-title');
const modalBadge = document.querySelector('#modal-badge');
const modalDesc = document.querySelector('#modal-desc');
const modalFilterBtns = document.querySelectorAll('.modal-filters .filter-btn');
const modalCanvasWrapper = document.querySelector('#modal-canvas-wrapper');
const modalViewport = document.querySelector('#modal-viewport');
const modalHotspotList = document.querySelector('#modal-hotspot-list');
const modalPrev = document.querySelector('#modal-prev');
const modalNext = document.querySelector('#modal-next');
const zoomIn = document.querySelector('#zoom-in');
const zoomOut = document.querySelector('#zoom-out');
const zoomReset = document.querySelector('#zoom-reset');

let currentServiceIndex = 0;
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

const cardsArray = Array.from(serviceCards);

function openModal(serviceId, focusHotspotTitle = null) {
  const index = cardsArray.findIndex(c => c.dataset.serviceId === serviceId);
  if (index !== -1) {
    currentServiceIndex = index;
    loadModalData(focusHotspotTitle);
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
}

function closeModal() {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  resetZoom();
}

function loadModalData(focusHotspotTitle = null) {
  const card = cardsArray[currentServiceIndex];
  if (!card) return;

  const id = card.dataset.serviceId;
  const title = card.dataset.title;
  const desc = card.dataset.desc;
  const imgSrc = card.dataset.img;

  modalBadge.textContent = `OPTION ${id}`;
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  modalImg.src = imgSrc;

  // Clear zoom
  resetZoom();

  // Populate Hotspots in Sidebar
  modalHotspotList.innerHTML = '';
  const hotspots = card.querySelectorAll('.img-hotspot');
  hotspots.forEach((hs) => {
    const hsTitle = hs.dataset.title;
    const hsDetail = hs.dataset.detail;
    const item = document.createElement('div');
    item.className = 'hotspot-item' + (focusHotspotTitle === hsTitle ? ' active' : '');
    item.innerHTML = `<h5>${hsTitle}</h5><p>${hsDetail}</p>`;
    item.addEventListener('click', () => {
      document.querySelectorAll('.hotspot-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
    modalHotspotList.appendChild(item);
  });
}

function resetZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateCanvasTransform();
}

function updateCanvasTransform() {
  if (modalCanvasWrapper) {
    modalCanvasWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  }
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modal) {
  modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
});

// Modal Navigation
if (modalPrev) {
  modalPrev.addEventListener('click', () => {
    currentServiceIndex = (currentServiceIndex - 1 + cardsArray.length) % cardsArray.length;
    loadModalData();
  });
}
if (modalNext) {
  modalNext.addEventListener('click', () => {
    currentServiceIndex = (currentServiceIndex + 1) % cardsArray.length;
    loadModalData();
  });
}

// Modal Filters
modalFilterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modalFilterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    modalImg.className = filter === 'normal' ? '' : `filter-${filter}`;
  });
});

// Zoom Controls
if (zoomIn) zoomIn.addEventListener('click', () => { currentZoom = Math.min(currentZoom + 0.3, 3); updateCanvasTransform(); });
if (zoomOut) zoomOut.addEventListener('click', () => { currentZoom = Math.max(currentZoom - 0.3, 0.7); updateCanvasTransform(); });
if (zoomReset) zoomReset.addEventListener('click', resetZoom);

// Drag Pan inside Modal
if (modalViewport) {
  modalViewport.addEventListener('mousedown', e => {
    if (e.target.closest('.zoom-controls') || e.target.closest('.nav-arrow')) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateCanvasTransform();
  });

  window.addEventListener('mouseup', () => { isDragging = false; });
}