'use client';

import { useEffect, useState } from 'react';
import { Stock } from '@/types/stock';

function formatPrice(n: number) {
  return n.toLocaleString('ko-KR');
}

function formatChange(n: number) {
  return (n >= 0 ? '+' : '') + n.toLocaleString('ko-KR');
}

function formatPct(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  // KST = UTC+9
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const da = String(kst.getUTCDate()).padStart(2, '0');
  const h = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${y}.${mo}.${da} ${h}:${mi} KST`;
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stocks')
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setError(res.error);
        } else {
          setStocks(res.data ?? []);
          if (res.data?.length > 0) setUpdatedAt(res.data[0].updated_at);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0d1b2a', color: '#e2e8f0' }}>
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            KOSPI Market Cap Top 10
          </h1>
          {updatedAt && (
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              <span className="mr-1">🕐</span>
              Last Updated: {formatDate(updatedAt)}
            </p>
          )}
          {loading && (
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              데이터 불러오는 중...
            </p>
          )}
        </header>

        {/* Error */}
        {error && (
          <div
            className="mb-6 p-4 rounded text-sm"
            style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}
          >
            오류: {error}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e3a5f' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#112240' }}>
                  <th className="py-3 px-4 text-left font-semibold tracking-wider text-xs" style={{ color: '#64748b' }}>
                    RANK
                  </th>
                  <th className="py-3 px-4 text-left font-semibold tracking-wider text-xs" style={{ color: '#64748b' }}>
                    COMPANY
                  </th>
                  <th className="py-3 px-4 text-right font-semibold tracking-wider text-xs" style={{ color: '#64748b' }}>
                    PRICE (KRW)
                  </th>
                  <th className="py-3 px-4 text-right font-semibold tracking-wider text-xs" style={{ color: '#64748b' }}>
                    CHANGE
                  </th>
                  <th className="py-3 px-4 text-right font-semibold tracking-wider text-xs" style={{ color: '#64748b' }}>
                    24H %
                  </th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((stock, idx) => {
                  const positive = stock.change >= 0;
                  return (
                    <tr
                      key={stock.id}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#0d1b2a' : '#0f2035',
                        borderTop: '1px solid #1e3a5f',
                      }}
                    >
                      {/* RANK */}
                      <td className="py-4 px-4 text-white font-medium">
                        {stock.rank}
                      </td>
                      {/* COMPANY */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{stock.company_name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#38bdf8' }}>
                          {stock.stock_code}
                        </div>
                      </td>
                      {/* PRICE */}
                      <td className="py-4 px-4 text-right text-white font-medium">
                        {formatPrice(stock.price)}
                      </td>
                      {/* CHANGE */}
                      <td
                        className="py-4 px-4 text-right font-medium"
                        style={{ color: positive ? '#4ade80' : '#f87171' }}
                      >
                        {formatChange(stock.change)}
                      </td>
                      {/* 24H % */}
                      <td className="py-4 px-4 text-right">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: positive ? '#14532d' : '#7f1d1d',
                            color: positive ? '#4ade80' : '#f87171',
                          }}
                        >
                          {formatPct(stock.change_pct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <footer
          className="mt-8 flex justify-between items-center text-xs"
          style={{ color: '#475569' }}
        >
          <span>© {new Date().getFullYear()} Korea Exchange (KRX) Market Data</span>
          <nav className="flex gap-4">
            <a href="#" className="hover:text-slate-300 transition-colors">
              Market Analysis
            </a>
            <a href="#" className="hover:text-slate-300 transition-colors">
              Historical Data
            </a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
