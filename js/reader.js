// ============================================================
// js/reader.js — Встроенная читалка с едиными темами
// Версия: 3.2
// Проект: Книжная полка
// ============================================================

const Reader = {
    currentBook: null,
    currentFrame: null,
    settings: {
        fontSize: 16,
        lineHeight: 1.6,
        fontFamily: 'Georgia, serif',
        theme: 'white',
    },
    storageKey: 'bookLibraryReaderSettings',

    init() {
        this.loadSettings();
        this.setupListeners();
    },

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey));
            if (saved) this.settings = { ...this.settings, ...saved };
        } catch (e) { }
    },

    saveSettings() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.settings)); } catch (e) { }
    },

    openBook(bookId) {
        const book = library.books.find(b => b.id === bookId);
        if (!book) { alert('Книга не найдена'); return; }
        if (!book.path || !book.path.trim()) { alert('Путь к файлу не указан'); return; }

        this.currentBook = book;
        this.showReaderModal();

        if (book.path.endsWith('.html')) {
            this.loadHTMLBook(book);
        } else if (book.path.toUpperCase().endsWith('.PDF')) {
            this.loadPDFBook(book);
        } else {
            this.loadOtherBook(book);
        }
    },

    showReaderModal() {
        const modal = document.getElementById('readerModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
        document.getElementById('readerBookTitle').textContent = this.currentBook.title;
        document.getElementById('readerBookAuthor').textContent = this.currentBook.author || '';

        // Применяем сохранённую тему
        this.updateThemeButtons();
        this.applyPDFMask();
    },

    closeReader() {
        const modal = document.getElementById('readerModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
        this.saveCurrentProgress();
        this.currentBook = null;
        this.currentFrame = null;

        const frame = document.getElementById('readerFrame');
        const content = document.getElementById('readerContent');
        const loader = document.getElementById('readerLoader');
        if (frame) { frame.style.display = 'none'; frame.src = ''; }
        if (content) { content.style.display = 'none'; content.innerHTML = ''; }
        if (loader) loader.style.display = 'flex';
    },

    loadHTMLBook(book) {
        const frame = document.getElementById('readerFrame');
        const content = document.getElementById('readerContent');
        const loader = document.getElementById('readerLoader');

        if (content) content.style.display = 'none';
        if (loader) loader.style.display = 'flex';
        if (frame) {
            frame.style.display = 'none';
            frame.src = book.path;
            frame.onload = () => {
                if (loader) loader.style.display = 'none';
                frame.style.display = 'block';
                this.currentFrame = frame;

                setTimeout(() => {
                    this.applySettingsToFrame();
                    const savedScroll = this.getBookProgress(book.id);
                    if (savedScroll) {
                        frame.contentWindow.postMessage({
                            type: 'setScroll',
                            position: parseInt(savedScroll)
                        }, '*');
                    }
                }, 300);
            };
        }
    },

    loadPDFBook(book) {
        const content = document.getElementById('readerContent');
        const frame = document.getElementById('readerFrame');
        const loader = document.getElementById('readerLoader');

        if (frame) frame.style.display = 'none';
        if (loader) loader.style.display = 'flex';
        if (content) {
            content.style.display = 'block';
            content.innerHTML = `
                <div class="pdf-wrapper" style="position:relative;width:100%;height:100%;">
                    <iframe src="${book.path}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;z-index:1;"></iframe>
                    <div class="pdf-mask" id="pdfMask" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none;transition:all 0.4s;"></div>
                </div>`;
            if (loader) loader.style.display = 'none';
            this.applyPDFMask();
        }
    },

    loadOtherBook(book) {
        const content = document.getElementById('readerContent');
        const frame = document.getElementById('readerFrame');
        const loader = document.getElementById('readerLoader');

        if (frame) frame.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (content) {
            content.style.display = 'block';
            content.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;color:var(--text-dim);">
                    <p style="font-size:48px;">📦</p>
                    <p>Предпросмотр недоступен</p>
                    <button class="btn btn-sm" onclick="Reader.downloadCurrentBook()">📥 Скачать</button>
                </div>`;
        }
    },

    /**
     * Применить маску для PDF в зависимости от темы
     */
    applyPDFMask() {
        const mask = document.getElementById('pdfMask');
        if (!mask) return;

        mask.className = 'pdf-mask';

        switch (this.settings.theme) {
            case 'white':
                mask.style.background = 'transparent';
                mask.style.backdropFilter = 'none';
                break;
            case 'sepia':
                mask.style.background = 'rgba(200, 170, 130, 0.25)';
                mask.style.backdropFilter = 'sepia(0.3)';
                break;
            case 'dark':
                mask.style.background = 'rgba(10, 10, 30, 0.6)';
                mask.style.backdropFilter = 'none';
                break;
            case 'contrast':
                mask.style.background = 'rgba(0, 0, 0, 0.3)';
                mask.style.backdropFilter = 'contrast(1.5) brightness(1.1)';
                break;
        }
    },

    applySettingsToFrame() {
        if (!this.currentFrame || !this.currentFrame.contentWindow) return;
        this.currentFrame.contentWindow.postMessage({
            type: 'setTheme',
            theme: this.settings.theme
        }, '*');
        this.currentFrame.contentWindow.postMessage({
            type: 'setFont',
            fontSize: this.settings.fontSize,
            lineHeight: this.settings.lineHeight,
            fontFamily: this.settings.fontFamily
        }, '*');
    },

    setFontSize(size) {
        this.settings.fontSize = Math.max(10, Math.min(32, size));
        this.saveSettings();
        this.applySettingsToFrame();
    },

    increaseFont() { this.setFontSize(this.settings.fontSize + 2); },
    decreaseFont() { this.setFontSize(this.settings.fontSize - 2); },

    /**
     * ЕДИНОЕ переключение тем — работает и для HTML, и для PDF
     */
    setTheme(theme) {
        const themes = ['white', 'sepia', 'dark', 'contrast'];
        if (!themes.includes(theme)) return;

        this.settings.theme = theme;
        this.saveSettings();

        // Для HTML-книг
        this.applySettingsToFrame();

        // Для PDF
        this.applyPDFMask();

        // Обновляем кнопки
        this.updateThemeButtons();
    },

    updateThemeButtons() {
        document.querySelectorAll('.reader-theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
        });
    },

    setFontFamily(font) {
        this.settings.fontFamily = font;
        this.saveSettings();
        this.applySettingsToFrame();
        const sel = document.getElementById('readerFontSelect');
        if (sel) sel.value = font;
    },

    setLineHeight(value) {
        this.settings.lineHeight = value;
        this.saveSettings();
        this.applySettingsToFrame();
        const sel = document.getElementById('readerLineSelect');
        if (sel) sel.value = value;
    },

    prevPage() {
        if (this.currentFrame && this.currentFrame.contentWindow) {
            this.currentFrame.contentWindow.scrollBy(0, -window.innerHeight * 0.8);
            return;
        }
        const pdfFrame = document.querySelector('#readerContent iframe');
        if (pdfFrame && pdfFrame.contentWindow) {
            pdfFrame.contentWindow.scrollBy(0, -window.innerHeight * 0.8);
        }
    },

    nextPage() {
        if (this.currentFrame && this.currentFrame.contentWindow) {
            this.currentFrame.contentWindow.scrollBy(0, window.innerHeight * 0.8);
            return;
        }
        const pdfFrame = document.querySelector('#readerContent iframe');
        if (pdfFrame && pdfFrame.contentWindow) {
            pdfFrame.contentWindow.scrollBy(0, window.innerHeight * 0.8);
        }
    },

    async toggleToc() {
        if (!this.currentFrame || !this.currentFrame.contentWindow) return;

        const tocPanel = document.getElementById('readerTocPanel');
        if (!tocPanel) return;

        if (tocPanel.style.display === 'block') {
            tocPanel.style.display = 'none';
            return;
        }

        // Запрашиваем оглавление у iframe
        this.currentFrame.contentWindow.postMessage({ type: 'getToc' }, '*');

        // Ждём ответа
        window.addEventListener('message', function handler(e) {
            if (e.data.type === 'tocData' && e.data.toc) {
                tocPanel.innerHTML = `
                    <div class="toc-header">
                        <strong>📑 Оглавление</strong>
                        <button class="btn btn-sm btn-outline" onclick="document.getElementById('readerTocPanel').style.display='none'">✕</button>
                    </div>
                    <div class="toc-list">${Reader.renderTocItems(e.data.toc)}</div>`;
                tocPanel.style.display = 'block';
                window.removeEventListener('message', handler);
            }
        });
    },

    renderTocItems(items, level = 0) {
        if (!items) return '';
        return items.map(item => {
            const padding = level * 16;
            const subItems = item.subitems ? this.renderTocItems(item.subitems, level + 1) : '';
            return `<div class="toc-item" style="padding-left:${padding}px;" onclick="Reader.goToTocItem('${item.id || ''}')">${item.label || 'Без названия'}</div>${subItems}`;
        }).join('');
    },

    goToTocItem(id) {
        if (this.currentFrame && this.currentFrame.contentWindow) {
            this.currentFrame.contentWindow.postMessage({ type: 'goTo', id: id }, '*');
        }
        document.getElementById('readerTocPanel').style.display = 'none';
    },

    downloadCurrentBook() {
        if (this.currentBook) downloadBook(this.currentBook.id);
    },

    saveBookProgress(bookId, position) {
        if (!bookId) return;
        try {
            const progress = JSON.parse(localStorage.getItem('bookLibraryReadingProgress') || '{}');
            progress[bookId] = {
                position: position.toString(),
                timestamp: new Date().toISOString(),
                title: this.currentBook?.title || ''
            };
            localStorage.setItem('bookLibraryReadingProgress', JSON.stringify(progress));
        } catch (e) { }
    },

    getBookProgress(bookId) {
        try {
            return JSON.parse(localStorage.getItem('bookLibraryReadingProgress') || '{}')[bookId]?.position || null;
        } catch (e) { return null; }
    },

    saveCurrentProgress() {
        if (!this.currentBook) return;
        if (this.currentFrame && this.currentFrame.contentWindow) {
            this.currentFrame.contentWindow.postMessage({ type: 'getScroll' }, '*');
        }
    },

    setupListeners() {
        const modal = document.getElementById('readerModal');
        if (!modal) return;

        modal.addEventListener('click', (e) => { if (e.target === modal) this.closeReader(); });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
                this.closeReader();
                e.stopPropagation();
            }
        });

        window.addEventListener('message', (e) => {
            if (e.data.type === 'scrollUpdate' && this.currentBook) {
                this.saveBookProgress(this.currentBook.id, e.data.position);
            }
            if (e.data.type === 'scrollPosition' && this.currentBook) {
                this.saveBookProgress(this.currentBook.id, e.data.position);
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Reader.init());