import { 
  auth, db, storage, googleProvider,
  signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence,
  collection, getDocs, doc, getDoc, setDoc, updateDoc, addDoc,
  ref, uploadBytesResumable, getDownloadURL
} from './firebase-config.js';

// DOM Auth
const authCheckLoader = document.getElementById('auth-check-loader');
const loginOverlay = document.getElementById('login-overlay');
const btnLogin = document.getElementById('btn-login');
const btnLoginLarge = document.getElementById('btn-login-large');
const btnCloseLogin = document.getElementById('btn-close-login');
const btnLogout = document.getElementById('btn-logout');
const userMenu = document.getElementById('user-menu');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');

// Views
const allViews = document.querySelectorAll('.main-view');

// UI Elements
const courseGrid = document.getElementById('course-grid');
const courseOutline = document.getElementById('course-outline');
const currentLectureTitle = document.getElementById('current-lecture-title');
const lectureDescription = document.getElementById('lecture-description');
const resourceContainer = document.getElementById('resource-container');
const btnDownloadDoc = document.getElementById('btn-download-doc');
const btnMarkDone = document.getElementById('btn-mark-done');
const textMarkDone = document.getElementById('text-mark-done');
const progressBarFill = document.getElementById('progress-bar');
const progressPercentText = document.getElementById('progress-percent');
const notebookTextarea = document.getElementById('notebook-textarea');
const saveIndicator = document.getElementById('save-indicator');
const btnExportPdf = document.getElementById('btn-export-pdf');

// Stats Elements
const statLearning = document.getElementById('stat-learning');
const statHours = document.getElementById('stat-hours');
const statCompletedLectures = document.getElementById('stat-completed-lectures');
const statXp = document.getElementById('stat-xp');
const leaderboardContainer = document.getElementById('leaderboard-container');

// State
let currentUser = null;
let allCourses = [];
let currentCourse = null;
let currentLecture = null;
let activeLectureId = null;
let pendingLecture = null;
let ytPlayer = null;
let ytPlayerReady = false;
let isPlayerInitialized = false;

// userProgress structure:
// {
//    totalWatchSeconds: 0,
//    courses: { courseId: { completedLectures: [], videoPositions: {}, notes: {}, badges: [] } }
// }
let userProgress = { totalWatchSeconds: 0, courses: {} };

// Helper Toast
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const icon = toast.querySelector('i');
  msgEl.textContent = msg;
  icon.setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle');
  icon.className = isError ? 'text-red-500 w-5 h-5' : 'text-green-500 w-5 h-5';
  lucide.createIcons();
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

// ----------------------------------------------------
// UI NAVIGATION
// ----------------------------------------------------
window.changeMainView = (viewId, element = null) => {
  // Pause video if moving away
  if (viewId !== 'view-learning' && ytPlayer && isPlayerInitialized) {
    ytPlayer.pauseVideo();
  }

  // Update sidebar active state
  if (element) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
      el.classList.remove('active', 'text-main');
      el.classList.add('text-muted');
    });
    element.classList.add('active', 'text-main');
    element.classList.remove('text-muted');
  }

  // Hide all views (flow layout — just use hidden)
  allViews.forEach(v => {
    v.classList.add('hidden');
    v.style.opacity = '0';
  });

  // Show target with fade-in
  const target = document.getElementById(viewId);
  if (!target) return;
  target.classList.remove('hidden');
  // Scroll container to top
  const container = document.getElementById('main-views-container');
  if (container) container.scrollTop = 0;
  requestAnimationFrame(() => {
    target.style.opacity = '1';
  });

  // Load contextual data
  if(viewId === 'view-news') loadNews();
  if(viewId === 'view-docs') loadDocs();
  if(viewId === 'view-discovery') loadDiscovery();
  if(viewId === 'view-qa') loadQA();
  if(viewId === 'view-dashboard') renderCourseGrid();
  if(viewId === 'view-profile') loadProfile();

  // Sync Mobile Bottom Nav active state
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.removeAttribute('data-active');
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
      btn.setAttribute('data-active', 'true');
    }
  });
};


// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
// Set localStorage persistence on page load so user stays logged in
(async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch(e) {
    console.warn('setPersistence error:', e);
  }
})();

loadCourses();
loadLeaderboard(); // Global fetch for dashboard

onAuthStateChanged(auth, async (user) => {
  authCheckLoader.classList.add('opacity-0');
  setTimeout(() => authCheckLoader.classList.add('hidden'), 300);

  if (user) {
    const isAllowed = await checkWhitelist(user.email);
    if (!isAllowed) {
      alert("Tài khoản của bạn đã hết hạn hoặc chưa được cấp quyền.");
      await signOut(auth);
      return;
    }

    currentUser = user;
    updateAuthUI();
    await loadProgress();
    
    if (currentCourse && document.getElementById('view-learning').classList.contains('opacity-100')) {
      renderOutline();
      updateProgressUI();
      if (activeLectureId) loadNotebook(activeLectureId);
    }
    
    if (pendingLecture) {
      goToLearningView(pendingLecture.courseId);
      playLecture(pendingLecture.lecture, pendingLecture.topicTitle);
      pendingLecture = null;
    }

    // Refresh Dashboard Stats
    renderCourseGrid();
    
  } else {
    currentUser = null;
    updateAuthUI();
    userProgress = { totalWatchSeconds: 0, courses: {} };
    renderCourseGrid();
  }
});

async function checkWhitelist(email) {
  if (email.toLowerCase() === 'duongngoclam28022008@gmail.com') return true;
  try {
    const docSnap = await getDoc(doc(db, "allowed_users", email.toLowerCase()));
    if (!docSnap.exists()) return false;
    const data = docSnap.data();
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) return false;
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function updateAuthUI() {
  if (currentUser) {
    btnLogin.classList.add('hidden');
    userMenu.classList.remove('hidden');
    userInfo.textContent = currentUser.email.split('@')[0];
    userAvatar.textContent = currentUser.email[0].toUpperCase();
    loginOverlay.classList.remove('opacity-100');
    setTimeout(() => loginOverlay.classList.add('hidden'), 300);
  } else {
    btnLogin.classList.remove('hidden');
    userMenu.classList.add('hidden');
  }
}

const handleLogin = async () => {
  try {
    const btnText = btnLoginLarge.innerHTML;
    btnLoginLarge.innerHTML = '<div class="loader !w-5 !h-5 !border-2"></div>';
    await signInWithPopup(auth, googleProvider);
    btnLoginLarge.innerHTML = btnText;
  } catch (error) {
    alert("Lỗi đăng nhập: " + error.message);
  }
};

btnLogin.addEventListener('click', handleLogin);
btnLoginLarge.addEventListener('click', handleLogin);
btnLogout.addEventListener('click', () => signOut(auth));
btnCloseLogin.addEventListener('click', () => {
  loginOverlay.classList.remove('opacity-100');
  setTimeout(() => loginOverlay.classList.add('hidden'), 300);
  pendingLecture = null;
});

// ----------------------------------------------------
// COURSES & STATS
// ----------------------------------------------------
async function loadCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    allCourses = [];
    snap.forEach(d => {
      const data = d.data(); data.id = d.id;
      allCourses.push(data);
    });
    renderCourseGrid();
  } catch (e) { console.error(e); }
}

async function loadProgress() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, "progress", currentUser.email));
    if (snap.exists()) {
      const data = snap.data();
      userProgress.totalWatchSeconds = data.totalWatchSeconds || 0;
      userProgress.courses = data.courses || {};
    }
  } catch (e) { console.error(e); }
}

async function saveProgressToServer() {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "progress", currentUser.email), userProgress, { merge: true });
  } catch (e) { console.error(e); }
}

function renderCourseGrid() {
  const dashGrid = document.getElementById('dashboard-course-grid');
  const myGrid = document.getElementById('my-courses-grid');
  
  if (dashGrid) dashGrid.innerHTML = '';
  if (myGrid) myGrid.innerHTML = '';

  if (allCourses.length === 0) {
    if(dashGrid) dashGrid.innerHTML = '<p class="text-muted">Chưa có khóa học nào.</p>';
    if(myGrid) myGrid.innerHTML = '<p class="text-muted col-span-full text-center">Chưa có khóa học nào.</p>';
    return;
  }

  let activeCoursesCount = 0;
  let totalCompletedLectures = 0;
  
  // Sort courses: Active ones first, then others
  let sortedCourses = [...allCourses].sort((a, b) => {
    let pA = userProgress?.courses?.[a.id]?.completedLectures?.length || 0;
    let pB = userProgress?.courses?.[b.id]?.completedLectures?.length || 0;
    return pB - pA;
  });

  // Calculate global stats
  sortedCourses.forEach(course => {
    if (currentUser && userProgress.courses[course.id]) {
      const pData = userProgress.courses[course.id];
      if (pData.completedLectures && pData.completedLectures.length > 0) activeCoursesCount++;
      totalCompletedLectures += (pData.completedLectures ? pData.completedLectures.length : 0);
    }
  });

  // Function to generate card HTML
  const generateCardHtml = (course, idx, isGrid) => {
    let hasFreeTrial = false;
    let totalLec = 0;
    if (course.topics) {
      course.topics.forEach(t => {
        if(t.lectures) {
          totalLec += t.lectures.length;
          t.lectures.forEach(l => { if(l.isFreeTrial) hasFreeTrial = true; });
        }
      });
    }

    const thumb = course.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';
    
    let pData = { completedLectures: [] };
    if (currentUser && userProgress.courses[course.id]) {
      pData = userProgress.courses[course.id];
    }
    const percent = totalLec === 0 ? 0 : Math.round((pData.completedLectures.length / totalLec) * 100);

    const card = document.createElement('div');
    // Dashboard uses list layout, My Courses uses grid layout
    card.className = isGrid 
      ? `bg-card p-4 rounded-3xl border border-theme hover:-translate-y-2 transition-all duration-300 cursor-pointer stagger-item flex flex-col gap-4 relative group shadow-sm hover:shadow-xl`
      : `bg-card p-4 rounded-3xl border border-theme hover:-translate-y-2 transition-all duration-300 cursor-pointer stagger-item flex flex-col sm:flex-row gap-5 relative group shadow-sm hover:shadow-xl`;
    
    card.style.animationDelay = `${idx * 0.1}s`;
    
    card.innerHTML = `
      <div class="absolute inset-0 rounded-3xl bg-gradient-to-r ${percent === 100 ? 'from-green-400 to-emerald-500' : 'from-blue-400 to-indigo-500'} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
      <div class="absolute inset-[-1px] rounded-3xl bg-gradient-to-r ${percent === 100 ? 'from-green-500 to-emerald-500' : 'from-blue-500 to-indigo-500'} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm"></div>
      <div class="absolute inset-0 rounded-3xl bg-card transition-colors duration-300 -z-0"></div>

      <div class="${isGrid ? 'h-40 w-full' : 'h-32 sm:w-48 shrink-0'} relative rounded-2xl overflow-hidden group-hover:shadow-lg transition-shadow z-10">
        <img src="${thumb}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" alt="">
        <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500"></div>
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-50 group-hover:scale-100">
          <div class="w-12 h-12 bg-white/90 backdrop-blur-sm text-blue-600 rounded-full flex items-center justify-center shadow-xl">
            <i data-lucide="play" class="w-6 h-6 ml-1"></i>
          </div>
        </div>
        ${hasFreeTrial ? '<div class="absolute top-2 left-2 bg-gradient-to-r from-orange-400 to-orange-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg uppercase tracking-wider">Học thử</div>' : ''}
        ${percent === 100 ? '<div class="absolute top-2 right-2 bg-gradient-to-r from-green-400 to-green-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg uppercase tracking-wider"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> Hoàn thành</div>' : ''}
      </div>
      
      <div class="flex-1 flex flex-col justify-between py-1 z-10">
        <div>
          <h3 class="font-black text-lg text-main mb-1.5 group-hover:text-blue-500 transition-colors line-clamp-2">${course.title}</h3>
          <div class="flex items-center gap-4 text-xs text-muted mb-3 font-semibold">
            <span class="flex items-center gap-1 bg-blue-500/10 text-blue-600 px-2 py-1 rounded-md"><i data-lucide="play-circle" class="w-4 h-4"></i> ${totalLec} Bài giảng</span>
          </div>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-theme group-hover:border-blue-500/30 transition-colors mt-auto">
          <div class="flex justify-between text-[11px] font-bold mb-2">
            <span class="text-muted uppercase tracking-wider flex items-center gap-1"><i data-lucide="target" class="w-3 h-3"></i> Tiến độ học</span>
            <span class="${percent === 100 ? 'text-green-500' : 'text-blue-500'} font-black">${percent}%</span>
          </div>
          <div class="progress-bar-container bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div class="progress-bar-fill w-0 ${percent === 100 ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'} h-full rounded-full transition-all duration-1000 ease-out" style="width: ${percent}%"></div>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      goToLearningView(course.id);
    });
    
    // Set dataset for filtering
    card.dataset.title = course.title.toLowerCase();
    card.dataset.progress = percent;
    card.dataset.status = percent === 100 ? 'completed' : (percent > 0 ? 'in_progress' : 'not_started');

    lucide.createIcons({ root: card });
    return card;
  };

  // Render Dashboard Top 2 Courses
  if (dashGrid) {
    const top2 = sortedCourses.slice(0, 2);
    if(top2.length > 0) {
      top2.forEach((course, idx) => {
        dashGrid.appendChild(generateCardHtml(course, idx, false));
      });
    } else {
      dashGrid.innerHTML = '<p class="text-muted">Bạn chưa học khóa nào.</p>';
    }
  }

  // Render All Courses to My Courses Grid
  if (myGrid) {
    sortedCourses.forEach((course, idx) => {
      myGrid.appendChild(generateCardHtml(course, idx, true));
    });
  }

  // Setup Filtering for My Courses
  const searchInput = document.getElementById('my-courses-search');
  const filterSelect = document.getElementById('my-courses-filter');
  
  const filterCourses = () => {
    if(!myGrid) return;
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const status = filterSelect ? filterSelect.value : 'all';
    
    Array.from(myGrid.children).forEach(card => {
      const matchSearch = card.dataset.title.includes(query);
      const matchStatus = status === 'all' || 
                          (status === 'completed' && card.dataset.status === 'completed') || 
                          (status === 'in_progress' && (card.dataset.status === 'in_progress' || card.dataset.status === 'completed'));
      
      if(matchSearch && matchStatus) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  };

  if(searchInput) searchInput.addEventListener('input', filterCourses);
  if(filterSelect) filterSelect.addEventListener('change', filterCourses);

  // Update Stats UI — animated counters
  const hours = parseFloat((userProgress.totalWatchSeconds / 3600).toFixed(1));
  const xp = Math.floor((userProgress.totalWatchSeconds / 3600) * 50) + (totalCompletedLectures * 100);

  // Use animated counter if available (defined in inline script)
  if (typeof window.triggerDashboardCounters === 'function') {
    window.triggerDashboardCounters({ learning: activeCoursesCount, hours, lectures: totalCompletedLectures, xp });
  } else {
    if(statLearning) statLearning.textContent = activeCoursesCount;
    if(statHours) statHours.innerHTML = `${hours}<span class="text-lg text-muted font-medium">h</span>`;
    if(statCompletedLectures) statCompletedLectures.textContent = totalCompletedLectures;
    if(statXp) statXp.textContent = xp;
  }

  lucide.createIcons();
}

async function loadLeaderboard() {
  leaderboardContainer.innerHTML = '<div class="loader mx-auto"></div>';
  try {
    const snap = await getDocs(collection(db, "progress"));
    let users = [];
    snap.forEach(d => {
      const data = d.data();
      let totalLec = 0;
      if (data.courses) {
        Object.values(data.courses).forEach(c => {
          if (c.completedLectures) totalLec += c.completedLectures.length;
        });
      }
      const hours = (data.totalWatchSeconds || 0) / 3600;
      const xp = Math.floor(hours * 50) + (totalLec * 100);
      users.push({ email: d.id, xp: xp });
    });

    users.sort((a, b) => b.xp - a.xp);
    const topUsers = users.slice(0, 5); // top 5
    
    leaderboardContainer.innerHTML = '';
    if(topUsers.length === 0) {
      leaderboardContainer.innerHTML = '<p class="text-muted text-sm">Chưa có ai.</p>';
    }

    topUsers.forEach((u, i) => {
      const isTop1 = i === 0;
      const isTop2 = i === 1;
      const isTop3 = i === 2;
      
      let rankHtml = '';
      let bgHtml = '';
      let borderHtml = 'border border-transparent border-b-theme';
      
      if (isTop1) {
        rankHtml = `<div class="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-white font-black flex items-center justify-center shadow-lg shadow-yellow-500/40 text-lg border-2 border-white dark:border-slate-800">1</div>`;
        bgHtml = `bg-gradient-to-r from-yellow-500/10 to-transparent`;
        borderHtml = `border border-yellow-500/30 shadow-sm`;
      } else if (isTop2) {
        rankHtml = `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white font-black flex items-center justify-center shadow-lg shadow-slate-400/40 text-base border-2 border-white dark:border-slate-800">2</div>`;
      } else if (isTop3) {
        rankHtml = `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-white font-black flex items-center justify-center shadow-lg shadow-orange-500/40 text-base border-2 border-white dark:border-slate-800">3</div>`;
      } else {
        rankHtml = `<div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold flex items-center justify-center text-sm border border-theme">${i+1}</div>`;
      }

      const isOnline = currentUser && u.email === currentUser.email; // Show "online" dot for current user
      const avatarLetter = u.email[0].toUpperCase();
      const avatarClass = isTop1 ? 'golden-aura' : '';

      leaderboardContainer.innerHTML += `
        <div class="flex items-center gap-4 p-3 rounded-2xl ${bgHtml} ${borderHtml} hover:-translate-y-0.5 hover:shadow-md transition-all group">
          <div class="relative">
            ${rankHtml}
            ${isTop1 ? '<div class="absolute -top-2 -right-2 text-yellow-500 animate-bounce"><i data-lucide="crown" class="w-5 h-5 fill-yellow-500"></i></div>' : ''}
            ${isOnline ? '<span class="online-dot" title="Đang online"></span>' : ''}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-black text-main truncate group-hover:text-orange-500 transition-colors">${u.email.split('@')[0]}${isOnline ? ' <span class="text-[10px] text-green-500 font-bold">• online</span>' : ''}</p>
            <p class="text-xs font-bold text-muted mt-0.5 flex items-center gap-1"><i data-lucide="zap" class="w-3 h-3 text-yellow-500"></i> ${u.xp.toLocaleString()} XP</p>
          </div>
        </div>
      `;
    });
    lucide.createIcons();
  } catch (e) {
    console.error(e);
  }
}

// ----------------------------------------------------
// LEARNING VIEW (VIDEO)
// ----------------------------------------------------
function goToLearningView(courseId) {
  currentCourse = allCourses.find(c => c.id === courseId);
  document.getElementById('sidebar-course-title').textContent = currentCourse.title;
  
  // Custom View Change
  window.changeMainView('view-learning');
  
  renderOutline();
  updateProgressUI();
  
  if (!activeLectureId && currentCourse.topics && currentCourse.topics[0] && currentCourse.topics[0].lectures[0]) {
    playLecture(currentCourse.topics[0].lectures[0], currentCourse.topics[0].title);
  }
}

function getCourseProgress(courseId) {
  if (!userProgress.courses[courseId]) {
    userProgress.courses[courseId] = { completedLectures: [], videoPositions: {}, notes: {}, badges: [] };
  }
  return userProgress.courses[courseId];
}

function renderOutline() {
  if (!currentCourse || !currentCourse.topics) return;
  const pData = getCourseProgress(currentCourse.id);
  courseOutline.innerHTML = '';
  
  currentCourse.topics.forEach((topic, tIndex) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-3 border border-theme rounded-2xl overflow-hidden bg-card shadow-sm';
    
    let completedCount = 0;
    const totalLectures = topic.lectures ? topic.lectures.length : 0;
    if (topic.lectures) {
      topic.lectures.forEach(l => { if (pData.completedLectures.includes(l.id)) completedCount++; });
    }

    const header = document.createElement('button');
    header.className = 'w-full px-5 py-3.5 flex justify-between items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors text-left';
    header.innerHTML = `
      <div class="flex-1 pr-3">
        <h4 class="font-bold text-sm text-main leading-tight">${topic.title}</h4>
        <p class="text-xs text-muted mt-1 font-medium">${completedCount}/${totalLectures} hoàn thành</p>
      </div>
      <div class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
        <i data-lucide="chevron-down" class="w-4 h-4 text-muted transition-transform duration-300"></i>
      </div>
    `;
    
    const content = document.createElement('div');
    content.className = 'accordion-content bg-card border-t border-theme border-opacity-50';
    let isTopicActive = false;

    if (topic.lectures && topic.lectures.length > 0) {
      const list = document.createElement('ul');
      list.className = 'py-2 px-1';
      topic.lectures.forEach((lecture) => {
        const isDone = pData.completedLectures.includes(lecture.id);
        const isActive = activeLectureId === lecture.id;
        if (isActive) isTopicActive = true;

        const li = document.createElement('li');
        li.className = `px-4 py-3 flex items-start gap-3 cursor-pointer transition-all duration-300 relative rounded-xl mx-2 mb-1 border ${isActive ? 'bg-primary/10 border-primary/30 shadow-sm' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`;
        
        li.innerHTML = `
          <div class="mt-0.5 shrink-0">
            ${isDone ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-green-500 fill-green-100 dark:fill-green-900"></i>' : (isActive ? '<i data-lucide="play-circle" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-muted"></i>')}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm ${isActive ? 'font-bold text-primary' : 'text-main font-medium'} leading-snug">${lecture.title}</p>
            ${lecture.isFreeTrial ? '<span class="px-1.5 py-0.5 mt-1 inline-block rounded bg-green-100 text-green-700 text-[9px] font-bold uppercase">Học thử</span>' : ''}
          </div>
        `;
        li.addEventListener('click', () => playLecture(lecture, topic.title));
        list.appendChild(li);
      });
      content.appendChild(list);
    }

    header.addEventListener('click', () => {
      content.classList.toggle('open');
      header.querySelector('i').classList.toggle('rotate-180');
    });

    if (isTopicActive || (!activeLectureId && tIndex === 0)) {
      content.classList.add('open');
      header.querySelector('i').classList.add('rotate-180');
    }

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    courseOutline.appendChild(wrapper);
  });
  lucide.createIcons();
}

function playLecture(lecture, topicTitle) {
  if (!lecture.isFreeTrial && !currentUser) {
    pendingLecture = { courseId: currentCourse.id, lecture, topicTitle };
    loginOverlay.classList.remove('hidden');
    setTimeout(() => loginOverlay.classList.remove('opacity-0'), 10);
    return;
  }

  currentLecture = lecture;
  activeLectureId = lecture.id;
  currentLectureTitle.textContent = lecture.title;
  
  lectureDescription.textContent = lecture.description || "Không có mô tả.";
  if (lecture.documentLink) {
    resourceContainer.classList.remove('hidden');
    btnDownloadDoc.href = lecture.documentLink;
  } else {
    resourceContainer.classList.add('hidden');
  }

  loadNotebook(lecture.id);

  if (lecture.youtubeLink) {
    const videoId = extractYouTubeID(lecture.youtubeLink);
    if (videoId) {
      let startAt = 0;
      if (currentUser) {
        const pData = getCourseProgress(currentCourse.id);
        if (pData.videoPositions && pData.videoPositions[lecture.id]) startAt = pData.videoPositions[lecture.id];
      }
      initYTPlayer(videoId, startAt);
    } else {
      showPlayerError("Link Video không hợp lệ");
    }
  } else {
    showPlayerError("Bài giảng này không có video", "video-off");
  }

  renderOutline();
  updateMarkDoneButton();
}

// YT API
window.onYouTubeIframeAPIReady = function() { ytPlayerReady = true; };
function initYTPlayer(videoId, startSeconds = 0) {
  if (!ytPlayerReady) { setTimeout(() => initYTPlayer(videoId, startSeconds), 500); return; }
  document.getElementById('player-placeholder').classList.add('hidden');
  document.getElementById('youtube-player').classList.remove('hidden');

  if (ytPlayer) {
    ytPlayer.loadVideoById({ videoId: videoId, startSeconds: startSeconds });
    return;
  }

  ytPlayer = new YT.Player('youtube-player', {
    videoId: videoId,
    playerVars: { 'autoplay': 1, 'rel': 0, 'modestbranding': 1 },
    events: {
      'onReady': (e) => { isPlayerInitialized = true; if(startSeconds > 0) e.target.seekTo(startSeconds); },
      'onStateChange': (e) => {
        if (e.data == YT.PlayerState.ENDED) { markLectureDone(activeLectureId, true); playNextLecture(); }
      }
    }
  });
}

// Tracking Real Watch Time
setInterval(() => {
  if (currentUser && ytPlayer && isPlayerInitialized && ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
    // 1. Save Position
    const currentTime = Math.floor(ytPlayer.getCurrentTime());
    if (currentTime > 5 && currentCourse && activeLectureId) {
      const pData = getCourseProgress(currentCourse.id);
      if (!pData.videoPositions) pData.videoPositions = {};
      pData.videoPositions[activeLectureId] = currentTime;
    }
    
    // 2. Accumulate Watch Time (5 seconds elapsed)
    if(typeof userProgress.totalWatchSeconds !== 'number') userProgress.totalWatchSeconds = 0;
    userProgress.totalWatchSeconds += 5;
    
    saveProgressToServer(); // Debounce implicitly happens due to interval
  }
}, 5000);

function playNextLecture() {
  if (!currentCourse || !activeLectureId) return;
  let foundCurrent = false; let nextLec = null; let nextTopic = "";
  for (const topic of currentCourse.topics) {
    if (!topic.lectures) continue;
    for (const lec of topic.lectures) {
      if (foundCurrent) { nextLec = lec; nextTopic = topic.title; break; }
      if (lec.id === activeLectureId) foundCurrent = true;
    }
    if (nextLec) break;
  }
  if (nextLec) playLecture(nextLec, nextTopic);
}

function updateMarkDoneButton() {
  if (!currentLecture || !currentUser) { btnMarkDone.disabled = true; return; }
  btnMarkDone.disabled = false;
  const pData = getCourseProgress(currentCourse.id);
  const isDone = pData.completedLectures.includes(currentLecture.id);
  
  if (isDone) {
    btnMarkDone.className = 'btn-secondary !rounded-2xl !py-3 flex flex-col items-center gap-1 min-w-[110px] shrink-0 border-2 bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-800';
    textMarkDone.textContent = "Đã xong";
    btnMarkDone.querySelector('i').setAttribute('data-lucide', 'check-circle-2');
  } else {
    btnMarkDone.className = 'btn-secondary !rounded-2xl !py-3 flex flex-col items-center gap-1 min-w-[110px] shrink-0 border-2 text-muted';
    textMarkDone.textContent = "Hoàn thành";
    btnMarkDone.querySelector('i').setAttribute('data-lucide', 'circle');
  }
  lucide.createIcons();
}

function markLectureDone(lectureId, isDone) {
  if (!currentUser || !currentCourse) return;
  const pData = getCourseProgress(currentCourse.id);
  if (isDone) {
    if (!pData.completedLectures.includes(lectureId)) pData.completedLectures.push(lectureId);
  } else {
    pData.completedLectures = pData.completedLectures.filter(id => id !== lectureId);
  }
  updateMarkDoneButton(); renderOutline(); updateProgressUI(); saveProgressToServer();
}

btnMarkDone.addEventListener('click', () => {
  if (!currentLecture || !currentUser) return;
  const pData = getCourseProgress(currentCourse.id);
  markLectureDone(currentLecture.id, !pData.completedLectures.includes(currentLecture.id));
});

function updateProgressUI() {
  if (!currentCourse) return;
  let totalLec = 0;
  if (currentCourse.topics) currentCourse.topics.forEach(t => totalLec += (t.lectures ? t.lectures.length : 0));
  
  let pData = { completedLectures: [], badges: [] };
  if (currentUser) pData = getCourseProgress(currentCourse.id);
  
  const percent = totalLec === 0 ? 0 : Math.round((pData.completedLectures.length / totalLec) * 100);
  progressBarFill.style.width = `${percent}%`;
  progressPercentText.textContent = `${percent}%`;

  if (currentUser && percent >= 50 && !pData.badges.includes('50_percent')) {
    awardBadge('50_percent', '50% Hoàn Thành', 'Tuyệt vời!'); pData.badges.push('50_percent'); saveProgressToServer();
  } else if (currentUser && percent === 100 && !pData.badges.includes('100_percent')) {
    awardBadge('100_percent', 'Tốt Nghiệp!', 'Chúc mừng bạn!'); pData.badges.push('100_percent'); saveProgressToServer();
  }
}

function awardBadge(id, title, desc) {
  document.getElementById('badge-icon-container').innerHTML = `<svg class="w-full h-full text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15l-2 5l9-5l-9-5l2 5z"/></svg>`;
  document.getElementById('badge-title').textContent = title;
  document.getElementById('badge-desc').textContent = desc;
  document.getElementById('badge-popup').classList.add('show');
  const duration = 3000; const end = Date.now() + duration;
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f97316', '#eab308'] });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f97316', '#eab308'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

// NOTEBOOK
let noteTimeout = null;
function loadNotebook(lectureId) {
  if (!currentUser) { notebookTextarea.value = ""; notebookTextarea.disabled = true; return; }
  notebookTextarea.disabled = false;
  const pData = getCourseProgress(currentCourse.id);
  notebookTextarea.value = (pData.notes && pData.notes[lectureId]) ? pData.notes[lectureId] : "";
}

notebookTextarea.addEventListener('input', (e) => {
  if (!currentUser || !currentCourse || !activeLectureId) return;
  saveIndicator.classList.remove('opacity-100');
  clearTimeout(noteTimeout);
  noteTimeout = setTimeout(() => {
    const pData = getCourseProgress(currentCourse.id);
    if (!pData.notes) pData.notes = {};
    pData.notes[activeLectureId] = e.target.value;
    saveProgressToServer();
    saveIndicator.classList.add('opacity-100');
    setTimeout(() => saveIndicator.classList.remove('opacity-100'), 2000);
  }, 1000);
});

btnExportPdf.addEventListener('click', () => {
  if (!notebookTextarea.value.trim()) { alert("Ghi chú trống"); return; }
  const el = document.createElement('div');
  el.innerHTML = `<h2 style="color: #ea580c;">Khóa học: ${currentCourse.title}</h2><h3>Bài giảng: ${currentLectureTitle.textContent}</h3><hr><p style="white-space:pre-wrap;">${notebookTextarea.value}</p>`;
  html2pdf().from(el).save(`Ghi-chu-${currentLecture.title}.pdf`);
});

function showPlayerError(msg, icon = "alert-triangle") {
  if (ytPlayer && isPlayerInitialized) ytPlayer.stopVideo();
  document.getElementById('youtube-player').classList.add('hidden');
  document.getElementById('player-placeholder').classList.remove('hidden');
  document.getElementById('player-placeholder').innerHTML = `<i data-lucide="${icon}" class="w-16 h-16 mb-4 opacity-50"></i><p class="font-medium text-lg">${msg}</p>`;
  lucide.createIcons();
}
function extractYouTubeID(url) {
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return (match && match[2].length === 11) ? match[2] : null;
}

// ----------------------------------------------------
// MULTI-FEATURES LOADERS (News, Docs, Discovery, QA)
// ----------------------------------------------------
async function loadNews() {
  const c = document.getElementById('news-grid'); c.innerHTML = '<div class="loader mx-auto col-span-full"></div>';
  const snap = await getDocs(collection(db, "news")); c.innerHTML = '';
  if(snap.empty) { c.innerHTML = '<p class="text-muted">Chưa có tin tức.</p>'; return; }
  snap.forEach(d => {
    const data = d.data();
    c.innerHTML += `
      <div class="glass-card bg-card p-0 rounded-2xl overflow-hidden shadow-md hover:-translate-y-1 transition-transform border border-theme">
        ${data.imageUrl ? `<img src="${data.imageUrl}" class="w-full h-40 object-cover">` : '<div class="w-full h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"></div>'}
        <div class="p-5">
          <p class="text-[10px] text-muted font-bold uppercase mb-2">${new Date(data.createdAt).toLocaleDateString('vi-VN')}</p>
          <h3 class="font-bold text-main text-lg mb-2 line-clamp-2">${data.title}</h3>
          <p class="text-sm text-muted line-clamp-3">${data.content}</p>
        </div>
      </div>
    `;
  });
}

async function loadDocs() {
  const c = document.getElementById('docs-list'); c.innerHTML = '<div class="loader mx-auto"></div>';
  const snap = await getDocs(collection(db, "documents_global")); c.innerHTML = '';
  if(snap.empty) { c.innerHTML = '<p class="text-muted">Chưa có tài liệu.</p>'; return; }
  snap.forEach(d => {
    const data = d.data();
    c.innerHTML += `
      <div class="glass-card bg-card p-4 rounded-xl border border-theme flex justify-between items-center hover:border-blue-300 transition-colors">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center glow-blue"><i data-lucide="file-text" class="w-5 h-5"></i></div>
          <div><h4 class="font-bold text-main">${data.title}</h4><p class="text-xs text-muted">Upload: ${new Date(data.createdAt).toLocaleDateString()}</p></div>
        </div>
        <a href="${data.url}" target="_blank" class="btn-primary !px-4 !py-2 text-sm flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Tải file</a>
      </div>
    `;
  });
  lucide.createIcons();
}

async function loadDiscovery() {
  const c = document.getElementById('discovery-grid'); c.innerHTML = '<div class="loader mx-auto col-span-full"></div>';
  const snap = await getDocs(collection(db, "discovery")); c.innerHTML = '';
  if(snap.empty) { c.innerHTML = '<p class="text-muted">Chưa có nội dung.</p>'; return; }
  snap.forEach(d => {
    const data = d.data();
    c.innerHTML += `
      <div class="glass-card bg-card rounded-2xl border border-theme overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
        ${data.imageUrl ? `<img src="${data.imageUrl}" class="w-full h-40 object-cover">` : ''}
        <div class="p-5 flex-1 flex flex-col">
          <h4 class="font-bold text-main mb-2">${data.title}</h4>
          <p class="text-sm text-muted mb-4 flex-1">${data.description}</p>
          <a href="${data.url}" target="_blank" class="text-purple-500 font-bold text-sm hover:underline flex items-center gap-1"><i data-lucide="external-link" class="w-4 h-4"></i> Xem chi tiết</a>
        </div>
      </div>
    `;
  });
  lucide.createIcons();
}

async function loadQA() {
  const c = document.getElementById('qa-feed'); c.innerHTML = '<div class="loader mx-auto"></div>';
  const snap = await getDocs(collection(db, "qa")); c.innerHTML = '';
  
  let count = 0;
  snap.forEach(d => {
    const data = d.data();
    if (!data.isApproved) return; // Chỉ hiện public câu đã duyệt
    count++;
    
    let answersHtml = '';
    if (data.answers && data.answers.length > 0) {
      answersHtml = `
        <div class="mt-4 pt-4 border-t border-theme space-y-3 pl-4 border-l-2 border-orange-400">
          ${data.answers.map(ans => {
            const isAdmin = ans.userEmail === 'duongngoclam28022008@gmail.com';
            return `
            <div class="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl">
              <p class="text-xs font-bold ${isAdmin ? 'text-orange-500' : 'text-main'} flex items-center gap-1 mb-1">
                ${isAdmin ? '<i data-lucide="shield-check" class="w-3 h-3"></i> Admin' : ans.userEmail.split('@')[0]} 
                <span class="text-[10px] font-normal text-muted ml-2">${new Date(ans.createdAt).toLocaleString()}</span>
              </p>
              <p class="text-sm text-main">${ans.answer}</p>
            </div>
          `}).join('')}
        </div>
      `;
    }

    c.innerHTML += `
      <div class="glass-card bg-card p-5 rounded-2xl border border-theme hover:border-orange-200 transition-colors">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xs">${data.userEmail[0].toUpperCase()}</div>
          <div>
            <p class="text-sm font-bold text-main">${data.userEmail.split('@')[0]}</p>
            <p class="text-[10px] text-muted">${new Date(data.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        <p class="text-main font-medium text-sm leading-relaxed mb-4">${data.question}</p>
        ${answersHtml}
        
        <div class="mt-3 pt-3 border-t border-theme">
          <div class="flex gap-2">
            <input type="text" id="reply-input-${d.id}" class="input-glass flex-1 !py-1.5 text-sm" placeholder="Viết bình luận...">
            <button class="bg-slate-100 dark:bg-slate-800 text-main px-3 rounded-xl hover:bg-slate-200" onclick="window.replyQA('${d.id}')"><i data-lucide="send" class="w-4 h-4"></i></button>
          </div>
        </div>
      </div>
    `;
  });
  
  if(count === 0) c.innerHTML = '<p class="text-muted text-center py-8">Chưa có câu hỏi nào được công khai.</p>';
  lucide.createIcons();
}

document.getElementById('btn-submit-qa').addEventListener('click', async () => {
  if (!currentUser) { showToast("Vui lòng đăng nhập!", true); return; }
  const val = document.getElementById('qa-input').value.trim();
  if(!val) return;
  await addDoc(collection(db, "qa"), {
    userEmail: currentUser.email,
    question: val,
    isApproved: false,
    createdAt: new Date().toISOString()
  });
  document.getElementById('qa-input').value = '';
  showToast("Đã gửi câu hỏi. Đang chờ Admin duyệt.");
});

window.replyQA = async (id) => {
  if (!currentUser) { showToast("Vui lòng đăng nhập!", true); return; }
  const input = document.getElementById(`reply-input-${id}`);
  const text = input.value.trim();
  if(!text) return;
  
  const docRef = doc(db, "qa", id);
  const snap = await getDoc(docRef);
  const data = snap.data();
  const answers = data.answers || [];
  answers.push({
    userEmail: currentUser.email,
    answer: text,
    createdAt: new Date().toISOString()
  });
  
  await updateDoc(docRef, { answers });
  input.value = '';
  showToast("Đã trả lời");
  loadQA();
}

// ============================================================
// PROFILE MODULE
// ============================================================

function updateProfileCompletionBar(data) {
  const fields = ['fullName', 'phone', 'dob', 'school', 'grade'];
  const filled = fields.filter(f => data[f] && data[f].toString().trim() !== '').length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

  const bar = document.getElementById('profile-completion-bar');
  const pctEl = document.getElementById('profile-completion-pct');
  const tip = document.getElementById('profile-completion-tip');
  if (!bar || !pctEl) return;

  bar.style.width = pct + '%';
  pctEl.textContent = pct + '%';

  if (pct === 100) {
    bar.style.background = 'linear-gradient(to right, #22c55e, #16a34a)';
    pctEl.className = 'text-sm font-black text-green-500';
    if(tip) tip.textContent = '✅ Hồ sơ hoàn thiện! Bạn đã điền đầy đủ thông tin.';
  } else if (pct >= 60) {
    if(tip) tip.textContent = `Đã điền ${filled}/${total} mục. Hãy hoàn thiện nốt để đạt 100%!`;
  } else {
    if(tip) tip.textContent = `Đã điền ${filled}/${total} mục. Hãy điền thêm thông tin để nhận huy hiệu hoàn thiện!`;
  }
}

async function loadProfile() {
  if (!currentUser) {
    showToast("Đăng nhập để xem hồ sơ cá nhân!", true);
    return;
  }

  // Set basics from Google Auth
  const avatarImg = document.getElementById('profile-avatar-img');
  const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
  const displayName = document.getElementById('profile-display-name');
  const emailDisplay = document.getElementById('profile-email-display');
  const joinedEl = document.getElementById('profile-joined');

  if (displayName) displayName.textContent = currentUser.displayName || currentUser.email.split('@')[0];
  if (emailDisplay) emailDisplay.textContent = currentUser.email;

  // Show avatar from Google or photoURL
  const photoSrc = currentUser.photoURL;
  if (photoSrc && avatarImg) {
    avatarImg.src = photoSrc;
    avatarImg.classList.remove('hidden');
    if(avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
  } else if (avatarPlaceholder) {
    avatarPlaceholder.textContent = (currentUser.email[0] || 'A').toUpperCase();
  }

  // Join date from auth metadata
  if (joinedEl && currentUser.metadata?.creationTime) {
    const d = new Date(currentUser.metadata.creationTime);
    joinedEl.textContent = 'Thành viên từ ' + d.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }

  // Load from Firestore
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.email));
    const data = snap.exists() ? snap.data() : {};

    const v = (id, field) => {
      const el = document.getElementById(id);
      if(el) el.value = data[field] || '';
    };
    v('pf-fullname', 'fullName');
    v('pf-phone', 'phone');
    v('pf-dob', 'dob');
    v('pf-school', 'school');
    v('pf-grade', 'grade');

    // Update display name to fullName if available
    if (data.fullName && displayName) displayName.textContent = data.fullName;

    // Update completion bar
    updateProfileCompletionBar(data);
  } catch(e) {
    console.error(e);
  }

  // Re-init lucide for new icons
  lucide.createIcons();

  // Live update completion bar as user types
  ['pf-fullname','pf-phone','pf-dob','pf-school','pf-grade'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => {
      const currentData = {
        fullName: document.getElementById('pf-fullname')?.value,
        phone:    document.getElementById('pf-phone')?.value,
        dob:      document.getElementById('pf-dob')?.value,
        school:   document.getElementById('pf-school')?.value,
        grade:    document.getElementById('pf-grade')?.value,
      };
      updateProfileCompletionBar(currentData);
    });
  });
}

async function saveProfile() {
  if (!currentUser) { showToast("Đăng nhập để lưu hồ sơ!", true); return; }

  const btn = document.getElementById('btn-save-profile');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<div class="loader !w-5 !h-5 !border-2 !border-white !border-t-transparent mx-auto"></div>';
  btn.disabled = true;

  const profileData = {
    fullName: document.getElementById('pf-fullname')?.value.trim() || '',
    phone:    document.getElementById('pf-phone')?.value.trim() || '',
    dob:      document.getElementById('pf-dob')?.value || '',
    school:   document.getElementById('pf-school')?.value.trim() || '',
    grade:    document.getElementById('pf-grade')?.value || '',
    email:    currentUser.email,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'users', currentUser.email), profileData, { merge: true });

    // Update display name on card
    const dn = document.getElementById('profile-display-name');
    if (dn && profileData.fullName) dn.textContent = profileData.fullName;

    updateProfileCompletionBar(profileData);
    showToast('🎉 Đã lưu hồ sơ thành công!');
  } catch(e) {
    console.error(e);
    showToast('Lỗi khi lưu hồ sơ. Vui lòng thử lại!', true);
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
    lucide.createIcons();
  }
}

// Avatar upload handler
const photoInput = document.getElementById('profile-photo-input');
if (photoInput) {
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn! Vui lòng chọn ảnh nhỏ hơn 5MB.', true);
      return;
    }

    const progressWrap = document.getElementById('upload-progress-wrap');
    const progressBar = document.getElementById('upload-progress-bar');
    const uploadPct = document.getElementById('upload-pct');
    if(progressWrap) progressWrap.classList.remove('hidden');

    const storageRef = ref(storage, `avatars/${currentUser.email}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if(progressBar) progressBar.style.width = pct + '%';
        if(uploadPct) uploadPct.textContent = pct + '%';
      },
      (err) => {
        console.error(err);
        showToast('Lỗi tải ảnh!', true);
        if(progressWrap) progressWrap.classList.add('hidden');
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        // Update Auth profile
        try {
          const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js');
          await updateProfile(auth.currentUser, { photoURL: url });
        } catch(e) { console.error(e); }

        // Update Firestore
        await setDoc(doc(db, 'users', currentUser.email), { photoURL: url }, { merge: true });

        // Update UI
        const avatarImg = document.getElementById('profile-avatar-img');
        const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
        if(avatarImg) { avatarImg.src = url; avatarImg.classList.remove('hidden'); }
        if(avatarPlaceholder) avatarPlaceholder.classList.add('hidden');

        if(progressWrap) progressWrap.classList.add('hidden');
        showToast('✨ Đã cập nhật ảnh đại diện thành công!');
      }
    );
  });
}

// Save profile button
const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) btnSaveProfile.addEventListener('click', saveProfile);
