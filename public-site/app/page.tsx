const FEATURES = [
  {
    emoji: '🎧',
    title: 'Perfil musical express',
    body: 'Responde unas preguntas rápidas y descubre tu perfil musical — géneros, artistas, y qué tipo de escucha eres.',
  },
  {
    emoji: '🎭',
    title: 'Mood del día',
    body: 'Comparte cómo te sientes musicalmente hoy y descubre el mood de tu squad.',
  },
  {
    emoji: '👥',
    title: 'Squads',
    body: 'Arma equipo con tus amigos y sigan juntos los festivales que les interesan.',
  },
  {
    emoji: '🎪',
    title: 'Festival Hub',
    body: 'Encuentra festivales y conciertos, marca los que te interesan, y compra tus boletos sin salir del flujo cuando estén disponibles a través de nuestros aliados de boletaje.',
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-20 px-4 py-16">
      <section className="flex flex-col gap-6 text-center">
        <p className="text-sm font-medium text-gray-500">Musicaleando</p>
        <h1 className="text-4xl font-semibold text-gray-900">Tu música, tu festival, tu gente.</h1>
        <p className="mx-auto max-w-xl text-gray-600">
          Descubre tu perfil musical, comparte tu mood del día, arma squad con tus amigos y no
          te pierdas ningún festival cerca de ti.
        </p>
      </section>

      <section className="rounded-xl border border-pink-200 bg-gradient-to-br from-pink-50 to-purple-50 px-6 py-10 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">🎤 Juega DropTheMike</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-600">
          El juego de fiesta donde cada ronda te da una palabra y la tienes que cantar. Sin
          descargar nada — se juega directo en el navegador con tu grupo.
        </p>
        <a
          href="/dropthemike.html"
          className="mt-6 inline-block rounded-md bg-pink-600 px-6 py-3 text-sm font-medium text-white hover:bg-pink-700"
        >
          🎤 Juega DropTheMike
        </a>
      </section>

      <section>
        <h2 className="text-center text-2xl font-semibold text-gray-900">
          Qué puedes hacer en Musicaleando
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-gray-200 bg-white p-5">
              <p className="text-2xl">{f.emoji}</p>
              <h3 className="mt-2 font-medium text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 border-t border-gray-200 pt-8 text-sm text-gray-500">
        <p className="font-medium text-gray-700">Musicaleando</p>
        <p><a href="mailto:clauliz.acosta@gmail.com" className="underline">clauliz.acosta@gmail.com</a></p>
        <p>© {new Date().getFullYear()} Musicaleando. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
