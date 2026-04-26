import { 
  auth, db, storage, googleProvider,
  signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence,
  collection, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc,
  ref, uploadBytesResumable, getDownloadURL, getDoc
} from './firebase-config.js';

// DOM Elements
const authLoading = document.getElementById('auth-loading');
const adminContent = document.getElementById('admin-content');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');

// Stats
const statTotalUsers = document.getElementById('stat-total-users');
const statTotalCourses = document.getElementById('stat-total-courses');
const statTotalLectures = document.getElementById('stat-total-lectures');
const statPendingQa = document.getElementById('stat-pending-qa');

let currentUser = null;
const ADMIN_EMAIL = 'duongngoclam28022008@gmail.com';

function hideAdminLoader() {
  if (authLoading) {
    authLoading.style.display = 'none';
    authLoading.classList.add('hidden');
  }
}

// Force-hide loader after 5s if Firebase is slow
const _adminLoaderTimeout = setTimeout(hideAdminLoader, 5000);

// Set persistence FIRST, then register auth listener
(async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch(e) {
    console.warn('setPersistence error:', e);
  }

  onAuthStateChanged(auth, async (user) => {
    clearTimeout(_adminLoaderTimeout);
    hideAdminLoader();

    if (user) {
      if (user.email.toLowerCase() !== ADMIN_EMAIL) {
        alert("Bạn không có quyền truy cập trang quản trị!");
        await signOut(auth);
        return;
      }
      currentUser = user;
      btnLogin.classList.add('hidden');
      btnLogout.classList.remove('hidden');
      userInfo.textContent = user.email;
      userInfo.classList.remove('hidden');
      adminContent.classList.remove('hidden');
      loadData();
    } else {
      currentUser = null;
      btnLogin.classList.remove('hidden');
      btnLogout.classList.add('hidden');
      userInfo.classList.add('hidden');
      adminContent.classList.add('hidden');
    }
  }); // end onAuthStateChanged

})(); // end async IIFE

btnLogin.addEventListener('click', async () => { 
  try {
    await signInWithPopup(auth, googleProvider); 
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    showToast("Đăng nhập thất bại!", true);
  }
});
btnLogout.addEventListener('click', () => { signOut(auth); });

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  
  const existingIcon = toast.querySelector('svg') || toast.querySelector('i');
  if (existingIcon) existingIcon.remove();
  
  const newIcon = document.createElement('i');
  newIcon.setAttribute('data-lucide', isError ? 'alert-circle' : 'check-circle');
  newIcon.className = isError ? 'text-red-500 w-5 h-5' : 'text-green-500 w-5 h-5';
  toast.insertBefore(newIcon, msgEl);
  
  lucide.createIcons();
  
  msgEl.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3000);
}

// Tabs Logic
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    const targetEl = e.target.closest('.admin-tab');
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.remove('active', 'text-primary', 'border-b-2', 'border-primary');
      t.classList.add('text-muted');
    });
    targetEl.classList.remove('text-muted');
    targetEl.classList.add('active', 'text-primary', 'border-b-2', 'border-primary');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(targetEl.dataset.target).classList.remove('hidden');
  });
});

// ----------------------------------------------------
// LOAD ALL DATA
// ----------------------------------------------------
async function loadData() {
  await Promise.allSettled([
    loadWhitelist().catch(e => console.error("Lỗi tải Whitelist:", e)),
    loadCourses().catch(e => console.error("Lỗi tải Courses:", e)),
    loadNews().catch(e => console.error("Lỗi tải News:", e)),
    loadDocs().catch(e => console.error("Lỗi tải Docs:", e)),
    loadDiscovery().catch(e => console.error("Lỗi tải Discovery:", e)),
    loadQA().catch(e => console.error("Lỗi tải QA:", e))
  ]);
}

// ==========================================
// 2. Whitelist
// ==========================================
async function loadWhitelist() {
  const container = document.getElementById('whitelist-container');
  container.innerHTML = '<div class="loader mx-auto mt-4"></div>';
  const snap = await getDocs(collection(db, "allowed_users"));
  statTotalUsers.textContent = snap.size;
  container.innerHTML = '';
  if (snap.empty) { container.innerHTML = '<p class="text-muted">Chưa có dữ liệu.</p>'; return; }
  
  snap.forEach(d => {
    const data = d.data();
    const isExp = data.expiresAt && new Date(data.expiresAt) < new Date();
    const expText = data.expiresAt ? `Hạn: ${new Date(data.expiresAt).toLocaleDateString('vi-VN')}` : 'Vĩnh viễn';
    
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center py-2 px-3 bg-gray-50/50 dark:bg-slate-800/50 rounded-xl mb-2 border border-theme';
    div.innerHTML = `
      <div><p class="text-sm font-semibold text-main">${d.id}</p><span class="text-[10px] ${isExp ? 'text-red-500' : 'text-green-500'} font-bold">${expText}</span></div>
      <button class="text-red-500 p-2 hover:bg-red-50 rounded" onclick="deleteDocHandler('allowed_users', '${d.id}')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}

document.getElementById('form-whitelist').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawEmails = document.getElementById('input-emails').value;
  const expiry = document.getElementById('input-expiry').value;
  const emails = rawEmails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
  if (!emails) { showToast("Không tìm thấy email!", true); return; }
  
  const payload = { addedAt: new Date().toISOString() };
  if (expiry) payload.expiresAt = new Date(`${expiry}T23:59:59`).toISOString();
  
  await Promise.all(emails.map(em => setDoc(doc(db, "allowed_users", em.toLowerCase()), payload)));
  document.getElementById('input-emails').value = '';
  showToast(`Đã cấp quyền cho ${emails.length} tài khoản`);
  loadWhitelist();
});

// ==========================================
// 3. Courses (Same logic as before, abbreviated)
// ==========================================
let currentCourses = [];
async function loadCourses() {
  const container = document.getElementById('courses-container');
  const snap = await getDocs(collection(db, "courses"));
  currentCourses = [];
  let totalLec = 0;
  container.innerHTML = '';
  
  snap.forEach(d => {
    const data = d.data(); data.id = d.id;
    currentCourses.push(data);
    let lecCount = 0;
    if(data.topics) data.topics.forEach(t => { if(t.lectures) { lecCount += t.lectures.length; totalLec += t.lectures.length; }});
    const thumb = data.thumbnailUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop';
    
    const div = document.createElement('div');
    div.className = 'glass-card bg-card p-4 rounded-2xl border border-theme flex flex-col gap-3';
    div.innerHTML = `
      <div class="h-32 rounded-xl overflow-hidden relative"><img src="${thumb}" class="w-full h-full object-cover"></div>
      <div><h3 class="font-bold text-main line-clamp-1">${data.title}</h3><p class="text-xs text-muted">${lecCount} bài giảng</p></div>
      <div class="flex gap-2 mt-auto pt-2 border-t border-theme">
        <button class="btn-secondary !py-1 !px-2 flex-1 text-xs font-bold" onclick="editCourse('${data.id}')">Sửa</button>
        <button class="btn-secondary !py-1 !px-2 flex-1 text-xs font-bold text-red-500" onclick="deleteDocHandler('courses', '${data.id}')">Xóa</button>
      </div>
    `;
    container.appendChild(div);
  });
  statTotalCourses.textContent = snap.size;
  statTotalLectures.textContent = totalLec;
}

window.deleteDocHandler = async (col, id) => {
  if(!confirm("Chắc chắn xóa?")) return;
  await deleteDoc(doc(db, col, id));
  showToast("Đã xóa");
  loadData();
};

// ... Include Course Modal Logic here (Skipped for brevity but it is the same as previous) ...
// We just need the globals: editCourse, addTopic, etc.
let editingCourse = null;
const modalCourse = document.getElementById('modal-course');

document.getElementById('upload-thumbnail-input').addEventListener('change', async(e) => {
  const file = e.target.files[0]; if(!file) return;
  const progressContainer = document.getElementById('thumbnail-progress');
  const progressBar = progressContainer.querySelector('div');
  progressContainer.classList.remove('hidden');
  const uploadTask = uploadBytesResumable(ref(storage, `course_thumbnails/${Date.now()}_${file.name}`), file);
  uploadTask.on('state_changed', 
    (snap) => { progressBar.style.width = (snap.bytesTransferred / snap.totalBytes) * 100 + '%'; },
    (error) => { showToast("Lỗi tải ảnh", true); progressContainer.classList.add('hidden'); },
    async () => {
      document.getElementById('course-thumbnail').value = await getDownloadURL(uploadTask.snapshot.ref);
      showToast("Tải ảnh xong");
      progressContainer.classList.add('hidden');
      if (window.editingCourse) window.editingCourse.thumbnailUrl = document.getElementById('course-thumbnail').value;
    }
  );
});

window.editCourse = (id) => {
  const course = currentCourses.find(c => c.id === id);
  if (!course) return;
  editingCourse = JSON.parse(JSON.stringify(course));
  if (!editingCourse.topics) editingCourse.topics = [];
  window.editingCourse = editingCourse;
  document.getElementById('modal-course-title').textContent = "Chỉnh Sửa Khóa Học";
  document.getElementById('course-name').value = editingCourse.title || "";
  document.getElementById('course-thumbnail').value = editingCourse.thumbnailUrl || "";
  renderTopicsEditor();
  modalCourse.classList.remove('hidden'); setTimeout(() => modalCourse.classList.remove('opacity-0'), 10);
};

document.getElementById('btn-add-course').addEventListener('click', () => {
  editingCourse = { title: "", thumbnailUrl: "", topics: [] };
  window.editingCourse = editingCourse;
  document.getElementById('modal-course-title').textContent = "Thêm Khóa Học Mới";
  document.getElementById('course-name').value = "";
  document.getElementById('course-thumbnail').value = "";
  renderTopicsEditor();
  modalCourse.classList.remove('hidden'); setTimeout(() => modalCourse.classList.remove('opacity-0'), 10);
});
document.getElementById('btn-close-modal').addEventListener('click', () => { modalCourse.classList.add('opacity-0'); setTimeout(() => modalCourse.classList.add('hidden'), 300); });
document.getElementById('btn-cancel-course').addEventListener('click', () => { modalCourse.classList.add('opacity-0'); setTimeout(() => modalCourse.classList.add('hidden'), 300); });

function renderTopicsEditor() {
  const container = document.getElementById('topics-editor-container');
  container.innerHTML = '';
  window.editingCourse.topics.forEach((topic, tIndex) => {
    const tDiv = document.createElement('div');
    tDiv.className = 'p-5 bg-card rounded-2xl border border-theme shadow-md glass-card mb-4 transition-all hover:border-primary/50';
    tDiv.innerHTML = `
      <div class="flex flex-col md:flex-row gap-3 mb-4 items-center">
        <div class="flex-1 flex items-center gap-3 w-full">
          <div class="p-2 bg-primary/10 text-primary rounded-lg hidden md:block"><i data-lucide="folder" class="w-5 h-5"></i></div>
          <input type="text" class="input-glass !py-2 flex-1 font-bold text-main" value="${(topic.title||'').replace(/"/g, '&quot;')}" placeholder="Nhập tên chủ đề..." data-action="update-topic-title" data-tindex="${tIndex}">
        </div>
        <div class="flex gap-2 w-full md:w-auto">
          <button class="btn-primary !py-2 !px-4 text-xs flex-1 md:flex-none flex items-center justify-center gap-2" data-action="add-lecture" data-tindex="${tIndex}">
            <i data-lucide="plus-circle" class="w-4 h-4 pointer-events-none"></i> Thêm bài
          </button>
          <button class="btn-secondary text-red-500 !py-2 !px-3 hover:bg-red-50 dark:hover:bg-red-900/20" data-action="delete-topic" data-tindex="${tIndex}" title="Xóa chủ đề">
            <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
          </button>
        </div>
      </div>
      <div class="space-y-3 md:pl-12" id="lectures-${tIndex}"></div>
    `;
    container.appendChild(tDiv);
    
    const lContainer = tDiv.querySelector(`#lectures-${tIndex}`);
    if(topic.lectures) topic.lectures.forEach((lec, lIndex) => {
      const lDiv = document.createElement('div');
      lDiv.className = 'bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-theme relative group transition-all hover:shadow-md';
      lDiv.innerHTML = `
        <div class="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-card border border-theme rounded-full flex items-center justify-center text-xs font-bold text-muted shadow-sm z-10 hidden md:flex">${lIndex + 1}</div>
        
        <div class="flex justify-between gap-2 mb-3">
          <div class="flex-1">
            <label class="text-[10px] uppercase font-bold text-muted tracking-wider mb-1 block">Tên bài giảng</label>
            <input type="text" class="input-glass !py-1.5 font-semibold" value="${(lec.title||'').replace(/"/g, '&quot;')}" placeholder="VD: Bài 1: Giới thiệu..." data-action="update-lec-title" data-tindex="${tIndex}" data-lindex="${lIndex}">
          </div>
          <button class="text-red-400 hover:text-red-600 p-2 transition-colors self-end" data-action="delete-lecture" data-tindex="${tIndex}" data-lindex="${lIndex}" title="Xóa bài giảng"><i data-lucide="x" class="w-5 h-5 pointer-events-none"></i></button>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div class="space-y-3">
            <div>
              <label class="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1 flex items-center gap-1"><i data-lucide="youtube" class="w-3 h-3 text-red-500"></i> Video Youtube</label>
              <input type="text" class="input-glass !py-1.5 text-xs" placeholder="https://youtube.com/..." value="${lec.youtubeLink||''}" data-action="update-lec-yt" data-tindex="${tIndex}" data-lindex="${lIndex}">
            </div>
            <div>
              <label class="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1 flex items-center gap-1"><i data-lucide="file-text" class="w-3 h-3 text-blue-500"></i> File Tài liệu (PDF)</label>
              <input type="text" class="input-glass !py-1.5 text-xs" placeholder="https://..." value="${lec.documentLink||''}" data-action="update-lec-doc" data-tindex="${tIndex}" data-lindex="${lIndex}">
            </div>
          </div>
          <div class="space-y-3 flex flex-col">
            <div class="flex-1">
              <label class="text-[10px] uppercase font-bold text-muted tracking-wider block mb-1">Mô tả ngắn</label>
              <textarea class="input-glass !py-1.5 text-xs h-[50px] resize-none" placeholder="Tóm tắt nội dung bài học..." data-action="update-lec-desc" data-tindex="${tIndex}" data-lindex="${lIndex}">${lec.description||''}</textarea>
            </div>
            
            <label class="flex items-center gap-3 p-2 bg-card border border-theme rounded-lg cursor-pointer w-max hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
              <div class="relative">
                <input type="checkbox" class="sr-only peer" ${lec.isFreeTrial?'checked':''} data-action="update-lec-free" data-tindex="${tIndex}" data-lindex="${lIndex}">
                <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
              </div>
              <span class="text-xs font-bold text-main">Cho phép học thử (Free)</span>
            </label>
          </div>
        </div>
      `;
      lContainer.appendChild(lDiv);
    });
  });
  lucide.createIcons();
}

// Event Delegation for Topics Editor
document.getElementById('topics-editor-container').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const tIndex = parseInt(btn.dataset.tindex);
  const lIndex = parseInt(btn.dataset.lindex);

  if (action === 'add-lecture') {
    if(!window.editingCourse.topics[tIndex].lectures) window.editingCourse.topics[tIndex].lectures = [];
    window.editingCourse.topics[tIndex].lectures.push({ id: Math.random().toString(36).substr(2,9), title: "", youtubeLink: "", documentLink: "", description: "", isFreeTrial: false });
    renderTopicsEditor();
  } else if (action === 'delete-topic') {
    window.editingCourse.topics.splice(tIndex, 1);
    renderTopicsEditor();
  } else if (action === 'delete-lecture') {
    window.editingCourse.topics[tIndex].lectures.splice(lIndex, 1);
    renderTopicsEditor();
  }
});

document.getElementById('topics-editor-container').addEventListener('input', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const tIndex = parseInt(e.target.dataset.tindex);
  const lIndex = parseInt(e.target.dataset.lindex);
  const val = e.target.value;
  
  if (action === 'update-topic-title') {
    window.editingCourse.topics[tIndex].title = val;
  } else if (action === 'update-lec-title') {
    window.editingCourse.topics[tIndex].lectures[lIndex].title = val;
  } else if (action === 'update-lec-yt') {
    window.editingCourse.topics[tIndex].lectures[lIndex].youtubeLink = val;
  } else if (action === 'update-lec-doc') {
    window.editingCourse.topics[tIndex].lectures[lIndex].documentLink = val;
  } else if (action === 'update-lec-desc') {
    window.editingCourse.topics[tIndex].lectures[lIndex].description = val;
  }
});

document.getElementById('topics-editor-container').addEventListener('change', (e) => {
  const action = e.target.dataset.action;
  if (action === 'update-lec-free') {
    const tIndex = parseInt(e.target.dataset.tindex);
    const lIndex = parseInt(e.target.dataset.lindex);
    window.editingCourse.topics[tIndex].lectures[lIndex].isFreeTrial = e.target.checked;
  }
});

document.getElementById('btn-add-topic').addEventListener('click', () => {
  window.editingCourse.topics.push({ id: Math.random().toString(36).substr(2,9), title: "", lectures: [] });
  renderTopicsEditor();
});

document.getElementById('btn-save-course').addEventListener('click', async (e) => {
  try {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Đang lưu...`;
    lucide.createIcons();
    
    window.editingCourse.title = document.getElementById('course-name').value || "Khóa học chưa đặt tên";
    window.editingCourse.thumbnailUrl = document.getElementById('course-thumbnail').value;
    const payload = { 
      title: window.editingCourse.title, 
      thumbnailUrl: window.editingCourse.thumbnailUrl, 
      topics: window.editingCourse.topics, 
      updatedAt: new Date().toISOString() 
    };
    
    if(window.editingCourse.id) {
      await updateDoc(doc(db, "courses", window.editingCourse.id), payload);
    } else { 
      payload.createdAt = new Date().toISOString(); 
      await addDoc(collection(db, "courses"), payload); 
    }
    
    showToast("Đã lưu khóa học thành công!");
    document.getElementById('btn-close-modal').click();
    loadCourses();
  } catch (error) {
    console.error("Lỗi khi lưu khóa học:", error);
    showToast("Có lỗi xảy ra khi lưu! Xem console.", true);
  } finally {
    const btn = document.getElementById('btn-save-course');
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Lưu Khóa Học`;
    lucide.createIcons();
  }
});

// ==========================================
// 4. News
// ==========================================
async function loadNews() {
  const container = document.getElementById('news-container');
  const snap = await getDocs(collection(db, "news"));
  container.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const div = document.createElement('div');
    div.className = 'glass-card bg-card p-4 rounded-xl border border-theme flex gap-4';
    div.innerHTML = `
      ${data.imageUrl ? `<img src="${data.imageUrl}" class="w-20 h-20 object-cover rounded-lg">` : '<div class="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center"><i data-lucide="image" class="text-gray-300"></i></div>'}
      <div class="flex-1">
        <h4 class="font-bold text-main text-sm">${data.title}</h4>
        <p class="text-xs text-muted mb-2">${new Date(data.createdAt).toLocaleDateString()}</p>
        <button class="text-red-500 text-xs font-bold" onclick="deleteDocHandler('news', '${d.id}')">Xóa</button>
      </div>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}
document.getElementById('form-news').addEventListener('submit', async(e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('news-title').value,
    imageUrl: document.getElementById('news-image').value,
    content: document.getElementById('news-content').value,
    createdAt: new Date().toISOString()
  };
  await addDoc(collection(db, "news"), payload);
  showToast("Đã đăng tin");
  e.target.reset();
  loadNews();
});

// ==========================================
// 5. Docs
// ==========================================
async function loadDocs() {
  const container = document.getElementById('docs-container');
  const snap = await getDocs(collection(db, "documents_global"));
  container.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const div = document.createElement('div');
    div.className = 'glass-card bg-card p-3 rounded-xl border border-theme flex justify-between items-center';
    div.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="p-2 bg-blue-100 text-blue-600 rounded-lg"><i data-lucide="file-text" class="w-4 h-4"></i></div>
        <div>
          <h4 class="font-bold text-main text-sm">${data.title}</h4>
          <a href="${data.url}" target="_blank" class="text-xs text-blue-500 hover:underline">Xem file</a>
        </div>
      </div>
      <button class="text-red-500 p-2" onclick="deleteDocHandler('documents_global', '${d.id}')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}
document.getElementById('upload-doc-input').addEventListener('change', async(e) => {
  const file = e.target.files[0]; if(!file) return;
  const progressContainer = document.getElementById('upload-doc-progress');
  const progressBar = progressContainer.querySelector('div');
  progressContainer.classList.remove('hidden');
  const uploadTask = uploadBytesResumable(ref(storage, `global_docs/${Date.now()}_${file.name}`), file);
  uploadTask.on('state_changed', 
    (snap) => { progressBar.style.width = (snap.bytesTransferred / snap.totalBytes) * 100 + '%'; },
    (error) => { showToast("Lỗi tải file", true); progressContainer.classList.add('hidden'); },
    async () => {
      document.getElementById('doc-url').value = await getDownloadURL(uploadTask.snapshot.ref);
      showToast("Tải xong");
      progressContainer.classList.add('hidden');
    }
  );
});
document.getElementById('form-doc').addEventListener('submit', async(e) => {
  e.preventDefault();
  await addDoc(collection(db, "documents_global"), {
    title: document.getElementById('doc-title').value,
    url: document.getElementById('doc-url').value,
    createdAt: new Date().toISOString()
  });
  showToast("Đã thêm tài liệu");
  e.target.reset();
  loadDocs();
});

// ==========================================
// 6. Discovery
// ==========================================
async function loadDiscovery() {
  const container = document.getElementById('discovery-container');
  const snap = await getDocs(collection(db, "discovery"));
  container.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const div = document.createElement('div');
    div.className = 'glass-card bg-card p-4 rounded-xl border border-theme';
    div.innerHTML = `
      ${data.imageUrl ? `<img src="${data.imageUrl}" class="w-full h-32 object-cover rounded-lg mb-3">` : ''}
      <h4 class="font-bold text-main text-sm mb-1">${data.title}</h4>
      <p class="text-xs text-muted mb-2 line-clamp-2">${data.description}</p>
      <div class="flex justify-between items-center">
        <a href="${data.url}" target="_blank" class="text-xs text-blue-500 font-bold">Mở Link</a>
        <button class="text-red-500 p-1" onclick="deleteDocHandler('discovery', '${d.id}')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}
document.getElementById('form-discovery').addEventListener('submit', async(e) => {
  e.preventDefault();
  await addDoc(collection(db, "discovery"), {
    title: document.getElementById('discovery-title').value,
    url: document.getElementById('discovery-url').value,
    imageUrl: document.getElementById('discovery-image').value,
    description: document.getElementById('discovery-desc').value,
    createdAt: new Date().toISOString()
  });
  showToast("Đã thêm bài khám phá");
  e.target.reset();
  loadDiscovery();
});

// ==========================================
// 7. Q&A Approval
// ==========================================
async function loadQA() {
  const container = document.getElementById('qa-container');
  const snap = await getDocs(collection(db, "qa"));
  container.innerHTML = '';
  let pendingCount = 0;
  
  snap.forEach(d => {
    const data = d.data();
    if(!data.isApproved) pendingCount++;
    const div = document.createElement('div');
    div.className = `glass-card bg-card p-5 rounded-2xl border ${data.isApproved ? 'border-theme' : 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10'}`;
    
    div.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">${(data.userEmail ? data.userEmail[0] : '?').toUpperCase()}</div>
          <div>
            <p class="text-sm font-bold text-main">${data.userEmail || 'Khách'}</p>
            <p class="text-[10px] text-muted">${new Date(data.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        ${!data.isApproved ? `<span class="px-2 py-1 bg-orange-500 text-white text-[10px] rounded uppercase font-bold">Chờ duyệt</span>` : '<span class="px-2 py-1 bg-green-500 text-white text-[10px] rounded uppercase font-bold">Đã duyệt</span>'}
      </div>
      <p class="text-sm text-main font-medium mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-theme shadow-inner">${data.question}</p>
      
      <div class="flex gap-2">
        ${!data.isApproved ? `<button class="btn-primary !py-1.5 !px-3 text-xs" onclick="approveQA('${d.id}')">Duyệt cho phép hiện</button>` : ''}
        <button class="btn-secondary !py-1.5 !px-3 text-xs" onclick="toggleReplyBox('${d.id}')">Trả lời</button>
        <button class="btn-secondary !py-1.5 !px-3 text-xs text-red-500" onclick="deleteDocHandler('qa', '${d.id}')">Xóa</button>
      </div>

      <div id="reply-box-${d.id}" class="hidden mt-3 pt-3 border-t border-theme">
        <textarea id="reply-text-${d.id}" class="input-glass !py-2 text-sm w-full mb-2" rows="2" placeholder="Nhập câu trả lời..."></textarea>
        <button class="btn-primary !py-1 text-xs" onclick="replyQA('${d.id}')">Gửi trả lời</button>
      </div>

      ${data.answers && data.answers.length > 0 ? `
        <div class="mt-4 space-y-2 pl-4 border-l-2 border-primary">
          ${data.answers.map(ans => `
            <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p class="text-xs font-bold text-primary mb-1">${ans.userEmail} <span class="text-[10px] text-muted font-normal ml-2">${new Date(ans.createdAt).toLocaleString()}</span></p>
              <p class="text-sm text-main">${ans.answer}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    container.appendChild(div);
  });
  statPendingQa.textContent = pendingCount;
  lucide.createIcons();
}

window.approveQA = async (id) => {
  await updateDoc(doc(db, "qa", id), { isApproved: true });
  showToast("Đã duyệt câu hỏi");
  loadQA();
}

window.toggleReplyBox = (id) => {
  document.getElementById(`reply-box-${id}`).classList.toggle('hidden');
}

window.replyQA = async (id) => {
  const text = document.getElementById(`reply-text-${id}`).value.trim();
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
  await updateDoc(docRef, { answers, isApproved: true }); // Auto approve if admin replies
  showToast("Đã trả lời");
  loadQA();
}

// ============================================================
// BATCH Q&A
// ============================================================

function updateBatchQAButtons() {
  const checked = document.querySelectorAll('.qa-checkbox:checked');
  const btnApprove = document.getElementById('btn-batch-approve');
  const btnDelete = document.getElementById('btn-batch-delete');
  const hasSelection = checked.length > 0;
  
  if (btnApprove) {
    btnApprove.disabled = !hasSelection;
    btnApprove.classList.toggle('opacity-50', !hasSelection);
    btnApprove.classList.toggle('cursor-not-allowed', !hasSelection);
  }
  if (btnDelete) {
    btnDelete.disabled = !hasSelection;
    btnDelete.classList.toggle('opacity-50', !hasSelection);
    btnDelete.classList.toggle('cursor-not-allowed', !hasSelection);
  }
}

// Override loadQA to add checkboxes
const _origAdminLoadQA = loadQA;
async function loadQA() {
  const container = document.getElementById('qa-container');
  const snap = await getDocs(collection(db, "qa"));
  container.innerHTML = '';
  let pendingCount = 0;
  
  snap.forEach(d => {
    const data = d.data();
    if(!data.isApproved) pendingCount++;
    const div = document.createElement('div');
    div.className = `glass-card bg-card p-5 rounded-2xl border ${data.isApproved ? 'border-theme' : 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10'} relative`;
    
    div.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-3">
          <input type="checkbox" class="qa-checkbox w-4 h-4 accent-orange-500 cursor-pointer shrink-0" data-id="${d.id}" onchange="updateBatchQAButtons()">
          <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">${(data.userEmail ? data.userEmail[0] : '?').toUpperCase()}</div>
          <div>
            <p class="text-sm font-bold text-main">${data.userEmail || 'Khách'}</p>
            <p class="text-[10px] text-muted">${new Date(data.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>
        ${!data.isApproved ? `<span class="px-2 py-1 bg-orange-500 text-white text-[10px] rounded uppercase font-bold">Chờ duyệt</span>` : '<span class="px-2 py-1 bg-green-500 text-white text-[10px] rounded uppercase font-bold">Đã duyệt</span>'}
      </div>
      <p class="text-sm text-main font-medium mb-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-theme shadow-inner">${data.question}</p>
      
      <div class="flex gap-2 flex-wrap">
        ${!data.isApproved ? `<button class="btn-primary !py-1.5 !px-3 text-xs" onclick="window.approveQA('${d.id}')">Duyệt cho phép hiện</button>` : ''}
        <button class="btn-secondary !py-1.5 !px-3 text-xs" onclick="window.toggleReplyBox('${d.id}')">Trả lời</button>
        <button class="btn-secondary !py-1.5 !px-3 text-xs text-red-500" onclick="window.deleteDocHandler('qa', '${d.id}')">Xóa</button>
      </div>

      <div id="reply-box-${d.id}" class="hidden mt-3 pt-3 border-t border-theme">
        <textarea id="reply-text-${d.id}" class="input-glass !py-2 text-sm w-full mb-2" rows="2" placeholder="Nhập câu trả lời..."></textarea>
        <button class="btn-primary !py-1 text-xs" onclick="window.replyQA('${d.id}')">Gửi trả lời</button>
      </div>

      ${data.answers && data.answers.length > 0 ? `
        <div class="mt-4 space-y-2 pl-4 border-l-2 border-primary">
          ${data.answers.map(ans => `
            <div class="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p class="text-xs font-bold text-primary mb-1">${ans.userEmail} <span class="text-[10px] text-muted font-normal ml-2">${new Date(ans.createdAt).toLocaleString()}</span></p>
              <p class="text-sm text-main">${ans.answer}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    container.appendChild(div);
  });
  statPendingQa.textContent = pendingCount;
  lucide.createIcons();
}

// Select All handler
const qaSelectAll = document.getElementById('qa-select-all');
if (qaSelectAll) qaSelectAll.addEventListener('change', () => {
  document.querySelectorAll('.qa-checkbox').forEach(cb => {
    cb.checked = qaSelectAll.checked;
  });
  updateBatchQAButtons();
});

// Batch Approve
const btnBatchApprove = document.getElementById('btn-batch-approve');
if (btnBatchApprove) btnBatchApprove.addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('.qa-checkbox:checked')];
  if (!checked.length) return;
  btnBatchApprove.disabled = true;
  btnBatchApprove.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div> Đang duyệt...';
  await Promise.all(checked.map(cb => updateDoc(doc(db, 'qa', cb.dataset.id), { isApproved: true })));
  showToast(`Đã duyệt ${checked.length} câu hỏi`);
  if (qaSelectAll) qaSelectAll.checked = false;
  await loadQA();
});

// Batch Delete
const btnBatchDelete = document.getElementById('btn-batch-delete');
if (btnBatchDelete) btnBatchDelete.addEventListener('click', async () => {
  const checked = [...document.querySelectorAll('.qa-checkbox:checked')];
  if (!checked.length) return;
  if (!confirm(`Xóa ${checked.length} câu hỏi đã chọn?`)) return;
  await Promise.all(checked.map(cb => deleteDoc(doc(db, 'qa', cb.dataset.id))));
  showToast(`Đã xóa ${checked.length} câu hỏi`);
  if (qaSelectAll) qaSelectAll.checked = false;
  await loadQA();
});

// ============================================================
// ACTIVITY LOG
// ============================================================
async function loadActivityLog() {
  const container = document.getElementById('activity-log-container');
  if (!container) return;
  container.innerHTML = '<div class="loader mx-auto col-span-full"></div>';
  
  try {
    const snap = await getDocs(collection(db, 'activity_log'));
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const recentUsers = [];
    snap.forEach(d => {
      const data = d.data();
      const lastSeen = new Date(data.lastSeen);
      if (lastSeen >= thirtyMinAgo) {
        recentUsers.push({ ...data, lastSeen });
      }
    });
    
    recentUsers.sort((a, b) => b.lastSeen - a.lastSeen);
    
    if (recentUsers.length === 0) {
      container.innerHTML = `
        <div class="col-span-full flex flex-col items-center py-8 text-muted">
          <i data-lucide="users" class="w-10 h-10 mb-3 opacity-30"></i>
          <p class="text-sm font-medium">Chưa có học viên nào truy cập trong 30 phút qua</p>
        </div>`;
      lucide.createIcons({ root: container });
      return;
    }

    container.innerHTML = recentUsers.map(u => {
      const diffMs = Date.now() - u.lastSeen.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const timeAgo = diffMin < 1 ? 'Vừa xong' : `${diffMin} phút trước`;
      const initial = (u.email || u.displayName || '?')[0].toUpperCase();
      
      return `<div class="flex items-center gap-3 p-3 bg-card rounded-xl border border-theme hover:border-green-300 transition-colors">
        <div class="relative">
          <div class="w-10 h-10 bg-gradient-to-tr from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">${initial}</div>
          <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-slate-800 animate-pulse"></span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-main truncate">${u.displayName || u.email?.split('@')[0] || 'Ẩn danh'}</p>
          <p class="text-xs text-muted truncate">${u.email || ''}</p>
        </div>
        <span class="text-[10px] text-green-500 font-bold whitespace-nowrap">${timeAgo}</span>
      </div>`;
    }).join('');
    lucide.createIcons({ root: container });
  } catch(e) {
    console.error('Activity log error:', e);
    container.innerHTML = '<p class="text-muted text-sm col-span-full">Lỗi tải dữ liệu.</p>';
  }
}

// Auto-load activity log and refresh button
document.addEventListener('DOMContentLoaded', () => {
  const btnRefresh = document.getElementById('btn-refresh-activity');
  if (btnRefresh) btnRefresh.addEventListener('click', () => {
    loadActivityLog();
    btnRefresh.classList.add('animate-spin');
    setTimeout(() => btnRefresh.classList.remove('animate-spin'), 1000);
  });
});

// Patch loadData to also load activity log
const _origAdminLoadData = loadData;
window.loadData = async function() {
  await _origAdminLoadData();
  await loadActivityLog();
};

