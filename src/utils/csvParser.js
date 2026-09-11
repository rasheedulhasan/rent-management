'use strict';

/**
 * Minimal RFC-4180-ish CSV parser.
 * Handles quoted fields, embedded commas/newlines, escaped quotes (""),
 * CRLF line endings and a leading UTF-8 BOM.
 *
 * @param {string} text
 * @returns {string[][]} rows (fully-empty rows removed)
 */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    // Strip BOM
    if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
    }

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
            continue;
        }

        if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else if (c === '\r') {
            // ignore
        } else {
            field += c;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

module.exports = { parseCsv };
