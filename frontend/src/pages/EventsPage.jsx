import EventConsole from '../components/events/EventConsole';

export default function EventsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em' }}>
        SYSTEM EVENT LOGS
      </div>
      <EventConsole maxHeight="calc(100vh - 180px)" />
    </div>
  );
}
