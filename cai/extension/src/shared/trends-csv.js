/**
 * Parser CSV xuất từ Google Trends (nút ⬇ trên từng widget).
 * Hỗ trợ multiTimeline.csv (Interest over time) và relatedQueries.csv (Top/Rising).
 */
import { findDates } from './normalize.js';

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function lines(text) {
  return String(text ?? '').replace(/^﻿/, '').split(/\r?\n/);
}

function toIsoDate(cell) {
  const s = String(cell).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(s)) return s + '-01';
  return findDates(s)[0] || '';
}

function toNumber(cell) {
  const s = String(cell).trim();
  if (s === '<1') return 0.5;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** multiTimeline.csv → { series: [{keyword, geo, points:[[date, value]]}] } */
export function parseMultiTimeline(text) {
  const rows = lines(text).map(parseCsvLine).filter((r) => r.some((c) => c !== ''));
  const firstData = rows.findIndex((r, i) => i > 0 && toIsoDate(r[0]) && r.slice(1).some((c) => toNumber(c) !== null));
  if (firstData < 1) throw new Error('Không nhận ra định dạng multiTimeline.csv');
  const header = rows[firstData - 1];
  const series = header.slice(1).map((h) => {
    const m = h.match(/^(.*?):\s*\((.*)\)\s*$/);
    return { keyword: (m ? m[1] : h).trim(), geo: m ? m[2].trim() : '', points: [] };
  });
  for (const r of rows.slice(firstData)) {
    const d = toIsoDate(r[0]);
    if (!d) continue;
    series.forEach((s, i) => {
      const v = toNumber(r[i + 1]);
      if (v !== null) s.points.push([d, v]);
    });
  }
  return { series: series.filter((s) => s.keyword && s.points.length) };
}

/** relatedQueries.csv → { top: ['q (value)'], rising: ['q (+250%)'] } */
export function parseRelatedQueries(text) {
  const out = { top: [], rising: [] };
  let section = null;
  for (const raw of lines(text)) {
    const r = parseCsvLine(raw);
    const first = (r[0] || '').toUpperCase();
    if (first === 'TOP' || first === 'HÀNG ĐẦU') { section = 'top'; continue; }
    if (first === 'RISING' || first === 'ĐANG TĂNG') { section = 'rising'; continue; }
    if (!section || !r[0] || r.length < 2) continue;
    out[section].push(r[1] ? `${r[0]} (${r[1]})` : r[0]);
  }
  return out;
}

/** Đọc tham số từ URL Trends Explore. */
export function parseTrendsUrl(href) {
  try {
    const u = new URL(href);
    if (!/trends\.google\./.test(u.hostname)) return null;
    return {
      geo: u.searchParams.get('geo') || '',
      timeframe: u.searchParams.get('date') || 'today 12-m',
      keywords: (u.searchParams.get('q') || '').split(',').map((s) => s.trim()).filter(Boolean),
      hl: u.searchParams.get('hl') || ''
    };
  } catch {
    return null;
  }
}

/** Gộp dữ liệu đã parse thành payload trends.upsert. */
export function buildTrendsPayload({ timeline, related = {}, meta }) {
  const series = timeline.series.map((s) => ({ keyword: s.keyword, points: s.points }));
  const rel = Object.entries(related).map(([keyword, r]) => ({ keyword, top: r.top || [], rising: r.rising || [] }));
  return {
    meta: {
      geo: meta.geo || timeline.series[0]?.geo || '',
      timeframe: meta.timeframe || 'today 12-m',
      batch_id: meta.batch_id || '',
      anchor_keyword: meta.anchor_keyword || '',
      source_url: meta.source_url || '',
      method: 'CSV_IMPORT'
    },
    series,
    related: rel
  };
}
