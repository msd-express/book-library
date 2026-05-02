// ============================================================
// js/app.js — Основная логика библиотеки
// Версия: 2.6
// Проект: Книжная полка
// Убран сканер, только импорт
// ============================================================

let library = { books: [], categories: ['Другое'], settings: { theme: 'light', sort_by: 'title' } };
let currentCategory = 'all';
let deferredPrompt;
let selectedFile = null;
let libraryFileHandle = null;

async function loadLibrary() {
    const saved = localStorage.getItem('bookLibrary');
    if (saved) {
        try {
            library = JSON.parse(saved);
            if (!library.categories || library.categories.length === 0) library.categories = ['Другое'];
            refreshAll();
            await syncLibraryToDisk();
            return;
        } catch (e) { console.warn('Ошибка загрузки из localStorage:', e); }
    }
    try {
        const response = await fetch('library.json?' + Date.now());
        if (response.ok) {
            const data = await response.json();
            library = data;
            if (!library.categories || library.categories.length === 0) library.categories = ['Другое'];
            saveLibraryToStorage();
            refreshAll();
            return;
        }
    } catch (e) { console.warn('library.json не загружен:', e.message); }
    initDemoData();
}

function initDemoData() {
    library = {
        books: [
            { id: 1, title: 'Основание', author: 'Айзек Азимов', category: 'Фантастика', format: 'FB2', language: 'ru', path: 'library/Фантастика/Азимов/Основание.fb2', size: '1.2 MB', date_added: new Date().toISOString().slice(0, 10), bookmark: true, rating: 5, notes: 'Классика научной фантастики.', tags: ['космос', 'классика'], read: false, read_date: null },
            { id: 2, title: 'Солярис', author: 'Станислав Лем', category: 'Фантастика', format: 'PDF', language: 'ru', path: 'library/Фантастика/Лем/Солярис.pdf', size: '2.1 MB', date_added: '2026-04-15', bookmark: false, rating: 4, notes: '', tags: ['космос', 'философия'], read: true, read_date: '2026-04-20' },
            { id: 3, title: 'Убийство в Восточном экспрессе', author: 'Агата Кристи', category: 'Детективы', format: 'EPUB', language: 'ru', path: 'library/Детективы/Кристи/Убийство в Восточном экспрессе.epub', size: '0.8 MB', date_added: '2026-03-20', bookmark: true, rating: 5, notes: '', tags: ['классика', 'детектив'], read: true, read_date: '2026-03-25' }
        ],
        categories: ['Фантастика', 'Детективы', 'Учебники', 'История', 'Программирование', 'Психология', 'Архивы', 'Другое'],
        settings: { theme: 'light', sort_by: 'title' }
    };
    saveLibrary();
    refreshAll();
}

function refreshAll() { updateCategories(); renderCategoryList(); updateSelectOptions(); renderBooks(); updateStats(); }
function saveLibrary() { library.updated = new Date().toISOString(); saveLibraryToStorage(); syncLibraryToDisk(); setTimeout(() => refreshAll(), 100); }
function saveLibraryToStorage() { try { localStorage.setItem('bookLibrary', JSON.stringify(library)); } catch (e) { } }
async function syncLibraryToDisk() { try { if (libraryFileHandle) { try { const w = await libraryFileHandle.createWritable(); await w.write(JSON.stringify(library, null, 2)); await w.close(); } catch (e) { libraryFileHandle = null; } } } catch (e) { } }

function updateCategories() { const cats = [...new Set(library.books.map(b => b.category).filter(Boolean))]; library.categories = [...new Set([...library.categories, ...cats])]; if (!library.categories.includes('Другое')) library.categories.push('Другое'); }

function renderCategoryList() {
    const catList = document.getElementById('categoryList'); if (!catList) return;
    const allCount = library.books.length;
    let html = `<li class="category-item ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">📚 Все книги <span class="count" id="countAll">${allCount}</span></li>`;
    library.categories.forEach(cat => { const count = library.books.filter(b => b.category === cat).length; if (count > 0 || cat === 'Другое') html += `<li class="category-item ${currentCategory === cat ? 'active' : ''}" data-cat="${escapeHtml(cat)}"><span style="flex:1;cursor:pointer;">📁 ${escapeHtml(cat)} <span class="count">${count}</span></span>${cat !== 'Другое' ? `<button class="btn-cat-del" onclick="event.stopPropagation();deleteCategory('${escapeHtml(cat)}')" title="Удалить" style="background:none;border:none;cursor:pointer;font-size:14px;opacity:0.4;padding:0 4px;color:inherit;">✕</button>` : ''}</li>`; });
    catList.innerHTML = html;
    catList.querySelectorAll('.category-item').forEach(item => { item.addEventListener('click', function (e) { if (e.target.classList.contains('btn-cat-del')) return; filterByCategory(this.dataset.cat); }); });
}

function updateSelectOptions() { const sel = document.getElementById('bookCategory'); if (sel) sel.innerHTML = library.categories.map(c => `<option>${c}</option>`).join(''); }

function updateStats() {
    const a = document.getElementById('countAll'), b = document.getElementById('countBookmarks'), c = document.getElementById('countUnread');
    if (a) a.textContent = library.books.length; if (b) b.textContent = library.books.filter(x => x.bookmark).length; if (c) c.textContent = library.books.filter(x => !x.read).length;
}

function deleteCategory(cat) { if (!cat || cat === 'Другое') { alert('Нельзя удалить'); return; } if (!confirm(`Удалить категорию "${cat}"?`)) return; library.books.forEach(b => { if (b.category === cat) b.category = 'Другое'; }); library.categories = library.categories.filter(c => c !== cat); if (currentCategory === cat) currentCategory = 'all'; saveLibrary(); refreshAll(); }
function addNewCategory() { const n = prompt('Название категории:'); if (!n || !n.trim()) return; const t = n.trim(); if (!library.categories.includes(t)) { library.categories.push(t); saveLibrary(); updateSelectOptions(); document.getElementById('bookCategory').value = t; } else alert('Уже есть.'); }

function filterByCategory(cat) { currentCategory = cat; document.querySelectorAll('#categoryList .category-item').forEach(el => el.classList.toggle('active', el.dataset.cat === cat)); renderBooks(); }

function getFilteredBooks() {
    let books = [...library.books]; const s = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    if (currentCategory === 'bookmarks') books = books.filter(b => b.bookmark); else if (currentCategory === 'unread') books = books.filter(b => !b.read); else if (currentCategory !== 'all') books = books.filter(b => b.category === currentCategory);
    if (s) books = books.filter(b => b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s) || (b.tags && b.tags.some(t => t.toLowerCase().includes(s))) || (b.notes && b.notes.toLowerCase().includes(s)));
    books.sort((a, b) => { const k = library.settings.sort_by || 'title'; if (k === 'author') return a.author.localeCompare(b.author); if (k === 'date') return (b.date_added || '').localeCompare(a.date_added || ''); if (k === 'rating') return (b.rating || 0) - (a.rating || 0); return a.title.localeCompare(b.title); });
    return books;
}

function renderBooks() {
    const g = document.getElementById('booksGrid'), e = document.getElementById('emptyState'); if (!g) return;
    const books = getFilteredBooks();
    if (books.length === 0) { g.innerHTML = ''; if (e) { e.style.display = 'block'; e.innerHTML = document.getElementById('searchInput')?.value.trim() ? '<p style="font-size:48px;">🔍</p><p>Ничего не найдено</p><button class="btn btn-sm btn-outline" style="margin-top:12px;" onclick="Search.clearSearch()">✕ Сбросить</button>' : '<p style="font-size:64px;">📚</p><p>Библиотека пуста</p><p style="font-size:13px;">Нажмите «📥 Импорт»</p>'; } }
    else { if (e) e.style.display = 'none'; g.innerHTML = books.map(b => createBookCard(b)).join(''); }
    updateStats();
}

function createBookCard(b) {
    const t = (b.tags || []).map(x => `<span class="badge" style="cursor:pointer;" onclick="event.stopPropagation();Search.searchByTag('${x.replace(/'/g, "\\'")}')">#${escapeHtml(x)}</span>`).join(' ');
    const r = b.rating > 0 ? '<span class="stars">' + '⭐'.repeat(b.rating) + '</span>' : '';
    const canRead = ['EPUB', 'FB2', 'TXT', 'PDF', 'DOC', 'DOCX', 'MOBI', 'DJVU'].includes((b.format || '').toUpperCase()) && b.path;
    let p = ''; try { const x = JSON.parse(localStorage.getItem('bookLibraryReadingProgress') || '{}'); if (x[b.id]?.position) p = '<span title="Прогресс" style="font-size:10px;">📖</span>'; } catch (e) { }
    return `<div class="book-card" id="book-${b.id}"><div style="display:flex;justify-content:space-between;align-items:start;"><div class="book-title" onclick="openEditModal(${b.id})">${p}${escapeHtml(b.title)}</div><input type="checkbox" class="book-checkbox" value="${b.id}" onchange="updateSelectedCount()"></div><div class="book-author">${escapeHtml(b.author)}</div><div class="book-meta"><span class="badge">${b.format || '?'}</span>${b.category ? `<span class="badge">📁 ${escapeHtml(b.category)}</span>` : ''}${b.size ? `<span class="badge">📦 ${escapeHtml(b.size)}</span>` : ''}${r}${b.bookmark ? '🔖' : ''}${b.read ? '✅' : ''}</div>${t ? `<div class="book-meta">${t}</div>` : ''}<div class="book-actions">${canRead ? `<button class="btn btn-sm" onclick="openReader(${b.id})" style="background:var(--accent);color:var(--bg);font-weight:700;">📖 Читать</button>` : ''}<button class="btn btn-sm btn-outline" onclick="downloadBook(${b.id})">📥</button><button class="btn btn-sm btn-outline" onclick="openEditModal(${b.id})">✏️</button><button class="btn btn-sm btn-outline" onclick="shareBook(${b.id})">🔗</button><button class="btn btn-sm btn-outline" onclick="toggleRead(${b.id})">${b.read ? '✅' : '📖'}</button><button class="btn btn-sm btn-outline" onclick="deleteBook(${b.id})">🗑️</button></div></div>`;
}

function escapeHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function openReader(id) { if (typeof Reader !== 'undefined') Reader.openBook(id); else alert('Модуль не загружен.'); }
function openAddModal() { document.getElementById('editId').value = ''; document.getElementById('modalTitle').textContent = '➕ Добавить книгу'; document.getElementById('bookTitle').value = ''; document.getElementById('bookAuthor').value = ''; document.getElementById('bookPath').value = ''; document.getElementById('bookSize').value = ''; document.getElementById('bookTags').value = ''; document.getElementById('bookNotes').value = ''; document.getElementById('bookBookmark').checked = false; document.getElementById('bookRead').checked = false; document.getElementById('bookRating').value = '0'; selectedFile = null; updateSelectOptions(); document.getElementById('bookCategory').value = 'Другое'; document.getElementById('bookModal').classList.add('show'); }
function openEditModal(id) { const b = library.books.find(x => x.id === id); if (!b) return; document.getElementById('editId').value = b.id; document.getElementById('modalTitle').textContent = '✏️ Редактировать'; document.getElementById('bookTitle').value = b.title || ''; document.getElementById('bookAuthor').value = b.author || ''; document.getElementById('bookPath').value = b.path || ''; document.getElementById('bookSize').value = b.size || ''; document.getElementById('bookTags').value = (b.tags || []).join(', '); document.getElementById('bookNotes').value = b.notes || ''; document.getElementById('bookBookmark').checked = b.bookmark || false; document.getElementById('bookRead').checked = b.read || false; document.getElementById('bookRating').value = b.rating || 0; selectedFile = null; updateSelectOptions(); if (b.category) document.getElementById('bookCategory').value = b.category; if (b.format) document.getElementById('bookFormat').value = b.format; document.getElementById('bookModal').classList.add('show'); }
function closeModal() { document.getElementById('bookModal').classList.remove('show'); }
function formatFileSize(b) { if (!b) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(b) / Math.log(1024)); return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i]; }
function saveBook() { const id = parseInt(document.getElementById('editId').value) || 0; let path = document.getElementById('bookPath').value.trim(); if (selectedFile) path = 'library/' + selectedFile.name; const d = { title: document.getElementById('bookTitle').value.trim(), author: document.getElementById('bookAuthor').value.trim(), category: document.getElementById('bookCategory').value || 'Другое', format: document.getElementById('bookFormat').value, path: path, size: document.getElementById('bookSize').value.trim() || (selectedFile ? formatFileSize(selectedFile.size) : ''), tags: document.getElementById('bookTags').value.split(',').map(x => x.trim()).filter(Boolean), notes: document.getElementById('bookNotes').value.trim(), bookmark: document.getElementById('bookBookmark').checked, rating: parseInt(document.getElementById('bookRating').value) || 0, read: document.getElementById('bookRead').checked }; if (!d.title || !d.author) { alert('Название и автор обязательны!'); return; } if (id > 0) { const i = library.books.findIndex(x => x.id === id); if (i >= 0) { library.books[i] = { ...library.books[i], ...d }; if (d.read && !library.books[i].read_date) library.books[i].read_date = new Date().toISOString().slice(0, 10); if (!d.read) library.books[i].read_date = null; } } else { const nid = Math.max(0, ...library.books.map(x => x.id)) + 1; library.books.push({ id: nid, ...d, language: /[а-яё]/i.test(d.title) ? 'ru' : 'en', date_added: new Date().toISOString().slice(0, 10), read_date: d.read ? new Date().toISOString().slice(0, 10) : null }); } saveLibrary(); closeModal(); refreshAll(); }
function deleteBook(id) { const b = library.books.find(x => x.id === id); if (!b) return; if (!confirm(`Удалить "${b.title}"?`)) return; const del = confirm(`Удалить файл с диска?\n\n${b.path}\n\nOK — удалить файл\nОтмена — только запись`); if (del && typeof Parser !== 'undefined') Parser.deleteFile(b); library.books = library.books.filter(x => x.id !== id); try { const p = JSON.parse(localStorage.getItem('bookLibraryReadingProgress') || '{}'); delete p[id]; localStorage.setItem('bookLibraryReadingProgress', JSON.stringify(p)); } catch (e) { } saveLibrary(); refreshAll(); }
function toggleRead(id) { const b = library.books.find(x => x.id === id); if (b) { b.read = !b.read; b.read_date = b.read ? new Date().toISOString().slice(0, 10) : null; saveLibrary(); refreshAll(); } }
function downloadBook(id) { const b = library.books.find(x => x.id === id); if (b?.path) { const a = document.createElement('a'); a.href = b.path; a.download = b.path.split('/').pop(); document.body.appendChild(a); a.click(); document.body.removeChild(a); } else alert('Путь не указан.'); }
function shareBook(id) { const b = library.books.find(x => x.id === id); if (!b) return; const t = `📚 ${b.author} — «${b.title}»`; if (navigator.share) navigator.share({ title: b.title, text: t }).catch(() => { }); else { navigator.clipboard?.writeText(t).then(() => alert('✅ Скопировано!')); } }
function updateSelectedCount() { const c = document.querySelectorAll('.book-checkbox:checked').length; const e = document.getElementById('selectedCount'); if (e) { e.textContent = 'Выбрано: ' + c; e.className = 'selected-count ' + (c > 0 ? 'show' : ''); } }
function downloadSelected() { const ids = [...document.querySelectorAll('.book-checkbox:checked')].map(x => parseInt(x.value)); if (!ids.length) { alert('Выберите книги!'); return; } const books = library.books.filter(x => ids.includes(x.id)); let t = '📚 Книжная полка\n' + '='.repeat(40) + '\n\n'; books.forEach(b => { t += `## ${b.author} — ${b.title}\n- Путь: ${b.path || '—'}\n\n`; }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t])); a.download = 'books_selected.txt'; a.click(); }
function toggleSidebar() { const s = document.getElementById('sidebar'), o = document.getElementById('sidebarOverlay'), h = document.querySelector('.hamburger'); if (s) s.classList.toggle('open'); if (o) o.classList.toggle('show'); if (h) h.classList.toggle('open'); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
function installPWA() { if (deferredPrompt) deferredPrompt.prompt(); else alert('📱 Меню → "Установить приложение"'); }
function importWithCopy() { if (typeof Parser !== 'undefined') Parser.importWithCopy().then(() => refreshAll()); else alert('Модуль не загружен.'); }
function importJSON() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = e => { if (e.target.files[0] && typeof Parser !== 'undefined') { Parser.importFromJSON(e.target.files[0]); setTimeout(() => refreshAll(), 200); } }; i.click(); }
function openReadme() { const m = document.getElementById('readmeModal'), f = document.getElementById('readmeFrame'); if (m) { if (f) f.src = 'README.html?' + Date.now(); m.classList.add('show'); } }
function closeReadme() { const m = document.getElementById('readmeModal'); if (m) m.classList.remove('show'); }
function printReadme() { const w = window.open('README.html', '_blank', 'width=800,height=600'); if (w) setTimeout(() => w.print(), 1000); }

document.addEventListener('DOMContentLoaded', () => {
    loadLibrary().then(() => refreshAll());
    document.getElementById('bookModal')?.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.getElementById('readmeModal')?.addEventListener('click', function (e) { if (e.target === this) closeReadme(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { const rm = document.getElementById('readerModal'), bm = document.getElementById('bookModal'), rem = document.getElementById('readmeModal'); if (rm?.classList.contains('show')) return; if (rem?.classList.contains('show')) { closeReadme(); return; } if (bm?.classList.contains('show')) closeModal(); } });
    document.getElementById('sidebarOverlay')?.addEventListener('click', toggleSidebar);
    const fi = document.getElementById('bookFileInput');
    if (fi) { fi.addEventListener('change', function () { if (this.files && this.files[0]) { selectedFile = this.files[0]; document.getElementById('bookPath').value = selectedFile.name; document.getElementById('bookSize').value = formatFileSize(selectedFile.size); const ext = selectedFile.name.split('.').pop().toUpperCase(); const fmt = document.getElementById('bookFormat'); if (['PDF', 'EPUB', 'FB2', 'DJVU', 'MOBI', 'TXT', 'DOC', 'DOCX', 'ZIP', 'RAR'].includes(ext) && fmt) fmt.value = ext; if (typeof Parser !== 'undefined') { const p = Parser.parseFileName(selectedFile.name); if (p.author && p.author !== 'Неизвестный автор') document.getElementById('bookAuthor').value = p.author; if (p.title) document.getElementById('bookTitle').value = p.title; } if (!document.getElementById('bookCategory').value) document.getElementById('bookCategory').value = 'Другое'; } }); }
});