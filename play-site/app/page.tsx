const GAMES = [
  {
    slug: 'dropthemike',
    emoji: '🎤',
    title: 'DropTheMike',
    tagline: 'El juego de fiesta donde cantas la palabra.',
  },
];

export default function PlayHub() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center gap-10 px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-medium tracking-wide" style={{ color: 'var(--ink-dim)' }}>
          Musicaleando
        </p>
        <h1
          className="mt-2 text-4xl font-extrabold"
          style={{ fontFamily: "'Baloo 2', sans-serif", color: 'var(--magenta)' }}
        >
          Play
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: 'var(--ink-dim)' }}>
          Minijuegos de fiesta — se juegan directo en el navegador, sin descargar nada.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((game) => (
          <a
            key={game.slug}
            href={`/${game.slug}`}
            className="flex flex-col gap-2 rounded-2xl border p-6 transition-transform hover:scale-[1.02]"
            style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
          >
            <span className="text-3xl">{game.emoji}</span>
            <span className="text-xl font-bold" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              {game.title}
            </span>
            <span className="text-sm" style={{ color: 'var(--ink-dim)' }}>
              {game.tagline}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
