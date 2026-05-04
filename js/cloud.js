// ============================================================
// js/cloud.js — Синхронизация с Яндекс.Диском
// Версия: 1.0
// Проект: Книжная полка
// ============================================================

const CloudSync = {

    // Состояние
    state: {
        enabled: false,
        token: null,
        user: null,
        usedSpace: 0,
        totalSpace: 0,
        lastSync: null
    },

    // Ключи для localStorage
    storageKey: 'bookLibraryYandexToken',
    settingsKey: 'bookLibraryCloudSettings',

    // Настройки
    settings: {
        autoSync: true,
        syncInterval: 5, // минут
        syncBooks: false,
        warnBeforeSync: false
    },

    // ========== ИНИЦИАЛИЗАЦИЯ ==========

    init() {
        // Загружаем настройки
        const savedSettings = localStorage.getItem(this.settingsKey);
        if (savedSettings) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            } catch (e) { }
        }

        // Пытаемся восстановить сессию
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.token && data.expires > Date.now()) {
                    this.state.enabled = true;
                    this.state.token = data.token;
                    this.state.user = data.user;
                    this.getDiskInfo();
                } else {
                    localStorage.removeItem(this.storageKey);
                }
            } catch (e) {
                localStorage.removeItem(this.storageKey);
            }
        }
    },

    // ========== АВТОРИЗАЦИЯ ==========

    async connect() {
        // Показываем disclaimer
        const agreed = confirm(
            '⚠️ Подключение Яндекс.Диска\n\n' +
            'Вы соглашаетесь, что:\n' +
            '• Приложение «Книжная полка» предоставляется «как есть» (as-is)\n' +
            '• Облачная синхронизация — опциональная функция\n' +
            '• Ответственность за превышение лимитов Яндекс.Диска, сохранность\n' +
            '  данных и любые связанные расходы полностью лежит на пользователе\n' +
            '• Вы используете облачное хранилище добровольно\n\n' +
            'Нажмите «ОК» чтобы продолжить'
        );

        if (!agreed) return;

        // Создаём форму для ввода токена (упрощённый способ)
        const token = prompt(
            '🔑 Токен Яндекс.Диска\n\n' +
            '1. Откройте https://oauth.yandex.ru/authorize?response_type=token&client_id=ВАШ_ID\n' +
            '2. Разрешите доступ\n' +
            '3. Скопируйте токен из адресной строки\n\n' +
            'Вставьте токен:'
        );

        if (!token || !token.trim()) return;

        // Проверяем токен
        try {
            const response = await fetch('https://cloud-api.yandex.net/v1/disk', {
                headers: { 'Authorization': `OAuth ${token.trim()}` }
            });

            if (!response.ok) {
                alert('❌ Неверный токен. Попробуйте снова.');
                return;
            }

            const data = await response.json();

            this.state.token = token.trim();
            this.state.enabled = true;
            this.state.user = data.user ? data.user.login : 'Пользователь';
            this.state.usedSpace = data.used_space || 0;
            this.state.totalSpace = data.total_space || 0;

            // Сохраняем
            localStorage.setItem(this.storageKey, JSON.stringify({
                token: this.state.token,
                user: this.state.user,
                expires: Date.now() + 365 * 24 * 3600 * 1000
            }));

            // Создаём папку приложения на Яндекс.Диске
            await this.createAppFolder();

            // Первая синхронизация
            await this.syncNow();

            alert('✅ Яндекс.Диск подключён!\n\nБиблиотека синхронизирована.');
            this.updateUI();

        } catch (e) {
            console.error('Ошибка подключения:', e);
            alert('❌ Ошибка подключения к Яндекс.Диску. Проверьте интернет-соединение.');
        }
    },

    async createAppFolder() {
        try {
            await fetch('https://cloud-api.yandex.net/v1/disk/resources?path=app:/book-library', {
                method: 'PUT',
                headers: { 'Authorization': `OAuth ${this.state.token}` }
            });
        } catch (e) {
            // Папка уже существует — игнорируем
        }
    },

    // ========== СИНХРОНИЗАЦИЯ ==========

    async syncNow(silent = false) {
        if (!this.state.enabled) return;

        try {
            // Проверяем доступное место
            await this.getDiskInfo();

            // Проверка лимита
            if (this.state.usedSpace >= this.state.totalSpace) {
                throw new Error('overquota');
            }

            // Сохраняем library.json
            await this.uploadLibrary();

            // Сохраняем прогресс чтения
            await this.uploadReadingProgress();

            this.state.lastSync = new Date();

            if (!silent) {
                this.updateUI();
                console.log('☁️ Синхронизация завершена');
            }

            return true;
        } catch (e) {
            console.error('Ошибка синхронизации:', e);

            if (e.message === 'overquota') {
                alert(
                    '⚠️ Превышен лимит Яндекс.Диска!\n\n' +
                    'Синхронизация остановлена.\n' +
                    'Освободите место или расширьте тариф.\n' +
                    'Приложение продолжит работать локально.'
                );
                this.disconnect(true);
            } else if (!silent) {
                console.warn('Синхронизация не удалась, работаем локально');
            }

            return false;
        }
    },

    async uploadLibrary() {
        const json = JSON.stringify(library, null, 2);

        // Получаем URL для загрузки
        const response = await fetch(
            'https://cloud-api.yandex.net/v1/disk/resources/upload?' +
            'path=app:/book-library/library.json&overwrite=true',
            {
                method: 'GET',
                headers: { 'Authorization': `OAuth ${this.state.token}` }
            }
        );

        if (!response.ok) {
            throw new Error('upload_error');
        }

        const { href } = await response.json();

        // Загружаем файл
        const uploadResponse = await fetch(href, {
            method: 'PUT',
            body: json
        });

        if (!uploadResponse.ok) {
            throw new Error('upload_error');
        }
    },

    async uploadReadingProgress() {
        const progress = localStorage.getItem('bookLibraryReadingProgress') || '{}';

        const response = await fetch(
            'https://cloud-api.yandex.net/v1/disk/resources/upload?' +
            'path=app:/book-library/reading-progress.json&overwrite=true',
            {
                method: 'GET',
                headers: { 'Authorization': `OAuth ${this.state.token}` }
            }
        );

        const { href } = await response.json();

        await fetch(href, {
            method: 'PUT',
            body: progress
        });
    },

    async downloadLibrary() {
        const response = await fetch(
            'https://cloud-api.yandex.net/v1/disk/resources/download?' +
            'path=app:/book-library/library.json',
            {
                method: 'GET',
                headers: { 'Authorization': `OAuth ${this.state.token}` }
            }
        );

        if (!response.ok) {
            throw new Error('download_error');
        }

        const { href } = await response.json();

        const dataResponse = await fetch(href);
        const data = await dataResponse.json();

        return data;
    },

    async getDiskInfo() {
        const response = await fetch('https://cloud-api.yandex.net/v1/disk', {
            headers: { 'Authorization': `OAuth ${this.state.token}` }
        });

        if (!response.ok) {
            throw new Error('api_error');
        }

        const data = await response.json();
        this.state.usedSpace = data.used_space || 0;
        this.state.totalSpace = data.total_space || 0;
    },

    // ========== ОТКЛЮЧЕНИЕ ==========

    disconnect(silent = false) {
        if (!silent) {
            const confirmed = confirm(
                'Отключить Яндекс.Диск?\n\n' +
                'Данные на Яндекс.Диске сохранятся.\n' +
                'Приложение продолжит работать локально.'
            );
            if (!confirmed) return;
        }

        this.state.enabled = false;
        this.state.token = null;
        this.state.user = null;
        this.state.lastSync = null;
        localStorage.removeItem(this.storageKey);
        this.updateUI();

        if (!silent) {
            alert('🔌 Яндекс.Диск отключён.');
        }
    },

    // ========== UI ==========

    updateUI() {
        const statusEl = document.getElementById('cloudStatus');
        const connectBtn = document.getElementById('cloudConnectBtn');
        const disconnectBtn = document.getElementById('cloudDisconnectBtn');
        const syncBtn = document.getElementById('cloudSyncBtn');

        if (statusEl) {
            if (this.state.enabled) {
                const usedGB = (this.state.usedSpace / 1e9).toFixed(2);
                const totalGB = (this.state.totalSpace / 1e9).toFixed(0);
                const percent = ((this.state.usedSpace / this.state.totalSpace) * 100).toFixed(0);

                statusEl.innerHTML = `
                    <div style="display:flex;flex-direction:column;gap:4px;font-size:11px;">
                        <span style="color:#27ae60;font-weight:600;">✅ Синхронизировано</span>
                        <span>Аккаунт: ${this.state.user || '—'}</span>
                        <span>Занято: ${usedGB} ГБ из ${totalGB} ГБ (${percent}%)</span>
                        ${this.state.lastSync ? `<span style="opacity:0.6;">Синхронизация: ${this.state.lastSync.toLocaleTimeString()}</span>` : ''}
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <span style="color:#95a5a6;">Не подключён</span>
                `;
            }
        }

        if (connectBtn) {
            connectBtn.style.display = this.state.enabled ? 'none' : 'block';
        }
        if (disconnectBtn) {
            disconnectBtn.style.display = this.state.enabled ? 'block' : 'none';
        }
        if (syncBtn) {
            syncBtn.style.display = this.state.enabled ? 'block' : 'none';
        }
    },

    // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

    formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 Б';
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    CloudSync.init();
});