import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Musicaleando — Tu música, tu festival, tu gente',
  description:
    'Descubre tu perfil musical, comparte tu mood del día, arma squad con tus amigos y no te pierdas ningún festival cerca de ti.',
};

// Copy final de producto para la landing pública (ver ESTADO.md) — diseño e
// imágenes son placeholders a propósito hasta que haya branding/capturas
// definitivas; el copy en sí ya no es un placeholder técnico.
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
      {/* Hero */}
      <section className="flex flex-col gap-6 text-center">
        <p className="text-sm font-medium text-gray-500">Musicaleando</p>
        <h1 className="text-4xl font-semibold text-gray-900">Tu música, tu festival, tu gente.</h1>
        <p className="mx-auto max-w-xl text-gray-600">
          Descubre tu perfil musical, comparte tu mood del día, arma squad con tus amigos y no
          te pierdas ningún festival cerca de ti.
        </p>
        <div className="mt-2 flex justify-center gap-3">
          <span
            title="Próximamente"
            className="cursor-not-allowed rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-400"
          >
            📱 App Store — próximamente
          </span>
          <span
            title="Próximamente"
            className="cursor-not-allowed rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-400"
          >
            🤖 Google Play — próximamente
          </span>
        </div>
      </section>

      {/* Qué puedes hacer */}
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
        <div className="mt-6 flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16 text-sm text-gray-400">
          screenshot placeholder
        </div>
      </section>

      {/* Para marcas y patrocinadores */}
      <section className="rounded-xl bg-gray-900 px-6 py-10 text-center text-white">
        <h2 className="text-2xl font-semibold">
          Llega a la audiencia correcta, sin comprometer su privacidad.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-300">
          Musicaleando permite a marcas y patrocinadores promocionar rifas, descuentos y
          anuncios segmentados por ciudad o por género musical — siempre con reportes agregados
          y anónimos. Nunca compartimos listas de usuarios ni datos individuales.
        </p>
        <p className="mt-6 inline-block rounded-md bg-white px-5 py-2 text-sm font-medium text-gray-900">
          Contáctanos: <a href="mailto:clauliz.acosta@gmail.com" className="underline">clauliz.acosta@gmail.com</a>
        </p>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-3 border-t border-gray-200 pt-8 text-sm text-gray-500">
        <p className="font-medium text-gray-700">Musicaleando</p>
        <div className="flex gap-4">
          <Link href="/privacidad" className="underline">
            Aviso de Privacidad
          </Link>
          <Link href="/terminos" className="underline">
            Términos y Condiciones
          </Link>
          <Link href="/login" className="underline">
            Panel de administración
          </Link>
        </div>
        <p><a href="mailto:clauliz.acosta@gmail.com" className="underline">clauliz.acosta@gmail.com</a></p>
        <p>© {new Date().getFullYear()} Musicaleando. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
