import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { getSupabase } from '@/lib/supabase';
import { Stock } from '@/types/stock';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const NAVER_URL =
  'https://finance.naver.com/sise/sise_market_sum.nhn?sosok=0&page=1';

async function crawlNaverFinance(): Promise<Omit<Stock, 'id' | 'updated_at'>[]> {
  console.log('[crawl] Naver Finance 크롤링 시작');

  const res = await fetch(NAVER_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`[crawl] HTTP ${res.status}`);

  // EUC-KR → UTF-8 변환
  const buffer = await res.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buffer);

  const $ = cheerio.load(html);
  const stocks: Omit<Stock, 'id' | 'updated_at'>[] = [];

  $('table.type_2 tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 7) return; // 빈 구분 행 스킵

    const rankText = $(cells[0]).text().trim();
    const rank = parseInt(rankText, 10);
    if (isNaN(rank) || rank < 1 || rank > 10) return;

    const nameEl = $(cells[1]).find('a');
    const company_name = nameEl.text().trim();
    const href = nameEl.attr('href') || '';
    const stock_code = href.match(/code=(\d+)/)?.[1] ?? '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseNum = (el: any) =>
      parseInt($(el).text().trim().replace(/,/g, ''), 10) || 0;

    const price = parseNum(cells[2]);
    const change = parseNum(cells[4]); // 전일비
    const rawPct = $(cells[5]).text().trim().replace(/,/g, '');
    const change_pct = parseFloat(rawPct) || 0;

    // 등락 방향 판별 (하락 아이콘 포함 행은 음수)
    const dirEl = $(cells[4]).find('img');
    const dirSrc = dirEl.attr('src') ?? '';
    const isDown = dirSrc.includes('down') || dirSrc.includes('fall');

    stocks.push({
      rank,
      stock_code,
      company_name,
      price,
      change: isDown ? -Math.abs(change) : Math.abs(change),
      change_pct: isDown ? -Math.abs(change_pct) : Math.abs(change_pct),
    });
  });

  console.log(`[crawl] 완료 — ${stocks.length}개 종목 파싱`);
  return stocks.slice(0, 10);
}

async function upsertToSupabase(
  stocks: Omit<Stock, 'id' | 'updated_at'>[]
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  console.log(`[db] DELETE 기존 행`);

  const { error: delErr } = await supabase
    .from('kospi_top10_cache')
    .delete()
    .gte('rank', 1);
  if (delErr) throw new Error(`[db] DELETE 실패: ${delErr.message}`);

  const rows = stocks.map((s) => ({ ...s, updated_at: now }));
  console.log(`[db] INSERT ${rows.length}개 행`);

  const { error: insErr } = await supabase
    .from('kospi_top10_cache')
    .insert(rows);
  if (insErr) throw new Error(`[db] INSERT 실패: ${insErr.message}`);

  console.log(`[db] 완료 — updated_at: ${now}`);
}

export async function GET() {
  const start = Date.now();
  console.log('[api/stocks] GET 요청 시작');

  const supabase = getSupabase();

  try {
    // 캐시 확인
    const { data: cached, error: cacheErr } = await supabase
      .from('kospi_top10_cache')
      .select('*')
      .order('rank', { ascending: true })
      .limit(10);

    if (cacheErr) {
      console.warn('[api/stocks] 캐시 조회 오류:', cacheErr.message);
    }

    if (cached && cached.length > 0) {
      const updatedAt = new Date(cached[0].updated_at).getTime();
      const age = Date.now() - updatedAt;

      if (age < CACHE_TTL_MS) {
        console.log(`[api/stocks] 캐시 히트 (age: ${Math.round(age / 1000)}s) — ${cached.length}개 반환`);
        console.log(`[api/stocks] 응답 시간: ${Date.now() - start}ms`);
        return NextResponse.json({ data: cached, source: 'cache' });
      }
      console.log(`[api/stocks] 캐시 만료 (age: ${Math.round(age / 1000)}s) — 재크롤링`);
    } else {
      console.log('[api/stocks] 캐시 없음 — 최초 크롤링');
    }

    // 크롤링 & 저장
    const stocks = await crawlNaverFinance();
    await upsertToSupabase(stocks);

    // 저장된 데이터 다시 조회 (id, updated_at 포함)
    const { data: fresh, error: freshErr } = await supabase
      .from('kospi_top10_cache')
      .select('*')
      .order('rank', { ascending: true })
      .limit(10);

    if (freshErr) throw new Error(`[db] 재조회 실패: ${freshErr.message}`);

    console.log(`[api/stocks] 응답 시간: ${Date.now() - start}ms, 종목 수: ${fresh?.length}`);
    return NextResponse.json({ data: fresh, source: 'crawl' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/stocks] 오류:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
