#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CENTRUM MES — Database Migration Integrity Validator
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Перевіряє:
 * 1. Відповідність імен файлів стандарту хронології (ISO timestamp префікси).
 * 2. Хронологічний порядок міграцій без дублювання таймстемпів.
 * 3. Базовий синтаксичний аудит (закриття $$ блоків, безпечність DROP операцій).
 * 4. Відсутність порожніх або битих файлів міграцій.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../supabase/migrations');

console.log('🔍 [Migration Validator] Сканування директорії:', MIGRATIONS_DIR);

if (!fs.existsSync(MIGRATIONS_DIR)) {
  console.error('❌ [Migration Validator] Директорію міграцій не знайдено!');
  process.exit(1);
}

const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.warn('⚠️ [Migration Validator] Файлів міграцій .sql не виявлено.');
  process.exit(0);
}

console.log(`📋 Знайдено ${files.length} файлів міграцій.`);

let hasErrors = false;
const timestamps = new Map();
let lastTimestamp = '';

const TIMESTAMP_REGEX = /^(\d{8,14})_(.+)\.sql$/;

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const match = file.match(TIMESTAMP_REGEX);

  // 1. Валідація конвенції найменування
  if (!match) {
    console.warn(`⚠️ [Warning] Файл "${file}" не відповідає строгому формату YYYYMMDDHHMMSS_name.sql`);
  } else {
    const timestamp = match[1];
    if (timestamps.has(timestamp)) {
      console.error(`❌ [Conflict] Знайдено колізію таймстемпу: ${file} дублює ${timestamps.get(timestamp)}`);
      hasErrors = true;
    }
    timestamps.set(timestamp, file);

    if (timestamp < lastTimestamp) {
      console.warn(`⚠️ [Ordering] Порушення хронологічного сортування: ${file} (< ${lastTimestamp})`);
    }
    lastTimestamp = timestamp;
  }

  // 2. Аналіз вмісту файлу
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (content.length === 0) {
    console.error(`❌ [Empty File] Файл міграції порожній: ${file}`);
    hasErrors = true;
    continue;
  }

  // 3. Перевірка парності $$ блоків (PL/pgSQL functions)
  const dollarMatches = content.match(/\$\$/g);
  if (dollarMatches && dollarMatches.length % 2 !== 0) {
    console.error(`❌ [Syntax Error] Незбалансовані $$ теги у функції: ${file}`);
    hasErrors = true;
  }

  // 4. Перевірка на небезпечні безумовні DROP TABLE/DATABASE
  const dangerousDropMatch = content.match(/\bDROP\s+(?:TABLE|DATABASE)\s+(?!IF\s+EXISTS\b)[a-zA-Z0-9_."]+/i);
  if (dangerousDropMatch) {
    console.warn(`⚠️ [Safety Warning] Виявлено DROP без IF EXISTS у ${file}: "${dangerousDropMatch[0]}"`);
  }
}

if (hasErrors) {
  console.error('\n❌ [Migration Validator] Валідація міграцій завершилася з помилками!');
  process.exit(1);
} else {
  console.log('\n✅ [Migration Validator] Усі міграції успішно пройшли перевірку цілісності!\n');
  process.exit(0);
}
