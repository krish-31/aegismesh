import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { Download } from 'lucide-react';

export function generateReport(data) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  // Setup fonts & colors
  doc.setFillColor(4, 13, 26); // Dark blue background for header
  doc.rect(0, 0, 210, 30, 'F');
  
  // Header text
  doc.setTextColor(0, 245, 255); // Cyan
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.text('AEGISMESH NETWORK HEALTH REPORT', 14, 18);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.text(`Generated: ${timestamp} | NOC Security Officer`, 14, 25);

  // Section 1: Executive Summary
  doc.setTextColor(0, 245, 255);
  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.text('1. EXECUTIVE SUMMARY', 14, 45);

  doc.setTextColor(50, 50, 50);
  doc.line(14, 47, 196, 47);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('courier', 'normal');

  const failedCount = data.reliabilityRanking.filter(n => n.status === 'failed').length;
  const activeCount = data.reliabilityRanking.length - failedCount;

  doc.text(`* Network Topology Status: ${data.failoverSummary.successRate > 90 ? 'HEALTHY / ACTIVE' : 'DEGRADED / CRITICAL'}`, 14, 55);
  doc.text(`* Active/Total Node Ratio: ${activeCount} / ${data.reliabilityRanking.length} nodes online`, 14, 60);
  doc.text(`* Failover Recalculations: ${data.failoverSummary.total} triggered (${data.failoverSummary.successRate}% Dijkstra recovery success rate)`, 14, 65);
  
  // Section 2: Node Reliability Rankings
  doc.setTextColor(0, 245, 255);
  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.text('2. NODE AVAILABILITY & RELIABILITY INDEX', 14, 80);
  doc.setTextColor(50, 50, 50);
  doc.line(14, 82, 196, 82);

  // Draw Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(14, 88, 182, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('courier', 'bold');
  doc.text('Node ID', 18, 93);
  doc.text('Label', 45, 93);
  doc.text('Status', 85, 93);
  doc.text('Uptime Compliance', 125, 93);

  // Draw Table Rows
  doc.setFont('courier', 'normal');
  let y = 101;
  data.reliabilityRanking.forEach(node => {
    doc.text(node.nodeId, 18, y);
    doc.text(node.label, 45, y);
    doc.text(node.status.toUpperCase(), 85, y);
    doc.text(`${node.uptime.toFixed(2)}%`, 125, y);
    
    // Uptime progress bar
    doc.setFillColor(220, 220, 220);
    doc.rect(160, y - 3, 30, 3, 'F');
    const barWidth = (node.uptime / 100) * 30;
    doc.setFillColor(node.uptime > 95 ? 57 : 255, node.uptime > 95 ? 255 : 7, node.uptime > 95 ? 20 : 58); // Green/Red
    doc.rect(160, y - 3, barWidth, 3, 'F');

    y += 8;
  });

  // Section 3: Failover Incidents Logs
  y += 5;
  doc.setTextColor(0, 245, 255);
  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.text('3. ROUTE FAILOVER LOGS', 14, y);
  doc.setTextColor(50, 50, 50);
  doc.line(14, y + 2, 196, y + 2);

  y += 8;
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const recents = data.failoverSummary.recent || [];
  if (recents.length === 0) {
    doc.text('No failover events recorded in this session.', 14, y);
    y += 8;
  } else {
    recents.forEach(f => {
      const time = new Date(f.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const statusText = f.success ? 'SUCCESSFULLY RE-ROUTED' : 'PARTITIONED / UNRECOVERABLE';
      const routeText = f.success ? `[Old: ${f.oldRoute.join('->')} | New: ${f.newRoute.join('->')}]` : '';
      doc.text(`[${time}] ${f.failedNode} failure: ${statusText} ${routeText}`, 14, y);
      y += 6;
    });
  }

  // Section 4: Actionable Recommendations
  y += 5;
  doc.setTextColor(0, 245, 255);
  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.text('4. SYSTEM RECOMMENDATIONS & FORECASTS', 14, y);
  doc.setTextColor(50, 50, 50);
  doc.line(14, y + 2, 196, y + 2);

  y += 8;
  doc.setFontSize(9);
  doc.setFont('courier', 'normal');
  doc.setTextColor(0, 0, 0);

  // Generate recommendation rules dynamically
  const lowestUptime = data.reliabilityRanking[data.reliabilityRanking.length - 1];
  if (lowestUptime && lowestUptime.uptime < 98) {
    doc.text(`* WARNING: ${lowestUptime.label} (${lowestUptime.nodeId}) is unstable (${lowestUptime.uptime}% uptime). Inspect link quality.`, 14, y);
    y += 6;
  } else {
    doc.text('* Optimal mesh health: All nodes maintain greater than 99% availability standards.', 14, y);
    y += 6;
  }

  if (data.failoverSummary.total > 5) {
    doc.text('* High network volatility: Multiple Dijkstra re-routes detected. Recalibrate physical positions.', 14, y);
    y += 6;
  } else {
    doc.text('* Stable paths: Link latency metrics remain in optimal range; low topological drift.', 14, y);
    y += 6;
  }

  // Save the report
  doc.save(`aegismesh-noc-report-${Date.now()}.pdf`);
}

export default function ReportGenerator() {
  const [loading, setLoading] = useState(false);

  const triggerDownload = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/report');
      const json = await response.json();
      if (json.success) {
        generateReport(json.data);
      }
    } catch (e) {
      console.error('Error generating PDF report:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={triggerDownload}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1.2rem',
        background: 'rgba(0, 245, 255, 0.08)',
        border: '1px solid #00f5ff',
        color: '#00f5ff',
        fontFamily: "'Share Tech Mono', monospace",
        textTransform: 'uppercase',
        letterSpacing: '1px',
        cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: '0 0 10px rgba(0, 245, 255, 0.15)',
        transition: 'all 0.3s ease',
      }}
      className="hover-cyan-glow"
    >
      <Download size={16} />
      {loading ? 'Compiling PDF...' : 'Download PDF Report'}
    </button>
  );
}
