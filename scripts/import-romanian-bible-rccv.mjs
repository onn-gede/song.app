#!/usr/bin/env node
/**
 * Imports the full Romanian RCCV Bible from seven1m/open-bibles into Supabase.
 *
 * Required .env.local values:
 * NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 * SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run:
 * node scripts/import-romanian-bible-rccv.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env.local');
const RAW_URL = 'https://raw.githubusercontent.com/seven1m/open-bibles/master/ron-rccv.usfx.xml';

function parseEnv(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

async function loadEnv() {
  try {
    const env = parseEnv(await fs.readFile(ENV_PATH, 'utf8'));
    for (const [key, value] of Object.entries(env)) {
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local is optional if env vars are already set.
  }
}

function decodeXmlEntities(input) {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(text) {
  return decodeXmlEntities(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

const BOOKS = [
  ['GEN','Geneza','old'], ['EXO','Exodul','old'], ['LEV','Leviticul','old'], ['NUM','Numeri','old'], ['DEU','Deuteronomul','old'],
  ['JOS','Iosua','old'], ['JDG','Judecătorii','old'], ['RUT','Rut','old'], ['1SA','1 Samuel','old'], ['2SA','2 Samuel','old'],
  ['1KI','1 Împărați','old'], ['2KI','2 Împărați','old'], ['1CH','1 Cronici','old'], ['2CH','2 Cronici','old'], ['EZR','Ezra','old'],
  ['NEH','Neemia','old'], ['EST','Estera','old'], ['JOB','Iov','old'], ['PSA','Psalmii','old'], ['PRO','Proverbele','old'],
  ['ECC','Eclesiastul','old'], ['SNG','Cântarea Cântărilor','old'], ['ISA','Isaia','old'], ['JER','Ieremia','old'], ['LAM','Plângerile lui Ieremia','old'],
  ['EZK','Ezechiel','old'], ['DAN','Daniel','old'], ['HOS','Osea','old'], ['JOL','Ioel','old'], ['AMO','Amos','old'],
  ['OBA','Obadia','old'], ['JON','Iona','old'], ['MIC','Mica','old'], ['NAM','Naum','old'], ['HAB','Habacuc','old'],
  ['ZEP','Țefania','old'], ['HAG','Hagai','old'], ['ZEC','Zaharia','old'], ['MAL','Maleahi','old'],
  ['MAT','Matei','new'], ['MRK','Marcu','new'], ['LUK','Luca','new'], ['JHN','Ioan','new'], ['ACT','Faptele Apostolilor','new'],
  ['ROM','Romani','new'], ['1CO','1 Corinteni','new'], ['2CO','2 Corinteni','new'], ['GAL','Galateni','new'], ['EPH','Efeseni','new'],
  ['PHP','Filipeni','new'], ['COL','Coloseni','new'], ['1TH','1 Tesaloniceni','new'], ['2TH','2 Tesaloniceni','new'], ['1TI','1 Timotei','new'],
  ['2TI','2 Timotei','new'], ['TIT','Tit','new'], ['PHM','Filimon','new'], ['HEB','Evrei','new'], ['JAS','Iacov','new'],
  ['1PE','1 Petru','new'], ['2PE','2 Petru','new'], ['1JN','1 Ioan','new'], ['2JN','2 Ioan','new'], ['3JN','3 Ioan','new'],
  ['JUD','Iuda','new'], ['REV','Apocalipsa','new']
];

function getAttr(tag, name) {
  const re = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  return tag.match(re)?.[1] || null;
}

function extractBooks(xml) {
  const bookStartRe = /<book\b[^>]*>/gi;
  const starts = [];
  let match;
  while ((match = bookStartRe.exec(xml))) {
    const tag = match[0];
    const code = getAttr(tag, 'id') || getAttr(tag, 'code') || getAttr(tag, 'osisID');
    if (code) starts.push({ index: match.index, tag, code: code.toUpperCase() });
  }
  const sections = [];
  for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i];
    const next = starts[i + 1]?.index ?? xml.length;
    sections.push({ ...current, xml: xml.slice(current.index, next) });
  }
  return sections;
}

function extractVerses(bookXml) {
  const chapterRe = /<c\b[^>]*(?:id|number)=["'](\d+)["'][^>]*>/gi;
  const chapters = [];
  let cMatch;
  while ((cMatch = chapterRe.exec(bookXml))) {
    chapters.push({ chapter: Number(cMatch[1]), index: cMatch.index });
  }
  const verses = [];
  for (let i = 0; i < chapters.length; i += 1) {
    const start = chapters[i];
    const end = chapters[i + 1]?.index ?? bookXml.length;
    const chapterXml = bookXml.slice(start.index, end);
    const verseRe = /<v\b[^>]*(?:id|number)=["'](\d+)["'][^>]*>/gi;
    const verseStarts = [];
    let vMatch;
    while ((vMatch = verseRe.exec(chapterXml))) {
      verseStarts.push({ verse: Number(vMatch[1]), index: vMatch.index, tagEnd: vMatch.index + vMatch[0].length });
    }
    for (let j = 0; j < verseStarts.length; j += 1) {
      const current = verseStarts[j];
      const next = verseStarts[j + 1]?.index ?? chapterXml.length;
      const raw = chapterXml.slice(current.tagEnd, next);
      const text = stripTags(raw);
      if (text) verses.push({ chapter: start.chapter, verse: current.verse, text });
    }
  }
  return verses;
}

async function upsertInChunks(supabase, table, rows, onConflict, chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
    process.stdout.write(`\r${table}: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local/environment.');
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  console.log('Downloading Romanian RCCV Bible from open-bibles...');
  const response = await fetch(RAW_URL);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const xml = await response.text();

  const { data: version, error: versionError } = await supabase
    .from('bible_versions')
    .upsert({
      code: 'RCCV',
      name: 'Protestant Romanian Corrected Cornilescu Version',
      language: 'ro',
      source_name: 'seven1m/open-bibles',
      source_url: 'https://github.com/seven1m/open-bibles/blob/master/ron-rccv.usfx.xml',
      license_label: 'Public Domain',
      license_url: 'https://github.com/seven1m/open-bibles',
      is_default: true
    }, { onConflict: 'code' })
    .select('id')
    .single();
  if (versionError) throw new Error(versionError.message);

  const bookRows = BOOKS.map(([osis_code, name, testament], idx) => ({
    version_id: version.id,
    osis_code,
    name,
    testament,
    book_order: idx + 1
  }));
  await upsertInChunks(supabase, 'bible_books', bookRows, 'version_id,osis_code', 100);

  const { data: books, error: booksError } = await supabase
    .from('bible_books')
    .select('id,osis_code,book_order')
    .eq('version_id', version.id);
  if (booksError) throw new Error(booksError.message);
  const bookMap = new Map(books.map((b) => [b.osis_code.toUpperCase(), b]));

  const parsedBooks = extractBooks(xml);
  const verseRows = [];
  for (const parsedBook of parsedBooks) {
    const book = bookMap.get(parsedBook.code);
    if (!book) continue;
    const verses = extractVerses(parsedBook.xml);
    for (const verse of verses) {
      verseRows.push({
        version_id: version.id,
        book_id: book.id,
        book_order: book.book_order,
        chapter: verse.chapter,
        verse: verse.verse,
        text: verse.text
      });
    }
  }

  if (verseRows.length < 30000) {
    throw new Error(`Parsed only ${verseRows.length} verses; expected ~31k. The source format may have changed.`);
  }

  console.log(`Importing ${verseRows.length} verses...`);
  await upsertInChunks(supabase, 'bible_verses', verseRows, 'version_id,book_id,chapter,verse', 500);

  const { data: stats, error: statsError } = await supabase.rpc('bible_library_stats');
  if (statsError) throw new Error(statsError.message);
  console.log('Done. Bible stats:');
  console.table(stats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
