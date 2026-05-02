// ============================================================
// js/parser.js — Парсер имён файлов и импорт библиотеки
// Версия: 2.0
// Проект: Книжная полка
// ============================================================

const Parser = {

    formats: ['pdf', 'epub', 'fb2', 'djvu', 'mobi', 'txt', 'doc', 'docx', 'rtf', 'chm'],
    archiveFormats: ['zip', 'rar'],

    parseFileName(fileName) {
        const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
        const patterns = [
            /^(.+?)\s*[-–—]\s*(.+)$/,
            /^(.+?)\s*\((.+?)\)\s*$/,
            /^(.+?)\s*\[(.+?)\]\s*$/,
            /^(.+?)\.\s+(.+)$/,
        ];
        for (const pattern of patterns) {
            const match = nameWithoutExt.match(pattern);
            if (match) {
                let part1 = match[1].trim();
                let part2 = match[2].trim();
                if (part1.length < part2.length && part1.split(' ').length <= 3) {
                    return { author: this.cleanName(part1), title: this.cleanName(part2) };
                } else {
                    return { author: this.cleanName(part2), title: this.cleanName(part1) };
                }
            }
        }
        return { author: 'Неизвестный автор', title: this.cleanName(nameWithoutExt) };
    },

    cleanName(str) {
        return str.replace(/[\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
    },

    getCategoryFromPath(filePath) {
        const parts = filePath.replace(/\\/g, '/').split('/');
        const libIndex = parts.findIndex(p => p.toLowerCase() === 'library');
        if (libIndex >= 0 && libIndex < parts.length - 1) return parts[libIndex + 1];
        if (parts.length >= 2) return parts[parts.length - 2];
        return 'Другое';
    },

    getFormat(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        if (this.formats.includes(ext)) return ext.toUpperCase();
        if (this.archiveFormats.includes(ext)) return ext.toUpperCase();
        return 'Другое';
    },

    isArchive(fileName) {
        return this.archiveFormats.includes(fileName.split('.').pop().toLowerCase());
    },

    isBookFile(fileName) {
        return this.formats.includes(fileName.split('.').pop().toLowerCase());
    },

    getLanguage(fileName) {
        return /[а-яё]/i.test(fileName) ? 'ru' : /[a-z]/i.test(fileName) ? 'en' : 'ru';
    },

    // ========== ИМПОРТ С КОПИРОВАНИЕМ ==========

    async importWithCopy() {
        if (!('showDirectoryPicker' in window)) {
            alert('Ваш браузер не поддерживает импорт с копированием.\nИспользуйте Chrome или Edge.');
            return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
        }

        try {
            let sourceHandle;
            try {
                sourceHandle = await window.showDirectoryPicker({ mode: 'read', startIn: 'desktop' });
            } catch (err) {
                if (err.name === 'AbortError') return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
                throw err;
            }

            let projectHandle;
            try {
                projectHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
            } catch (err) {
                if (err.name === 'AbortError') return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
                throw err;
            }

            let libraryHandle;
            try {
                libraryHandle = await projectHandle.getDirectoryHandle('library', { create: true });
            } catch (e) {
                alert('❌ Не удалось создать папку library.');
                return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
            }

            const copyResult = await this.copyDirectoryWithExtract(sourceHandle, libraryHandle, '');
            if (copyResult.copied === 0 && copyResult.extracted === 0) {
                alert('📂 Книги не найдены.');
                return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
            }

            const files = await this.readDirectoryDeep(libraryHandle, 'library');
            const books = this.processFiles(files);
            const importResult = this.importBooks(books);

            let msg = `✅ Импорт завершён!\n\n📁 Скопировано: ${copyResult.copied}`;
            if (copyResult.extracted > 0) msg += `\n📦 Распаковано: ${copyResult.extracted}`;
            msg += `\n📚 Добавлено: ${importResult.added}\n⏭️ Пропущено: ${importResult.skipped}`;
            if (copyResult.errors > 0) msg += `\n❌ Ошибок: ${copyResult.errors}`;
            alert(msg);

            return { added: importResult.added, skipped: importResult.skipped, copied: copyResult.copied, extracted: copyResult.extracted, errors: copyResult.errors };
        } catch (err) {
            console.error('Ошибка импорта:', err);
            alert('❌ Ошибка: ' + err.message);
            return { added: 0, skipped: 0, copied: 0, extracted: 0, errors: 0 };
        }
    },

    // ========== УДАЛЕНИЕ ФАЙЛА ==========

    async deleteFile(book) {
        if (!book || !book.path) return false;
        if (!('showDirectoryPicker' in window)) {
            alert('Удаление файлов не поддерживается в этом браузере.');
            return false;
        }
        try {
            const parts = book.path.replace(/\\/g, '/').split('/');
            const fileName = parts.pop();
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            let current = dirHandle;
            for (const part of parts) {
                try { current = await current.getDirectoryHandle(part); } catch (e) { break; }
            }
            await current.removeEntry(fileName);
            return true;
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Ошибка удаления:', err);
            return false;
        }
    },

    async readDirectoryDeep(dirHandle, basePath) {
        const results = [];
        for await (const entry of dirHandle.values()) {
            const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
            if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (this.formats.includes(ext) || this.archiveFormats.includes(ext)) {
                    const file = await entry.getFile();
                    results.push({
                        name: entry.name,
                        path: entryPath,
                        size: this.formatSize(file.size),
                        handle: entry,
                        isArchive: this.archiveFormats.includes(ext)
                    });
                }
            } else if (entry.kind === 'directory') {
                results.push(...(await this.readDirectoryDeep(entry, entryPath)));
            }
        }
        return results;
    },

    async copyDirectoryWithExtract(source, target, relPath) {
        let copied = 0, extracted = 0, errors = 0;
        for await (const entry of source.values()) {
            const ep = relPath ? `${relPath}/${entry.name}` : entry.name;
            if (entry.kind === 'file') {
                const ext = entry.name.split('.').pop().toLowerCase();
                if (this.formats.includes(ext)) {
                    try {
                        const f = await entry.getFile();
                        const nf = await target.getFileHandle(entry.name, { create: true });
                        const w = await nf.createWritable(); await w.write(f); await w.close();
                        copied++;
                    } catch (e) { errors++; }
                } else if (this.archiveFormats.includes(ext)) {
                    try {
                        const r = await this.extractArchive(await entry.getFile(), target, entry.name);
                        copied += r.copied; extracted += r.extracted; errors += r.errors;
                    } catch (e) { errors++; }
                }
            } else if (entry.kind === 'directory') {
                try {
                    const sd = await target.getDirectoryHandle(entry.name, { create: true });
                    const r = await this.copyDirectoryWithExtract(entry, sd, ep);
                    copied += r.copied; extracted += r.extracted; errors += r.errors;
                } catch (e) { errors++; }
            }
        }
        return { copied, extracted, errors };
    },

    async extractArchive(file, target, name) {
        let copied = 0, extracted = 0, errors = 0;
        if (name.split('.').pop().toLowerCase() !== 'zip') return { copied, extracted, errors };
        if (typeof JSZip === 'undefined') return { copied, extracted, errors: 1 };
        try {
            const zip = await JSZip.loadAsync(await file.arrayBuffer());
            for (const [fn, ze] of Object.entries(zip.files)) {
                if (ze.dir || !this.isBookFile(fn)) continue;
                try {
                    const data = await ze.async('blob');
                    const nf = await target.getFileHandle(fn.split('/').pop(), { create: true });
                    const w = await nf.createWritable(); await w.write(data); await w.close();
                    copied++; extracted++;
                } catch (e) { errors++; }
            }
        } catch (e) { errors++; }
        return { copied, extracted, errors };
    },

    processFiles(files) {
        return files.map(file => {
            const parsed = this.parseFileName(file.name);
            return {
                title: parsed.title,
                author: parsed.author,
                category: file.isArchive ? 'Архивы' : this.getCategoryFromPath(file.path),
                format: this.getFormat(file.name),
                language: this.getLanguage(file.name),
                path: file.path.replace(/\\/g, '/'),
                size: file.size,
                date_added: new Date().toISOString().slice(0, 10),
                bookmark: false,
                rating: 0,
                notes: file.isArchive ? '📦 Архив.' : '',
                tags: file.isArchive ? ['архив'] : [],
                read: false
            };
        });
    },

    formatSize(bytes) {
        if (!bytes) return '0 B';
        const u = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
    },

    importBooks(newBooks) {
        let added = 0, skipped = 0;
        newBooks.forEach(book => {
            const exists = library.books.some(b =>
                b.title.toLowerCase() === book.title.toLowerCase() &&
                b.author.toLowerCase() === book.author.toLowerCase()
            );
            if (!exists) {
                library.books.push({ id: Math.max(0, ...library.books.map(b => b.id)) + 1, ...book });
                added++;
            } else skipped++;
        });
        library.categories = [...new Set([...library.categories, ...library.books.map(b => b.category).filter(Boolean)])];
        if (!library.categories.includes('Другое')) library.categories.push('Другое');
        saveLibrary();
        renderBooks();
        return { added, skipped };
    },

    exportToJSON() {
        const json = JSON.stringify({
            version: "1.0",
            updated: new Date().toISOString(),
            settings: library.settings || {},
            categories: library.categories || [],
            books: library.books || []
        }, null, 2);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'library.json';
        a.click();
        URL.revokeObjectURL(a.href);
    },

    importFromJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                const books = data.books || (Array.isArray(data) ? data : null);
                if (!books) { alert('❌ Неверный формат'); return; }
                if (!books.length) { alert('⚠️ Нет книг'); return; }
                const r = this.importBooks(books);
                alert(`✅ Импорт завершён!\n\nДобавлено: ${r.added}\nПропущено: ${r.skipped}`);
            } catch (err) { alert('❌ Ошибка: ' + err.message); }
        };
        reader.readAsText(file);
    }
};