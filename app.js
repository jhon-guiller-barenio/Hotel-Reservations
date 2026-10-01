const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const localISO = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const money = (amount) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const today = new Date(); today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(tomorrow); dayAfter.setDate(tomorrow.getDate() + 1);
const checkin = $('#checkin'), checkout = $('#checkout'), bookCheckin = $('#bookCheckin'), bookCheckout = $('#bookCheckout');
checkin.min = localISO(today); checkin.value = localISO(tomorrow);
checkout.min = localISO(dayAfter); checkout.value = localISO(dayAfter);
bookCheckin.min = localISO(today); bookCheckout.min = localISO(dayAfter);

let rooms = [
  { id: 'garden-king', name: 'Garden King', type: 'classic', category: 'Classic', rate: 185, capacity: 2, size: '28 m²', beds: '1 king bed', feature: 'Garden view', badge: 'Quiet favorite', rating: '4.9', desc: 'A calm, light-filled room opening toward our tucked-away courtyard.', image: 'https://static.prod.r53.tablethotels.com/media/hotels/slideshow_images_staged/large/1487214.jpg' },
  { id: 'terrace-deluxe', name: 'Terrace Deluxe', type: 'deluxe', category: 'Deluxe', rate: 245, capacity: 3, size: '36 m²', beds: '1 king bed', feature: 'Private terrace', badge: 'Guest favorite', rating: '4.9', desc: 'Room to spread out, with your own terrace for slow coffee and fresh air.', image: 'https://www.myboutiquehotel.com/photos/116715/the-venice-venice-hotel-venice-114-1685536538-900x570.jpg' },
  { id: 'corner-suite', name: 'Corner Suite', type: 'suite', category: 'Suite', rate: 320, capacity: 4, size: '48 m²', beds: '1 king + sofa bed', feature: 'Separate lounge', badge: 'Extra room', rating: '5.0', desc: 'A little more space for longer stays, families, and late-night lounging.', image: 'https://static-new.lhw.com/HotelImages/Final/LW1323/lw1323_156427285_720x450.jpg' },
  { id: 'studio-twin', name: 'Studio Twin', type: 'classic', category: 'Classic', rate: 205, capacity: 2, size: '31 m²', beds: '2 twin beds', feature: 'Flexible layout', badge: 'Easy sharing', rating: '4.8', desc: 'Two comfortable beds and a thoughtful layout for friends traveling together.', image: 'https://images.mrandmrssmith.com/images/828x552/4814349-homewood-hotel-bath-somerset-united-kingdom.jpg' },
  { id: 'family-suite', name: 'Family Suite', type: 'suite', category: 'Suite', rate: 365, capacity: 5, size: '56 m²', beds: '1 king + bunk nook', feature: 'Family friendly', badge: 'Room for all', rating: '4.9', desc: 'A generous suite with a separate sleeping nook and space to gather.', image: 'https://www.hoteltodossantos.com/files/gallery/8.jpg' },
  { id: 'skyline-deluxe', name: 'Skyline Deluxe', type: 'deluxe', category: 'Deluxe', rate: 275, capacity: 3, size: '39 m²', beds: '1 king bed', feature: 'Upper-floor view', badge: 'Bright mornings', rating: '4.9', desc: 'A bright upper-floor room with wide windows and a restful sitting corner.', image: 'https://themediterraneaninsider.com/wp-content/uploads/2025/04/TMI_CoolroomsPalacioVillapanes_Seville_Andalusia_Spain_03_.jpg' },
];
let activeFilter = 'all';
let selectedRoom = null;
let backendReady = false;
let availability = {};
let availabilityRequest = 0;
let currentUser = null;
let authMode = 'login';
let pendingRoomId = null;
let pendingDestination = null;

function nightsBetween(start, end) {
  return Math.max(1, Math.round((Date.parse(`${end}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86400000));
}
function formatDate(value) {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function setBackendStatus(kind, message) {
  const box = $('#backendStatus');
  box.classList.toggle('offline', kind === 'offline');
  box.classList.toggle('checking', kind === 'checking');
  box.querySelector('.note-icon').textContent = kind === 'online' ? '✓' : kind === 'offline' ? '!' : '…';
  $('#backendStatusText').textContent = message;
}
function renderRooms() {
  const count = Number($('#guests').value);
  const visible = rooms.filter((room) => (activeFilter === 'all' || room.type === activeFilter) && room.capacity >= count);
  $('#roomGrid').innerHTML = visible.map((room) => {
    const left = availability[room.id];
    const availableCount = typeof left === 'number' ? left : null;
    const unavailable = !backendReady || availableCount === 0 || availableCount === null;
    const action = !backendReady ? 'Unavailable' : availableCount === 0 ? 'Sold out' : 'Choose room';
    const inventoryLabel = !backendReady ? 'Online booking offline' : availableCount === 0 ? 'No rooms left' : `${availableCount} available`;
    return `<article class="room-card"><div class="room-image" style="background-image:url('${room.image}')"><span class="room-tag">${room.badge}</span><span class="room-image-icon">${room.category} · ${room.size}</span></div><div class="room-body"><div class="room-title-row"><h3>${room.name}</h3><span class="rating">★ ${room.rating}</span></div><p class="room-desc">${room.desc}</p><div class="room-specs"><span>♙ Up to ${room.capacity}</span><span>▱ ${room.beds}</span><span>✧ ${room.feature}</span></div><div class="room-foot"><div class="price"><strong>${money(room.rate)}</strong><small>per room, per night · ${inventoryLabel}</small></div><button class="choose-btn" data-room="${room.id}" ${unavailable ? 'disabled' : ''}>${action}</button></div></div></article>`;
  }).join('') || '<div class="empty" style="display:block">No rooms match that guest count. Try fewer guests.</div>';
  $$('[data-room]').forEach((button) => button.addEventListener('click', () => openBooking(button.dataset.room)));
}
async function refreshAvailability() {
  const requestId = ++availabilityRequest;
  backendReady = false;
  renderRooms();
  setBackendStatus('checking', 'Checking live room availability…');
  try {
    const query = new URLSearchParams({ checkin: checkin.value, checkout: checkout.value, guests: $('#guests').value });
    const response = await fetch(`/api/rooms?${query}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || payload.error || 'availability_unavailable');
    if (requestId !== availabilityRequest) return;
    if (!Array.isArray(payload.rooms) || !payload.rooms.length) throw new Error('no_rooms_configured');
    if (Array.isArray(payload.rooms) && payload.rooms.length) {
      const serverRooms = new Map(payload.rooms.map((room) => [room.id, room]));
      rooms = rooms.map((room) => ({ ...room, ...(serverRooms.get(room.id) || {}) }));
      availability = Object.fromEntries(payload.rooms.map((room) => [room.id, Number(room.availableCount)]));
    }
    backendReady = true;
    setBackendStatus('online', 'Live availability is connected. Room inventory is checked again when you confirm a reservation.');
  } catch {
    if (requestId !== availabilityRequest) return;
    backendReady = false;
    availability = {};
    setBackendStatus('offline', 'Online booking is unavailable until the hotel database is connected and initialized.');
  }
  renderRooms();
}
function updateStayCopy() {
  const numberOfNights = nightsBetween(checkin.value, checkout.value);
  $('#availabilityText').innerHTML = `<b>${formatDate(checkin.value)} – ${formatDate(checkout.value)}</b><br>${numberOfNights} ${numberOfNights === 1 ? 'night' : 'nights'} · ${$('#guests').value} guests`;
}
function syncDates(source) {
  if (source === 'checkin') {
    const minOut = new Date(`${checkin.value}T12:00:00`);
    minOut.setDate(minOut.getDate() + 1);
    checkout.min = localISO(minOut);
    if (checkout.value <= checkin.value) checkout.value = localISO(minOut);
  }
  updateStayCopy();
  refreshAvailability();
}
checkin.addEventListener('change', () => syncDates('checkin'));
checkout.addEventListener('change', () => syncDates('checkout'));
$('#guests').addEventListener('change', () => { updateStayCopy(); renderRooms(); refreshAvailability(); });
$('#roomType').addEventListener('change', (event) => {
  activeFilter = event.target.value;
  $$('.filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === activeFilter));
  renderRooms();
});
$$('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  $('#roomType').value = activeFilter;
  $$('.filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderRooms();
}));
$('#searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (checkout.value <= checkin.value) { toast('Check-out must be after check-in.'); return; }
  updateStayCopy();
  await refreshAvailability();
  $('#rooms').scrollIntoView({ behavior: 'smooth' });
});

function openBooking(id) {
  if (!backendReady) { toast('Online booking is not connected yet.'); return; }
  if (!currentUser) { pendingRoomId = id; setAuthMode('login'); openOverlay('authOverlay'); return; }
  selectedRoom = rooms.find((room) => room.id === id);
  if (!selectedRoom) return;
  $('#firstName').value = currentUser.firstName;
  $('#lastName').value = currentUser.lastName;
  $('#email').value = currentUser.email;
  $('#summaryRoom').textContent = selectedRoom.name;
  bookCheckin.value = checkin.value;
  bookCheckout.value = checkout.value;
  $('#guestCount').value = $('#guests').value;
  updateBookingTotal();
  $('#bookingPane').style.display = 'block';
  $('#successPane').style.display = 'none';
  openOverlay('bookingOverlay');
  setTimeout(() => $('#firstName').focus(), 100);
}
function updateBookingTotal() {
  if (!selectedRoom) return;
  const numberOfNights = nightsBetween(bookCheckin.value, bookCheckout.value);
  const total = selectedRoom.rate * numberOfNights;
  $('#summaryDates').textContent = `${formatDate(bookCheckin.value)} – ${formatDate(bookCheckout.value)} · ${$('#guestCount').value} guests`;
  $('#summaryNights').textContent = `${numberOfNights} ${numberOfNights === 1 ? 'night' : 'nights'}`;
  $('#summaryPrice').textContent = money(total);
  $('#formTotal').textContent = money(total);
}
bookCheckin.addEventListener('change', () => {
  const minimumCheckout = new Date(`${bookCheckin.value}T12:00:00`);
  minimumCheckout.setDate(minimumCheckout.getDate() + 1);
  bookCheckout.min = localISO(minimumCheckout);
  if (bookCheckout.value <= bookCheckin.value) bookCheckout.value = localISO(minimumCheckout);
  updateBookingTotal();
});
bookCheckout.addEventListener('change', () => {
  if (bookCheckout.value <= bookCheckin.value) {
    const nextDay = new Date(`${bookCheckin.value}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    bookCheckout.value = localISO(nextDay);
  }
  updateBookingTotal();
});
$('#guestCount').addEventListener('change', updateBookingTotal);

function errorMessage(code) {
  const messages = {
    database_not_configured: 'The reservation database is not configured yet.',
    database_unavailable: 'The reservation service is temporarily unavailable. Try again shortly.',
    room_unavailable: 'This room just sold out for those dates. Choose another room or dates.',
    room_not_found: 'That room is no longer available.',
    guest_capacity_exceeded: 'This room cannot accommodate that many guests.',
    reservation_not_cancellable: 'This reservation can no longer be cancelled online.',
    check_in_in_past: 'Choose a check-in date from today onward.',
    invalid_date_range: 'Check-out must be after check-in.',
    stay_too_long: 'Online reservations are limited to 60 nights.',
    password_too_short: 'Choose a password with at least 12 characters.',
    invalid_email: 'Enter a valid email address.',
    invalid_name: 'Enter both your first and last name.',
    invalid_credentials: 'That email and password do not match.',
    email_in_use: 'An account already uses that email. Log in instead.',
    authentication_required: 'Log in to continue.',
  };
  return messages[code] || 'Please check the details and try again.';
}
$('#bookingForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (bookCheckout.value <= bookCheckin.value) { toast('Check-out must be after check-in.'); return; }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Checking room…';
  const formData = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...formData, roomId: selectedRoom.id }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'booking_failed');
    const booking = payload.booking;
    $('#bookingCode').textContent = `Confirmation ${booking.code}`;
    $('#successMessage').textContent = `${booking.room} is reserved for ${formData.firstName} ${formData.lastName} from ${formatDate(booking.checkin)} to ${formatDate(booking.checkout)}. Estimated total: ${money(booking.total)}.`;
    $('#bookingPane').style.display = 'none';
    $('#successPane').style.display = 'block';
    $('#successPane').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await refreshAvailability();
  } catch (error) {
    toast(errorMessage(error.message));
    if (error.message === 'room_unavailable') await refreshAvailability();
  } finally {
    submit.disabled = false;
    submit.textContent = 'Confirm reservation';
  }
});

function openOverlay(id) { $(`#${id}`).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeOverlay(id) { $(`#${id}`).classList.remove('open'); if (!$('.overlay.open')) document.body.style.overflow = ''; }
$$('[data-close]').forEach((button) => button.addEventListener('click', () => closeOverlay(button.dataset.close)));
$$('.overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeOverlay(overlay.id); }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') $$('.overlay.open').forEach((overlay) => closeOverlay(overlay.id)); });
$('#finishBooking').addEventListener('click', () => closeOverlay('bookingOverlay'));

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  $('#authTitle').textContent = signup ? 'Create your account' : 'Welcome back';
  $('#authSubtitle').textContent = signup ? 'Keep your stays together in one place.' : 'Log in to manage your stay.';
  $('#authPassword').autocomplete = signup ? 'new-password' : 'current-password';
  $('#authPassword').minLength = signup ? 12 : 1;
  $('#passwordHint').textContent = signup ? 'Use at least 12 characters.' : 'Use your account password.';
  $('#signupFields').hidden = !signup;
  $('#authFirstName').required = signup;
  $('#authLastName').required = signup;
  $('#authFirstName').disabled = !signup;
  $('#authLastName').disabled = !signup;
  $('#authFirstName').value = '';
  $('#authLastName').value = '';
  $('#authForm').querySelector('[type="submit"]').textContent = signup ? 'Create account' : 'Log in';
  $$('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.authMode === mode));
  $('#authError').textContent = '';
}
function updateAccountNav() {
  const signedIn = Boolean(currentUser);
  $('#loginButton').hidden = signedIn;
  $('#signupButton').hidden = signedIn;
  $('#logoutButton').hidden = !signedIn;
  $('#accountGreeting').hidden = !signedIn;
  $('#accountGreeting').textContent = signedIn ? `Hi, ${currentUser.firstName}` : '';
}
async function refreshAuth() {
  try {
    const response = await fetch('/api/auth', { cache: 'no-store' });
    const payload = await response.json();
    currentUser = response.ok ? payload.user : null;
  } catch { currentUser = null; }
  updateAccountNav();
}
$('#loginButton').addEventListener('click', () => { setAuthMode('login'); openOverlay('authOverlay'); });
$('#signupButton').addEventListener('click', () => { setAuthMode('signup'); openOverlay('authOverlay'); });
$$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.authMode)));
$('#authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = $('#authPassword').value;
  if (authMode === 'signup' && password.length < 12) { $('#authError').textContent = errorMessage('password_too_short'); return; }
  if (!form.reportValidity()) return;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = authMode === 'signup' ? 'Creating account…' : 'Logging in…';
  const body = Object.fromEntries(new FormData(form).entries());
  body.action = authMode;
  try {
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'database_unavailable');
    currentUser = payload.user;
    updateAccountNav();
    closeOverlay('authOverlay');
    $('#authPassword').value = '';
    if (pendingRoomId) {
      const roomId = pendingRoomId;
      pendingRoomId = null;
      openBooking(roomId);
    } else if (pendingDestination === 'reservations') {
      pendingDestination = null;
      await showBookings();
    }
  } catch (error) {
    $('#authError').textContent = errorMessage(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = authMode === 'signup' ? 'Create account' : 'Log in';
  }
});
$('#logoutButton').addEventListener('click', async () => {
  try { await fetch('/api/auth', { method: 'DELETE' }); } catch { /* The next session check will clear the account state. */ }
  currentUser = null;
  updateAccountNav();
  toast('You are logged out.');
});
function showLookupResult(booking, result) {
  const card = document.createElement('article');
  card.className = 'booking-item';
  const details = document.createElement('div');
  const heading = document.createElement('h3');
  heading.textContent = booking.room;
  const dates = document.createElement('p');
  dates.textContent = `${formatDate(booking.checkin)} – ${formatDate(booking.checkout)} · ${booking.guests} guests · ${money(booking.total)}`;
  const status = document.createElement('p');
  status.textContent = `Confirmation ${booking.code} · ${booking.status}`;
  details.append(heading, dates, status);
  card.append(details);
  if (booking.status === 'confirmed' && booking.checkin > localISO(today)) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel reservation';
    cancel.addEventListener('click', () => cancelBooking(booking.code, result));
    card.append(cancel);
  }
  result.append(card);
}
async function loadBookings() {
  const result = $('#lookupResult');
  result.textContent = 'Loading your reservations…';
  try {
    const response = await fetch('/api/bookings', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'database_unavailable');
    result.replaceChildren();
    if (!payload.bookings.length) {
      const empty = document.createElement('div');
      empty.className = 'no-bookings';
      empty.textContent = 'No reservations yet. Choose a room to plan your stay.';
      result.append(empty);
      return;
    }
    payload.bookings.forEach((booking) => showLookupResult(booking, result));
  } catch (error) {
    result.textContent = errorMessage(error.message);
  }
}
async function cancelBooking(code, result) {
  if (!window.confirm('Cancel this reservation?')) return;
  result.textContent = 'Cancelling reservation…';
  try {
    const response = await fetch('/api/bookings', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'reservation_not_cancellable');
    toast('Reservation cancelled.');
    await loadBookings();
    await refreshAvailability();
  } catch (error) {
    result.textContent = errorMessage(error.message);
  }
}
async function showBookings() {
  if (!currentUser) {
    pendingDestination = 'reservations';
    setAuthMode('login');
    openOverlay('authOverlay');
    return;
  }
  $('#lookupResult').replaceChildren();
  openOverlay('reservationsOverlay');
  await loadBookings();
}
$('#openBookings').addEventListener('click', showBookings);
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2800);
}
$('#menuBtn').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
$$('#navLinks a').forEach((link) => link.addEventListener('click', () => $('#navLinks').classList.remove('open')));
setAuthMode('login');
updateStayCopy();
renderRooms();
refreshAvailability();
refreshAuth();
