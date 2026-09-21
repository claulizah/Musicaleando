import Link from 'next/link';
import type { Metadata } from 'next';
import { Unbounded, Plus_Jakarta_Sans, Space_Mono } from 'next/font/google';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Musicaleando — Tu música, tu festival, tu gente',
  description:
    'Descubre tu perfil musical, comparte tu mood del día, arma squad con tus amigos y no te pierdas ningún festival cerca de ti.',
};

// Solo cargadas aquí (no en layout.tsx) para no afectar el bundle de
// /privacidad y /terminos, que no usan este sistema visual.
const unbounded = Unbounded({
  subsets: ['latin'],
  weight: ['400', '600', '800', '900'],
  variable: '--font-unbounded',
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
});

// Copy final de producto ya aprobado (rediseño "festival nocturno" — ver
// mockup de referencia). El tratamiento visual cambió por completo; el
// copy en sí viene del mockup aprobado, no inventado en esta pasada.
const STRIP_ITEMS = [
  { label: 'Perfil musical', accent: 'express' },
  { label: 'Mood', accent: 'en tiempo real' },
  { label: 'Squads', accent: 'por afinidad' },
  { label: 'Festival', accent: 'hub' },
];

const FEATURES = [
  {
    time: '01 · Antes de entrar',
    title: 'Perfil musical express',
    body: 'Arma tu perfil en segundos: géneros, artistas y el vibe que traes hoy, listo para conectar.',
  },
  {
    time: '02 · Todo el día',
    title: 'Mood del día',
    body: 'Tu estado de ánimo musical cambia con el festival — la app lo sabe y te sugiere con quién y qué escuchar.',
  },
  {
    time: '03 · Entre escenarios',
    title: 'Squads',
    body: 'Encuentra o arma tu grupo por gustos en común, del reggaetón al rock en español, sin perder a nadie en la caravana.',
  },
  {
    time: '04 · En el momento',
    title: 'Festival Hub',
    body: 'Horarios, escenarios y food trucks en un solo lugar — para que solo te preocupes de gritar "otra, otra".',
  },
];

const TICKETS = [
  {
    className: styles.ticket1,
    stage: 'Escenario Norte · 21:40',
    track: 'Corridos Tumbados',
    meta: '3 de tu squad van',
    stubLeft: 'ACCESO GENERAL',
    stubRight: '#0472',
  },
  {
    className: styles.ticket2,
    stage: 'Mood del día',
    track: 'Reggaetón / Alto voltaje',
    meta: 'Basado en tus últimas 12 h',
    stubLeft: 'HOY',
    stubRight: '♪ 128 bpm',
  },
  {
    className: styles.ticket3,
    stage: 'Squad Hub',
    track: 'Caravana Rock en Español',
    meta: '7 personas cerca de ti',
    stubLeft: 'ACTIVO',
    stubRight: '📍 320m',
  },
];

export default function LandingPage() {
  return (
    <div className={`${styles.page} ${unbounded.variable} ${jakarta.variable} ${spaceMono.variable}`}>
      <div className={styles.wrap}>
        <nav className={styles.nav}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              🎧
            </span>
            Musicaleando
          </Link>
          <div className={styles.navLinks}>
            <a href="#lineup">Qué hace</a>
            <a href="#descarga">Descargar</a>
            <Link href="/privacidad">Privacidad</Link>
          </div>
        </nav>

        {/* Hero */}
        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Próximamente en iOS y Android
            </div>
            <h1 className={styles.heroTitle}>
              Tu música,
              <br />
              tu <span className={styles.accent}>festival</span>,
              <br />
              tu gente.
            </h1>
            <p className={styles.lede}>
              La app para descubrir tu perfil musical, encontrar a tu squad entre la multitud y
              no perderte ni un set — desde el primer acorde hasta el último grito de &quot;otra,
              otra&quot;.
            </p>
            <div className={styles.ctaRow}>
              <span
                className={`${styles.btn} ${styles.btnPrimary}`}
                title="Próximamente"
                aria-disabled="true"
              >
                🍎 <span><small>Descarga en</small>App Store</span>
              </span>
              <span
                className={`${styles.btn} ${styles.btnGhost}`}
                title="Próximamente"
                aria-disabled="true"
              >
                ▶ <span><small>Disponible en</small>Google Play</span>
              </span>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.glow} aria-hidden="true" />
            {TICKETS.map((t) => (
              <div key={t.stage} className={`${styles.ticket} ${t.className}`}>
                <div className={styles.stage}>{t.stage}</div>
                <div className={styles.track}>{t.track}</div>
                <div className={styles.meta}>{t.meta}</div>
                <div className={styles.stub}>
                  <span>{t.stubLeft}</span>
                  <span>{t.stubRight}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strip */}
        <div className={styles.strip}>
          {STRIP_ITEMS.map((item) => (
            <div key={item.label}>
              {item.label} <span>{item.accent}</span>
            </div>
          ))}
        </div>

        {/* Line-up de funciones */}
        <section id="lineup" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.sectionTag}>Line-up de funciones</p>
              <h2 className={styles.sectionTitle}>Todo lo que necesitas entre set y set</h2>
            </div>
            <p className={styles.sectionNote}>
              Cuatro herramientas, un solo objetivo: vivir el festival con tu gente.
            </p>
          </div>
          <div className={styles.lineup}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.slot}>
                <span className={styles.slotTime}>{f.time}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Descarga */}
        <section id="descarga" className={styles.section}>
          <div className={styles.ctaBlock}>
            <p className={`${styles.sectionTag} ${styles.ctaTag}`}>Muy pronto</p>
            <h2 className={`${styles.sectionTitle} ${styles.ctaTitle}`}>
              Nos vemos en el próximo festival
            </h2>
            <p>
              Estamos afinando los últimos detalles antes de subir a las tiendas. Guarda el
              lugar — tu squad te va a estar esperando.
            </p>
            <div className={styles.storeRow}>
              <div className={styles.storeBtn}>
                🍎 <span><strong>App Store</strong>Próximamente</span>
              </div>
              <div className={styles.storeBtn}>
                ▶ <span><strong>Google Play</strong>Próximamente</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Musicaleando</span>
          <div className={styles.footLinks}>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/terminos">Términos</Link>
            <Link href="/eliminar-cuenta">Eliminar cuenta</Link>
            <a href="mailto:clauliz.acosta@gmail.com">Contacto</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
