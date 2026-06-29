import React, { useState, useEffect, useCallback } from 'react';
import useMeshStore from '../store/meshStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import ReportGenerator from '../components/analytics/ReportGenerator';
import { BarChart3, ShieldCheck, Activity, Clock, ShieldAlert } from 'lucide-react';

import { useTheme } from '../lib/ThemeContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format ISO timestamp → HH:MM:SS */
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

/** Round a timestamp down to the nearest 2-second bucket (in ms) */
function bucket(isoStr) {
  return Math.floor(new Date(isoStr).getTime() / 2000) * 2000;
}

const CHART_COLORS = ['#00f5ff', '#39ff14', '#ffaa00', '#a855f7', '#f43f5e', '#22d3ee'];

const METRIC_OPTIONS = [
  { value: 'temperature', label: 'Temperature (°C)' },
  { value: 'humidity',    label: 'Humidity (%)' },
  { value: 'gasLevel',    label: 'Gas Level (ppm)' },
  { value: 'cpuUsage',    label: 'CPU Usage (%)' },
  { value: 'latency',     label: 'Latency (ms)' },
  { value: 'wifiSignal',  label: 'WiFi Signal (dBm)' },
];

// ── Custom X-Axis tick — only render every Nth label ─────────────────────────
function SparseTick({ x, y, payload, totalTicks, maxLabels = 8 }) {
  const step = Math.max(1, Math.floor(totalTicks / maxLabels));
  if (payload.index % step !== 0) return null;
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={11} fontFamily="'Share Tech Mono', monospace">
      {payload.value}
    </text>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, metricLabel }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isDark ? '#07162c' : 'rgba(255, 255, 255, 0.95)',
      border: `1px solid ${isDark ? 'rgba(0,245,255,0.4)' : 'rgba(8, 145, 178, 0.3)'}`,
      borderRadius: 6, padding: '10px 14px',
      fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: 'var(--text-primary)',
      boxShadow: isDark ? '0 0 20px rgba(0,245,255,0.1)' : '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--accent)', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => {
        const itemColor = p.stroke === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                        : p.stroke === '#39ff14' ? (isDark ? '#39ff14' : '#059669')
                        : p.stroke === '#ffaa00' ? (isDark ? '#ffaa00' : '#d97706')
                        : p.stroke === '#a855f7' ? (isDark ? '#a855f7' : '#7c3aed')
                        : p.stroke === '#f43f5e' ? (isDark ? '#f43f5e' : '#e11d48')
                        : (isDark ? '#22d3ee' : '#0ea5e9');
        return (
          <div key={p.dataKey} style={{ color: itemColor, marginBottom: 3 }}>
            {p.dataKey}: <strong>{p.value != null ? p.value.toFixed(2) : '—'}</strong>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [range, setRange]               = useState('15m');
  const [selectedMetric, setSelectedMetric] = useState('temperature');
  const [reportData, setReportData]     = useState(null);
  const [compareData, setCompareData]   = useState([]);
  const [activeNodeIds, setActiveNodeIds] = useState([]);
  const [loading, setLoading]           = useState(true);
  const { nodes } = useMeshStore();

  const fetchData = useCallback(async () => {
    try {
      // 1. Report
      const repRes  = await fetch('/api/analytics/report');
      const repJson = await repRes.json();
      if (repJson.success) setReportData(repJson.data);

      // 2. Resolve active node IDs — strip [HW]/(HW) suffixes for the API call
      const nonGw = nodes.filter(n => !n.isGateway && n.status !== 'failed');
      const ids = nonGw.length > 0
        ? nonGw.map(n => n.nodeId.replace(/[\s[(]+HW[\s\])]*$/i, '').trim())
        : ['ESP32-A', 'ESP32-B', 'ESP32-C', 'ESP32-D'];
      setActiveNodeIds(ids);

      // 3. Compare API
      const compRes  = await fetch(
        `/api/analytics/compare?nodes=${ids.join(',')}&metric=${selectedMetric}&range=${range}`
      );
      const compJson = await compRes.json();
      if (!compJson.success) return;

      // 4. Merge into time-bucketed rows keyed by 2-second epoch bucket
      //    Key = numeric epoch so we can sort properly
      const bucketMap = {}; // { epochMs: { _ts: epochMs, _label: 'HH:MM:SS', nodeId: value, … } }

      Object.entries(compJson.data).forEach(([nodeId, points]) => {
        points.forEach(p => {
          if (p.value == null) return;          // skip nulls — no line needed
          const bkt = bucket(p.timestamp);
          if (!bucketMap[bkt]) {
            bucketMap[bkt] = { _ts: bkt, _label: fmtTime(p.timestamp) };
          }
          // If multiple readings fall in same bucket, average them
          if (bucketMap[bkt][nodeId] == null) {
            bucketMap[bkt][nodeId] = p.value;
          } else {
            bucketMap[bkt][nodeId] = (bucketMap[bkt][nodeId] + p.value) / 2;
          }
        });
      });

      // 5. Sort chronologically by epoch
      const merged = Object.values(bucketMap)
        .sort((a, b) => a._ts - b._ts)
        .map(row => {
          const { _ts, ...rest } = row;
          return rest; // { _label, nodeId: value, … }
        });

      setCompareData(merged);
    } catch (e) {
      console.error('[Analytics] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [range, selectedMetric, nodes]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading && !reportData) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: 'calc(100vh - 80px)', color: 'var(--accent)',
        fontFamily: "'Share Tech Mono', monospace",
      }}>
        LOADING ANALYTICS ENGINE...
      </div>
    );
  }

  const reliabilityRanking = reportData?.reliabilityRanking || [];
  const globalCompliance   = reportData?.failoverSummary?.successRate ?? 100;
  const totalFailovers     = reportData?.failoverSummary?.total ?? 0;
  const totalTicks         = compareData.length;

  const metricLabel = METRIC_OPTIONS.find(m => m.value === selectedMetric)?.label || selectedMetric;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '1.5rem',
      padding: '1.5rem', background: 'var(--bg-0)',
      minHeight: 'calc(100vh - 80px)', boxSizing: 'border-box',
      color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace",
    }}>

      {/* ── Header bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <BarChart3 size={28} color="var(--accent)" />
          <h2 style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem',
            color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px',
          }}>
            Historical Analytics
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Time range selector */}
          <div style={{
            display: 'flex', background: 'var(--bg-glass)',
            border: '1px solid var(--border-bright)', borderRadius: 4, overflow: 'hidden',
          }}>
            {['5m', '15m', '30m', '1h'].map(t => (
              <button key={t} onClick={() => setRange(t)} style={{
                padding: '0.4rem 0.8rem',
                background: range === t ? 'var(--bg-glass)' : 'transparent',
                border: 'none',
                color: range === t ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace",
                textTransform: 'uppercase',
              }}>
                {t}
              </button>
            ))}
          </div>
          <ReportGenerator />
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        {[
          {
            icon: <Activity size={16} color="var(--accent)" />,
            label: 'GLOBAL SLA COMPLIANCE',
            value: `${globalCompliance}% UPTIME`,
            color: globalCompliance > 90 ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ffaa00' : '#d97706'),
          },
          {
            icon: <ShieldCheck size={16} color="var(--accent)" />,
            label: 'ACTIVE NODES ONLINE',
            value: `${reliabilityRanking.filter(n => n.status !== 'failed').length} / ${reliabilityRanking.length}`,
            color: isDark ? '#39ff14' : '#059669',
          },
          {
            icon: <ShieldAlert size={16} color="var(--accent-red)" />,
            label: 'INCIDENTS PREVENTED',
            value: `${totalFailovers} FAILOVERS`,
            color: isDark ? '#ff073a' : '#e11d48',
          },
          {
            icon: <Clock size={16} color="var(--accent)" />,
            label: 'SAMPLE COUNTER',
            value: `${totalTicks} TICKS`,
            color: 'var(--text-primary)',
          },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-card)', padding: '1.2rem',
            borderRadius: 4, border: '1px solid var(--border-dim)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem',
            }}>
              {card.icon} {card.label}
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Rankings ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

        {/* Line chart */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 4, padding: '1.2rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.6rem',
          }}>
            <h3 style={{
              fontFamily: "'Orbitron', sans-serif", fontSize: '1rem',
              color: 'var(--accent)', margin: 0,
            }}>
              NODE CROSS-COMPARISON OVER TIME
            </h3>

            <select
              value={selectedMetric}
              onChange={e => setSelectedMetric(e.target.value)}
              style={{
                background: 'var(--input-bg)', border: '1px solid var(--border-bright)',
                color: 'var(--accent)', fontFamily: "'Share Tech Mono', monospace",
                padding: '0.2rem 0.5rem', borderRadius: 3, outline: 'none',
              }}
            >
              {METRIC_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {compareData.length === 0 ? (
            <div style={{
              height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-heading)', opacity: 0.7, fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: 24 }}>📡</span>
              COLLECTING DATA — PLEASE WAIT...
              <span style={{ fontSize: 10, opacity: 0.5 }}>
                (history builds over the selected time range)
              </span>
            </div>
          ) : (
            <div style={{ height: 300, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={compareData}
                  margin={{ top: 10, right: 16, left: -10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(224,232,240,0.05)" : "rgba(0,0,0,0.05)"} />

                  <XAxis
                    dataKey="_label"
                    stroke={isDark ? "rgba(224,232,240,0.3)" : "#94a3b8"}
                    tick={props => (
                      <SparseTick
                        {...props}
                        totalTicks={totalTicks}
                        maxLabels={8}
                      />
                    )}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={{ stroke: isDark ? 'rgba(0,245,255,0.15)' : 'rgba(0,0,0,0.08)' }}
                  />

                  <YAxis
                    stroke={isDark ? "rgba(224,232,240,0.3)" : "#94a3b8"}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}
                    tickLine={false}
                    axisLine={{ stroke: isDark ? 'rgba(0,245,255,0.15)' : 'rgba(0,0,0,0.08)' }}
                    width={45}
                  />

                  <Tooltip
                    content={<CustomTooltip metricLabel={metricLabel} />}
                    cursor={{ stroke: isDark ? 'rgba(0,245,255,0.2)' : 'rgba(0,0,0,0.1)', strokeWidth: 1 }}
                  />

                  <Legend
                    wrapperStyle={{
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: 11, paddingTop: 8,
                    }}
                  />

                  {activeNodeIds.map((nodeId, i) => {
                    const originalColor = CHART_COLORS[i % CHART_COLORS.length];
                    const resolvedLineColor = originalColor === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                                            : originalColor === '#39ff14' ? (isDark ? '#39ff14' : '#059669')
                                            : originalColor === '#ffaa00' ? (isDark ? '#ffaa00' : '#d97706')
                                            : originalColor === '#a855f7' ? (isDark ? '#a855f7' : '#7c3aed')
                                            : originalColor === '#f43f5e' ? (isDark ? '#f43f5e' : '#e11d48')
                                            : (isDark ? '#22d3ee' : '#0ea5e9');
                    return (
                      <Line
                        key={nodeId}
                        type="monotone"
                        dataKey={nodeId}
                        name={nodeId}
                        stroke={resolvedLineColor}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Reliability rankings */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
          borderRadius: 4, padding: '1.2rem',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          <h3 style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '1rem',
            color: 'var(--accent)', margin: 0,
            borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.6rem',
          }}>
            NODE RELIABILITY RANKINGS
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {reliabilityRanking.map(node => (
              <div key={node.nodeId} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{node.label || node.nodeId}</span>
                  <span style={{ color: node.uptime > 95 ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ffaa00' : '#d97706') }}>
                    {node.uptime.toFixed(2)}% UPTIME
                  </span>
                </div>
                <div style={{
                  background: isDark ? 'rgba(4,13,26,0.6)' : 'rgba(0,0,0,0.06)', height: 6, borderRadius: 3,
                  overflow: 'hidden', border: '1px solid var(--border-dim)',
                }}>
                  <div style={{
                    width: `${node.uptime}%`, height: '100%',
                    background: node.uptime > 95
                      ? (isDark ? 'linear-gradient(90deg,#00f5ff,#39ff14)' : 'linear-gradient(90deg,#0891b2,#059669)')
                      : (isDark ? 'linear-gradient(90deg,#ffaa00,#ff073a)' : 'linear-gradient(90deg,#d97706,#e11d48)'),
                    boxShadow: isDark ? '0 0 5px rgba(0,245,255,0.3)' : 'none',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
