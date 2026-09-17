'use client';

import { useState, useEffect } from 'react';
import TagCard from '@/components/TagCard';

interface Tag {
  id: string;
  product_name: string;
  origin: string | null;
  category: string;
  is_active: boolean;
  expires_at: string;
  drive_file_id?: string;
}

export default function EtiquetasPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  async function fetchTags() {
    try {
      const res = await fetch('/api/digital-tags');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTags(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/sync-drive');
      const data = await res.json();
      if (data.error) {
        setSyncMsg(`❌ Error: ${data.error}`);
      } else {
        setSyncMsg(`✅ Sincronización completada · ${data.synchronized || 0} etiquetas actualizadas`);
        fetchTags();
      }
    } catch (err) {
      console.error(err);
      setSyncMsg('❌ Error en la sincronización');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Cargando etiquetas...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          {/* Logo */}
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="17" stroke="#FF7A00" strokeWidth="2"/>
                <path d="M8 18 Q18 8 28 18 Q18 28 8 18Z" fill="#FF7A00" opacity="0.15"/>
                <ellipse cx="22" cy="14" rx="6" ry="4" fill="#C0C0C0"/>
                <circle cx="25" cy="13" r="1" fill="#1a1a1a"/>
                <text x="10" y="26" fontFamily="Arial Black" fontWeight="900" fontSize="10" fill="#C0C0C0">CA</text>
                <text x="20" y="26" fontFamily="Arial Black" fontWeight="900" fontSize="10" fill="#FF7A00">46</text>
              </svg>
            </div>
            <div>
              <h1 style={styles.logoTitle}>CA<span style={styles.logoTitleOrange}>46</span></h1>
              <p style={styles.logoSubtitle}>Etiquetas Digitales</p>
            </div>
          </div>

          {/* Sync button */}
          <div style={styles.syncArea}>
            {syncMsg && (
              <span style={{
                ...styles.syncMsg,
                color: syncMsg.startsWith('✅') ? '#4ade80' : '#f87171'
              }}>
                {syncMsg}
              </span>
            )}
            <button
              id="btn-sincronizar"
              onClick={handleSync}
              disabled={syncing}
              style={syncing ? styles.btnSyncDisabled : styles.btnSync}
            >
              {syncing ? (
                <>
                  <span style={styles.btnSpinner} />
                  Sincronizando...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 4v6h-6M1 20v-6h6"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Sincronizar Drive
                </>
              )}
            </button>
          </div>
        </div>

        {/* Decorative line */}
        <div style={styles.headerLine} />
      </header>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{tags.length}</span>
          <span style={styles.statLabel}>Etiquetas activas</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={styles.statNumber}>{new Set(tags.map(t => t.drive_file_id ? 'Drive' : 'Manual')).size}</span>
          <span style={styles.statLabel}>Fuentes documentales</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statItem}>
          <span style={styles.statDot} />
          <span style={styles.statLabel}>Sistema activo</span>
        </div>
      </div>

      {/* Main content */}
      <main style={styles.main}>
        {tags.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="1.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
            </div>
            <h2 style={styles.emptyTitle}>No hay etiquetas disponibles</h2>
            <p style={styles.emptyText}>
              Pulsa <strong style={{color:'#FF7A00'}}>Sincronizar Drive</strong> para importar las etiquetas desde Google Drive.
            </p>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={syncing ? styles.btnSyncDisabled : { ...styles.btnSync, marginTop: '1.5rem' }}
            >
              {syncing ? 'Sincronizando...' : '⟳ Sincronizar ahora'}
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {tags.map((tag) => (
              <TagCard key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <span style={styles.footerText}>CA46 · Ecosistema Inteligente de Trazabilidad Alimentaria</span>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #111318; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d0f14 0%, #111318 50%, #161a20 100%)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', sans-serif",
    color: '#e2e8f0',
  },
  loadingScreen: {
    minHeight: '100vh',
    background: '#0d0f14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #2d3748',
    borderTop: '3px solid #FF7A00',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '1rem',
    fontWeight: 500,
  },
  header: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,122,0,0.15)',
    padding: '0 1.5rem',
  },
  headerInner: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1.25rem 0',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
  },
  logoIcon: {
    filter: 'drop-shadow(0 0 8px rgba(255,122,0,0.4))',
  },
  logoTitle: {
    fontSize: '1.75rem',
    fontWeight: 900,
    color: '#C0C0C0',
    letterSpacing: '-0.02em',
    lineHeight: 1,
  },
  logoTitleOrange: {
    color: '#FF7A00',
  },
  logoSubtitle: {
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginTop: '2px',
  },
  syncArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
  },
  syncMsg: {
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  btnSync: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'linear-gradient(135deg, #FF7A00, #e06500)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '0.65rem 1.4rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255,122,0,0.35)',
    transition: 'all 0.2s',
    letterSpacing: '0.01em',
  },
  btnSyncDisabled: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255,122,0,0.3)',
    color: 'rgba(255,255,255,0.6)',
    border: 'none',
    borderRadius: '10px',
    padding: '0.65rem 1.4rem',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  btnSpinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  headerLine: {
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #FF7A00 30%, #C0C0C0 60%, transparent)',
    opacity: 0.3,
  },
  statsBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '1rem 1.5rem',
    width: '100%',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  statNumber: {
    fontSize: '1.5rem',
    fontWeight: 900,
    color: '#FF7A00',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    fontWeight: 500,
  },
  statDivider: {
    width: '1px',
    height: '24px',
    background: 'rgba(255,255,255,0.08)',
  },
  statDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80',
    boxShadow: '0 0 8px #4ade80',
    animation: 'pulse 2s infinite',
  },
  main: {
    flex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    padding: '1rem 1.5rem 3rem',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem 2rem',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,122,0,0.1)',
    borderRadius: '20px',
    textAlign: 'center' as const,
    marginTop: '2rem',
  },
  emptyIcon: {
    marginBottom: '1.5rem',
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: '0.75rem',
  },
  emptyText: {
    fontSize: '0.95rem',
    color: '#64748b',
    maxWidth: '380px',
    lineHeight: 1.6,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.25rem',
  },
  footer: {
    textAlign: 'center' as const,
    padding: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  footerText: {
    fontSize: '0.75rem',
    color: '#475569',
    letterSpacing: '0.05em',
  },
};
