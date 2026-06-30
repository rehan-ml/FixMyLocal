// ─────────────────────────────────────────
//   FIXMYLOCAL · app.js
//   Core logic: Map, Reports, AI (Gemini), UI
// ─────────────────────────────────────────

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : 'https://fixmylocal-164988193935.asia-south1.run.app';

// ── CONFIG ──
const GEMINI_API_KEY = CONFIG?.GEMINI_API_KEY || '';

// ── AUTH SYSTEM ──
const AVATARS = {
  m1: `<img src="res/avatar-m1.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`,
  m2: `<img src="res/avatar-m2.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`,
  f1: `<img src="res/avatar-f1.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`,
  f2: `<img src="res/avatar-f2.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`,
};

const SITE_STATS = {
  totalReports: 2847,
  resolved: 1923,
  activeCities: 342,
};

let nearbyMode = false;
let searchCircle = null;

let selectedAvatar = 'm1';
let currentUser = null;

function loadSession() {
  const saved = localStorage.getItem('fml_session');
  if (saved) {
    currentUser = JSON.parse(saved);
    updateNavForUser();
  }
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem('fml_session', JSON.stringify(user));
  updateNavForUser();
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem('fml_session');
  updateNavForUser();
}

function updateNavForUser() {
  const navAuth = document.getElementById('navAuth');
  const navProfile = document.getElementById('navProfile');
  const navAuthMobile = document.getElementById('navAuthMobile');
  const navProfileMobileBtn = document.getElementById('navProfileMobileBtn');
  const navAvatar = document.getElementById('navAvatar');
  const navAvatarMobile = document.getElementById('navAvatarMobile');

  if (currentUser) {
    navAuth.classList.add('hidden');
    navProfile.classList.remove('hidden');
    if (navAuthMobile) navAuthMobile.classList.add('hidden');
    if (navProfileMobileBtn) navProfileMobileBtn.classList.remove('hidden');
    const avatarHTML = currentUser.customAvatar
      ? `<img src="${currentUser.customAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block"/>`
      : (AVATARS[currentUser.avatar] || `<span>${currentUser.name[0].toUpperCase()}</span>`);
    navAvatar.innerHTML = avatarHTML;
    if (navAvatarMobile) navAvatarMobile.innerHTML = avatarHTML;
    document.getElementById('dropdownName').textContent = currentUser.name;
    document.getElementById('dropdownEmail').textContent = currentUser.email;
    document.getElementById('dropdownAvatar').innerHTML = avatarHTML;
  } else {
    navAuth.classList.remove('hidden');
    navProfile.classList.add('hidden');
    if (navAuthMobile) navAuthMobile.classList.remove('hidden');
    if (navProfileMobileBtn) navProfileMobileBtn.classList.add('hidden');
  }
}

function openAuthModal(view = 'login') {
  if (view === 'signup') switchView('viewSignup');
  else if (view === 'forgot') switchView('viewForgot');
  else switchView('viewLogin');
  document.getElementById('authModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('open');
  document.body.style.overflow = '';
  clearAuthErrors();
}

function switchView(viewId) {
  ['viewLogin', 'viewSignup', 'viewForgot'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById(viewId).classList.remove('hidden');
  clearAuthErrors();
}

function clearAuthErrors() {
  ['loginError', 'signupError', 'forgotError', 'forgotSuccess'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.textContent = ''; }
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.classList.remove('hidden');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getUsers() {
  return JSON.parse(localStorage.getItem('fml_users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('fml_users', JSON.stringify(users));
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showAuthError('loginError', 'Please fill in all fields.'); return; }
  if (!isValidEmail(email)) { showAuthError('loginError', 'Please enter a valid email address.'); return; }
  try {
    const { signInWithEmailAndPassword } = window.firebaseModules;
    const auth = window.firebaseAuth;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const users = getUsers();
    closeAuthModal();
    try {
      const { collection, getDocs } = window.firebaseModules;
      const db = window.firebaseDB;
      const snapshot = await getDocs(collection(db, 'users'));
      let firestoreProfile = null;
      snapshot.forEach(doc => {
        if (doc.data().email === email) firestoreProfile = doc.data();
      });
      const localUser = getUsers().find(u => u.email === email);
      const profile = firestoreProfile || localUser;
      if (firestoreProfile && !localUser) {
        const users = getUsers();
        users.push({ name: profile.name, email: profile.email, avatar: profile.avatar, customAvatar: profile.customAvatar, city: profile.city });
        saveUsers(users);
      }
      saveSession({
        name: profile?.name || email.split('@')[0],
        email: user.email,
        avatar: profile?.avatar || 'm1',
        customAvatar: profile?.customAvatar || null,
        city: profile?.city || ''
      });
      showToast(`Welcome back, ${profile?.name?.split(' ')[0] || 'there'}! 👋`);
    } catch (err) {
      const localUser = getUsers().find(u => u.email === email);
      saveSession({ name: localUser?.name || email.split('@')[0], email: user.email, avatar: localUser?.avatar || 'm1' });
      showToast(`Welcome back! 👋`);
    }
    showToast(`Welcome back! 👋`);
  } catch (err) {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      showAuthError('loginError', 'Incorrect email or password.');
    } else if (err.code === 'auth/user-not-found') {
      showAuthError('loginError', 'No account found with this email.');
    } else if (err.code === 'auth/too-many-requests') {
      showAuthError('loginError', 'Too many attempts. Try again later.');
    } else {
      showAuthError('loginError', 'Login failed. Please try again.');
    }
  }
}

async function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const city = document.getElementById('signupCity').value.trim() || 'Anonymous';
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  if (!name || !email || !password || !confirm) { showAuthError('signupError', 'Please fill in all fields.'); return; }
  if (name.length < 2) { showAuthError('signupError', 'Name must be at least 2 characters.'); return; }
  if (!isValidEmail(email)) { showAuthError('signupError', 'Please enter a valid email address.'); return; }
  if (password.length < 8) { showAuthError('signupError', 'Password must be at least 8 characters.'); return; }
  if (!/\d/.test(password)) { showAuthError('signupError', 'Password must contain at least one number.'); return; }
  if (password !== confirm) { showAuthError('signupError', 'Passwords do not match.'); return; }
  try {
    const { createUserWithEmailAndPassword, sendEmailVerification } = window.firebaseModules;
    const auth = window.firebaseAuth;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await sendEmailVerification(user);
    const users = getUsers();
    const newUser = { name, email, password: btoa(password), avatar: selectedAvatar, customAvatar: window.customAvatarData || null, city, createdAt: Date.now() };
    users.push(newUser);
    saveUsers(users);

    try {
      const { doc, setDoc } = window.firebaseModules;
      const db = window.firebaseDB;
      await setDoc(doc(db, 'users', user.uid), {
        name, email, avatar: selectedAvatar,
        customAvatar: window.customAvatarData || null,
        city, createdAt: Date.now()
      });
    } catch (err) {
      console.error('Profile save error:', err);
    }
    closeAuthModal();
    saveSession({ name, email, avatar: selectedAvatar, customAvatar: window.customAvatarData || null, city });
    showToast(`Account created! Check your email to verify your account. 📧`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      showAuthError('signupError', 'An account with this email already exists.');
    } else if (err.code === 'auth/weak-password') {
      showAuthError('signupError', 'Password is too weak.');
    } else {
      showAuthError('signupError', 'Signup failed. Please try again.');
    }
  }
}

async function handleForgot() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showAuthError('forgotError', 'Please enter your email address.'); return; }
  if (!isValidEmail(email)) { showAuthError('forgotError', 'Please enter a valid email address.'); return; }
  try {
    const { sendPasswordResetEmail } = window.firebaseModules;
    await sendPasswordResetEmail(window.firebaseAuth, email);
    const el = document.getElementById('forgotSuccess');
    el.textContent = `Reset link sent to ${email}. Check your inbox!`;
    el.classList.remove('hidden');
    document.getElementById('forgotEmail').value = '';
  } catch (err) {
    const el = document.getElementById('forgotSuccess');
    el.textContent = `If an account with ${email} exists, a reset link has been sent.`;
    el.classList.remove('hidden');
  }
}

async function handleLogout() {
  closeDropdown();
  try {
    const { signOut } = window.firebaseModules;
    await signOut(window.firebaseAuth);
  } catch (err) { }
  clearSession();
  showToast('Signed out successfully.');
}

function confirmDeleteAccount() {
  closeDropdown();
  document.getElementById('deletePassword').value = '';
  clearDeleteError();
  document.getElementById('deleteModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('deletePassword').focus(), 100);
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
  document.body.style.overflow = '';
}

function clearDeleteError() {
  document.getElementById('deleteError').classList.add('hidden');
}

async function executeDeleteAccount() {
  const password = document.getElementById('deletePassword').value;
  try {
    const { signInWithEmailAndPassword, deleteUser } = window.firebaseModules;
    const auth = window.firebaseAuth;
    const userCredential = await signInWithEmailAndPassword(auth, currentUser.email, password);
    await deleteUser(userCredential.user);
    const users = getUsers().filter(u => u.email !== currentUser.email);
    saveUsers(users);
    closeDeleteModal();
    clearSession();
    showToast('Account deleted. Sorry to see you go.');
  } catch (err) {
    document.getElementById('deleteError').classList.remove('hidden');
    document.getElementById('deletePassword').style.borderColor = 'rgba(239,68,68,0.5)';
  }
}

function selectAvatar(key, btn) {
  selectedAvatar = key;
  document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function checkPasswordStrength(val) {
  const bars = [document.getElementById('pwBar1'), document.getElementById('pwBar2'), document.getElementById('pwBar3'), document.getElementById('pwBar4')];
  const label = document.getElementById('pwLabel');
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/\d/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#6ee7b7'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  bars.forEach((b, i) => {
    b.style.width = i < score ? '100%' : '0';
    b.style.background = i < score ? colors[score - 1] : '';
  });
  label.textContent = score > 0 ? labels[score - 1] : '';
  label.style.color = score > 0 ? colors[score - 1] : '';
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function toggleDropdown() {
  const d = document.getElementById('profileDropdown');
  d.classList.toggle('hidden');
  d.style.display = d.classList.contains('hidden') ? 'none' : 'block';
  if (!d.classList.contains('hidden') && currentUser) {
    document.getElementById('notifBadge')?.classList.add('hidden');
    document.getElementById('notifBadgeMobile')?.classList.add('hidden');
    localStorage.setItem(`fml_lastseen_${currentUser.email}`, Date.now().toString());
  }
}

function closeDropdown() {
  document.getElementById('profileDropdown').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('profileDropdown');
  const profileBtn = document.getElementById('profileBtn');
  const profileBtnMobile = document.getElementById('profileBtnMobile');
  const myAccountBtn = document.getElementById('myAccountBtn');
  if (
    !dropdown.classList.contains('hidden') &&
    !dropdown.contains(e.target) &&
    !profileBtn?.contains(e.target) &&
    !profileBtnMobile?.contains(e.target) &&
    !myAccountBtn?.contains(e.target)
  ) {
    closeDropdown();
  }
});

document.getElementById('authModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeAuthModal();
});
document.getElementById('deleteModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// ── SAMPLE DATA ──
const SAMPLE_ISSUES = [
  {
    id: 1, title: "Large Pothole on MG Road", type: "pothole", severity: "high", status: "open", lat: 28.6139, lng: 77.2090, desc: "Deep pothole causing accidents, near bus stop.", votes: 34, reporter: "Ravi K.", time: "2h ago", city: "New Delhi",
    imageUrl: "https://static.toiimg.com/thumb/msid-64992955,width-400,resizemode-4/64992955.jpg"
  },
  {
    id: 2, title: "Broken Streetlight Sector 15", type: "streetlight", severity: "medium", status: "progress", lat: 28.6219, lng: 77.2150, desc: "3 lights not working since a week.", votes: 18, reporter: "Priya M.", time: "5h ago", city: "New Delhi",
    imageUrl: "https://i2-prod.kentlive.news/incoming/article8398468.ece/ALTERNATES/s615/0_Faulty-streetlights.jpg"
  },
  {
    id: 3, title: "Water Pipeline Leakage", type: "water", severity: "high", status: "open", lat: 28.6080, lng: 77.2240, desc: "Pipeline burst near park, wasting water for 2 days.", votes: 52, reporter: "Arjun S.", time: "1h ago", city: "New Delhi",
    imageUrl: "https://thewaterdigest.com/wp-content/uploads/2023/06/60-MLD-Water-Leaking-from-Old-Pipeline-jpg.webp"
  },
  {
    id: 4, title: "Garbage Pile Not Cleared", type: "garbage", severity: "medium", status: "resolved", lat: 28.6180, lng: 77.2010, desc: "Garbage overflowing from bins for days.", votes: 27, reporter: "Fatima B.", time: "1d ago", city: "New Delhi",
    imageUrl: "https://images.indianexpress.com/2026/06/image-pd-11-2.jpg?w=1200"
  },
  {
    id: 5, title: "Road Cave-in Near School", type: "pothole", severity: "high", status: "progress", lat: 28.6050, lng: 77.2170, desc: "Major road cave-in, dangerous for children and vehicles.", votes: 89, reporter: "Vikram T.", time: "3h ago", city: "New Delhi",
    imageUrl: "https://drop.ndtv.com/albums/NEWS/Huge_Chunk_Of_R_637633368719026134/637633368730288573.jpeg"
  },
  {
    id: 6, title: "Clogged Drainage, Flooding", type: "water", severity: "medium", status: "open", lat: 28.6250, lng: 77.1950, desc: "Stormwater drain blocked, flooding lane.", votes: 41, reporter: "Sneha R.", time: "6h ago", city: "New Delhi",
    imageUrl: "https://thepatriot.in/wp-content/uploads/2024/08/Delhi_-Clogged-city-drains-leave-the-Capital-flooded.jpg"
  },
  {
    id: 7, title: "Fallen Tree Blocking Road", type: "other", severity: "high", status: "resolved", lat: 28.6110, lng: 77.2280, desc: "Tree fell during storm, blocking one lane.", votes: 15, reporter: "Amitabh G.", time: "2d ago", city: "New Delhi",
    imageUrl: "https://i.redd.it/rucy6jgpq13h1.jpeg"
  },
  {
    id: 8, title: "Sewer Overflow on Street", type: "sewer", severity: "high", status: "open", lat: 28.6195, lng: 77.2100, desc: "Open sewer overflow, health hazard.", votes: 63, reporter: "Nisha P.", time: "4h ago", city: "New Delhi",
    imageUrl: "https://static.toiimg.com/thumb/msid-121398569,width-1280,height-720,resizemode-72/121398569.jpg"
  },
];

const LEADERBOARD_DATA = [
  { rank: 1, name: "Arjun Singh", city: "New Delhi", points: 1240, reports: 15 },
  { rank: 2, name: "Sanjay Mehta", city: "Mumbai", points: 980, reports: 12 },
  { rank: 3, name: "Fatima Noor", city: "Hyderabad", points: 610, reports: 7 },
  { rank: 4, name: "— ", city: "Your city", points: 0, reports: 0 },
  { rank: 5, name: "—", city: "Your city", points: 0, reports: 0 },
];

// ── STATE ──
let map = null;
let markers = [];
let allIssues = [...SAMPLE_ISSUES];
let activeFilter = 'all';
let activeStatus = 'all';
let currentStep = 1;
let uploadedImageData = null;
let aiAnalysisResult = null;
let userLocation = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadSession();
  initMap();
  renderRecentReports();
  initScrollEffects();
  initNavScroll();
  initFilterChips();
  animateCounters();
  initBarAnimations();
  setTimeout(loadIssuesFromFirestore, 1500);
  setTimeout(() => renderLeaderboard(), 1500);
  setTimeout(() => checkNotifications(), 2000);
});

// ── NAVBAR ──
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });
}

function toggleMenu() {
  document.getElementById('navMobile').classList.toggle('open');
}

// ── MAP ──
function initMap() {
  map = L.map('map', {
    center: [28.6139, 77.2090],
    zoom: 13,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  renderMarkers(allIssues);
}

function getMarkerColor(status) {
  const colors = { open: '#ef4444', progress: '#f59e0b', resolved: '#6ee7b7' };
  return colors[status] || '#6ee7b7';
}

function createCustomIcon(status, type, escalated) {
  const color = escalated ? '#ef4444' : getMarkerColor(status);
  const icons = {
    pothole: '🕳️', streetlight: '💡', water: '💧',
    garbage: '🗑️', tree: '🌳', sewer: '🚰', other: '📌'
  };
  const emoji = icons[type] || '📌';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:${escalated ? '38px' : '32px'};
      height:${escalated ? '38px' : '32px'};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:${escalated ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)'};
      display:flex;align-items:center;justify-content:center;
      box-shadow:${escalated ? '0 0 12px rgba(239,68,68,0.6)' : '0 2px 8px rgba(0,0,0,0.4)'};
    "><span style="transform:rotate(45deg);font-size:13px">${escalated ? '🚨' : emoji}</span></div>`,
    iconSize: [escalated ? 38 : 32, escalated ? 38 : 32],
    iconAnchor: [escalated ? 19 : 16, escalated ? 38 : 32],
    popupAnchor: [0, -34]
  });
}

function renderMarkers(issues) {
  markers.forEach(m => m.remove());
  markers = [];

  const clusters = {};
  const CLUSTER_DISTANCE = 0.005;

  issues.forEach(issue => {
    const key = `${Math.round(issue.lat / CLUSTER_DISTANCE)}_${Math.round(issue.lng / CLUSTER_DISTANCE)}`;
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(issue);
  });

  Object.values(clusters).forEach(group => {
    if (group.length === 1) {
      const issue = group[0];
      const marker = L.marker([issue.lat, issue.lng], { icon: createCustomIcon(issue.status, issue.type, issue.escalated) })
        .addTo(map)
        .bindPopup(createPopupHTML(issue));
      markers.push(marker);
    } else {
      const avgLat = group.reduce((s, i) => s + i.lat, 0) / group.length;
      const avgLng = group.reduce((s, i) => s + i.lng, 0) / group.length;
      const openCount = group.filter(i => i.status === 'open').length;
      const color = openCount > 0 ? '#ef4444' : '#6ee7b7';
      const clusterIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:40px;height:40px;border-radius:50%;
          background:${color};
          border:3px solid rgba(255,255,255,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:700;color:white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          cursor:pointer;
        ">${group.length}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      const clusterMarker = L.marker([avgLat, avgLng], { icon: clusterIcon })
        .addTo(map)
        .bindPopup(`
    <div style="min-width:160px;padding:4px 0">
      <strong style="font-size:13px;color:#f0f4ff">${group.length} Issues Here</strong>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
        ${group.map(i => `
          <div onclick="openReportDetail(${JSON.stringify(i).replace(/"/g, '&quot;')})" 
            style="font-size:11px;color:#8b9ab5;cursor:pointer;padding:4px 6px;border-radius:4px;
            background:rgba(255,255,255,0.04);margin-bottom:2px">
            • ${i.title}
          </div>
        `).join('')}
      </div>
      <p style="font-size:11px;color:#6ee7b7;margin-top:8px;cursor:pointer" 
        onclick="map.setView([${avgLat}, ${avgLng}], ${map.getZoom() + 2})">
        🔍 Zoom in to see all
      </p>
    </div>
  `);
      markers.push(clusterMarker);
    }
  });
}

function createPopupHTML(issue) {
  const statusColors = { open: '#ef4444', progress: '#f59e0b', resolved: '#6ee7b7' };
  const statusLabels = { open: 'Open', progress: 'In Progress', resolved: 'Resolved' };
  return `
    <div style="width:200px;max-width:200px;padding:4px 0;word-break:break-word">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
  <div style="width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;background:rgba(110,231,183,0.1);border:1px solid rgba(110,231,183,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#6ee7b7">
    ${getReporterAvatar(issue)}
  </div>
  <span style="font-size:11px;color:#8b9ab5">${issue.reporter || 'Anonymous'}</span>
</div>
<div style="margin-bottom:8px">
  <strong style="font-size:14px;font-weight:600;color:#f0f4ff;line-height:1.3">${issue.title}</strong>
</div>
      <p style="font-size:12px;color:#8b9ab5;margin-bottom:10px;line-height:1.5">${issue.desc}</p>
      <div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap;margin-bottom:10px">
        <span style="background:${statusColors[issue.status]}22;color:${statusColors[issue.status]};
          padding:3px 8px;border-radius:100px;font-size:11px;font-weight:600">
          ${statusLabels[issue.status]}
        </span>
<span style="font-size:11px;color:#6ee7b7" id="popup-up-${issue.id}">▲ ${(issue.votes || 0) + getVotes(issue.id).up} True</span>
<span style="font-size:11px;color:#f87171" id="popup-down-${issue.id}">▼ ${getVotes(issue.id).down} False</span>
      </div>
      <button onclick="openReportDetail(${JSON.stringify(issue).replace(/"/g, '&quot;')})" 
        style="width:100%;padding:8px;background:linear-gradient(135deg,#6ee7b7,#3b82f6);
        border-radius:6px;font-size:12px;font-weight:600;color:#0a1628;cursor:pointer;border:none">
        View Full Details →
      </button>
    </div>
  `;
}

// ── FILTERS ──
function initFilterChips() {
  document.querySelectorAll('[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      applyFilters();
    });
  });
  document.querySelectorAll('[data-status]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-status]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeStatus = chip.dataset.status;
      applyFilters();
    });
  });
}

function applyFilters() {
  let filtered = allIssues;
  if (activeFilter !== 'all') filtered = filtered.filter(i => i.type === activeFilter);
  if (activeStatus !== 'all') filtered = filtered.filter(i => i.status === activeStatus);
  renderMarkers(filtered);
}

// ── RECENT REPORTS ──
function renderRecentReports() {
  const container = document.getElementById('recentReportsList');
  container.innerHTML = '<p class="filter-label">Recent Reports</p>';
  const recent = [...allIssues].sort((a, b) => b.votes - a.votes).slice(0, 3);
  recent.forEach(issue => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <div class="recent-item-title">${issue.title}</div>
      <div class="recent-item-meta">
        <span class="status-dot ${issue.status}"></span>
        <span>${issue.type}</span>
        <span>·</span>
        <span>${timeAgo(issue.createdAt)}</span>
      </div>
    `;
    el.addEventListener('click', () => {
      map.setView([issue.lat, issue.lng], 16);
    });
    container.appendChild(el);
  });
}


// ── LEADERBOARD ──
async function renderLeaderboard() {
  const container = document.getElementById('leaderboardTable');
  container.innerHTML = '';
  const top3 = LEADERBOARD_DATA.slice(0, 3);
  let realUsers = [];
  try {
    const { collection, getDocs } = window.firebaseModules;
    const db = window.firebaseDB;
    const snapshot = await getDocs(collection(db, 'issues'));
    const reportCounts = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.reporterEmail && data.reporter) {
        if (!reportCounts[data.reporterEmail]) {
          reportCounts[data.reporterEmail] = { name: data.reporter, count: 0 };
        }
        reportCounts[data.reporterEmail].count++;
      }
    });
    const savedUsers = getUsers();
    realUsers = Object.entries(reportCounts)
      .map(([email, val]) => {
        const localUser = savedUsers.find(u => u.email === email);
        return {
          name: val.name,
          city: localUser?.city || 'Anonymous',
          points: val.count * 100,
          reports: val.count
        };
      })
      .sort((a, b) => b.reports - a.reports);
  } catch (err) {
    console.error(err);
  }
  const allRows = [...top3, ...realUsers];
  const presetAvatars = { 1: 'm1' };
  const pravatarRank2 = 'https://i.pravatar.cc/150?img=12';

  allRows.forEach((user, index) => {
    const rank = index + 1;
    const rankClass = rank <= 3 ? `top-${rank}` : '';
    const rankDisplay = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const savedUsers = getUsers();
    const localUser = savedUsers.find(u => u.name === user.name);
    let avatarHTML = '';
    if (localUser?.customAvatar) {
      avatarHTML = `<img src="${localUser.customAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else if (localUser?.avatar && AVATARS[localUser.avatar]) {
      avatarHTML = AVATARS[localUser.avatar];
    } else if (rank === 2) {
      avatarHTML = `<img src="${pravatarRank2}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else if (presetAvatars[rank]) {
      avatarHTML = `<img src="res/avatar-${presetAvatars[rank]}.png" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    } else {
      avatarHTML = user.name[0].toUpperCase();
    }
    container.innerHTML += `
  <div class="lb-row ${rankClass}">
    <div class="lb-rank">${rankDisplay}</div>
    <div style="width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;background:rgba(110,231,183,0.1);border:1px solid rgba(110,231,183,0.2);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#6ee7b7">
      ${avatarHTML}
    </div>
    <div class="lb-info">
      <span class="lb-name">${user.name}</span>
      <span class="lb-city">${user.city}</span>
    </div>
    <div class="lb-points">
      <span class="lb-pts">${user.points.toLocaleString()}</span>
      <span class="lb-reports">${user.reports} reports</span>
    </div>
  </div>
`;
  });
}

// ── COUNTERS ──
function animateCounters() {
  const counters = document.querySelectorAll('.counter, .hstat-num');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  if (!target) return;
  const duration = 1800;
  const start = performance.now();
  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ── BAR ANIMATIONS ──
function initBarAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.bar-fill').forEach(bar => {
          bar.style.width = bar.style.getPropertyValue('--w');
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  const breakdown = document.querySelector('.breakdown-card');
  if (breakdown) observer.observe(breakdown);
}

// ── SCROLL ANIMATIONS ──
function initScrollEffects() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.step-card, .stat-card, .fade-up').forEach(el => {
    el.classList.add('fade-up');
    observer.observe(el);
  });
}

// ── MODAL ──
function openReportModal() {
  if (!currentUser) {
    openAuthModal('login');
    showToast('Please sign in to report an issue.');
    return;
  }
  document.getElementById('reportModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  goToStep(1);
}

function closeReportModal() {
  document.getElementById('reportModal').classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
}

document.getElementById('reportModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeReportModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeReportModal();
});

// ── STEP NAVIGATION ──
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('.modal-step').forEach(s => s.classList.add('hidden'));
  document.getElementById(`step${step}`).classList.remove('hidden');
  ['pstep1', 'pstep2', 'pstep3'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active', 'done');
    if (i + 1 < step) el.classList.add('done');
    else if (i + 1 === step) el.classList.add('active');
  });
}

// ── PHOTO UPLOAD ──
function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageData = e.target.result;
    document.getElementById('uploadInner').style.display = 'none';
    const preview = document.getElementById('uploadPreview');
    preview.src = uploadedImageData;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// Drag & Drop
const uploadZone = document.getElementById('uploadZone');
['dragover', 'dragenter'].forEach(ev => {
  uploadZone.addEventListener(ev, e => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--accent-green)';
  });
});
['dragleave', 'drop'].forEach(ev => {
  uploadZone.addEventListener(ev, e => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    if (ev === 'drop' && e.dataTransfer.files[0]) {
      const input = document.getElementById('photoInput');
      const dt = new DataTransfer();
      dt.items.add(e.dataTransfer.files[0]);
      input.files = dt.files;
      handlePhotoUpload({ target: input });
    }
  });
});

// ── GPS LOCATION ──
function getLocation() {
  const btn = document.getElementById('locationBtn');
  btn.textContent = '...';
  if (!navigator.geolocation) {
    showToast('Geolocation not supported in this browser.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const locationInput = document.getElementById('issueLocation');
      locationInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Got it`;
    },
    () => {
      // Fallback to IP-based location
      locationInput.value = 'Location permission denied. Enter manually.';
      btn.innerHTML = 'GPS';
    }
  );
}

// ── STEP 1 SUBMIT ──
function submitStep1() {
  const category = document.getElementById('issueCategory').value;
  const desc = document.getElementById('issueDesc').value.trim();
  const location = document.getElementById('issueLocation').value.trim();
  if (!uploadedImageData) { showToast('Please upload a photo of the issue.', 'error'); return; }
  if (!category) { showToast('Please select a category.', 'error'); return; }
  if (!location) { showToast('Please add a location.', 'error'); return; }
  goToStep(2);
  runAIAnalysis();
}

// ── GEMINI AI ANALYSIS ──
async function runAIAnalysis() {
  const statusEl = document.getElementById('aiStatus');
  const spinnerEl = document.getElementById('aiSpinner');
  const resultEl = document.getElementById('aiResult');
  const actionsEl = document.getElementById('step2Actions');
  const category = document.getElementById('issueCategory').value;
  const severity = document.getElementById('issueSeverity').value;
  const desc = document.getElementById('issueDesc').value;

  const statusMessages = [
    'Analyzing your report with Gemini AI...',
    'Identifying issue type and severity...',
    'Generating smart categorization...',
    'Preparing routing recommendation...'
  ];
  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % statusMessages.length;
    statusEl.textContent = statusMessages[msgIdx];
  }, 1200);

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        severity,
        desc,
        imageData: uploadedImageData || null
      })
    });

    const parsed = await backendResponse.json();
    clearInterval(msgInterval);

    if (parsed.spam) {
      spinnerEl.style.display = 'none';
      statusEl.textContent = '';
      resultEl.classList.remove('hidden');
      resultEl.style.borderColor = 'rgba(239,68,68,0.3)';
      resultEl.style.background = 'rgba(239,68,68,0.04)';
      document.getElementById('aiTags').innerHTML = `<span class="ai-tag ai-tag-severity-high">⚠️ Invalid Report</span>`;
      document.getElementById('aiSummary').textContent = `This image doesn't appear to show a civic issue. ${parsed.reason}. Please upload a photo of an actual infrastructure problem.`;
      document.getElementById('aiFields').innerHTML = '';
      document.getElementById('step2Actions').classList.remove('hidden');
      document.getElementById('step2Actions').innerHTML = `<button class="btn-ghost-sm" onclick="goToStep(1)">← Upload Different Photo</button>`;
      return;
    }

    aiAnalysisResult = parsed;
    spinnerEl.style.display = 'none';
    statusEl.style.display = 'none';
    resultEl.classList.remove('hidden');

    const severityClass = parsed.severity === 'High' ? 'high' : parsed.severity === 'Medium' ? 'medium' : 'low';
    document.getElementById('aiTags').innerHTML = `
      <span class="ai-tag ai-tag-category">${parsed.category}</span>
      <span class="ai-tag ai-tag-severity-${severityClass}">${parsed.severity} Severity</span>
      <span class="ai-tag ai-tag-severity-${parsed.priority?.includes('High') || parsed.priority?.includes('Emergency') ? 'high' : 'medium'}">${parsed.priority}</span>
    `;
    document.getElementById('aiSummary').textContent = parsed.summary;
    document.getElementById('aiFields').innerHTML = `
      <div class="ai-field-row"><span class="ai-field-key">Department</span><span class="ai-field-val">${parsed.department}</span></div>
      <div class="ai-field-row"><span class="ai-field-key">Est. Resolution</span><span class="ai-field-val">${parsed.estimated_resolution}</span></div>
      <div class="ai-field-row"><span class="ai-field-key">Action Required</span><span class="ai-field-val">${parsed.action_required}</span></div>
    `;
    actionsEl.classList.remove('hidden');

    const location = document.getElementById('issueLocation').value || 'Location not specified';
    const reporter = currentUser?.name || 'Anonymous';
    document.getElementById('confirmCard').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="font-size:15px;font-weight:600;color:var(--text-primary)">${parsed.category}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">${document.getElementById('issueDesc').value}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border-dark)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Severity</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:500">${parsed.severity}</div>
          </div>
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border-dark)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Department</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:500">${parsed.department}</div>
          </div>
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border-dark)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Location</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:500">${location}</div>
          </div>
          <div style="padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--border-dark)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Reporter</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:500">${reporter}</div>
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    clearInterval(msgInterval);
    console.error('Analysis error:', err);
    statusEl.textContent = 'Analysis failed. Please try again.';
    setTimeout(() => { actionsEl.classList.remove('hidden'); }, 1000);
  }
}

async function uploadImageToImgBB(base64Image) {
  if (!base64Image) return null;
  try {
    const base64Data = base64Image.split(',')[1];
    const formData = new FormData();
    formData.append('image', base64Data);
    const response = await fetch('https://api.imgbb.com/1/upload?key=6a123eb0d646a9f1ba017be3304eecda', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) return data.data.url;
    return null;
  } catch (err) {
    console.error('Image upload failed:', err);
    return null;
  }
}

// ── SUBMIT REPORT ──
async function submitReport() {
  if (!document.getElementById('confirmCheck').checked) {
    showToast('Please confirm your report is accurate.', 'error');
    return;
  }

  const category = document.getElementById('issueCategory').value;
  const desc = document.getElementById('issueDesc').value;
  const severity = document.getElementById('issueSeverity').value;
  const location = document.getElementById('issueLocation').value;
  const reporter = currentUser?.name || 'Anonymous';
  const reporterCity = currentUser?.city || 'India';

  let imageUrl = null;
  if (uploadedImageData) {
    showToast('Uploading image...');
    imageUrl = await uploadImageToImgBB(uploadedImageData);
  }

  let reportLat = userLocation?.lat || (28.6139 + (Math.random() - 0.5) * 0.03);
  let reportLng = userLocation?.lng || (77.2090 + (Math.random() - 0.5) * 0.03);

  if (!userLocation && location) {
    const coords = await geocodeLocation(location);
    if (coords) {
      reportLat = coords.lat;
      reportLng = coords.lng;
    }
  }

  const newIssue = {
    title: aiAnalysisResult?.category || category,
    type: category,
    severity,
    status: 'open',
    lat: reportLat,
    lng: reportLng,
    desc,
    votes: 0,
    reporter,
    reporterEmail: currentUser?.email || '',
    time: 'Just now',
    city: reporterCity,
    aiAnalysis: aiAnalysisResult || null,
    createdAt: new Date().toISOString(),
    imageUrl: imageUrl || null
  };

  try {
    const { collection, addDoc } = window.firebaseModules;
    const db = window.firebaseDB;
    await addDoc(collection(db, 'issues'), newIssue);
    applyFilters();
    closeReportModal();
    showToast('Issue reported successfully! Live on the map now 🎉');
    resetForm();
  } catch (err) {
    console.error(err);
    showToast('Failed to submit. Please try again.', 'error');
  }
}

async function loadIssuesFromFirestore() {
  try {
    const { collection, onSnapshot } = window.firebaseModules;
    const db = window.firebaseDB;
    onSnapshot(collection(db, 'issues'), (snapshot) => {
      const firestoreIssues = [];
      snapshot.forEach(doc => {
        firestoreIssues.push({ id: doc.id, ...doc.data() });
      });
      if (firestoreIssues.length > 0) {
        allIssues = [...firestoreIssues, ...SAMPLE_ISSUES];
      }
      if (!nearbyMode) applyFilters();
    });
  } catch (err) {
    console.error('Firestore load error:', err);
  }
}

function resetForm() {
  document.getElementById('issueCategory').value = '';
  document.getElementById('issueDesc').value = '';
  document.getElementById('issueSeverity').value = 'medium';
  document.getElementById('issueLocation').value = '';
  document.getElementById('reporterName').value = '';
  document.getElementById('confirmCheck').checked = false;
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('uploadInner').style.display = 'flex';
  document.getElementById('aiSpinner').style.display = 'flex';
  document.getElementById('aiStatus').style.display = 'block';
  document.getElementById('aiResult').classList.add('hidden');
  document.getElementById('step2Actions').classList.add('hidden');
  uploadedImageData = null;
  aiAnalysisResult = null;
  userLocation = null;
  goToStep(1);
}

// ── TOAST ──
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toastMsg');
  msg.textContent = message;
  toast.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(110,231,183,0.3)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

async function openMyReports() {
  closeDropdown();
  document.getElementById('panelOverlay').classList.remove('hidden');
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById('myReportsPanel').classList.remove('hidden');
  setTimeout(() => document.getElementById('myReportsPanel').classList.add('open'), 10);
  document.body.style.overflow = 'hidden';
  await loadMyReports();
}

function closeMyReports() {
  document.getElementById('myReportsPanel').classList.remove('open');
  document.getElementById('panelOverlay').classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => {
    document.getElementById('myReportsPanel').classList.add('hidden');
    document.getElementById('panelOverlay').classList.add('hidden');
  }, 350);
}

async function loadMyReports() {
  const list = document.getElementById('myReportsList');
  const countEl = document.getElementById('myReportsCount');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Loading...</p>';
  try {
    const { collection, getDocs } = window.firebaseModules;
    const db = window.firebaseDB;
    const snapshot = await getDocs(collection(db, 'issues'));
    const myReports = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.reporterEmail === currentUser?.email) {
        myReports.push({ id: doc.id, ...data });
      }
    });
    countEl.textContent = `${myReports.length} report${myReports.length !== 1 ? 's' : ''} submitted`;
    if (myReports.length === 0) {
      list.innerHTML = `
        <div class="panel-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 10c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 24c-5 0-9.42-2.56-12-6.44.06-3.98 8-6.16 12-6.16s11.94 2.18 12 6.16C33.42 35.44 29 38 24 38z" fill="currentColor"/></svg>
          <p>No reports yet.<br/>Be the first to report an issue!</p>
          <button class="btn-primary" onclick="closeMyReports(); openReportModal()">Report an Issue</button>
        </div>
      `;
      return;
    }
    list.innerHTML = '';
    myReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(report => {
      const statusLabel = report.status === 'progress' ? 'In Progress' : report.status === 'resolved' ? 'Resolved' : 'Open';
      const date = new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      list.innerHTML += `
        <div class="my-report-card">
          <div class="my-report-card-top">
            <span class="my-report-title">${report.title || report.type}</span>
            <span class="my-report-status ${report.status}">${statusLabel}</span>
          </div>
          ${report.imageUrl ? `<img src="${report.imageUrl}" class="my-report-image" alt="Issue photo"/>` : ''}
          <p class="my-report-desc">${report.desc}</p>
<div class="my-report-meta">
  <span>📍 ${report.city || 'India'}</span>
  <span>📅 ${date}</span>
  <span>👍 ${report.votes} votes</span>
</div>
<button onclick="deleteReport('${report.id}')" style="
  margin-top:10px;width:100%;padding:7px;
  background:rgba(239,68,68,0.06);
  border:1px solid rgba(239,68,68,0.2);
  border-radius:6px;font-size:12px;font-weight:500;
  color:#f87171;cursor:pointer;transition:all 0.2s;
" onmouseover="this.style.background='rgba(239,68,68,0.12)'" 
  onmouseout="this.style.background='rgba(239,68,68,0.06)'">
  🗑️ Delete Report
</button>
        </div>
      `;
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#f87171;font-size:13px">Failed to load reports.</p>';
  }
}

function showNearbyReports() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported.', 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition((pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    map.setView([userLat, userLng], 14);
    if (searchCircle) searchCircle.remove();
    searchCircle = L.circle([userLat, userLng], {
      radius: 2000,
      color: '#6ee7b7',
      fillColor: '#6ee7b7',
      fillOpacity: 0.05,
      weight: 1
    }).addTo(map);
    const nearby = allIssues.filter(issue => {
      const dist = Math.sqrt(
        Math.pow((issue.lat - userLat) * 111, 2) +
        Math.pow((issue.lng - userLng) * 111, 2)
      );
      return dist <= 2;
    });
    const limited = nearby.slice(0, 3);
    nearbyMode = true;
    markers.forEach(m => m.remove());
    markers = [];
    if (limited.length === 0) {
      showToast('No Nearby Reports.');
      const container = document.getElementById('recentReportsList');
      container.innerHTML = '<p class="filter-label">Recent Reports</p><p style="font-size:13px;color:var(--text-muted);margin-top:8px">No reports found nearby.</p>';
    } else {
      showToast(`Found ${limited.length} issue${limited.length > 1 ? 's' : ''} near you!`);
      renderMarkers(limited);
      const container = document.getElementById('recentReportsList');
      container.innerHTML = '<p class="filter-label">Nearby Reports</p>';
      limited.forEach(issue => {
        const el = document.createElement('div');
        el.className = 'recent-item';
        el.innerHTML = `
          <div class="recent-item-title">${issue.title}</div>
          <div class="recent-item-meta">
            <span class="status-dot ${issue.status}"></span>
            <span>${issue.type}</span>
            <span>·</span>
            <span>${issue.time}</span>
          </div>
        `;
        el.addEventListener('click', () => map.setView([issue.lat, issue.lng], 16));
        container.appendChild(el);
      });
    }
  }, () => {
    showToast('Location permission denied.', 'error');
  });
}

function resetToAllReports() {
  if (searchCircle) { searchCircle.remove(); searchCircle = null; }
  nearbyMode = false;
  applyFilters();
  renderRecentReports();
  map.setView([28.6139, 77.2090], 13);
  showToast('Showing all reports.');
}

async function searchLocation() {
  const query = document.getElementById('mapSearchInput').value.trim();
  if (!query) { showToast('Please enter a location.', 'error'); return; }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
    const data = await response.json();
    if (!data.length) { showToast('Location not found. Try a different search.', 'error'); return; }
    const { lat, lon, display_name } = data[0];
    const searchLat = parseFloat(lat);
    const searchLng = parseFloat(lon);
    map.setView([searchLat, searchLng], 11
    );
    if (searchCircle) searchCircle.remove();
    searchCircle = L.circle([searchLat, searchLng], {
      radius: 25000,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.05,
      weight: 1
    }).addTo(map);
    const nearby = allIssues.filter(issue => {
      const dist = Math.sqrt(
        Math.pow((issue.lat - searchLat) * 111, 2) +
        Math.pow((issue.lng - searchLng) * 111, 2)
      );
      return dist <= 25;
    });
    nearbyMode = true;
    markers.forEach(m => m.remove());
    markers = [];
    renderMarkers(nearby);
    if (nearby.length === 0) {
      showToast(`No reports found near ${display_name.split(',')[0]}.`);
      const container = document.getElementById('recentReportsList');
      container.innerHTML = '<p class="filter-label">Search Results</p><p style="font-size:13px;color:var(--text-muted);margin-top:8px">No reports found in this area.</p>';
    } else {
      renderMarkers(nearby);
      showToast(`Found ${nearby.length} report${nearby.length > 1 ? 's' : ''} near ${display_name.split(',')[0]}!`);
      const container = document.getElementById('recentReportsList');
      container.innerHTML = `<p class="filter-label">Results: ${display_name.split(',')[0]}</p>`;
      nearby.slice(0, 3).forEach(issue => {
        const el = document.createElement('div');
        el.className = 'recent-item';
        el.innerHTML = `
          <div class="recent-item-title">${issue.title}</div>
          <div class="recent-item-meta">
            <span class="status-dot ${issue.status}"></span>
            <span>${issue.type}</span>
            <span>·</span>
            <span>${issue.time}</span>
          </div>
        `;
        el.addEventListener('click', () => map.setView([issue.lat, issue.lng], 16));
        container.appendChild(el);
      });
    }
  } catch (err) {
    showToast('Search failed. Please try again.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mapSearchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchLocation();
  });
});

let currentDetailIssue = null;

function openReportDetail(issue) {
  currentDetailIssue = issue;
  const statusLabels = { open: 'Open', progress: 'In Progress', resolved: 'Resolved' };
  document.getElementById('detailTitle').textContent = issue.title || issue.type;
  document.getElementById('detailBadges').innerHTML = `
  <span class="detail-badge ${issue.status}">${statusLabels[issue.status] || 'Open'}</span>
  <span class="detail-badge type">${issue.type}</span>
  <span class="detail-badge ${issue.severity}">${issue.severity} severity</span>
  ${issue.escalated ? '<span class="detail-badge escalated">🚨 URGENT — Auto-Escalated</span>' : ''}
`;
  const complaintBtn = document.getElementById('complaintBtn');
  if (issue.escalated) {
    complaintBtn.classList.remove('hidden');
  } else {
    complaintBtn.classList.add('hidden');
  }
  document.getElementById('detailDesc').textContent = issue.desc;
  document.getElementById('detailImage').innerHTML = issue.imageUrl
    ? `<img src="${issue.imageUrl}" alt="Issue photo"/>`
    : '';
  document.getElementById('detailGrid').innerHTML = `
    <div class="detail-grid-item"><div class="detail-grid-key">Department</div><div class="detail-grid-val">${issue.aiAnalysis?.department || 'Municipal Corp'}</div></div>
    <div class="detail-grid-item"><div class="detail-grid-key">Est. Resolution</div><div class="detail-grid-val">${issue.aiAnalysis?.estimated_resolution || 'TBD'}</div></div>
    <div class="detail-grid-item"><div class="detail-grid-key">Location</div><div class="detail-grid-val">${issue.city || 'India'}</div></div>
    <div class="detail-grid-item"><div class="detail-grid-key">Reported</div><div class="detail-grid-val">${issue.time || 'Recently'}</div></div>
  `;
  document.getElementById('detailReporter').innerHTML = `
  <div class="detail-reporter-avatar">${getReporterAvatar(issue)}</div>
    <div>
      <div class="detail-reporter-name">${issue.reporter || 'Anonymous'}</div>
      <div class="detail-reporter-time">Reported ${timeAgo(issue.createdAt)}</div>
    </div>
  `;
  const votes = getVotes(issue.id);
  document.getElementById('upvoteCount').textContent = (currentDetailIssue.votes || 0) + votes.up;
  document.getElementById('downvoteCount').textContent = votes.down;
  const popupUp = document.getElementById(`popup-up-${issue.id}`);
  const popupDown = document.getElementById(`popup-down-${issue.id}`);
  if (popupUp) popupUp.textContent = `✅ ${(currentDetailIssue.votes || 0) + votes.up} True`;
  if (popupDown) popupDown.textContent = `❌ ${votes.down} False`;
  const userVote = getUserVote(issue.id);
  document.getElementById('upvoteBtn').className = `detail-icon-btn ${userVote === 'up' ? 'voted-up' : ''}`;
  document.getElementById('downvoteBtn').className = `detail-icon-btn ${userVote === 'down' ? 'voted-down' : ''}`;

  document.getElementById('upvoteBtn').className = `vote-btn ${userVote === 'up' ? 'voted-up' : ''}`;
  document.getElementById('downvoteBtn').className = `vote-btn ${userVote === 'down' ? 'voted-down' : ''}`;

  const isMyReport = currentUser && currentDetailIssue.reporterEmail === currentUser.email;
  const statusUpdateEl = document.getElementById('detailStatusUpdate');
  if (isMyReport && issue.status !== 'resolved') {
    statusUpdateEl.classList.remove('hidden');
  } else {
    statusUpdateEl.classList.add('hidden');
  }

  document.getElementById('reportDetailModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReportDetail() {
  document.getElementById('reportDetailModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('reportDetailModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeReportDetail();
});

function getVotes(issueId) {
  const votes = JSON.parse(localStorage.getItem(`votes_${issueId}`) || '{"up":0,"down":0}');
  return votes;
}

function getUserVote(issueId) {
  return localStorage.getItem(`uservote_${issueId}`) || null;
}

function handleVote(type) {
  if (!currentUser) { showToast('Please sign in to vote.', 'error'); return; }
  const id = currentDetailIssue?.id;
  if (!id) return;
  const prev = getUserVote(id);
  const votes = getVotes(id);
  if (prev === type) {
    votes[type] = Math.max(0, votes[type] - 1);
    localStorage.removeItem(`uservote_${id}`);
  } else {
    if (prev) votes[prev] = Math.max(0, votes[prev] - 1);
    votes[type]++;
    localStorage.setItem(`uservote_${id}`, type);
  }
  localStorage.setItem(`votes_${id}`, JSON.stringify(votes));
  const userVote = getUserVote(id);
  document.getElementById('upvoteCount').textContent = (currentDetailIssue.votes || 0) + votes.up;
  document.getElementById('downvoteCount').textContent = votes.down;
  document.getElementById('upvoteBtn').className = `detail-icon-btn ${userVote === 'up' ? 'voted-up' : ''}`;
  document.getElementById('downvoteBtn').className = `detail-icon-btn ${userVote === 'down' ? 'voted-down' : ''}`;
  const popupUp = document.getElementById(`popup-up-${id}`);
  const popupDown = document.getElementById(`popup-down-${id}`);
  if (popupUp) popupUp.textContent = `▲ ${(currentDetailIssue.votes || 0) + votes.up} True`;
  if (popupDown) popupDown.textContent = `▼ ${votes.down} False`;
  if (getUserVote(id) === 'up' && currentDetailIssue.reporterEmail !== currentUser?.email) {
    checkNotifications();
    checkAutoEscalation(currentDetailIssue);
  }
}

function shareReport() {
  const url = window.location.href;
  const text = `Check out this issue: ${currentDetailIssue?.title} — reported on FixMyLocal\n${url}`;
  if (navigator.share) {
    navigator.share({ title: 'FixMyLocal Report', text, url });
  } else {
    navigator.clipboard.writeText(url);
    showToast('Link copied to clipboard! 📋');
  }
}

let editAvatarData = null;

function openEditProfile() {
  closeDropdown();
  const editAvatarPreview = document.getElementById('editAvatarPreview');
  document.getElementById('editName').value = currentUser?.name || '';
  document.getElementById('editCity').value = currentUser?.city || '';
  editAvatarData = null;
  if (currentUser?.customAvatar) {
    editAvatarPreview.innerHTML = `<img src="${currentUser.customAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  } else {
    editAvatarPreview.innerHTML = AVATARS[currentUser?.avatar] || currentUser?.name?.[0]?.toUpperCase();
  }
  document.querySelectorAll('#editAvatarPicker .avatar-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.avatar === currentUser?.avatar);
  });
  document.getElementById('editProfileModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditProfile() {
  document.getElementById('editProfileModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('editProfileModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeEditProfile();
});

function selectEditAvatar(key, btn) {
  editAvatarData = null;
  document.querySelectorAll('#editAvatarPicker .avatar-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('editAvatarPreview').innerHTML = AVATARS[key];
  currentUser.avatar = key;
  currentUser.customAvatar = null;
}

function handleEditAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    editAvatarData = e.target.result;
    document.getElementById('editAvatarPreview').innerHTML = `<img src="${editAvatarData}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    document.querySelectorAll('#editAvatarPicker .avatar-opt').forEach(b => b.classList.remove('active'));
  };
  reader.readAsDataURL(file);
}

function handleSignupAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    selectedAvatar = 'custom';
    window.customAvatarData = e.target.result;
    document.getElementById('signupAvatarCustomPreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    document.querySelectorAll('#avatarPicker .avatar-opt').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-avatar="custom"]').classList.add('active');
  };
  reader.readAsDataURL(file);
}

async function saveProfile() {
  const name = document.getElementById('editName').value.trim();
  const city = document.getElementById('editCity').value.trim();
  if (!name) { document.getElementById('editProfileError').textContent = 'Name cannot be empty.'; document.getElementById('editProfileError').classList.remove('hidden'); return; }
  let customAvatar = currentUser.customAvatar || null;
  if (editAvatarData) {
    const uploaded = await uploadImageToImgBB(editAvatarData);
    if (uploaded) customAvatar = uploaded;
  }
  const updated = { ...currentUser, name, city, customAvatar };
  const users = getUsers().map(u => u.email === currentUser.email ? { ...u, name, city, customAvatar } : u);
  saveUsers(users);
  saveSession(updated);

try {
  const { collection, getDocs, doc, updateDoc, setDoc } = window.firebaseModules;
  const db = window.firebaseDB;
  const snapshot = await getDocs(collection(db, 'users'));
  let found = false;
  snapshot.forEach((docSnap) => {
    if (docSnap.data().email === currentUser.email) found = true;
  });
  if (found) {
    const promises = [];
    snapshot.forEach((docSnap) => {
      if (docSnap.data().email === currentUser.email) {
        promises.push(updateDoc(doc(db, 'users', docSnap.id), { name, city, customAvatar }));
      }
    });
    await Promise.all(promises);
  } else {
    const uid = window.firebaseAuth.currentUser?.uid;
    if (uid) {
      await setDoc(doc(db, 'users', uid), {
        name, email: currentUser.email, avatar: currentUser.avatar,
        customAvatar, city, createdAt: Date.now()
      });
    }
  }
} catch (err) {
  console.error('Profile update error:', err);
}
  closeEditProfile();
  showToast('Profile updated! ✨');
}

async function geocodeLocation(locationText) {
  if (!locationText) return null;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText)}&limit=1`);
    const data = await response.json();
    if (data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch {
    return null;
  }
}

function shareLocation() {
  if (!currentDetailIssue) return;
  const lat = currentDetailIssue.lat;
  const lng = currentDetailIssue.lng;
  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  if (navigator.share) {
    navigator.share({
      title: `Issue Location: ${currentDetailIssue.title}`,
      text: `View this reported issue on Google Maps`,
      url: googleMapsUrl
    });
  } else {
    navigator.clipboard.writeText(googleMapsUrl);
    showToast('Google Maps link copied! 📍');
  }
}

function getReporterAvatar(issue) {
  const localUsers = getUsers();
  const user = localUsers.find(u => u.email === issue.reporterEmail);
  if (user?.customAvatar) {
    return `<img src="${user.customAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  } else if (user?.avatar && AVATARS[user.avatar]) {
    return AVATARS[user.avatar];
  }
  return issue.reporter?.[0]?.toUpperCase() || 'A';
}

function timeAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'light') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('fml_theme', 'dark');
    document.getElementById('themeLabel').textContent = 'Light Mode';
    document.getElementById('themeIcon').innerHTML = '<path d="M7.5 1v1M7.5 13v1M1 7.5H2M13 7.5h1M3 3l.7.7M11.3 11.3l.7.7M3 12l.7-.7M11.3 3.7l.7-.7M10 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('fml_theme', 'light');
    document.getElementById('themeLabel').textContent = 'Dark Mode';
    document.getElementById('themeIcon').innerHTML = '<path d="M12 7.5A4.5 4.5 0 0 1 7.5 12 4.5 4.5 0 0 1 3 7.5 4.5 4.5 0 0 1 7.5 3c-.9 1.8-.9 4.2 0 6a4.5 4.5 0 0 0 4.5-1.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  closeDropdown();
}

function loadTheme() {
  const saved = localStorage.getItem('fml_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const label = document.getElementById('themeLabel');
    const icon = document.getElementById('themeIcon');
    if (label) label.textContent = 'Dark Mode';
    if (icon) icon.innerHTML = '<path d="M12 7.5A4.5 4.5 0 0 1 7.5 12 4.5 4.5 0 0 1 3 7.5 4.5 4.5 0 0 1 7.5 3c-.9 1.8-.9 4.2 0 6a4.5 4.5 0 0 0 4.5-1.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
  }
}

async function updateReportStatus(newStatus) {
  if (!currentDetailIssue || !currentUser) return;
  try {
    const { doc, updateDoc } = window.firebaseModules;
    const db = window.firebaseDB;
    await updateDoc(doc(db, 'issues', currentDetailIssue.id), { status: newStatus });
    currentDetailIssue.status = newStatus;
    const statusLabels = { open: 'Open', progress: 'In Progress', resolved: 'Resolved' };
    const statusColors = { open: '#ef4444', progress: '#f59e0b', resolved: '#6ee7b7' };
    document.getElementById('detailBadges').querySelector('.detail-badge').className = `detail-badge ${newStatus}`;
    document.getElementById('detailBadges').querySelector('.detail-badge').textContent = statusLabels[newStatus];
    if (newStatus === 'resolved') {
      document.getElementById('detailStatusUpdate').classList.add('hidden');
    }
    allIssues = allIssues.map(i => i.id === currentDetailIssue.id ? { ...i, status: newStatus } : i);
    applyFilters();
    showToast(`Report marked as ${statusLabels[newStatus]}! ✅`);
  } catch (err) {
    console.error(err);
    showToast('Failed to update status.', 'error');
  }
}

async function checkNotifications() {
  if (!currentUser) return;
  try {
    const { collection, getDocs } = window.firebaseModules;
    const db = window.firebaseDB;
    const snapshot = await getDocs(collection(db, 'issues'));
    let totalVotes = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.reporterEmail === currentUser.email) {
        totalVotes += data.votes || 0;
      }
    });
    const lastSeen = parseInt(localStorage.getItem(`fml_lastseen_${currentUser.email}`) || '0');
    if (totalVotes > lastSeen) {
      document.getElementById('notifBadge')?.classList.remove('hidden');
      document.getElementById('notifBadgeMobile')?.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
  }
}

function showDeleteConfirm() {
  return new Promise((resolve) => {
    document.getElementById('deleteConfirmModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('deleteConfirmYes').onclick = () => {
      document.getElementById('deleteConfirmModal').classList.remove('open');
      document.body.style.overflow = '';
      resolve(true);
    };
    document.getElementById('deleteConfirmNo').onclick = () => {
      document.getElementById('deleteConfirmModal').classList.remove('open');
      document.body.style.overflow = '';
      resolve(false);
    };
  });
}

async function deleteReport(reportId) {
  const confirmed = await showDeleteConfirm();
  if (!confirmed) return;
  try {
    const { doc, deleteDoc } = window.firebaseModules;
    const db = window.firebaseDB;
    await deleteDoc(doc(db, 'issues', reportId));
    allIssues = allIssues.filter(i => i.id !== reportId);
    applyFilters();
    await loadMyReports();
    await renderLeaderboard();
    showToast('Report deleted successfully.');
  } catch (err) {
    console.error(err);
    showToast('Failed to delete report.', 'error');
  }
}

// ── CHATBOT ──
let chatOpen = false;
let chatHistory = [];

function toggleChat() {
  chatOpen = !chatOpen;
  const win = document.getElementById('chatWindow');
  const notif = document.getElementById('chatNotif');
  win.classList.toggle('hidden', !chatOpen);
  if (chatOpen) {
    notif.style.display = 'none';
    document.getElementById('chatInput').focus();
  }
}

function sendSuggestion(btn) {
  const text = btn.textContent;
  document.getElementById('chatSuggestions').style.display = 'none';
  addChatMessage(text, 'user');
  getChatResponse(text);
}

function addChatMessage(text, role) {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = text.replace(/\n/g, '<br/>');
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function showTyping() {
  const messages = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg ai typing';
  div.id = 'typingIndicator';
  div.innerHTML = '<span></span><span></span><span></span>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  document.getElementById('typingIndicator')?.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  document.getElementById('chatSuggestions')?.remove();
  addChatMessage(text, 'user');
  getChatResponse(text);
}

async function getChatResponse(userMessage) {
  showTyping();
  try {
    const issueStats = getChatContext();
    const systemPrompt = `You are FixMyLocal AI, the official AI assistant for FixMyLocal — a hyperlocal civic issue reporting platform for India. Always refer to the platform by its name "FixMyLocal" in all responses..

Current platform data:
${issueStats}

Rules:
- Never greet with Namaste or Hello in every response — only greet once at start
- Answer directly and concisely
- Never use markdown stars ** or ## for formatting — use plain text only
- Use numbers and dashes for lists like: 1. item or - item
- Keep responses under 80 words unless detailed breakdown needed
- Always use the actual data provided above to answer questions accurately
- If asked about a specific city, check the cities list carefully`;

    chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    const messages = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood! I am FixMyLocal AI assistant ready to help with civic issue queries.' }] },
      ...chatHistory
    ];

    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, systemPrompt })
    });
    const data = await response.json();
    const reply = data.reply || 'Sorry, I could not process that. Please try again!';

    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    removeTyping();
    addChatMessage(reply, 'ai');
  } catch (err) {
    removeTyping();
    addChatMessage('Sorry, I am having trouble connecting. Please try again in a moment!', 'ai');
  }
}

function getChatContext() {
  const total = allIssues.length;
  const open = allIssues.filter(i => i.status === 'open').length;
  const resolved = allIssues.filter(i => i.status === 'resolved').length;
  const progress = allIssues.filter(i => i.status === 'progress').length;
  const byType = {};
  allIssues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const byCity = {};
  allIssues.forEach(i => { byCity[i.city] = (byCity[i.city] || 0) + 1; });
  const topCity = Object.entries(byCity).sort((a, b) => b[1] - a[1])[0];
  const cityBreakdown = Object.entries(byCity).map(([city, count]) => `${city}: ${count}`).join(', ');
  return `
- Total issues reported: ${total}
- Open issues: ${open}
- In Progress: ${progress}  
- Resolved: ${resolved}
- Resolution rate: ${Math.round((resolved / total) * 100)}%
- Most common issue type: ${topType?.[0]} (${topType?.[1]} reports)
- Most active city: ${topCity?.[0]} (${topCity?.[1]} reports)
- All cities with report counts: ${cityBreakdown}
- All issues list: ${allIssues.map(i => `${i.title} in ${i.city} (${i.status})`).join('; ')}
  `;
}

function openCityReport() {
  const cities = [...new Set(allIssues.map(i => i.city).filter(Boolean))];
  const select = document.getElementById('cityReportCity');
  select.innerHTML = '<option value="all">All Cities</option>';
  cities.forEach(city => {
    select.innerHTML += `<option value="${city}">${city}</option>`;
  });
  document.getElementById('cityReportSelect').classList.remove('hidden');
  document.getElementById('cityReportContent').classList.add('hidden');
  document.getElementById('cityReportLoading').classList.add('hidden');
  document.getElementById('cityReportActions').classList.add('hidden');
  document.getElementById('cityReportModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCityReport() {
  document.getElementById('cityReportModal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cityReportModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCityReport();
});

async function generateCityReport() {
  const city = document.getElementById('cityReportCity').value;
  const issues = city === 'all' ? allIssues : allIssues.filter(i => i.city === city);

  if (issues.length === 0) {
    showToast('No issues found for this city.', 'error');
    return;
  }

  document.getElementById('cityReportSelect').classList.add('hidden');
  document.getElementById('cityReportLoading').classList.remove('hidden');
  document.getElementById('cityReportSubtitle').textContent = `${city === 'all' ? 'All Cities' : city} — Generated by Gemini AI`;

  const open = issues.filter(i => i.status === 'open').length;
  const resolved = issues.filter(i => i.status === 'resolved').length;
  const progress = issues.filter(i => i.status === 'progress').length;
  const byType = {};
  issues.forEach(i => { byType[i.type] = (byType[i.type] || 0) + 1; });
  const issueList = issues.map(i => `- ${i.title} (${i.type}, ${i.severity} severity, ${i.status})`).join('\n');

  const prompt = `You are a civic analyst. Generate a professional city infrastructure report based on this data.

City: ${city === 'all' ? 'All Cities Combined' : city}
Total Issues: ${issues.length}
Open: ${open} | In Progress: ${progress} | Resolved: ${resolved}
Resolution Rate: ${Math.round((resolved / issues.length) * 100)}%

Issue Breakdown by Type:
${Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

All Issues:
${issueList}

Write a structured report with these sections:
1. Executive Summary (2-3 sentences)
2. Key Findings (3-4 bullet points)
3. Critical Issues Requiring Immediate Attention
4. Resolution Performance Analysis
5. Recommendations for City Administration (3 specific actionable steps)

Use plain text, no markdown stars or hashtags. Keep it professional and under 300 words.`;

  try {
    const response = await fetch(`${BACKEND_URL}/city-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    const report = data.report || 'Failed to generate report.';
    document.getElementById('cityReportLoading').classList.add('hidden');
    document.getElementById('cityReportContent').classList.remove('hidden');
    document.getElementById('cityReportContent').textContent = report;
    document.getElementById('cityReportActions').classList.remove('hidden');
    document.getElementById('cityReportActions').style.display = 'flex';
  } catch (err) {
    document.getElementById('cityReportLoading').classList.add('hidden');
    showToast('Failed to generate report. Try again.', 'error');
    closeCityReport();
  }
}

function copyCityReport() {
  const content = document.getElementById('cityReportContent').textContent;
  navigator.clipboard.writeText(content);
  showToast('Report copied to clipboard! 📋');
}

async function checkAutoEscalation(issue) {
  const votes = (issue.votes || 0) + getVotes(issue.id).up;
  if (votes >= 5 && issue.status === 'open' && !issue.escalated) {
    try {
      const { doc, updateDoc } = window.firebaseModules;
      const db = window.firebaseDB;
      if (issue.id && typeof issue.id === 'string') {
        await updateDoc(doc(db, 'issues', issue.id), { escalated: true, priority: 'URGENT' });
      }
      issue.escalated = true;
      issue.priority = 'URGENT';
      showToast(`🚨 Issue "${issue.title}" auto-escalated to URGENT!`);
    } catch (err) {
      console.error(err);
    }
  }
}

async function generateComplaintLetter() {
  closeReportDetail();
  document.getElementById('complaintModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('complaintLoading').classList.remove('hidden');
  document.getElementById('complaintContent').classList.add('hidden');
  document.getElementById('complaintActions').classList.add('hidden');

  const issue = currentDetailIssue;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const votes = (issue.votes || 0) + getVotes(issue.id).up;

  const prompt = `Write a formal official complaint letter from a citizen to the relevant government authority about a civic infrastructure issue.

Issue Details:
- Title: ${issue.title}
- Type: ${issue.type}
- Location: ${issue.city}
- Description: ${issue.desc}
- Severity: ${issue.severity}
- Community Votes (verified by citizens): ${votes}
- Department: ${issue.aiAnalysis?.department || 'Municipal Corporation'}
- Date Reported: ${new Date(issue.createdAt).toLocaleDateString('en-IN')}
- Today's Date: ${today}

Write a professional formal complaint letter in English with:
- Proper salutation to the department head
- Clear description of the issue and its impact on citizens
- Mention that ${votes} citizens have verified this issue
- Request for immediate action within 48 hours given the severity
- Professional closing

Use plain text only, no markdown. Keep it under 250 words. Make it sound like a real official complaint.`;

  try {
    const response = await fetch(`${BACKEND_URL}/complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    const letter = data.letter || 'Failed to generate letter.';
    document.getElementById('complaintLoading').classList.add('hidden');
    document.getElementById('complaintContent').classList.remove('hidden');
    document.getElementById('complaintContent').value = letter;
    document.getElementById('complaintActions').classList.remove('hidden');
    document.getElementById('complaintActions').style.display = 'flex';
  } catch (err) {
    document.getElementById('complaintLoading').classList.add('hidden');
    showToast('Failed to generate letter. Try again.', 'error');
    closeComplaintModal();
  }
}

function closeComplaintModal() {
  document.getElementById('complaintModal').classList.remove('open');
  document.body.style.overflow = '';
}

function copyComplaintLetter() {
  const content = document.getElementById('complaintContent').value;
  navigator.clipboard.writeText(content);
  showToast('Complaint letter copied! 📋');
}

function shareComplaintLetter() {
  const content = document.getElementById('complaintContent').value;
  if (navigator.share) {
    navigator.share({ title: 'Civic Complaint Letter', text: content });
  } else {
    navigator.clipboard.writeText(content);
    showToast('Letter copied to clipboard! 📋');
  }
}

document.getElementById('complaintModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeComplaintModal();
});
