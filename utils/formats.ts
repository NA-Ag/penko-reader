/**
 * File types the importer understands. Kept in its own dependency-free module so UI code can
 * build `<input accept>` without pulling the importers (and pdf.js / JSZip) into the startup bundle.
 */
export const SUPPORTED_EXTENSIONS: string[] = ['.epub', '.pdf', '.mobi', '.azw', '.prc', '.txt', '.md', '.markdown', '.html', '.htm', '.xhtml', '.docx', '.fb2'];
export const ACCEPT_STRING: string = SUPPORTED_EXTENSIONS.join(',');
