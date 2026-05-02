// ============================================================
// js/theme.js — Управление темами оформления
// Версия: 1.1
// Проект: Книжная полка
// ============================================================

const Theme = {

    themes: ['light', 'dark', 'high-contrast'],
    storageKey: 'bookLibraryTheme',

    init() {
        const saved = this.getSaved();
        if (saved) {
            this.apply(saved);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.apply(prefersDark ? 'dark' : 'light', false);
        }
        this.listenSystemChanges();
        this.updateSlider();
        this.updateSelect();
    },

    apply(theme, save = true) {
        if (!this.themes.includes(theme)) {
            theme = 'light';
        }

        document.documentElement.setAttribute('data-theme', theme);

        if (typeof library !== 'undefined' && library && library.settings) {
            library.settings.theme = theme;
        }

        if (save) {
            try {
                localStorage.setItem(this.storageKey, theme);
            } catch (e) { }
        }

        this.updateSlider();
        this.updateSelect();
    },

    toggle() {
        const current = this.getCurrent();
        const next = current === 'dark' ? 'light' : 'dark';
        this.apply(next);
    },

    getCurrent() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    },

    getSaved() {
        try {
            return localStorage.getItem(this.storageKey);
        } catch (e) {
            return null;
        }
    },

    updateSlider() {
        const theme = this.getCurrent();
        const dot = document.getElementById('themeDot');
        const check = document.getElementById('themeSlider');

        if (dot) {
            dot.style.transform = theme === 'dark' ? 'translateX(20px)' : 'translateX(0)';
        }
        if (check) {
            check.checked = theme === 'dark';
        }
    },

    updateSelect() {
        const sel = document.getElementById('themeSelect');
        if (sel) {
            sel.value = this.getCurrent();
        }
    },

    listenSystemChanges() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e) => {
            if (!this.getSaved()) {
                this.apply(e.matches ? 'dark' : 'light', false);
            }
        };

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handler);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handler);
        }
    }
};

// Глобальные функции
function toggleTheme() {
    if (typeof Theme !== 'undefined') Theme.toggle();
}

function setTheme(t) {
    if (typeof Theme !== 'undefined') Theme.apply(t);
}

document.addEventListener('DOMContentLoaded', () => {
    Theme.init();
});