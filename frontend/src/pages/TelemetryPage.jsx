import TelemetryDashboard from '../components/telemetry/TelemetryDashboard';

export default function TelemetryPage() {
  return (
    <div>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em', marginBottom: 16 }}>
        REALTIME SENSOR TELEMETRY
      </div>
      <TelemetryDashboard />
    </div>
  );
}
