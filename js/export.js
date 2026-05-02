// ============================================================
// js/export.js — Экспорт библиотеки в разные форматы
// Версия: 1.1
// Проект: Книжная полка
// ============================================================

const Export = {

    /**
     * Экспорт в выбранном формате
     */
    exportData(format) {
        const books = library.books;

        switch (format) {
            case 'csv': this.toCSV(books); break;
            case 'md': this.toMarkdown(books); break;
            case 'json': this.toJSON(books); break;
            case 'txt': this.toTXT(books); break;
            case 'html': this.toHTML(books); break;
            default: alert('Неизвестный формат: ' + format);
        }
    },

    /**
     * Экспорт в CSV (открывается в Excel)
     */
    toCSV(books) {
        // BOM для корректного открытия в Excel с кириллицей
        let csv = '\uFEFF';

        // Заголовки
        csv += 'Название;Автор;Категория;Формат;Язык;Путь к файлу;Размер;Дата добавления;Оценка;Закладка;Прочитано;Дата прочтения;Теги;Заметки\n';

        // Данные
        books.forEach(b => {
            csv += [
                this.escapeCSV(b.title),
                this.escapeCSV(b.author),
                this.escapeCSV(b.category || ''),
                b.format || '',
                b.language || '',
                this.escapeCSV(b.path || ''),
                b.size || '',
                b.date_added || '',
                b.rating || 0,
                b.bookmark ? 'Да' : 'Нет',
                b.read ? 'Да' : 'Нет',
                b.read_date || '',
                this.escapeCSV((b.tags || []).join(', ')),
                this.escapeCSV(b.notes || '')
            ].join(';') + '\n';
        });

        this.download(csv, 'library.csv', 'text/csv;charset=utf-8');
    },

    /**
     * Экранировать значение для CSV
     */
    escapeCSV(str) {
        if (!str) return '';
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    /**
     * Экспорт в Markdown
     */
    toMarkdown(books) {
        let md = '# 📚 Книжная полка\n\n';
        md += `*Экспортировано: ${new Date().toLocaleString('ru-RU')}*\n`;
        md += `*Всего книг: ${books.length}*\n\n`;
        md += '---\n\n';

        // Группируем по категориям
        const cats = [...new Set(books.map(b => b.category).filter(Boolean))];

        if (cats.length > 0) {
            cats.forEach(cat => {
                const catBooks = books.filter(b => b.category === cat);
                md += `## ${cat} (${catBooks.length})\n\n`;

                catBooks.forEach(b => {
                    md += `### ${b.title}\n`;
                    md += `- **Автор:** ${b.author}\n`;
                    md += `- **Формат:** ${b.format || '—'} | **Размер:** ${b.size || '—'}\n`;
                    if (b.rating > 0) md += `- **Оценка:** ${'⭐'.repeat(b.rating)}\n`;
                    if (b.bookmark) md += `- 🔖 В избранном\n`;
                    if (b.read) md += `- ✅ Прочитано${b.read_date ? ': ' + b.read_date : ''}\n`;
                    if (b.tags && b.tags.length > 0) md += `- **Теги:** ${b.tags.join(', ')}\n`;
                    if (b.path) md += `- **Файл:** \`${b.path}\`\n`;
                    if (b.notes) md += `\n> ${b.notes}\n`;
                    md += '\n';
                });

                md += '\n';
            });
        } else {
            books.forEach(b => {
                md += `- **${b.title}** — ${b.author} (${b.format || '?'})${b.rating > 0 ? ' ⭐'.repeat(b.rating) : ''}\n`;
            });
            md += '\n';
        }

        md += '---\n\n';
        md += '📚 *Создано в «Книжной полке»*\n';

        this.download(md, 'library.md', 'text/markdown;charset=utf-8');
    },

    /**
     * Экспорт в JSON (в том же формате, что library.json)
     */
    toJSON(books) {
        const data = {
            version: "1.0",
            exported: new Date().toISOString(),
            updated: new Date().toISOString(),
            settings: library.settings || { theme: 'light', sort_by: 'title' },
            total_books: books.length,
            categories: [...new Set([...books.map(b => b.category).filter(Boolean), ...(library.categories || [])])],
            books: books
        };

        const json = JSON.stringify(data, null, 2);
        this.download(json, 'library.json', 'application/json;charset=utf-8');
    },

    /**
     * Экспорт в TXT (простой текст)
     */
    toTXT(books) {
        let txt = '📚 КНИЖНАЯ ПОЛКА\n';
        txt += '='.repeat(50) + '\n\n';
        txt += `Дата экспорта: ${new Date().toLocaleString('ru-RU')}\n`;
        txt += `Всего книг: ${books.length}\n\n`;
        txt += '-'.repeat(50) + '\n\n';

        books.forEach((b, i) => {
            txt += `${i + 1}. ${b.author} — «${b.title}»\n`;
            txt += `   Категория: ${b.category || '—'}\n`;
            txt += `   Формат: ${b.format || '—'} | Размер: ${b.size || '—'}\n`;
            txt += `   Путь: ${b.path || '—'}\n`;
            if (b.rating > 0) txt += `   Оценка: ${'⭐'.repeat(b.rating)}\n`;
            if (b.bookmark) txt += `   🔖 В избранном\n`;
            if (b.read) txt += `   ✅ Прочитано\n`;
            if (b.notes) txt += `   Заметки: ${b.notes}\n`;
            txt += '\n';
        });

        this.download(txt, 'library.txt', 'text/plain;charset=utf-8');
    },

    /**
     * Экспорт в HTML (красивая страница)
     */
    toHTML(books) {
        let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Книжная полка — Экспорт</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;background:#f3f4f6;color:#1f2937;padding:30px}
        .container{max-width:900px;margin:0 auto}
        h1{color:#8b5e3c;margin-bottom:8px}
        .date{color:#6b7280;font-size:13px;margin-bottom:24px}
        .cat-title{color:#8b5e3c;margin:20px 0 10px;padding-bottom:4px;border-bottom:2px solid #8b5e3c}
        .book{background:white;border-radius:8px;padding:14px;margin-bottom:10px;border:1px solid #e5e7eb}
        .book h3{margin-bottom:4px;color:#1f2937}
        .book .author{color:#6b7280;font-size:13px}
        .book .meta{margin-top:6px;font-size:12px;color:#6b7280}
        .badge{display:inline-block;padding:2px 8px;border-radius:10px;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;margin-right:4px}
        .notes{margin-top:6px;font-size:12px;color:#4b5563;font-style:italic;border-left:3px solid #d4a056;padding-left:10px}
    </style>
</head>
<body>
<div class="container">
    <h1>📚 Книжная полка</h1>
    <p class="date">Экспортировано: ${new Date().toLocaleString('ru-RU')} • Книг: ${books.length}</p>
`;

        const cats = [...new Set(books.map(b => b.category).filter(Boolean))];

        cats.forEach(cat => {
            const catBooks = books.filter(b => b.category === cat);
            html += `<h2 class="cat-title">📁 ${cat} (${catBooks.length})</h2>\n`;

            catBooks.forEach(b => {
                html += `
    <div class="book">
        <h3>${b.title}</h3>
        <div class="author">${b.author}</div>
        <div class="meta">
            <span class="badge">${b.format || '?'}</span>
            ${b.size ? '<span class="badge">📦 ' + b.size + '</span>' : ''}
            ${b.rating > 0 ? '<span class="badge">' + '⭐'.repeat(b.rating) + '</span>' : ''}
            ${b.bookmark ? '<span class="badge">🔖 Избранное</span>' : ''}
            ${b.read ? '<span class="badge">✅ Прочитано</span>' : ''}
        </div>
        ${b.notes ? '<div class="notes">💬 ' + b.notes + '</div>' : ''}
    </div>\n`;
            });
        });

        html += `
</div>
</body>
</html>`;

        this.download(html, 'library.html', 'text/html;charset=utf-8');
    },

    /**
     * Экспорт для печати (открывает окно печати)
     */
    printBooks(books) {
        const printWindow = window.open('', '_blank', 'width=800,height=600');

        let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Книжная полка — Печать</title>
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,sans-serif;padding:20px;font-size:12px;line-height:1.5}
        h1{font-size:20px;margin-bottom:16px}
        h2{font-size:16px;margin:16px 0 8px;page-break-after:avoid}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:11px}
        th{background:#f3f4f6;font-weight:600}
        tr{page-break-inside:avoid}
        @media print{body{padding:0}}
    </style>
</head>
<body>
    <h1>📚 Книжная полка</h1>
    <p>Дата: ${new Date().toLocaleString('ru-RU')} | Книг: ${books.length}</p>
    <table>
        <thead><tr><th>№</th><th>Название</th><th>Автор</th><th>Категория</th><th>Формат</th><th>Размер</th><th>Оценка</th></tr></thead>
        <tbody>`;

        books.forEach((b, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td><strong>${b.title}</strong></td>
                <td>${b.author}</td>
                <td>${b.category || '—'}</td>
                <td>${b.format || '—'}</td>
                <td>${b.size || '—'}</td>
                <td>${b.rating > 0 ? '⭐'.repeat(b.rating) : '—'}</td>
            </tr>`;
        });

        html += `</tbody></table></body></html>`;

        printWindow.document.write(html);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    },

    /**
     * Скачать файл
     */
    download(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};