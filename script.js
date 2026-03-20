// --- Firebase Configuration & Auth ---
const firebaseConfig = {
apiKey: "AIzaSyDkA6RYXElUuv--_Mxco8KK5dC4cvyWHyY",
authDomain: "onthi-dashboard.firebaseapp.com",
projectId: "onthi-dashboard",
storageBucket: "onthi-dashboard.firebasestorage.app",
messagingSenderId: "856897874104",
appId: "1:856897874104:web:a26077783e4f14ab18ec4d",
measurementId: "G-40ZSKBCBCD"
};

let auth = null;
let db = null;
let storage = null;
let authReady = false;
try {
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
auth = firebase.auth();
db = firebase.firestore();
storage = firebase.storage();
} catch (error) {
console.warn("Cấu hình Firebase chưa hợp lệ, đang chạy chế độ Local.", error);
}

let currentUser = null;
let hasRemindedLogin = false; // Tránh nhắc nhở đăng nhập liên tục

function remindLoginIfGuest() {
if (!currentUser && !hasRemindedLogin) {
showToast("Lưu ý: Đăng nhập ngay để hệ thống có thể lưu tiến trình của bạn lên đám mây!", "info");
hasRemindedLogin = true;
}
}

function updateAuthUI() {
const loginBtn = document.getElementById('loginBtn');
const userProfile = document.getElementById('userProfile');
if (!loginBtn || !userProfile) return;

if (currentUser) {
loginBtn.style.display = 'none';
userProfile.style.display = 'flex';
document.getElementById('userAvatar').src = currentUser.photoURL || 'https://via.placeholder.com/32';
document.getElementById('userName').innerText = currentUser.displayName || 'Người dùng';

if (currentUser.email === ADMIN_EMAIL) {
    document.getElementById('navAdmin').style.display = 'flex';
} else {
    document.getElementById('navAdmin').style.display = 'none';
}
} else {
loginBtn.style.display = 'inline-block';
userProfile.style.display = 'none';
document.getElementById('navAdmin').style.display = 'none';
}
}

function toggleLogin() {
if (!auth) return alert("Hệ thống Firebase chưa được cấu hình đúng. Vui lòng kiểm tra mã nguồn.");
if (currentUser) {
auth.signOut().then(() => {
currentUser = null;
updateAuthUI();
alert("Đã đăng xuất thành công.");
});
} else {
if(firebaseConfig.apiKey === "YOUR_API_KEY") {
alert("⚠️ Lưu ý: Tính năng đồng bộ Google cần thay API Key thật trong source code. Hiện tại dữ liệu vẫn được lưu tốt trên máy (LocalStorage).");
} else {
const provider = new firebase.auth.GoogleAuthProvider();
auth.signInWithPopup(provider).then((result) => {
currentUser = result.user;
updateAuthUI();
alert(`Xin chào ${currentUser.displayName}! Dữ liệu của bạn sẽ tự động được đồng bộ lên đám mây.`);
loadDataFromFirebase();
}).catch(error => console.error("Lỗi đăng nhập:", error));
}
}
}

function syncDataToFirebase() {
if(!currentUser || !db) return;
db.collection('users').doc(currentUser.uid).set({
categories: categories,
documents: documents,
schedule: document.getElementById('scheduleBody').innerHTML,
notes: document.querySelector('.note-area').value,
todos: todos,
flashcards: flashcards,
focusMins: focusMins
}, { merge: true }).catch(err => console.log("Lỗi đồng bộ:", err));
}

function loadDataFromFirebase() {
if(!currentUser || !db) return;
db.collection('users').doc(currentUser.uid).get().then((doc) => {
if (doc.exists) {
const data = doc.data();

if(data.categories) {
categories = data.categories;
localStorage.setItem('savedCategories', JSON.stringify(categories));
}
if(data.documents) {
documents = data.documents;
localStorage.setItem('savedDocs', JSON.stringify(documents));
}
if(data.todos) {
todos = data.todos;
localStorage.setItem('todos', JSON.stringify(todos));
}
if(data.schedule) { 
document.getElementById('scheduleBody').innerHTML = data.schedule; 
localStorage.setItem('savedSchedule', data.schedule);
loadSchedule(); 
}
if(data.notes) {
document.querySelector('.note-area').value = data.notes;
localStorage.setItem('savedNotes', data.notes);
}
if(data.flashcards) {
flashcards = data.flashcards;
localStorage.setItem('flashcards', JSON.stringify(flashcards));
}
if(data.focusMins !== undefined) {
focusMins = data.focusMins;
localStorage.setItem('focusMins', focusMins);
}

renderCategories(); renderTodos(); renderFlashcards();
} else {
// Nếu user mới tinh chưa có data trên Cloud, hãy đẩy data hiện có ở LocalStorage lên Firebase
syncDataToFirebase();
}
}).catch(err => console.log(err));
}

// --- Init Logic ---
window.addEventListener('load', () => { 
// Init Theme
if(localStorage.getItem('theme') === 'light') {
document.documentElement.setAttribute('data-theme', 'light');
document.getElementById('themeIcon').className = 'fas fa-sun';
}

// Init Background Animation State
if(localStorage.getItem('bgAnimation') === 'off') {
    const toggle = document.getElementById('bgAnimToggle');
    if(toggle) toggle.checked = false;
    document.querySelector('.bg-animation').style.display = 'none';
}

// Init Customizations
const savedOpacity = localStorage.getItem('glassOpacity');
if(savedOpacity) { updateGlassOpacity(savedOpacity); const s = document.getElementById('glassOpacitySlider'); if(s) s.value = savedOpacity; }

const savedAccent = localStorage.getItem('accentColor');
if(savedAccent) { updateAccentColor(savedAccent); const c = document.getElementById('accentColorPicker'); if(c) c.value = savedAccent; }

const savedFont = localStorage.getItem('mainFont');
if(savedFont) { updateFont(savedFont); const f = document.getElementById('fontSelector'); if(f) f.value = savedFont; }

if(localStorage.getItem('soundEffects') === 'off') {
    const toggle = document.getElementById('soundEffectsToggle');
    if(toggle) toggle.checked = false;
}

loadSystemSettings(); // Load Global Notifications & Commission Rate

// Tự động kiểm tra đăng nhập khi vào trang nếu có Firebase
if (auth) {
auth.onAuthStateChanged(user => {
authReady = true; // Đã kiểm tra xong trạng thái
if(user) {
currentUser = user;
updateAuthUI();
loadDataFromFirebase();
loadAffiliates();
} else {
currentUser = null;
updateAuthUI();
setTimeout(() => showToast("Mẹo: Đăng nhập để tự động lưu và đồng bộ tiến trình học tập của bạn!", "info"), 3000);
renderAffiliates();
}
});
} else {
authReady = true; // Không có Firebase, tự động chạy chế độ Local
setTimeout(() => showToast("Đang chạy chế độ Local. Hãy cấu hình Firebase để lưu tiến trình trực tuyến!", "info"), 3000);
}

loadSchedule();
renderTodos();
renderCategories();
renderFlashcards();
loadYtHistory();
loadAffiliates();

// Init Target Date
const savedDate = localStorage.getItem('targetDate') || "2026-06-11";
const inputDate = document.getElementById('targetDateInput');
if(inputDate) inputDate.value = savedDate;
document.getElementById('targetDateDisplayHeader').innerText = `KÌ THI MỤC TIÊU (${new Date(savedDate).toLocaleDateString('vi-VN')})`;
});

// --- Toast Notification ---
function showToast(message, type = 'success') {
// Hỗ trợ tham số cũ isError (boolean) cho các chỗ code cũ
if (type === true) type = 'error';
if (type === false) type = 'success';

const container = document.getElementById('toastContainer');
if(!container) return;
const toast = document.createElement('div');

let icon = 'fa-check-circle';
let color = 'var(--success)';
toast.className = 'toast';

if (type === 'error') {
icon = 'fa-exclamation-circle';
color = 'var(--accent)';
toast.className = 'toast error';
} else if (type === 'info') {
icon = 'fa-bell ring-bell';
color = '#FFD700'; // Màu vàng nổi bật cho chuông
// Cùng lúc rung luôn nút Login trên thanh công cụ
const loginBtn = document.getElementById('loginBtn');
if (loginBtn && loginBtn.style.display !== 'none') {
loginBtn.classList.add('ring-bell');
setTimeout(() => loginBtn.classList.remove('ring-bell'), 3500);
}
}

toast.innerHTML = `<i class="fas ${icon}" style="color: ${color}"></i> <span>${message}</span>
<div class="toast-progress" style="background: ${color};"></div>`;
container.appendChild(toast);

setTimeout(() => toast.classList.add('show'), 10);
setTimeout(() => {
toast.classList.remove('show');
setTimeout(() => toast.remove(), 300);
}, 3000);
}

// --- Navigation ---
function toggleNavMenu() {
    document.getElementById('navSidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}
function switchTab(tabId) { document.querySelectorAll('.mode-section').forEach(el => el.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active')); document.getElementById(tabId).classList.add('active'); document.querySelectorAll('.nav-btn').forEach(btn => { if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active'); }); }
function toggleFullScreen() { if(!document.fullscreenElement) { document.documentElement.requestFullscreen(); document.getElementById('fsIcon').className='fas fa-compress'; } else { document.exitFullscreen(); document.getElementById('fsIcon').className='fas fa-expand'; } }
function toggleTheme() {
const html = document.documentElement;
const icon = document.getElementById('themeIcon');
const opacity = localStorage.getItem('glassOpacity') || '0.7';
if (html.getAttribute('data-theme') === 'dark') {
html.setAttribute('data-theme', 'light');
icon.className = 'fas fa-sun';
localStorage.setItem('theme', 'light');
document.documentElement.style.setProperty('--glass-bg', `rgba(255, 255, 255, ${opacity})`);
} else {
html.setAttribute('data-theme', 'dark');
icon.className = 'fas fa-moon';
localStorage.setItem('theme', 'dark');
document.documentElement.style.setProperty('--glass-bg', `rgba(30, 41, 59, ${opacity})`);
}
}

// --- YouTube Background Music Player ---
let ytHistory = getSafeData('ytHistory', []);
let isYtPaused = false;
function toggleMusicPanel() {
document.getElementById('musicPanel').classList.toggle('show');
}

function getYoutubeId(url) {
const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
const match = url.match(regExp);
return (match && match[2].length === 11) ? match[2] : null;
}

function playYoutubeMusic() {
const input = document.getElementById('ytLinkInput').value.trim();
if (!input) return showToast("Vui lòng dán link YouTube!", "error");

const videoId = getYoutubeId(input);
if (!videoId) return showToast("Link YouTube không hợp lệ!", "error");

const container = document.getElementById('ytPlayerContainer');
const vol = document.getElementById('ytVolume').value;

// Thêm enablejsapi=1 để có thể điều khiển âm lượng bằng JS
container.innerHTML = `<iframe id="ytIframe" width="10" height="10" src="https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&enablejsapi=1" allow="autoplay; encrypted-media" style="border:none;"></iframe>`;

document.getElementById('ytIframe').onload = function() {
this.contentWindow.postMessage(JSON.stringify({event: "command", func: "setVolume", args: [vol]}), '*');
};

// Lưu link vào lịch sử nếu chưa có
if (!ytHistory.includes(input)) {
ytHistory.unshift(input); // Thêm vào đầu mảng
if (ytHistory.length > 10) ytHistory.pop(); // Giới hạn 10 link gần nhất
localStorage.setItem('ytHistory', JSON.stringify(ytHistory));
loadYtHistory();
}
document.getElementById('musicIcon').className = 'fas fa-music ring-bell';
document.getElementById('musicIcon').style.color = 'var(--primary)';
document.getElementById('ytPauseBtn').style.display = 'block';
document.getElementById('ytPauseBtn').innerHTML = '<i class="fas fa-pause"></i> Dừng';
document.getElementById('audioWave').classList.add('playing');
isYtPaused = false;
showToast("Đang phát nhạc nền!", "success");
}

function togglePauseYoutubeMusic() {
const iframe = document.getElementById('ytIframe');
if (iframe && iframe.contentWindow) {
if (isYtPaused) {
iframe.contentWindow.postMessage(JSON.stringify({event: "command", func: "playVideo", args: []}), '*');
document.getElementById('ytPauseBtn').innerHTML = '<i class="fas fa-pause"></i> Dừng';
document.getElementById('musicIcon').className = 'fas fa-music ring-bell';
document.getElementById('audioWave').classList.add('playing');
isYtPaused = false;
} else {
iframe.contentWindow.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: []}), '*');
document.getElementById('ytPauseBtn').innerHTML = '<i class="fas fa-play"></i> Tiếp';
document.getElementById('musicIcon').className = 'fas fa-music';
document.getElementById('audioWave').classList.remove('playing');
isYtPaused = true;
}
}
}

function changeYtVolume(val) {
const iframe = document.getElementById('ytIframe');
if (iframe && iframe.contentWindow) {
iframe.contentWindow.postMessage(JSON.stringify({event: "command", func: "setVolume", args: [val]}), '*');
}
}

function stopYoutubeMusic() {
document.getElementById('ytPlayerContainer').innerHTML = '';
document.getElementById('musicIcon').className = 'fas fa-music';
document.getElementById('musicIcon').style.color = '';
document.getElementById('ytPauseBtn').style.display = 'none';
document.getElementById('audioWave').classList.remove('playing');
showToast("Đã tắt nhạc!", "info");
}

function loadYtHistory() {
const datalist = document.getElementById('ytHistory');
datalist.innerHTML = '';
ytHistory.forEach(link => {
const option = document.createElement('option');
option.value = link;
datalist.appendChild(option);
});
}

function clearYtHistory() {
if(confirm("Bạn có chắc chắn muốn xóa lịch sử link nhạc không?")) {
ytHistory = [];
localStorage.removeItem('ytHistory');
loadYtHistory();
showToast("Đã xóa lịch sử!", "success");
}
}

// --- Live Clock & Motivational Quote ---
setInterval(() => { document.getElementById('liveClock').innerText = new Date().toLocaleTimeString('vi-VN'); }, 1000);

const quotes = [
"\"Thành công không đến từ những gì bạn thỉnh thoảng làm, nó đến từ những gì bạn làm liên tục.\"",
"\"Trên bước đường thành công không có dấu chân của kẻ lười biếng.\"",
"\"Đừng chờ đợi cơ hội, hãy tạo ra nó.\"",
"\"Hãy làm việc khi người khác còn đang ngủ. Học hỏi khi họ đang tiệc tùng.\"",
"\"Cách tốt nhất để dự đoán tương lai là tạo ra nó.\""
];
setInterval(() => { document.getElementById('motivationalQuote').innerText = quotes[Math.floor(Math.random() * quotes.length)]; }, 15000);

// --- Countdown Logic ---
let targetDateStr = localStorage.getItem('targetDate') || "2026-06-11";
let targetDate = new Date(targetDateStr + "T00:00:00").getTime();

function updateTargetDate() {
    const newDate = document.getElementById('targetDateInput').value;
    if(newDate) {
        localStorage.setItem('targetDate', newDate);
        targetDateStr = newDate;
        targetDate = new Date(newDate + "T00:00:00").getTime();
        document.getElementById('targetDateDisplayHeader').innerText = `KÌ THI MỤC TIÊU (${new Date(newDate).toLocaleDateString('vi-VN')})`;
        showToast("Đã cập nhật ngày thi!");
    }
}

setInterval(() => {
const now = new Date().getTime(); const distance = targetDate - now;
if (distance > 0) {
document.getElementById("cdDays").innerText = Math.floor(distance / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
document.getElementById("cdHours").innerText = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
document.getElementById("cdMins").innerText = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
document.getElementById("cdSecs").innerText = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');
}
}, 1000);

// --- Circular SVG Timer ---
let timerSeconds = 3000; let totalSeconds = 3000; let timerInterval = null; let isTimerRunning = false;
const circle = document.getElementById('progressCircle');
const radius = circle.r.baseVal.value; const circumference = radius * 2 * Math.PI;
circle.style.strokeDasharray = `${circumference} ${circumference}`; circle.style.strokeDashoffset = 0;

function setProgress(percent) { const offset = circumference - percent / 100 * circumference; circle.style.strokeDashoffset = offset; }
function updateTimerDisplay() {
const timeString = `${Math.floor(timerSeconds / 60).toString().padStart(2, '0')}:${(timerSeconds % 60).toString().padStart(2, '0')}`;
document.getElementById('timerDisplay').innerText = timeString;

if(isTimerRunning) document.title = `(${timeString}) Luyện Thi`;
else document.title = `KHOAHOCVIP.IO.VN`;

if(totalSeconds > 0) setProgress((timerSeconds / totalSeconds) * 100);
}

function setTimer(mins, btn, phaseText) {
pauseTimer(); timerSeconds = mins * 60; totalSeconds = timerSeconds; updateTimerDisplay();
document.getElementById('timerPhase').innerText = phaseText;
document.querySelectorAll('.preset-btn').forEach(el => el.classList.remove('selected'));
if(btn) btn.classList.add('selected');
}

function setCustomTimer() {
const mins = parseInt(document.getElementById('customTime').value);
if(mins > 0) {
setTimer(mins, null, `TÙY CHỈNH (${mins} PHÚT)`);
document.getElementById('customTime').value = '';
} else {
alert("Vui lòng nhập số phút hợp lệ!");
}
}

function addTime(mins) { timerSeconds += (mins * 60); totalSeconds += (mins * 60); updateTimerDisplay(); }

function startTimer() {
if (isTimerRunning || timerSeconds <= 0) return;
isTimerRunning = true;
timerInterval = setInterval(() => {
timerSeconds--; updateTimerDisplay();

// Cảnh báo đỏ khi còn 5 phút
if(timerSeconds <= 300 && timerSeconds > 0) circle.style.stroke = "var(--accent)";
else circle.style.stroke = "var(--primary)";

if (timerSeconds <= 0) {
pauseTimer(); setProgress(0);

const isSoundEnabled = localStorage.getItem('soundEffects') !== 'off';
if(document.getElementById('soundToggle').checked && isSoundEnabled) {
    document.getElementById('alarmSound').play();
}

let minsCompleted = Math.floor(totalSeconds / 60);
focusMins += minsCompleted;
localStorage.setItem('focusMins', focusMins);
document.getElementById('focusMinsDisplay').innerText = focusMins;
syncDataToFirebase();

alert(`ĐÃ HẾT THỜI GIAN LÀM BÀI! Đã cộng ${minsCompleted} phút vào Thống kê.`);
}
}, 1000);
}
function pauseTimer() { clearInterval(timerInterval); isTimerRunning = false; }
function resetTimer() { pauseTimer(); timerSeconds = totalSeconds; updateTimerDisplay(); circle.style.stroke = "var(--primary)"; }
updateTimerDisplay();

// --- Smart Schedule & Palette ---
let currentBrush = 'transparent';
function setBrush(color, el) {
currentBrush = color;
document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
el.classList.add('active');
}
function applyBrush(td) { td.style.background = currentBrush; saveSchedule(); }

function addScheduleRow() {
const tbody = document.getElementById('scheduleBody'); const tr = document.createElement('tr');
for(let i=0; i<8; i++) {
const td = document.createElement('td'); td.contentEditable = "true";
td.oninput = saveSchedule;
if(i===0) { td.innerText = "Giờ mới"; }
else { td.onclick = function() { applyBrush(this); }; }
tr.appendChild(td);
} tbody.appendChild(tr);
saveSchedule();
}

function clearSchedule() {
if(confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch trình không?")) {
const tbody = document.getElementById('scheduleBody');
const defaultRow = `<tr><td contenteditable="true">Giờ mới</td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td><td contenteditable="true"></td></tr>`;
tbody.innerHTML = defaultRow;
saveSchedule(); // Lưu ngay dòng trống vào storage
loadSchedule(); 
}
}

// --- Local Storage Integration ---
function saveSchedule() {
localStorage.setItem('savedSchedule', document.getElementById('scheduleBody').innerHTML);
syncDataToFirebase();
remindLoginIfGuest();
}

function loadSchedule() {
const saved = localStorage.getItem('savedSchedule');
if (saved) {
document.getElementById('scheduleBody').innerHTML = saved;
}
const rows = document.getElementById('scheduleBody').querySelectorAll('tr');
rows.forEach(row => {
const cells = row.querySelectorAll('td');
cells.forEach((td, index) => {
td.oninput = saveSchedule;
if (index !== 0) { 
td.onclick = function() { applyBrush(this); };
}
});
});
}

const noteArea = document.querySelector('.note-area');
noteArea.value = localStorage.getItem('savedNotes') || noteArea.value;
noteArea.addEventListener('input', () => {
localStorage.setItem('savedNotes', noteArea.value);
syncDataToFirebase();
});

// --- Safe LocalStorage Parser ---
function getSafeData(key, fallback) {
try {
const data = localStorage.getItem(key);
if (!data) return fallback;
const parsed = JSON.parse(data);
if (Array.isArray(fallback)) {
return Array.isArray(parsed) ? parsed : fallback;
}
return parsed;
} catch(e) { return fallback; }
}

// --- To-Do List Logic ---
let todos = getSafeData('todos', [
{ text: "Làm 1 đề Toán minh họa", completed: false },
{ text: "Ôn từ vựng Tiếng Anh", completed: false }
]);

function renderTodos() {
const list = document.getElementById('todoList');
list.innerHTML = '';
todos.forEach((todo, index) => {
const li = document.createElement('li');
li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
li.innerHTML = `
<div>
<input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${index})">
<span>${todo.text}</span>
</div>
<button onclick="deleteTodo(${index})" title="Xóa"><i class="fas fa-trash"></i></button>
`;
list.appendChild(li);
});

let completedCount = todos.filter(t => t.completed).length;
let percent = todos.length === 0 ? 0 : (completedCount / todos.length) * 100;
document.getElementById('todoProgress').style.width = percent + '%';
document.getElementById('todoStats').innerText = `${completedCount}/${todos.length} Hoàn thành`;
localStorage.setItem('todos', JSON.stringify(todos));
syncDataToFirebase();
}

function addTodo() {
const input = document.getElementById('newTodo');
const text = input.value.trim();
if(text) {
todos.push({ text, completed: false });
input.value = '';
renderTodos();
}
}

function toggleTodo(index) { todos[index].completed = !todos[index].completed; renderTodos(); }
function deleteTodo(index) { todos.splice(index, 1); renderTodos(); }

// --- Kho Tài Liệu (Docs Mode) Logic ---
let categories = getSafeData('savedCategories', [
{ id: 'cat1', name: 'Toán Học' },
{ id: 'cat2', name: 'Vật Lý' },
{ id: 'cat3', name: 'Hóa Học' }
]);
let documents = getSafeData('savedDocs', [
{ id: 1, categoryId: 'cat1', title: 'Đề minh họa Toán 2025 BGD', type: 'link', url: '#', date: '10/06/2024' },
{ id: 2, categoryId: 'cat3', title: 'Tổng ôn Lý thuyết Hóa học', type: 'file', url: 'Tong_on_Hoa.pdf', date: '12/06/2024' }
]);
let currentCategoryId = null;

function renderCategories() {
document.getElementById('categoryGrid').style.display = 'grid';
document.getElementById('documentsContainer').style.display = 'none';
document.getElementById('addCategoryDiv').style.display = 'flex';
document.getElementById('docBreadcrumb').innerHTML = `<i class="fas fa-folder-open"></i> Kho Tài Liệu`;

const grid = document.getElementById('categoryGrid');
grid.innerHTML = '';
categories.forEach(cat => {
const docCount = documents.filter(d => d.categoryId === cat.id).length;
grid.innerHTML += `
<div class="doc-card" style="cursor: pointer;" onclick="openCategory('${cat.id}', '${cat.name}')">
<div>
<div class="doc-title" style="font-size: 1.5rem; color: #fbbf24;"><i class="fas fa-folder"></i> <span style="color: var(--primary); font-size: 1.2rem;">${cat.name}</span></div>
<div class="doc-meta" style="margin-top: 10px;">${docCount} tài liệu lưu trữ</div>
</div>
<div class="doc-actions">
<button class="doc-btn btn-delete" onclick="event.stopPropagation(); deleteCategory('${cat.id}')" title="Xóa thư mục"><i class="fas fa-trash"></i></button>
</div>
</div>
`;
});
localStorage.setItem('savedCategories', JSON.stringify(categories));
syncDataToFirebase();
}

function addCategory() {
const name = document.getElementById('newCategoryName').value.trim();
if(!name) return alert("Vui lòng nhập tên thư mục / môn học!");
categories.push({ id: 'cat_' + Date.now(), name });
document.getElementById('newCategoryName').value = '';
renderCategories();
remindLoginIfGuest();
}

function deleteCategory(id) {
if(confirm("Xóa thư mục sẽ xóa toàn bộ tài liệu bên trong! Bạn chắc chắn chứ?")) {
categories = categories.filter(c => c.id !== id);
documents = documents.filter(d => d.categoryId !== id);
localStorage.setItem('savedDocs', JSON.stringify(documents));
renderCategories();
}
}

function openCategory(id, name) {
currentCategoryId = id;
document.getElementById('categoryGrid').style.display = 'none';
document.getElementById('documentsContainer').style.display = 'block';
document.getElementById('addCategoryDiv').style.display = 'none';
document.getElementById('docBreadcrumb').innerHTML = `<i class="fas fa-arrow-left"></i> &nbsp; Kho Tài Liệu / <span style="color: var(--text-main);">${name}</span>`;
renderDocs();
}

function backToCategories() {
if(currentCategoryId) { currentCategoryId = null; renderCategories(); }
}

function renderDocs() {
const grid = document.getElementById('docsGrid');
grid.innerHTML = '';
const catDocs = documents.filter(d => d.categoryId === currentCategoryId);
catDocs.forEach(doc => {
const isLink = doc.type === 'link';
const icon = isLink ? 'fa-link' : 'fa-file-pdf';
const href = doc.url ? doc.url : '#';

grid.innerHTML += `
<div class="doc-card">
<div>
<div class="doc-title"><i class="fas ${icon}"></i> ${doc.title}</div>
<div class="doc-meta"><i class="fas fa-calendar-alt"></i> Thêm ngày: ${doc.date}</div>
</div>
<div class="doc-actions">
<button class="doc-btn btn-view" onclick="openDocViewer('${href}', '${doc.title}')"><i class="fas fa-eye"></i> Xem Trực Tiếp</button>
<a href="${href}" target="_blank" class="doc-btn" style="background: rgba(255,255,255,0.2); color: var(--text-main); border: 1px solid var(--glass-border);" title="Mở tab mới"><i class="fas fa-external-link-alt"></i></a>
<button class="doc-btn btn-delete" onclick="deleteDoc(${doc.id})"><i class="fas fa-trash"></i></button>
</div>
</div>
`;
});
localStorage.setItem('savedDocs', JSON.stringify(documents));
syncDataToFirebase();
}

async function addDocument() {
const title = document.getElementById('docTitle').value.trim();
const type = 'link';
let url = document.getElementById('docLink').value.trim();
let storagePath = null;

if(!title) return alert("Vui lòng nhập tên tài liệu!");
if(!url) return alert("Vui lòng nhập link tài liệu!");

const saveBtn = document.getElementById('saveDocBtn');
const originalBtnText = saveBtn.innerHTML;

showToast("Đã thêm liên kết tài liệu!");

documents.push({ id: Date.now(), categoryId: currentCategoryId, title, type, url, storagePath, date: new Date().toLocaleDateString('vi-VN') });

document.getElementById('docTitle').value = '';
document.getElementById('docLink').value = '';
renderDocs();
remindLoginIfGuest();
}

// --- Document Viewer ---
function openDocViewer(url, title) {
if(url.includes('drive.google.com/file/d/')) {
url = url.replace(/\/view(\?usp=sharing)?/, '/preview'); // Chuyển link drive sang chế độ preview để nhúng iframe
} else if (url.includes('firebasestorage.googleapis.com')) {
// Nếu là link Firebase, mượn Google Docs để xem trực tiếp các file Word/Excel/PPT (trừ PDF và ảnh)
const isPdfOrImg = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('.png') || url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg');
if (!isPdfOrImg) {
url = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
}
} else if (url.startsWith('blob:')) {
alert("Lỗi: Đây là file tạm lưu trên máy tính cũ. Vui lòng Xóa file này và tải lên lại (đảm bảo lúc tải lên bạn đang đăng nhập thành công)!");
return;
}
document.getElementById('docViewerTitle').innerHTML = `<i class="fas fa-file-alt"></i> ${title}`;
document.getElementById('docViewerIframe').src = url;
document.getElementById('docViewerModal').style.display = 'flex';
}
function closeDocViewer() {
document.getElementById('docViewerModal').style.display = 'none';
document.getElementById('docViewerIframe').src = '';
}

// --- Flashcards Logic ---
let flashcards = getSafeData('flashcards', []);
let currentFcIndex = 0;
let focusMins = getSafeData('focusMins', 0);

function renderFlashcards() {
const front = document.getElementById('fcFront');
const back = document.getElementById('fcBack');
const counter = document.getElementById('fcCounter');
document.getElementById('activeFlashcard').classList.remove('flipped');

if(flashcards.length === 0) {
front.innerText = 'Bấm nút Tạo Thẻ để thêm flashcard đầu tiên!';
back.innerText = 'Nhấp vào thẻ để lật qua lại.';
counter.innerText = '0 / 0';
} else {
front.innerText = flashcards[currentFcIndex].front;
back.innerText = flashcards[currentFcIndex].back;
counter.innerText = `${currentFcIndex + 1} / ${flashcards.length}`;
}
document.getElementById('focusMinsDisplay').innerText = focusMins;
}

function flipCard() { if(flashcards.length > 0) document.getElementById('activeFlashcard').classList.toggle('flipped'); }
function nextFlashcard() { if(flashcards.length > 0) { currentFcIndex = (currentFcIndex + 1) % flashcards.length; renderFlashcards(); } }
function prevFlashcard() { if(flashcards.length > 0) { currentFcIndex = (currentFcIndex - 1 + flashcards.length) % flashcards.length; renderFlashcards(); } }

function addFlashcard() {
const front = document.getElementById('newFlashcardFront').value.trim();
const back = document.getElementById('newFlashcardBack').value.trim();
if(!front || !back) return alert("Vui lòng nhập đầy đủ mặt trước và mặt sau!");

flashcards.push({ front, back });
document.getElementById('newFlashcardFront').value = '';
document.getElementById('newFlashcardBack').value = '';
currentFcIndex = flashcards.length - 1;

localStorage.setItem('flashcards', JSON.stringify(flashcards));
syncDataToFirebase(); renderFlashcards(); showToast("Đã thêm thẻ mới!");
}

function deleteCurrentFlashcard() {
if(flashcards.length === 0) return;
if(confirm("Bạn có chắc chắn muốn xóa thẻ này?")) {
flashcards.splice(currentFcIndex, 1);
if(currentFcIndex >= flashcards.length && currentFcIndex > 0) currentFcIndex--;
localStorage.setItem('flashcards', JSON.stringify(flashcards));
syncDataToFirebase(); renderFlashcards(); showToast("Đã xóa thẻ!");
}
}

async function deleteDoc(id) {
if(confirm("Bạn có chắc chắn muốn xóa tài liệu này không?")) {
const docToDelete = documents.find(d => d.id === id);

// Xóa file trên Storage nếu có
if (docToDelete && docToDelete.storagePath && storage) {
try {
await storage.ref(docToDelete.storagePath).delete();
showToast("Đã xóa file trên đám mây thành công!");
} catch (error) {
console.error("Lỗi xóa file trên Storage:", error);
showToast("Không thể xóa file trên đám mây!", true);
}
} else {
showToast("Đã xóa tài liệu!");
}

documents = documents.filter(d => d.id !== id);
renderDocs(); // Rerender current category
}
}

// ========= Affiliate Mode Logic (CTV & Đại Lý) =========
const ADMIN_EMAIL = "duongngoclam28022008@gmail.com";
let affiliates = getSafeData('affiliates', []);

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => showToast("Đã copy vào bộ nhớ đệm!"));
}

function copyRefLink(uid) {
    const link = window.location.origin + window.location.pathname + "?ref=" + uid;
    navigator.clipboard.writeText(link).then(() => showToast("Đã copy link giới thiệu!"));
}

function requestWithdraw() {
    if (!currentUser) return;
    const amountStr = prompt("Nhập số tiền bạn muốn rút (VNĐ):\nLưu ý: Bạn phải có đủ số dư trong tài khoản.", "50000");
    if (!amountStr) return;
    const amount = parseInt(amountStr.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) return showToast("Số tiền không hợp lệ!", "error");

    const proofData = { id: Date.now().toString(), course: 'Yêu cầu rút tiền', email: amount.toLocaleString('vi-VN') + ' đ', phone: '', proofImg: '', status: 'pending', date: new Date().toISOString(), type: 'withdrawal', amount: amount };

    if(db) {
        const docRef = db.collection('affiliates').doc(currentUser.uid);
        docRef.get().then(doc => {
            if(doc.exists) {
                const data = doc.data(); 
                if((data.totalEarned || 0) < amount) throw new Error("Số dư không đủ để rút!");
                const proofs = data.proofs || []; proofs.push(proofData);
                return docRef.update({ proofs });
            }
        }).then(() => showToast("Đã gửi yêu cầu rút tiền thành công!")).catch(err => showToast("Lỗi: " + err.message, "error"));
    } else {
        const aff = affiliates.find(a => a.id === currentUser.uid);
        if(aff) {
            if((aff.totalEarned || 0) < amount) return showToast("Lỗi: Số dư không đủ để rút!", "error");
            if(!aff.proofs) aff.proofs = []; aff.proofs.push(proofData);
            localStorage.setItem('affiliates', JSON.stringify(affiliates));
            showToast("Đã gửi yêu cầu rút tiền! (Local)"); renderAffiliates();
        }
    }
}

function submitAffiliate() {
if (!currentUser) return showToast("Vui lòng đăng nhập để đăng ký làm CTV!", "error");

const name = document.getElementById('affName').value.trim();
const phone = document.getElementById('affPhone').value.trim();
const dob = document.getElementById('affDob').value.trim();

if (!name || !phone || !dob) return showToast("Vui lòng điền đầy đủ thông tin!", "error");

const newAff = {
id: currentUser.uid,
name: name,
email: currentUser.email || "Chưa cung cấp Email", // Xử lý lỗi null email
phone: phone, 
dob: dob,
status: 'pending',
referrals: 0,
totalEarned: 0,
createdAt: new Date().toISOString()
};

if(db) {
db.collection('affiliates').doc(currentUser.uid).set(newAff)
.then(() => {
showToast("Đăng ký thành công! Đang chờ duyệt.");
document.getElementById('affiliateFormContainer').style.display = 'none';
})
.catch(err => {
console.warn("Lỗi Firebase:", err);
showToast("Đã lưu tạm thời! (Lý do: Máy chủ Firebase đang từ chối quyền ghi)", "info");
// Tự động lưu trữ dự phòng xuống LocalStorage nếu Firebase từ chối
const existingIndex = affiliates.findIndex(a => a.id === currentUser.uid);
if(existingIndex >= 0) affiliates[existingIndex] = newAff;
else affiliates.push(newAff);
localStorage.setItem('affiliates', JSON.stringify(affiliates));
renderAffiliates();
});
} else {
const existingIndex = affiliates.findIndex(a => a.id === currentUser.uid);
if(existingIndex >= 0) affiliates[existingIndex] = newAff;
else affiliates.push(newAff);
localStorage.setItem('affiliates', JSON.stringify(affiliates));
showToast("Đăng ký thành công! (Chế độ Local)");
loadAffiliates();
}
}

function loadAffiliates() {
if(db) {
db.collection('affiliates').onSnapshot(snapshot => {
affiliates = [];
snapshot.forEach(doc => affiliates.push(doc.data()));
renderAffiliates();
});
} else {
renderAffiliates();
}
}

function renderAffiliates() {
const statusDiv = document.getElementById('affiliateStatus');
const adminContainer = document.getElementById('adminTableContainer');
const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;

if(adminContainer) adminContainer.innerHTML = '';

// --- 1. Render giao diện người dùng cá nhân ---
if (currentUser) {
document.getElementById('affEmail').value = currentUser.email;
document.getElementById('affEmail').readOnly = true; // Khóa trường email
document.getElementById('affEmail').style.opacity = '0.6';
const myData = affiliates.find(a => a.id === currentUser.uid);
if (myData) {
if (myData.status === 'pending') {
statusDiv.innerHTML = `<i class="fas fa-hourglass-half" style="color: #f5af19; font-size: 2.5rem; margin-bottom: 10px; display: block;"></i> <strong style="color: #f5af19;">Đang chờ duyệt</strong><br><span style="font-size: 0.95rem; color: var(--text-muted); display: block; margin-top: 10px;">Hồ sơ của bạn đã được gửi. Quản trị viên sẽ sớm liên hệ và xét duyệt!</span>`;
document.getElementById('affiliateFormContainer').style.display = 'none';
document.getElementById('affiliateStatus').parentElement.style.gridColumn = '1 / -1';
} else if (myData.status === 'approved') {

let userProofsHtml = '';
if (myData.proofs && myData.proofs.length > 0) {
    userProofsHtml = `<div style="margin-top: 15px; text-align: left; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px;">
        <h4 style="color: var(--text-main); margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-history"></i> Lịch sử hoạt động</h4>
        <ul style="list-style: none; padding: 0; font-size: 0.85rem; color: var(--text-muted); max-height: 150px; overflow-y: auto;">
            ${myData.proofs.slice().reverse().map(p => `
                <li style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>Khóa <b>${p.course}</b> (${p.email})</span>
                    <span>${p.status === 'pending' ? '<span style="color: #f5af19;"><i class="fas fa-clock"></i> Chờ duyệt</span>' : 
                     (p.status === 'approved' ? '<span style="color: var(--success);"><i class="fas fa-check"></i> Đã duyệt</span>' : 
                     `<span style="color: var(--accent);" title="${p.rejectReason || ''}"><i class="fas fa-times"></i> Từ chối</span>`)}</span>
                </li>
            `).join('')}
        </ul>
    </div>`;
}

statusDiv.innerHTML = `
<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--glass-border); padding-bottom: 10px; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
    <div><i class="fas fa-check-circle" style="color: var(--success); font-size: 1.5rem; vertical-align: middle;"></i> <strong style="color: var(--success); font-size: 1.1rem; vertical-align: middle;"> CTV Chính Thức</strong></div>
    <div style="text-align: right;"><span style="font-size: 0.85rem; color: var(--text-muted);">Mã:</span> <b style="color: var(--text-main);">${myData.id.substring(0,8).toUpperCase()}</b> <button class="action-btn" style="padding: 4px 8px; font-size: 0.8rem; margin-left: 5px;" onclick="copyRefLink('${myData.id}')"><i class="fas fa-link"></i> Copy Link</button></div>
</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 15px;">
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid var(--primary);">
        <span style="font-size: 0.85rem; color: var(--text-muted);">Số lượt giới thiệu</span><br><strong style="font-size: 1.8rem; color: var(--primary);">${myData.referrals || 0}</strong>
    </div>
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid var(--success);">
        <span style="font-size: 0.85rem; color: var(--text-muted);">Số dư hiện tại</span><br><strong style="font-size: 1.8rem; color: var(--success);">${(myData.totalEarned || 0).toLocaleString('vi-VN')} đ</strong>
    </div>
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid var(--accent); display: flex; align-items: center; justify-content: center;">
        <button class="action-btn" style="background: var(--accent); color: white; border: none; padding: 10px; width: 100%;" onclick="requestWithdraw()"><i class="fas fa-money-bill-wave"></i> Rút Tiền</button>
    </div>
</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid var(--glass-border); text-align: left;">
        <h4 style="color: var(--primary); margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-university"></i> Ngân hàng nhận tiền</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;"><input type="text" id="bankName" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="Tên Ngân Hàng" value="${myData.bankName || ''}"><input type="text" id="bankAcc" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="Số Tài Khoản" value="${myData.bankAcc || ''}"><input type="text" id="bankOwner" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="Chủ Tài Khoản" value="${myData.bankOwner || ''}"><button class="action-btn" style="background: var(--primary); color: white; border: none; padding: 6px;" onclick="updateBankInfo()"><i class="fas fa-save"></i> Lưu</button></div>
    </div>
    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid var(--glass-border); text-align: left;">
        <h4 style="color: var(--accent); margin-bottom: 10px; font-size: 0.95rem;"><i class="fas fa-file-upload"></i> Báo cáo đơn mới</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;"><input type="text" id="refCourse" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="Khóa học (VD: XPS 2K9)"><input type="email" id="refEmail" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="Email học viên"><input type="tel" id="refPhone" class="doc-input" style="padding: 8px; font-size: 0.9rem;" placeholder="SĐT học viên"><div style="display: flex; gap: 5px;"><input type="file" id="refFile" class="doc-input" accept="image/*" style="padding: 4px; font-size: 0.8rem; flex: 1;"><button class="action-btn" style="background: var(--success); color: white; border: none; padding: 6px 12px;" onclick="submitReferralProof()"><i class="fas fa-paper-plane"></i></button></div></div>
    </div>
</div>
${userProofsHtml}`;
document.getElementById('affiliateFormContainer').style.display = 'none';
document.getElementById('affiliateStatus').parentElement.style.gridColumn = '1 / -1';
}
} else {
statusDiv.innerHTML = "Bạn chưa đăng ký tham gia chương trình. Điền form bên cạnh để bắt đầu kiếm thêm thu nhập!";
document.getElementById('affiliateFormContainer').style.display = 'block';
document.getElementById('affiliateStatus').parentElement.style.gridColumn = 'auto';
}
} else {
statusDiv.innerHTML = "Vui lòng đăng nhập hoặc gửi đăng ký để xem trạng thái.";
document.getElementById('affiliateFormContainer').style.display = 'block';
document.getElementById('affiliateStatus').parentElement.style.gridColumn = 'auto';
}

// Render Leaderboard
const leaderboardDiv = document.getElementById('affiliateLeaderboard');
if(leaderboardDiv) {
    const topAffiliates = [...affiliates].filter(a => a.status === 'approved' && a.totalEarned > 0).sort((a, b) => (b.totalEarned || 0) - (a.totalEarned || 0)).slice(0, 5);
    if(topAffiliates.length === 0) {
        leaderboardDiv.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 15px;">Chưa có dữ liệu xếp hạng doanh thu.</div>';
    } else {
        leaderboardDiv.innerHTML = topAffiliates.map((a, index) => {
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            return `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 12px 15px; border-radius: 10px; border-left: 4px solid var(--primary); animation: fadeUp 0.4s ease forwards; animation-delay: ${index*0.1}s; opacity: 0;">
                <span><strong style="font-size: 1.3rem; margin-right: 10px;">${medal}</strong> <b style="font-size: 1.05rem;">${a.name}</b> <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 5px;">(Mã: ${a.id.substring(0,6).toUpperCase()})</span></span>
                <strong style="color: var(--success); font-size: 1.1rem;">${(a.totalEarned || 0).toLocaleString('vi-VN')} đ</strong>
            </div>`;
        }).join('');
    }
}

// --- 2. Render giao diện Bảng Điều Khiển Admin ---
if (isAdmin && adminContainer) {
    
    // Cập nhật Thống kê
    let totalPending = 0; let pendingProofs = 0; let totalMoney = 0;
    affiliates.forEach(a => {
        if(a.status === 'pending') totalPending++;
        if(a.totalEarned) totalMoney += a.totalEarned;
        if(a.proofs) pendingProofs += a.proofs.filter(p => p.status === 'pending').length;
    });
    document.getElementById('adminStatTotal').innerText = affiliates.length;
    document.getElementById('adminStatPending').innerText = totalPending;
    document.getElementById('adminStatProofs').innerText = pendingProofs;
    document.getElementById('adminStatMoney').innerText = totalMoney.toLocaleString('vi-VN') + 'đ';

    if (affiliates.length === 0) {
        adminContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Chưa có dữ liệu CTV nào.</div>';
        return;
    }

    let html = `<div style="overflow-x: auto;"><table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 800px;">
<thead><tr style="border-bottom: 1px solid var(--glass-border);">
    <th style="padding: 10px;">CTV Info</th>
    <th style="padding: 10px;">Trạng thái</th>
    <th style="padding: 10px;">Thống kê & Ngân Hàng</th>
    <th style="padding: 10px; text-align: right;">Hành động & Duyệt đơn</th>
</tr></thead>
<tbody>`;

affiliates.forEach(aff => {
const statusBadge = aff.status === 'approved' 
? `<span style="background: rgba(52, 211, 153, 0.2); color: var(--success); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Đã duyệt</span>`
: `<span style="background: rgba(245, 175, 25, 0.2); color: #f5af19; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">Chờ duyệt</span>`;

let proofsAdminHtml = '';
if (isAdmin && aff.proofs && aff.proofs.length > 0) {
    const pendingProofs = aff.proofs.filter(p => p.status === 'pending');
    if (pendingProofs.length > 0) {
        proofsAdminHtml = `<div style="margin-top: 10px; text-align: left; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 5px; border-left: 3px solid #f5af19;">
            <div style="font-size: 0.8rem; color: #f5af19; margin-bottom: 5px;"><b>${pendingProofs.length} Đơn chờ duyệt:</b></div>
            ${pendingProofs.map(p => `
                <div style="font-size: 0.8rem; margin-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 5px;">
                    ${p.type === 'withdrawal' ? `<b style="color: var(--accent);"><i class="fas fa-money-check-alt"></i> Yêu cầu rút tiền:</b> ${p.email}<br>` : 
                    `Khóa: <b style="color:var(--primary);">${p.course}</b><br>HV: ${p.email} - ${p.phone}<br>
                    <a href="${p.proofImg}" target="_blank" style="color: #38bdf8; text-decoration: underline;"><i class="fas fa-image"></i> Xem Bill chuyển khoản</a><br>`}
                    <div style="margin-top: 5px; display: flex; gap: 5px;">
                        <button onclick="approveProof('${aff.id}', '${p.id}')" style="background:var(--success); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; flex: 1;"><i class="fas fa-check"></i> ${p.type === 'withdrawal' ? 'Duyệt Rút' : 'Duyệt (Trả HH)'}</button>
                        <button onclick="rejectProof('${aff.id}', '${p.id}')" style="background:var(--accent); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; flex: 1;"><i class="fas fa-times"></i> Từ chối</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }
}

html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
<td style="padding: 10px; vertical-align: top;">
    <span style="font-weight: 600;">${aff.name}</span><br>
    <span style="font-size: 0.85rem; color: var(--text-muted);">${aff.email}<br><i class="fas fa-phone"></i> ${aff.phone}</span>
</td>
<td style="padding: 10px; vertical-align: top;">${statusBadge}</td>
<td style="padding: 10px; font-size: 0.85rem; vertical-align: top;">
    Lượt: <b style="color: var(--primary);">${aff.referrals || 0}</b><br>
    Tiền: <b style="color: var(--success);">${(aff.totalEarned || 0).toLocaleString('vi-VN')}đ</b>
    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.1); color: var(--text-muted);">
        ${aff.bankName ? `Ngân hàng: <b>${aff.bankName}</b><br>STK: <b>${aff.bankAcc}</b><br>Tên: <b>${aff.bankOwner}</b>` : 'Chưa có thông tin NH'}
    </div>
</td>
<td style="padding: 10px; text-align: right; vertical-align: top; min-width: 250px;">
    ${aff.status === 'pending' ? `<button class="action-btn" style="background: var(--success); color: white; border: none; padding: 5px 10px; font-size: 0.8rem; margin-bottom: 5px;" onclick="approveAffiliate('${aff.id}')"><i class="fas fa-check"></i> Duyệt CTV</button>` : `<button class="action-btn" style="background: var(--primary); color: white; border: none; padding: 5px 10px; font-size: 0.8rem; margin-bottom: 5px;" onclick="addCommission('${aff.id}')" title="Thêm lượt giới thiệu trực tiếp">+ Cộng Tiền Thủ Công</button> <button class="action-btn" style="background: #f5af19; color: white; border: none; padding: 5px 10px; font-size: 0.8rem; margin-bottom: 5px;" onclick="revokeAffiliate('${aff.id}')">Hạ cấp CTV</button>`}
    <button class="action-btn" style="background: var(--accent); color: white; border: none; padding: 5px 10px; font-size: 0.8rem; margin-bottom: 5px;" onclick="deleteAffiliate('${aff.id}')" title="Xóa hoàn toàn tài khoản khỏi danh sách"><i class="fas fa-trash"></i> Xóa CTV</button>
    ${proofsAdminHtml}
</td>
</tr>`;
});
    html += `</tbody></table></div>`;
    adminContainer.innerHTML = html;
}
}

function approveAffiliate(uid) {
if(db) { db.collection('affiliates').doc(uid).update({ status: 'approved' }).then(() => showToast("Đã duyệt CTV!")).catch(err => showToast("Lỗi: " + err.message, "error")); } 
else { const aff = affiliates.find(a => a.id === uid); if(aff) aff.status = 'approved'; localStorage.setItem('affiliates', JSON.stringify(affiliates)); renderAffiliates(); showToast("Đã duyệt CTV! (Local)"); }
}

function revokeAffiliate(uid) {
if(db) { db.collection('affiliates').doc(uid).update({ status: 'pending' }).then(() => showToast("Đã hủy quyền CTV!")).catch(err => showToast("Lỗi: " + err.message, "error")); } 
else { const aff = affiliates.find(a => a.id === uid); if(aff) aff.status = 'pending'; localStorage.setItem('affiliates', JSON.stringify(affiliates)); renderAffiliates(); showToast("Đã hủy quyền CTV! (Local)"); }
}

function deleteAffiliate(uid) {
if(!confirm("CẢNH BÁO: Bạn có chắc chắn muốn XÓA HOÀN TOÀN CTV này khỏi hệ thống không? Dữ liệu không thể khôi phục!")) return;
if(db) {
    db.collection('affiliates').doc(uid).delete().then(() => showToast("Đã xóa CTV hoàn toàn khỏi hệ thống!")).catch(err => showToast("Lỗi: " + err.message, "error"));
} else {
    affiliates = affiliates.filter(a => a.id !== uid);
    localStorage.setItem('affiliates', JSON.stringify(affiliates));
    renderAffiliates();
    showToast("Đã xóa CTV (Local)!");
}
}

function addCommission(uid) {
const amountStr = prompt("Nhập số tiền hoa hồng cộng thêm cho đơn này (VNĐ):\n(Mỗi lần nhập sẽ tự động tăng 1 lượt giới thiệu)", "100000");
if (!amountStr) return;
const amount = parseInt(amountStr.replace(/[^0-9]/g, ''));
if (isNaN(amount) || amount <= 0) return showToast("Số tiền không hợp lệ!", "error");

if(db) {
const docRef = db.collection('affiliates').doc(uid);
docRef.get().then(doc => {
if(doc.exists) { const data = doc.data(); return docRef.update({ referrals: (data.referrals || 0) + 1, totalEarned: (data.totalEarned || 0) + amount }); }
}).then(() => showToast("Đã ghi nhận đơn thành công!")).catch(err => showToast("Lỗi: " + err.message, "error"));
} else {
const aff = affiliates.find(a => a.id === uid);
if(aff) { aff.referrals = (aff.referrals || 0) + 1; aff.totalEarned = (aff.totalEarned || 0) + amount; localStorage.setItem('affiliates', JSON.stringify(affiliates)); renderAffiliates(); showToast("Đã ghi nhận đơn! (Local)"); }
}
}

function updateBankInfo() {
    if (!currentUser) return;
    const bankName = document.getElementById('bankName').value.trim();
    const bankAcc = document.getElementById('bankAcc').value.trim();
    const bankOwner = document.getElementById('bankOwner').value.trim();
    
    if (!bankName || !bankAcc || !bankOwner) return showToast("Vui lòng nhập đủ thông tin ngân hàng!", "error");
    
    if(db) {
        db.collection('affiliates').doc(currentUser.uid).update({ bankName, bankAcc, bankOwner })
        .then(() => showToast("Cập nhật thông tin ngân hàng thành công!"))
        .catch(err => showToast("Lỗi: " + err.message, "error"));
    } else {
        const aff = affiliates.find(a => a.id === currentUser.uid);
        if(aff) {
            aff.bankName = bankName; aff.bankAcc = bankAcc; aff.bankOwner = bankOwner;
            localStorage.setItem('affiliates', JSON.stringify(affiliates));
            showToast("Đã cập nhật (Local)"); renderAffiliates();
        }
    }
}

function submitReferralProof() {
    if (!currentUser) return;
    const course = document.getElementById('refCourse').value.trim();
    const email = document.getElementById('refEmail').value.trim();
    const phone = document.getElementById('refPhone').value.trim();
    const fileInput = document.getElementById('refFile');
    
    if (!course || !email || !phone) return showToast("Vui lòng điền đủ thông tin học viên!", "error");
    if (!fileInput.files || fileInput.files.length === 0) return showToast("Vui lòng tải lên ảnh bill chuyển khoản!", "error");
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Img = e.target.result;
        const proofData = { id: Date.now().toString(), course, email, phone, proofImg: base64Img, status: 'pending', date: new Date().toISOString() };
        if(db) {
            const docRef = db.collection('affiliates').doc(currentUser.uid);
            docRef.get().then(doc => {
                if(doc.exists) {
                    const data = doc.data(); const proofs = data.proofs || []; proofs.push(proofData);
                    return docRef.update({ proofs });
                }
            }).then(() => showToast("Đã gửi báo cáo thành công! Vui lòng chờ Admin duyệt.")).catch(err => showToast("Lỗi: " + err.message, "error"));
        } else {
            const aff = affiliates.find(a => a.id === currentUser.uid);
            if(aff) {
                if(!aff.proofs) aff.proofs = []; aff.proofs.push(proofData);
                localStorage.setItem('affiliates', JSON.stringify(affiliates));
                showToast("Đã gửi báo cáo! (Local)"); renderAffiliates();
            }
        }
    };
    reader.readAsDataURL(file);
}

function approveProof(uid, proofId) {
    if(db) {
        const docRef = db.collection('affiliates').doc(uid);
        docRef.get().then(doc => {
            if(doc.exists) {
                const data = doc.data(); const proofs = data.proofs || [];
                const pIndex = proofs.findIndex(p => p.id === proofId); 
                if (pIndex > -1) { 
                    const p = proofs[pIndex];
                    if (p.type === 'withdrawal') {
                        p.status = 'approved';
                        return docRef.update({ proofs, totalEarned: (data.totalEarned || 0) - (p.amount || 0) });
                    } else {
                        const amountStr = prompt("Nhập số tiền hoa hồng cho đơn này (VNĐ):\n(Hệ thống sẽ duyệt đơn và tự động cộng tiền)", "100000");
                        if (!amountStr) throw new Error("Đã hủy duyệt");
                        const amount = parseInt(amountStr.replace(/[^0-9]/g, ''));
                        if (isNaN(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ!");
                        p.status = 'approved';
                        return docRef.update({ proofs, referrals: (data.referrals || 0) + 1, totalEarned: (data.totalEarned || 0) + amount });
                    }
                }
            }
        }).then(() => showToast("Đã xử lý yêu cầu thành công!")).catch(err => { if(err.message !== "Đã hủy duyệt") showToast("Lỗi: " + err.message, "error") });
    } else {
        const aff = affiliates.find(a => a.id === uid);
        if(aff) {
            if(!aff.proofs) aff.proofs = []; const pIndex = aff.proofs.findIndex(p => p.id === proofId);
            if (pIndex > -1) {
                const p = aff.proofs[pIndex];
                if (p.type === 'withdrawal') {
                    p.status = 'approved';
                    aff.totalEarned = (aff.totalEarned || 0) - (p.amount || 0);
                    showToast("Đã duyệt rút tiền! (Local)");
                } else {
                    const amountStr = prompt("Nhập số tiền hoa hồng cho đơn này (VNĐ):", "100000");
                    if (!amountStr) return;
                    const amount = parseInt(amountStr.replace(/[^0-9]/g, ''));
                    p.status = 'approved';
                    aff.referrals = (aff.referrals || 0) + 1; aff.totalEarned = (aff.totalEarned || 0) + amount; 
                    showToast("Đã duyệt đơn! (Local)");
                }
            }
            localStorage.setItem('affiliates', JSON.stringify(affiliates)); renderAffiliates(); 
        }
    }
}

function rejectProof(uid, proofId) {
    const reason = prompt("Nhập lý do từ chối đơn này (Ví dụ: Chuyển khoản thiếu, Bill giả...):");
    if (reason === null) return; // Hủy

    if(db) {
        const docRef = db.collection('affiliates').doc(uid);
        docRef.get().then(doc => {
            if(doc.exists) {
                const data = doc.data(); const proofs = data.proofs || [];
                const pIndex = proofs.findIndex(p => p.id === proofId); 
                if (pIndex > -1) { proofs[pIndex].status = 'rejected'; proofs[pIndex].rejectReason = reason || 'Quản trị viên từ chối'; }
                return docRef.update({ proofs });
            }
        }).then(() => showToast("Đã từ chối đơn!", "info")).catch(err => showToast("Lỗi: " + err.message, "error"));
    } else {
        const aff = affiliates.find(a => a.id === uid);
        if(aff && aff.proofs) {
            const pIndex = aff.proofs.findIndex(p => p.id === proofId);
            if (pIndex > -1) { aff.proofs[pIndex].status = 'rejected'; aff.proofs[pIndex].rejectReason = reason || 'Quản trị viên từ chối'; }
            localStorage.setItem('affiliates', JSON.stringify(affiliates)); renderAffiliates(); showToast("Đã từ chối đơn! (Local)", "info"); 
        }
    }
}

// ========= System Settings & Admin Global =========
function loadSystemSettings() {
    if(db) {
        db.collection('system').doc('settings').onSnapshot(doc => {
            if(doc.exists) {
                const data = doc.data();
                if(data.notification) {
                    document.getElementById('globalNotification').style.display = 'block';
                    document.getElementById('globalNotifText').innerText = data.notification;
                } else {
                    document.getElementById('globalNotification').style.display = 'none';
                }
                if(data.commissionRate) {
                    const displays = document.querySelectorAll('#displayCommissionBanner, #displayCommissionRateStatus');
                    displays.forEach(el => el.innerText = data.commissionRate + '%');
                    if(document.getElementById('adminCommissionRate')) document.getElementById('adminCommissionRate').value = data.commissionRate;
                }
            }
        });
    } else {
        const notif = localStorage.getItem('globalNotification');
        if(notif) {
            document.getElementById('globalNotification').style.display = 'block';
            document.getElementById('globalNotifText').innerText = notif;
        }
        const rate = localStorage.getItem('commissionRate');
        if(rate) {
            const displays = document.querySelectorAll('#displayCommissionBanner, #displayCommissionRateStatus');
            displays.forEach(el => el.innerText = rate + '%');
            if(document.getElementById('adminCommissionRate')) document.getElementById('adminCommissionRate').value = rate;
        }
    }
}

function updateGlobalNotif() {
    const text = document.getElementById('adminNotifInput').value.trim();
    if(!text) return;
    if(db) { db.collection('system').doc('settings').set({ notification: text }, { merge: true }).then(() => showToast('Đã phát thông báo!')); } 
    else { localStorage.setItem('globalNotification', text); showToast('Đã phát thông báo! (Local)'); loadSystemSettings(); }
}

function clearGlobalNotif() {
    if(db) { db.collection('system').doc('settings').set({ notification: '' }, { merge: true }).then(() => showToast('Đã tắt thông báo!')); } 
    else { localStorage.removeItem('globalNotification'); showToast('Đã tắt thông báo! (Local)'); document.getElementById('globalNotification').style.display = 'none'; }
    document.getElementById('adminNotifInput').value = '';
}

function updateCommissionRate() {
    const rate = document.getElementById('adminCommissionRate').value;
    if(!rate) return;
    if(db) { db.collection('system').doc('settings').set({ commissionRate: rate }, { merge: true }).then(() => showToast('Đã lưu tỷ lệ hoa hồng!')); } 
    else { localStorage.setItem('commissionRate', rate); showToast('Đã lưu tỷ lệ hoa hồng! (Local)'); loadSystemSettings(); }
}

function exportAffiliatesCSV() {
    if(affiliates.length === 0) return showToast("Không có dữ liệu!", "error");
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Chuẩn UTF-8 để mở bằng Excel không lỗi font
    csvContent += "Mã CTV,Họ Tên,Email,SĐT,Ngày Sinh,Trạng Thái,Lượt Giới Thiệu,Tổng Thu Nhập (VNĐ),Ngân Hàng,STK,Chủ TK\n";
    affiliates.forEach(a => {
        let row = `"${a.id}","${a.name}","${a.email}","${a.phone}","${a.dob}","${a.status}","${a.referrals||0}","${a.totalEarned||0}","${a.bankName||''}","${a.bankAcc||''}","${a.bankOwner||''}"`;
        csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Danh_sach_CTV_KhoahocVIP.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Đã xuất file CSV!");
}

// ========= Settings Logic =========
function toggleBgAnimation() {
    const isChecked = document.getElementById('bgAnimToggle').checked;
    document.querySelector('.bg-animation').style.display = isChecked ? 'block' : 'none';
    localStorage.setItem('bgAnimation', isChecked ? 'on' : 'off');
}

function updateGlassOpacity(val) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const rgb = isLight ? '255, 255, 255' : '30, 41, 59';
    document.documentElement.style.setProperty('--glass-bg', `rgba(${rgb}, ${val})`);
    localStorage.setItem('glassOpacity', val);
}

function updateAccentColor(val) {
    document.documentElement.style.setProperty('--accent', val);
    localStorage.setItem('accentColor', val);
}

function updateFont(val) {
    document.documentElement.style.setProperty('--main-font', val);
    localStorage.setItem('mainFont', val);
}

function toggleSoundEffects() {
    const isChecked = document.getElementById('soundEffectsToggle').checked;
    localStorage.setItem('soundEffects', isChecked ? 'on' : 'off');
}

function exportLocalData() {
    const dataToExport = {
        todos: localStorage.getItem('todos'),
        savedCategories: localStorage.getItem('savedCategories'),
        savedDocs: localStorage.getItem('savedDocs'),
        flashcards: localStorage.getItem('flashcards'),
        savedSchedule: localStorage.getItem('savedSchedule'),
        focusMins: localStorage.getItem('focusMins')
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "khoahocvip_backup.json");
    dlAnchorElem.click();
    showToast("Đã xuất file sao lưu!");
}

function importLocalData(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(data.todos) localStorage.setItem('todos', data.todos);
            if(data.savedCategories) localStorage.setItem('savedCategories', data.savedCategories);
            if(data.savedDocs) localStorage.setItem('savedDocs', data.savedDocs);
            if(data.flashcards) localStorage.setItem('flashcards', data.flashcards);
            if(data.savedSchedule) localStorage.setItem('savedSchedule', data.savedSchedule);
            if(data.focusMins !== undefined) localStorage.setItem('focusMins', data.focusMins);
            alert("Đã khôi phục dữ liệu thành công! Trang sẽ tải lại.");
            location.reload();
        } catch(err) { showToast("File không hợp lệ hoặc bị lỗi!", "error"); }
    };
    reader.readAsText(file);
}

function resetAppearance() {
    if(confirm("Khôi phục toàn bộ cài đặt Giao diện (Màu sắc, Font chữ, Chế độ sáng tối) về mặc định? Dữ liệu học tập vẫn sẽ được giữ nguyên!")) {
        localStorage.removeItem('theme');
        localStorage.removeItem('bgAnimation');
        localStorage.removeItem('glassOpacity');
        localStorage.removeItem('accentColor');
        localStorage.removeItem('mainFont');
        location.reload();
    }
}

function clearAllData() {
    if(confirm("CẢNH BÁO: Hành động này sẽ XÓA TOÀN BỘ tiến trình học tập, lịch, tài liệu lưu trên máy tính này. Bạn có chắc chắn muốn tiếp tục?")) {
        localStorage.clear();
        alert("Đã khôi phục cài đặt gốc thành công. Trang sẽ tự động tải lại.");
        location.reload();
    }
}

// Export to Image using html2canvas
function exportImage() {
const captureArea = document.getElementById('tabSchedule');
// Tạm thời ẩn các nút/vùng không cần thiết khi chụp ảnh
const originalBackground = captureArea.style.background;
captureArea.style.background = "var(--glass-bg)"; // Đổ nền để ảnh không bị trong suốt

html2canvas(captureArea, { backgroundColor: "#1a1a2e", scale: 2, logging: false }).then(canvas => {
const link = document.createElement('a');
link.download = 'Thoi-gian-bieu-khoahocvip.png';
link.href = canvas.toDataURL("image/png");
link.click();
captureArea.style.background = originalBackground;
});
}

// ========= Sheet Mode Logic =========
const sheetIframe = document.getElementById('sheet-iframe');

let sheetZoomLevel = Number(localStorage.getItem('sheetZoom') || '1');
function applySheetZoom() {
if(!sheetIframe) return;
sheetIframe.style.transform = `scale(${sheetZoomLevel})`;
sheetIframe.style.width = (100 / sheetZoomLevel) + '%';
sheetIframe.style.height = (100 / sheetZoomLevel) + '%';
localStorage.setItem('sheetZoom', String(sheetZoomLevel));
}

function clampSheetZoom(z){ return Math.min(2.0, Math.max(0.5, Math.round(z*10)/10)); }

const btnZoomIn = document.getElementById('zoom-in');
const btnZoomOut = document.getElementById('zoom-out');
const btnZoomReset = document.getElementById('zoom-reset');

if(btnZoomIn) btnZoomIn.onclick = () => { sheetZoomLevel = clampSheetZoom(sheetZoomLevel + 0.1); applySheetZoom(); };
if(btnZoomOut) btnZoomOut.onclick = () => { sheetZoomLevel = clampSheetZoom(sheetZoomLevel - 0.1); applySheetZoom(); };
if(btnZoomReset) btnZoomReset.onclick = () => { sheetZoomLevel = 1; applySheetZoom(); };

window.addEventListener('keydown', (e) => {
    if (['INPUT','TEXTAREA'].includes((e.target.tagName||'').toUpperCase())) return;
    // Chỉ áp dụng shortcut nếu người dùng đang ở tab Sheet
    if (document.getElementById('tabSheet') && document.getElementById('tabSheet').classList.contains('active')) {
        if (e.key === '+'){ e.preventDefault(); sheetZoomLevel = clampSheetZoom(sheetZoomLevel + 0.1); applySheetZoom(); }
        if (e.key === '-'){ e.preventDefault(); sheetZoomLevel = clampSheetZoom(sheetZoomLevel - 0.1); applySheetZoom(); }
        if (e.key === '0'){ e.preventDefault(); sheetZoomLevel = 1; applySheetZoom(); }
    }
});
applySheetZoom();

// ========= Security Enhancements (Bảo Mật Hệ Thống) =========

// 1. Chặn chuột phải
document.addEventListener('contextmenu', function(e) {
    // Cho phép chuột phải trong ô input và textarea
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        showToast("Chuột phải đã bị vô hiệu hóa!", "error");
    }
});

// 2. Chặn các phím tắt mở DevTools và xem mã nguồn
document.addEventListener('keydown', function(e) {
    // Chặn F12
    if (e.key === 'F12') {
        e.preventDefault();
        showToast("Hành động này không được phép!", "error");
    }
    // Chặn Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        showToast("Hành động này không được phép!", "error");
    }
    // Chặn Ctrl+U (Xem mã nguồn)
    if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        showToast("Chức năng xem mã nguồn đã bị khóa!", "error");
    }
});
