// ============================================================
// js/search.js — Поиск и фильтрация книг
// Версия: 1.1
// Проект: Книжная полка
// ============================================================

const Search = {

    // Задержка для debounce (мс)
    debounceDelay: 300,

    // Таймер debounce
    debounceTimer: null,

    /**
     * Инициализация поиска
     */
    init() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            // Мгновенный поиск при вводе (с debounce)
            searchInput.addEventListener('input', () => {
                this.debounceSearch();
            });

            // Единый обработчик клавиш
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(this.debounceTimer);
                    this.doSearch(searchInput.value);
                } else if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.doSearch('');
                    e.stopPropagation(); // Не даём закрыть модалку
                }
            });
        }
    },

    /**
     * Debounce — отложенный поиск
     */
    debounceSearch() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            const query = document.getElementById('searchInput')?.value || '';
            this.doSearch(query);
        }, this.debounceDelay);
    },

    /**
     * Выполнить поиск
     */
    doSearch(query) {
        const cleanQuery = query.trim().toLowerCase();

        // Подсвечиваем активность поиска
        this.highlightSearchInput(cleanQuery.length > 0);

        // Используем общую функцию рендеринга (учитывает currentCategory)
        renderBooks();

        // Обновляем статистику
        if (cleanQuery.length > 0) {
            const filtered = getFilteredBooks();
            this.showSearchStats(filtered.length);
        } else {
            this.showSearchStats(null);
        }
    },

    /**
     * Поиск по всем полям книги (для внешнего использования)
     */
    searchBooks(query) {
        const words = query.split(/\s+/).filter(w => w.length > 0);

        return library.books
            .map(book => {
                const score = this.calculateRelevance(book, words);
                return { book, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.book);
    },

    /**
     * Рассчитать релевантность книги поисковому запросу
     */
    calculateRelevance(book, words) {
        let score = 0;

        // Поля для поиска с весами
        const fields = [
            { value: book.title, weight: 50 },
            { value: book.author, weight: 40 },
            { value: book.notes || '', weight: 20 },
            { value: book.category || '', weight: 15 },
            { value: (book.tags || []).join(' '), weight: 25 },
        ];

        words.forEach(word => {
            fields.forEach(field => {
                const val = field.value.toLowerCase();

                if (val === word) {
                    score += field.weight * 2;
                } else if (val.startsWith(word)) {
                    score += field.weight * 1.5;
                } else if (val.includes(word)) {
                    score += field.weight;
                } else if (word.length >= 3) {
                    const partial = word.substring(0, word.length - 1);
                    if (val.includes(partial)) {
                        score += field.weight * 0.3;
                    }
                }
            });
        });

        // Бонус за совпадение всех слов
        const allWordsMatch = words.every(word => {
            const searchStr = `${book.title} ${book.author} ${book.notes || ''} ${book.category || ''} ${(book.tags || []).join(' ')}`.toLowerCase();
            return searchStr.includes(word);
        });
        if (allWordsMatch && words.length > 1) {
            score *= 1.5;
        }

        return Math.min(Math.round(score), 100);
    },

    /**
     * Показать/скрыть индикатор поиска
     */
    highlightSearchInput(active) {
        const input = document.getElementById('searchInput');
        if (input) {
            if (active) {
                input.style.borderColor = 'var(--accent)';
                input.style.boxShadow = '0 0 0 3px rgba(212, 160, 86, 0.15)';
            } else {
                input.style.borderColor = 'var(--card-border)';
                input.style.boxShadow = 'none';
            }
        }
    },

    /**
     * Показать статистику поиска
     */
    showSearchStats(count) {
        let statsEl = document.getElementById('searchStats');

        if (!statsEl) {
            statsEl = document.createElement('div');
            statsEl.id = 'searchStats';
            statsEl.style.cssText = 'font-size:13px;color:var(--text-dim);margin-bottom:12px;';
            const grid = document.getElementById('booksGrid');
            if (grid && grid.parentNode) {
                grid.parentNode.insertBefore(statsEl, grid);
            }
        }

        if (count === null) {
            statsEl.textContent = '';
            statsEl.style.display = 'none';
            this.highlightSearchInput(false);
        } else {
            statsEl.style.display = 'block';
            const wordForms = this.getWordForm(count, ['книга', 'книги', 'книг']);
            statsEl.textContent = `🔍 Найдено: ${count} ${wordForms}`;
        }
    },

    /**
     * Склонение слов
     */
    getWordForm(n, forms) {
        const m = Math.abs(n) % 100;
        const m1 = m % 10;
        if (m > 10 && m < 20) return forms[2];
        if (m1 > 1 && m1 < 5) return forms[1];
        if (m1 === 1) return forms[0];
        return forms[2];
    },

    /**
     * Быстрый поиск по тегу (клик по тегу в карточке книги)
     */
    searchByTag(tag) {
        const input = document.getElementById('searchInput');
        if (input) {
            input.value = tag;
            this.doSearch(tag);
            input.focus();
        }
    },

    /**
     * Сбросить поиск
     */
    clearSearch() {
        const input = document.getElementById('searchInput');
        if (input) {
            input.value = '';
        }
        this.doSearch('');
    },

    /**
     * Полнотекстовый поиск с учётом опечаток (расстояние Левенштейна)
     */
    fuzzySearch(query, maxDistance = 2) {
        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery) return [];

        return library.books
            .map(book => {
                const titleLower = book.title.toLowerCase();
                const authorLower = book.author.toLowerCase();

                const titleDist = this.levenshteinDistance(cleanQuery, titleLower.substring(0, cleanQuery.length + maxDistance));
                const authorDist = this.levenshteinDistance(cleanQuery, authorLower.substring(0, cleanQuery.length + maxDistance));

                const minDist = Math.min(titleDist, authorDist);

                if (minDist <= maxDistance) {
                    return { book, score: maxDistance - minDist + 1 };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score)
            .map(item => item.book);
    },

    /**
     * Расстояние Левенштейна между двумя строками
     */
    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[b.length][a.length];
    }
};

// ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
document.addEventListener('DOMContentLoaded', () => {
    Search.init();
});